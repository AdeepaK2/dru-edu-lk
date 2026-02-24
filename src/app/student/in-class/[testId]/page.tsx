'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Test } from '@/models/testSchema';
import { Button, Card } from '@/components/ui';
import { ArrowLeft, Calendar, Clock, Upload, AlertCircle, CheckCircle, Award, FileText, Eye, Download } from 'lucide-react';
import { InClassSubmission } from '@/models/inClassSubmissionSchema';
import TestTimer from '@/components/student/TestTimer';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
});

const CanvasWriter = dynamic(() => import('@/components/ui/CanvasWriter'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
});
import { doc, getDoc, Timestamp, collection, query, where, onSnapshot, getFirestore, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/utils/firebase-client';
import { InClassSubmissionService } from '@/services/inClassSubmissionService';

export default function StudentInClassTestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useStudentAuth();
  const testId = params.testId as string;
  
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submittedFile, setSubmittedFile] = useState<{ url: string, name: string } | null>(null);
  const [submittedViaFile, setSubmittedViaFile] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [submission, setSubmission] = useState<InClassSubmission | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [canvasTimeRemaining, setCanvasTimeRemaining] = useState<number>(0);
  const [draftAnnotations, setDraftAnnotations] = useState<Record<number, string> | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canvasWriterRef = React.useRef<any>(null);
  const canvasSubmitRef = React.useRef<(() => void) | null>(null);
  const canvasSaveRef = React.useRef<(() => Promise<void>) | null>(null);
  const [savingProgress, setSavingProgress] = React.useState(false);
  const [clockOffsetMs, setClockOffsetMs] = React.useState(0);
  const [showTimeExpiredModal, setShowTimeExpiredModal] = React.useState(false);
  const [timerInitialized, setTimerInitialized] = React.useState(false);
  const autoSubmitFiredRef = React.useRef(false);

  // Download a file in-page by fetching as blob first (works for cross-origin Firebase URLs)
  const downloadFile = async (url: string, filename: string) => {
    try {
      toast.loading('Preparing download...', { id: 'dl' });
      // Route through server-side proxy to avoid CORS on Firebase Storage URLs
      const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      // Open in new tab to handle errors gracefully if proxy fails (browser shows error instead of silent fail)
      window.open(proxyUrl, '_blank');
      toast.dismiss('dl');
    } catch {
      toast.dismiss('dl');
      toast.error('Download failed. Try again.');
    }
  };

  // Calibrate client clock against server Melbourne time on mount
  useEffect(() => {
    fetch('/api/server-time')
      .then(r => r.json())
      .then(data => {
        const offset = (data.nowMs as number) - Date.now();
        setClockOffsetMs(offset);
        console.log(`[ServerTime] Clock offset: ${offset > 0 ? '+' : ''}${offset}ms`);
      })
      .catch(() => console.warn('[ServerTime] Could not fetch server time, using client clock'));
  }, []);

  useEffect(() => {
    if (!user || !testId) return;

    let unsubscribe: (() => void) | null = null;

    const fetchTestAndSetupListener = async () => {
      try {
        setLoading(true);
        // Fetch test details
        const testDoc = await getDoc(doc(firestore, 'tests', testId));
        if (testDoc.exists()) {
          const testData = { id: testDoc.id, ...testDoc.data() } as Test;
          setTest(testData);

          // Set up real-time listener for submission updates (for when teacher grades)
          const submissionsQuery = query(
            collection(firestore, 'inClassSubmissions'),
            where('testId', '==', testId),
            where('studentId', '==', user.uid)
          );

          unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
            if (!snapshot.empty) {
              const submissionDoc = snapshot.docs[0];
              const submissionData = {
                id: submissionDoc.id,
                ...submissionDoc.data()
              } as InClassSubmission;

              console.log('[Submission] Real-time update:', submissionData.status, submissionData.marks);
              setSubmission(submissionData);

              if (submissionData.answerFileUrl) {
                setSubmittedFile({
                  url: submissionData.answerFileUrl,
                  name: 'Previously submitted answer'
                });
              }
            }
          }, (error) => {
            console.error('[Submission] Listener error:', error);
          });
        } else {
          toast.error('Test not found');
          router.push('/student/in-class');
        }
      } catch (error) {
        console.error('Error fetching test:', error);
        toast.error('Failed to load test details');
      } finally {
        setLoading(false);
      }
    };

    fetchTestAndSetupListener();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, testId, router]);

  // Update canvas timer in real-time (server-calibrated)
  useEffect(() => {
    if (!isWriting || !test) {
      setTimerInitialized(false);
      return;
    }

    const updateTimer = () => {
      const startTime = (test as any).scheduledStartTime.toDate();
      const endTime = new Date(startTime.getTime() + (test as any).duration * 60 * 1000);
      const adjustedNow = new Date(Date.now() + clockOffsetMs);
      const remaining = Math.max(0, endTime.getTime() - adjustedNow.getTime());
      setCanvasTimeRemaining(remaining);
      setTimerInitialized(true);
    };

    // Run immediately first
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isWriting, test, clockOffsetMs]);

  // Auto-submit when canvas timer hits zero
  useEffect(() => {
    if (!isWriting || !timerInitialized) return;
    
    // Only trigger if timer has ACTUALLY hit zero after initialization
    if (canvasTimeRemaining === 0 && !autoSubmitFiredRef.current) {
      autoSubmitFiredRef.current = true;
      setShowTimeExpiredModal(true);
      if (canvasSubmitRef.current) canvasSubmitRef.current();
    }
  }, [canvasTimeRemaining, isWriting, timerInitialized]);

  // Check for draft on mount (localStorage + Firestore)
  useEffect(() => {
    if (!user || !testId || !test) return;

    const loadDraft = async () => {
      try {
        // First, check Firestore for saved strokes (source of truth)
        const db = getFirestore();
        const draftRef = doc(db, 'inClassTestDrafts', `${testId}_${user.uid}`);
        const draftDoc = await getDoc(draftRef);
        
        if (draftDoc.exists()) {
          const firestoreData = draftDoc.data();
          if (firestoreData.strokePages && Object.keys(firestoreData.strokePages).length > 0) {
            setDraftAnnotations(firestoreData.strokePages);
            // Don't show prompt - just load the strokes automatically
            console.log('[Recovery] Loaded saved strokes from Firestore:', new Date(firestoreData.lastSaved.toDate()).toLocaleString());
            toast.success('Your previous work has been loaded');
            return; // Use Firestore data, skip localStorage check
          }
        }

        // Fallback to localStorage for crash recovery
        const autoSaveKey = `canvas_draft_${testId}_${user.uid}`;
        const draftJson = localStorage.getItem(autoSaveKey);
        
        if (draftJson) {
          const draft = JSON.parse(draftJson);
          if (draft.pages && Object.keys(draft.pages).length > 0) {
            setDraftAnnotations(draft.pages);
            setShowDraftPrompt(true); // Only show prompt for localStorage recovery
            console.log('[Recovery] Found localStorage draft from', new Date(draft.timestamp).toLocaleString());
          }
        }
      } catch (error) {
        console.error('[Recovery] Failed to load draft:', error);
      }
    };

    loadDraft();
  }, [user, testId, test]);

  const handleTimeExpired = () => {
    setTimeExpired(true);
    if (isWriting && !autoSubmitFiredRef.current) {
      autoSubmitFiredRef.current = true;
      setShowTimeExpiredModal(true);
      if (canvasSubmitRef.current) canvasSubmitRef.current();
    } else if (!isWriting) {
      toast.error('Time has expired!');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('[Upload] No file selected');
      return;
    }

    console.log('[Upload] File selected:', file.name, file.type, file.size);

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to submit');
      return;
    }

    if (!test) {
      toast.error('Test data not loaded');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      console.log('[Upload] Starting upload...');

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const storageRef = ref(storage, `in-class-submissions/${testId}/${user.uid}/${timestamp}_${file.name}`);
      
      // Upload file
      const uploadTask = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      
      // Create or update submission
      const submissionData = {
        testId: testId,
        studentId: user.uid,
        studentName: user.displayName || user.email || 'Unknown Student',
        studentEmail: user.email || '',
        classId: (test as any).classIds?.[0] || '',
        submissionType: 'online_upload' as const,
        answerFileUrl: downloadURL,
        submittedAt: Timestamp.now(),
        status: 'submitted' as const,
        // Include existing submission ID if updating
        ...(submission?.id ? { id: submission.id } : {}),
      };

      console.log('[Upload] File uploaded to storage, saving submission...');
      await InClassSubmissionService.saveSubmission(submissionData);
      console.log('[Upload] Submission saved successfully');

      // Update local submission state
      setSubmission(prev => prev ? { ...prev, ...submissionData } : submissionData as InClassSubmission);

      setSubmittedFile({
        name: file.name,
        url: downloadURL
      });
      setSubmittedViaFile(true);

      toast.success('Answer script uploaded successfully!');
    } catch (error: any) {
      console.error('[Upload] Error:', error);
      const errorMessage = error?.code === 'storage/unauthorized'
        ? 'Permission denied. Please contact support.'
        : error?.code === 'storage/quota-exceeded'
        ? 'Storage quota exceeded. Please contact support.'
        : error instanceof Error
        ? error.message
        : 'Failed to upload file';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Save strokes to Firestore (called automatically by CanvasWriter every 3s)
  const handleStrokeSave = async (strokePages: Record<number, string>) => {
    if (!user || !testId) return;

    // Keep parent state in sync so Close → Reopen restores extra pages
    // (without this, draftAnnotations stays at the value loaded on mount)
    setDraftAnnotations(strokePages);

    try {
      console.log('[StrokeSave] Auto-saving stroke data to Firestore...');
      const db = getFirestore();
      const draftRef = doc(db, 'inClassTestDrafts', `${testId}_${user.uid}`);

      await setDoc(draftRef, {
        testId,
        studentId: user.uid,
        studentEmail: user.email,
        strokePages,
        lastSaved: Timestamp.now()
      });

      console.log('[StrokeSave] Strokes saved successfully');
    } catch (error) {
      console.error('[StrokeSave] Error saving strokes:', error);
    }
  };

  const handleCanvasSave = async (file: File) => {
    if (!user || !test) {
      toast.error('User or test data not loaded');
      return;
    }

    try {
      setUploading(true);
      console.log('[Canvas] Uploading PDF...');

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const storageRef = ref(storage, `in-class-submissions/${testId}/${user.uid}/${timestamp}_${file.name}`);
      
      // Upload file
      const uploadTask = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      
      // Create or update submission
      const submissionData = {
        testId: testId,
        studentId: user.uid,
        studentName: user.displayName || user.email || 'Unknown Student',
        studentEmail: user.email || '',
        classId: (test as any).classIds?.[0] || '',
        submissionType: 'online_upload' as const,
        answerFileUrl: downloadURL,
        submittedAt: Timestamp.now(),
        status: 'submitted' as const,
        // Include existing submission ID if updating
        ...(submission?.id ? { id: submission.id } : {}),
      };

      console.log('[Canvas] Saving submission...');
      await InClassSubmissionService.saveSubmission(submissionData);
      
      // Clear draft from localStorage after successful submission
      try {
        const autoSaveKey = `canvas_draft_${testId}_${user.uid}`;
        localStorage.removeItem(autoSaveKey);
        console.log('[Canvas] Cleared draft from localStorage');
      } catch (error) {
        console.error('[Canvas] Failed to clear draft:', error);
      }
      console.log('[Canvas] Submission saved successfully');

      // Update local submission state
      setSubmission(prev => prev ? { ...prev, ...submissionData } : submissionData as InClassSubmission);

      setSubmittedFile({
        name: file.name,
        url: downloadURL
      });
      setSubmittedViaFile(false);

      setIsWriting(false);
      toast.success('Answer submitted successfully!');
    } catch (error: any) {
      console.error('[Canvas] Error:', error);
      const errorMessage = error?.code === 'storage/unauthorized'
        ? 'Permission denied. Please contact support.'
        : error?.code === 'storage/quota-exceeded'
        ? 'Storage quota exceeded. Please contact support.'
        : error instanceof Error
        ? error.message
        : 'Failed to upload answer';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'TBA';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!test) return null;

  const isOffline = (test as any).submissionMethod === 'offline_collection';
  const scheduledTime = (test as any).scheduledStartTime?.toDate ? (test as any).scheduledStartTime.toDate() : new Date((test as any).scheduledStartTime);
  const adjustedNow = new Date(Date.now() + clockOffsetMs);
  const timeDiff = scheduledTime ? scheduledTime.getTime() - adjustedNow.getTime() : 0;
  const isLocked = timeDiff > 0; 

  if (isLocked) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Test Locked</h2>
          <p className="text-gray-600 mb-6">
            This test is scheduled for {formatDateTime((test as any).scheduledStartTime)}. 
            You can access the paper at the scheduled start time.
          </p>
          <Button onClick={() => router.push('/student/in-class')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to List
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.push('/student/in-class')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDateTime((test as any).scheduledStartTime)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {(test as any).duration} minutes
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                isOffline ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {isOffline ? 'Offline Submission' : 'Online Submission'}
              </span>
            </div>
          </div>
        </div>

        {/* Timer */}
        <TestTimer
          scheduledStartTime={(test as any).scheduledStartTime}
          duration={(test as any).duration}
          onTimeExpired={handleTimeExpired}
          clockOffsetMs={clockOffsetMs}
        />

        {/* Draft Recovery Prompt */}
        {showDraftPrompt && draftAnnotations && (
          <Card className="border-blue-200 bg-blue-50">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Unsaved Work Found</h3>
                <p className="text-sm text-blue-800 mb-3">
                  We found some work you started earlier. Would you like to continue from where you left off?
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowDraftPrompt(false);
                      setIsWriting(true);
                      toast.success('Resuming your previous work');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Resume Previous Work
                  </Button>
                  <Button
                    onClick={() => {
                      setDraftAnnotations(null);
                      setShowDraftPrompt(false);
                      if (user && testId) {
                        const autoSaveKey = `canvas_draft_${testId}_${user.uid}`;
                        localStorage.removeItem(autoSaveKey);
                      }
                      toast.success('Draft discarded');
                    }}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-100"
                  >
                    Start Fresh
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Grade Results - Show if graded */}
        {submission?.status === 'graded' && (
          <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Your Results</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-600">{submission.marks}</span>
                  <span className="text-lg text-gray-500">/ {submission.totalMarks}</span>
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    {submission.totalMarks ? Math.round((submission.marks! / submission.totalMarks) * 100) : 0}%
                  </span>
                </div>
                {submission.feedback && (
                  <div className="mt-3 p-3 bg-white/60 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Feedback:</span> {submission.feedback}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Pending Grade - For offline tests after time expired */}
        {isOffline && timeExpired && submission?.status !== 'graded' && submission?.status !== 'absent' && (
          <Card className="p-6 bg-yellow-50 border-yellow-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Pending Grade</h3>
                <p className="text-sm text-gray-600">Your teacher will grade your offline submission soon.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Guidelines */}
        <Card className="p-6 bg-white border-blue-100 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Instructions
          </h3>
          <div className="prose text-gray-600 text-sm">
            <p>{test.description || 'No specific instructions provided.'}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Read all questions carefully.</li>
              <li>Ensure you submit your answers before the time runs out.</li>
              {isOffline 
                ? <li><strong>This is an offline test.</strong> please write your answers on the provided sheets and hand them to your supervisor.</li>
                : <li><strong>This is an online submission test.</strong> Scan your answer sheets into a single PDF and upload it below.</li>
              }
            </ul>
          </div>
        </Card>

        {/* Question Paper */}
        {(test as any).examPdfUrl && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Question Paper</h3>
            <Card
              className="p-4 hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
              onClick={() => setShowPdfModal(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{test.title}</h4>
                    <p className="text-sm text-gray-500">Click to view question paper</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadFile((test as any).examPdfUrl, `${test.title || 'question-paper'}.pdf`);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* PDF Modal */}
        {showPdfModal && (test as any).examPdfUrl && (
          <PDFViewer
            url={(test as any).examPdfUrl}
            title={test.title}
            onClose={() => setShowPdfModal(false)}
            inline={false}
          />
        )}

        {/* Submission Section - Only show if not graded */}
        {!isOffline && submission?.status !== 'graded' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Answer Submission</h3>
            <Card className="p-8 border-dashed border-2 border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-center">
              {submittedFile ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Submission Received</h4>
                    <p className="text-sm text-gray-500 mt-1">{submittedFile.name}</p>
                  </div>
                  {!timeExpired && (
                    submittedViaFile ? (
                      // File upload submission — re-upload a new file
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          className="mt-4"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? 'Uploading...' : 'Replace File'}
                        </Button>
                      </>
                    ) : (
                      // Canvas submission — re-open canvas writer
                      <Button
                        variant="outline"
                        onClick={() => setIsWriting(true)}
                        className="mt-4"
                      >
                        Edit Answer
                      </Button>
                    )
                  )}
                  {timeExpired && (
                    <p className="text-sm text-gray-500 mt-2">Time Expired — submission locked</p>
                  )}
                  {/* Download answer sheet — always visible once submitted */}
                  {submittedFile?.url && (
                    <button
                      className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors mx-auto"
                      onClick={() => downloadFile(submittedFile.url, `answer-sheet-${test?.title || 'submission'}.pdf`)}
                    >
                      <Download className="w-4 h-4" />
                      Download My Answer Sheet
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 w-full max-w-sm">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Submit Your Answer</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {(test as any).examPdfUrl
                        ? 'Write directly on the question paper or upload a scanned PDF'
                        : 'Write your answer or upload a scanned PDF'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={uploading || timeExpired}
                      onClick={() => setIsWriting(true)}
                    >
                      {(test as any).examPdfUrl ? 'Write on Question Paper' : 'Write Answer'}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-gray-50 text-gray-500">or</span>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      disabled={uploading || timeExpired}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={uploading || timeExpired}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? 'Uploading...' : timeExpired ? 'Time Expired - Cannot Submit' : 'Upload PDF File'}
                    </Button>
                    {uploadError && (
                      <p className="text-sm text-red-600 text-center">{uploadError}</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Canvas Writer Overlay */}
      {isWriting && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="h-full flex flex-col">
            <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold flex-shrink-0">
                {test.examPdfUrl ? 'Write on Question Paper' : 'Write Your Answer'}
              </h2>
              
              {/* Compact Timer and Actions */}
              <div className="flex items-center gap-2 sm:gap-4">
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border-2 transition-all ${
                  canvasTimeRemaining === 0
                    ? 'bg-red-600 border-red-400' 
                    : canvasTimeRemaining < 300000 // Less than 5 minutes
                    ? 'bg-red-600/90 border-red-400 animate-pulse' 
                    : canvasTimeRemaining < 600000 // Less than 10 minutes
                    ? 'bg-yellow-600 border-yellow-400'
                    : 'bg-green-600 border-green-400'
                }`}>
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <div className="hidden sm:block">
                    <p className="text-xs opacity-90 leading-tight">Time Left</p>
                    <p className="text-base sm:text-lg font-bold font-mono leading-tight">
                      {(() => {
                        const totalSeconds = Math.floor(canvasTimeRemaining / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        
                        if (canvasTimeRemaining === 0) return 'Expired';
                        if (hours > 0) {
                          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        }
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      })()}
                    </p>
                  </div>
                  {/* Mobile: Show only timer */}
                  <p className="sm:hidden text-lg font-bold font-mono">
                    {(() => {
                      const totalSeconds = Math.floor(canvasTimeRemaining / 1000);
                      const hours = Math.floor(totalSeconds / 3600);
                      const minutes = Math.floor((totalSeconds % 3600) / 60);
                      const seconds = totalSeconds % 60;
                      
                      if (canvasTimeRemaining === 0) return 'Expired';
                      if (hours > 0) {
                        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                      }
                      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    })()}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    // Trigger PDF generation and upload via the registered submit callback
                    if (canvasSubmitRef.current) {
                      canvasSubmitRef.current();
                    } else {
                      toast.error('Canvas not ready, please try again');
                    }
                  }}
                  disabled={uploading || timeExpired}
                  className="bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-95 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all flex-shrink-0 select-none"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Submit Answer</span>
                      <span className="sm:hidden">Submit</span>
                    </>
                  )}
                </button>

                {/* Save Progress Button */}
                <button
                  onClick={async () => {
                    if (canvasSaveRef.current) {
                      setSavingProgress(true);
                      try {
                        await canvasSaveRef.current();
                        toast.success('Progress saved successfully');
                      } catch (err) {
                        toast.error('Failed to save progress');
                      } finally {
                        setSavingProgress(false);
                      }
                    } else {
                      toast.error('Canvas not ready, please try again');
                    }
                  }}
                  disabled={savingProgress || uploading || timeExpired}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all flex-shrink-0 select-none"
                >
                  {savingProgress ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Save Progress</span>
                      <span className="sm:hidden">Save</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsWriting(false)}
                  className="text-white hover:text-gray-300 active:text-gray-400 active:scale-95 px-2 sm:px-3 py-1 rounded transition-all flex-shrink-0 select-none"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <CanvasWriter
                pdfUrl={(test as any).examPdfUrl}
                outputFormat="pdf"
                onSave={handleStrokeSave}
                onSavePdf={handleCanvasSave}
                autoSaveKey={user && testId ? `canvas_draft_${testId}_${user.uid}` : undefined}
                initialPageAnnotations={draftAnnotations || {}}
                onRegisterSubmit={(fn) => { canvasSubmitRef.current = fn; }}
                onRegisterSave={(fn) => { canvasSaveRef.current = fn; }}
              />
            </div>

            {/* Time Expired Blocking Modal */}
            {showTimeExpiredModal && (
              <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Time&apos;s Up!</h2>
                  <p className="text-gray-600 mb-6">
                    {uploading
                      ? 'Your answer is being submitted automatically…'
                      : submittedFile
                      ? 'Your answer has been submitted successfully.'
                      : 'Time has expired. No submission was recorded.'}
                  </p>
                  {uploading && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">Submitting…</span>
                    </div>
                  )}
                  {!uploading && (
                    <button
                      onClick={() => { setShowTimeExpiredModal(false); setIsWriting(false); }}
                      className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                    >
                      {submittedFile ? '✓ Close' : 'OK'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
