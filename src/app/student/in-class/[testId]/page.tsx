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
import { doc, getDoc, Timestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
                    onClick={() => setSubmittedFile(null)}
                    className="mt-4"
                    disabled={timeExpired}
                  >
                    {timeExpired ? 'Time Expired' : 'Replace File'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 w-full max-w-sm">
                   <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Upload Answer Script</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload your scanned answer sheets as a single PDF file (Max 10MB)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      disabled={uploading || timeExpired}
                      className="hidden"
                    />
                    <Button
                      className="w-full"
                      disabled={uploading || timeExpired}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? 'Uploading...' : timeExpired ? 'Time Expired - Cannot Submit' : 'Select PDF File'}
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
    </main>
  );
}
