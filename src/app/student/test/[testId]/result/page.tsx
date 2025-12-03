'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { 
  AlertCircle, ArrowLeft, CheckCircle, XCircle, 
  Clock, Award, BarChart, ChevronDown, ChevronUp, 
  FileText, Info, AlertTriangle, RefreshCw, Target, Download, Trophy
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
  const [allAttempts, setAllAttempts] = useState<any[]>([]);
  const [bestAttempt, setBestAttempt] = useState<any | null>(null);
  
  // Test statistics and ranking
  const [testStats, setTestStats] = useState<{
    averageScore: number;
    highestScore: number;
    totalParticipants: number;
  } | null>(null);
  const [studentRanking, setStudentRanking] = useState<{
    rank: number;
    percentile: number;
    totalParticipants: number;
  } | null>(null);
  
  // Question order states for handling shuffled results
  const [originalOrderAnswers, setOriginalOrderAnswers] = useState<any[]>([]);
  const [isShuffledAttempt, setIsShuffledAttempt] = useState(false);
  const [downloadingPdfs, setDownloadingPdfs] = useState<Record<string, boolean>>({});

  // UI states
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const [startingNewAttempt, setStartingNewAttempt] = useState(false);  // Load data
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
        
        // Debug: Log all search params
        console.log('🔍 Result page loaded');
        console.log('🔍 URL submissionId param:', submissionId);
        console.log('🔍 All search params:', searchParams?.toString());
        console.log('🔍 testId:', testId, 'student:', student.id);
        
        // Get the submission with enhanced recovery
        console.log('🔍 Looking for submission for test:', testId, 'student:', student.id);
        const subId = submissionId || await SubmissionService.findSubmissionWithRecovery(testId, student.id);
        console.log('🔍 Found submission ID:', subId);
        
        if (!subId) {
          console.error('❌ No submission ID found');
          console.error('❌ submissionId from URL was:', submissionId);
          setError('No submission found for this test. The test may still be processing or there may have been an issue during submission.');
          setLoading(false);
          return;
        }

        console.log('📥 Attempting to get submission data for ID:', subId);
        let submissionData = await SubmissionService.getSubmission(subId);
        console.log('📥 Retrieved submission data:', submissionData ? 'Found' : 'Not found');
        
        if (!submissionData) {
          console.error('❌ Submission data not found for ID:', subId);
          setError('Submission not found. This may be a data consistency issue. Please try the recovery option.');
          setLoading(false);
          return;
        }

        // Verify that the submission belongs to the current student
        console.log('🔐 Verifying submission ownership - submission studentId:', submissionData.studentId, 'current student:', student.id);
        if (submissionData.studentId !== student.id) {
          console.error('❌ Submission ownership mismatch');
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

        // Load actual submission data for each attempt to get accurate scores
        if (attemptData.attempts.length > 0) {
          console.log('🔍 Loading submission data for attempts:', attemptData.attempts);
          
          const attemptsWithScores = await Promise.all(
            attemptData.attempts.map(async (attempt) => {
              try {
                // Get the actual submission for this attempt to get accurate scores
                const attemptSubmission = await SubmissionService.getSubmission(attempt.attemptId);
                
                if (attemptSubmission) {
                  console.log('✅ Found submission for attempt', attempt.attemptNumber, ':', {
                    submissionId: attemptSubmission.id,
                    totalScore: attemptSubmission.totalScore,
                    percentage: attemptSubmission.percentage,
                    maxScore: attemptSubmission.maxScore
                  });
                  
                  return {
                    id: attempt.attemptId,
                    attemptNumber: attempt.attemptNumber,
                    status: attempt.status,
                    score: attemptSubmission.totalScore || attemptSubmission.autoGradedScore || 0,
                    maxScore: attemptSubmission.maxScore || testData.totalMarks || 0,
                    percentage: attemptSubmission.percentage || 0,
                    submittedAt: attempt.submittedAt || attemptSubmission.submittedAt,
                    autoGradedScore: attemptSubmission.totalScore || attemptSubmission.autoGradedScore || 0,
                  };
                } else {
                  console.warn('⚠️ No submission found for attempt', attempt.attemptNumber, 'using attempt data');
                  // Fallback to attempt data (which might have incomplete scores)
                  return {
                    id: attempt.attemptId,
                    attemptNumber: attempt.attemptNumber,
                    status: attempt.status,
                    score: attempt.score || 0,
                    maxScore: testData.totalMarks || 0,
                    percentage: attempt.percentage || 0,
                    submittedAt: attempt.submittedAt,
                    autoGradedScore: attempt.score || 0,
                  };
                }
              } catch (error) {
                console.error('❌ Error loading submission for attempt', attempt.attemptNumber, ':', error);
                // Fallback to attempt data
                return {
                  id: attempt.attemptId,
                  attemptNumber: attempt.attemptNumber,
                  status: attempt.status,
                  score: attempt.score || 0,
                  maxScore: testData.totalMarks || 0,
                  percentage: attempt.percentage || 0,
                  submittedAt: attempt.submittedAt,
                  autoGradedScore: attempt.score || 0,
                };
              }
            })
          );
          
          console.log('🔍 Final attempts with scores:', attemptsWithScores);
          setAllAttempts(attemptsWithScores);
          
          // Find best attempt
          const bestAttemptData = attemptsWithScores.reduce((best, current) => 
            (current.percentage || 0) > (best?.percentage || 0) ? current : best, 
            attemptsWithScores[0]
          );
          setBestAttempt(bestAttemptData);
        }
        
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
        
        // Handle question order for shuffled attempts
        if (submissionId) {
          try {
            console.log('🔍 Checking if this was a shuffled attempt...');
            const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
            
            // Get original order questions for this attempt
            const originalOrderQuestions = await AttemptManagementService.getOriginalOrderQuestionsForAttempt(submissionId);
            
            // Check if this attempt was shuffled
            const attemptDoc = await (await import('firebase/firestore')).getDoc(
              (await import('firebase/firestore')).doc(
                (await import('@/utils/firebase-client')).firestore, 
                'testAttempts', 
                submissionId
              )
            );
            
            if (attemptDoc.exists()) {
              const attemptData = attemptDoc.data() as any;
              const wasShuffled = attemptData.isShuffled || false;
              setIsShuffledAttempt(wasShuffled);
              
              if (wasShuffled && submissionData.finalAnswers) {
                console.log('🔀 Reordering answers to match original question order...');
                
                // Create a map of original question order
                const questionOrderMap = new Map();
                originalOrderQuestions.forEach((question, index) => {
                  questionOrderMap.set(question.id, index);
                });
                
                // Sort answers by original question order
                const reorderedAnswers = [...submissionData.finalAnswers]
                  .filter(answer => answer.questionId !== 'submission_pdf')
                  .sort((a, b) => {
                    const orderA = questionOrderMap.get(a.questionId) ?? 999;
                    const orderB = questionOrderMap.get(b.questionId) ?? 999;
                    return orderA - orderB;
                  });
                
                setOriginalOrderAnswers(reorderedAnswers);
                console.log('✅ Answers reordered to original question sequence');
              } else {
                // Not shuffled, use answers as-is
                setOriginalOrderAnswers(submissionData.finalAnswers?.filter(answer => answer.questionId !== 'submission_pdf') || []);
              }
            }
          } catch (shuffleError) {
            console.warn('⚠️ Could not check shuffle status, using original order:', shuffleError);
            setOriginalOrderAnswers(submissionData.finalAnswers?.filter(answer => answer.questionId !== 'submission_pdf') || []);
          }
        } else {
          setOriginalOrderAnswers(submissionData.finalAnswers?.filter(answer => answer.questionId !== 'submission_pdf') || []);
        }
        
        // Debug logging to see what class information we have
        console.log('🔍 CLASS INFO DEBUG:', {
          submissionClassName: submissionData.className,
          submissionClassId: submissionData.classId,
          testClassNames: testData.classNames,
          testClassIds: testData.classIds,
          studentInfo: {
            id: student?.id,
            name: student?.name
          }
        });

        // If we don't have class name, try to fetch it
        if ((!submissionData.className || submissionData.className === 'Unknown Class') && submissionData.classId) {
          try {
            console.log('🔍 Attempting to fetch class information for classId:', submissionData.classId);
            const { ClassFirestoreService } = await import('@/apiservices/classFirestoreService');
            const classData = await ClassFirestoreService.getClassById(submissionData.classId);
            
            if (classData && classData.name) {
              console.log('✅ Found class name:', classData.name);
              // Update the submission data with the correct class name
              submissionData.className = classData.name;
              setSubmission({...submissionData});
            }
          } catch (classError) {
            console.warn('⚠️ Could not fetch class information:', classError);
          }
        }
        
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
        
        // Load test statistics and student ranking
        try {
          const { TestStatisticsService } = await import('@/apiservices/testStatisticsService');
          
          // Get test statistics
          const stats = await TestStatisticsService.getTestStatistics(testId);
          if (stats) {
            setTestStats({
              averageScore: stats.averageScore,
              highestScore: stats.highestScore,
              totalParticipants: stats.submittedCount
            });
            
            // Get student ranking if we have a score
            if (submissionData.percentage !== undefined) {
              const ranking = await TestStatisticsService.getStudentRanking(
                testId,
                student.id,
                submissionData.percentage
              );
              
              if (ranking) {
                setStudentRanking({
                  rank: ranking.rank,
                  percentile: ranking.percentile,
                  totalParticipants: ranking.totalParticipants
                });
              }
            }
          }
        } catch (statsError) {
          console.warn('⚠️ Could not load test statistics:', statsError);
          // Don't fail the whole page if statistics fail to load
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading test result:', error);
        setError('Failed to load test results. Please try again.');
        setLoading(false);
      }
    };
    
    loadData();
  }, [testId, student, submissionId]);
  
  // Get the correct class name from available sources
  const getClassName = () => {
    // Priority order:
    // 1. submission.className (direct from submission)
    // 2. test.classNames[0] if test has class names and matches submission.classId
    // 3. Use classId as fallback
    
    if (submission?.className && submission.className !== 'Unknown Class') {
      return submission.className;
    }
    
    if (test?.classNames && test.classNames.length > 0) {
      // If we have classIds in test, try to find matching class name
      if (test.classIds && submission?.classId) {
        const classIndex = test.classIds.indexOf(submission.classId);
        if (classIndex >= 0 && test.classNames[classIndex]) {
          return test.classNames[classIndex];
        }
      }
      // Otherwise use the first class name
      return test.classNames[0];
    }
    
    // Fallback to classId if available
    if (submission?.classId) {
      return `Class ${submission.classId}`;
    }
    
    return 'Unknown Class';
  };

  // Get full question details by questionId
  const getQuestionDetails = (questionId: string) => {
    if (!test?.questions) return null;
    
    // Find the question in the test data
    const question = test.questions.find(q => 
      (q.questionId && q.questionId === questionId) || 
      (q.id && q.id === questionId)
    );
    
    return question || null;
  };

  // Find the most recent submission for this test and student with enhanced error handling
  const findMostRecentSubmissionId = async (testId: string, studentId: string) => {
    try {
      // Import services
      const { SubmissionService } = await import('@/apiservices/submissionService');
      
      // Try the new enhanced method first
      const submissionId = await SubmissionService.findSubmissionWithRecovery(testId, studentId);
      
      if (submissionId) {
        console.log('✅ Found submission using enhanced recovery:', submissionId);
        return submissionId;
      }
      
      // Fallback to original method
      console.log('🔄 Trying fallback method...');
      
      // Get all submissions for this student
      const submissions = await SubmissionService.getStudentSubmissions(studentId);
      
      // Filter by test ID and sort by submission time (most recent first)
      const filteredSubmissions = submissions
        .filter(sub => sub.testId === testId)
        .sort((a, b) => b.submittedAt.seconds - a.submittedAt.seconds);
      
      if (filteredSubmissions.length === 0) {
        console.log('❌ No submissions found for this test');
        return null;
      }
      
      console.log('✅ Found submission using fallback method:', filteredSubmissions[0].id);
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

  // Get attempt status badge
  const getAttemptStatusBadge = (attempt: any) => {
    const status = attempt.status || 'submitted';
    
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Completed
          </span>
        );
      case 'graded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            Graded
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
            {status}
          </span>
        );
    }
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

  // Handle manual recovery attempt
  const handleRecoveryAttempt = async () => {
    if (!testId || !student?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Attempting manual recovery...');
      
      // Import services (only server-safe ones)
      const { SubmissionService } = await import('@/apiservices/submissionService');
      const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
      
      // First check for expired attempts that might need auto-submission via API
      console.log('🔍 Checking for expired attempts...');
      try {
        const response = await fetch('/api/background/student-submissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ studentId: student.id })
        });
        
        if (response.ok) {
          console.log('✅ Checked for expired attempts');
        } else {
          console.warn('⚠️ Background submission check returned error:', response.status);
        }
      } catch (bgError) {
        console.warn('⚠️ Background submission check failed:', bgError);
      }
      
      // Get attempt information to find recent attempts
      const attemptData = await AttemptManagementService.getAttemptSummary(testId, student.id);
      
      if (attemptData && attemptData.attempts.length > 0) {
        // Find the most recent submitted attempt
        const submittedAttempts = attemptData.attempts.filter(
          attempt => attempt.status === 'submitted' || attempt.status === 'auto_submitted'
        );
        
        if (submittedAttempts.length > 0) {
          const latestAttempt = submittedAttempts[submittedAttempts.length - 1];
          console.log('🔧 Attempting recovery for attempt:', latestAttempt.attemptId);
          
          // Try to recover the submission
          const recoveredSubmission = await SubmissionService.recoverSubmissionFromSession(latestAttempt.attemptId);
          
          if (recoveredSubmission) {
            console.log('✅ Recovery successful! Reloading page...');
            // Reload the page to show recovered results
            window.location.reload();
            return;
          }
        }
      }
      
      setError('Recovery attempt failed. No recoverable submission data found. Please contact your teacher for assistance.');
      
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      setError('Recovery attempt failed. Please try again or contact your teacher for assistance.');
    } finally {
      setLoading(false);
    }
  };

  // Download PDF file
  const downloadPdf = async (fileUrl: string, fileName: string) => {
    const downloadKey = `${fileUrl}_${fileName}`;
    
    if (downloadingPdfs[downloadKey]) return;
    
    setDownloadingPdfs(prev => ({ ...prev, [downloadKey]: true }));
    
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
      setTimeout(() => {
        setDownloadingPdfs(prev => ({ ...prev, [downloadKey]: false }));
      }, 2000);
    } catch (error) {
      console.error('❌ Failed to download PDF via API:', error);
      setDownloadingPdfs(prev => ({ ...prev, [downloadKey]: false }));
      
      // Fallback: direct link
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      link.click();
    }
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
            <div className="flex justify-center space-x-4">
              {error.includes('submission') && !error.includes('Recovery attempt failed') && (
                <Button 
                  onClick={handleRecoveryAttempt}
                  disabled={loading}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  {loading ? 'Recovering...' : 'Try Recovery'}
                </Button>
              )}
              <Button 
                onClick={handleBack}
              >
                Return to Tests
              </Button>
            </div>
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

  // Recalculate pass status based on teacher's configured passing score
  const getActualPassStatus = (submission: StudentSubmission, test: Test): string => {
    // If teacher has configured a passing score, use it
    if (test.config?.passingScore && submission.percentage !== undefined) {
      return submission.percentage >= test.config.passingScore ? 'passed' : 'failed';
    }
    
    // For essay tests that haven't been manually graded, show pending
    const isEssayTest = test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay');
    if (isEssayTest && submission.manualGradingPending) {
      return 'pending_review';
    }
    
    // Fallback to stored passStatus
    return submission.passStatus || 'pending_review';
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
                {test.subjectName || 'Unknown Subject'} • {getClassName()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Submitted on {formatDateTime(submission.submittedAt)}
              </p>
              {test.config?.passingScore && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Passing Score: {test.config.passingScore}% • Your Score: {submission.percentage || 0}%
                </p>
              )}
            </div>
            
            <div className="mt-4 md:mt-0">
              {(() => {
                const actualPassStatus = getActualPassStatus(submission, test);
                return (
                  <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(actualPassStatus)}`}>
                    {getStatusIcon(actualPassStatus)}
                    <span className="ml-2">
                      {getStatusText(actualPassStatus, test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay'))}
                      {actualPassStatus === 'passed' && ' 🎉'}
                    </span>
                  </div>
                );
              })()}
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
              
              {bestAttempt && bestAttempt.id !== submission.id && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="text-sm text-green-600 dark:text-green-400">Best Score</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {bestAttempt.percentage || 0}%
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    Attempt #{bestAttempt.attemptNumber}
                  </div>
                </div>
              )}
              
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
              <div>
                <button
                  onClick={() => setShowAllAttempts(!showAllAttempts)}
                  className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-3"
                >
                  {showAllAttempts ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide all attempts
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show all attempts ({allAttempts.length})
                    </>
                  )}
                </button>
                
                {showAllAttempts && (
                  <div className="space-y-3">
                    {allAttempts.map((attempt, index) => (
                      <div 
                        key={attempt.id}
                        className={`border rounded-lg p-4 ${
                          attempt.id === submission.id 
                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                Attempt #{attempt.attemptNumber}
                                {attempt.id === submission.id && (
                                  <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">(Current)</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatDateTime(attempt.submittedAt)}
                              </div>
                            </div>
                            
                            <div className="text-center">
                              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                {attempt.percentage || 0}%
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {attempt.score || 0} / {attempt.maxScore || 0}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            {getAttemptStatusBadge(attempt)}
                            
                            {attempt.id !== submission.id && (
                              <button
                                onClick={() => router.push(`/student/test/${testId}/result?submissionId=${attempt.id}`)}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                              >
                                View Details
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                <BarChart className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {submission.questionsAttempted}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Questions attempted
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {submission.questionsSkipped || 0} skipped
                </p>
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
            
            {/* Test Statistics and Performance */}
            {(testStats || studentRanking) && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Trophy className="h-5 w-5 mr-2" />
                  Test Performance & Rankings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Class Average */}
                  {testStats && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-center">
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        {testStats.averageScore.toFixed(1)}%
                      </div>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        Class Average
                      </p>
                    </div>
                  )}
                  
                  {/* Highest Score */}
                  {testStats && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md text-center">
                      <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                        {testStats.highestScore.toFixed(1)}%
                      </div>
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Highest Score
                      </p>
                    </div>
                  )}
                  
                  {/* Your Rank */}
                  {studentRanking && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-md text-center">
                      <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                        #{studentRanking.rank}
                      </div>
                      <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                        Your Rank
                      </p>
                      <p className="text-xs text-purple-500 dark:text-purple-500 mt-1">
                        of {studentRanking.totalParticipants} students
                      </p>
                    </div>
                  )}
                  
                  {/* Percentile */}
                  {studentRanking && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-md text-center">
                      <div className="text-2xl font-bold text-orange-800 dark:text-orange-300">
                        {studentRanking.percentile}%
                      </div>
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        Percentile
                      </p>
                      <p className="text-xs text-orange-500 dark:text-orange-500 mt-1">
                        Better than {studentRanking.percentile}% of students
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Performance Insight */}
                {submission.percentage !== undefined && testStats && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="flex items-center mb-2">
                      <Target className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Performance Insight</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {submission.percentage > testStats.averageScore 
                        ? `Great job! You scored ${(submission.percentage - testStats.averageScore).toFixed(1)} points above the class average.`
                        : submission.percentage === testStats.averageScore
                        ? `You scored exactly at the class average.`
                        : `You scored ${(testStats.averageScore - submission.percentage).toFixed(1)} points below the class average. Consider reviewing the topics you found challenging.`
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
            
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
          
          {/* Check if this is an essay test */}
          {(() => {
            const isEssayTest = test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay');
            const hasSubmissionPdf = submission.finalAnswers.some(fa => fa.questionId === 'submission_pdf' && fa.pdfFiles && fa.pdfFiles.length > 0);
            
            // For essay tests with submission PDF, show download section instead of individual questions
            if (isEssayTest && hasSubmissionPdf) {
              const submissionPdfAnswer = submission.finalAnswers.find(fa => fa.questionId === 'submission_pdf');
              
              return (
                <div className="p-6">
                  <div className="text-center">
                    <FileText className="mx-auto h-16 w-16 text-blue-500 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Essay Test Submission
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Your complete answer sheet has been submitted as a single PDF file.
                    </p>
                    
                    {/* Download Section */}
                    <div className="max-w-md mx-auto">
                      {submissionPdfAnswer?.pdfFiles?.map((pdf, pdfIndex) => (
                        <div
                          key={`submission-${pdf.fileUrl}-${pdfIndex}`}
                          className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800 mb-4"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {pdf.fileName || 'Answer Sheet.pdf'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Size: {(pdf.fileSize / 1024 / 1024).toFixed(2)} MB
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Complete Essay Submission
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => downloadPdf(pdf.fileUrl, pdf.fileName || 'Answer_Sheet.pdf')}
                            disabled={downloadingPdfs[`${pdf.fileUrl}_${pdf.fileName || 'Answer_Sheet.pdf'}`]}
                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                              downloadingPdfs[`${pdf.fileUrl}_${pdf.fileName || 'Answer_Sheet.pdf'}`]
                                ? 'text-blue-600 bg-blue-100 cursor-not-allowed dark:bg-blue-900/20 dark:text-blue-400'
                                : 'text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                            }`}
                          >
                            {downloadingPdfs[`${pdf.fileUrl}_${pdf.fileName || 'Answer_Sheet.pdf'}`] ? (
                              <>
                                <div className="w-4 h-4 mr-2 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                Downloading...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Grading Status */}
                    <div className="mt-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                      <div className="flex items-center justify-center">
                        <Clock className="h-5 w-5 text-yellow-500 mr-3" />
                        <span className="text-sm text-yellow-700 dark:text-yellow-300">
                          {submission.manualGradingPending 
                            ? "Your submission is being reviewed by your teacher. Results will be available once grading is complete."
                            : "Your submission has been graded. Check the summary above for your results."
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            
            // For MCQ tests or essay tests without submission PDF, show individual questions
            return (
              <div className="max-h-[600px] overflow-y-auto">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isShuffledAttempt && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 mb-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-blue-700 dark:text-blue-200">
                            Questions were shuffled during your test but are shown below in their original order for easier review.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {originalOrderAnswers.map((answer, index) => {
                    // Find MCQ result if available
                    const mcqResult = submission.mcqResults?.find(r => r.questionId === answer.questionId);
                    
                    // Find essay result if available
                    const essayResult = submission.essayResults?.find(r => r.questionId === answer.questionId);
                    
                    // Get full question details for images and additional info
                    const questionDetails = getQuestionDetails(answer.questionId);
                
                    
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
                              
                              {/* Question Image */}
                              {questionDetails?.imageUrl && (
                                <div className="mb-4">
                                  <img
                                    src={questionDetails.imageUrl}
                                    alt={`Question ${index + 1} image`}
                                    className="max-w-full h-auto max-h-64 object-contain rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              
                              {/* Question Content Text */}
                              {questionDetails?.content && (
                                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                    {questionDetails.content}
                                  </p>
                                </div>
                              )}
                              
                              <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  answer.questionType === 'mcq'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                }`}>
                                  {answer.questionType === 'mcq' ? 'Multiple Choice' : 'Essay'}
                                </span>
                                {questionDetails?.imageUrl && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                                    📷 Image
                                  </span>
                                )}
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
                        </div>                    {/* MCQ Question Details */}
                    {answer.questionType === 'mcq' && mcqResult && (
                      <div className="space-y-4">
                        {/* Show all options if available from question details */}
                        {questionDetails?.options && questionDetails.options.length > 0 && (
                          <div>
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                              All Options:
                            </div>
                            <div className="space-y-2">
                              {questionDetails.options.map((option, optionIndex) => {
                                const isSelected = mcqResult.selectedOption === optionIndex;
                                const isCorrect = mcqResult.correctOption === optionIndex;
                                const optionText = typeof option === 'string' 
                                  ? option 
                                  : (option && typeof option === 'object' && 'text' in option) 
                                    ? (option as any).text 
                                    : `Option ${String.fromCharCode(65 + optionIndex)}`;
                                
                                return (
                                  <div 
                                    key={optionIndex}
                                    className={`p-3 rounded-lg border-l-4 ${
                                      isSelected && isCorrect
                                        ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600'
                                        : isSelected && !isCorrect
                                        ? 'bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600'
                                        : isCorrect
                                        ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600'
                                        : 'bg-gray-50 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                                    }`}
                                  >
                                    <div className="flex items-center">
                                      {isSelected && isCorrect ? (
                                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                                      ) : isSelected && !isCorrect ? (
                                        <XCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                                      ) : isCorrect ? (
                                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                                      ) : (
                                        <div className="h-5 w-5 mr-3 flex-shrink-0" />
                                      )}
                                      <span className={`font-medium ${
                                        isSelected && isCorrect
                                          ? 'text-green-800 dark:text-green-300'
                                          : isSelected && !isCorrect
                                          ? 'text-red-800 dark:text-red-300'
                                          : isCorrect
                                          ? 'text-green-800 dark:text-green-300'
                                          : 'text-gray-700 dark:text-gray-300'
                                      }`}>
                                        {String.fromCharCode(65 + optionIndex)}. {optionText}
                                        {isSelected && (
                                          <span className="ml-2 text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                            Your Answer
                                          </span>
                                        )}
                                        {isCorrect && (
                                          <span className="ml-2 text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                            Correct
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Fallback: Show your answer and correct answer if options not available */}
                        {(!questionDetails?.options || questionDetails.options.length === 0) && (
                          <>
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
                          </>
                        )}

                        {/* Explanation */}
                        {(mcqResult.explanation || questionDetails?.explanation || questionDetails?.explanationImageUrl) && (
                          <div>
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Explanation:
                            </div>
                            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                              {/* Text Explanation */}
                              {(mcqResult.explanation || questionDetails?.explanation) && (
                                <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                                  {mcqResult.explanation || questionDetails?.explanation}
                                </p>
                              )}
                              
                              {/* Explanation Image */}
                              {questionDetails?.explanationImageUrl && (
                                <div className="mt-3">
                                  <img
                                    src={questionDetails.explanationImageUrl}
                                    alt="Answer explanation"
                                    className="max-w-full h-auto max-h-64 object-contain rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Essay Question Details */}
                    {answer.questionType === 'essay' && (
                      <div className="space-y-4">
                        {/* Only show answer content for non-pure essay tests */}
                        {!test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay') && (
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
                                {answer.pdfFiles.map((pdf: any, pdfIndex: number) => (
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
                                    onClick={() => downloadPdf(pdf.fileUrl, pdf.fileName)}
                                    disabled={downloadingPdfs[`${pdf.fileUrl}_${pdf.fileName}`]}
                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                      downloadingPdfs[`${pdf.fileUrl}_${pdf.fileName}`]
                                        ? 'text-blue-600 bg-blue-50 cursor-not-allowed dark:bg-blue-900/10 dark:text-blue-400'
                                        : 'text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                                    }`}
                                  >
                                    {downloadingPdfs[`${pdf.fileUrl}_${pdf.fileName}`] ? (
                                      <>
                                        <div className="w-4 h-4 mr-1 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        Downloading...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-4 h-4 mr-1" />
                                        Download
                                      </>
                                    )}
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
                        )}

                        {/* Grading Results - Only show for non-pure essay tests or when graded */}
                        {!test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay') && essayResult ? (
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
                        ) : test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay') ? null : (
                          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                            <div className="flex items-center">
                              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
                              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                                This question requires manual grading and is still pending review by your teacher.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Suggested Answer/Model Answer for Essay Questions */}
                        {questionDetails?.questionData && answer.questionType === 'essay' && (
                          // Only show if we have model answer data in questionData
                          (questionDetails.questionData as any)?.suggestedAnswerContent || 
                          (questionDetails.questionData as any)?.suggestedAnswerImageUrl
                        ) && (
                          <div>
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Model Answer:
                            </div>
                            <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                              {/* Text Model Answer */}
                              {(questionDetails.questionData as any)?.suggestedAnswerContent && (
                                <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap mb-3">
                                  {(questionDetails.questionData as any).suggestedAnswerContent}
                                </p>
                              )}
                              
                              {/* Model Answer Image */}
                              {(questionDetails.questionData as any)?.suggestedAnswerImageUrl && (
                                <div className="mt-3">
                                  <img
                                    src={(questionDetails.questionData as any).suggestedAnswerImageUrl}
                                    alt="Model answer"
                                    className="max-w-full h-auto max-h-64 object-contain rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-gray-700"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
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
          );
        })()}
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
