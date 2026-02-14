'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Calendar, AlertCircle, FileText, CheckCircle, Play, ArrowRight, BookOpen, Filter, Info, ChevronDown, ChevronRight, ChevronUp, Users, Plus, CalendarDays } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Select } from '@/components/ui';
import { StudentTestAssignmentService } from '@/apiservices/studentTestAssignmentService';
import { TestService } from '@/apiservices/testService';
import { Timestamp } from 'firebase/firestore';
import { Test, LiveTest, FlexibleTest } from '@/models/testSchema';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { TestExtensionService } from '@/apiservices/testExtensionService';

// Import student layout from other components or use a local version for now
const StudentLayout = ({ children }: { children: React.ReactNode }) => children;

export default function StudentTests() {
  const { student, loading: authLoading } = useStudentAuth();
  const router = useRouter();
  const { theme } = useTheme();
  
  // States
  const [tests, setTests] = useState<Test[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [testAttempts, setTestAttempts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [expandedCompletedSections, setExpandedCompletedSections] = useState<Set<string>>(new Set());
  const [expandedCustomTests, setExpandedCustomTests] = useState(false);
  const [lateSubmissionApprovals, setLateSubmissionApprovals] = useState<Record<string, any>>({});
  
  // Fetch student data
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    
    const initializeData = async () => {
      if (!authLoading && student) {
        // Load data and get unsubscribe function
        unsubscribe = await loadStudentData();
        
        // Set up auto-refresh every 5 minutes to update enrollment data
        // (tests will update in real-time via the listener)
        intervalId = setInterval(() => {
          console.log("🔄 Refreshing enrollment data...");
          loadEnrollments();
        }, 300000); // Refresh every 5 minutes
      }
    };
    
    initializeData();
    
    // Cleanup function
    return () => {
      // Clear the interval
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      // Unsubscribe from Firestore listener
      if (unsubscribe) {
        console.log("🛑 Unsubscribing from test listener");
        unsubscribe();
      }
    };
  }, [student, authLoading]);

  // Function to load enrollments
  const loadEnrollments = async () => {
    try {
      console.log('🔍 Loading enrollments for student:', student?.id);
      
      // Import service
      const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
      
      // Get student enrollments using the service
      const enrollmentsData = await getEnrollmentsByStudent(student?.id || '');
      
      setEnrollments(enrollmentsData);
      console.log('✅ Loaded enrollments:', enrollmentsData.length);
      return enrollmentsData;
    } catch (error) {
      console.error('Error loading enrollments:', error);
      setError('Failed to load enrollment data. Please refresh the page.');
      return [];
    }
  };

  // Function to load late submission approvals for the student
  const loadLateSubmissionApprovals = async () => {
    try {
      console.log('🔍 Loading late submission approvals for student:', student?.id);
      
      // Import the service dynamically
      const { LateSubmissionService } = await import('@/apiservices/lateSubmissionService');
      
      // Get all late submission approvals for this student
      const approvals = await LateSubmissionService.getStudentLateSubmissions(student?.id || '');
      
      // Convert to a map for easy lookup by testId
      const approvalsMap: Record<string, any> = {};
      approvals.forEach((approval: any) => {
        approvalsMap[approval.testId] = approval;
      });
      
      setLateSubmissionApprovals(approvalsMap);
      console.log('✅ Loaded late submission approvals:', approvals.length);
      return approvalsMap;
    } catch (error) {
      console.error('Error loading late submission approvals:', error);
      return {};
    }
  };

  // Function to load test attempts for the student
  const loadTestAttempts = async () => {
    try {
      console.log('🔍 Loading test attempts for student:', student?.id);
      
      // Import services
      const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
      
      // Get all test attempts for this student
      const { collection, query, where, getDocs, doc, getDoc } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');
      
      const attemptsQuery = query(
        collection(firestore, 'testAttempts'),
        where('studentId', '==', student?.id || '')
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const attempts: Record<string, any> = {};
      const now = new Date();
      
      // Helper to get seconds from any timestamp format
      const getSeconds = (timestamp: any): number => {
        if (!timestamp) return 0;
        if (typeof timestamp.seconds === 'number') return timestamp.seconds;
        if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime() / 1000;
        if (timestamp instanceof Date) return timestamp.getTime() / 1000;
        if (typeof timestamp === 'string') return new Date(timestamp).getTime() / 1000;
        if (typeof timestamp === 'number') return timestamp > 1000000000000 ? timestamp / 1000 : timestamp;
        return 0;
      };
      
      // Cache for test data to avoid multiple fetches
      const testCache: Record<string, any> = {};
      
      // OPTIMIZATION: Collect all unique test IDs first to fetch them in parallel
      const uniqueTestIds = new Set<string>();
      attemptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.testId) uniqueTestIds.add(data.testId);
      });
      
      // Fetch all test data in parallel
      console.log(`🚀 Pre-fetching data for ${uniqueTestIds.size} tests...`);
      const testFetchPromises = Array.from(uniqueTestIds).map(async (testId) => {
        try {
          const testDoc = await getDoc(doc(firestore, 'tests', testId));
          if (testDoc.exists()) {
            return { id: testId, data: testDoc.data() };
          }
        } catch (e) {
          console.warn('Failed to load test data for', testId);
        }
        return null;
      });
      
      const testResults = await Promise.all(testFetchPromises);
      testResults.forEach(result => {
        if (result) {
          testCache[result.id] = result.data;
        }
      });
      console.log('✅ Pre-fetched test data complete');

      for (const docSnap of attemptsSnapshot.docs) {
        const attemptData = docSnap.data();
        const testId = attemptData.testId;
        
        if (!attempts[testId]) {
          attempts[testId] = {
            attempts: [],
            completedAttempts: [],
            activeAttempts: [],
            expiredIncompleteAttempts: [],
            canAttemptAgain: true,
            bestScore: 0,
            latestAttempt: null
          };
        }
        
        const attempt = {
          id: docSnap.id,
          ...attemptData
        };
        
        // Add to all attempts
        attempts[testId].attempts.push(attempt);
        
        // Categorize the attempt based on status
        const isCompleted = attemptData.status === 'submitted' || 
                           attemptData.status === 'auto_submitted' || 
                           (attemptData.submittedAt && getSeconds(attemptData.submittedAt) > 0);
        
        const isInProgress = attemptData.status === 'in_progress' || 
                            attemptData.status === 'active' || 
                            attemptData.status === 'paused' ||
                            attemptData.status === 'not_started';
        
        // Check if attempt timer has expired
        const hasTimeRemaining = attemptData.timeRemaining !== undefined && attemptData.timeRemaining > 0;
        
        // Also check if there are saved answers - indicator of work done
        const hasAnswers = attemptData.answers && Object.keys(attemptData.answers).length > 0;
        
        // Get test data from cache (already pre-fetched)
        // No need to await here anymore
        const testData = testCache[testId];
        let isTestDeadlinePassed = false;
        let isUntimed = false;
        
        if (testData) {
          isUntimed = testData.isUntimed === true;
          
          // Check test deadline
          if (testData.type === 'flexible' && testData.availableTo) {
            const deadlineSeconds = getSeconds(testData.availableTo);
            isTestDeadlinePassed = (now.getTime() / 1000) > deadlineSeconds;
          } else if (testData.type === 'live' && testData.actualEndTime) {
            const endTimeSeconds = getSeconds(testData.actualEndTime);
            isTestDeadlinePassed = (now.getTime() / 1000) > endTimeSeconds;
          }
        }
        
        if (isCompleted) {
          attempts[testId].completedAttempts.push(attempt);
          
          // Update best score only from completed attempts
          if (attemptData.score > attempts[testId].bestScore) {
            attempts[testId].bestScore = attemptData.score;
          }
          
          // Update latest completed attempt
          if (!attempts[testId].latestAttempt || 
              (attemptData.submittedAt && getSeconds(attemptData.submittedAt) > getSeconds(attempts[testId].latestAttempt.submittedAt))) {
            attempts[testId].latestAttempt = attemptData;
          }
        } else if (isInProgress || hasAnswers) {
          // For in-progress attempts, determine if they're active or expired
          
          // An attempt is "active" if:
          // 1. Test deadline has NOT passed AND
          // 2. Either it's untimed OR it has time remaining
          const isAttemptActive = !isTestDeadlinePassed && (isUntimed || hasTimeRemaining);
          
          // An attempt is "expired incomplete" if:
          // 1. It's in progress (not submitted) AND
          // 2. Either the test deadline passed OR time ran out (for timed tests)
          const isExpiredIncomplete = isTestDeadlinePassed || (!isUntimed && !hasTimeRemaining);
          
          if (isAttemptActive) {
            attempts[testId].activeAttempts.push(attempt);
          } else if (isExpiredIncomplete) {
            attempts[testId].expiredIncompleteAttempts.push(attempt);
          }
        }
      }
      
      setTestAttempts(attempts);
      console.log('✅ Loaded test attempts:', {
        totalTests: Object.keys(attempts).length,
        breakdown: Object.entries(attempts).map(([testId, data]: [string, any]) => ({
          testId,
          totalAttempts: data.attempts.length,
          completedAttempts: data.completedAttempts.length,
          activeAttempts: data.activeAttempts.length,
          expiredIncompleteAttempts: data.expiredIncompleteAttempts.length
        }))
      });
      return attempts;
    } catch (error) {
      console.error('Error loading test attempts:', error);
      return {};
    }
  };
  
  // Function to set up test listener using new hybrid query system
  const setupTestListener = async (classIds: string[]) => {
    try {
      // Import Firestore functions properly with await import
      const { collection, query, where, onSnapshot } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');
      
      console.log('🔄 Firestore initialized:', !!firestore);
      
      // Use the updated TestService method to get all student tests
      const loadAllTests = async () => {
        try {
          console.log('🔄 Loading tests using hybrid query system...');
          console.log('📝 Student ID:', student?.id);
          console.log('📝 Class IDs:', classIds);
          const allTests = await TestService.getStudentTests(student?.id || '', classIds);
          console.log('✅ Loaded tests via hybrid system:', allTests.length);
          console.log('📊 Test details:', allTests.map(test => ({
            id: test.id,
            title: test.title,
            assignmentType: test.assignmentType,
            classIds: test.classIds,
            subjectName: test.subjectName
          })));
          setTests(allTests);
          setLoading(false);
        } catch (error) {
          console.error('❌ Error loading tests via hybrid system:', error);
          setError('Failed to load tests. Please refresh the page.');
          setLoading(false);
        }
      };
      
      // Load initial tests
      await loadAllTests();
      
      // Set up interval to refresh tests periodically (since individual assignments don't have real-time listeners yet)
      const refreshInterval = setInterval(loadAllTests, 30000); // Refresh every 30 seconds
      
      // Return cleanup function
      return () => {
        clearInterval(refreshInterval);
      };
      
    } catch (error) {
      console.error('Error setting up test listener:', error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      setError('Failed to load tests. Please try again.');
      setLoading(false);
      return () => {}; // Return empty function if setup fails
    }
  };

  // Main function to load all student data
  const loadStudentData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // OPTIMIZATION: Start independent fetches immediately
      const attemptsPromise = loadTestAttempts();
      const approvalsPromise = loadLateSubmissionApprovals();
      
      // Enrollments are needed for the test listener, so await them first
      // But don't wait for attempts/approvals yet
      const enrollmentsData = await loadEnrollments();
      
      if (enrollmentsData.length === 0) {
        setLoading(false);
        return null; 
      }
      
      // Get class IDs from enrollments
      const classIds = enrollmentsData.map((enrollment: StudentEnrollment) => enrollment.classId);
      
      // Now start the test listener (main content) immediately
      // This is the most important data for the user to see
      const listenerPromise = setupTestListener(classIds);
      
      // Wait for everything to complete
      await Promise.all([attemptsPromise, approvalsPromise, listenerPromise]);
      
      return await listenerPromise; // Return the cleanup function from listener
    } catch (error) {
      console.error('Error loading student data:', error);
      setError('Failed to load data. Please refresh the page.');
      setLoading(false);
      return null;
    }
  };

  // Get unique subjects from enrollments
  const subjects = useMemo(() => {
    if (!enrollments || enrollments.length === 0) return [];
    
    const uniqueSubjects = Array.from(
      new Set(enrollments.map((enrollment) => enrollment.subject))
    );
    
    return uniqueSubjects.map((subject, index) => ({
      id: `subject-${index}`, 
      name: subject
    }));
  }, [enrollments]);

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

  // Get test status and related info
  const getTestStatus = (test: Test) => {
    const now = Date.now() / 1000; // Current time in seconds
    
    if (test.type === 'live') {
      const liveTest = test as LiveTest;
      
      // Handle different timestamp formats
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
        console.warn('⚠️ Unknown timestamp format in live test getSeconds:', timestamp);
        return 0;
      };
      
      const joinTimeSeconds = getSeconds(liveTest.studentJoinTime);
      const endTimeSeconds = getSeconds(liveTest.actualEndTime);
      
      if (now < joinTimeSeconds) {
        return { status: 'upcoming', color: 'blue', text: 'Upcoming' };
      } else if (now >= joinTimeSeconds && now <= endTimeSeconds) {
        return { status: 'live', color: 'green', text: 'Live Now' };
      } else {
        return { status: 'completed', color: 'gray', text: 'Completed' };
      }
    } else {
      const flexTest = test as FlexibleTest;
      
      // Handle different timestamp formats
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
        console.warn('⚠️ Unknown timestamp format in flexible test getSeconds:', timestamp);
        return 0;
      };
      
      const fromSeconds = getSeconds(flexTest.availableFrom);
      const toSeconds = getSeconds(flexTest.availableTo);
      
      // Check for late submission approval
      const lateSubmission = lateSubmissionApprovals[test.id];
      const hasLateSubmission = lateSubmission && lateSubmission.status === 'approved';
      
      if (now < fromSeconds) {
        return { status: 'upcoming', color: 'blue', text: 'Upcoming' };
      } else if (now >= fromSeconds && now <= toSeconds) {
        return { status: 'active', color: 'green', text: 'Available' };
      } else if (hasLateSubmission) {
        // Check if late submission deadline has passed
        const lateDeadlineSeconds = getSeconds(lateSubmission.newDeadline);
        if (now <= lateDeadlineSeconds) {
          return { status: 'late-active', color: 'orange', text: 'Late Submission Available' };
        } else {
          return { status: 'late-expired', color: 'red', text: 'Late Submission Expired' };
        }
      } else {
        return { status: 'completed', color: 'gray', text: 'Completed' };
      }
    }
  };

  // Handle start test
  const handleStartTest = (testId: string) => {
    router.push(`/student/test/${testId}`);
  };

  // Handle view results
  const handleViewResults = (testId: string) => {
    router.push(`/student/test/${testId}/result`);
  };

  // Check if student can attempt test again
  const canAttemptTest = (test: Test) => {
    const attempts = testAttempts[test.id];
    if (!attempts || attempts.attempts.length === 0) {
      return { canAttempt: true, reason: 'No attempts yet' };
    }

    // Use the categorized attempts from loadTestAttempts
    const completedAttempts = attempts.completedAttempts || [];
    const activeAttempts = attempts.activeAttempts || [];

    // If there's an active attempt, student can resume
    if (activeAttempts.length > 0) {
      return { canAttempt: true, reason: 'Resume incomplete attempt' };
    }

    // Check if test allows multiple attempts (flexible tests have attemptsAllowed)
    if (test.type === 'flexible') {
      const flexTest = test as FlexibleTest;
      const maxAttempts = flexTest.attemptsAllowed || 1;
      
      if (completedAttempts.length < maxAttempts) {
        return { canAttempt: true, reason: `${completedAttempts.length}/${maxAttempts} attempts used` };
      } else {
        return { 
          canAttempt: false, 
          reason: `Maximum attempts (${maxAttempts}) reached`
        };
      }
    }

    // For live tests, check if there are any completed attempts
    if (completedAttempts.length > 0) {
      return { 
        canAttempt: false, 
        reason: 'Test already completed'
      };
    }

    // If no completed attempts, allow attempt
    return { canAttempt: true, reason: 'Can start test' };
  };

  // Get test button configuration
  const getTestButton = (test: Test) => {
    const status = getTestStatus(test);
    const attemptInfo = canAttemptTest(test);
    const attempts = testAttempts[test.id];

    // Use the categorized attempts from loadTestAttempts
    const hasActiveAttempt = attempts && attempts.activeAttempts && attempts.activeAttempts.length > 0;
    const hasCompletedAttempt = attempts && attempts.completedAttempts && attempts.completedAttempts.length > 0;
    const hasExpiredIncompleteAttempt = attempts && attempts.expiredIncompleteAttempts && attempts.expiredIncompleteAttempts.length > 0;
    const expiredIncompleteAttempt = hasExpiredIncompleteAttempt ? attempts.expiredIncompleteAttempts[0] : null;
    const activeAttempt = hasActiveAttempt ? attempts.activeAttempts[0] : null;

    // Check if test is untimed
    const isUntimed = test.type === 'flexible' && (test as FlexibleTest).isUntimed === true;

    // PRIORITY 1: If there's an active attempt (in progress), show Resume
    // This takes highest priority when test is still available
    if (hasActiveAttempt && activeAttempt && (status.status === 'live' || status.status === 'active' || status.status === 'late-active')) {
      // For untimed tests, don't check timeRemaining - just show Resume
      // For timed tests, verify there's time left
      const timeRemaining = activeAttempt.timeRemaining;
      const hasTimeLeft = isUntimed || timeRemaining === undefined || timeRemaining > 0;
      
      console.log(`[Button Debug] Test: ${test.title} (${test.id})`, {
        hasActiveAttempt,
        status: status.status,
        isUntimed,
        timeRemaining,
        hasTimeLeft
      });

      if (hasTimeLeft) {
        return {
          text: 'Resume Test',
          action: () => handleStartTest(test.id),
          variant: 'primary' as const,
          icon: Play,
          disabled: false,
          hasActiveAttempt: true
        };
      }
    } else if (hasActiveAttempt) {
        console.log(`[Button Debug] Active attempt ignored for ${test.title}:`, {
            hasActiveAttempt,
            status: status.status,
            activeAttemptId: activeAttempt?.id
        });
    }

    // PRIORITY 2: Check if there's an expired incomplete attempt that needs attention
    if (hasExpiredIncompleteAttempt && expiredIncompleteAttempt) {
      // Check if deadline has passed for submission
      const canStillSubmit = status.status === 'active' || status.status === 'live' || status.status === 'late-active';
      
      if (canStillSubmit) {
        return {
          text: 'Complete Submission',
          action: () => router.push(`/student/test/${test.id}/review-expired?attemptId=${expiredIncompleteAttempt.id}`),
          variant: 'warning' as const,
          icon: AlertCircle,
          disabled: false,
          hasExpiredIncomplete: true,
          expiredAttemptId: expiredIncompleteAttempt.id
        };
      } else {
        // Deadline passed - show contact teacher
        return {
          text: 'Incomplete - Contact Teacher',
          action: () => router.push(`/student/test/${test.id}`),
          variant: 'outline' as const,
          icon: AlertCircle,
          disabled: false,
          hasExpiredIncomplete: true,
          expiredAttemptId: expiredIncompleteAttempt.id
        };
      }
    }

    // PRIORITY 3: For completed tests, always show view results if there are completed attempts
    if (status.status === 'completed') {
      if (hasCompletedAttempt) {
        return {
          text: 'View Results',
          action: () => handleViewResults(test.id),
          variant: 'outline' as const,
          icon: ArrowRight,
          disabled: false
        };
      } else {
        return {
          text: 'Test Ended',
          action: () => {},
          variant: 'outline' as const,
          icon: CheckCircle,
          disabled: true
        };
      }
    }

    // PRIORITY 4: For live or available tests (including late submissions)
    if (status.status === 'live' || status.status === 'active' || status.status === 'late-active') {
      if (attemptInfo.canAttempt) {
        // If there's an active attempt (fallback check), show resume
        if (hasActiveAttempt) {
          return {
            text: 'Resume Test',
            action: () => handleStartTest(test.id),
            variant: 'primary' as const,
            icon: Play,
            disabled: false,
            hasActiveAttempt: true
          };
        }
        
        // If can attempt but has completed attempts, show start new attempt
        if (hasCompletedAttempt) {
          return {
            text: status.status === 'late-active' ? 'Start Late Submission' : 'Start New Attempt',
            action: () => handleStartTest(test.id),
            variant: status.status === 'late-active' ? 'warning' as const : 'primary' as const,
            icon: Play,
            disabled: false
          };
        }
        
        // First attempt
        let buttonText = 'Start Test';
        let variant: 'primary' | 'warning' = 'primary';
        
        if (status.status === 'live') {
          buttonText = 'Join Now';
        } else if (status.status === 'late-active') {
          buttonText = 'Start Late Submission';
          variant = 'warning';
        }
        
        return {
          text: buttonText,
          action: () => handleStartTest(test.id),
          variant,
          icon: Play,
          disabled: false
        };
      } else {
        // Can't attempt - max attempts reached, show view results
        return {
          text: 'View Results',
          action: () => handleViewResults(test.id),
          variant: 'outline' as const,
          icon: ArrowRight,
          disabled: false
        };
      }
    }

    // PRIORITY 5: For late submission expired
    if (status.status === 'late-expired') {
      if (hasCompletedAttempt) {
        return {
          text: 'View Results',
          action: () => handleViewResults(test.id),
          variant: 'outline' as const,
          icon: ArrowRight,
          disabled: false
        };
      } else {
        return {
          text: 'Late Submission Expired',
          action: () => {},
          variant: 'outline' as const,
          icon: AlertCircle,
          disabled: true
        };
      }
    }

    // For upcoming tests
    return {
      text: 'Upcoming',
      action: () => {},
      variant: 'outline' as const,
      icon: Clock,
      disabled: true
    };
  };

  // Check if test has been extended and format extension info
  const getExtensionInfo = (test: Test) => {
    if (test.type !== 'flexible') return null;
    
    const flexTest = test as FlexibleTest;
    if (!flexTest.isExtended) return null;
    
    return TestExtensionService.formatExtensionInfo(flexTest);
  };

  // Get late submission info for a test
  const getLateSubmissionInfo = (test: Test) => {
    const lateSubmission = lateSubmissionApprovals[test.id];
    if (!lateSubmission || lateSubmission.status !== 'approved') return null;

    const now = new Date();
    let newDeadline: Date;
    
    // Handle different timestamp formats
    if (lateSubmission.newDeadline && typeof lateSubmission.newDeadline.toDate === 'function') {
      newDeadline = lateSubmission.newDeadline.toDate();
    } else if (lateSubmission.newDeadline && typeof lateSubmission.newDeadline.seconds === 'number') {
      newDeadline = new Date(lateSubmission.newDeadline.seconds * 1000);
    } else if (lateSubmission.newDeadline instanceof Date) {
      newDeadline = lateSubmission.newDeadline;
    } else if (typeof lateSubmission.newDeadline === 'string') {
      newDeadline = new Date(lateSubmission.newDeadline);
    } else {
      console.warn('Invalid late submission deadline format:', lateSubmission.newDeadline);
      return null;
    }

    const isExpired = now > newDeadline;
    const timeRemaining = calculateTimeRemaining(lateSubmission.newDeadline);

    return {
      ...lateSubmission,
      newDeadline,
      isExpired,
      timeRemaining,
      formattedDeadline: newDeadline.toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  // Render late submission badge
  const renderLateSubmissionBadge = (test: Test) => {
    const lateSubmissionInfo = getLateSubmissionInfo(test);
    if (!lateSubmissionInfo) return null;

    const isExpired = lateSubmissionInfo.isExpired;
    const bgColor = isExpired ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    const text = isExpired ? 'Late Submission Expired' : 'Late Submission Available';

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
        <Clock className="h-3 w-3 mr-1" />
        {text}
      </span>
    );
  };

  // Render late submission details
  const renderLateSubmissionDetails = (test: Test) => {
    const lateSubmissionInfo = getLateSubmissionInfo(test);
    if (!lateSubmissionInfo) return null;

    return (
      <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-orange-800 dark:text-orange-300">
              Late Submission Approved
            </p>
            <p className="text-orange-700 dark:text-orange-400 mt-1">
              New deadline: {lateSubmissionInfo.formattedDeadline}
            </p>
            {!lateSubmissionInfo.isExpired && (
              <p className="text-orange-600 dark:text-orange-500 mt-1">
                Time remaining: {lateSubmissionInfo.timeRemaining}
              </p>
            )}
            {lateSubmissionInfo.reason && (
              <p className="text-orange-600 dark:text-orange-500 mt-1 text-xs">
                Reason: {lateSubmissionInfo.reason}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Get active attempt information including time remaining
  const getActiveAttemptInfo = (test: Test) => {
    const attempts = testAttempts[test.id];
    if (!attempts || !attempts.activeAttempts || attempts.activeAttempts.length === 0) {
      return null;
    }

    // Get the most recent active attempt
    const activeAttempt = attempts.activeAttempts[0];
    
    // Format time remaining from seconds to human-readable
    const formatTimeRemaining = (seconds: number): string => {
      if (seconds <= 0) return "Time expired";
      
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s remaining`;
      } else {
        return `${secs}s remaining`;
      }
    };

    // Get time remaining - could be from attempt or need to calculate based on deadline
    let timeRemaining = activeAttempt.timeRemaining || 0;
    
    // For flexible tests, also check deadline
    if (test.type === 'flexible') {
      const flexTest = test as FlexibleTest;
      const now = Date.now() / 1000; // Current time in seconds
      
      const getSeconds = (timestamp: any): number => {
        if (timestamp && typeof timestamp.seconds === 'number') {
          return timestamp.seconds;
        } else if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().getTime() / 1000;
        } else if (timestamp instanceof Date) {
          return timestamp.getTime() / 1000;
        } else if (typeof timestamp === 'string') {
          return new Date(timestamp).getTime() / 1000;
        }
        return 0;
      };
      
      const deadlineSeconds = getSeconds(flexTest.availableTo);
      const timeUntilDeadline = Math.max(0, deadlineSeconds - now);
      
      // Use whichever is less: timer or deadline
      if (timeUntilDeadline > 0 && timeUntilDeadline < timeRemaining) {
        timeRemaining = timeUntilDeadline;
      }
    }

    return {
      attemptId: activeAttempt.id,
      timeRemaining: Math.floor(timeRemaining),
      formattedTime: formatTimeRemaining(Math.floor(timeRemaining)),
      status: activeAttempt.status,
      startedAt: activeAttempt.startedAt,
      lastActiveAt: activeAttempt.lastActiveAt
    };
  };

  // Calculate time remaining until deadline for flexible tests
  const calculateTimeUntilDeadline = (test: FlexibleTest): string => {
    try {
      const now = new Date();
      let deadline: Date;
      
      // Handle different timestamp formats
      if (test.availableTo && typeof test.availableTo.toDate === 'function') {
        deadline = test.availableTo.toDate();
      } else if (test.availableTo && typeof test.availableTo.seconds === 'number') {
        deadline = new Date(test.availableTo.seconds * 1000);
      } else if (test.availableTo instanceof Date) {
        deadline = test.availableTo;
      } else if (typeof test.availableTo === 'string') {
        deadline = new Date(test.availableTo);
      } else {
        console.warn('Invalid deadline format for flexible test:', test.availableTo);
        return "Unknown time";
      }
      
      const diffMs = deadline.getTime() - now.getTime();
      
      if (diffMs <= 0) return "Deadline passed";
      
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffDays > 0) {
        return `${diffDays}d ${diffHrs}h remaining`;
      } else if (diffHrs > 0) {
        return `${diffHrs}h ${diffMins}m remaining`;
      } else {
        return `${diffMins}m remaining`;
      }
    } catch (error) {
      console.error('Error calculating time until deadline:', error);
      return "Unknown time";
    }
  };

  // Filter tests based on subject and search term
  const filteredTests = useMemo(() => {
    if (!tests) return [];
    
    return tests.filter(test => {
      // TestService.getStudentTests() already filters for correct test assignments
      // We only need to filter by subject and search term here
      
      let matchesSubject = selectedSubjectId === 'all';
      
      if (!matchesSubject) {
        // For class-based tests, check classIds
        if (test.classIds && test.classIds.length > 0) {
          matchesSubject = test.classIds.some(classId => {
            const enrollment = enrollments.find(e => e.classId === classId);
            if (!enrollment) return false;
            
            // Find subject ID from the enrollment
            const subjectName = enrollment.subject;
            const subject = subjects.find(s => s.name === subjectName);
            
            return subject?.id === selectedSubjectId;
          });
        } else {
          // For student-based tests (empty classIds), check by subject in test data
          // If test has subjectName, match it directly
          if (test.subjectName) {
            const subject = subjects.find(s => s.name === test.subjectName);
            matchesSubject = subject?.id === selectedSubjectId;
          } else {
            // If no subject info, show in 'all' but not in specific subjects
            matchesSubject = false;
          }
        }
      }
      
      const matchesSearch = 
        test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        false;
      
      return matchesSubject && (searchTerm ? matchesSearch : true);
    });
  }, [tests, enrollments, selectedSubjectId, searchTerm, subjects]);

  // Separate custom tests from class tests
  const { customTests, classBasedTests } = useMemo(() => {
    const custom: Test[] = [];
    const classBased: Test[] = [];
    
    filteredTests.forEach(test => {
      const isCustomTest = test.assignmentType === 'student-based';
      if (isCustomTest) {
        custom.push(test);
      } else {
        classBased.push(test);
      }
    });
    
    return { customTests: custom, classBasedTests: classBased };
  }, [filteredTests]);

  // Group custom tests by status
  const groupedCustomTests = useMemo(() => {
    const grouped = {
      live: [] as Test[],
      upcoming: [] as Test[],
      available: [] as Test[],
      completed: [] as Test[],
    };
    
    customTests.forEach(test => {
      const status = getTestStatus(test);
      
      if (status.status === 'live') {
        grouped.live.push(test);
      } else if (status.status === 'upcoming') {
        grouped.upcoming.push(test);
      } else if (status.status === 'active' || status.status === 'late-active') {
        grouped.available.push(test);
      } else {
        grouped.completed.push(test);
      }
    });

    // Sort available tests
    grouped.available.sort((a, b) => {
      const statusA = getTestStatus(a);
      const statusB = getTestStatus(b);

      // 1. Priority: Late-Active tests first
      if (statusA.status === 'late-active' && statusB.status !== 'late-active') return -1;
      if (statusA.status !== 'late-active' && statusB.status === 'late-active') return 1;

      // 2. Sort by Date
      const getTimestamp = (test: Test) => {
         if (test.type === 'live') return (test as LiveTest).studentJoinTime;
         return (test as FlexibleTest).availableFrom;
      };

      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);

      const getSeconds = (timestamp: any): number => {
          if (timestamp && typeof timestamp.seconds === 'number') return timestamp.seconds;
          if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate().getTime() / 1000;
          if (timestamp instanceof Date) return timestamp.getTime() / 1000;
          if (typeof timestamp === 'string') return new Date(timestamp).getTime() / 1000;
          return 0;
      };

      const secondsA = getSeconds(timeA);
      const secondsB = getSeconds(timeB);

      return sortOrder === 'latest' ? secondsB - secondsA : secondsA - secondsB;
    });
    
    return grouped;
  }, [customTests, sortOrder, lateSubmissionApprovals]);

  // Group tests by class (only class-based tests now)
  const testsByClass = useMemo(() => {
    const grouped: Record<string, {
      enrollment: StudentEnrollment;
      tests: Test[];
      groupedTests: {
        upcoming: Test[];
        live: Test[];
        available: Test[];
        completed: Test[];
      };
    }> = {};

    // Initialize with all enrollments
    enrollments.forEach(enrollment => {
      if (!grouped[enrollment.classId]) {
        grouped[enrollment.classId] = {
          enrollment,
          tests: [],
          groupedTests: {
            upcoming: [],
            live: [],
            available: [],
            completed: []
          }
        };
      }
    });

    // Add only class-based tests to their respective classes
    classBasedTests.forEach(test => {
      test.classIds.forEach(classId => {
        if (grouped[classId]) {
          grouped[classId].tests.push(test);
          
          // Group by status
          const status = getTestStatus(test);
          if (status.status === 'live') {
            grouped[classId].groupedTests.live.push(test);
          } else if (status.status === 'upcoming') {
            grouped[classId].groupedTests.upcoming.push(test);
          } else if (status.status === 'active' || status.status === 'late-active') {
            grouped[classId].groupedTests.available.push(test);
          } else {
            grouped[classId].groupedTests.completed.push(test);
          }
        }
      });
    });

    // Helper to get seconds
    const getSeconds = (timestamp: any): number => {
        if (timestamp && typeof timestamp.seconds === 'number') return timestamp.seconds;
        if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate().getTime() / 1000;
        if (timestamp instanceof Date) return timestamp.getTime() / 1000;
        if (typeof timestamp === 'string') return new Date(timestamp).getTime() / 1000;
        return 0;
    };

    // Sort tests within groups
    Object.values(grouped).forEach(classData => {
      // Sort upcoming tests by date (soonest first)
      classData.groupedTests.upcoming.sort((a, b) => {
        const getTimestamp = (test: Test) => {
          if (test.type === 'live') return (test as LiveTest).studentJoinTime;
          return (test as FlexibleTest).availableFrom;
        };
        const aTime = getTimestamp(a);
        const bTime = getTimestamp(b);
        return getSeconds(aTime) - getSeconds(bTime);
      });

       // Sort available tests
       classData.groupedTests.available.sort((a, b) => {
        const statusA = getTestStatus(a);
        const statusB = getTestStatus(b);
  
        // 1. Priority: Late-Active tests first
        if (statusA.status === 'late-active' && statusB.status !== 'late-active') return -1;
        if (statusA.status !== 'late-active' && statusB.status === 'late-active') return 1;
  
        // 2. Sort by Date
        const getTimestamp = (test: Test) => {
           if (test.type === 'live') return (test as LiveTest).studentJoinTime;
           return (test as FlexibleTest).availableFrom;
        };
  
        const timeA = getTimestamp(a);
        const timeB = getTimestamp(b);
  
        const secondsA = getSeconds(timeA);
        const secondsB = getSeconds(timeB);
  
        return sortOrder === 'latest' ? secondsB - secondsA : secondsA - secondsB;
      });

       // Sort completed tests
       classData.groupedTests.completed.sort((a, b) => {
        const getTimestamp = (test: Test) => {
           if (test.type === 'live') return (test as LiveTest).studentJoinTime;
           return (test as FlexibleTest).availableFrom;
        };
  
        const timeA = getTimestamp(a);
        const timeB = getTimestamp(b);
  
        const secondsA = getSeconds(timeA);
        const secondsB = getSeconds(timeB);
  
        return sortOrder === 'latest' ? secondsB - secondsA : secondsA - secondsB;
      });
    });

    return grouped;
  }, [classBasedTests, enrollments, sortOrder, lateSubmissionApprovals]);

  // Toggle custom tests expansion
  const toggleCustomTests = () => {
    setExpandedCustomTests(prev => !prev);
  };

  // Toggle class expansion
  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(classId)) {
        newSet.delete(classId);
      } else {
        newSet.add(classId);
      }
      return newSet;
    });
  };

  // Toggle completed tests section expansion
  const toggleCompletedSection = (classId: string) => {
    setExpandedCompletedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(classId)) {
        newSet.delete(classId);
      } else {
        newSet.add(classId);
      }
      return newSet;
    });
  };

  // Group tests by status
  const groupedTests = useMemo(() => {
    const grouped = {
      live: [] as Test[],
      upcoming: [] as Test[],
      available: [] as Test[],
      completed: [] as Test[],
    };
    
    filteredTests.forEach(test => {
      const status = getTestStatus(test);
      
      if (status.status === 'live') {
        grouped.live.push(test);
      } else if (status.status === 'upcoming') {
        grouped.upcoming.push(test);
      } else if (status.status === 'active') {
        grouped.available.push(test);
      } else {
        grouped.completed.push(test);
      }
    });
    
    return grouped;
  }, [filteredTests]);

  // No enrollments message
  if (!authLoading && !loading && (!enrollments || enrollments.length === 0)) {
    return (
      <StudentLayout>
        <div
          className={`min-h-screen p-6 ${theme === 'default' ? 'bg-gradient-to-br from-white via-gray-50 to-black' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'cricketverse' ? 'bg-gradient-to-br from-blue-400 to-indigo-600' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] to-[#4F2C8D]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-br from-blue-400 to-indigo-600'}`}
          style={
            theme === 'ben10'
              ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' }
              : theme === 'cricketverse'
              ? { background: 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))' }
              : theme === 'cricketverse-australian'
              ? { background: '#ffff2a' }
              : undefined
          }
        >
        {/* Tests Header */}
        <div 
          className={`rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-8 mb-6 relative overflow-hidden ${theme !== 'cricketverse-australian' ? `bg-gradient-to-r ${theme === 'default' ? 'from-black via-gray-800 to-white' : theme === 'ben10' ? 'from-[#64cc4f] via-black to-[#64cc4f]' : theme === 'tinkerbell' ? 'from-pink-500 via-pink-600 to-purple-700' : theme === 'cricketverse' ? 'from-blue-500 to-indigo-600' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-blue-500 to-indigo-600'}` : ''}`}
          style={theme === 'cricketverse-australian' ? { background: 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)' } : undefined}
        >
            <div className="flex items-center space-x-4 relative z-10">
              {theme === 'cricketverse-australian' ? (
                <img src="/cricketverse/australian/australian-cricket.gif" alt="Australian Cricket" className="w-24 h-24 object-contain" />
              ) : theme === 'cricketverse' ? (
                <img src="/batman3.png" alt="Batman" className="w-24 h-24 object-contain" />
              ) : theme === 'ponyville' ? (
                <img src="/ponyville/sweetybelle.png" alt="Sweetybelle" className="w-24 h-24 object-contain" />
              ) : theme === 'avengers' ? (
                <img src="/avengers/wonder-women.png" alt="Wonder Woman" className="w-24 h-24 object-contain" />
              ) : theme === 'ben10' || theme === 'tinkerbell' ? (
                <div className="text-6xl">📝</div>
              ) : null}
              <div>
                <h1 className={`text-4xl font-black mb-2 flex items-center ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                  <span>My</span>
                  <span className={`ml-2 font-black text-5xl ${theme === 'cricketverse-australian' ? 'text-black' : theme === 'default' ? 'text-white' : theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-pink-200' : theme === 'cricketverse' ? 'text-white' : theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : 'text-blue-200'}`}>Tests</span>
                </h1>
                <p className={`font-bold text-lg ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                  {theme === 'cricketverse-australian' ? 'Challenge yourself with epic tests and grow!' : theme === 'ponyville' ? 'Challenge yourself with magical tests and grow! ✨' : 'Challenge yourself with epic tests and grow!'}
                </p>
              </div>
            </div>
          </div>
          {/* No Tests Message */}
          <div 
            className={`rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'ponyville' ? 'border-black' : 'border-black'} p-12 text-center`}
            style={theme === 'cricketverse-australian' ? { background: 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)' } : undefined}
          >
            <div className={theme !== 'cricketverse-australian' ? `${theme === 'default' ? 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] via-black to-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-green-300 via-black to-green-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-white via-[#1D428A]/20 to-white border-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] via-[#2C1267] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-300 via-indigo-500 to-blue-300'}` : ''}>
            {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville' || theme === 'avengers' || theme === 'cricketverse-australian') && <div className="text-8xl mb-6">{theme === 'cricketverse-australian' ? '📚' : theme === 'ponyville' ? '🦄' : theme === 'avengers' ? '⚡' : '📚'}</div>}
            <h2 className={`text-3xl font-black mb-4 ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
              {theme === 'cricketverse-australian' ? 'No Tests Yet' : theme === 'ponyville' ? 'No Magical Tests Yet' : theme === 'avengers' ? 'No Missions Yet' : 'No Tests Yet'}
            </h2>
            <p className={`font-bold text-lg mb-6 ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
              {theme === 'cricketverse-australian' ? "You haven't enrolled in any classes yet. Contact your teacher to start taking tests!" : theme === 'ponyville' ? "You haven't enrolled in any magical classes yet. Contact your magical teacher to start taking tests! ✨📚" : theme === 'avengers' ? "You haven't enrolled in any classes yet. Assemble with your teacher to start taking missions!" : "You haven't enrolled in any classes yet. Contact your teacher to start taking tests!"}
            </p>
            <Button
              onClick={() => router.push('/student/dashboard')}
              className={`px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} flex items-center space-x-3 ${theme === 'cricketverse-australian' ? 'bg-black text-white hover:bg-gray-800' : theme === 'default' ? 'bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222] text-white' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A] text-white' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826] text-white' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f] text-white' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'}`}
            >
              <BookOpen className="w-5 h-5" />
              <span>{theme === 'ponyville' ? 'Return to Magical Dashboard' : 'Return to Dashboard'}</span>
            </Button>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <StudentLayout>
        <div
          className={`min-h-screen p-6 flex items-center justify-center ${theme === 'default' ? 'bg-gradient-to-br from-white to-gray-100' : theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#b9a2ef] to-[#c9b0f6]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-br from-blue-400 to-indigo-600'}`}
          style={
            theme === 'cricketverse-australian'
              ? { background: 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)' }
              : theme === 'cricketverse'
              ? { background: 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))' }
              : undefined
          }
        >
          <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-3xl p-8 shadow-2xl`}>
            {/* Theme-Specific Loading Animation */}
            <div className="relative mb-6 flex flex-col items-center">
              {/* Tinkerbell Loading GIF */}
              {theme === 'tinkerbell' && (
                <div className="flex flex-col items-center">
                  <img 
                    src="/tinkerbell-loading.gif" 
                    alt="Tinkerbell Loading" 
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-2xl font-bold text-yellow-600 mt-4">Loading</span>
                </div>
              )}
              
              {/* Ben 10 Loading GIF */}
              {theme === 'ben10' && (
                <div className="flex flex-col items-center">
                  <img 
                    src="/ben10-loading.gif" 
                    alt="Ben 10 Loading" 
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-2xl font-bold text-[#b2e05b] mt-4">Loading</span>
                </div>
              )}

              {/* BounceWorld Loading Animation */}
              {theme === 'bounceworld' && (
                <div className="flex flex-col items-center">
                  <img
                    src="/bounceworld.gif"
                    alt="BounceWorld Loading"
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading</span>
                </div>
              )}
              
              {/* Avengers Loading Animation */}
              {theme === 'avengers' && (
                <div className="flex flex-col items-center">
                  <img
                    src="/avenger.gif"
                    alt="Avengers Loading"
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-2xl font-bold text-[#2C1267] mt-4">Assembling</span>
                </div>
              )}

              {/* Ponyville Loading Animation */}
              {theme === 'ponyville' && (
                <div className="flex flex-col items-center">
                  <img
                    src="/ponyville-loading.gif"
                    alt="Ponyville Loading"
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-2xl font-bold text-[#e13690] mt-4">Casting Magic</span>
                </div>
              )}
              
              {/* Australian CricketVerse Loading GIF */}
              {theme === 'cricketverse-australian' && (
                <div className="flex flex-col items-center">
                  <img
                    src="/cricketverse-australian.gif"
                    alt="Australian CricketVerse Loading"
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-2xl font-bold text-[#fff800] mt-4">Loading</span>
                </div>
              )}

              {/* CricketVerse Loading GIF */}
              {theme === 'cricketverse' && (
                <div className="flex flex-col items-center">
                  <img
                    src="/batsman.gif"
                    alt="CricketVerse Loading"
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-2xl font-bold text-black mt-4">Loading</span>
                </div>
              )}
              
              {/* Default Theme Spinner with Loading Text */}
              {(theme === 'default' || (theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'ponyville' && theme !== 'cricketverse' && theme !== 'cricketverse-australian')) && (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 border-4 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
                  <span className="text-2xl font-bold text-gray-800 mt-4">Loading</span>
                </div>
              )}
            </div>
            <div className="text-center">
              <h2 className={`text-2xl font-black mb-2 ${theme === 'cricketverse' ? 'text-black' : 'text-black'}`}>
                {theme === 'cricketverse-australian' ? 'Loading Tests...' : theme === 'cricketverse' ? 'Loading Your Cricket Tests...' : theme === 'ponyville' ? 'Summoning Magical Tests...' : 'Loading Tests...'}
              </h2>
              <p className={`font-medium ${theme === 'cricketverse' ? 'text-black' : 'text-gray-600'}`}>
                {theme === 'cricketverse-australian' ? 'Getting your tests ready!' : theme === 'cricketverse' ? 'Preparing your cricket challenges! 🏏' : theme === 'ponyville' ? 'Getting your magical challenges ready! 📚✨' : 'Getting your tests ready!'}
              </p>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div
        className={`min-h-screen p-6 ${theme === 'default' ? 'bg-gradient-to-br from-white via-gray-50 to-black' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-300' : theme === 'cricketverse' ? 'bg-gradient-to-br from-blue-400 via-indigo-500 to-blue-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/10 to-[#C8102E]/10' : theme === 'avengers' ? 'bg-gradient-to-br from-[#9d7aef] to-[#b796ef]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-blue-400'}`}
        style={
          theme === 'ben10'
            ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' }
            : theme === 'cricketverse'
            ? { background: 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))' }
            : theme === 'cricketverse-australian'
            ? { background: 'linear-gradient(to bottom right, rgb(255, 255, 42) 0%, rgb(255, 255, 42) 40%, rgb(134, 250, 92) 60%, rgb(255, 255, 42) 100%)' }
            : undefined
        }
      >
        {/* Tests Header */}
        <div 
          className={`rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-8 mb-6 relative overflow-hidden ${theme !== 'cricketverse-australian' ? `${theme === 'default' ? 'bg-gradient-to-r from-black via-gray-800 to-white' : theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#397d3d]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-500 via-green-500 to-yellow-500' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] via-[#865bea] to-[#9376f3]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500'}` : ''}`}
          style={theme === 'cricketverse-australian' ? { background: 'white' } : undefined}
        >
         <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              {theme === 'cricketverse-australian' ? (
                <img src="/australian/batman4.png" alt="Australian Cricket" className="w-24 h-24 object-contain" />
              ) : theme === 'cricketverse' ? (
                <img src="/indian/batman2.png" alt="Indian Cricket" className="w-24 h-24 object-contain" />
              ) : theme === 'ponyville' ? (
                <img src="/ponyville/sweetybelle.png" alt="Sweetybelle" className="w-24 h-24 object-contain" />
              ) : theme === 'avengers' ? (
                <img src="/avengers/wonder-women.png" alt="Wonder Woman" className="w-24 h-24 object-contain" />
              ) : (theme === 'ben10' || theme === 'tinkerbell') ? (
                <div className="text-6xl">📝</div>
              ) : null}
              <div>
                <h1 className={`text-5xl font-black mb-2 flex items-center ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                  <span>My</span>
                  <span className={`ml-2 font-black text-5xl ${theme === 'cricketverse-australian' ? 'text-black' : theme === 'default' ? 'text-white' : theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-pink-200' : theme === 'cricketverse' ? 'text-white' : theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : 'text-blue-200'}`}>Tests</span>
                </h1>
                <p className={`font-bold text-lg ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                  {theme === 'cricketverse-australian' ? 'Challenge yourself with epic tests and grow!' : theme === 'ponyville' ? 'Challenge yourself with magical tests and grow! ✨📚' : theme === 'avengers' ? 'Assemble for epic missions and grow! ⚡' : 'Challenge yourself with epic tests and grow!'}
                </p>
              </div>
            </div>
            <div className={`${theme === 'avengers' ? 'bg-transparent' : 'bg-white'} border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl p-4 shadow-lg`}>
              <div className="flex items-center space-x-3">
                {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville' || theme === 'cricketverse-australian') && <div className="text-4xl">{theme === 'cricketverse-australian' ? '🏏' : theme === 'ponyville' ? '📚' : '📚'}</div>}
                <div className="text-center">
                  <div className="text-3xl font-black text-black">{enrollments?.length || 0}</div>
                  <div className="text-sm font-bold text-gray-700">{theme === 'ponyville' ? 'Magical Classes' : 'Classes'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div 
            className={`rounded-xl border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-4 shadow-lg`}
            style={theme === 'cricketverse-australian' ? { background: '#fff800' } : undefined}
          >
            <div className={theme !== 'cricketverse-australian' ? `bg-gradient-to-r ${theme === 'default' ? 'from-red-400 to-red-500' : theme === 'ben10' ? 'from-red-400 to-red-600' : theme === 'tinkerbell' ? 'from-red-300 to-pink-300' : theme === 'cricketverse' ? 'from-red-400 to-red-500' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690]' : 'from-red-400 to-red-500'}` : ''}>
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{theme === 'ponyville' ? '📝' : '⚠️'}</div>
              <div>
                <p className={`font-bold text-lg ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                  {theme === 'ponyville' ? 'Magical Error Occurred!' : 'Error: Something went wrong!'}
                </p>
                <p className={`font-medium ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>{error}</p>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Search Controls */}
        <div 
          className={`rounded-2xl shadow-xl border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 mb-6 ${theme !== 'cricketverse-australian' ? `${theme === 'default' ? 'bg-gradient-to-r from-gray-100 to-gray-200' : theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 via-green-400 to-yellow-300' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-300 via-indigo-400 to-blue-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/20 via-[#2C1267]/20 to-[#0F0826]/20 border-[#2C1267]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20 border-[#e13690]' : 'bg-gradient-to-r from-blue-300 via-indigo-400 to-blue-300'}` : ''}`}
          style={theme === 'cricketverse-australian' ? { background: '#fff800' } : undefined}
        >
          <div className="flex items-center space-x-3 mb-4">
            {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-3xl">{theme === 'ponyville' ? '🔍' : '🔍'}</div>}
            <h2 className={`text-2xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>{theme === 'ponyville' ? 'Search Magical Tests' : 'Search Tests'}</h2> 
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">{theme === 'ponyville' ? '🔍' : '🔍'}</div>}
                <Input
                  type="text"
                  placeholder={theme === 'ponyville' ? "Search for magical tests..." : "Search for tests..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-12 pr-4 py-3 text-lg border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl bg-white text-black placeholder-gray-500 focus:outline-none shadow-lg ${theme === 'ben10' ? 'focus:ring-4 focus:ring-[#64cc4f]' : theme === 'tinkerbell' ? 'focus:ring-4 focus:ring-yellow-400' : theme === 'bounceworld' ? 'focus:ring-4 focus:ring-[#C8102E]' : theme === 'avengers' ? 'focus:ring-4 focus:ring-[#604AC7]' : theme === 'ponyville' ? 'focus:ring-4 focus:ring-[#e13690]' : theme === 'default' ? 'focus:ring-4 focus:ring-gray-600' : 'focus:ring-4 focus:ring-blue-400'}`}
                />
              </div>
            </div>

            {/* Subject Filter */}
            <div className="flex-shrink-0 min-w-[200px]">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className={`border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl px-6 py-3 bg-white text-black font-bold text-lg focus:outline-none shadow-lg hover:bg-gray-50 transition-all w-full ${theme === 'cricketverse-australian' ? 'focus:ring-4 focus:ring-black' : theme === 'ben10' ? 'focus:ring-4 focus:ring-[#64cc4f]' : theme === 'tinkerbell' ? 'focus:ring-4 focus:ring-yellow-400' : theme === 'bounceworld' ? 'focus:ring-4 focus:ring-[#1D428A]' : theme === 'avengers' ? 'focus:ring-4 focus:ring-[#604AC7]' : theme === 'ponyville' ? 'focus:ring-4 focus:ring-[#e13690]' : theme === 'default' ? 'focus:ring-4 focus:ring-gray-600' : 'focus:ring-4 focus:ring-blue-400'}`}
              >
                <option value="all">{theme === 'ponyville' ? 'All Magical Subjects' : 'All Subjects'}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                     {subject.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div className="flex-shrink-0 min-w-[150px]">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'latest' | 'oldest')}
                className={`border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl px-6 py-3 bg-white text-black font-bold text-lg focus:outline-none shadow-lg hover:bg-gray-50 transition-all w-full ${theme === 'cricketverse-australian' ? 'focus:ring-4 focus:ring-black' : theme === 'ben10' ? 'focus:ring-4 focus:ring-[#64cc4f]' : theme === 'tinkerbell' ? 'focus:ring-4 focus:ring-yellow-400' : theme === 'bounceworld' ? 'focus:ring-4 focus:ring-[#1D428A]' : theme === 'avengers' ? 'focus:ring-4 focus:ring-[#604AC7]' : theme === 'ponyville' ? 'focus:ring-4 focus:ring-[#e13690]' : theme === 'default' ? 'focus:ring-4 focus:ring-gray-600' : 'focus:ring-4 focus:ring-blue-400'}`}
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Test Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
            <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all`}>
              {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-4xl mb-2">{theme === 'ponyville' ? '📚' : '📚'}</div>}
              <div className="text-3xl font-black text-black mb-1">
                {Object.keys(testsByClass).length}
              </div>
              <div className="text-sm font-bold text-black">{theme === 'ponyville' ? 'Magical Classes' : 'Classes'}</div>
            </div>
            <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all`}>
              {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-4xl mb-2">{theme === 'ponyville' ? '⏳' : '🎯'}</div>}
              <div className="text-3xl font-black text-black mb-1">
                {Object.values(testsByClass).reduce((acc, classData) => acc + classData.groupedTests.live.length, 0) + groupedCustomTests.live.length}
              </div>
              <div className="text-sm font-bold text-black">{theme === 'ponyville' ? 'Live Quests' : 'Live Missions'}</div>
            </div>
            <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all`}>
              {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-4xl mb-2">{theme === 'ponyville' ? '⏰' : '⏰'}</div>}
              <div className="text-3xl font-black text-black mb-1">
                {Object.values(testsByClass).reduce((acc, classData) => acc + classData.groupedTests.upcoming.length, 0) + groupedCustomTests.upcoming.length}
              </div>
              <div className="text-sm font-bold text-black">{theme === 'ponyville' ? 'Future Adventures' : 'Upcoming Quests'}</div>
            </div>
            <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all`}>
              {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-4xl mb-2">{theme === 'ponyville' ? '✅' : '📝'}</div>}
              <div className="text-3xl font-black text-black mb-1">
                {filteredTests.length}
              </div>
              <div className="text-sm font-bold text-black">{theme === 'ponyville' ? 'Magical Tests' : 'Total Tests'}</div>
            </div>
          </div>
        </div>

        {/* Custom Tests Section */}
        {customTests.length > 0 && (
          <div 
            className={`rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} overflow-hidden`}
            style={theme === 'cricketverse-australian' ? { background: '#fff800' } : undefined}
          >
            <div className={theme !== 'cricketverse-australian' ? `${theme === 'default' ? 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] via-black to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 via-green-400 to-yellow-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/20 via-[#2C1267]/20 to-[#0F0826]/20 border-[#2C1267]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20 border-[#e13690]' : 'bg-gradient-to-r from-blue-300 via-indigo-400 to-blue-300'}` : ''}>
            {/* Custom Tests Header */}
            <div
              className={`p-6 border-b-4 border-black cursor-pointer transition-all ${theme === 'cricketverse-australian' ? 'bg-white hover:bg-gray-50' : theme === 'default' ? 'bg-gray-300 hover:bg-gray-300' : theme === 'ben10' ? 'bg-[#b2e05b] hover:bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-200 hover:bg-yellow-200' : theme === 'bounceworld' ? 'bg-white hover:bg-gray-50 border-[#1D428A]' : theme === 'avengers' ? 'bg-[#604AC7]/30 hover:bg-[#604AC7]/40' : theme === 'ponyville' ? 'bg-[#f1aed5] hover:bg-[#f1aed5]/80' : 'bg-blue-200 hover:bg-blue-200'}`}
              onClick={toggleCustomTests}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {expandedCustomTests ? (
                    <ChevronDown className={`h-6 w-6 mr-3 ${theme === 'avengers' ? 'text-white' : 'text-black'}`} />
                  ) : (
                    <ChevronRight className={`h-6 w-6 mr-3 ${theme === 'avengers' ? 'text-white' : 'text-black'}`} />
                  )}
                  <div>
                    <h2 className={`text-2xl font-black flex items-center ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                      {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <span className="text-3xl mr-2">{theme === 'ponyville' ? '📝' : '📝'}</span>}
                      {theme === 'ponyville' ? 'My Magical Custom Tests' : 'My Custom Tests'}
                      {(groupedCustomTests.live.length > 0 || groupedCustomTests.upcoming.length > 0 || groupedCustomTests.available.length > 0) && (
                        <span className={`ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-black border-2 border-black ${theme === 'cricketverse-australian' ? 'bg-black text-white' : theme === 'ben10' ? 'bg-[#64cc4f] text-white' : theme === 'tinkerbell' ? 'bg-yellow-400 text-black' : theme === 'bounceworld' ? 'bg-[#C8102E] text-white' : theme === 'avengers' ? 'bg-[#C88DA5] text-white' : theme === 'ponyville' ? 'bg-[#e13690] text-white' : 'bg-blue-400 text-white'}`}>
                          New!
                        </span>
                      )}
                    </h2>
                    <p className={`font-bold text-lg ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                      {theme === 'ponyville' ? 'Tests assigned specifically to you by your magical teacher! ✨📚' : 'Tests assigned specifically to you by your teacher!'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Custom Test count badges */}
                  {groupedCustomTests.live.length > 0 && (
                    <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'bounceworld' ? 'bg-[#C8102E]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500'}`}>
                      {groupedCustomTests.live.length} {theme === 'ponyville' ? 'Live Quests' : 'Live Now'}
                    </span>
                  )}
                  {groupedCustomTests.upcoming.length > 0 && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-black bg-purple-500 text-white border-2 border-black">
                      {groupedCustomTests.upcoming.length} {theme === 'ponyville' ? 'Future Adventures' : 'Upcoming'}
                    </span>
                  )}
                  {groupedCustomTests.available.length > 0 && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-black bg-blue-500 text-white border-2 border-black">
                      {groupedCustomTests.available.length} {theme === 'ponyville' ? 'Magical Available' : 'Available'}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-600' : theme === 'bounceworld' ? 'bg-[#1D428A]' : theme === 'avengers' ? 'bg-[#0F0826]' : theme === 'ponyville' ? 'bg-[#ff2e9f]' : 'bg-blue-600'}`}>
                    {customTests.length} {theme === 'ponyville' ? 'Magical Total' : 'Total'}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Tests Content */}
            {expandedCustomTests && (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Live Custom Tests */}
                {groupedCustomTests.live.length > 0 && (
                  <>
                    <div className={`px-6 py-4 border-b-4 border-black ${theme === 'default' ? 'bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b]  to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-blue-300 via-indigo-400 to-blue-300'}`}>
                      <div className="flex items-center">
                        {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-2xl mr-3">{theme === 'ponyville' ? '📚' : '🎯'}</div>}
                        <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                          {theme === 'ponyville' ? `Live Quests (${groupedCustomTests.live.length})` : `Live Now (${groupedCustomTests.live.length})`}
                        </span>
                      </div>
                    </div>
                    {groupedCustomTests.live.map((test) => {
                      const liveTest = test as LiveTest;
                      const buttonConfig = getTestButton(test);
                      const ButtonIcon = buttonConfig.icon;

                      return (
                        <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-pink-200/20' : theme === 'bounceworld' ? 'hover:bg-[#1D428A]/10' : theme === 'avengers' ? 'hover:bg-[#604AC7]/10' : theme === 'ponyville' ? 'hover:bg-[#f1aed5]/20' : 'hover:bg-blue-200/20'}`}>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                            <div className="mb-4 md:mb-0">
                            <div className="flex items-center space-x-3">
                                {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-3xl">{theme === 'ponyville' ? '📄' : '📝'}</div>}
                                <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {test.title}
                                </h3>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'bounceworld' ? 'bg-[#C8102E]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500'}`}>
                                  {theme === 'ponyville' ? 'Magical Assignment' : 'Custom Assignment'}
                                </span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'bounceworld' ? 'bg-[#C8102E]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500'}`}>
                                  {theme === 'ponyville' ? 'Live Quest' : 'Live Now'}
                                </span>
                                {renderLateSubmissionBadge(test)}
                              </div>
                              <p className={`font-bold mt-2 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                Duration: {liveTest.duration} minutes • Ends at {formatDateTime(liveTest.actualEndTime)}
                              </p>
                              {test.totalAssignedStudents && (
                                <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  Assigned to {test.totalAssignedStudents} selected students
                                </p>
                              )}
                              {testAttempts[test.id] && (
                                <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {canAttemptTest(test).reason}
                                </p>
                              )}
                              {renderLateSubmissionDetails(test)}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {(buttonConfig as any).hasExpiredIncomplete && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800 border-2 border-orange-400">
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  Incomplete Attempt
                                </span>
                              )}
                              <Button
                                onClick={buttonConfig.action}
                                disabled={buttonConfig.disabled}
                                className={`inline-flex items-center px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black ${
                                  buttonConfig.variant === 'warning' && !buttonConfig.disabled
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                                    : buttonConfig.variant === 'primary' && !buttonConfig.disabled
                                    ? theme === 'default'
                                      ? 'bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white'
                                      : theme === 'ben10'
                                      ? 'bg-gradient-to-r from-[#64cc4f] to-[#428c52] hover:from-[#b2e05b] hover:to-[#222222] text-white'
                                      : theme === 'tinkerbell'
                                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white'
                                      : theme === 'avengers'
                                      ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826] text-white'
                                      : theme === 'ponyville'
                                      ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f] text-white'
                                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                                    : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                }`}
                              >
                                <ButtonIcon className="w-5 h-5 mr-2" />
                                {buttonConfig.text}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Upcoming Custom Tests */}
                {groupedCustomTests.upcoming.length > 0 && (
                  <>
                    <div className={`px-6 py-4 border-b-4 border-black ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-pink-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-purple-300 to-pink-300'}`}>
                      <div className="flex items-center">
                        <div className="text-2xl mr-3">{theme === 'ponyville' ? '⏰' : '⏰'}</div>
                        <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                          {theme === 'ponyville' ? `Future Adventures (${groupedCustomTests.upcoming.length})` : `Upcoming (${groupedCustomTests.upcoming.length})`}
                        </span>
                      </div>
                    </div>
                    {groupedCustomTests.upcoming.map((test) => {
                      const startTime = test.type === 'live' 
                        ? (test as LiveTest).studentJoinTime 
                        : (test as FlexibleTest).availableFrom;

                      return (
                        <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-pink-200/20' : theme === 'avengers' ? 'hover:bg-[#604AC7]/10' : theme === 'ponyville' ? 'hover:bg-[#f1aed5]/20' : 'hover:bg-blue-200/20'}`}>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center space-x-3">
                                {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-3xl">{theme === 'ponyville' ? '📅' : '📅'}</div>}
                                <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {test.title}
                                </h3>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500'}`}>
                                  {theme === 'ponyville' ? 'Magical Assignment' : 'Custom Assignment'}
                                </span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-purple-500' : theme === 'tinkerbell' ? 'bg-purple-500' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-purple-500'}`}>
                                  Upcoming
                                </span>
                                {renderLateSubmissionBadge(test)}
                              </div>
                              <p className={`font-bold mt-2 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                {test.type === 'live' ? 'Scheduled for' : 'Opens on'} {formatDateTime(startTime)}
                              </p>
                              {/* Show deadline for flexible tests */}
                              {test.type === 'flexible' && (
                                <div className={`mt-4 p-4 border-4 border-black rounded-2xl ${theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700]/30 to-[#b38f00]/30' : 'bg-gradient-to-r from-blue-200 to-cyan-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-2xl">📅</div>}
                                      <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        Deadline
                                      </span>
                                      {(test as FlexibleTest).isExtended && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-black bg-orange-400 text-white border-2 border-black">
                                          Extended
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {formatDateTime((test as FlexibleTest).availableTo)}
                                      </div>
                                      <div className={`text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {calculateTimeUntilDeadline(test as FlexibleTest)}
                                      </div>
                                    </div>
                                  </div>
                                  {(test as FlexibleTest).isExtended && (test as FlexibleTest).originalAvailableTo && (
                                    <div className={`mt-2 text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                      Originally: {formatDateTime((test as FlexibleTest).originalAvailableTo)}
                                    </div>
                                  )}
                                </div>
                              )}
                              {test.totalAssignedStudents && (
                                <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  Assigned to {test.totalAssignedStudents} selected students
                                </p>
                              )}
                            </div>
                            <div className={`mt-4 md:mt-0 flex items-center font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                              <div className="text-2xl mr-2">⏰</div>
                              <span className="text-lg">Starts in {calculateTimeRemaining(startTime)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

            {/* Available Custom Tests */}
                {groupedCustomTests.available.length > 0 && (
                  <>
                    <div className={`px-6 py-4 border-b-4 border-black ${theme === 'default' ? 'bg-gradient-to-r from-gray-300 to-gray-400' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-green-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-blue-300 to-cyan-300'}`}>
                      <div className="flex items-center">
                        {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-2xl mr-3">{theme === 'ponyville' ? '📚' : '🎯'}</div>}
                        <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                          {theme === 'ponyville' ? `Magical Available (${groupedCustomTests.available.length})` : `Available (${groupedCustomTests.available.length})`}
                        </span>
                      </div>
                    </div>
                    {groupedCustomTests.available.map((test) => {
                      const flexTest = test as FlexibleTest;
                      const buttonConfig = getTestButton(test);
                      const ButtonIcon = buttonConfig.icon;

                      return (
                        <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-pink-200/20' : theme === 'bounceworld' ? 'hover:bg-[#1D428A]/10' : theme === 'avengers' ? 'hover:bg-[#604AC7]/10' : 'hover:bg-blue-200/20'}`}>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                            <div className="mb-4 md:mb-0">
                              <div className="flex items-center space-x-3">
                                {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-3xl">📝</div>}
                                <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {test.title}
                                </h3>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'bounceworld' ? 'bg-[#C8102E]' : theme === 'avengers' ? 'bg-[#604AC7]' : 'bg-blue-500'}`}>
                                  Custom Assignment
                                </span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'bounceworld' ? 'bg-[#C8102E]' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-blue-500'}`}>
                                  Available
                                </span>
                                {renderLateSubmissionBadge(test)}
                              </div>
                              <p className={`font-bold mt-2 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                Duration: {flexTest.duration || 'No time limit'} minutes
                              </p>
                              {/* Current Deadline */}
                              <div className={`mt-4 p-4 border-4 border-black rounded-2xl ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-200 to-green-200' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700]/30 to-[#b38f00]/30' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/20 to-[#2C1267]/20' : 'bg-gradient-to-r from-blue-200 to-cyan-200'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-2xl">📅</div>}
                                    <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                      Deadline
                                    </span>
                                    {flexTest.isExtended && (
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-orange-400' : theme === 'tinkerbell' ? 'bg-orange-400' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-orange-400'}`}>
                                        Extended
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                      {formatDateTime(flexTest.availableTo)}
                                    </div>
                                    <div className={`text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                      {calculateTimeUntilDeadline(flexTest)}
                                    </div>
                                  </div>
                                </div>
                                {flexTest.isExtended && flexTest.originalAvailableTo && (
                                  <div className={`mt-2 text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                    Originally: {formatDateTime(flexTest.originalAvailableTo)}
                                  </div>
                                )}
                              </div>
                              {/* Extension indicator */}
                              {getExtensionInfo(test) && (
                                <p className={`text-sm font-bold mt-2 flex items-center ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-xl mr-1">📅</div>}
                                  {getExtensionInfo(test)}
                                </p>
                              )}
                              {test.totalAssignedStudents && (
                                <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  Assigned to {test.totalAssignedStudents} selected students
                                </p>
                              )}
                              {testAttempts[test.id] && (
                                <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {canAttemptTest(test).reason}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {(buttonConfig as any).hasExpiredIncomplete && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800 border-2 border-orange-400">
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  Incomplete Attempt
                                </span>
                              )}
                              <Button
                                onClick={buttonConfig.action}
                                disabled={buttonConfig.disabled}
                                className={`inline-flex items-center px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black ${
                                  buttonConfig.variant === 'warning' && !buttonConfig.disabled
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                                    : buttonConfig.variant === 'primary' && !buttonConfig.disabled
                                    ? theme === 'default'
                                      ? 'bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white'
                                      : theme === 'ben10'
                                      ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222] text-white'
                                      : theme === 'tinkerbell'
                                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white'
                                      : theme === 'avengers'
                                      ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826] text-white'
                                      : theme === 'ponyville'
                                      ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f] text-white'
                                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                                    : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                }`}
                              >
                                <ButtonIcon className="w-5 h-5 mr-2" />
                                {buttonConfig.text}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Completed Custom Tests */}
                {groupedCustomTests.completed.length > 0 && (
                  <>
                    <div className={`px-6 py-4 border-b-4 border-black ${theme === 'default' ? 'bg-gradient-to-r from-gray-300 to-gray-400' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-pink-300' : theme === 'cricketverse-australian' ? 'bg-white' : theme === 'avengers' ? 'bg-gradient-to-r from-[#C88DA5]/30 to-[#604AC7]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-blue-300 to-indigo-300'}`}>
                      <div className="flex items-center">
                        {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-2xl mr-3">{theme === 'ponyville' ? '✅' : '✅'}</div>}
                        <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                          {theme === 'ponyville' ? `Magical Completed (${groupedCustomTests.completed.length})` : `Completed (${groupedCustomTests.completed.length})`}
                        </span>
                      </div>
                    </div>
                    {groupedCustomTests.completed.map((test) => {
                      const buttonConfig = getTestButton(test);
                      const ButtonIcon = buttonConfig.icon;
                      const attempts = testAttempts[test.id];
                      const hasAttempted = attempts && attempts.attempts && attempts.attempts.length > 0;

                      return (
                        <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-pink-200/20' : theme === 'avengers' ? 'hover:bg-[#C88DA5]/10' : 'hover:bg-blue-200/20'}`}>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center space-x-3">
                                {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-3xl">📝</div>}
                                <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {test.title}
                                </h3>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'avengers' ? 'bg-[#604AC7]' : 'bg-blue-500'}`}>
                                  Custom Assignment
                                </span>
                                {hasAttempted ? (
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'avengers' ? 'bg-[#0F0826]' : 'bg-blue-500'}`}>
                                    Attempted
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-orange-400' : theme === 'tinkerbell' ? 'bg-orange-400' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-orange-400'}`}>
                                    Not Attempted
                                  </span>
                                )}
                              </div>
                              {test.totalAssignedStudents && (
                                <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  Assigned to {test.totalAssignedStudents} selected students
                                </p>
                              )}
                              {testAttempts[test.id] && (
                                <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  Best Score: {testAttempts[test.id].bestScore || 0} • {testAttempts[test.id].completedAttempts?.length || 0} completed attempt{(testAttempts[test.id].completedAttempts?.length || 0) !== 1 ? 's' : ''}
                                  {testAttempts[test.id].activeAttempts?.length > 0 && (
                                    <span> • {testAttempts[test.id].activeAttempts.length} in progress</span>
                                  )}
                                </p>
                              )}
                              {(() => {
                                const activeInfo = getActiveAttemptInfo(test);
                                if (activeInfo && activeInfo.timeRemaining > 0) {
                                  return (
                                    <div className="mt-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-500 dark:border-green-600">
                                      <div className="flex items-center space-x-2">
                                        <Clock className="h-5 w-5 text-green-700 dark:text-green-400 animate-pulse" />
                                        <div className="text-sm">
                                          <p className="font-black text-green-800 dark:text-green-300 text-lg">
                                            ⏱️ {activeInfo.formattedTime}
                                          </p>
                                          <p className="text-green-700 dark:text-green-400 text-xs mt-0.5">
                                            You can resume your test and continue from where you left off
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {(() => {
                                const activeInfo = getActiveAttemptInfo(test);
                                if (activeInfo && activeInfo.timeRemaining > 0) {
                                  return (
                                    <div className="mt-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-500 dark:border-green-600">
                                      <div className="flex items-center space-x-2">
                                        <Clock className="h-5 w-5 text-green-700 dark:text-green-400 animate-pulse" />
                                        <div className="text-sm">
                                          <p className="font-black text-green-800 dark:text-green-300 text-lg">
                                            ⏱️ {activeInfo.formattedTime}
                                          </p>
                                          <p className="text-green-700 dark:text-green-400 text-xs mt-0.5">
                                            You can resume your test and continue from where you left off
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {test.description && (
                                <p className={`text-lg font-bold mt-2 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {test.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-4 md:mt-0 flex flex-col items-end gap-2">
                              {(buttonConfig as any).hasExpiredIncomplete && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800 border-2 border-orange-400">
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  Incomplete Attempt
                                </span>
                              )}
                              <Button
                                onClick={buttonConfig.action}
                                disabled={buttonConfig.disabled}
                                className={`inline-flex items-center px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black ${
                                  buttonConfig.variant === 'warning' && !buttonConfig.disabled
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                                    : buttonConfig.variant === 'primary' && !buttonConfig.disabled
                                    ? theme === 'default'
                                      ? 'bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white'
                                      : theme === 'ben10'
                                      ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222] text-white'
                                      : theme === 'tinkerbell'
                                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white'
                                      : theme === 'avengers'
                                      ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826] text-white'
                                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                                    : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                }`}
                              >
                                <ButtonIcon className="w-5 h-5 mr-2" />
                                {buttonConfig.text}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
            </div>
          </div>
        )}

        {/* Classes */}
        {Object.entries(testsByClass).map(([classId, classData]) => {
          const isExpanded = expandedClasses.has(classId);
          const hasTests = classData.tests.length > 0;
          const totalTests = classData.tests.length;
          const liveCount = classData.groupedTests.live.length;
          const upcomingCount = classData.groupedTests.upcoming.length;
          const availableCount = classData.groupedTests.available.length;
          const completedCount = classData.groupedTests.completed.length;

          return (
            <div key={classId} className={`rounded-3xl shadow-2xl border-4 overflow-hidden ${theme === 'cricketverse-australian' ? 'border-[#b38f00] bg-white' : theme === 'default' ? 'border-black bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200' : theme === 'ben10' ? 'border-black bg-gradient-to-r from-[#64cc4f] via-black to-[#64cc4f]' : theme === 'tinkerbell' ? 'border-black bg-gradient-to-r from-yellow-300 via-black to-yellow-300' : theme === 'bounceworld' ? 'border-black bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'border-black bg-gradient-to-r from-[#604AC7] via-[#2C1267] to-[#0F0826]' : theme === 'ponyville' ? 'border-[#e13690] bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'border-black bg-gradient-to-r from-blue-300 via-black to-blue-300'}`}>
              {/* Class Header */}
              <div
                className={`p-6 border-b-4 cursor-pointer transition-all ${theme === 'cricketverse-australian' ? 'border-[#b38f00] bg-green-50 hover:bg-green-100' : theme === 'default' ? 'border-black bg-gray-300 hover:bg-gray-300' : theme === 'ben10' ? 'border-black bg-[#b2e05b] hover:bg-[#b2e05b]' : theme === 'tinkerbell' ? 'border-black bg-yellow-200 hover:bg-yellow-200' : theme === 'bounceworld' ? 'border-[#1D428A] bg-white hover:bg-gray-50' : theme === 'avengers' ? 'border-black bg-[#604AC7]/30 hover:bg-[#604AC7]/40' : theme === 'ponyville' ? 'border-black bg-[#f1aed5] hover:bg-[#f1aed5]/80' : 'border-black bg-blue-200 hover:bg-blue-200'}`}
                onClick={() => toggleClass(classId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {isExpanded ? (
                      <ChevronDown className={`h-6 w-6 mr-3 ${theme === 'avengers' ? 'text-white' : 'text-black'}`} />
                    ) : (
                      <ChevronRight className={`h-6 w-6 mr-3 ${theme === 'avengers' ? 'text-white' : 'text-black'}`} />
                    )}
                    <div>
                      <h2 className={`text-2xl font-black flex items-center ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                        <span className="text-3xl mr-2">🏫</span>
                        {classData.enrollment.className}
                      </h2>
                      <p className={`font-bold text-lg ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                        {classData.enrollment.subject} • Learning Adventures! 
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Test count badges */}
                    {liveCount > 0 && (
                      <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-green-500' : theme === 'cricketverse-australian' ? 'bg-[#b38f00]' : theme === 'bounceworld' ? 'bg-[#C8102E]' : theme === 'avengers' ? 'bg-[#604AC7]' : 'bg-blue-500'}`}>
                        {liveCount} Live Now
                      </span>
                    )}
                    {upcomingCount > 0 && (
                      <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-purple-500' : theme === 'tinkerbell' ? 'bg-purple-500' : theme === 'cricketverse-australian' ? 'bg-purple-500' : theme === 'bounceworld' ? 'bg-purple-500' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-purple-500'}`}>
                        {upcomingCount} Upcoming
                      </span>
                    )}
                    {availableCount > 0 && (
                      <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-blue-500' : theme === 'tinkerbell' ? 'bg-blue-500' : theme === 'cricketverse-australian' ? 'bg-blue-500' : theme === 'bounceworld' ? 'bg-blue-500' : theme === 'avengers' ? 'bg-[#604AC7]' : 'bg-blue-500'}`}>
                        {availableCount} Available
                      </span>
                    )}
                    <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black border-2 ${theme === 'cricketverse-australian' ? 'bg-blue-500 text-white border-[#b38f00]' : theme === 'ben10' ? 'bg-[#b2e05b] text-white border-black' : theme === 'tinkerbell' ? 'bg-yellow-600 text-white border-black' : theme === 'bounceworld' ? 'bg-[#1D428A] text-white border-black' : theme === 'avengers' ? 'bg-[#0F0826] text-white border-black' : 'bg-indigo-600 text-white border-black'}`}>
                      {totalTests} Total Tests
                    </span>
                  </div>
                </div>
              </div>

              {/* Class Content */}
              {isExpanded && (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {!hasTests ? (
                    <div className={`p-8 text-center rounded-2xl border-4 border-black m-4 ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] via-black to-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-100 via-black to-yellow-100' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700] via-[#8b6914] to-[#ffd700]' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/20 via-[#2C1267]/20 to-[#0F0826]/20' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-blue-100 via-black to-blue-100'}`}>
                      {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-6xl mb-4">📚</div>}
                      <h3 className="text-2xl font-black text-white mb-2">
                        No Tests Yet
                      </h3>
                      <p className="text-white font-bold">
                        Your teacher hasn't created any tests for this class yet. Stay tuned for more tests! {(theme === 'ben10' || theme === 'tinkerbell') && '📝'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Live Tests */}
                      {classData.groupedTests.live.length > 0 && (
                        <>
                          <div className={`px-6 py-4 border-b-4 border-black ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-green-300 to-yellow-300'}`}>
                            <div className="flex items-center">
                              <div className="text-2xl mr-3">🎯</div>
                              <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                Live Now ({classData.groupedTests.live.length})
                              </span>
                            </div>
                          </div>
                          {classData.groupedTests.live.map((test) => {
                            const liveTest = test as LiveTest;
                            const buttonConfig = getTestButton(test);
                            const ButtonIcon = buttonConfig.icon;

                            return (
                              <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-pink-200/20' : theme === 'avengers' ? 'hover:bg-[#604AC7]/10' : 'hover:bg-blue-200/20'}`}>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div className="mb-4 md:mb-0">
                                    <div className="flex items-center space-x-3">
                                      {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-3xl">📝</div>}
                                      <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black border-2 border-black ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-400 text-white'
                                          : 'bg-blue-400 text-white'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'avengers' ? 'bg-[#604AC7]' : 'bg-blue-500'}`}>
                                        Live Now
                                      </span>
                                      {renderLateSubmissionBadge(test)}
                                    </div>
                                    <p className={`font-bold mt-2 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                      Duration: {liveTest.duration} minutes • Ends at {formatDateTime(liveTest.actualEndTime)}
                                    </p>
                                    {testAttempts[test.id] && (
                                      <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {canAttemptTest(test).reason}
                                      </p>
                                    )}
                                    {renderLateSubmissionDetails(test)}
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    {(buttonConfig as any).hasExpiredIncomplete && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800 border-2 border-orange-400">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        Incomplete Attempt
                                      </span>
                                    )}
                                    <Button
                                      onClick={buttonConfig.action}
                                      disabled={buttonConfig.disabled}
                                      className={`inline-flex items-center px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black ${
                                        buttonConfig.variant === 'warning' && !buttonConfig.disabled
                                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                                          : buttonConfig.variant === 'primary' && !buttonConfig.disabled
                                          ? theme === 'default'
                                            ? 'bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white'
                                            : `${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700] to-[#b38f00] hover:from-[#b38f00] hover:to-[#8b6914]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826]' : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'} text-white`
                                          : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                      }`}
                                    >
                                      <ButtonIcon className="w-5 h-5 mr-2" />
                                      {buttonConfig.text}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Upcoming Tests */}
                      {classData.groupedTests.upcoming.length > 0 && (
                        <>
                          <div className={`px-6 py-4 border-b-4 border-black ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-pink-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-purple-300 to-pink-300'}`}>
                            <div className="flex items-center">
                              <div className="text-2xl mr-3">⏰</div>
                              <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                Upcoming ({classData.groupedTests.upcoming.length})
                              </span>
                            </div>
                          </div>
                          {classData.groupedTests.upcoming.map((test) => {
                            const startTime = test.type === 'live' 
                              ? (test as LiveTest).studentJoinTime 
                              : (test as FlexibleTest).availableFrom;

                            return (
                              <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-pink-200/20' : theme === 'avengers' ? 'hover:bg-[#604AC7]/10' : 'hover:bg-blue-200/20'}`}>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="flex items-center space-x-3">
                                      {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-3xl">📅</div>}
                                      <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black border-2 border-black ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-400 text-white'
                                          : 'bg-blue-400 text-white'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-purple-500' : theme === 'tinkerbell' ? 'bg-purple-500' : theme === 'bounceworld' ? 'bg-purple-500' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-purple-500'}`}>
                                        Upcoming
                                      </span>
                                    </div>
                                    <p className={`font-bold mt-2 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                      {test.type === 'live' ? 'Scheduled for' : 'Opens on'} {formatDateTime(startTime)}
                                    </p>
                                    {/* Show deadline for flexible tests */}
                                    {test.type === 'flexible' && (
                                      <div className={`mt-4 p-4 border-4 border-black rounded-2xl ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-200 to-green-200' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700]/30 to-[#b38f00]/30' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/20 to-[#2C1267]/20' : 'bg-gradient-to-r from-blue-200 to-cyan-200'}`}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-2">
                                            {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-2xl">📅</div>}
                                            <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                              Deadline
                                            </span>
                                            {(test as FlexibleTest).isExtended && (
                                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-orange-400' : theme === 'tinkerbell' ? 'bg-orange-400' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-orange-400'}`}>
                                                Extended
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <div className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                              {formatDateTime((test as FlexibleTest).availableTo)}
                                            </div>
                                            <div className={`text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                              {calculateTimeUntilDeadline(test as FlexibleTest)}
                                            </div>
                                          </div>
                                        </div>
                                        {(test as FlexibleTest).isExtended && (test as FlexibleTest).originalAvailableTo && (
                                          <div className={`mt-2 text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                            Originally: {formatDateTime((test as FlexibleTest).originalAvailableTo)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className={`mt-4 md:mt-0 flex items-center font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                    <div className="text-2xl mr-2">⏰</div>
                                    <span className="text-lg">Starts in {calculateTimeRemaining(startTime)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Available Tests */}
                      {classData.groupedTests.available.length > 0 && (
                        <>
                          <div className={`px-6 py-4 border-b-4 border-black ${theme === 'default' ? 'bg-gradient-to-r from-gray-300 to-gray-400' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-green-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-blue-300 to-cyan-300'}`}>
                            <div className="flex items-center">
                              {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-2xl mr-3">{theme === 'ponyville' ? '🦄' : '🎯'}</div>}
                              <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                {theme === 'ponyville' ? `Magical Available (${classData.groupedTests.available.length})` : `Available (${classData.groupedTests.available.length})`}
                              </span>
                            </div>
                          </div>
                          {classData.groupedTests.available.map((test) => {
                            const flexTest = test as FlexibleTest;
                            const buttonConfig = getTestButton(test);
                            const ButtonIcon = buttonConfig.icon;

                            return (
                              <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-pink-200/20' : theme === 'bounceworld' ? 'hover:bg-[#1D428A]/10' : 'hover:bg-blue-200/20'}`}>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div className="mb-4 md:mb-0">
                                    <div className="flex items-center space-x-3">
                                      {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-3xl">📝</div>}
                                      <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black border-2 border-black ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-400 text-white'
                                          : 'bg-blue-400 text-white'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-blue-500' : theme === 'tinkerbell' ? 'bg-blue-500' : theme === 'bounceworld' ? 'bg-blue-500' : theme === 'avengers' ? 'bg-[#604AC7]' : 'bg-blue-500'}`}>
                                        Available
                                      </span>
                                    </div>
                                    <p className={`font-bold mt-2 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                      Duration: {flexTest.duration || 'No time limit'} minutes
                                    </p>
                                    {/* Current Deadline */}
                                    <div className={`mt-4 p-4 border-4 border-black rounded-2xl ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-200 to-green-200' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700]/30 to-[#b38f00]/30' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/20 to-[#2C1267]/20' : 'bg-gradient-to-r from-blue-200 to-cyan-200'}`}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-2xl">📅</div>}
                                          <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                            Deadline
                                          </span>
                                          {flexTest.isExtended && (
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-orange-400' : theme === 'tinkerbell' ? 'bg-orange-400' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-orange-400'}`}>
                                              Extended
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <div className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                            {formatDateTime(flexTest.availableTo)}
                                          </div>
                                          <div className={`text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                            {calculateTimeUntilDeadline(flexTest)}
                                          </div>
                                        </div>
                                      </div>
                                      {flexTest.isExtended && flexTest.originalAvailableTo && (
                                        <div className={`mt-2 text-sm font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                          Originally: {formatDateTime(flexTest.originalAvailableTo)}
                                        </div>
                                      )}
                                    </div>
                                    {/* Extension indicator */}
                                    {getExtensionInfo(test) && (
                                      <p className={`text-sm font-bold mt-2 flex items-center ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {(theme === 'ben10' || theme === 'tinkerbell') && <div className="text-xl mr-1">📅</div>}
                                        {getExtensionInfo(test)}
                                      </p>
                                    )}
                                    {testAttempts[test.id] && (
                                      <p className={`text-sm font-bold mt-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {canAttemptTest(test).reason}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    {(buttonConfig as any).hasExpiredIncomplete && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800 border-2 border-orange-400">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        Incomplete Attempt
                                      </span>
                                    )}
                                    <Button
                                      onClick={buttonConfig.action}
                                      disabled={buttonConfig.disabled}
                                      className={`inline-flex items-center px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black ${
                                        buttonConfig.variant === 'warning' && !buttonConfig.disabled
                                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                                          : buttonConfig.variant === 'primary' && !buttonConfig.disabled
                                          ? theme === 'default'
                                            ? 'bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white'
                                            : `${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700] to-[#b38f00] hover:from-[#b38f00] hover:to-[#8b6914]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826]' : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'} text-white`
                                          : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                      }`}
                                    >
                                      <ButtonIcon className="w-5 h-5 mr-2" />
                                      {buttonConfig.text}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Completed Tests */}
                      {classData.groupedTests.completed.length > 0 && (
                        <>
                          <div className={`px-6 py-4 border-b-4 border-black ${theme === 'default' ? 'bg-gradient-to-r from-gray-300 to-gray-400' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-green-300' : theme === 'cricketverse-australian' ? 'bg-white' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#C88DA5]/30 to-[#604AC7]/30' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]/20' : 'bg-gradient-to-r from-blue-300 to-indigo-300'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <div className="text-2xl mr-3">{theme === 'ponyville' ? '🦄' : '✅'}</div>}
                                <span className={`text-lg font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                  {theme === 'ponyville' ? `Magical Completed (${classData.groupedTests.completed.length})` : `Completed (${classData.groupedTests.completed.length})`}
                                </span>
                              </div>
                              {classData.groupedTests.completed.length > 3 && (
                                <button
                                  onClick={() => toggleCompletedSection(classId)}
                                  className={`text-lg ${theme === 'avengers' ? 'text-white' : 'text-black'} font-black hover:text-gray-700 flex items-center px-4 py-2 rounded-full bg-white border-2 border-black transform hover:scale-105 transition-all`}
                                >
                                  {expandedCompletedSections.has(classId) ? (
                                    <>
                                      <ChevronUp className="h-5 w-5 mr-2" />
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-5 w-5 mr-2" />
                                      Show All {classData.groupedTests.completed.length}
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Show first 3 tests or all if expanded */}
                          {(expandedCompletedSections.has(classId) 
                            ? classData.groupedTests.completed 
                            : classData.groupedTests.completed.slice(0, 3)
                          ).map((test) => {
                            const buttonConfig = getTestButton(test);
                            const ButtonIcon = buttonConfig.icon;
                            const attempts = testAttempts[test.id];
                            const hasAttempted = attempts && attempts.attempts && attempts.attempts.length > 0;

                            return (
                              <div key={test.id} className={`p-6 transition-all border-b-2 border-black last:border-b-0 ${theme === 'default' ? 'hover:bg-gray-200/20' : theme === 'ben10' ? 'hover:bg-[#b2e05b]/20' : theme === 'tinkerbell' ? 'hover:bg-yellow-200/20' : theme === 'bounceworld' ? 'hover:bg-[#1D428A]/10' : theme === 'avengers' ? 'hover:bg-[#C88DA5]/10' : 'hover:bg-blue-200/20'}`}>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="flex items-center space-x-3">
                                      <div className="text-3xl">📝</div>
                                      <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black border-2 border-black ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-400 text-white'
                                          : 'bg-blue-400 text-white'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      {hasAttempted ? (
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'bounceworld' ? 'bg-[#C8102E]' : theme === 'avengers' ? 'bg-[#0F0826]' : 'bg-blue-500'}`}>
                                          Attempted
                                        </span>
                                      ) : (
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white border-2 border-black ${theme === 'ben10' ? 'bg-orange-400' : theme === 'tinkerbell' ? 'bg-orange-400' : theme === 'avengers' ? 'bg-[#C88DA5]' : 'bg-orange-400'}`}>
                                          Not Attempted
                                        </span>
                                      )}
                                    </div>
                                    {testAttempts[test.id] && (
                                      <p className={`text-sm ${theme === 'avengers' ? 'text-white' : 'text-black'} font-bold mt-2`}>
                                        Best Score: {testAttempts[test.id].bestScore || 0} • {testAttempts[test.id].completedAttempts?.length || 0} completed attempt{(testAttempts[test.id].completedAttempts?.length || 0) !== 1 ? 's' : ''}
                                        {testAttempts[test.id].activeAttempts?.length > 0 && (
                                          <span> • {testAttempts[test.id].activeAttempts.length} in progress</span>
                                        )}
                                      </p>
                                    )}
                                    {/* Test Description */}
                                    {test.description && (
                                      <p className={`text-lg ${theme === 'avengers' ? 'text-white' : 'text-black'} font-bold mt-2`}>
                                        {test.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-4 md:mt-0 flex flex-col items-end gap-2">
                                    {(buttonConfig as any).hasExpiredIncomplete && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800 border-2 border-orange-400">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        Incomplete Attempt
                                      </span>
                                    )}
                                    <Button
                                      onClick={buttonConfig.action}
                                      disabled={buttonConfig.disabled}
                                      className={`inline-flex items-center px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black ${
                                        buttonConfig.variant === 'warning' && !buttonConfig.disabled
                                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                                          : buttonConfig.variant === 'primary' && !buttonConfig.disabled
                                          ? theme === 'default'
                                            ? 'bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white'
                                            : `${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#ffd700] to-[#b38f00] hover:from-[#b38f00] hover:to-[#8b6914]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826]' : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'} text-white`
                                          : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                      }`}
                                    >
                                      <ButtonIcon className="w-5 h-5 mr-2" />
                                      {buttonConfig.text}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* No Tests */}
        {Object.keys(testsByClass).length === 0 && customTests.length === 0 && (
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'avengers' ? 'border-[#2C1267]' : 'border-black'}`}>
            <Info className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Tests Found
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {searchTerm || selectedSubjectId !== 'all' 
                ? "No tests match your current filters. Try adjusting your search criteria."
                : "You don't have any tests assigned to your classes yet. Check back later or contact your teacher."}
            </p>
            {(searchTerm || selectedSubjectId !== 'all') && (
              <Button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSubjectId('all');
                }}
                variant="outline"
                className="inline-flex items-center"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}

// Helper function to calculate remaining time
function calculateTimeRemaining(timestamp: any): string {
  const now = new Date();
  let targetDate: Date;
  
  try {
    // Handle different timestamp formats
    if (timestamp && typeof timestamp.toDate === 'function') {
      targetDate = timestamp.toDate();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
      targetDate = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      targetDate = timestamp;
    } else if (typeof timestamp === 'string') {
      targetDate = new Date(timestamp);
    } else {
      console.warn('Invalid timestamp format for time calculation:', timestamp);
      return "Unknown time";
    }
  } catch (error) {
    console.error('Error calculating time remaining:', error, timestamp);
    return "Unknown time";
  }
  
  const diffMs = targetDate.getTime() - now.getTime();
  
  if (diffMs <= 0) return "Starting now";
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHrs}h`;
  } else if (diffHrs > 0) {
    return `${diffHrs}h ${diffMins}m`;
  } else {
    return `${diffMins}m`;
  }
}
