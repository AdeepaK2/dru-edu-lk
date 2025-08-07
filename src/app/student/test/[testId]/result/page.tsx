'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { 
  AlertCircle, ArrowLeft, CheckCircle, XCircle, 
  Clock, Award, BarChart, ChevronDown, ChevronUp, 
  FileText, Info, AlertTriangle, RefreshCw, Target, Download
} from 'lucide-react';
import { Button } from '@/components/ui';
import { StudentSubmission, FinalAnswer, MCQResult, EssayResult } from '@/models/studentSubmissionSchema';
import { Test } from '@/models/testSchema';
import { Timestamp } from 'firebase/firestore';
import { AttemptSummary } from '@/models/attemptSchema';

// Import student layout from other components or use a local version for now
const StudentLayout = ({ children }: { children: React.ReactNode }) => children;

export default function TestResultPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const testId = params?.testId as string;
  const submissionId = searchParams?.get('submissionId');
  
  const { student, loading: authLoading } = useStudentAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [submission, setSubmission] = useState<StudentSubmission | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<AttemptSummary | null>(null);
  
  // UI states
  const [startingNewAttempt, setStartingNewAttempt] = useState(false);
  
  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!testId || !student) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Import services
        const { SubmissionService } = await import('@/apiservices/submissionService');
        const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
        const { doc, getDoc } = await import('firebase/firestore');
        const { firestore } = await import('@/utils/firebase-client');
        
        // Get the submission
        const subId = submissionId || await findMostRecentSubmissionId(testId, student.id);
        
        if (!subId) {
          setError('No submission found for this test.');
          setLoading(false);
          return;
        }

        let submissionData = await SubmissionService.getSubmission(subId);
        
        if (!submissionData) {
          setError('Submission not found.');
          setLoading(false);
          return;
        }

        // Verify that the submission belongs to the current student
        if (submissionData.studentId !== student.id) {
          setError('You do not have permission to view this submission.');
          setLoading(false);
          return;
        }

        // Get attempt information
        const attemptData = await AttemptManagementService.getAttemptSummary(testId, student.id);
        setAttemptInfo(attemptData);
        
        // Get the test data
        const testDoc = await getDoc(doc(firestore, 'tests', testId));
        
        if (!testDoc.exists()) {
          setError('Test not found.');
          setLoading(false);
          return;
        }
        
        const testData = { id: testDoc.id, ...testDoc.data() } as Test;
        
        // Check if we need to compute results using new simplified service
        if (!submissionData.mcqResults || submissionData.mcqResults.length === 0) {
          console.log('🔄 No computed results found, computing with simplified service...');
          
          try {
            // Import the new simplified result service
            const { SimplifiedResultService } = await import('@/apiservices/simplifiedResultService');
            
            // Get question IDs from test (assuming test has questionRefs or questions)
            const questionIds = testData.questions?.map(q => q.questionId || q.id) || [];
            
            if (questionIds.length > 0) {
              console.log('� Computing results for questions:', questionIds);
              
              // Convert to simplified submission format for processing
              const simplifiedSubmission = {
                id: submissionData.id,
                testId: submissionData.testId,
                testTitle: submissionData.testTitle,
                testType: submissionData.testType,
                studentId: submissionData.studentId,
                studentName: submissionData.studentName,
                studentEmail: submissionData.studentEmail,
                classId: submissionData.classId,
                className: submissionData.className,
                attemptNumber: submissionData.attemptNumber,
                status: submissionData.status,
                startTime: submissionData.startTime,
                endTime: submissionData.endTime,
                submittedAt: submissionData.submittedAt,
                totalTimeSpent: submissionData.totalTimeSpent,
                answers: submissionData.finalAnswers?.map(fa => ({
                  questionId: fa.questionId,
                  selectedOption: fa.selectedOption,
                  textContent: fa.textContent,
                  timeSpent: fa.timeSpent || 0,
                  changeCount: fa.changeCount || 0,
                  wasReviewed: fa.wasReviewed || false
                })) || [],
                questionsAttempted: submissionData.questionsAttempted,
                questionsSkipped: submissionData.questionsSkipped,
                questionsReviewed: submissionData.questionsReviewed,
                totalChanges: submissionData.totalChanges,
                autoGradedScore: submissionData.autoGradedScore,
                manualGradingPending: submissionData.manualGradingPending,
                totalScore: submissionData.totalScore,
                maxScore: submissionData.maxScore,
                percentage: submissionData.percentage,
                passStatus: submissionData.passStatus,
                teacherReview: submissionData.teacherReview,
                integrityReport: submissionData.integrityReport,
                createdAt: submissionData.createdAt,
                updatedAt: submissionData.updatedAt
              };
              
              // Compute results using the new service
              const convertedSubmission = await SimplifiedResultService.convertToLegacySubmission(
                simplifiedSubmission,
                questionIds
              );
              
              // Only use converted data if original has no essay results, otherwise preserve original essay data
              if (submissionData.essayResults && submissionData.essayResults.length > 0) {
                submissionData = {
                  ...convertedSubmission,
                  essayResults: submissionData.essayResults,
                  finalAnswers: submissionData.finalAnswers // Preserve original final answers with essay marks
                };
              } else {
                submissionData = convertedSubmission;
              }
              
              console.log('✅ Results computed successfully');
            }
          } catch (computeError) {
            console.error('❌ Error computing results with simplified service:', computeError);
            // Continue with original submission data if computation fails
          }
        }
        
        // Set data
        setSubmission(submissionData);
        setTest(testData);
        
        // Override pass status for essay tests that haven't been manually graded
        const isEssayTest = testData.questions?.some(q => q.type === 'essay' || q.questionType === 'essay');
        const hasBeenManuallyGraded = !submissionData.manualGradingPending && submissionData.totalScore !== undefined;
        
        if (isEssayTest && !hasBeenManuallyGraded) {
          // For essay tests that haven't been graded by teacher, show pending_review instead of failed
          submissionData.passStatus = 'pending_review';
          console.log('🔄 Essay test detected - setting status to pending_review until teacher grades');
        }
        
        // Debug logging to see what we're getting
        console.log('🔍 SUBMISSION DATA LOADED:', {
          submissionId: submissionData.id,
          totalScore: submissionData.totalScore,
          autoGradedScore: submissionData.autoGradedScore,
          essayResults: submissionData.essayResults,
          essayResultsCount: submissionData.essayResults?.length || 0,
          manualGradingPending: submissionData.manualGradingPending,
          passStatus: submissionData.passStatus,
          isEssayTest,
          hasBeenManuallyGraded,
          finalAnswers: submissionData.finalAnswers?.map(fa => ({
            questionId: fa.questionId,
            questionType: fa.questionType,
            textContent: fa.textContent?.substring(0, 50) + '...'
          }))
        });
        
        // Debug logging to see what we're getting
        console.log('🔍 TEST RESULTS DEBUG:', {
          testId,
          submissionResultsCount: {
            mcq: submissionData.mcqResults?.length || 0,
            essay: submissionData.essayResults?.length || 0,
            finalAnswers: submissionData.finalAnswers?.length || 0
          },
          firstMCQResult: submissionData.mcqResults?.[0] ? {
            questionId: submissionData.mcqResults[0].questionId,
            selectedOption: submissionData.mcqResults[0].selectedOption,
            correctOption: submissionData.mcqResults[0].correctOption,
            selectedOptionText: submissionData.mcqResults[0].selectedOptionText,
            correctOptionText: submissionData.mcqResults[0].correctOptionText,
            isCorrect: submissionData.mcqResults[0].isCorrect
          } : null,
          testQuestionStructure: testData.questions?.[0] ? {
            hasQuestionId: !!testData.questions[0].questionId,
            hasId: !!testData.questions[0].id,
            type: testData.questions[0].type || testData.questions[0].questionType,
            optionsCount: testData.questions[0].options?.length
          } : null
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading test result:', error);
        setError('Failed to load test results. Please try again.');
        setLoading(false);
      }
    };
    
    loadData();
  }, [testId, student, submissionId]);
  
  // Find the most recent submission for this test and student
  const findMostRecentSubmissionId = async (testId: string, studentId: string) => {
    try {
      // Import services
      const { SubmissionService } = await import('@/apiservices/submissionService');
      
      // Get all submissions for this student
      const submissions = await SubmissionService.getStudentSubmissions(studentId);
      
      // Filter by test ID and sort by submission time (most recent first)
      const filteredSubmissions = submissions
        .filter(sub => sub.testId === testId)
        .sort((a, b) => b.submittedAt.seconds - a.submittedAt.seconds);
      
      if (filteredSubmissions.length === 0) {
        return null;
      }
      
      return filteredSubmissions[0].id;
    } catch (error) {
      console.error('Error finding submission:', error);
      return null;
    }
  };

  // Format date - handle different timestamp formats
  const formatDateTime = (timestamp: any) => {
    let date: Date;
    
    // Handle Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    }
    // Handle plain Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    // Handle number (milliseconds)
    else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    // Handle Firestore Timestamp object structure
    else if (timestamp && timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    // Handle string
    else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    }
    // Fallback
    else {
      date = new Date();
    }
    
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${secs}s`;
    
    return result;
  };

  // Handle starting a new attempt
  const handleReAttempt = async () => {
    if (!attemptInfo || !attemptInfo.canCreateNewAttempt || startingNewAttempt) return;
    
    try {
      setStartingNewAttempt(true);
      
      // Import attempt management service
      const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
      
      // Check if student can create a new attempt
      if (!attemptInfo.canCreateNewAttempt) {
        alert('Cannot start new attempt - limit reached or test not available');
        setStartingNewAttempt(false);
        return;
      }
      
      // Redirect to test taking page - the test page will handle creating the attempt
      router.push(`/student/test/${testId}`);
    } catch (error) {
      console.error('Error starting new attempt:', error);
      alert('Failed to start new attempt. Please try again.');
      setStartingNewAttempt(false);
    }
  };

  // Get status badge for attempt
  const getAttemptStatusBadge = (attempt: StudentSubmission) => {
    const statusConfig = {
      'submitted': { color: 'bg-green-100 text-green-800', text: 'Completed' },
      'auto_submitted': { color: 'bg-yellow-100 text-yellow-800', text: 'Auto-submitted' },
      'expired': { color: 'bg-red-100 text-red-800', text: 'Expired' },
      'terminated': { color: 'bg-red-100 text-red-800', text: 'Terminated' }
    };
    
    const config = statusConfig[attempt.status] || { color: 'bg-gray-100 text-gray-800', text: attempt.status };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // Handle going back
  const handleBack = () => {
    router.push('/student/test');
  };
  
  if (authLoading || loading) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-36 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-24 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-24 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <button 
              onClick={handleBack}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Tests
            </button>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Test Results Error
            </h1>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              Error Loading Results
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-6">
              {error}
            </p>
            <Button 
              onClick={handleBack}
            >
              Return to Tests
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (!submission || !test) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <button 
              onClick={handleBack}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Tests
            </button>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Test Results
            </h1>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              Results Not Available
            </h2>
            <p className="text-yellow-700 dark:text-yellow-300 mb-6">
              The test results are not available. This could be because the test was recently submitted or there was an error processing your submission.
            </p>
            <Button 
              onClick={handleBack}
            >
              Return to Tests
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Calculate status colors
  const getStatusColor = (passStatus?: string) => {
    switch (passStatus) {
      case 'passed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'pending_review':
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
  };

  // Get status icon
  const getStatusIcon = (passStatus?: string) => {
    switch (passStatus) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending_review':
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  // Get status text
  const getStatusText = (passStatus?: string, isEssay?: boolean) => {
    switch (passStatus) {
      case 'passed':
        return 'Passed';
      case 'failed':
        return 'Failed';
      case 'pending_review':
        return isEssay ? 'Awaiting Teacher Review' : 'Pending Review';
      default:
        return 'Not Graded';
    }
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={handleBack}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Tests
            </button>
            
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh Results
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row md:justify-between md:items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {test.title} - Results
                </h1>
                {(test.testNumber || test.displayNumber) && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {test.displayNumber || `Test #${test.testNumber}`}
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                {test.subjectName || 'Unknown Subject'} • {submission.className || 'Unknown Class'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Submitted on {formatDateTime(submission.submittedAt)}
              </p>
            </div>
            
            <div className="mt-4 md:mt-0">
              <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(submission.passStatus)}`}>
                {getStatusIcon(submission.passStatus)}
                <span className="ml-2">
                  {getStatusText(submission.passStatus, test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay'))}
                  {submission.passStatus === 'passed' && ' 🎉'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Attempt Tracking Section */}
        {attemptInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Test Attempts
              </h2>
              
              {/* Re-attempt button */}
              {attemptInfo.canCreateNewAttempt && (
                <Button
                  onClick={handleReAttempt}
                  disabled={startingNewAttempt}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
                >
                  {startingNewAttempt ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Starting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* Attempt Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Attempts Used</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {attemptInfo.totalAttempts} / {attemptInfo.attemptsAllowed}
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Current Score</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {submission.percentage || 0}%
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {attemptInfo.canCreateNewAttempt ? (
                    <span className="text-blue-600 dark:text-blue-400">Can Re-attempt</span>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">
                      {attemptInfo.totalAttempts >= attemptInfo.attemptsAllowed ? 'All attempts used' : 'Not available'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Note: Multiple attempts display is being updated */}
            {attemptInfo && attemptInfo.attempts.length > 1 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                You have {attemptInfo.attempts.length} attempts for this test. Viewing current submission above.
              </div>
            )}
          </div>
        )}
        
        {/* Manual grading pending notice */}
        {(submission.manualGradingPending || submission.passStatus === 'pending_review') && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 flex">
            <Info className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay') 
                  ? 'Awaiting Teacher Review' 
                  : 'Manual Grading Pending'
                }
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                  ? 'Your essay submission has been received and is awaiting review by your teacher. You will be notified once your test has been graded and your final results are available.'
                  : 'Some questions in this test require manual grading by your teacher. Your final score will be updated once all questions have been graded.'
                }
              </p>
            </div>
          </div>
        )}
        
        {/* Results summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Results Summary
            </h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center">
                <Award className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {submission.percentage !== undefined ? `${submission.percentage}%` : 'Pending'}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {submission.totalScore !== undefined 
                    ? `${submission.totalScore}/${submission.maxScore} marks`
                    : 'Score pending'
                  }
                </p>
                {submission.manualGradingPending && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                    Score may change after manual grading
                  </p>
                )}
              </div>
              
              {/* Questions */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center">
                <FileText className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {submission.questionsAttempted}/{test.questions.length}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Questions answered
                </p>
                {submission.questionsSkipped > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {submission.questionsSkipped} questions skipped
                  </p>
                )}
              </div>
              
              {/* Time */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center">
                <Clock className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatDuration(submission.totalTimeSpent)}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Total time spent
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {submission.endTime && submission.startTime
                    ? `${formatDateTime(submission.startTime)} - ${formatDateTime(submission.endTime)}`
                    : ''
                  }
                </p>
              </div>
            </div>
            
            {/* MCQ Results Summary */}
            {submission.mcqResults && submission.mcqResults.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Multiple Choice Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    <div>
                      <div className="font-medium text-green-800 dark:text-green-300">
                        {submission.mcqResults.filter(r => r.isCorrect).length} Correct
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md flex items-center">
                    <XCircle className="h-5 w-5 text-red-500 mr-3" />
                    <div>
                      <div className="font-medium text-red-800 dark:text-red-300">
                        {submission.mcqResults.filter(r => !r.isCorrect).length} Incorrect
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md flex items-center">
                    <BarChart className="h-5 w-5 text-blue-500 mr-3" />
                    <div>
                      <div className="font-medium text-blue-800 dark:text-blue-300">
                        {Math.round((submission.mcqResults.filter(r => r.isCorrect).length / submission.mcqResults.length) * 100)}% Accuracy
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Question Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Question Details
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review your answers and see the correct solutions
            </p>
          </div>
          
          {/* Scrollable Questions Area */}
          <div className="max-h-[600px] overflow-y-auto">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {submission.finalAnswers.map((answer, index) => {
                // Find MCQ result if available
                const mcqResult = submission.mcqResults?.find(r => r.questionId === answer.questionId);
                
                // Find essay result if available
                const essayResult = submission.essayResults?.find(r => r.questionId === answer.questionId);
                
                return (
                  <div key={answer.questionId} className="p-6">
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-semibold flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {answer.questionText}
                          </h3>
                          <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              answer.questionType === 'mcq'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            }`}>
                              {answer.questionType === 'mcq' ? 'Multiple Choice' : 'Essay'}
                            </span>
                            <span>
                              {(() => {
                                if (answer.questionType === 'mcq') {
                                  return `${mcqResult?.marksAwarded || 0}/${mcqResult?.maxMarks || answer.questionMarks} marks`;
                                } else {
                                  // Essay question
                                  if (essayResult && essayResult.marksAwarded !== undefined && essayResult.marksAwarded !== null) {
                                    const marks = Number(essayResult.marksAwarded);
                                    const maxMarks = Number(essayResult.maxMarks);
                                    return `${marks}/${maxMarks} marks`;
                                  } else if (answer.marksAwarded !== undefined && answer.marksAwarded !== null) {
                                    const marks = Number(answer.marksAwarded);
                                    const maxMarks = Number(answer.questionMarks);
                                    return `${marks}/${maxMarks} marks`;
                                  } else {
                                    return `${answer.questionMarks} marks (pending)`;
                                  }
                                }
                              })()}
                            </span>
                            <span>•</span>
                            <span>{formatDuration(answer.timeSpent)} spent</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Result Badge */}
                      {answer.questionType === 'mcq' && mcqResult && (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          mcqResult.isCorrect 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {mcqResult.isCorrect ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Correct
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Incorrect
                            </>
                          )}
                        </span>
                      )}
                      
                      {answer.questionType === 'essay' && (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          (() => {
                            const isGraded = (essayResult && essayResult.marksAwarded !== undefined && essayResult.marksAwarded !== null) ||
                                           (answer.marksAwarded !== undefined && answer.marksAwarded !== null);
                            return isGraded 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
                          })()
                        }`}>
                          {(() => {
                            const isGraded = (essayResult && essayResult.marksAwarded !== undefined && essayResult.marksAwarded !== null) ||
                                           (answer.marksAwarded !== undefined && answer.marksAwarded !== null);
                            return isGraded ? 'Graded' : 'Pending Review';
                          })()}
                        </span>
                      )}
                    </div>

                    {/* MCQ Question Details */}
                    {answer.questionType === 'mcq' && mcqResult && (
                      <div className="space-y-4">
                        {/* Your Answer */}
                        <div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Your Answer:
                          </div>
                          <div className={`p-4 rounded-lg border-l-4 ${
                            mcqResult.isCorrect 
                              ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600'
                              : 'bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600'
                          }`}>
                            <div className="flex items-center">
                              {mcqResult.isCorrect 
                                ? <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                                : <XCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                              }
                              <span className={`font-medium ${
                                mcqResult.isCorrect 
                                  ? 'text-green-800 dark:text-green-300'
                                  : 'text-red-800 dark:text-red-300'
                              }`}>
                                Option {String.fromCharCode(65 + mcqResult.selectedOption)}: {
                                  typeof mcqResult.selectedOptionText === 'string' 
                                    ? mcqResult.selectedOptionText 
                                    : typeof mcqResult.selectedOptionText === 'object' && mcqResult.selectedOptionText && 'text' in mcqResult.selectedOptionText
                                      ? (mcqResult.selectedOptionText as any).text
                                      : 'Unknown option'
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Correct Answer (always show) */}
                        <div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Correct Answer:
                          </div>
                          <div className="p-4 rounded-lg border-l-4 bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600">
                            <div className="flex items-center">
                              <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                              <span className="font-medium text-green-800 dark:text-green-300">
                                Option {String.fromCharCode(65 + mcqResult.correctOption)}: {
                                  typeof mcqResult.correctOptionText === 'string' 
                                    ? mcqResult.correctOptionText 
                                    : typeof mcqResult.correctOptionText === 'object' && mcqResult.correctOptionText && 'text' in mcqResult.correctOptionText
                                      ? (mcqResult.correctOptionText as any).text
                                      : 'Unknown option'
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Explanation */}
                        {mcqResult.explanation && (
                          <div>
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Explanation:
                            </div>
                            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                              <p className="text-sm text-blue-800 dark:text-blue-300">
                                {mcqResult.explanation}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Essay Question Details */}
                    {answer.questionType === 'essay' && (
                      <div className="space-y-4">
                        {/* Your Answer */}
                        <div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Your Answer:
                          </div>
                          
                          {/* Text Answer */}
                          {answer.textContent && answer.textContent.trim() && (
                            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-600 mb-3">
                              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {answer.textContent}
                              </p>
                            </div>
                          )}
                          
                          {/* PDF Files */}
                          {answer.pdfFiles && answer.pdfFiles.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                PDF Attachments:
                              </div>
                              {answer.pdfFiles.map((pdf, pdfIndex) => (
                                <div
                                  key={`${pdf.fileUrl}-${pdfIndex}`}
                                  className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800"
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                      <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {pdf.fileName}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Size: {(pdf.fileSize / 1024 / 1024).toFixed(2)} MB
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => window.open(pdf.fileUrl, '_blank')}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* No Answer Message */}
                          {(!answer.textContent || !answer.textContent.trim()) && (!answer.pdfFiles || answer.pdfFiles.length === 0) && (
                            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-600">
                              <p className="text-gray-500 dark:text-gray-400 italic">
                                (No answer provided)
                              </p>
                            </div>
                          )}
                        </div>

                        {/* DEBUG PANEL - Remove in production */}
                        {/* Grading Results */}
                        {essayResult ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg dark:bg-blue-900/20">
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                Score: {Number(essayResult.marksAwarded) || 0} / {Number(essayResult.maxMarks)} marks
                              </span>
                              <span className="text-xs text-blue-600 dark:text-blue-400">
                                {Math.round(((Number(essayResult.marksAwarded) || 0) / Number(essayResult.maxMarks)) * 100)}%
                              </span>
                            </div>

                            {essayResult.feedback && (
                              <div>
                                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Teacher Feedback:
                                </div>
                                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                                  <p className="text-sm text-blue-800 dark:text-blue-300">
                                    {essayResult.feedback}
                                  </p>
                                </div>
                              </div>
                            )}

                            {essayResult.strengths && essayResult.strengths.length > 0 && (
                              <div>
                                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Strengths:
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                  {essayResult.strengths.map((strength, idx) => (
                                    <li key={idx}>{strength}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {essayResult.improvements && essayResult.improvements.length > 0 && (
                              <div>
                                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Areas for Improvement:
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                                  {essayResult.improvements.map((improvement, idx) => (
                                    <li key={idx}>{improvement}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                            <div className="flex items-center">
                              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
                              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                                This question requires manual grading and is still pending review by your teacher.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Integrity Report - Only show if there were issues */}
        {submission.integrityReport && submission.integrityReport.isIntegrityCompromised && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Integrity Report
                </h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                      Attention Needed
                    </h3>
                    <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                      <p className="mb-2">
                        Some suspicious activity was detected during this test session:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        {submission.integrityReport.suspiciousActivities.map((activity, idx) => (
                          <li key={idx}>{activity}</li>
                        ))}
                      </ul>
                      {submission.integrityReport.notes && (
                        <p className="mt-2 italic">
                          Note: {submission.integrityReport.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Bottom actions */}
        <div className="flex justify-center">
          <Button 
            onClick={handleBack}
            className="w-full max-w-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Tests
          </Button>
        </div>
      </div>
    </StudentLayout>
  );
}
