'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AlertCircle, Clock, ArrowLeft, Target, RefreshCw } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui';
import { Test, LiveTest, FlexibleTest } from '@/models/testSchema';
import { Timestamp } from 'firebase/firestore';
import { AttemptSummary } from '@/models/attemptSchema';

// Import student layout from other components or use a local version for now
const StudentLayout = ({ children }: { children: React.ReactNode }) => children;

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params?.testId as string;
  
  const { student, loading: authLoading } = useStudentAuth();
  const { theme } = useTheme();
  
  // States
  const [test, setTest] = useState<Test | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<AttemptSummary | null>(null);
  const [lateSubmissionInfo, setLateSubmissionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingTest, setStartingTest] = useState(false);

  // Load test data
  useEffect(() => {
    const loadTestData = async () => {
      if (!testId || !student) {
        return;
      }
      
      try {
        setLoading(true);
        
        // Import Firestore functions
        const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
        const { firestore } = await import('@/utils/firebase-client');
        
        // Get the test document
        const testDoc = await getDoc(doc(firestore, 'tests', testId));
        
        if (!testDoc.exists()) {
          setError('Test not found. It may have been deleted.');
          setLoading(false);
          return;
        }
        
        const testData = { id: testDoc.id, ...testDoc.data() } as Test;
        
        console.log('🎯 Parent page - Test data loaded:', {
          id: testData.id,
          title: testData.title,
          assignmentType: testData.assignmentType,
          classIds: testData.classIds
        });
        
        // Load late submission info for this test and student
        try {
          const { LateSubmissionService } = await import('@/apiservices/lateSubmissionService');
          const lateSubmission = await LateSubmissionService.checkLateSubmissionApproval(testId, student.id);
          
          if (lateSubmission && lateSubmission.status === 'approved') {
            console.log('✅ Found late submission approval:', lateSubmission);
            setLateSubmissionInfo(lateSubmission);
          }
        } catch (lateSubmissionError) {
          console.log('ℹ️ No late submission approval found or error loading:', lateSubmissionError);
          // Don't set error, just continue without late submission
        }
        
        console.log('🎯 Parent page - Test data loaded:', {
          id: testData.id,
          title: testData.title,
          assignmentType: testData.assignmentType,
          classIds: testData.classIds
        });
        
        // Check if this is a custom/student-based test
        const isCustomTest = testData.assignmentType === 'student-based' || 
                            (!testData.assignmentType && (!testData.classIds || testData.classIds.length === 0)) ||
                            !testData.classIds || 
                            testData.classIds.length === 0;
        
        console.log('🎯 Parent page - Is custom test:', isCustomTest);
        
        // Only check enrollment for class-based tests
        if (!isCustomTest) {
          console.log('🎯 Parent page - Checking enrollment for class-based test...');
          
          // Check if student is enrolled in any of the test's classes
          const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
          const enrollments = await getEnrollmentsByStudent(student.id);
          
          const isEnrolled = enrollments.some(enrollment => 
            testData.classIds.includes(enrollment.classId)
          );
          
          if (!isEnrolled) {
            setError('You are not enrolled in the class for this test.');
            setLoading(false);
            return;
          }
          console.log('✅ Parent page - Student is enrolled in test classes');
        } else {
          console.log('🟢 Parent page - Skipping enrollment check for custom test');
        }

        // Get attempt information - Use direct query to get all attempts and categorize them properly
        const attemptsQuery = query(
          collection(firestore, 'testAttempts'),
          where('testId', '==', testId),
          where('studentId', '==', student.id)
        );
        
        const attemptsSnapshot = await getDocs(attemptsQuery);
        const allAttempts: any[] = [];
        const completedAttempts: any[] = [];
        const activeAttempts: any[] = [];
        
        const now = new Date();
        
        attemptsSnapshot.forEach((doc) => {
          const attemptData = { id: doc.id, ...doc.data() } as any;
          allAttempts.push(attemptData);
          
          console.log('🔍 Processing attempt:', {
            id: attemptData.id,
            status: attemptData.status,
            submittedAt: attemptData.submittedAt,
            isLateSubmission: attemptData.isLateSubmission,
            lateSubmissionId: attemptData.lateSubmissionId,
            requiresTestDataRefresh: attemptData.requiresTestDataRefresh, // Extension marker
            testExtendedAt: attemptData.testExtendedAt
          });
          
          // 🚨 CRITICAL: Check if this attempt was affected by test extension
          // Only if extension detection is enabled (can be disabled for safety)
          const enableExtensionDetection = process.env.NEXT_PUBLIC_ENABLE_EXTENSION_DETECTION !== 'false';
          
          if (enableExtensionDetection && (attemptData.requiresTestDataRefresh || attemptData.testExtendedAt)) {
            console.log('🔄 Attempt was affected by test extension, refreshing test data...');
            
            // Clear the extension flags first to prevent infinite loops
            fetch('/api/tests/clear-extension-flags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testId, studentId: student.id })
            }).then(response => {
              if (response.ok) {
                console.log('✅ Extension flags cleared');
              }
            }).catch(error => {
              console.warn('⚠️ Failed to clear extension flags:', error);
            });
            
            // Force refresh test data to get latest deadline
            setTimeout(() => {
              console.log('♻️ Reloading test data due to extension');
              loadTestData(); // Recursive call to refresh with latest data
            }, 500); // Slightly longer delay to ensure flag clearing completes
            return; // Exit early to prevent stale data processing
          }
          
          // Check if attempt has expired by comparing current time with endTime
          // For late submissions, we need to consider the extended deadline
          let isExpired = false;
          
          // If there's a late submission approved, check against late submission deadline first
          if (lateSubmissionInfo && lateSubmissionInfo.status === 'approved') {
            const lateDeadline = lateSubmissionInfo.newDeadline.toDate ? 
              lateSubmissionInfo.newDeadline.toDate() : 
              new Date(lateSubmissionInfo.newDeadline.seconds * 1000);
            isExpired = now > lateDeadline;
            console.log('📅 Using late submission deadline for expiration check:', {
              attemptId: attemptData.id,
              lateDeadline: lateDeadline.toISOString(),
              currentTime: now.toISOString(),
              isExpired
            });
          } else {
            // Use original attempt end time logic
            if (attemptData.endTime) {
              const endTime = attemptData.endTime.toDate ? attemptData.endTime.toDate() : new Date(attemptData.endTime.seconds * 1000);
              isExpired = now > endTime;
            } else if (attemptData.startedAt && attemptData.totalTimeAllowed) {
              // Fallback: calculate end time from start time + duration
              const startTime = attemptData.startedAt.toDate ? attemptData.startedAt.toDate() : new Date(attemptData.startedAt.seconds * 1000);
              const endTime = new Date(startTime.getTime() + (attemptData.totalTimeAllowed * 1000));
              isExpired = now > endTime;
            }
          }
          
          // Categorize attempts based on status and time validity
          // Be more strict about what constitutes a completed attempt
          const isCompleted = attemptData.status === 'submitted' || 
                             attemptData.status === 'auto_submitted' || 
                             (attemptData.submittedAt && attemptData.submittedAt.seconds > 0); // Only if actually submitted
          
          // Be more conservative about what constitutes an active attempt
          const isActive = !isCompleted && 
                          !isExpired && // ✅ Add expiration check
                          (attemptData.status === 'in_progress' || 
                           attemptData.status === 'not_started' || 
                           attemptData.status === 'paused') &&
                          (!attemptData.submittedAt); // ✅ Ensure no submission timestamp
          
          console.log('🔍 Attempt categorization:', {
            id: attemptData.id,
            isExpired,
            isCompleted,
            isActive
          });
          
          if (isCompleted) {
            completedAttempts.push(attemptData);
          } else if (isActive) {
            activeAttempts.push(attemptData);
          }
        });
        
        // Calculate proper attempt summary
        const attemptsAllowed = testData.type === 'flexible' 
          ? (testData as FlexibleTest).attemptsAllowed || 1 
          : 1;
        
        // Separate regular attempts from late submission attempts before calculating limits
        const regularCompletedAttempts = completedAttempts.filter(attempt => 
          !attempt.isLateSubmission && !attempt.lateSubmissionId
        );
        const activeRegularAttempts = activeAttempts.filter(attempt => 
          !attempt.isLateSubmission && !attempt.lateSubmissionId
        );
        
        // For regular attempts, check against the normal limit
        let canCreateNewAttempt = regularCompletedAttempts.length < attemptsAllowed || activeRegularAttempts.length > 0;
        
        // If late submission is approved and active, allow new attempt regardless of previous regular attempts
        if (lateSubmissionInfo && lateSubmissionInfo.status === 'approved') {
          const lateDeadlineSeconds = lateSubmissionInfo.newDeadline?.seconds || 
                                     (lateSubmissionInfo.newDeadline?.getTime ? lateSubmissionInfo.newDeadline.getTime() / 1000 : 0);
          
          if (now < lateDeadlineSeconds) {
            // Check if there are any late submission attempts already
            const lateSubmissionAttempts = allAttempts.filter(attempt => 
              attempt.isLateSubmission === true || attempt.lateSubmissionId
            );
            
            console.log('🕒 Late submission attempts found:', lateSubmissionAttempts.length);
            
            // Allow new attempt if no late submission attempts exist yet
            if (lateSubmissionAttempts.length === 0) {
              canCreateNewAttempt = true;
              console.log('✅ Late submission opportunity: allowing new attempt');
            } else {
              // Check if existing late submission attempts are completed
              const completedLateAttempts = lateSubmissionAttempts.filter(attempt => {
                const isLateCompleted = attempt.status === 'submitted' || 
                                       attempt.status === 'auto_submitted' || 
                                       (attempt.submittedAt && attempt.submittedAt.seconds > 0);
                return isLateCompleted;
              });
              
              const activeLateAttempts = lateSubmissionAttempts.filter(attempt => {
                const isLateCompleted = attempt.status === 'submitted' || 
                                       attempt.status === 'auto_submitted' || 
                                       (attempt.submittedAt && attempt.submittedAt.seconds > 0);
                return !isLateCompleted;
              });
              
              canCreateNewAttempt = completedLateAttempts.length === 0 || activeLateAttempts.length > 0;
              console.log('🕒 Late submission check: completed late attempts =', completedLateAttempts.length, 'active late attempts =', activeLateAttempts.length);
            }
          }
        }
        
        // Find best score from completed attempts
        let bestScore: number | undefined;
        let lastAttemptStatus: any;
        let lastAttemptDate: any;
        
        if (completedAttempts.length > 0) {
          bestScore = Math.max(...completedAttempts.map((attempt: any) => attempt.score || 0));
          const latestAttempt = completedAttempts.sort((a: any, b: any) => 
            (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          )[0];
          lastAttemptStatus = latestAttempt.status;
          lastAttemptDate = latestAttempt.submittedAt;
        }
        
        console.log('📊 Attempt breakdown:', {
          total: completedAttempts.length,
          regular: regularCompletedAttempts.length,
          lateSubmission: completedAttempts.length - regularCompletedAttempts.length,
          canCreateNew: canCreateNewAttempt
        });
        
        const attemptData: AttemptSummary = {
          testId,
          studentId: student.id,
          totalAttempts: regularCompletedAttempts.length, // Only count regular attempts for the limit
          attemptsAllowed,
          canCreateNewAttempt,
          bestScore,
          lastAttemptStatus,
          lastAttemptDate,
          attempts: completedAttempts.map((attempt: any, index: number) => ({
            attemptNumber: index + 1,
            attemptId: attempt.id,
            status: attempt.status,
            score: attempt.score,
            percentage: attempt.percentage,
            submittedAt: attempt.submittedAt
          }))
        };
        
        // Store additional data for UI display including remaining time for active attempts
        (attemptData as any).activeAttempts = activeAttempts.length;
        (attemptData as any).hasActiveAttempt = activeAttempts.length > 0;
        
        // Calculate remaining time for active attempt if exists
        if (activeAttempts.length > 0) {
          const activeAttempt = activeAttempts[0];
          const now = new Date();
          let remainingMinutes = 0;
          
          if (activeAttempt.endTime) {
            const endTime = activeAttempt.endTime.toDate ? activeAttempt.endTime.toDate() : new Date(activeAttempt.endTime.seconds * 1000);
            remainingMinutes = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60)));
          } else if (activeAttempt.startedAt && activeAttempt.totalTimeAllowed) {
            const startTime = activeAttempt.startedAt.toDate ? activeAttempt.startedAt.toDate() : new Date(activeAttempt.startedAt.seconds * 1000);
            const endTime = new Date(startTime.getTime() + (activeAttempt.totalTimeAllowed * 1000));
            remainingMinutes = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60)));
          }
          
          (attemptData as any).activeAttemptRemainingMinutes = remainingMinutes;
          (attemptData as any).activeAttemptId = activeAttempt.id;
        }
        
        console.log('✅ Attempt summary calculated:', {
          totalAttempts: allAttempts.length,
          completedAttempts: completedAttempts.length,
          activeAttempts: activeAttempts.length,
          attemptsAllowed,
          canCreateNewAttempt
        });
        
        setAttemptInfo(attemptData);
        
        // Set the test data
        setTest(testData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading test:', error);
        setError('Failed to load test data. Please try again.');
        setLoading(false);
      }
    };
    
    loadTestData();
  }, [testId, student]);

  // Format date and time - handles both Firestore Timestamp and plain objects
  const formatDateTime = (timestamp: any) => {
    let date: Date;
    
    try {
      // Check if it's a proper Firestore Timestamp with toDate method
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // Check if it's a plain object with seconds property (serialized Timestamp)
      else if (timestamp && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000);
      }
      // Check if it's already a Date object
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      // Check if it's a string that can be parsed
      else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }
      // Fallback to current date if timestamp is invalid
      else {
        console.warn('Invalid timestamp format:', timestamp);
        date = new Date();
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error, timestamp);
      date = new Date(); // Fallback to current date
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

  // Handle going back
  const handleBack = () => {
    router.push('/student/test');
  };

  // Handle starting the actual test
  const handleStartTest = async () => {
    if (!attemptInfo || startingTest || !student) return;
    
    try {
      setStartingTest(true);
      
      // Check for active attempts first - use the data we already have
      if ((attemptInfo as any).hasActiveAttempt) {
        // Find the active attempt from our already loaded data
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { firestore } = await import('@/utils/firebase-client');
        
        const activeAttemptsQuery = query(
          collection(firestore, 'testAttempts'),
          where('testId', '==', testId),
          where('studentId', '==', student.id)
        );
        
        const activeAttemptsSnapshot = await getDocs(activeAttemptsQuery);
        let activeAttemptId: string | null = null;
        let validActiveAttempt = false;
        
        const now = new Date();
        
        activeAttemptsSnapshot.forEach((doc) => {
          const attemptData = doc.data();
          
          console.log('🔍 Checking attempt for resume validity:', {
            id: doc.id,
            status: attemptData.status,
            submittedAt: attemptData.submittedAt,
            endTime: attemptData.endTime,
            startedAt: attemptData.startedAt
          });
          
          // Check if attempt is truly active and within time limits
          const isActiveStatus = attemptData.status === 'in_progress' || 
                                 attemptData.status === 'not_started' || 
                                 attemptData.status === 'paused';
          
          // ✅ Add explicit check for submission timestamp
          const hasNotBeenSubmitted = !attemptData.submittedAt || attemptData.submittedAt.seconds === 0;
          
          if (isActiveStatus && hasNotBeenSubmitted) {
            // Check if still within time limits
            let isWithinTime = true;
            if (attemptData.endTime) {
              const endTime = attemptData.endTime.toDate ? attemptData.endTime.toDate() : new Date(attemptData.endTime.seconds * 1000);
              isWithinTime = now <= endTime;
            } else if (attemptData.startedAt && attemptData.totalTimeAllowed) {
              const startTime = attemptData.startedAt.toDate ? attemptData.startedAt.toDate() : new Date(attemptData.startedAt.seconds * 1000);
              const endTime = new Date(startTime.getTime() + (attemptData.totalTimeAllowed * 1000));
              isWithinTime = now <= endTime;
            }
            
            if (isWithinTime) {
              activeAttemptId = doc.id;
              validActiveAttempt = true;
              console.log('✅ Found valid active attempt to resume:', activeAttemptId);
            } else {
              console.log('⏰ Found expired attempt, will auto-submit:', doc.id);
              // Could auto-submit expired attempt here if needed
            }
          }
        });
        
        // If there's a valid active attempt, resume it
        if (activeAttemptId && validActiveAttempt) {
          console.log('🔄 Resuming existing attempt:', activeAttemptId);
          
          // Check if this is an essay test and route accordingly
          const essayQuestions = test?.questions.filter(q => q.type === 'essay' || q.questionType === 'essay') || [];
          const isEssayOnlyTest = essayQuestions.length > 0 && essayQuestions.length === (test?.questions.length || 0);
          
          if (isEssayOnlyTest) {
            router.push(`/student/test/${testId}/take-essay?attemptId=${activeAttemptId}`);
          } else {
            router.push(`/student/test/${testId}/take?attemptId=${activeAttemptId}`);
          }
          return;
        }
      }
      
      // Only create new attempt if no valid active attempts exist and under limit
      if (!attemptInfo.canCreateNewAttempt) {
        // Check if this is a late submission scenario
        if (lateSubmissionInfo && lateSubmissionInfo.status === 'approved') {
          console.log('🕒 Using late submission attempt service...');
          
          // Import late submission service
          const { LateSubmissionAttemptService } = await import('@/apiservices/lateSubmissionAttemptService');
          
          // Check if student can create a late submission attempt
          const eligibility = await LateSubmissionAttemptService.canCreateLateSubmissionAttempt(
            testId,
            student.id,
            lateSubmissionInfo.id
          );
          
          if (!eligibility.canCreate) {
            alert(`Cannot start late submission: ${eligibility.reason}`);
            setStartingTest(false);
            return;
          }
          
          // Get student's enrollment to find their class ID
          const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
          const enrollments = await getEnrollmentsByStudent(student.id);
          
          // Find the class ID for this test
          const relevantEnrollment = enrollments.find(enrollment => 
            test?.classIds.includes(enrollment.classId)
          );
          
          const classId = relevantEnrollment?.classId || enrollments[0]?.classId || 'unknown';
          const className = relevantEnrollment?.className || enrollments[0]?.className || 'Unknown Class';
          
          // Create a late submission attempt
          const attemptId = await LateSubmissionAttemptService.createLateSubmissionAttempt(
            testId,
            student.id,
            student.name,
            classId,
            lateSubmissionInfo.id,
            className
          );
          
          console.log('✅ Late submission attempt created:', attemptId);
          
          // Start the late submission attempt
          await LateSubmissionAttemptService.startLateSubmissionAttempt(attemptId);
          
          // Check if this is an essay test and route accordingly
          const essayQuestions = test?.questions.filter(q => q.type === 'essay' || q.questionType === 'essay') || [];
          const isEssayOnlyTest = essayQuestions.length > 0 && essayQuestions.length === (test?.questions.length || 0);
          
          // Navigate to the appropriate test taking page with the attempt ID
          if (isEssayOnlyTest) {
            router.push(`/student/test/${testId}/take-essay?attemptId=${attemptId}`);
          } else {
            router.push(`/student/test/${testId}/take?attemptId=${attemptId}`);
          }
          return;
        }
        
        alert('Cannot start test - attempt limit reached or test not available');
        setStartingTest(false);
        return;
      }
      
      console.log('🆕 Creating new attempt...');
      
      // Import services for creating new attempt
      const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
      
      // Get student's enrollment to find their class ID
      const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
      const enrollments = await getEnrollmentsByStudent(student.id);
      
      // Find the class ID for this test
      const relevantEnrollment = enrollments.find(enrollment => 
        test?.classIds.includes(enrollment.classId)
      );
      
      const classId = relevantEnrollment?.classId || enrollments[0]?.classId || 'unknown';
      const className = relevantEnrollment?.className || enrollments[0]?.className || 'Unknown Class';
      
      // Create a new attempt
      const attemptId = await AttemptManagementService.createAttempt(
        testId,
        student.id,
        student.name,
        classId,
        className
      );
      
      console.log('✅ New attempt created:', attemptId);
      
      // Check if this is an essay test and route accordingly
      const essayQuestions = test?.questions.filter(q => q.type === 'essay' || q.questionType === 'essay') || [];
      const isEssayOnlyTest = essayQuestions.length > 0 && essayQuestions.length === (test?.questions.length || 0);
      
      // Navigate to the appropriate test taking page with the attempt ID
      if (isEssayOnlyTest) {
        router.push(`/student/test/${testId}/take-essay?attemptId=${attemptId}`);
      } else {
        router.push(`/student/test/${testId}/take?attemptId=${attemptId}`);
      }
    } catch (error) {
      console.error('Error starting test:', error);
      alert('Failed to start test. Please try again.');
      setStartingTest(false);
    }
  };

  // Loading state
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
              Test Details
            </h1>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              Error
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-6">
              {error}
            </p>
            <Button 
              onClick={handleBack}
              className="inline-flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Tests List
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Not found state
  if (!test) {
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
              Test Not Found
            </h1>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
            <h2 className="text-xl font-semibold text-orange-800 dark:text-orange-200 mb-2">
              Test Not Available
            </h2>
            <p className="text-orange-700 dark:text-orange-300 mb-6">
              The test you're looking for could not be found. It may have been deleted or you don't have access to it.
            </p>
            <Button 
              onClick={handleBack}
              className="inline-flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Tests List
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Determine if test is available now
  const now = Date.now() / 1000; // Current time in seconds
  let testStatus = '';
  let canStart = false;
  let isLateSubmissionActive = false;

  // Helper function to get seconds from any timestamp format
  const getSeconds = (timestamp: any): number => {
    if (timestamp && typeof timestamp.seconds === 'number') {
      return timestamp.seconds;
    } else if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().getTime() / 1000;
    } else if (timestamp instanceof Date) {
      return timestamp.getTime() / 1000;
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp).getTime() / 1000;
    } else if (typeof timestamp === 'number') {
      return timestamp > 1000000000000 ? timestamp / 1000 : timestamp; // Convert milliseconds to seconds if needed
    }
    console.warn('⚠️ Unknown timestamp format in getSeconds:', timestamp);
    return 0;
  };

  // Check for late submission first
  if (lateSubmissionInfo && lateSubmissionInfo.status === 'approved') {
    const lateDeadlineSeconds = getSeconds(lateSubmissionInfo.newDeadline);
    
    if (now <= lateDeadlineSeconds) {
      testStatus = 'Late submission opportunity available.';
      canStart = true;
      isLateSubmissionActive = true;
    } else {
      testStatus = 'Late submission deadline has passed.';
      canStart = false;
    }
  } else {
    // Original test deadline logic
    if (test.type === 'live') {
      const liveTest = test as LiveTest;
      const joinTimeSeconds = getSeconds(liveTest.studentJoinTime);
      const endTimeSeconds = getSeconds(liveTest.actualEndTime);
      
      if (now < joinTimeSeconds) {
        testStatus = 'This test has not started yet.';
        canStart = false;
      } else if (now >= joinTimeSeconds && now <= endTimeSeconds) {
        testStatus = 'This test is live now.';
        canStart = true;
      } else {
        testStatus = 'This test has ended.';
        canStart = false;
      }
    } else {
      const flexTest = test as FlexibleTest;
      const fromSeconds = getSeconds(flexTest.availableFrom);
      const toSeconds = getSeconds(flexTest.availableTo);
      
      if (now < fromSeconds) {
        testStatus = 'This test is not available yet.';
        canStart = false;
      } else if (now >= fromSeconds && now <= toSeconds) {
        testStatus = 'This test is available now.';
        canStart = true;
      } else {
        testStatus = 'This test is no longer available.';
        canStart = false;
      }
    }
  }

  return (
    <StudentLayout>
      <div className={`min-h-screen p-6 ${
        theme === 'default'
          ? 'bg-gradient-to-br from-gray-50 to-white'
          : theme === 'ben10'
          ? 'bg-gradient-to-br from-[#64cc4f] via-black to-[#64cc4f]'
          : theme === 'tinkerbell'
          ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400'
          : theme === 'cricketverse'
          ? 'bg-gradient-to-br from-blue-400 via-indigo-600 to-blue-400'
          : theme === 'bounceworld'
          ? 'bg-gradient-to-br from-[#1D428A] via-[#C8102E] to-[#1D428A]'
          : theme === 'avengers'
          ? 'bg-gradient-to-br from-[#2C1267] via-purple-900 to-[#4F2C8D]'
          : theme === 'ponyville'
          ? 'bg-gradient-to-br from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
          : 'bg-gradient-to-br from-blue-400 via-indigo-600 to-blue-400'
      }`}>
        {/* Ben 10 Hero Header */}
        <div className={`rounded-3xl shadow-2xl border-4 p-8 mb-6 relative overflow-hidden ${
          theme === 'default'
            ? 'bg-gradient-to-r from-white to-gray-100 border-gray-300'
            : theme === 'ben10'
            ? 'bg-gradient-to-r from-[#64cc4f] via-black to-[#64cc4f] border-[#64cc4f]'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-green-600 via-green-500 to-yellow-500 border-black'
            : theme === 'cricketverse'
            ? 'bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500 border-black'
            : theme === 'bounceworld'
            ? 'bg-gradient-to-r from-[#1D428A] via-[#C8102E] to-[#1D428A] border-white'
            : theme === 'avengers'
            ? 'bg-gradient-to-r from-[#2C1267] via-[#4F2C8D] to-[#2C1267] border-black'
            : theme === 'ponyville'
            ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#f1aed5] border-black'
            : 'bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500 border-black'
        }`}>
          
          

          <div className="flex items-center space-x-4 relative z-10">
            {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-6xl">📝</div>}
            <div>
              <h1 className={`text-4xl font-black mb-2 flex items-center ${
                theme === 'default'
                  ? 'text-black'
                  : 'text-white'
              }`}>
                <span>{theme === 'ben10' ? 'Student' : theme === 'tinkerbell' ? 'Student' : theme === 'default' ? 'Student' : 'Student'}</span>
                <span className={`ml-2 font-black text-5xl ${
                  theme === 'default'
                    ? 'text-blue-600'
                    : theme === 'ben10'
                    ? 'text-[#64cc4f]'
                    : theme === 'tinkerbell'
                    ? 'text-yellow-200'
                    : theme === 'cricketverse'
                    ? 'text-blue-200'
                    : theme === 'bounceworld'
                    ? 'text-white'
                    : theme === 'avengers'
                    ? 'text-purple-300'
                    : theme === 'ponyville'
                    ? 'text-white'
                    : 'text-blue-200'
                }`}>{theme === 'ben10' ? 'Academic' : theme === 'tinkerbell' ? 'Academic' : theme === 'default' ? 'Academic' : 'Academic'}</span>
                <span className={`ml-2 text-3xl ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>Test</span>
              </h1>
              <p className={`text-lg mb-4 ${
                theme === 'default'
                  ? 'text-gray-700'
                  : theme === 'ben10'
                  ? 'text-[#b2e05b]'
                  : theme === 'tinkerbell'
                  ? 'text-green-100'
                  : theme === 'cricketverse'
                  ? 'text-blue-100'
                  : theme === 'bounceworld'
                  ? 'text-yellow-100'
                  : theme === 'avengers'
                  ? 'text-purple-100'
                  : theme === 'ponyville'
                  ? 'text-white'
                  : 'text-blue-100'
              }`}>{theme === 'ben10' 
                ? 'Ready to prove your hero skills? ⚡🦸‍♂️' 
                : theme === 'tinkerbell'
                ? 'Ready to cast your magic spells? ✨🧚‍♀️'
                : theme === 'default'
                ? 'Ready to showcase your knowledge? 📚'
                : theme === 'cricketverse'
                ? 'Ready to score some runs? 🏏'
                : theme === 'bounceworld'
                ? 'Ready to make some shots? 🏀'
                : theme === 'avengers'
                ? 'Ready to save the world? 🦸'
                : theme === 'ponyville'
                ? 'Ready to cast your magic? 🦄'
                : 'Ready to showcase your knowledge?'
              }</p>
              
              {/* Test Title and Badges */}
              <div className="flex items-center space-x-3 mb-2">
                <h2 className={`text-2xl font-bold ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>
                  {test.title}
                </h2>
                {/* Test Type Badge */}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border-2 ${
                  theme === 'default'
                    ? 'border-blue-400'
                    : theme === 'ben10'
                    ? 'border-[#64cc4f]'
                    : theme === 'tinkerbell'
                    ? 'border-yellow-400'
                    : theme === 'cricketverse'
                    ? 'border-blue-400'
                    : theme === 'bounceworld'
                    ? 'border-white'
                    : theme === 'avengers'
                    ? 'border-purple-400'
                    : theme === 'ponyville'
                    ? 'border-pink-400'
                    : 'border-blue-400'
                } ${
                  test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                    ? 'bg-purple-500 text-white'
                    : theme === 'default'
                    ? 'bg-blue-500 text-white'
                    : theme === 'ben10'
                    ? 'bg-[#64cc4f] text-white'
                    : theme === 'tinkerbell'
                    ? 'bg-yellow-500 text-white'
                    : theme === 'cricketverse'
                    ? 'bg-blue-500 text-white'
                    : theme === 'bounceworld'
                    ? 'bg-white text-[#1D428A]'
                    : theme === 'avengers'
                    ? 'bg-purple-600 text-white'
                    : theme === 'ponyville'
                    ? 'bg-pink-500 text-white'
                    : 'bg-blue-500 text-white'
                }`}>
                  {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                    ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                      ? '📝 Essay Test'
                      : '📝📊 Mixed Test'
                    : '📊 MCQ Test'
                  }
                </span>
                {/* Late Submission Badge */}
                {lateSubmissionInfo && lateSubmissionInfo.status === 'approved' && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border-2 ${
                    theme === 'default'
                      ? 'border-orange-400'
                      : theme === 'ben10'
                      ? 'border-[#64cc4f]'
                      : theme === 'tinkerbell'
                      ? 'border-yellow-400'
                      : theme === 'cricketverse'
                      ? 'border-blue-400'
                      : theme === 'bounceworld'
                      ? 'border-white'
                      : theme === 'avengers'
                      ? 'border-purple-400'
                      : theme === 'ponyville'
                      ? 'border-pink-400'
                      : 'border-blue-400'
                  } ${
                    isLateSubmissionActive
                      ? 'bg-orange-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}>
                    <Clock className="h-3 w-3 mr-1" />
                    {isLateSubmissionActive ? 'Late Submission Available' : 'Late Submission Expired'}
                  </span>
                )}
              </div>
              <p className={`${
                theme === 'default'
                  ? 'text-gray-700'
                  : theme === 'ben10'
                  ? 'text-[#b2e05b]'
                  : theme === 'tinkerbell'
                  ? 'text-green-200'
                  : theme === 'cricketverse'
                  ? 'text-blue-200'
                  : theme === 'bounceworld'
                  ? 'text-yellow-100'
                  : theme === 'avengers'
                  ? 'text-purple-100'
                  : theme === 'ponyville'
                  ? 'text-white'
                  : 'text-blue-200'
              }`}>
                {test.description || 'No description provided.'}
              </p>
            </div>
          </div>
        </div>
        
        <div className={`rounded-3xl shadow-2xl border-4 p-8 mb-6 ${
          theme === 'default'
            ? 'bg-gradient-to-r from-white to-gray-50 border-gray-300'
            : theme === 'ben10'
            ? 'bg-gradient-to-r from-[#4ba539] via-[#3fa32c] to-[#2c761d] border-[#64cc4f]'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-green-400 via-green-500 to-green-400 border-black'
            : theme === 'cricketverse'
            ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-500 border-black'
            : theme === 'bounceworld'
            ? 'bg-gradient-to-r from-[#1D428A] via-[#C8102E] to-[#1D428A] border-white'
            : theme === 'avengers'
            ? 'bg-gradient-to-r from-[#2C1267] via-[#4F2C8D] to-[#2C1267] border-black'
            : theme === 'ponyville'
            ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#f1aed5] border-black'
            : 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-500 border-black'
        }`}>
          <h2 className={`text-2xl font-black mb-6 flex items-center ${
            theme === 'default'
              ? 'text-black'
              : 'text-black'
          }`}>
            {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-4xl mr-3">📊</div>}
            {theme === 'ben10' 
              ? 'Test Information'
              : theme === 'tinkerbell'
              ? 'Test Information'
              : theme === 'default'
              ? 'Test Information'
              : 'Test Information'
            }
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                theme === 'default'
                  ? 'border-gray-400'
                  : 'border-black'
              }`}>
                <p className={`text-sm font-medium ${
                  theme === 'default'
                    ? 'text-gray-700'
                    : 'text-black'
                }`}>Subject</p>
                <p className={`mt-1 font-bold text-lg ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>{test.subjectName || 'Unknown Subject'}</p>
              </div>
              <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                theme === 'default'
                  ? 'border-gray-400'
                  : 'border-black'
              }`}>
                <p className={`text-sm font-medium ${
                  theme === 'default'
                    ? 'text-gray-700'
                    : 'text-black'
                }`}>Teacher</p>
                <p className={`mt-1 font-bold text-lg ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>{test.teacherName || 'Unknown Teacher'}</p>
              </div>
              <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                theme === 'default'
                  ? 'border-gray-400'
                  : 'border-black'
              }`}>
                <p className={`text-sm font-medium ${
                  theme === 'default'
                    ? 'text-gray-700'
                    : 'text-black'
                }`}>Test Type</p>
                <p className={`mt-1 font-bold text-lg capitalize ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>{test.type}</p>
              </div>
              <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                theme === 'default'
                  ? 'border-gray-400'
                  : 'border-black'
              }`}>
                <p className={`text-sm font-medium ${
                  theme === 'default'
                    ? 'text-gray-700'
                    : 'text-black'
                }`}>Total Questions</p>
                <p className={`mt-1 font-bold text-lg ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>{test.questions.length}</p>
              </div>
              <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                theme === 'default'
                  ? 'border-gray-400'
                  : 'border-black'
              }`}>
                <p className={`text-sm font-medium ${
                  theme === 'default'
                    ? 'text-gray-700'
                    : 'text-black'
                }`}>Total Marks</p>
                <p className={`mt-1 font-bold text-lg ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>{test.totalMarks}</p>
              </div>
              {test.type === 'live' ? (
                <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                  theme === 'default'
                    ? 'border-gray-400'
                    : 'border-black'
                }`}>
                  <p className={`text-sm font-medium ${
                    theme === 'default'
                      ? 'text-gray-700'
                      : 'text-black'
                  }`}>Scheduled Time</p>
                  <p className={`mt-1 font-bold text-lg ${
                    theme === 'default'
                      ? 'text-black'
                      : 'text-white'
                  }`}>
                    {formatDateTime((test as LiveTest).scheduledStartTime)}
                  </p>
                </div>
              ) : (
                <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                  theme === 'default'
                    ? 'border-gray-400'
                    : 'border-black'
                }`}>
                  <p className={`text-sm font-medium ${
                    theme === 'default'
                      ? 'text-gray-700'
                      : 'text-black'
                  }`}>Available Until</p>
                  <p className={`mt-1 font-bold text-lg ${
                    theme === 'default'
                      ? 'text-black'
                      : 'text-white'
                  }`}>
                    {formatDateTime((test as FlexibleTest).availableTo)}
                  </p>
                </div>
              )}
              <div className={`bg-white/10 rounded-xl p-4 border-2 ${
                theme === 'default'
                  ? 'border-gray-400'
                  : 'border-black'
              }`}>
                <p className={`text-sm font-medium ${
                  theme === 'default'
                    ? 'text-gray-700'
                    : 'text-black'
                }`}>Duration</p>
                <p className={`mt-1 font-bold text-lg ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>
                  {test.type === 'live' 
                    ? `${(test as LiveTest).duration} minutes` 
                    : `${(test as FlexibleTest).duration || 'No time limit'} minutes`}
                </p>
              </div>
            </div>
            
            {test.instructions && (
              <div className={`mt-6 bg-white/10 rounded-xl p-6 border-2 ${
                theme === 'default'
                  ? 'border-gray-400'
                  : theme === 'ben10'
                  ? 'border-[#64cc4f]'
                  : theme === 'tinkerbell'
                  ? 'border-yellow-400'
                  : 'border-blue-400'
              }`}>
                <h3 className={`text-lg font-bold mb-3 flex items-center ${
                  theme === 'default'
                    ? 'text-black'
                    : 'text-white'
                }`}>
                  {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-2xl mr-2">📋</div>}
                  {theme === 'ben10' 
                    ? 'Hero Instructions'
                    : theme === 'tinkerbell'
                    ? 'Fairy Instructions'
                    : theme === 'default'
                    ? 'Test Instructions'
                    : 'Test Instructions'
                  }
                </h3>
                <div className={`bg-black/30 rounded-lg p-4 border ${
                  theme === 'default'
                    ? 'text-black border-gray-400'
                    : theme === 'ben10'
                    ? 'text-[#b2e05b] border-[#64cc4f]'
                    : theme === 'tinkerbell'
                    ? 'text-green-100 border-yellow-400'
                    : 'text-blue-100 border-blue-400'
                }`}>
                  {test.instructions}
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
              {/* Late Submission Information */}
              {lateSubmissionInfo && lateSubmissionInfo.status === 'approved' && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-orange-600" />
                    Late Submission Opportunity
                  </h3>
                  
                  <div className={`rounded-lg p-4 border ${
                    isLateSubmissionActive 
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <AlertCircle className={`h-5 w-5 mt-0.5 ${
                        isLateSubmissionActive ? 'text-orange-600' : 'text-red-600'
                      }`} />
                      <div className="flex-1">
                        <p className={`font-medium ${
                          isLateSubmissionActive 
                            ? 'text-orange-800 dark:text-orange-300' 
                            : 'text-red-800 dark:text-red-300'
                        }`}>
                          {isLateSubmissionActive 
                            ? 'Late Submission Available' 
                            : 'Late Submission Expired'
                          }
                        </p>
                        <p className={`text-sm mt-1 ${
                          isLateSubmissionActive 
                            ? 'text-orange-700 dark:text-orange-400' 
                            : 'text-red-700 dark:text-red-400'
                        }`}>
                          New deadline: {formatDateTime(lateSubmissionInfo.newDeadline)}
                        </p>
                        {lateSubmissionInfo.reason && (
                          <p className={`text-sm mt-1 ${
                            isLateSubmissionActive 
                              ? 'text-orange-600 dark:text-orange-500' 
                              : 'text-red-600 dark:text-red-500'
                          }`}>
                            Reason: {lateSubmissionInfo.reason}
                          </p>
                        )}
                        {isLateSubmissionActive && (
                          <p className="text-xs mt-2 text-orange-600 dark:text-orange-500">
                            This is a special opportunity to complete the test after the original deadline.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Attempt Information */}
              {attemptInfo && (
                <div className={`mb-6 bg-white/10 rounded-xl p-6 border-2 ${
                  theme === 'default'
                    ? 'border-gray-400'
                    : theme === 'ben10'
                    ? 'border-[#64cc4f]'
                    : theme === 'tinkerbell'
                    ? 'border-yellow-400'
                    : 'border-blue-400'
                }`}>
                  <h3 className={`text-lg font-bold mb-4 flex items-center ${
                    theme === 'default'
                      ? 'text-black'
                      : 'text-white'
                  }`}>
                    {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-2xl mr-2">🎯</div>}
                    {theme === 'ben10' 
                      ? 'Hero Attempt Information'
                      : theme === 'tinkerbell'
                      ? 'Magic Attempt Information'
                      : theme === 'default'
                      ? 'Attempt Information'
                      : 'Attempt Information'
                    }
                  </h3>
                  
                  <div className={`bg-black/30 rounded-lg p-4 border ${
                    theme === 'default'
                      ? 'border-gray-400'
                      : theme === 'ben10'
                      ? 'border-[#64cc4f]'
                      : theme === 'tinkerbell'
                      ? 'border-yellow-400'
                      : 'border-blue-400'
                  }`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`bg-white/10 rounded-lg p-3 border ${
                        theme === 'default'
                          ? 'border-gray-400'
                          : theme === 'ben10'
                          ? 'border-[#64cc4f]'
                          : theme === 'tinkerbell'
                          ? 'border-yellow-400'
                          : 'border-blue-400'
                      }`}>
                        <p className={`text-sm font-medium ${
                          theme === 'default'
                            ? 'text-gray-700'
                            : theme === 'ben10'
                            ? 'text-[#64cc4f]'
                            : theme === 'tinkerbell'
                            ? 'text-yellow-200'
                            : 'text-blue-200'
                        }`}>Attempts Allowed</p>
                        <p className={`mt-1 text-lg font-bold ${
                          theme === 'default'
                            ? 'text-black'
                            : 'text-white'
                        }`}>
                          {attemptInfo.attemptsAllowed}
                          {isLateSubmissionActive && (
                            <span className="text-sm text-orange-400 ml-1">
                              + Late Submission
                            </span>
                          )}
                        </p>
                      </div>
                      
                      <div className={`bg-white/10 rounded-lg p-3 border ${
                        theme === 'default'
                          ? 'border-gray-400'
                          : theme === 'ben10'
                          ? 'border-[#64cc4f]'
                          : theme === 'tinkerbell'
                          ? 'border-pink-400'
                          : 'border-blue-400'
                      }`}>
                        <p className={`text-sm font-medium ${
                          theme === 'default'
                            ? 'text-gray-700'
                            : theme === 'ben10'
                            ? 'text-[#64cc4f]'
                            : theme === 'tinkerbell'
                            ? 'text-pink-200'
                            : 'text-blue-200'
                        }`}>Completed Attempts</p>
                        <p className={`mt-1 text-lg font-bold ${
                          theme === 'default'
                            ? 'text-black'
                            : 'text-white'
                        }`}>
                          {attemptInfo.totalAttempts}
                        </p>
                      </div>
                      
                      <div className={`bg-white/10 rounded-lg p-3 border ${
                        theme === 'default'
                          ? 'border-gray-400'
                          : theme === 'ben10'
                          ? 'border-[#64cc4f]'
                          : theme === 'tinkerbell'
                          ? 'border-pink-400'
                          : 'border-blue-400'
                      }`}>
                        <p className={`text-sm font-medium ${
                          theme === 'default'
                            ? 'text-gray-700'
                            : theme === 'ben10'
                            ? 'text-[#64cc4f]'
                            : theme === 'tinkerbell'
                            ? 'text-pink-200'
                            : 'text-blue-200'
                        }`}>Status</p>
                        <p className={`mt-1 text-sm font-medium ${
                          (attemptInfo as any).hasActiveAttempt
                            ? 'text-blue-400'
                            : isLateSubmissionActive
                              ? 'text-orange-400'
                              : attemptInfo.canCreateNewAttempt 
                              ? 'text-green-400'
                              : 'text-red-400'
                        }`}>
                          {(attemptInfo as any).hasActiveAttempt 
                            ? 'Resume Available' 
                            : isLateSubmissionActive
                              ? 'Late submission available'
                              : attemptInfo.canCreateNewAttempt 
                              ? 'Can attempt'
                              : 'Cannot attempt'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Active attempts indicator */}
                    {(attemptInfo as any).activeAttempts > 0 && (
                      <div className={`mt-4 border-2 rounded-xl p-4 ${
                        theme === 'default'
                          ? 'bg-gray-100 border-gray-300'
                          : theme === 'ben10'
                          ? 'bg-[#64cc4f]/20 border-[#64cc4f]'
                          : theme === 'tinkerbell'
                          ? 'bg-pink-500/20 border-pink-400'
                          : 'bg-blue-500/20 border-blue-400'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Clock className={`h-5 w-5 mr-3 ${
                              theme === 'default'
                                ? 'text-black'
                                : 'text-black'
                            }`} />
                            <p className={`text-sm font-medium ${
                              theme === 'default'
                                ? 'text-black'
                                : 'text-black'
                            }`}>
                              {theme === 'ben10' 
                                ? 'You have an active hero test in progress. Click "Resume Test" to continue your hero journey! ⚡'
                                : theme === 'tinkerbell'
                                ? 'You have an active magical test in progress. Click "Resume Test" to continue your fairy adventure! ✨'
                                : theme === 'default'
                                ? 'You have an active test in progress. Click "Resume Test" to continue! 📚'
                                : 'You have an active test in progress. Click "Resume Test" to continue your assessment! 📚'
                              }
                            </p>
                          </div>
                          {(attemptInfo as any).activeAttemptRemainingMinutes !== undefined && (
                            <div className={`text-sm font-bold ${
                              theme === 'default'
                                ? 'text-blue-600'
                                : theme === 'ben10'
                                ? 'text-[#64cc4f]'
                                : theme === 'tinkerbell'
                                ? 'text-pink-300'
                                : 'text-blue-300'
                            }`}>
                              {(attemptInfo as any).activeAttemptRemainingMinutes > 0 
                                ? `${(attemptInfo as any).activeAttemptRemainingMinutes} min left`
                                : 'Time expired'
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {attemptInfo.totalAttempts > 0 && (
                      <div className={`mt-4 pt-4 border-t ${
                        theme === 'ben10'
                          ? 'border-[#64cc4f]/30'
                          : theme === 'tinkerbell'
                          ? 'border-pink-500/30'
                          : 'border-blue-500/30'
                      }`}>
                        <p className={`text-sm ${
                          theme === 'ben10'
                            ? 'text-[#64cc4f]'
                            : theme === 'tinkerbell'
                            ? 'text-pink-200'
                            : 'text-blue-200'
                        }`}>
                          You have completed {attemptInfo.totalAttempts} regular attempt{attemptInfo.totalAttempts !== 1 ? 's' : ''} for this test.
                          {isLateSubmissionActive ? (
                            ' You can use your late submission opportunity to attempt this test.'
                          ) : attemptInfo.canCreateNewAttempt && !(attemptInfo as any).hasActiveAttempt ? (
                            ` You can attempt ${attemptInfo.attemptsAllowed - attemptInfo.totalAttempts} more time${attemptInfo.attemptsAllowed - attemptInfo.totalAttempts !== 1 ? 's' : ''}.`
                          ) : !attemptInfo.canCreateNewAttempt && !isLateSubmissionActive ? (
                            ' You have used all available attempts.'
                          ) : ''}
                        </p>
                        
                        {attemptInfo.totalAttempts > 0 && (
                          <button
                            onClick={() => router.push(`/student/test/${testId}/result`)}
                            className={`mt-2 text-sm transition-colors duration-200 ${
                              theme === 'ben10'
                                ? 'text-[#64cc4f] hover:text-[#b2e05b]'
                                : theme === 'tinkerbell'
                                ? 'text-pink-400 hover:text-pink-300'
                                : 'text-blue-400 hover:text-blue-300'
                            }`}
                          >
                            View Previous Results →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className={`p-4 rounded-md flex items-center mb-6 border ${
                isLateSubmissionActive 
                  ? theme === 'default'
                    ? 'bg-orange-50 border-orange-300'
                    : theme === 'ben10'
                    ? 'bg-gradient-to-r from-[#64cc4f]/40 to-black/60 border-[#64cc4f]/30'
                    : theme === 'tinkerbell'
                    ? 'bg-gradient-to-r from-pink-900/40 to-black/60 border-pink-500/30'
                    : theme === 'cricketverse'
                    ? 'bg-gradient-to-r from-blue-900/40 to-black/60 border-blue-500/30'
                    : theme === 'bounceworld'
                    ? 'bg-gradient-to-r from-white/40 to-black/60 border-white/30'
                    : theme === 'avengers'
                    ? 'bg-gradient-to-r from-purple-900/40 to-black/60 border-purple-500/30'
                    : theme === 'ponyville'
                    ? 'bg-gradient-to-r from-pink-900/40 to-black/60 border-pink-500/30'
                    : 'bg-gradient-to-r from-blue-900/40 to-black/60 border-blue-500/30'
                  : theme === 'default'
                  ? 'bg-gray-100 border-gray-300'
                  : theme === 'ben10'
                  ? 'bg-gradient-to-r from-[#64cc4f]/30 to-black/50 border-[#64cc4f]/20'
                  : theme === 'tinkerbell'
                  ? 'bg-gradient-to-r from-pink-900/30 to-black/50 border-pink-500/20'
                  : theme === 'cricketverse'
                  ? 'bg-gradient-to-r from-blue-900/30 to-black/50 border-blue-500/20'
                  : theme === 'bounceworld'
                  ? 'bg-gradient-to-r from-white/30 to-black/50 border-white/20'
                  : theme === 'avengers'
                  ? 'bg-gradient-to-r from-purple-900/30 to-black/50 border-purple-500/20'
                  : theme === 'ponyville'
                  ? 'bg-gradient-to-r from-pink-900/30 to-black/50 border-pink-500/20'
                  : 'bg-gradient-to-r from-blue-900/30 to-black/50 border-blue-500/20'
              }`}>
                <Clock className={`h-5 w-5 mr-3 ${
                  theme === 'default'
                    ? 'text-gray-700'
                    : 'text-white'
                }`} />
                <p className={`${
                  theme === 'default'
                    ? 'text-gray-800 font-semibold'
                    : 'text-white font-semibold'
                }`}>
                  {testStatus}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className={`border transition-all duration-200 ${
                    theme === 'default'
                      ? 'border-gray-400 text-gray-700 hover:bg-gray-200 hover:border-gray-600'
                      : theme === 'ben10'
                      ? 'border-[#64cc4f]/50 text-[#64cc4f] hover:bg-[#64cc4f]/30 hover:border-[#64cc4f]'
                      : theme === 'tinkerbell'
                      ? 'border-pink-500/50 text-pink-300 hover:bg-pink-900/30 hover:border-pink-400'
                      : theme === 'cricketverse'
                      ? 'border-blue-500/50 text-blue-300 hover:bg-blue-900/30 hover:border-blue-400'
                      : theme === 'bounceworld'
                      ? 'border-white/50 text-white hover:bg-white/30 hover:border-white'
                      : theme === 'avengers'
                      ? 'border-purple-500/50 text-purple-300 hover:bg-purple-900/30 hover:border-purple-400'
                      : theme === 'ponyville'
                      ? 'border-pink-500/50 text-pink-300 hover:bg-pink-900/30 hover:border-pink-400'
                      : 'border-blue-500/50 text-blue-300 hover:bg-blue-900/30 hover:border-blue-400'
                  }`}
                >
                  Return to Tests
                </Button>
                
                <Button
                  onClick={handleStartTest}
                  className={`inline-flex items-center border shadow-lg transition-all duration-200 ${
                    isLateSubmissionActive 
                      ? theme === 'default'
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-500 border-orange-600 hover:shadow-orange-500/25 text-white'
                        : theme === 'ben10'
                        ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f] border-[#64cc4f] hover:shadow-[#64cc4f]/25'
                        : theme === 'tinkerbell'
                        ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 border-orange-500/50'
                        : theme === 'cricketverse'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500/50'
                        : theme === 'bounceworld'
                        ? 'bg-gradient-to-r from-white to-gray-100 hover:from-gray-100 hover:to-white border-white text-[#1D428A] font-semibold hover:shadow-white/25'
                        : theme === 'avengers'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border-purple-500/50'
                        : theme === 'ponyville'
                        ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 border-orange-500/50'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500/50'
                      : theme === 'default'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-500 border-blue-600 hover:shadow-blue-500/25 text-white'
                      : theme === 'ben10'
                      ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f] border-[#64cc4f]/50 hover:shadow-[#64cc4f]/25'
                      : theme === 'tinkerbell'
                      ? 'bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 border-pink-500/50'
                      : theme === 'cricketverse'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500/50'
                      : theme === 'bounceworld'
                      ? 'bg-gradient-to-r from-white to-gray-100 hover:from-gray-100 hover:to-white border-white text-[#1D428A] font-semibold hover:shadow-white/25'
                      : theme === 'avengers'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border-purple-500/50'
                      : theme === 'ponyville'
                      ? 'bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 border-pink-500/50'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500/50'
                  }`}
                  variant={isLateSubmissionActive ? 'warning' : 'primary'}
                  disabled={!canStart || (!(attemptInfo as any)?.hasActiveAttempt && !attemptInfo?.canCreateNewAttempt && !isLateSubmissionActive) || startingTest}
                >
                  {startingTest ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      {(attemptInfo as any)?.hasActiveAttempt ? 'Resuming...' : 'Starting...'}
                    </>
                  ) : (attemptInfo as any)?.hasActiveAttempt ? (
                    'Resume Test'
                  ) : attemptInfo?.canCreateNewAttempt ? (
                    isLateSubmissionActive 
                      ? (attemptInfo.totalAttempts > 0 ? 'Start Late Submission' : 'Start Late Submission')
                      : (attemptInfo.totalAttempts > 0 ? 'Start New Attempt' : 'Start Test')
                  ) : attemptInfo ? (
                    'No Attempts Remaining'
                  ) : (
                    'Loading...'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
