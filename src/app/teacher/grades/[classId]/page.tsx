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
  GraduationCap
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
import { useFastAnalytics } from '@/hooks/useFastAnalytics';

export default function ClassGradeAnalytics() {
  const params = useParams();
  const router = useRouter();
  const { teacher } = useTeacherAuth();
  const classId = params.classId as string;

  // Use fast analytics hook for lightning-fast loading
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
    invalidateCache
  } = useFastAnalytics({
    classId,
    teacherId: teacher?.id || '',
    autoRefresh: true,
    refreshInterval: 30000 // Refresh every 30 seconds
  });

  // Local state for UI management
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [studentPerformances, setStudentPerformances] = useState<StudentPerformanceData[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  
  const [loadingStates, setLoadingStates] = useState({
    class: true,
    students: false,
    trends: false
  });
  
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'trends'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage] = useState(10);
  
  // Modal state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudentData, setSelectedStudentData] = useState<StudentPerformanceData | null>(null);

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
        
      } catch (err: any) {
        console.error('❌ Error loading class data:', err);
        setError(err.message);
      } finally {
        setLoadingStates(prev => ({ ...prev, class: false }));
      }
    };

    loadClassData();
  }, [classId, teacher?.id]);

  // Handle analytics errors
  useEffect(() => {
    if (analyticsError) {
      setError(analyticsError);
    }
  }, [analyticsError]);

  // Load students data (lazy loaded)
  const loadStudentsData = useCallback(async (page: number = 1) => {
    if (!classId) return;

    setLoadingStates(prev => ({ ...prev, students: true }));

    try {
      // Use fullAnalytics if available, otherwise fall back to direct API
      if (fullAnalytics?.detailedStats?.studentPerformances && fullAnalytics.detailedStats.studentPerformances.length > 0) {
        console.log('📊 Using cached student data');
        const startIndex = (page - 1) * studentsPerPage;
        const endIndex = startIndex + studentsPerPage;
        const cachedStudents = fullAnalytics.detailedStats.studentPerformances.slice(startIndex, endIndex);
        
        // Map schema format to component format with proper types
        const mappedStudents: StudentPerformanceData[] = cachedStudents.map(student => ({
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
        
        setStudentPerformances(prev => page === 1 ? mappedStudents : [...prev, ...mappedStudents]);
      } else {
        console.log('🔄 Fetching student data from API');
        const students = await GradeAnalyticsService.getStudentPerformanceData('', classId);
        
        const startIndex = (page - 1) * studentsPerPage;
        const endIndex = startIndex + studentsPerPage;
        const paginatedStudents = Array.isArray(students) 
          ? students.slice(startIndex, endIndex)
          : [students].slice(startIndex, endIndex);
        
        setStudentPerformances(prev => page === 1 ? paginatedStudents : [...prev, ...paginatedStudents]);
      }
      
    } catch (error) {
      console.error('❌ Error loading students:', error);
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
  const handleTabChange = useCallback((tab: 'overview' | 'students' | 'trends') => {
    setActiveTab(tab);
    
    switch (tab) {
      case 'students':
        if (studentPerformances.length === 0) {
          loadStudentsData(1);
        }
        break;
      case 'trends':
        if (performanceTrends.length === 0) {
          loadTrendsData();
        }
        break;
    }
  }, [studentPerformances.length, performanceTrends.length, loadStudentsData, loadTrendsData]);

  // Memoized filtered students for better performance
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return studentPerformances;
    
    const term = searchTerm.toLowerCase();
    return studentPerformances.filter(student =>
      student.studentName.toLowerCase().includes(term) ||
      student.studentEmail.toLowerCase().includes(term)
    );
  }, [studentPerformances, searchTerm]);

  // Optimized pagination
  const loadMoreStudents = useCallback(() => {
    const nextPage = Math.floor(studentPerformances.length / studentsPerPage) + 1;
    loadStudentsData(nextPage);
  }, [studentPerformances.length, studentsPerPage, loadStudentsData]);

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
    refreshAnalytics();
    setStudentPerformances([]);
    setPerformanceTrends([]);
    setCurrentPage(1);
  }, [refreshAnalytics]);

  // Early loading screen with skeleton
  if (loadingStates.class) {
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
        </div>
      </TeacherLayout>
    );
  }

  if (error) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Error Loading Analytics
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
            <div className="space-x-3">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              <Button onClick={refreshData}>
                Try Again
              </Button>
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
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'students', label: 'Students', icon: Users },
                { id: 'trends', label: 'Trends', icon: TrendingUp }
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
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Class Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => handleTabChange('students')}
                    className="flex items-center justify-center h-16"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    View All Students
                  </Button>
                </div>

                {/* Recent Tests */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Recent Tests Performance
                  </h3>
                  {loadingFull || loadingQuick ? (
                    // Show loading skeleton while analytics are being computed
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">
                          <div className="flex-1">
                            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                          <div className="text-right">
                            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : fullAnalytics?.detailedStats?.recentTests && fullAnalytics.detailedStats.recentTests.length > 0 ? (
                    <div className="space-y-3">
                      {fullAnalytics.detailedStats.recentTests.map((test: any) => (
                        <div key={test.testId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {test.testTitle}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {test.createdAt.toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">
                              Avg: {Math.round(test.averageScore)}%
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {Math.round(test.completionRate)}% completed
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No tests created yet
                      </h4>
                      <p className="text-gray-500 dark:text-gray-400">
                        Tests will appear here once they are created and completed by students
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'students' && (
              <div className="space-y-4">
                {/* Search */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
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
                    onClick={() => loadStudentsData(1)}
                    disabled={loadingStates.students}
                  >
                    {loadingStates.students ? 'Loading...' : 'Load Students'}
                  </Button>
                </div>

                {/* Students List */}
                {loadingStates.students ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">Loading students...</p>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <div className="space-y-3">
                    {filteredStudents.map((student) => (
                      <div key={student.studentId} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div 
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          onClick={() => viewStudentDetails(student.studentId)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              student.overallAverage >= 80 
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                : student.overallAverage >= 60
                                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                                : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            }`}>
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {student.studentName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {student.studentEmail}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {Math.round(student.overallAverage)}%
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {student.totalTests} tests
                              </p>
                            </div>
                            <div className="flex items-center">
                              {student.improvementTrend === 'improving' && (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                              )}
                              {student.improvementTrend === 'declining' && (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                              )}
                              <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />
                            </div>
                          </div>
                        </div>

                        {/* Student Details (Expandable) */}
                        {selectedStudent === student.studentId && (
                          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                            {/* Weak Topics Only */}
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                                Areas for Improvement
                              </h4>
                              {student.weakTopics.length > 0 ? (
                                <div className="space-y-2">
                                  {student.weakTopics.slice(0, 5).map((topic) => (
                                    <div key={topic.topic} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                      <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {topic.topic}
                                      </span>
                                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                        {Math.round(topic.averageScore)}% correct
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                  No areas identified for improvement
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Load More Button */}
                    {studentPerformances.length > 0 && studentPerformances.length % studentsPerPage === 0 && (
                      <div className="text-center pt-4">
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
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm ? 'No students found matching your search.' : 'No student performance data available.'}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => loadStudentsData(1)}
                      className="mt-4"
                      disabled={loadingStates.students}
                    >
                      {loadingStates.students ? 'Loading...' : 'Load Student Data'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Performance Trends
                </h3>
                
                {loadingStates.trends ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">Loading trends...</p>
                  </div>
                ) : performanceTrends.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No trend data available yet
                    </p>
                    <Button
                      variant="outline"
                      onClick={loadTrendsData}
                      className="mt-4"
                      disabled={loadingStates.trends}
                    >
                      {loadingStates.trends ? 'Loading...' : 'Load Trend Data'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {performanceTrends.map((trend, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {trend.date.toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {trend.testsCompleted} tests completed
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {Math.round(trend.averageScore)}%
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {trend.studentsActive} students active
                          </p>
                        </div>
                      </div>
                    ))}
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
