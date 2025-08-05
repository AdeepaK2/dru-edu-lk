'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  Calendar,
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import Link from 'next/link';

// Import services and types
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { GradeAnalyticsService, ClassAnalytics } from '@/apiservices/gradeAnalyticsService';
import { ClassDocument } from '@/models/classSchema';
import { FirestoreOptimizer } from '@/utils/teacher-performance';

interface ClassWithAnalytics extends ClassDocument {
  analytics?: ClassAnalytics;
  studentCount: number;
  recentActivity?: string;
}

export default function TeacherGrades() {
  const { teacher } = useTeacherAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [classes, setClasses] = useState<ClassWithAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Load teacher's classes
  useEffect(() => {
    const loadClasses = async () => {
      if (!teacher?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get classes assigned to this teacher
        const teacherClasses = await ClassFirestoreService.getClassesByTeacher(teacher.id);
        console.log('📚 Loaded teacher classes:', teacherClasses.length);

        // Add student count for each class
        const classesWithStats = await Promise.all(
          teacherClasses.map(async (classDoc) => {
            try {
              // Use optimized student query
              const students = await FirestoreOptimizer.getStudentsByClassOptimized(classDoc.id);
              const studentCount = students.length;
              
              return {
                ...classDoc,
                studentCount,
                recentActivity: `${studentCount} students enrolled`
              } as ClassWithAnalytics;
            } catch (err) {
              console.error(`Error loading stats for class ${classDoc.id}:`, err);
              return {
                ...classDoc,
                studentCount: classDoc.enrolledStudents || 0,
                recentActivity: 'No recent activity'
              } as ClassWithAnalytics;
            }
          })
        );

        setClasses(classesWithStats);
        
        // Load analytics for each class in background
        loadAnalyticsForClasses(classesWithStats);
        
      } catch (err: any) {
        console.error('Error loading classes:', err);
        setError(err.message || 'Failed to load classes');
      } finally {
        setLoading(false);
      }
    };

    loadClasses();
  }, [teacher?.id]);

  // Load analytics for classes
  const loadAnalyticsForClasses = async (classesToLoad: ClassWithAnalytics[]) => {
    for (const classDoc of classesToLoad) {
      setLoadingAnalytics(prev => ({ ...prev, [classDoc.id]: true }));
      
      try {
        const analytics = await GradeAnalyticsService.getClassAnalytics(classDoc.id);
        
        setClasses(prev => prev.map(c => 
          c.id === classDoc.id 
            ? { ...c, analytics }
            : c
        ));
      } catch (error) {
        console.error(`Error loading analytics for class ${classDoc.id}:`, error);
      } finally {
        setLoadingAnalytics(prev => ({ ...prev, [classDoc.id]: false }));
      }
    }
  };

  // Filter classes based on search term
  const filteredClasses = classes.filter(classDoc =>
    classDoc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    classDoc.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    classDoc.year.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Navigate to class analytics
  const viewClassAnalytics = (classId: string) => {
    router.push(`/teacher/grades/${classId}`);
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
          
          {/* Cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
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
              Error Loading Classes
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Grade Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Monitor student performance and identify learning gaps across your classes
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search classes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats Overview */}
        {classes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Classes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {classes.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {classes.reduce((sum, c) => sum + c.studentCount, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Performance</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {classes.length > 0 
                      ? Math.round(
                          classes
                            .filter(c => c.analytics)
                            .reduce((sum, c) => sum + (c.analytics?.averagePerformance || 0), 0) / 
                          classes.filter(c => c.analytics).length || 1
                        )
                      : 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pass Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {classes.length > 0 
                      ? Math.round(
                          classes
                            .filter(c => c.analytics)
                            .reduce((sum, c) => sum + (c.analytics?.passRate || 0), 0) / 
                          classes.filter(c => c.analytics).length || 1
                        )
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Class Cards */}
        {filteredClasses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Classes Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm 
                ? `No classes match your search for "${searchTerm}"`
                : "You don't have any classes assigned yet."
              }
            </p>
            {!searchTerm && (
              <Link href="/teacher/classes">
                <Button>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Manage Classes
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((classDoc) => (
              <div
                key={classDoc.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => viewClassAnalytics(classDoc.id)}
              >
                <div className="p-6">
                  {/* Class Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {classDoc.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {classDoc.subject} • Year {classDoc.year}
                      </p>
                    </div>
                    <div className="ml-4">
                      <div className={`w-3 h-3 rounded-full ${
                        classDoc.status === 'Active' 
                          ? 'bg-green-400' 
                          : 'bg-gray-400'
                      }`} />
                    </div>
                  </div>

                  {/* Analytics Data */}
                  {loadingAnalytics[classDoc.id] ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  ) : classDoc.analytics ? (
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Students</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {classDoc.analytics.totalStudents}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Score</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {Math.round(classDoc.analytics.averagePerformance)}%
                          </p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Pass Rate</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {Math.round(classDoc.analytics.passRate)}%
                          </p>
                        </div>
                      </div>

                      {/* Performance Indicators */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Tests Completed</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {classDoc.analytics.testsCompleted}
                          </span>
                        </div>
                        
                        {classDoc.analytics.strugglingStudents.length > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Need Help
                            </span>
                            <span className="font-medium">
                              {classDoc.analytics.strugglingStudents.length} students
                            </span>
                          </div>
                        )}

                        {classDoc.analytics.topPerformers.length > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Top Performers
                            </span>
                            <span className="font-medium">
                              {classDoc.analytics.topPerformers.length} students
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No test data available
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        viewClassAnalytics(classDoc.id);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Analytics
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Understanding Grade Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Click on any class card to view detailed analytics including student performance trends, 
                topic-wise analysis, and personalized learning recommendations.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center">
                  <TrendingUp className="w-4 h-4 text-green-500 mr-2" />
                  <span className="text-gray-700 dark:text-gray-300">Performance tracking</span>
                </div>
                <div className="flex items-center">
                  <Target className="w-4 h-4 text-blue-500 mr-2" />
                  <span className="text-gray-700 dark:text-gray-300">Learning gap analysis</span>
                </div>
                <div className="flex items-center">
                  <BookOpen className="w-4 h-4 text-purple-500 mr-2" />
                  <span className="text-gray-700 dark:text-gray-300">Lesson recommendations</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
