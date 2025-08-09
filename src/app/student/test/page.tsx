'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Calendar, AlertCircle, FileText, CheckCircle, Play, ArrowRight, BookOpen, Filter, Info, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button, Input, Select } from '@/components/ui';
import { TestService } from '@/apiservices/testService';
import { Timestamp } from 'firebase/firestore';
import { Test, LiveTest, FlexibleTest } from '@/models/testSchema';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';

// Import student layout from other components or use a local version for now
const StudentLayout = ({ children }: { children: React.ReactNode }) => children;

export default function StudentTests() {
  const { student, loading: authLoading } = useStudentAuth();
  const router = useRouter();
  
  // States
  const [tests, setTests] = useState<Test[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [testAttempts, setTestAttempts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [expandedCompletedSections, setExpandedCompletedSections] = useState<Set<string>>(new Set());
  
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

  // Function to load test attempts for the student
  const loadTestAttempts = async () => {
    try {
      console.log('🔍 Loading test attempts for student:', student?.id);
      
      // Import services
      const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
      
      // Get all test attempts for this student
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');
      
      const attemptsQuery = query(
        collection(firestore, 'testAttempts'),
        where('studentId', '==', student?.id || '')
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const attempts: Record<string, any> = {};
      
      attemptsSnapshot.forEach((doc) => {
        const attemptData = doc.data();
        const testId = attemptData.testId;
        
        if (!attempts[testId]) {
          attempts[testId] = {
            attempts: [], // All attempts (completed + incomplete)
            completedAttempts: [], // Only completed attempts
            activeAttempts: [], // Only active/incomplete attempts
            canAttemptAgain: true,
            bestScore: 0,
            latestAttempt: null
          };
        }
        
        const attempt = {
          id: doc.id,
          ...attemptData
        };
        
        // Add to all attempts
        attempts[testId].attempts.push(attempt);
        
        // Categorize the attempt based on status
        const isCompleted = attemptData.status === 'submitted' || 
                           attemptData.status === 'auto_submitted' || 
                           attemptData.submittedAt;
        
        const isActive = attemptData.status === 'active' || 
                        attemptData.status === 'paused' || 
                        (!attemptData.submittedAt && !attemptData.status);
        
        if (isCompleted) {
          attempts[testId].completedAttempts.push(attempt);
          
          // Update best score only from completed attempts
          if (attemptData.score > attempts[testId].bestScore) {
            attempts[testId].bestScore = attemptData.score;
          }
          
          // Update latest completed attempt
          if (!attempts[testId].latestAttempt || 
              (attemptData.submittedAt && attemptData.submittedAt.seconds > attempts[testId].latestAttempt.submittedAt?.seconds)) {
            attempts[testId].latestAttempt = attemptData;
          }
        } else if (isActive) {
          attempts[testId].activeAttempts.push(attempt);
        }
      });
      
      setTestAttempts(attempts);
      console.log('✅ Loaded test attempts:', {
        totalTests: Object.keys(attempts).length,
        breakdown: Object.entries(attempts).map(([testId, data]: [string, any]) => ({
          testId,
          totalAttempts: data.attempts.length,
          completedAttempts: data.completedAttempts.length,
          activeAttempts: data.activeAttempts.length
        }))
      });
      return attempts;
    } catch (error) {
      console.error('Error loading test attempts:', error);
      return {};
    }
  };
  
  // Function to set up test listener
  const setupTestListener = async (classIds: string[]) => {
    try {
      // Import Firestore functions properly with await import
      const { collection, query, where, onSnapshot } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');
      
      console.log('🔄 Firestore initialized:', !!firestore);
      
      // Create tests query
      const testsCollection = collection(firestore, 'tests');
      console.log('🔄 Tests collection reference created:', !!testsCollection);
      
      const testsQuery = query(
        testsCollection,
        where('classIds', 'array-contains-any', classIds)
      );
      console.log('🔄 Tests query created with classes:', classIds);
      
      console.log('🔄 Setting up real-time test listener for classes:', classIds);
      
      // Set up real-time listener
      return onSnapshot(testsQuery, (snapshot: any) => {
        console.log('📥 Received snapshot with', snapshot.size, 'documents');
        const testsData: Test[] = [];
        
        snapshot.forEach((doc: any) => {
          const testData = { id: doc.id, ...doc.data() } as Test;
          console.log('📄 Test document:', doc.id, testData.title);
          testsData.push(testData);
        });
        
        setTests(testsData);
        setLoading(false);
        console.log('✅ Loaded tests (real-time):', testsData.length);
      }, (error: any) => {
        console.error('Error in tests snapshot listener:', error);
        setError('Failed to listen for test updates. Please refresh the page.');
        setLoading(false);
      });
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
      
      // Load enrollments and test attempts in parallel
      const [enrollmentsData, attemptsData] = await Promise.all([
        loadEnrollments(),
        loadTestAttempts()
      ]);
      
      if (enrollmentsData.length === 0) {
        setLoading(false);
        return null; // No enrollments, no need to set up test listener
      }
      
      // Get class IDs from enrollments
      const classIds = enrollmentsData.map((enrollment: StudentEnrollment) => enrollment.classId);
      
      // Set up test listener (await it since it's now async)
      return await setupTestListener(classIds);
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
      
      if (now < fromSeconds) {
        return { status: 'upcoming', color: 'blue', text: 'Upcoming' };
      } else if (now >= fromSeconds && now <= toSeconds) {
        return { status: 'active', color: 'green', text: 'Available' };
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

    // For completed tests, always show view results if there are completed attempts
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

    // For live or available tests
    if (status.status === 'live' || status.status === 'active') {
      if (attemptInfo.canAttempt) {
        // If there's an active attempt, show resume
        if (hasActiveAttempt) {
          return {
            text: 'Resume Test',
            action: () => handleStartTest(test.id),
            variant: 'primary' as const,
            icon: Play,
            disabled: false
          };
        }
        
        // If can attempt but has completed attempts, show start new attempt
        if (hasCompletedAttempt) {
          return {
            text: 'Start New Attempt',
            action: () => handleStartTest(test.id),
            variant: 'primary' as const,
            icon: Play,
            disabled: false
          };
        }
        
        // First attempt
        return {
          text: status.status === 'live' ? 'Join Now' : 'Start Test',
          action: () => handleStartTest(test.id),
          variant: status.status === 'live' ? 'primary' : 'primary' as const,
          icon: Play,
          disabled: false
        };
      } else {
        return {
          text: 'View Results',
          action: () => handleViewResults(test.id),
          variant: 'outline' as const,
          icon: ArrowRight,
          disabled: false
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

  // Filter tests based on subject and search term
  const filteredTests = useMemo(() => {
    if (!tests) return [];
    
    return tests.filter(test => {
      const matchesSubject = selectedSubjectId === 'all' || 
        test.classIds.some(classId => {
          const enrollment = enrollments.find(e => e.classId === classId);
          if (!enrollment) return false;
          
          // Find subject ID from the enrollment
          const subjectName = enrollment.subject;
          const subject = subjects.find(s => s.name === subjectName);
          
          return subject?.id === selectedSubjectId;
        });
      
      const matchesSearch = 
        test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        false;
      
      return matchesSubject && (searchTerm ? matchesSearch : true);
    });
  }, [tests, enrollments, selectedSubjectId, searchTerm, subjects]);

  // Group tests by class
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

    // Add tests to their respective classes
    filteredTests.forEach(test => {
      test.classIds.forEach(classId => {
        if (grouped[classId]) {
          grouped[classId].tests.push(test);
          
          // Group by status
          const status = getTestStatus(test);
          if (status.status === 'live') {
            grouped[classId].groupedTests.live.push(test);
          } else if (status.status === 'upcoming') {
            grouped[classId].groupedTests.upcoming.push(test);
          } else if (status.status === 'active') {
            grouped[classId].groupedTests.available.push(test);
          } else {
            grouped[classId].groupedTests.completed.push(test);
          }
        }
      });
    });

    // Sort upcoming tests by date (soonest first)
    Object.values(grouped).forEach(classData => {
      classData.groupedTests.upcoming.sort((a, b) => {
        const getTimestamp = (test: Test) => {
          if (test.type === 'live') {
            const liveTest = test as LiveTest;
            return liveTest.studentJoinTime;
          } else {
            const flexTest = test as FlexibleTest;
            return flexTest.availableFrom;
          }
        };

        const aTime = getTimestamp(a);
        const bTime = getTimestamp(b);

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
            return timestamp > 1000000000000 ? timestamp / 1000 : timestamp;
          }
          return 0;
        };

        return getSeconds(aTime) - getSeconds(bTime);
      });
    });

    return grouped;
  }, [filteredTests, enrollments]);

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
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Tests & Quizzes
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              View and take tests assigned to your classes
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Classes Enrolled
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You are not enrolled in any classes yet. Please contact your administrator or teacher.
            </p>
            <Button 
              onClick={() => router.push('/student/dashboard')}
              className="inline-flex items-center"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

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
              <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              ))}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Tests & Quizzes
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            View and take tests assigned to your classes
          </p>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Enrolled in {enrollments?.length || 0} class{enrollments?.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search tests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Subject Filter */}
            <div className="flex-shrink-0 min-w-[200px]">
              <Select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full"
                options={[
                  { value: 'all', label: 'All Subjects' },
                  ...subjects.map((subject) => ({
                    value: subject.id,
                    label: subject.name
                  }))
                ]}
              />
            </div>
          </div>

          {/* Test Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
              <div className="flex items-center">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Classes</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{Object.keys(testsByClass).length}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
              <div className="flex items-center">
                <Play className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Live Now</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {Object.values(testsByClass).reduce((acc, classData) => acc + classData.groupedTests.live.length, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Upcoming</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {Object.values(testsByClass).reduce((acc, classData) => acc + classData.groupedTests.upcoming.length, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Tests</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{filteredTests.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            <div key={classId} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Class Header */}
              <div 
                className="p-6 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => toggleClass(classId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400 mr-3" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400 mr-3" />
                    )}
                    <div>
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                        {classData.enrollment.className}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {classData.enrollment.subject}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Test count badges */}
                    {liveCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        {liveCount} Live
                      </span>
                    )}
                    {upcomingCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                        {upcomingCount} Upcoming
                      </span>
                    )}
                    {availableCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        {availableCount} Available
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      {totalTests} Total
                    </span>
                  </div>
                </div>
              </div>

              {/* Class Content */}
              {isExpanded && (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {!hasTests ? (
                    <div className="p-8 text-center">
                      <FileText className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                      <p className="text-gray-600 dark:text-gray-300">No tests available for this class</p>
                    </div>
                  ) : (
                    <>
                      {/* Live Tests */}
                      {classData.groupedTests.live.length > 0 && (
                        <>
                          <div className="px-6 py-3 bg-green-50 dark:bg-green-900/20">
                            <div className="flex items-center">
                              <Play className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                Live Now ({classData.groupedTests.live.length})
                              </span>
                            </div>
                          </div>
                          {classData.groupedTests.live.map((test) => {
                            const liveTest = test as LiveTest;
                            const buttonConfig = getTestButton(test);
                            const ButtonIcon = buttonConfig.icon;

                            return (
                              <div key={test.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div className="mb-4 md:mb-0">
                                    <div className="flex items-center space-x-2">
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                        Live Now
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                      Duration: {liveTest.duration} minutes • Ends at {formatDateTime(liveTest.actualEndTime)}
                                    </p>
                                    {testAttempts[test.id] && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {canAttemptTest(test).reason}
                                      </p>
                                    )}
                                  </div>
                                  <div>
                                    <Button 
                                      onClick={buttonConfig.action}
                                      disabled={buttonConfig.disabled}
                                      variant={buttonConfig.variant}
                                      className={`inline-flex items-center ${
                                        buttonConfig.variant === 'primary' && !buttonConfig.disabled 
                                          ? 'bg-green-600 hover:bg-green-700' 
                                          : ''
                                      }`}
                                    >
                                      <ButtonIcon className="w-4 h-4 mr-2" />
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
                          <div className="px-6 py-3 bg-purple-50 dark:bg-purple-900/20">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2" />
                              <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                                Upcoming ({classData.groupedTests.upcoming.length})
                              </span>
                            </div>
                          </div>
                          {classData.groupedTests.upcoming.map((test) => {
                            const startTime = test.type === 'live' 
                              ? (test as LiveTest).studentJoinTime 
                              : (test as FlexibleTest).availableFrom;

                            return (
                              <div key={test.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                        Upcoming
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                      Scheduled for {formatDateTime(startTime)}
                                    </p>
                                  </div>
                                  <div className="mt-4 md:mt-0 flex items-center text-gray-500 dark:text-gray-400">
                                    <Clock className="w-4 h-4 mr-2" />
                                    <span>Starts in {calculateTimeRemaining(startTime)}</span>
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
                          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20">
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                Available ({classData.groupedTests.available.length})
                              </span>
                            </div>
                          </div>
                          {classData.groupedTests.available.map((test) => {
                            const flexTest = test as FlexibleTest;
                            const buttonConfig = getTestButton(test);
                            const ButtonIcon = buttonConfig.icon;

                            return (
                              <div key={test.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div className="mb-4 md:mb-0">
                                    <div className="flex items-center space-x-2">
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                        Available
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                      Duration: {flexTest.duration || 'No time limit'} minutes • Available until {formatDateTime(flexTest.availableTo)}
                                    </p>
                                    {testAttempts[test.id] && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {canAttemptTest(test).reason}
                                      </p>
                                    )}
                                  </div>
                                  <div>
                                    <Button 
                                      onClick={buttonConfig.action}
                                      disabled={buttonConfig.disabled}
                                      variant={buttonConfig.variant}
                                      className="inline-flex items-center"
                                    >
                                      <ButtonIcon className="w-4 h-4 mr-2" />
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
                          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-300">
                                  Completed ({classData.groupedTests.completed.length})
                                </span>
                              </div>
                              {classData.groupedTests.completed.length > 3 && (
                                <button
                                  onClick={() => toggleCompletedSection(classId)}
                                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center"
                                >
                                  {expandedCompletedSections.has(classId) ? (
                                    <>
                                      <ChevronUp className="h-4 w-4 mr-1" />
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-4 w-4 mr-1" />
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

                            return (
                              <div key={test.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {test.title}
                                      </h3>
                                      {/* Test Type Badge */}
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      }`}>
                                        {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                                          ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                                            ? '📝 Essay'
                                            : '📝📊 Mixed'
                                          : '📊 MCQ'
                                        }
                                      </span>
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                        Completed
                                      </span>
                                    </div>
                                    {testAttempts[test.id] && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Best Score: {testAttempts[test.id].bestScore || 0} • {testAttempts[test.id].completedAttempts?.length || 0} completed attempt{(testAttempts[test.id].completedAttempts?.length || 0) !== 1 ? 's' : ''}
                                        {testAttempts[test.id].activeAttempts?.length > 0 && (
                                          <span> • {testAttempts[test.id].activeAttempts.length} in progress</span>
                                        )}
                                      </p>
                                    )}
                                    {/* Test Description */}
                                    {test.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {test.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-4 md:mt-0">
                                    <Button 
                                      onClick={buttonConfig.action}
                                      disabled={buttonConfig.disabled}
                                      variant={buttonConfig.variant}
                                      className="inline-flex items-center"
                                    >
                                      <ButtonIcon className="w-4 h-4 mr-2" />
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
        {Object.keys(testsByClass).length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
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
