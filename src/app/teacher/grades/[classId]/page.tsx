'use client';

import React, { useState, useEffect } from 'react';
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
  Filter,
  Search,
  Calendar,
  Clock,
  Award,
  Brain,
  ChevronRight,
  User,
  XCircle,
  GraduationCap
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { StudentDetailModal } from '@/components/teacher/StudentDetailModal';
import Link from 'next/link';

// Import services and types
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { 
  GradeAnalyticsService, 
  ClassAnalytics, 
  StudentPerformanceData, 
  TopicAnalysis,
  PerformanceTrend 
} from '@/apiservices/gradeAnalyticsService';
import { ClassDocument } from '@/models/classSchema';

export default function ClassGradeAnalytics() {
  const params = useParams();
  const router = useRouter();
  const { teacher } = useTeacherAuth();
  const classId = params.classId as string;

  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [studentPerformances, setStudentPerformances] = useState<StudentPerformanceData[]>([]);
  const [topicAnalysis, setTopicAnalysis] = useState<TopicAnalysis[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'topics' | 'trends'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  
  // Modal state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudentData, setSelectedStudentData] = useState<StudentPerformanceData | null>(null);

  // Load class data and analytics
  useEffect(() => {
    const loadClassAnalytics = async () => {
      if (!classId || !teacher?.id) return;

      setLoading(true);
      setError(null);

      try {
        // Load class data
        const classDoc = await ClassFirestoreService.getClassById(classId);
        if (!classDoc) {
          throw new Error('Class not found');
        }

        // Verify teacher has access to this class
        if (classDoc.teacherId !== teacher.id) {
          throw new Error('Access denied: You are not the teacher for this class');
        }

        setClassData(classDoc);

        // Load analytics
        const analyticsData = await GradeAnalyticsService.getClassAnalytics(classId);
        setAnalytics(analyticsData);

        console.log('✅ Class analytics loaded:', analyticsData);

      } catch (err: any) {
        console.error('Error loading class analytics:', err);
        setError(err.message || 'Failed to load class analytics');
      } finally {
        setLoading(false);
      }
    };

    loadClassAnalytics();
  }, [classId, teacher?.id]);

  // Load additional data based on active tab
  useEffect(() => {
    if (!analytics || !classId) return;

    const loadTabData = async () => {
      try {
        switch (activeTab) {
          case 'students':
            if (studentPerformances.length === 0) {
              setLoadingStudents(true);
              
              // Get ALL enrolled students, not just top performers and struggling students
              const studentsInClass = await import('@/apiservices/studentFirestoreService').then(module => 
                module.StudentFirestoreService.getStudentsByClass(classId)
              );
              
              console.log('📚 Loading students tab - all students in class:', studentsInClass.length);
              
              // Load performance data for all enrolled students
              const performances = await Promise.all(
                studentsInClass.map((student: any) => 
                  GradeAnalyticsService.getStudentPerformanceData(student.id, classId)
                )
              );
              
              console.log('📊 Student performances loaded:', performances.length);
              console.log('📊 Performance data sample:', performances.slice(0, 2));
              
              setStudentPerformances(performances);
              setLoadingStudents(false);
            }
            break;

          case 'topics':
            if (topicAnalysis.length === 0) {
              setLoadingTopics(true);
              const topics = await GradeAnalyticsService.getTopicAnalysis(classId);
              setTopicAnalysis(topics);
              setLoadingTopics(false);
            }
            break;

          case 'trends':
            if (performanceTrends.length === 0) {
              const trends = await GradeAnalyticsService.getPerformanceTrends(classId, 'month');
              setPerformanceTrends(trends);
            }
            break;
        }
      } catch (error) {
        console.error(`Error loading ${activeTab} data:`, error);
      }
    };

    loadTabData();
  }, [activeTab, analytics, classId]);

  // Filter students based on search
  const filteredStudents = studentPerformances.filter(student =>
    student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // View individual student performance
  const viewStudentDetails = (studentId: string) => {
    setSelectedStudent(selectedStudent === studentId ? null : studentId);
  };

  // Open student detail modal
  const openStudentModal = (student: StudentPerformanceData) => {
    setSelectedStudentData(student);
    setIsStudentModalOpen(true);
  };

  // Close student detail modal
  const closeStudentModal = () => {
    setIsStudentModalOpen(false);
    setSelectedStudentData(null);
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-300 dark:bg-gray-600 rounded"></div>
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
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!classData || !analytics) {
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
                  {classData.subject} • Year {classData.year} • {analytics.totalStudents} students
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics.totalStudents}
                </p>
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
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(analytics.averagePerformance)}%
                </p>
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
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(analytics.passRate)}%
                </p>
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
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics.testsCompleted}
                </p>
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
                { id: 'topics', label: 'Topics', icon: Brain },
                { id: 'trends', label: 'Trends', icon: TrendingUp }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab('students')}
                    className="flex items-center justify-center h-16"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    View All Students
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab('topics')}
                    className="flex items-center justify-center h-16"
                  >
                    <Brain className="w-5 h-5 mr-2" />
                    Topic Analysis
                  </Button>
                </div>

                {/* Recent Tests */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Recent Tests Performance
                  </h3>
                  {analytics.recentTests.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.recentTests.map((test) => (
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
                </div>

                {/* Students List */}
                {loadingStudents ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
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
                                {student.testsCompleted} tests
                              </p>
                            </div>
                            <div className="flex items-center">
                              {student.recentTrend === 'improving' && (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                              )}
                              {student.recentTrend === 'declining' && (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                              )}
                              <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />
                            </div>
                          </div>
                        </div>

                        {/* Student Details (Expandable) */}
                        {selectedStudent === student.studentId && (
                          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Weak Topics */}
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                                  Areas for Improvement
                                </h4>
                                <div className="space-y-2">
                                  {student.weakTopics.slice(0, 3).map((topic) => (
                                    <div key={topic.topic} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                      <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {topic.topic}
                                      </span>
                                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                        {Math.round(topic.averageScore)}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Strong Topics */}
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                                  Strong Areas
                                </h4>
                                <div className="space-y-2">
                                  {student.strongTopics.slice(0, 3).map((topic) => (
                                    <div key={topic.topic} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                                      <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {topic.topic}
                                      </span>
                                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                        {Math.round(topic.averageScore)}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="mt-4 flex items-center space-x-3">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openStudentModal(student)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </Button>
                              <Button size="sm" variant="outline">
                                <BookOpen className="w-4 h-4 mr-2" />
                                Recommend Lessons
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'topics' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Topic Performance Analysis
                </h3>
                
                {loadingTopics ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topicAnalysis.map((topic) => (
                      <div key={topic.topic} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {topic.topic}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              topic.difficultyLevel === 'easy'
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                : topic.difficultyLevel === 'medium'
                                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                                : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            }`}>
                              {topic.difficultyLevel}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {Math.round(topic.averageScore)}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Questions</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {topic.totalQuestions}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Students</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {topic.totalStudents}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Struggling</p>
                            <p className="font-medium text-red-600 dark:text-red-400">
                              {topic.studentsStruggling}
                            </p>
                          </div>
                        </div>

                        {topic.studentsStruggling > 0 && (
                          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-900/40">
                            <div className="flex items-center">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
                              <span className="text-sm text-amber-700 dark:text-amber-300">
                                {topic.studentsStruggling} students need help with this topic
                              </span>
                            </div>
                            <Button size="sm" className="mt-2" variant="outline">
                              <BookOpen className="w-4 h-4 mr-2" />
                              Recommend Lessons
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Performance Trends
                </h3>
                
                {performanceTrends.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No trend data available yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {performanceTrends.map((trend) => (
                      <div key={trend.period} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {trend.period}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {trend.testsCount} tests completed
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {Math.round(trend.averageScore)}%
                          </p>
                          <div className="flex items-center">
                            {trend.improvementRate > 0 && (
                              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                            )}
                            {trend.improvementRate < 0 && (
                              <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                            )}
                            <span className={`text-sm ${
                              trend.improvementRate > 0
                                ? 'text-green-600 dark:text-green-400'
                                : trend.improvementRate < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {trend.improvementRate > 0 ? '+' : ''}{Math.round(trend.improvementRate)}%
                            </span>
                          </div>
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
      <StudentDetailModal
        isOpen={isStudentModalOpen}
        onClose={closeStudentModal}
        student={selectedStudentData}
        classId={classId}
      />
    </TeacherLayout>
  );
}
