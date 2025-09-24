'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download,
  Search,
  Calendar,
  Clock,
  Award,
  ChevronRight,
  User,
  XCircle,
  GraduationCap,
  FileText,
  Trophy
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { StudentDetailModal } from '@/components/teacher/StudentDetailModal';
import { GradeAnalyticsLoading, StudentListSkeleton } from '@/components/teacher/GradeAnalyticsSkeletons';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';

// Import services and types
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { 
  GradeAnalyticsService, 
  ClassAnalytics, 
  StudentPerformanceData, 
  PerformanceTrend 
} from '@/apiservices/gradeAnalyticsService';

// Import fast analytics hook
import { useSuperFastAnalytics } from '@/hooks/useSuperFastAnalytics';

export default function ClassGradeAnalytics() {
  const params = useParams();
  const router = useRouter();
  const { teacher } = useTeacherAuth();
  const classId = params.classId as string;

  // Use super fast analytics hook for lightning-fast loading
  const {
    quickStats,
    fullAnalytics,
    loadingQuick,
    loadingFull,
    error: analyticsError,
    isStale,
    lastUpdated,
    refresh: refreshAnalytics,
    forceRecompute,
    cached
  } = useSuperFastAnalytics({
    classId,
    teacherId: teacher?.id || '',
    autoRefresh: true,
    refreshInterval: 30000 // Refresh every 30 seconds
  });

  // Local state for UI management
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [classTests, setClassTests] = useState<any[]>([]);
  const [studentPerformances, setStudentPerformances] = useState<StudentPerformanceData[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  
  const [loadingStates, setLoadingStates] = useState({
    class: true,
    tests: true,
    students: false,
    trends: false
  });
  
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'tests' | 'students'>('tests');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage] = useState(20); // Increased for better performance
  const [hasMoreStudents, setHasMoreStudents] = useState(true);
  const [totalStudentCount, setTotalStudentCount] = useState(0);
  
  // Modal state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudentData, setSelectedStudentData] = useState<StudentPerformanceData | null>(null);
  
  // Success state for showing recovery messages
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Load class data (one-time)
  useEffect(() => {
    const loadClassData = async () => {
      if (!classId || !teacher?.id) return;

      try {
        setLoadingStates(prev => ({ ...prev, class: true }));
        
        const classResult = await ClassFirestoreService.getClassById(classId);
        
        if (!classResult) {
          throw new Error('Class not found');
        }
        
        if (classResult.teacherId !== teacher.id) {
          throw new Error('Access denied: You are not the teacher for this class');
        }
        
        setClassData(classResult);
        console.log('✅ Class data loaded');
        
        // Load class tests for immediate display
        loadClassTests();
        
      } catch (err: any) {
        console.error('❌ Error loading class data:', err);
        setError(err.message);
      } finally {
        setLoadingStates(prev => ({ ...prev, class: false }));
      }
    };

    loadClassData();
  }, [classId, teacher?.id]);

  // Load class tests for immediate display
  const loadClassTests = useCallback(async () => {
    if (!classId) return;

    try {
      setLoadingStates(prev => ({ ...prev, tests: true }));
      
      // Use the existing method from GradeAnalyticsService
      const { query, collection, where, getDocs } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');
      
      // Query tests that include this classId
      const testsQuery = query(
        collection(firestore, 'tests'),
        where('classIds', 'array-contains', classId)
      );
      
      const testsSnapshot = await getDocs(testsQuery);
      const tests = testsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setClassTests(tests || []);
      console.log('📝 Class tests loaded:', tests?.length || 0);
      
    } catch (error) {
      console.error('❌ Error loading class tests:', error);
      setClassTests([]);
    } finally {
      setLoadingStates(prev => ({ ...prev, tests: false }));
    }
  }, [classId]);

  // Handle analytics errors - only set critical errors, not loading failures
  useEffect(() => {
    if (analyticsError && !loadingQuick && !loadingFull) {
      // Only show error if we're not currently loading and have no data at all
      if (!quickStats && !fullAnalytics?.quickStats) {
        setError(analyticsError);
      }
    }
    
    // Clear error if we successfully have data and show success message
    if ((quickStats || fullAnalytics?.quickStats) && error && !error.includes('not found') && !error.includes('Access denied')) {
      setError(null);
      setShowSuccessMessage(true);
      // Auto-hide success message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
  }, [analyticsError, loadingQuick, loadingFull, quickStats, fullAnalytics, error]);

  // Fallback recovery mechanism - if analytics fail, try direct API calls
  const handleAnalyticsRecovery = useCallback(async () => {
    try {
      console.log('🔄 Attempting analytics recovery...');
      setError(null);
      
      // Show loading state during recovery
      setLoadingStates(prev => ({ ...prev, students: true }));
      
      // Try to get class analytics directly as fallback
      const classAnalytics = await GradeAnalyticsService.getClassAnalytics(classId);
      
      // Set basic stats from fallback data
      const fallbackStats = {
        totalStudents: classAnalytics.totalStudents,
        averagePerformance: classAnalytics.averagePerformance,
        passRate: classAnalytics.passRate,
        testsCompleted: classAnalytics.testsCompleted,
        passedTests: 0,
        totalTests: 0,
        id: `fallback_${classId}`,
        lastUpdated: new Date(),
        isStale: false
      };
      
      // Try to force recompute analytics
      await forceRecompute();
      
      console.log('✅ Analytics recovery successful');
      
    } catch (err: any) {
      console.error('❌ Analytics recovery failed:', err);
      setError('Unable to load analytics data. Please try refreshing the page.');
    } finally {
      setLoadingStates(prev => ({ ...prev, students: false }));
    }
  }, [classId, forceRecompute]);

  // Load students data (optimized pagination)
  const loadStudentsData = useCallback(async (page: number = 1, reset: boolean = false) => {
    if (!classId) return;

    setLoadingStates(prev => ({ ...prev, students: true }));

    try {
      // Use fullAnalytics if available for fast loading
      if (fullAnalytics?.detailedStats?.studentPerformances && fullAnalytics.detailedStats.studentPerformances.length > 0) {
        console.log('📊 Using cached student data');
        const allStudents = fullAnalytics.detailedStats.studentPerformances;
        setTotalStudentCount(allStudents.length);
        
        const startIndex = (page - 1) * studentsPerPage;
        const endIndex = startIndex + studentsPerPage;
        const cachedStudents = allStudents.slice(startIndex, endIndex);
        
        // Check if there are more students
        setHasMoreStudents(endIndex < allStudents.length);
        
        // Map schema format to component format with proper types
        const mappedStudents: StudentPerformanceData[] = cachedStudents.map((student: any) => ({
          studentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          overallAverage: student.overallAverage,
          totalTests: student.totalTests,
          passedTests: student.passedTests,
          weakTopics: student.weakTopics,
          strongTopics: student.strongTopics,
          improvementTrend: student.improvementTrend,
          lastActiveDate: student.lastActiveDate ? Timestamp.fromDate(student.lastActiveDate) : null,
          recentTestScores: [] // Add missing field for compatibility
        }));
        
        setStudentPerformances(prev => {
          if (reset || page === 1) return mappedStudents;
          return [...prev, ...mappedStudents];
        });
      } else {
        console.log('🔄 Fetching student data from API');
        // Get class student performances directly
        const allStudents = await GradeAnalyticsService.getClassStudentPerformances(classId);
        setTotalStudentCount(allStudents.length);
        
        const startIndex = (page - 1) * studentsPerPage;
        const endIndex = startIndex + studentsPerPage;
        const paginatedStudents = allStudents.slice(startIndex, endIndex);
        
        // Check if there are more students
        setHasMoreStudents(endIndex < allStudents.length);
        
        setStudentPerformances(prev => {
          if (reset || page === 1) return paginatedStudents;
          return [...prev, ...paginatedStudents];
        });
      }
      
    } catch (error) {
      console.error('❌ Error loading students:', error);
      setHasMoreStudents(false);
    } finally {
      setLoadingStates(prev => ({ ...prev, students: false }));
    }
  }, [classId, studentsPerPage, fullAnalytics]);

  // Load trends data (lazy loaded)
  const loadTrendsData = useCallback(async () => {
    if (!classId) return;

    setLoadingStates(prev => ({ ...prev, trends: true }));

    try {
      // Use fullAnalytics if available
      if (fullAnalytics?.detailedStats?.performanceTrends && fullAnalytics.detailedStats.performanceTrends.length > 0) {
        console.log('📊 Using cached trends data');
        setPerformanceTrends(fullAnalytics.detailedStats.performanceTrends);
      } else {
        console.log('🔄 Fetching trends data from API');
        const trends = await GradeAnalyticsService.getPerformanceTrends(classId, 'month');
        setPerformanceTrends(trends);
      }
    } catch (error) {
      console.error('❌ Error loading trends:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, trends: false }));
    }
  }, [classId, fullAnalytics]);

  // Use quickStats for immediate display, fallback to fullAnalytics
  const displayStats = useMemo(() => {
    if (quickStats) {
      return quickStats;
    }
    if (fullAnalytics?.quickStats) {
      return fullAnalytics.quickStats;
    }
    return {
      totalStudents: 0,
      averagePerformance: 0,
      passRate: 0,
      testsCompleted: 0,
      passedTests: 0,
      totalTests: 0
    };
  }, [quickStats, fullAnalytics]);

  // Optimized tab switching with preloading
  const handleTabChange = useCallback((tab: 'tests' | 'students') => {
    setActiveTab(tab);
    
    switch (tab) {
      case 'students':
        if (studentPerformances.length === 0) {
          loadStudentsData(1, true);
        }
        break;
      case 'tests':
        // Tests are loaded by default
        break;
    }
  }, [studentPerformances.length, loadStudentsData]);

  // Memoized filtered students for better performance
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return studentPerformances;
    
    const term = searchTerm.toLowerCase();
    return studentPerformances.filter(student =>
      student.studentName.toLowerCase().includes(term) ||
      student.studentEmail.toLowerCase().includes(term)
    );
  }, [studentPerformances, searchTerm]);

  // Optimized pagination with infinite scroll
  const loadMoreStudents = useCallback(() => {
    if (!loadingStates.students && hasMoreStudents) {
      const nextPage = Math.floor(studentPerformances.length / studentsPerPage) + 1;
      loadStudentsData(nextPage, false);
    }
  }, [studentPerformances.length, studentsPerPage, loadStudentsData, loadingStates.students, hasMoreStudents]);

  // Auto-load more students when scrolling near bottom
  const handleStudentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 1000; // 1000px before bottom
    
    if (isNearBottom && !loadingStates.students && hasMoreStudents && !searchTerm) {
      loadMoreStudents();
    }
  }, [loadMoreStudents, loadingStates.students, hasMoreStudents, searchTerm]);

  // Quick student detail view
  const viewStudentDetails = useCallback((studentId: string) => {
    setSelectedStudent(selectedStudent === studentId ? null : studentId);
  }, [selectedStudent]);

  // Modal operations
  const openStudentModal = useCallback((student: StudentPerformanceData) => {
    setSelectedStudentData(student);
    setIsStudentModalOpen(true);
  }, []);

  const closeStudentModal = useCallback(() => {
    setIsStudentModalOpen(false);
    setSelectedStudentData(null);
  }, []);

  // Optimized export functionality
  const exportReport = useCallback(() => {
    const analytics = displayStats;
    if (!analytics || !classData) return;

    // Use Web Workers for heavy CSV processing if needed
    const generateCSV = () => {
      const csvData = [];
      
      csvData.push(['Class Analytics Report']);
      csvData.push(['Class Name:', classData.name]);
      csvData.push(['Teacher:', teacher?.name || 'N/A']);
      csvData.push(['Generated:', new Date().toLocaleDateString()]);
      csvData.push(['']);
      
      csvData.push(['CLASS OVERVIEW']);
      csvData.push(['Total Students:', analytics.totalStudents || 'N/A']);
      csvData.push(['Average Performance:', `${Math.round(analytics.averagePerformance || 0)}%`]);
      csvData.push(['Tests Completed:', analytics.testsCompleted || 'N/A']);
      csvData.push(['Pass Rate:', `${Math.round(analytics.passRate || 0)}%`]);
      csvData.push(['']);
      
      if (studentPerformances.length > 0) {
        csvData.push(['STUDENT PERFORMANCE']);
        csvData.push(['Student Name', 'Email', 'Average Score (%)', 'Total Tests', 'Passed Tests', 'Trend']);
        
        studentPerformances.forEach(student => {
          csvData.push([
            student.studentName,
            student.studentEmail,
            Math.round(student.overallAverage),
            student.totalTests,
            student.passedTests,
            student.improvementTrend
          ]);
        });
      }
      
      return csvData.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
    };

    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${classData.name}_Analytics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [displayStats, classData, teacher?.name, studentPerformances]);

  // Refresh with cache invalidation
  const refreshData = useCallback(() => {
    setError(null); // Clear any existing errors
    setShowSuccessMessage(false); // Clear success message
    refreshAnalytics();
    setStudentPerformances([]);
    setPerformanceTrends([]);
    setCurrentPage(1);
  }, [refreshAnalytics]);

  // Show skeleton loading when class is loading OR when we have no data but analytics are loading
  const shouldShowSkeleton = loadingStates.class || (!classData && (loadingQuick || loadingFull));
  
  if (shouldShowSkeleton) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
                </div>
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
              </div>
              <div className="animate-pulse flex space-x-3">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
            </div>
          </div>

          {/* Loading Progress Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {loadingStates.class ? 'Loading class data...' : 
                   loadingQuick ? 'Loading analytics...' : 
                   loadingFull ? 'Computing detailed statistics...' : 
                   'Initializing...'}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse"
                style={{ width: loadingStates.class ? '25%' : loadingQuick ? '50%' : loadingFull ? '75%' : '100%' }}
              ></div>
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="animate-pulse flex items-center">
                  <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                  <div className="ml-4 flex-1">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
                    <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tab Navigation Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8 px-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse py-4">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                  </div>
                ))}
              </nav>
            </div>
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  // Only show error screen for critical errors (class not found, access denied, etc.)
  if (error && !loadingStates.class && (!classData || error.includes('not found') || error.includes('Access denied'))) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Error Loading Class
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
            <div className="space-y-3">
              <div className="flex space-x-3 justify-center">
                <Button variant="outline" onClick={() => router.back()}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
                <Button onClick={refreshData}>
                  Try Again
                </Button>
              </div>
              <Button 
                variant="outline" 
                onClick={handleAnalyticsRecovery}
                className="w-full"
              >
                Use Alternative Method
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If the issue persists, try the alternative loading method or contact support.
              </p>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!classData) {
    return (
      <TeacherLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No data available</p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {classData.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  {classData.subject} • Year {classData.year} • {displayStats.totalStudents} students
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" onClick={refreshData}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Loading Progress Bar */}
        {(loadingQuick || loadingFull || isStale) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {loadingQuick ? 'Loading analytics...' : 
                   loadingFull ? 'Computing detailed statistics...' : 
                   isStale ? 'Refreshing data...' : 'Processing...'}
                </span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  loadingQuick ? 'bg-blue-600 w-1/3' :
                  loadingFull ? 'bg-blue-600 w-2/3' :
                  'bg-green-600 w-full'
                }`}
              ></div>
            </div>
            {isStale && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Data may be outdated. Refreshing in background...
              </p>
            )}
          </div>
        )}

        {/* Non-Critical Error Warning */}
        {error && !error.includes('not found') && !error.includes('Access denied') && classData && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Analytics Warning
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {error}. Data fetching is happening in the background. Please wait or try the options below.
                </p>
                <div className="flex space-x-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={refreshData}
                    className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-600 dark:hover:bg-amber-800/30"
                  >
                    Retry
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleAnalyticsRecovery}
                    className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-600 dark:hover:bg-amber-800/30"
                  >
                    Alternative Method
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setError(null)}
                    className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-600 dark:hover:bg-amber-800/30"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message when data loads after error */}
        {showSuccessMessage && !error && (quickStats || fullAnalytics?.quickStats) && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Analytics Loaded Successfully
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {cached ? 'Using cached data for fast loading' : 'Fresh data loaded from server'}
                    {lastUpdated && ` • Last updated: ${lastUpdated.toLocaleTimeString()}`}
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowSuccessMessage(false)}
                className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-200 dark:border-green-600 dark:hover:bg-green-800/30"
              >
                ×
              </Button>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
                {loadingQuick ? (
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {displayStats.totalStudents}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Performance</p>
                {loadingQuick ? (
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(displayStats.averagePerformance)}%
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pass Rate</p>
                {loadingQuick ? (
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(displayStats.passRate)}%
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tests Completed</p>
                {loadingQuick ? (
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {displayStats.testsCompleted}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'tests', label: 'Tests', icon: BookOpen, count: classTests.length },
                { id: 'students', label: 'Students', icon: Users, count: displayStats.totalStudents }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as any)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'tests' && (
              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Class Tests ({classTests.length})
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search tests..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Tests List */}
                {loadingStates.tests ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">
                        <div className="flex-1">
                          <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                          <div className="flex space-x-4">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : classTests && classTests.length > 0 ? (
                  <div className="space-y-3">
                    {classTests
                      .filter(test => 
                        !searchTerm || 
                        test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        test.subject?.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((test: any) => (
                      <div key={test.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                           onClick={() => router.push(`/teacher/tests/${test.id}/results`)}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                                {test.title}
                              </h4>
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                test.type === 'live' 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              }`}>
                                {test.type === 'live' ? 'Live Test' : 'Flexible Test'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {test.description || 'No description provided'}
                            </p>
                            <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                Created: {test.createdAt?.toDate ? test.createdAt.toDate().toLocaleDateString() : 'N/A'}
                              </span>
                              <span className="flex items-center">
                                <FileText className="h-4 w-4 mr-1" />
                                {test.questions?.length || 0} questions
                              </span>
                              <span className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {test.duration || test.config?.timeLimit || 'No'} min
                              </span>
                              {test.config?.passingScore && (
                                <span className="flex items-center">
                                  <Trophy className="h-4 w-4 mr-1" />
                                  {test.config.passingScore}% to pass
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-2" />
                              View Results
                            </Button>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Click to see detailed results
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h4 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                      No tests created yet
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Tests will appear here once they are created for this class
                    </p>
                    <Button 
                      onClick={() => router.push(`/teacher/tests/create?classId=${classId}`)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Create First Test
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'students' && (
              <div className="space-y-4">
                {/* Search and Controls */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Class Students ({displayStats.totalStudents})
                  </h3>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => loadStudentsData(1, true)}
                      disabled={loadingStates.students}
                    >
                      {loadingStates.students ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>
                </div>

                {/* Students Grid */}
                {loadingStates.students ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStudents.map((student) => (
                      <div 
                        key={student.studentId} 
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer hover:border-blue-300 dark:hover:border-blue-600"
                        onClick={() => router.push(`/teacher/grades/${classId}/student/${student.studentId}`)}
                      >
                        <div className="flex items-center space-x-4 mb-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${
                            student.overallAverage >= 80 
                              ? 'bg-green-500'
                              : student.overallAverage >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}>
                            {student.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {student.studentName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {student.studentEmail}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Overall Average</span>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-gray-900 dark:text-white">
                                {Math.round(student.overallAverage)}%
                              </span>
                              {student.improvementTrend === 'improving' && (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                              )}
                              {student.improvementTrend === 'declining' && (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Tests Taken</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {student.totalTests}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Tests Passed</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {student.passedTests}
                            </span>
                          </div>
                          
                          {student.lastActiveDate && (
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Last active: {student.lastActiveDate.toDate().toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-4">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/teacher/grades/${classId}/student/${student.studentId}`);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                      {searchTerm ? 'No students found' : 'No students enrolled'}
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      {searchTerm 
                        ? 'Try adjusting your search criteria' 
                        : 'Students will appear here once they are enrolled in this class'
                      }
                    </p>
                    {!searchTerm && (
                      <Button 
                        onClick={() => router.push(`/teacher/classes/${classId}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Manage Class
                      </Button>
                    )}
                  </div>
                )}
                
                {/* Load More */}
                {filteredStudents.length > 0 && hasMoreStudents && !searchTerm && (
                  <div className="text-center pt-6 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Showing {filteredStudents.length} of {totalStudentCount} students
                    </p>
                    <Button
                      variant="outline"
                      onClick={loadMoreStudents}
                      disabled={loadingStates.students}
                    >
                      {loadingStates.students ? 'Loading...' : 'Load More Students'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student Detail Modal */}
      {isStudentModalOpen && selectedStudentData && (
        <StudentDetailModal
          isOpen={isStudentModalOpen}
          onClose={closeStudentModal}
          student={selectedStudentData}
          classId={classId}
        />
      )}
    </TeacherLayout>
  );
}
