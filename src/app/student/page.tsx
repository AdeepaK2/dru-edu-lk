'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  FileText,
  Video,
  TrendingUp,
  Clock,
  Trophy,
  ChevronRight,
  BarChart3,
  BookOpenCheck,
  GraduationCap,
  Target,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Link from 'next/link';

// Upcoming test interface
interface UpcomingTest {
  id: string;
  title: string;
  subject: string;
  date: string;
  time: string;
}

export default function StudentDashboard() {
  const { student } = useStudentAuth();

  // State for real data
  const [dashboardStats, setDashboardStats] = useState({
    totalClasses: 0,
    completedTests: 0,
    studyMaterials: 0,
    videosWatched: 0,
    currentGrade: 0
  });
  
  const [upcomingTests, setUpcomingTests] = useState<UpcomingTest[]>([]);
  const [loading, setLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!student?.id) return;
      
      try {
        setLoading(true);
        
        // Load real data from services
        const [classesData, testsData, studyMaterialsData, submissionsData] = await Promise.all([
          loadStudentClasses(),
          loadUpcomingTests(),
          loadStudyMaterials(),
          loadCompletedSubmissions()
        ]);
        
        // Calculate stats from real data
        const stats = {
          totalClasses: classesData.length,
          completedTests: submissionsData.length,
          studyMaterials: studyMaterialsData.length,
          videosWatched: 0, // TODO: Implement video tracking
          currentGrade: calculateAverageGrade(submissionsData)
        };
        
        setDashboardStats(stats);
        setUpcomingTests(testsData);
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [student?.id]);

  // Helper functions to load real data
  const loadStudentClasses = async () => {
    try {
      const { ClassFirestoreService } = await import('@/apiservices/classFirestoreService');
      if (!student?.id) return [];
      return await ClassFirestoreService.getClassesByStudent(student.id);
    } catch (error) {
      console.error('Error loading classes:', error);
      return [];
    }
  };

  const loadUpcomingTests = async () => {
    try {
      const { TestService } = await import('@/apiservices/testService');
      if (!student?.id) return [];
      
      // First get student's classes
      const classes = await loadStudentClasses();
      const classIds = classes.map((cls: any) => cls.id);
      
      const tests = await TestService.getStudentTests(student.id, classIds);
      
      // Filter for upcoming tests and sort by date
      const upcoming = tests
        .filter((test: any) => {
          if (test.type === 'live') {
            return new Date(test.scheduledStartTime.toDate()) > new Date();
          } else if (test.type === 'flexible') {
            return new Date(test.availableTo.toDate()) > new Date();
          }
          return false;
        })
        .sort((a: any, b: any) => {
          const dateA = a.type === 'live' ? a.scheduledStartTime.toDate() : a.availableTo.toDate();
          const dateB = b.type === 'live' ? b.scheduledStartTime.toDate() : b.availableTo.toDate();
          return dateA - dateB;
        })
        .slice(0, 3); // Show only first 3 upcoming tests
      
      return upcoming.map((test: any) => ({
        id: test.id,
        subject: test.subjectName || 'Unknown Subject',
        title: test.title,
        date: test.type === 'live' 
          ? test.scheduledStartTime.toDate().toISOString().split('T')[0]
          : test.availableTo.toDate().toISOString().split('T')[0],
        time: test.type === 'live' 
          ? test.scheduledStartTime.toDate().toLocaleTimeString('en-AU', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Australia/Melbourne'
            })
          : 'Flexible'
      }));
    } catch (error) {
      console.error('Error loading upcoming tests:', error);
      return [];
    }
  };

  const loadStudyMaterials = async () => {
    try {
      const { getStudyMaterialsByClass } = await import('@/apiservices/studyMaterialFirestoreService');
      if (!student?.id) return [];
      
      // Get study materials for all student's classes
      const classes = await loadStudentClasses();
      const allMaterials = [];
      
      for (const cls of classes) {
        const materials = await getStudyMaterialsByClass((cls as any).id);
        allMaterials.push(...materials);
      }
      
      return allMaterials;
    } catch (error) {
      console.error('Error loading study materials:', error);
      return [];
    }
  };

  const loadCompletedSubmissions = async () => {
    try {
      const { SubmissionService } = await import('@/apiservices/submissionService');
      if (!student?.id) return [];
      
      const submissions = await SubmissionService.getStudentSubmissions(student.id);
      return submissions.filter((sub: any) => sub.status === 'submitted' || sub.status === 'auto_submitted');
    } catch (error) {
      console.error('Error loading submissions:', error);
      return [];
    }
  };

  const calculateAverageGrade = (submissions: any[]) => {
    if (submissions.length === 0) return 0;
    
    const gradesWithScores = submissions.filter((sub: any) => 
      sub.percentage !== undefined && sub.percentage !== null
    );
    
    if (gradesWithScores.length === 0) return 0;
    
    const totalPercentage = gradesWithScores.reduce((sum: number, sub: any) => sum + sub.percentage, 0);
    return Math.round((totalPercentage / gradesWithScores.length) * 10) / 10; // Round to 1 decimal place
  };

  // Get current date and time in Melbourne timezone
  const getMelbourneDateTime = () => {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());
  };

  // Quick actions data
  const quickActions = [
    { 
      id: 'classes', 
      title: 'View My Classes', 
      description: 'See all enrolled classes and schedules',
      icon: Users,
      href: '/student/classes',
      color: 'bg-blue-500'
    },
    { 
      id: 'tests', 
      title: 'Take a Test', 
      description: 'Available tests and quizzes',
      icon: FileText,
      href: '/student/test',
      color: 'bg-red-500'
    },
    { 
      id: 'study', 
      title: 'Study Materials', 
      description: 'Access notes and resources',
      icon: BookOpenCheck,
      href: '/student/study',
      color: 'bg-green-500'
    },
    { 
      id: 'videos', 
      title: 'Watch Videos', 
      description: 'Educational video content',
      icon: Video,
      href: '/student/video',
      color: 'bg-purple-500'
    }
  ];

  // Show loading state while data is being fetched
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Welcome back, {student?.name}!
              </h1>
              <p className="text-green-100 mb-4">
                Ready to continue your learning journey today?
              </p>
              <div className="flex items-center space-x-2 text-green-100">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{getMelbourneDateTime()}</span>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="w-24 h-24 bg-green-400/30 rounded-full flex items-center justify-center">
                <GraduationCap className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">My Classes</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {dashboardStats.totalClasses}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">Active courses</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Tests Completed</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {dashboardStats.completedTests}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">This semester</p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Study Materials</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {dashboardStats.studyMaterials}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">Resources</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <BookOpenCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Current Grade</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {dashboardStats.currentGrade}%
                </p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">Average</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="group p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-500 transition-all duration-200 hover:shadow-md"
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                          {action.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {action.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Tests and Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Tests */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Upcoming Tests
              </h3>
              <Link href="/student/test">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            
            <div className="space-y-4">
              {upcomingTests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {test.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {test.subject}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(test.date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {test.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Performance Overview
            </h3>
            <div className="grid grid-cols-1 gap-6">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Current Average</h4>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">87.5%</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">+3.2% from last month</p>
              </div>
              
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Tests Completed</h4>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">8/10</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">80% completion rate</p>
              </div>
              
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Play className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Videos Watched</h4>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">15</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">This week</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Status & Account Info */}
        {student && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Payment Status
              </h3>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Status:</span>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      student.payment?.status === 'Paid'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : student.payment?.status === 'Pending'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {student.payment?.status || 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Last Payment:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {student.payment?.lastPayment || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Account Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Student ID:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {student.id || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Enrollment Date:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Status:</span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    student.status === 'Active' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : student.status === 'Suspended'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {student.status || 'Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Courses Enrolled:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {student.coursesEnrolled || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
