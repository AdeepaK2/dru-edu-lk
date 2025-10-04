'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  AlertCircle, Clock, CheckCircle, Send, Download, Upload, FileText,
  Save, AlertTriangle, ArrowLeft, Maximize, Eye
} from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button, TextArea } from '@/components/ui';
import { Test, TestQuestion } from '@/models/testSchema';
import { PdfAttachment } from '@/models/studentSubmissionSchema';
import { PdfUploadComponent } from '@/components/student/PdfUploadComponent';
import { ExamPDFService } from '@/services/examPDFService';

// Student layout component
const StudentLayout = ({ children }: { children: React.ReactNode }) => children;

interface EssayTestSubmission {
  attemptId: string;
  testId: string;
  studentId: string;
  studentName: string;
  submissionPdf?: PdfAttachment;
  additionalNotes?: string;
  submittedAt?: Date;
  status: 'draft' | 'submitted';
}

export default function TakeEssayTestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params?.testId as string;
  
  const { student, loading: authLoading } = useStudentAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Test data
  const [test, setTest] = useState<Test | null>(null);
  const [attemptId, setAttemptId] = useState<string>('');
  const [essayQuestions, setEssayQuestions] = useState<TestQuestion[]>([]);
  
  // Submission state
  const [submissionPdf, setSubmissionPdf] = useState<PdfAttachment | null>(null);
  const [savedState, setSavedState] = useState<'saving' | 'saved' | 'error' | null>(null);
  
  // Timer state
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [timeExpired, setTimeExpired] = useState(false);
  
  // Connection state
  const [isOnline, setIsOnline] = useState(true);
  
  // Confirmation dialog state
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  
  // PDF generation state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Format remaining time for display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fullscreen request handler
  const requestFullscreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch((err) => {
        console.warn('Could not enter fullscreen mode:', err);
      });
    }
  };
  
  // Download exam PDF using API route
  const downloadExamPdf = async (fileUrl: string, fileName: string) => {
    if (isDownloadingPdf) return;
    
    setIsDownloadingPdf(true);
    
    try {
      const downloadUrl = `/api/download-pdf?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`;
      
      // Create direct download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ PDF download initiated via API!');
      
      // Reset downloading state after delay
      setTimeout(() => setIsDownloadingPdf(false), 2000);
    } catch (error) {
      console.error('❌ Failed to download PDF via API:', error);
      setIsDownloadingPdf(false);
      
      // Fallback: direct link
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      link.click();
    }
  };

  // Generate and download exam paper PDF
  const handleDownloadExamPaper = async () => {
    if (!test || !essayQuestions || essayQuestions.length === 0) return;
    
    try {
      setIsGeneratingPdf(true);
      setPdfError(null);
      
      console.log('📄 Generating exam paper PDF...');
      
      // Convert test questions to the format expected by ExamPDFService
      const pdfQuestions = essayQuestions.map((q, index) => ({
        id: q.id,
        title: `Question ${index + 1}`,
        content: q.questionText || q.content || '',
        imageUrl: q.imageUrl,
        type: 'essay' as const,
        points: q.points || q.marks || 0,
        difficultyLevel: 'medium' as const,
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      }));
      
      // Generate the PDF
      const pdfBlob = await ExamPDFService.generateExamPDF({
        title: 'Dru Education',
        testNumber: String(test.testNumber || `T-${testId.substring(0, 8)}`),
        className: (test as any).classNames?.[0] || test.subjectName || 'Exam',
        date: new Date().toLocaleDateString(),
        questions: pdfQuestions
      });
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${test.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'exam_paper'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('✅ Exam paper PDF downloaded successfully!');
    } catch (error) {
      console.error('❌ Error generating exam paper PDF:', error);
      setPdfError('Failed to generate exam paper PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Load test data and start session
  useEffect(() => {
    const loadTest = async () => {
      if (!testId || !student?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get attempt ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const attemptIdFromUrl = urlParams.get('attemptId');
        
        if (!attemptIdFromUrl) {
          throw new Error('No attempt ID provided in URL. Please start the test from the test page.');
        }
        
        console.log('🔍 Using attempt ID from URL:', attemptIdFromUrl);
        setAttemptId(attemptIdFromUrl);
        
        // Import services dynamically
        const { TestService } = await import('@/apiservices/testService');
        const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
        const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
        
        // Load test
        const testData = await TestService.getTestById(testId);
        setTest(testData);
        
        // Filter essay questions only
        const essayQs = testData.questions.filter(q => q.type === 'essay' || q.questionType === 'essay');
        setEssayQuestions(essayQs);
        
        if (essayQs.length === 0) {
          throw new Error('This test has no essay questions. Please use the regular test interface.');
        }
        
        // Verify the attempt exists and is valid
        const attemptData = await AttemptManagementService.getActiveAttempt(testId, student.id);
        if (!attemptData || attemptData.id !== attemptIdFromUrl) {
          throw new Error('Invalid attempt. The attempt may have expired or does not exist.');
        }
        
        if (attemptData.status === 'submitted' || attemptData.status === 'auto_submitted') {
          throw new Error('This attempt has already been submitted. Please check your results.');
        }
        
        // Get time remaining
        const timeCalc = await AttemptManagementService.updateAttemptTime(attemptIdFromUrl);
        
        if (timeCalc.isExpired) {
          setTimeExpired(true);
          await handleAutoSubmit();
          return;
        }
        
        setRemainingTime(timeCalc.timeRemaining);
        
        // Load existing submission if any
        await loadExistingSubmission(attemptIdFromUrl);
        
      } catch (err: any) {
        console.error('Error loading test:', err);
        setError(err.message || 'Failed to load test');
      } finally {
        setLoading(false);
      }
    };
    
    loadTest();
  }, [testId, student]);

  // Load existing submission data
  const loadExistingSubmission = async (attemptId: string) => {
    try {
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      const session = await RealtimeTestService.getSession(attemptId);
      if (session?.answers) {
        // Check if there's a submission PDF in the answers
        const submissionData = session.answers['submission_pdf'];
        if (submissionData?.pdfFiles?.[0]) {
          setSubmissionPdf(submissionData.pdfFiles[0]);
        }
      }
    } catch (error) {
      console.error('Error loading existing submission:', error);
    }
  };

  // Timer effect
  useEffect(() => {
    if (!test || !attemptId || remainingTime <= 0) return;
    
    const interval = setInterval(async () => {
      try {
        const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
        const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
        
        // Update heartbeat and get current time
        const timeCalc = await RealtimeTestService.updateHeartbeat(attemptId);
        
        if (timeCalc) {
          if (timeCalc.isExpired) {
            setTimeExpired(true);
            await handleAutoSubmit();
            return;
          }
          setRemainingTime(timeCalc.timeRemaining);
        }
      } catch (error) {
        console.error('Error updating timer:', error);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [test, attemptId, remainingTime]);

  // Handle PDF upload
  const handlePdfUpload = async (attachment: PdfAttachment) => {
    try {
      setSubmissionPdf(attachment);
      await saveSubmissionData(attachment);
      console.log('📄 PDF uploaded successfully:', attachment.fileName);
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Failed to upload PDF. Please try again.');
    }
  };

  // Handle PDF removal
  const handlePdfRemove = async (fileUrl: string) => {
    try {
      const { StudentPdfService } = await import('@/apiservices/studentPdfService');
      await StudentPdfService.deletePdf(fileUrl);
      
      setSubmissionPdf(null);
      await saveSubmissionData(null);
      console.log('🗑️ PDF removed successfully');
    } catch (error) {
      console.error('Error removing PDF:', error);
      alert('Failed to remove PDF. Please try again.');
    }
  };

  // Save submission data
  const saveSubmissionData = async (pdf: PdfAttachment | null) => {
    if (!attemptId) return;
    
    try {
      setSavedState('saving');
      
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Save PDF data
      if (pdf) {
        await RealtimeTestService.saveAnswer(
          attemptId,
          'submission_pdf',
          { pdfFiles: [pdf] },
          'essay',
          0,
          [pdf]
        );
      }
      
      setSavedState('saved');
      setTimeout(() => setSavedState(null), 3000);
    } catch (error) {
      console.error('Error saving submission data:', error);
      setSavedState('error');
      setTimeout(() => setSavedState(null), 3000);
    }
  };

  // Submit test
  const handleSubmitTest = async () => {
    if (!attemptId) return;
    
    if (!submissionPdf) {
      alert('Please upload your answer sheet PDF before submitting.');
      return;
    }
    
    try {
      setLoading(true);
      
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      const { SubmissionService } = await import('@/apiservices/submissionService');
      
      // Final save before submission
      await saveSubmissionData(submissionPdf);
      
      // Submit test session
      await RealtimeTestService.submitTestSession(attemptId, false);
      
      // Process submission
      await SubmissionService.processSubmission(attemptId, false);
      
      // Navigate to results page
      router.push(`/student/test/${testId}/result?submissionId=${attemptId}`);
    } catch (error) {
      console.error('Error submitting test:', error);
      alert('Failed to submit test. Please try again.');
      setLoading(false);
    }
  };

  // Auto-submit when time expires
  const handleAutoSubmit = async () => {
    if (!attemptId) return;
    
    try {
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      const { SubmissionService } = await import('@/apiservices/submissionService');
      
      // Auto-submit
      await RealtimeTestService.submitTestSession(attemptId, true);
      await SubmissionService.processSubmission(attemptId, true);
      
      router.push(`/student/test/${testId}/result?submissionId=${attemptId}`);
    } catch (error) {
      console.error('Error auto-submitting test:', error);
    }
  };

  // Generate question sheet for download
  const generateQuestionSheet = () => {
    if (!test || essayQuestions.length === 0) return;
    
    let content = `
<!DOCTYPE html>
<html>
<head>
    <title>${test.title} - Question Sheet</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .question { margin-bottom: 40px; page-break-inside: avoid; }
        .question-number { font-weight: bold; font-size: 18px; color: #333; }
        .question-text { margin: 10px 0; }
        .marks { font-weight: bold; color: #666; }
        .answer-space { margin-top: 20px; min-height: 200px; border: 1px dashed #ccc; padding: 10px; }
        .instructions { background: #f5f5f5; padding: 15px; margin-bottom: 30px; border-left: 4px solid #007bff; }
        @media print { body { margin: 20px; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>${test.title}</h1>
        <p><strong>Total Time:</strong> ${test.type === 'live' ? (test as any).duration : (test as any).duration} minutes</p>
        <p><strong>Total Questions:</strong> ${essayQuestions.length}</p>
        <p><strong>Total Marks:</strong> ${essayQuestions.reduce((sum, q) => sum + (q.points || q.marks || 0), 0)}</p>
    </div>
    
    <div class="instructions">
        <h3>Instructions:</h3>
        <ul>
            <li>Answer ALL questions in the spaces provided or on separate sheets</li>
            <li>Write clearly and legibly</li>
            <li>Show all your working where applicable</li>
            <li>Scan or photograph your completed answers as a single PDF</li>
            <li>Upload your PDF through the test interface before time expires</li>
        </ul>
    </div>
`;

    essayQuestions.forEach((question, index) => {
      content += `
    <div class="question">
        <div class="question-number">Question ${index + 1} (${question.points || question.marks || 0} marks)</div>
        <div class="question-text">${question.questionText}</div>
        ${question.content ? `<div class="question-content">${question.content}</div>` : ''}
        ${question.imageUrl ? `<div><img src="${question.imageUrl}" style="max-width: 100%; height: auto;" /></div>` : ''}
        <div class="answer-space">
            <em>Write your answer here or on separate sheets...</em>
        </div>
    </div>
`;
    });

    content += `
</body>
</html>
`;

    // Create and download the HTML file
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_Questions.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading essay test...</p>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <StudentLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Tests</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Time expired dialog
  if (timeExpired) {
    return (
      <StudentLayout>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Time Expired
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                The test time has expired. Your submission is being processed automatically.
              </p>
              <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }
  
  // Submit confirmation dialog
  if (showConfirmSubmit) {
    return (
      <StudentLayout>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Submit Test?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Are you sure you want to submit your test? This action cannot be undone.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {submissionPdf ? '✅ Answer sheet uploaded' : '❌ No answer sheet uploaded'}
              </p>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmSubmit(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitTest}
                  disabled={!submissionPdf}
                  className="flex-1"
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // No test data
  if (!test) {
    return (
      <StudentLayout>
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Test Not Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            The requested test could not be found.
          </p>
        </div>
      </StudentLayout>
    );
  }

  // Main essay test interface
  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Header with timer */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sticky top-0 z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {test.title}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Essay Test - {essayQuestions.length} Questions
              </p>
            </div>
            
            <div className="flex items-center mt-4 md:mt-0 space-x-4">
              <div className={`flex items-center p-2 rounded-md ${
                remainingTime < 300 
                  ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
                  : 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                <Clock className="h-5 w-5 mr-2" />
                <span className="font-mono font-medium">{formatTime(remainingTime)}</span>
              </div>
              
              <button 
                onClick={requestFullscreen}
                className="flex items-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Enter fullscreen"
                title="Enter fullscreen mode"
              >
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">
            📋 How to Complete This Essay Test
          </h3>
          <div className="text-blue-800 dark:text-blue-200 space-y-2">
            <p>• <strong>Read all questions below</strong> - they are displayed on this page</p>
            <p>• <strong>Write your answers</strong> on paper, in a document, or digitally</p>
            <p>• <strong>Create ONE PDF file</strong> containing answers to ALL questions</p>
            <p>• <strong>Upload your complete answer sheet</strong> in the section below</p>
            <p>• <strong>Submit before time expires</strong> - no individual question submissions needed</p>
          </div>
        </div>

        {/* Exam Paper PDF Download */}
        {test.examPdfUrl ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <FileText className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
                    📄 Exam Paper
                  </h3>
                  <button
                    onClick={() => downloadExamPdf(test.examPdfUrl!, `${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_Exam_Paper.pdf`)}
                    disabled={isDownloadingPdf}
                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      isDownloadingPdf
                        ? 'text-green-600 bg-green-100 cursor-not-allowed dark:bg-green-900/20 dark:text-green-400'
                        : 'text-white bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isDownloadingPdf ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Download the exam paper created by your teacher with all questions formatted for printing.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <FileText className="h-6 w-6 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    📄 Generate Exam Paper
                  </h3>
                  <button
                    onClick={handleDownloadExamPaper}
                    disabled={isGeneratingPdf || !test || !essayQuestions || essayQuestions.length === 0}
                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      isGeneratingPdf
                        ? 'text-gray-600 bg-gray-100 cursor-not-allowed dark:bg-gray-900/20 dark:text-gray-400'
                        : 'text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
                    }`}
                  >
                    {isGeneratingPdf ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Generate PDF
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No PDF exam paper available. Generate a printable version of the questions below.
                </p>
                {pdfError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    {pdfError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All Questions Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Questions
          </h2>
          
          <div className="space-y-8">
            {essayQuestions.map((question, index) => (
              <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Question {index + 1}
                  </h3>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                    {question.points || question.marks || 0} marks
                  </span>
                </div>
                
                {question.imageUrl && (
                  <div className="mb-4">
                    <img 
                      src={question.imageUrl} 
                      alt="Question" 
                      className="max-w-full h-auto rounded-md border border-gray-300 dark:border-gray-600" 
                    />
                  </div>
                )}
                
                <div className="prose prose-gray dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
                    {question.questionText}
                  </p>
                  {question.content && (
                    <div 
                      className="mt-3 text-gray-700 dark:text-gray-300"
                      dangerouslySetInnerHTML={{ __html: question.content }} 
                    />
                  )}
                </div>
                
                {/* Answer space indicator */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    📝 Write your answer for this question in your answer sheet
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Answer Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📤 Upload Your Complete Answer Sheet
          </h2>
          
          {/* Save status indicator */}
          {savedState && (
            <div className={`text-sm mb-4 flex items-center ${
              savedState === 'saving' 
                ? 'text-gray-500 dark:text-gray-400' 
                : savedState === 'saved'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
            }`}>
              {savedState === 'saving' && (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-gray-500 dark:border-gray-400 border-t-transparent rounded-full mr-2"></div>
                  <span>Saving...</span>
                </>
              )}
              {savedState === 'saved' && (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  <span>Saved successfully</span>
                </>
              )}
              {savedState === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span>Error saving</span>
                </>
              )}
            </div>
          )}
          
          {/* PDF Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Complete Answer Sheet (PDF) *
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload ONE PDF file containing answers to all {essayQuestions.length} questions above.
            </p>
            
            {student?.id && (
              <PdfUploadComponent
                questionId="submission_pdf"
                attemptId={attemptId}
                studentId={student.id}
                existingFiles={submissionPdf ? [submissionPdf] : []}
                onFileUpload={handlePdfUpload}
                onFileRemove={handlePdfRemove}
                disabled={timeExpired}
                maxFiles={1}
              />
            )}
          </div>
        </div>

        {/* Submit Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Ready to Submit?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {submissionPdf 
                  ? '✅ Answer sheet uploaded and ready for submission' 
                  : '❌ Please upload your answer sheet before submitting'
                }
              </p>
            </div>
            
            <div className="flex space-x-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              
              <Button
                onClick={() => setShowConfirmSubmit(true)}
                disabled={!submissionPdf || timeExpired}
                className="flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Test</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
