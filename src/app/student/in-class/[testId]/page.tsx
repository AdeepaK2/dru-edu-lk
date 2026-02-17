'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Test } from '@/models/testSchema';
import { Button, Card } from '@/components/ui';
import { ArrowLeft, Calendar, Clock, Upload, AlertCircle, CheckCircle, Award, FileText, Eye } from 'lucide-react';
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
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore } from '@/utils/firebase-client';
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
  const [timeExpired, setTimeExpired] = useState(false);
  const [submission, setSubmission] = useState<InClassSubmission | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [canvasTimeRemaining, setCanvasTimeRemaining] = useState<number>(0);
  const [draftAnnotations, setDraftAnnotations] = useState<Record<number, string> | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canvasWriterRef = React.useRef<any>(null);

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

  // Update canvas timer in real-time
  useEffect(() => {
    if (!isWriting || !test) return;

    const updateTimer = () => {
      const startTime = (test as any).scheduledStartTime.toDate();
      const endTime = new Date(startTime.getTime() + (test as any).duration * 60 * 1000);
      const now = new Date();
      const remaining = Math.max(0, endTime.getTime() - now.getTime());
      setCanvasTimeRemaining(remaining);
    };

    updateTimer(); // Initial calculation
    const interval = setInterval(updateTimer, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isWriting, test]);

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
            setShowDraftPrompt(true);
            console.log('[Recovery] Found saved strokes from Firestore:', new Date(firestoreData.lastSaved.toDate()).toLocaleString());
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
            setShowDraftPrompt(true);
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
    toast.error('Time has expired! You can no longer submit answers.');
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
      const storage = getStorage();
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

  // Save strokes to Firestore (lightweight - no PDF generation)
  const handleStrokeSave = async (strokeData: string | string[]) => {
    if (!user || !testId) {
      toast.error('Unable to save - user or test not loaded');
      return;
    }

    try {
      console.log('[StrokeSave] Saving stroke data to Firestore...');
      
      // Convert to array if it's a single string
      const dataArray = Array.isArray(strokeData) ? strokeData : [strokeData];
      
      // Convert array to object with page numbers as keys
      const strokePages: Record<number, string> = {};
      dataArray.forEach((data, index) => {
        if (data) {
          strokePages[index + 1] = data;
        }
      });

      // Save to Firestore under student's test attempt
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
      toast.success('Progress saved!');
    } catch (error) {
      console.error('[StrokeSave] Error saving strokes:', error);
      toast.error('Failed to save progress');
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
      const storage = getStorage();
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
  const now = new Date();
  const timeDiff = scheduledTime ? scheduledTime.getTime() - now.getTime() : 0;
  // Unlock 1 hour before
  const isLocked = timeDiff > 60 * 60 * 1000; 

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
            You can access the paper 1 hour before the start time.
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
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  View
                </Button>
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
                  <Button 
                    variant="outline" 
                    onClick={() => setIsWriting(true)}
                    className="mt-4"
                    disabled={timeExpired}
                  >
                    {timeExpired ? 'Time Expired' : 'Edit Answer'}
                  </Button>
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
                    // Trigger the CanvasWriter's footer "Save Answer" button
                    const saveButton = document.querySelector('.flex.justify-end button') as HTMLButtonElement;
                    if (saveButton) {
                      saveButton.click();
                      setTimeout(() => setIsWriting(false), 500);
                    } else {
                      toast.error('Please use the Save Answer button below to submit');
                    }
                  }}
                  disabled={uploading || timeExpired}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors flex-shrink-0"
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
                
                <button
                  onClick={() => setIsWriting(false)}
                  className="text-white hover:text-gray-300 px-2 sm:px-3 py-1 rounded flex-shrink-0"
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
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
