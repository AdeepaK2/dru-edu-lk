'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Clock, 
  Users, 
  Calendar,
  BarChart3,
  Settings,
  Play,
  Pause,
  Eye,
  Trash2,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  CheckSquare,
  CalendarDays
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import CreateTestModal from '@/components/modals/CreateTestModal';
import CreateStudentTestModal from '@/components/modals/CreateStudentTestModal';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { TestService } from '@/apiservices/testService';
import { SubmissionService } from '@/apiservices/submissionService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { questionBankService } from '@/apiservices/questionBankFirestoreService';
import { teacherAccessBankService } from '@/apiservices/teacherAccessBankService';
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';
import { Test, LiveTest, FlexibleTest, TestExtension, TestTemplate } from '@/models/testSchema';
import { ClassDocument } from '@/models/classSchema';
import { QuestionBank } from '@/models/questionBankSchema';
import { Timestamp } from 'firebase/firestore';
import { TestExtensionService } from '@/apiservices/testExtensionService';
import { TestTemplateService } from '@/apiservices/testTemplateService';
import ExtendTestModal from '@/components/teacher/ExtendTestModal';
import UseTemplateModal from '@/components/modals/UseTemplateModal'; // NEW
import ViewAssignedStudentsModal from '@/components/modals/ViewAssignedStudentsModal';
import LateSubmissionModal from '@/components/modals/LateSubmissionModal';
import ExamPDFViewer from '@/components/teacher/ExamPDFViewer';
import { TestTemplatesView } from './TestTemplatesView';

export default function TeacherTests() {
  const { teacher, loading: authLoading, error: authError } = useTeacherAuth();
  const { showSuccess } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [coTests, setCoTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUseTemplateModal, setShowUseTemplateModal] = useState(false); // NEW
  const [selectedTemplateForModal, setSelectedTemplateForModal] = useState<TestTemplate | null>(null); // NEW
  const [showCreateStudentTestModal, setShowCreateStudentTestModal] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<ClassDocument[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [coClasses, setCoClasses] = useState<ClassDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'main' | 'co'>('main');
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [loadingQuestionBanks, setLoadingQuestionBanks] = useState(true);
  
  // Extension modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [testToExtend, setTestToExtend] = useState<FlexibleTest | null>(null);
  
  // View assigned students modal state
  const [showViewStudentsModal, setShowViewStudentsModal] = useState(false);
  const [testToViewStudents, setTestToViewStudents] = useState<Test | null>(null);
  
  // Late submission modal state
  const [showLateSubmissionModal, setShowLateSubmissionModal] = useState(false);
  const [testForLateSubmission, setTestForLateSubmission] = useState<Test | null>(null);
  
  // New state for class-based view
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTemplateIdForModal, setSelectedTemplateIdForModal] = useState<string | undefined>(undefined); // State for passing template to modal
  const [viewMode, setViewMode] = useState<'overview' | 'class-detail' | 'custom-tests' | 'templates'>('overview');
  
  // State for tracking student enrollment counts per class
  const [classEnrollmentCounts, setClassEnrollmentCounts] = useState<Record<string, number>>({});
  
  // State for tracking test completion counts for live tests
  const [testCompletionCounts, setTestCompletionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (authLoading) {
      console.log('⏳ Authentication still loading, waiting...');
      return;
    }

    if (authError) {
      console.error('❌ Authentication error:', authError);
      return;
    }

    if (teacher) {
      loadTeacherData();
    }
  }, [teacher, authLoading, authError]);

  // Periodic update for live test completion counts
  useEffect(() => {
    if (tests.length === 0) return;
    
    const liveTests = tests.filter(test => test.type === 'live');
    if (liveTests.length === 0) return;
    
    // Update completion counts every 30 seconds for live tests
    const interval = setInterval(() => {
      loadCompletionCounts(tests);
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [tests]);

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      setLoadingClasses(true);
      setLoadingQuestionBanks(true);
      
      console.log('🔍 Teacher ID in tests page:', teacher!.id);
      console.log('🔍 Teacher object:', teacher);
      console.log('🔍 Teacher name:', teacher!.name);
      console.log('🔍 Teacher email:', teacher!.email);
      
      // Load teacher's assigned classes first
      const assignedClasses = await ClassFirestoreService.getClassesByTeacher(teacher!.id);
      setTeacherClasses(assignedClasses);
      
      // Load co-teacher classes
      const coTeacherClasses = await ClassFirestoreService.getClassesByCoTeacher(teacher!.id);
      setCoClasses(coTeacherClasses);
      setLoadingClasses(false);
      
      console.log('✅ Loaded teacher classes in TESTS page:', assignedClasses.length);
      console.log('✅ Loaded co-teacher classes in TESTS page:', coTeacherClasses.length);
      console.log('✅ Actual classes data:', assignedClasses);
      console.log('✅ Actual co-classes data:', coTeacherClasses);
      
      // Load question banks that teacher has access to
      console.log('🔍 Loading accessible question banks for teacher:', teacher!.id);
      
      try {
        // DEBUG: Check teacher access records first
        console.log('🔍 DEBUG: Checking teacher access records...');
        
        // Get question banks through teacher access system
        const accessibleBanks = await teacherAccessBankService.getAccessibleQuestionBanks(teacher!.id);
        console.log('✅ Found accessible banks through access system:', accessibleBanks.length);
        console.log('✅ Raw access records:', accessibleBanks.map(a => ({
          bankId: a.questionBankId,
          bankName: a.questionBankName,
          subjectId: a.subjectId,
          subjectName: a.subjectName,
          accessType: a.accessType,
          isActive: a.isActive,
          teacherId: a.teacherId
        })));
        
        if (accessibleBanks.length > 0) {
          // Get the actual question bank details
          const questionBankPromises = accessibleBanks.map(async (access) => {
            try {
              return await questionBankService.getQuestionBank(access.questionBankId);
            } catch (error) {
              console.warn(`Failed to load question bank ${access.questionBankId}:`, error);
              return null;
            }
          });
          
          const questionBankResults = await Promise.all(questionBankPromises);
          const validQuestionBanks = questionBankResults.filter(bank => bank !== null);
          
          setQuestionBanks(validQuestionBanks);
          console.log('✅ Final accessible question banks loaded:', validQuestionBanks.length);
          console.log('✅ Question banks details:', validQuestionBanks.map(b => ({ 
            id: b.id, 
            name: b.name, 
            subject: b.subjectName,
            subjectId: b.subjectId,
            totalQuestions: b.totalQuestions
          })));

          // Debug: Check if any banks match current subjects
          const teacherSubjectIds = Array.from(new Set(assignedClasses.map(cls => cls.subjectId)));
          console.log('🔍 Teacher subject IDs:', teacherSubjectIds);
          const matchingBanks = validQuestionBanks.filter(bank => teacherSubjectIds.includes(bank.subjectId));
          console.log('🔍 Question banks matching teacher subjects:', matchingBanks.length);
        } else {
          console.log('ℹ️ No accessible question banks found for teacher');
          setQuestionBanks([]);
        }
      } catch (bankError) {
        console.warn('Error loading accessible question banks:', bankError);
        setQuestionBanks([]);
      }
      setLoadingQuestionBanks(false);
      
      // Try to load teacher tests, but don't fail if there are none
      try {
        const teacherTests = await TestService.getTeacherTests(teacher!.id);
        setTests(teacherTests);
        console.log('✅ Loaded teacher tests:', teacherTests.length);
        
        // Load completion counts for live tests
        await loadCompletionCounts(teacherTests);
      } catch (testError) {
        console.warn('No tests found for teacher (this is normal for new teachers):', testError);
        setTests([]); // Set empty array if no tests
      }

      // Load test templates
      try {
        console.log('🔍 Loading templates for teacher:', teacher!.id);
        const teacherTemplates = await TestTemplateService.getTemplatesByTeacher(teacher!.id);
        setTemplates(teacherTemplates);
        console.log('✅ Loaded templates:', teacherTemplates.length);
      } catch (templateError) {
        console.warn('Failed to load templates:', templateError);
        setTemplates([]);
      }
      
      // Load tests for co-teacher classes
      try {
        if (coTeacherClasses.length > 0) {
          const coClassIds = coTeacherClasses.map(cls => cls.id);
          console.log('🔍 Loading tests for co-teacher classes:', coClassIds);
          
          // Query tests assigned to co-teacher classes
          const allTests = await TestService.getStudentTests('', coClassIds);
          
          // Filter out tests created by this teacher (to avoid duplicates)
          const coTeacherTests = allTests.filter(test => test.teacherId !== teacher!.id);
          
          setCoTests(coTeacherTests);
          console.log('✅ Loaded co-teacher tests:', coTeacherTests.length);
        } else {
          setCoTests([]);
        }
      } catch (coTestError) {
        console.warn('No co-teacher tests found:', coTestError);
        setCoTests([]);
      }

      // Load enrollment counts for each class
      const allClasses = [...assignedClasses, ...coTeacherClasses];
      await loadEnrollmentCounts(allClasses);
    } catch (error) {
      console.error('Error loading teacher data:', error);
      alert('Failed to load teacher data. Please refresh the page.');
    } finally {
      setLoading(false);
      setLoadingClasses(false);
      setLoadingQuestionBanks(false);
    }
  };

  // Function to load enrollment counts for classes
  const loadEnrollmentCounts = async (classes: ClassDocument[]) => {
    try {
      const enrollmentCounts: Record<string, number> = {};
      
      // Load enrollment count for each class
      await Promise.all(
        classes.map(async (classItem) => {
          try {
            const enrollments = await getEnrollmentsByClass(classItem.id);
            // Only count active enrollments
            const activeEnrollments = enrollments.filter(e => e.status === 'Active');
            enrollmentCounts[classItem.id] = activeEnrollments.length;
            console.log(`✅ Class ${classItem.name}: ${activeEnrollments.length} active students`);
          } catch (error) {
            console.warn(`Failed to load enrollments for class ${classItem.id}:`, error);
            enrollmentCounts[classItem.id] = 0;
          }
        })
      );
      
      setClassEnrollmentCounts(enrollmentCounts);
      console.log('✅ Loaded enrollment counts:', enrollmentCounts);
    } catch (error) {
      console.error('Error loading enrollment counts:', error);
    }
  };

  // Function to load completion counts for live tests
  const loadCompletionCounts = async (tests: Test[]) => {
    try {
      const completionCounts: Record<string, number> = {};
      
      // Get completion counts for live tests that are currently active
      await Promise.all(
        tests.map(async (test) => {
          if (test.type === 'live') {
            try {
              const submissions = await SubmissionService.getTestSubmissions(test.id);
              // Count only completed submissions (submitted or auto_submitted)
              const completedSubmissions = submissions.filter(s => 
                s.status === 'submitted' || s.status === 'auto_submitted'
              );
              completionCounts[test.id] = completedSubmissions.length;
            } catch (error) {
              console.warn(`Failed to load submissions for test ${test.id}:`, error);
              completionCounts[test.id] = 0;
            }
          }
        })
      );
      
      setTestCompletionCounts(completionCounts);
      console.log('✅ Loaded completion counts:', completionCounts);
    } catch (error) {
      console.error('Error loading completion counts:', error);
    }
  };

  const handleTestCreated = (newTest: Test) => {
    console.log('🎯 Test created callback received:', {
      id: newTest.id,
      title: newTest.title,
      questionType: newTest.config?.questionType,
      examPdfUrl: (newTest as any).examPdfUrl,
      hasQuestions: !!newTest.questions?.length,
      questionTypes: newTest.questions?.map(q => q.questionType || q.type)
    });
    
    // Add the new test immediately to the UI
    setTests(prev => [newTest, ...prev]);
    setShowCreateModal(false);
    
    // Show success toast
    showSuccess(`Test "${newTest.title}" created successfully!`);
    
    // For essay tests, refresh data multiple times to catch PDF generation
    if (newTest.config?.questionType === 'essay' || 
        newTest.questions?.some(q => q.questionType === 'essay' || q.type === 'essay')) {
      
      console.log('📄 Essay test detected, setting up PDF refresh intervals...');
      
      // Immediate refresh after 2 seconds
      setTimeout(() => {
        console.log('🔄 First PDF refresh (2s)...');
        loadTeacherData();
      }, 2000);
      
      // Second refresh after 5 seconds  
      setTimeout(() => {
        console.log('🔄 Second PDF refresh (5s)...');
        loadTeacherData();
      }, 5000);
      
      // Third refresh after 10 seconds
      setTimeout(() => {
        console.log('🔄 Final PDF refresh (10s)...');
        loadTeacherData();
      }, 10000);
    }
    
    // If we were creating for a specific class, stay in class detail view
    // Otherwise go back to overview
  };

  // Handle test created for selected students
  const handleStudentTestCreated = (newTest: Test) => {
    setTests(prev => [newTest, ...prev]);
    setShowCreateStudentTestModal(false);
    
    // Show success toast for custom test
    showSuccess(`Custom test "${newTest.title}" created successfully!`);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowCreateModal(false);
    setSelectedTemplateIdForModal(undefined); // Reset template state
    // Reset selected class if we were in overview mode
    if (viewMode === 'overview') {
      setSelectedClassId(null);
    }
  };

  // Handle class selection
  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setViewMode('class-detail');
  };

  // Handle back to overview
  const handleBackToOverview = () => {
    setSelectedClassId(null);
    setViewMode('overview');
  };

  // Handle create test for specific class
  const handleCreateTestForClass = (classId: string) => {
    setSelectedClassId(classId);
    setShowCreateModal(true);
  };

  // Get selected class info
  const getSelectedClass = () => {
    const allClasses = [...teacherClasses, ...coClasses];
    return allClasses.find(cls => cls.id === selectedClassId);
  };

  // Get tests for selected class (excluding custom/student-based tests and retests)
  const getTestsForClass = (classId: string) => {
    const allTestsToCheck = activeTab === 'main' ? tests : coTests;
    return allTestsToCheck.filter(test => {
      // Exclude custom tests (student-based assignments)
      const isCustomTest = test.assignmentType === 'student-based';
      if (isCustomTest) {
        return false;
      }

      // Retests live in their own Retakes view, not the main class test list
      if (test.isRetest === true) {
        return false;
      }

      // Only include tests assigned to this specific class
      return test.classIds.includes(classId);
    });
  };

  // Get retake tests for a specific class (used by the Retakes view)
  const getRetakesForClass = (classId: string) => {
    const allTestsToCheck = activeTab === 'main' ? tests : coTests;
    return allTestsToCheck.filter(test => {
      if (test.assignmentType === 'student-based') return false;
      if (test.isRetest !== true) return false;
      return test.classIds.includes(classId);
    });
  };
  
  // Check if current teacher can create tests for a class (only main teachers)
  const canCreateTestsForClass = (classId: string) => {
    return teacherClasses.some(cls => cls.id === classId);
  };

  // Get unique subjects from teacher's classes
  const getTeacherSubjects = () => {
    const uniqueSubjects = Array.from(
      new Set(teacherClasses.map(cls => cls.subjectId))
    );
    
    return uniqueSubjects.map(subjectId => {
      const classWithSubject = teacherClasses.find(cls => cls.subjectId === subjectId);
      return {
        id: subjectId,
        name: classWithSubject?.subject || subjectId
      };
    });
  };

  // Check if test has essay questions
  const hasEssayQuestions = (test: Test) => {
    return test.questions.some(question => 
      question.type === 'essay' || question.questionType === 'essay'
    );
  };

  // Navigate to marking page
  const handleMarkSubmissions = (testId: string) => {
    // Navigate to the marking page
    window.location.href = `/teacher/tests/${testId}/mark`;
  };

  // Navigate to results page
  const handleViewResults = (testId: string) => {
    // Navigate to the results page
    window.location.href = `/teacher/tests/${testId}/results`;
  };

  // Handle extend test deadline
  const handleExtendDeadline = (test: Test) => {
    if (test.type === 'flexible') {
      setTestToExtend(test as FlexibleTest);
      setShowExtendModal(true);
    }
  };

  // Handle extension created
  const handleExtensionCreated = (extension: TestExtension) => {
    // Refresh the test data to show updated deadline
    loadTeacherData();
    alert(`✅ Test deadline extended successfully until ${extension.newDeadline.toDate().toLocaleDateString()}`);
  };

  // Handle view assigned students
  const handleViewAssignedStudents = (test: Test) => {
    setTestToViewStudents(test);
    setShowViewStudentsModal(true);
  };

  // Handle late submission approval
  const handleLateSubmission = (test: Test) => {
    setTestForLateSubmission(test);
    setShowLateSubmissionModal(true);
  };

  // Handle late submission approved
  const handleLateSubmissionApproved = () => {
    // Refresh the test data
    loadTeacherData();
    alert('✅ Late submission opportunity has been approved for selected students.');
  };

  // Check if a flexible test can be extended
  const canExtendTest = (test: Test): boolean => {
    if (test.type !== 'flexible') return false;
    
    const flexTest = test as FlexibleTest;
    const now = Timestamp.now();
    
    // Can extend if test hasn't ended yet
    return now.seconds < flexTest.availableTo.seconds;
  };

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

  const getTestStatus = (test: Test) => {
    const now = Timestamp.now();
    
    if (test.type === 'live') {
      const liveTest = test as LiveTest;
      
      // Add null checks for timestamps
      if (!liveTest.studentJoinTime || !liveTest.actualEndTime) {
        console.warn('Live test missing required timestamps:', test.id);
        return { status: 'upcoming', color: 'gray', text: 'Pending' };
      }
      
      if (now.seconds < liveTest.studentJoinTime.seconds) {
        return { status: 'upcoming', color: 'blue', text: 'Upcoming' };
      } else if (now.seconds >= liveTest.studentJoinTime.seconds && now.seconds <= liveTest.actualEndTime.seconds) {
        return { status: 'live', color: 'green', text: 'Live' };
      } else {
        return { status: 'completed', color: 'gray', text: 'Completed' };
      }
    } else {
      const flexTest = test as FlexibleTest;
      
      // Add null checks for timestamps
      if (!flexTest.availableFrom || !flexTest.availableTo) {
        console.warn('Flexible test missing required timestamps:', test.id);
        return { status: 'upcoming', color: 'gray', text: 'Pending' };
      }
      
      if (now.seconds < flexTest.availableFrom.seconds) {
        return { status: 'upcoming', color: 'blue', text: 'Upcoming' };
      } else if (now.seconds >= flexTest.availableFrom.seconds && now.seconds <= flexTest.availableTo.seconds) {
        return { status: 'active', color: 'green', text: 'Active' };
      } else {
        return { status: 'completed', color: 'gray', text: 'Completed' };
      }
    }
  };

  const deleteTest = async (testId: string) => {
    const confirmMessage = `⚠️ WARNING: This will permanently delete the test and ALL related data including:

• Student submissions and grades
• Test analytics and reports  
• Student attempts and progress data

This action CANNOT be undone. Are you absolutely sure you want to delete this test?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Use Firebase client service directly
      await TestService.deleteTest(testId);
      setTests(prev => prev.filter(test => test.id !== testId));
      alert('✅ Test and all related data have been successfully deleted.');
    } catch (error) {
      console.error('Error deleting test:', error);
      alert('❌ Failed to delete test. Please try again.');
    }
  };

  if (authLoading || loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {viewMode === 'overview' ? (
          // Overview Mode - Show all classes and general stats
          <>
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Tests & Quizzes
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    Create and manage tests for your assigned classes
                  </p>
                  {loadingClasses ? (
                    <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Loading your classes...
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {(activeTab === 'main' ? teacherClasses : coClasses).length > 0 ? (
                        <>
                          {activeTab === 'main' ? 'Assigned to' : 'Co-teaching'} {(activeTab === 'main' ? teacherClasses : coClasses).length} class{(activeTab === 'main' ? teacherClasses : coClasses).length !== 1 ? 'es' : ''}: {' '}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {(activeTab === 'main' ? teacherClasses : coClasses).map(cls => `${cls.name} (${cls.subject})`).join(', ')}
                          </span>
                        </>
                      ) : (
                        <span className="text-orange-600 dark:text-orange-400 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {activeTab === 'main' 
                            ? 'No classes assigned - contact administrator to create tests'
                            : 'No co-teacher classes assigned'
                          }
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('main')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'main'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  My Classes ({teacherClasses.length})
                </button>
                <button
                  onClick={() => setActiveTab('co')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'co'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Co-Classes ({coClasses.length})
                </button>
              </div>
            </div>

            {/* Your Classes and Custom Tests */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {activeTab === 'main' ? 'Your Classes' : 'Co-Teacher Classes'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {activeTab === 'main' 
                    ? 'Click on a class to view and create tests'
                    : 'Click on a class to view tests created by the main teacher'
                  }
                </p>
              </div>

              <div className="p-6">
                {loadingClasses ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">Loading classes...</p>
                  </div>
                ) : (activeTab === 'main' ? teacherClasses : coClasses).length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {activeTab === 'main' ? 'No Classes Assigned' : 'No Co-Teacher Classes'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      {activeTab === 'main'
                        ? 'You need to be assigned to at least one class before you can create tests. Please contact your administrator to assign you to classes.'
                        : 'You are not assigned as a co-teacher to any classes yet.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(activeTab === 'main' ? teacherClasses : coClasses).map((classItem) => {
                      const classTests = getTestsForClass(classItem.id);
                      const activeTests = classTests.filter(test => {
                        const status = getTestStatus(test);
                        return (status.status === 'live' || status.status === 'active') && 
                               test.assignmentType !== 'student-based';
                      });

                      return (
                        <div
                          key={classItem.id}
                          onClick={() => handleClassClick(classItem.id)}
                          className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="bg-white dark:bg-gray-800 rounded-full p-3">
                              <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex flex-col space-y-1">
                              {activeTab === 'co' && (
                                <span className="text-xs bg-purple-200 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-1 rounded-full text-center">
                                  Co-Teacher
                                </span>
                              )}
                              <span className="text-xs bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full">
                                {classItem.year}
                              </span>
                            </div>
                          </div>
                          
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {classItem.name}
                          </h3>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            {classItem.subject}
                          </p>
                          
                          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {classEnrollmentCounts[classItem.id] || 0} students
                            </span>
                            <span className="flex items-center">
                              <FileText className="h-4 w-4 mr-1" />
                              {classTests.length} tests
                            </span>
                          </div>
                          
                          {activeTests.length > 0 && (
                            <div className="mt-3 flex items-center text-xs text-green-600 dark:text-green-400">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                              {activeTests.length} active test{activeTests.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Only show Custom Tests for main teacher tab */}
                    {activeTab === 'main' && (
                      <div
                        onClick={() => setViewMode('custom-tests')}
                        className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-700 dark:to-gray-600 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed border-green-300 dark:border-green-600"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="bg-white dark:bg-gray-800 rounded-full p-3">
                            <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="text-xs bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300 px-2 py-1 rounded-full">
                            Custom
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Custom Tests
                        </h3>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          Individual student assignments
                        </p>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <FileText className="h-4 w-4 mr-1" />
                            {tests.filter(test => test.assignmentType === 'student-based').length} tests
                          </span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            View & Create →
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Test Templates Card - Only for main teacher tab */}
                    {activeTab === 'main' && (
                      <div
                        onClick={() => setViewMode('templates')}
                        className="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-700 dark:to-gray-600 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed border-indigo-300 dark:border-indigo-600"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="bg-white dark:bg-gray-800 rounded-full p-3">
                            <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="text-xs bg-indigo-200 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 px-2 py-1 rounded-full">
                            Templates
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Test Templates
                        </h3>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          Reuse previous tests as templates
                        </p>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <FileText className="h-4 w-4 mr-1" />
                            {templates.length} available
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                            View All →
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Test Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {activeTab === 'main' ? 'Total Students' : 'Co-Class Students'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {activeTab === 'main' 
                        ? Object.values(classEnrollmentCounts).reduce((sum, count) => sum + count, 0)
                        : coClasses.reduce((sum, cls) => sum + (classEnrollmentCounts[cls.id] || 0), 0)
                      }
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Across {activeTab === 'main' ? teacherClasses.length : coClasses.length} class{(activeTab === 'main' ? teacherClasses.length : coClasses.length) !== 1 ? 'es' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {activeTab === 'main' ? 'My Tests' : 'Co-Class Tests'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(activeTab === 'main' ? tests : coTests).filter(t => t.isRetest !== true).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Play className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Active Tests
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(activeTab === 'main' ? tests : coTests).filter(test => {
                        if (test.isRetest === true) return false;
                        const status = getTestStatus(test);
                        return status.status === 'live' || status.status === 'active';
                      }).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Upcoming
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(activeTab === 'main' ? tests : coTests).filter(test => test.isRetest !== true && getTestStatus(test).status === 'upcoming').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Completed
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(activeTab === 'main' ? tests : coTests).filter(test => test.isRetest !== true && getTestStatus(test).status === 'completed').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : viewMode === 'custom-tests' ? (
          // Custom Tests Mode - Show all individual/custom tests
          <>
            {/* Custom Tests Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={() => setViewMode('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Custom Tests
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">
                      Tests assigned to individual students across different classes
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateStudentTestModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Custom Test
                </button>
              </div>
            </div>

            {/* Custom Tests List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6">
                {tests.filter(test => test.assignmentType === 'student-based').length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No custom tests created yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Create tests for specific students across different classes
                    </p>
                    <button
                      onClick={() => setShowCreateStudentTestModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Create Your First Custom Test
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tests
                      .filter(test => test.assignmentType === 'student-based')
                      .map((test) => {
                        const status = getTestStatus(test);

                        return (
                          <div
                            key={test.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                    {test.title}
                                  </h3>
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      status.color === 'green'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                        : status.color === 'blue'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                        : status.color === 'orange'
                                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                    }`}
                                  >
                                    {status.text}
                                  </span>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                                    {test.type === 'live' ? 'Live Test' : 'Flexible'}
                                  </span>
                                  {test.type === 'flexible' && (test as any).isUntimed && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400">
                                      ⏱️ Untimed
                                    </span>
                                  )}
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                    Custom
                                  </span>
                                </div>

                                {test.description && (
                                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                                    {test.description}
                                  </p>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                  <div className="flex items-center space-x-1">
                                    <FileText className="h-4 w-4" />
                                    <span>{test.questions.length} questions</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                      {test.type === 'live' 
                                        ? `${(test as LiveTest).duration} min`
                                        : (test as any).isUntimed 
                                          ? 'No time limit'
                                          : `${(test as FlexibleTest).duration} min`
                                      }
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="h-4 w-4" />
                                    <span>
                                      {test.type === 'live' 
                                        ? formatDateTime((test as LiveTest).scheduledStartTime)
                                        : `${formatDateTime((test as FlexibleTest).availableFrom)}`
                                      }
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Users className="h-4 w-4" />
                                    <button
                                      onClick={() => handleViewAssignedStudents(test)}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:underline transition-colors"
                                      title="View assigned students"
                                    >
                                      {test.totalAssignedStudents || 0} students
                                    </button>
                                  </div>
                                </div>

                                {/* Show deadline for flexible tests */}
                                {test.type === 'flexible' && (
                                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <CalendarDays className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                                          Current Deadline
                                        </span>
                                        {(test as FlexibleTest).isExtended && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                                            Extended
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                                        {formatDateTime((test as FlexibleTest).availableTo)}
                                      </span>
                                    </div>
                                    {(test as FlexibleTest).isExtended && (test as FlexibleTest).originalAvailableTo && (
                                      <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                        Originally: {formatDateTime((test as FlexibleTest).originalAvailableTo)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Exam PDF Viewer for essay tests - DEBUG */}
                                {(() => {
                                  const hasEssayType = test.config?.questionType === 'essay';
                                  const hasPdfUrl = !!(test as any).examPdfUrl;
                                  const hasEssayQuestions = test.questions?.some(q => q.questionType === 'essay' || q.type === 'essay');
                                  
                                  console.log('🔍 PDF Viewer Debug for test:', test.id, {
                                    title: test.title,
                                    configQuestionType: test.config?.questionType,
                                    hasEssayType,
                                    examPdfUrl: (test as any).examPdfUrl,
                                    hasPdfUrl,
                                    hasEssayQuestions,
                                    questionCount: test.questions?.length,
                                    firstQuestionType: test.questions?.[0]?.questionType || test.questions?.[0]?.type
                                  });
                                  
                                  const shouldShowPDF = (hasEssayType || hasEssayQuestions) && hasPdfUrl;
                                  
                                  if (shouldShowPDF) {
                                    return (
                                      <div className="mb-3">
                                        <ExamPDFViewer
                                          examPdfUrl={(test as any).examPdfUrl}
                                          testTitle={test.title}
                                          testNumber={test.displayNumber || test.testNumber?.toString() || '1'}
                                        />
                                      </div>
                                    );
                                  }
                                  
                                  return null;
                                })()}

                                {test.totalAssignedStudents && test.assignmentSummary && (
                                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="text-sm text-green-800 dark:text-green-400">
                                      <span className="font-medium">Assigned to:</span>{' '}
                                      <button
                                        onClick={() => handleViewAssignedStudents(test)}
                                        className="font-semibold text-green-900 dark:text-green-300 hover:underline cursor-pointer"
                                        title="View assigned students"
                                      >
                                        {test.totalAssignedStudents} students
                                      </button>{' '}
                                      across {test.assignmentSummary.classesInvolved?.length || 0} class{(test.assignmentSummary.classesInvolved?.length || 0) !== 1 ? 'es' : ''}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center space-x-3 ml-4">
                                {hasEssayQuestions(test) && (
                                  <button
                                    onClick={() => handleMarkSubmissions(test.id)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                  >
                                    <CheckSquare className="h-4 w-4 mr-2" />
                                    Mark
                                  </button>
                                )}
                                
                                {/* Extend Deadline button for flexible tests */}
                                {test.type === 'flexible' && canExtendTest(test) && (
                                  <button
                                    onClick={() => handleExtendDeadline(test)}
                                    className="inline-flex items-center px-4 py-2 border border-orange-600 text-sm font-medium rounded-md text-orange-600 bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                                    title="Extend Deadline"
                                  >
                                    <CalendarDays className="h-4 w-4 mr-2" />
                                    Extend
                                  </button>
                                )}
                                
                                {/* Late Submission button for class-based tests that have ended */}
                                {test.assignmentType !== 'student-based' && status.status === 'completed' && (
                                  <button
                                    onClick={() => handleLateSubmission(test)}
                                    className="inline-flex items-center px-4 py-2 border border-orange-600 text-sm font-medium rounded-md text-orange-600 bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                                    title="Allow Late Submissions"
                                  >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Late Submissions
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => handleViewResults(test.id)}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                >
                                  <BarChart3 className="h-4 w-4 mr-2" />
                                  Results
                                </button>
                                
                                <button
                                  onClick={() => deleteTest(test.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Delete Test"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : viewMode === 'templates' ? (
          <TestTemplatesView
            templates={templates}
            classes={[...teacherClasses, ...coClasses]}
            onBack={() => setViewMode('overview')}
            onUseTemplate={(template) => {
              // Open NEW streamlined template modal
              console.log('Using template quickly:', template.title);
              setShowCreateModal(false); // Ensure create modal is closed
              setSelectedTemplateForModal(template);
              setShowUseTemplateModal(true);
            }}
            onDeleteTemplate={async (templateId) => {
              try {
                await TestTemplateService.deleteTemplate(templateId);
                // Remove from local state
                setTemplates(prev => prev.filter(t => t.id !== templateId));
                showSuccess('Template deleted successfully');
              } catch (error) {
                console.error('Failed to delete template:', error);
                // toast.error('Failed to delete template');
              }
            }}
          />
        ) : (
          // Class Detail Mode - Show tests for selected class
          <>
            {(() => {
              const selectedClass = getSelectedClass();
              const classTests = selectedClassId ? getTestsForClass(selectedClassId) : [];

              return (
                <>
                  {/* Class Detail Header */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <button
                          onClick={handleBackToOverview}
                          className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {selectedClass?.name} - Tests
                          </h1>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center">
                              <BookOpen className="h-4 w-4 mr-1" />
                              {selectedClass?.subject}
                            </span>
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {selectedClass ? (classEnrollmentCounts[selectedClass.id] || 0) : 0} students
                            </span>
                            <span className="flex items-center">
                              <FileText className="h-4 w-4 mr-1" />
                              {classTests.length} tests created
                            </span>
                          </div>
                        </div>
                      </div>
                      {canCreateTestsForClass(selectedClassId!) && (
                        <button
                          onClick={() => handleCreateTestForClass(selectedClassId!)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Test
                        </button>
                      )}
                      {!canCreateTestsForClass(selectedClassId!) && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg">
                          <span>Only the main teacher can create tests for this class</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Class Tests List */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                        Tests for {selectedClass?.name}
                      </h2>
                    </div>

                    <div className="p-6">
                      {classTests.length === 0 ? (
                        <div className="text-center py-12">
                          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No tests created yet
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 mb-6">
                            Create your first test for {selectedClass?.name}
                          </p>
                          <button
                            onClick={() => handleCreateTestForClass(selectedClassId!)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Test
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {classTests.map((test) => {
                            const status = getTestStatus(test);
                            const isLive = test.type === 'live' ? test as LiveTest : null;

                            return (
                              <div
                                key={test.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                        {test.title}
                                      </h3>
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          status.color === 'green'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                            : status.color === 'blue'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                            : status.color === 'orange'
                                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                        }`}
                                      >
                                        {status.text}
                                      </span>
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                                        {test.type === 'live' ? 'Live Test' : 'Flexible'}
                                      </span>
                                      {test.type === 'flexible' && (test as any).isUntimed && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400">
                                          ⏱️ Untimed
                                        </span>
                                      )}
                                    </div>

                                    {test.description && (
                                      <p className="text-gray-600 dark:text-gray-300 mb-3">
                                        {test.description}
                                      </p>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-500 dark:text-gray-400">
                                      <div className="flex items-center space-x-1">
                                        <FileText className="h-4 w-4" />
                                        <span>{test.questions.length} questions</span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Clock className="h-4 w-4" />
                                        <span>
                                          {test.type === 'live' 
                                            ? `${(test as LiveTest).duration} min`
                                            : (test as any).isUntimed
                                              ? 'No time limit'
                                              : `${(test as FlexibleTest).duration} min`
                                          }
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Calendar className="h-4 w-4" />
                                        <span>
                                          {test.type === 'live' 
                                            ? formatDateTime((test as LiveTest).scheduledStartTime)
                                            : `${formatDateTime((test as FlexibleTest).availableFrom)}`
                                          }
                                        </span>
                                      </div>
                                    </div>

                                    {/* Show deadline for flexible tests */}
                                    {test.type === 'flexible' && (
                                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-2">
                                            <CalendarDays className="h-4 w-4 text-blue-600" />
                                            <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                                              Current Deadline
                                            </span>
                                            {(test as FlexibleTest).isExtended && (
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                                                Extended
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                                            {formatDateTime((test as FlexibleTest).availableTo)}
                                          </span>
                                        </div>
                                        {(test as FlexibleTest).isExtended && (test as FlexibleTest).originalAvailableTo && (
                                          <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                            Originally: {formatDateTime((test as FlexibleTest).originalAvailableTo)}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Exam PDF Viewer for essay tests - DEBUG */}
                                    {(() => {
                                      const hasEssayType = test.config?.questionType === 'essay';
                                      const hasPdfUrl = !!(test as any).examPdfUrl;
                                      const hasEssayQuestions = test.questions?.some(q => q.questionType === 'essay' || q.type === 'essay');
                                      
                                      console.log('🔍 PDF Viewer Debug for class test:', test.id, {
                                        title: test.title,
                                        configQuestionType: test.config?.questionType,
                                        hasEssayType,
                                        examPdfUrl: (test as any).examPdfUrl,
                                        hasPdfUrl,
                                        hasEssayQuestions,
                                        questionCount: test.questions?.length,
                                        firstQuestionType: test.questions?.[0]?.questionType || test.questions?.[0]?.type
                                      });
                                      
                                      const shouldShowPDF = (hasEssayType || hasEssayQuestions) && hasPdfUrl;
                                      
                                      if (shouldShowPDF) {
                                        return (
                                          <div className="mt-4">
                                            <ExamPDFViewer
                                              examPdfUrl={(test as any).examPdfUrl}
                                              testTitle={test.title}
                                              testNumber={test.displayNumber || test.testNumber?.toString() || '1'}
                                            />
                                          </div>
                                        );
                                      }
                                      
                                      return null;
                                    })()}

                                    {isLive && status.status === 'live' && (
                                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                          <span className="text-sm font-medium text-green-800 dark:text-green-400">
                                            Test is currently live
                                          </span>
                                        </div>
                                        <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                                          Completed: {testCompletionCounts[test.id] || 0}
                                        </div>
                                      </div>
                                    )}

                                    {status.status === 'upcoming' && (
                                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                          <AlertCircle className="h-4 w-4 text-blue-600" />
                                          <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                                            {test.type === 'live' 
                                              ? `Students can join from ${formatDateTime((test as LiveTest).scheduledStartTime)}`
                                              : `Available from ${formatDateTime((test as FlexibleTest).availableFrom)}`
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-3 ml-4">
                                    {/* Show marking button for essay tests */}
                                    {hasEssayQuestions(test) && (
                                      <button
                                        onClick={() => handleMarkSubmissions(test.id)}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                      >
                                        <CheckSquare className="h-4 w-4 mr-2" />
                                        Mark Answers
                                      </button>
                                    )}
                                    
                                    {/* Extend Deadline button for flexible tests */}
                                    {test.type === 'flexible' && canExtendTest(test) && (
                                      <button
                                        onClick={() => handleExtendDeadline(test)}
                                        className="inline-flex items-center px-4 py-2 border border-orange-600 text-sm font-medium rounded-md text-orange-600 bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                                        title="Extend Deadline"
                                      >
                                        <CalendarDays className="h-4 w-4 mr-2" />
                                        Extend
                                      </button>
                                    )}
                                    
                                    {/* Late Submission button for class-based tests that have ended */}
                                    {test.assignmentType !== 'student-based' && status.status === 'completed' && (
                                      <button
                                        onClick={() => handleLateSubmission(test)}
                                        className="inline-flex items-center px-4 py-2 border border-orange-600 text-sm font-medium rounded-md text-orange-600 bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                                        title="Allow Late Submissions"
                                      >
                                        <Clock className="h-4 w-4 mr-2" />
                                        Late Submissions
                                      </button>
                                    )}
                                    
                                    <button
                                      onClick={() => handleViewResults(test.id)}
                                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                    >
                                      <BarChart3 className="h-4 w-4 mr-2" />
                                      View Results
                                    </button>
                                    
                                    <button
                                      onClick={() => deleteTest(test.id)}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Delete Test"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* Create Test Modal */}
        {showCreateModal && teacherClasses.length > 0 && (
          <CreateTestModal
            isOpen={showCreateModal}
            onClose={() => handleModalClose()}
            onTestCreated={handleTestCreated}
            initialTemplateId={selectedTemplateIdForModal}
            subjectId={
              selectedClassId 
                ? getSelectedClass()?.subjectId || getTeacherSubjects()[0]?.id || ''
                : getTeacherSubjects()[0]?.id || ''
            }
            subjectName={
              selectedClassId 
                ? getSelectedClass()?.subject || getTeacherSubjects()[0]?.name || ''
                : getTeacherSubjects()[0]?.name || ''
            }
            selectedClassId={selectedClassId || undefined}
            availableClasses={
              selectedClassId
                ? teacherClasses.filter(cls => cls.id === selectedClassId).map(cls => ({
                    id: cls.id,
                    name: cls.name,
                    subject: cls.subject,
                    year: cls.year
                  }))
                : teacherClasses.map(cls => ({
                    id: cls.id,
                    name: cls.name,
                    subject: cls.subject,
                    year: cls.year
                  }))
            }
            questionBanks={questionBanks}
          />
        )}

        {/* Create Student Test Modal */}
        {showCreateStudentTestModal && (
          <CreateStudentTestModal
            isOpen={showCreateStudentTestModal}
            onClose={() => setShowCreateStudentTestModal(false)}
            onTestCreated={handleStudentTestCreated}
            subjectId={getTeacherSubjects()[0]?.id || ''}
            subjectName={getTeacherSubjects()[0]?.name || ''}
            teacherClasses={teacherClasses}
            questionBanks={questionBanks}
          />
        )}

        {/* No Classes Assigned Modal/Message */}
        {showCreateModal && teacherClasses.length === 0 && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
              <div className="mt-3 text-center">
                <AlertCircle className="mx-auto h-16 w-16 text-orange-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4">
                  No Classes Assigned
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6">
                  You need to be assigned to at least one class before you can create tests. 
                  Please contact your administrator to assign you to classes.
                </p>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Extend Test Modal */}
        {showExtendModal && testToExtend && teacher && (
          <ExtendTestModal
            isOpen={showExtendModal}
            onClose={() => {
              setShowExtendModal(false);
              setTestToExtend(null);
            }}
            test={testToExtend}
            teacherId={teacher.id}
            teacherName={teacher.name}
            onExtensionCreated={handleExtensionCreated}
          />
        )}

        {/* View Assigned Students Modal */}
        {showViewStudentsModal && testToViewStudents && (
          <ViewAssignedStudentsModal
            isOpen={showViewStudentsModal}
            onClose={() => {
              setShowViewStudentsModal(false);
              setTestToViewStudents(null);
            }}
            test={testToViewStudents}
          />
        )}

        {/* Extend Test Modal */}
        {showExtendModal && testToExtend && teacher && (
          <ExtendTestModal
            isOpen={showExtendModal}
            onClose={() => {
              setShowExtendModal(false);
              setTestToExtend(null);
            }}
            test={testToExtend}
            teacherId={teacher.id}
            teacherName={teacher.name}
            onExtensionCreated={handleExtensionCreated}
          />
        )}

        {/* Late Submission Modal */}
        {showLateSubmissionModal && testForLateSubmission && teacher && (
          <LateSubmissionModal
            isOpen={showLateSubmissionModal}
            onClose={() => {
              setShowLateSubmissionModal(false);
              setTestForLateSubmission(null);
            }}
            test={testForLateSubmission}
            teacherId={teacher.id}
            teacherName={teacher.name}
            onLateSubmissionApproved={handleLateSubmissionApproved}
          />
        )}
      </div>
      
      {/* Use Template Modal */}
      {showUseTemplateModal && selectedTemplateForModal && (
        <UseTemplateModal
          isOpen={showUseTemplateModal}
          onClose={() => setShowUseTemplateModal(false)}
          template={selectedTemplateForModal}
          availableClasses={teacherClasses.map(c => ({
            id: c.id,
            name: c.name,
            subject: c.subject,
            year: c.year
          }))}
          onTestCreated={(createdTest) => {
            console.log('Test created from template:', createdTest);
            // Add to list and close
            setTests(prev => [createdTest, ...prev]);
            setShowUseTemplateModal(false);
            setViewMode('overview'); // Go back to overview to see the new test
            showSuccess('Test created successfully!');
          }}
        />
      )}
    </TeacherLayout>
  );
}
