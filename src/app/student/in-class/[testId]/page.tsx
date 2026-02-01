'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { TestService } from '@/apiservices/testService';
import { Test } from '@/models/testSchema';
import { Button, Card } from '@/components/ui';
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  FileText, 
  Upload, 
  AlertTriangle,
  CheckCircle,
  File
} from 'lucide-react';
import StudentSidebar from '@/components/student/StudentSidebar';
import ExamPDFViewer from '@/components/teacher/ExamPDFViewer';
import { toast } from 'react-hot-toast';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

export default function StudentInClassTestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useStudentAuth();
  const testId = params.testId as string;
  
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submittedFile, setSubmittedFile] = useState<{ url: string, name: string } | null>(null);

  useEffect(() => {
    const fetchTestAndSubmission = async () => {
      if (!user || !testId) return;

      try {
        setLoading(true);
        // Fetch test details
        const testDoc = await getDoc(doc(firestore, 'tests', testId));
        if (testDoc.exists()) {
          const testData = { id: testDoc.id, ...testDoc.data() } as Test;
          setTest(testData);
          
          // Check for existing submission
          // Note: In a real implementation, you'd fetch the submission record
          // For now, we'll just check if we have a local submission state or fetch from a submissions collection
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

    fetchTestAndSubmission();
  }, [user, testId, router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    try {
      setUploading(true);
      // In a real implementation, upload to Firebase Storage
      // const url = await uploadService.uploadFile(file, `submissions/${testId}/${user?.uid}`);
      
      // Simulating upload for now
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSubmittedFile({
        name: file.name,
        url: URL.createObjectURL(file) // temporary local URL
      });
      
      toast.success('Answer script uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
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
      <div className="flex h-screen bg-gray-50">
        <StudentSidebar 
          student={user ? { name: user.displayName || 'Student', email: user.email || '' } : null}
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)} 
        />
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
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <StudentSidebar 
        student={user ? { 
          name: user.displayName || 'Student', 
          email: user.email || '',
          avatar: user.photoURL || undefined
        } : null}
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
      />

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

          {/* Guidelines */}
          <Card className="p-6 bg-white border-blue-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
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
              <ExamPDFViewer 
                examPdfUrl={(test as any).examPdfUrl}
                testTitle={test.title}
                testNumber="1"
                className="bg-white shadow-sm"
              />
            </div>
          )}

          {/* Submission Section */}
          {!isOffline && (
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
                    >
                      Replace File
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
                    
                    <div className="relative">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Button className="w-full" disabled={uploading}>
                        {uploading ? 'Uploading...' : 'Select PDF File'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
