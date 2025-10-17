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
  
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!student?.id) return;
      
      try {
        setLoading(true);
        
        // Load real data from services
        const [classesData, studyMaterialsData, submissionsData, enrollmentsData] = await Promise.all([
          loadStudentClasses(),
          loadStudyMaterials(),
          loadCompletedSubmissions(),
          loadStudentEnrollments()
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
        setEnrollments(enrollmentsData);
        
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
      const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
      const { ClassFirestoreService } = await import('@/apiservices/classFirestoreService');
      if (!student?.id) return [];
      
      // Get student enrollments first
      const enrollments = await getEnrollmentsByStudent(student.id);
      
      // Get class details for each enrollment
      const classes = [];
      for (const enrollment of enrollments) {
        try {
          const classData = await ClassFirestoreService.getClassById(enrollment.classId);
          if (classData) {
            classes.push(classData);
          }
        } catch (classError) {
          console.warn(`Could not load class ${enrollment.classId}:`, classError);
        }
      }
      
      return classes;
    } catch (error) {
      console.error('Error loading classes:', error);
      return [];
    }
  };

  const loadStudyMaterials = async () => {
    try {
      const { getStudyMaterialsByClass } = await import('@/apiservices/studyMaterialFirestoreService');
      if (!student?.id) return [];
      
      // Get study materials for all student's classes
      const classes = await loadStudentClasses();
      
      // Check if we have any classes
      if (classes.length === 0) {
        console.log('No classes found for student, skipping study materials query');
        return [];
      }
      
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

  const loadStudentEnrollments = async () => {
    try {
      const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
      if (!student?.id) return [];
      
      const enrollments = await getEnrollmentsByStudent(student.id);
      return enrollments;
    } catch (error) {
      console.error('Error loading enrollments:', error);
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

  // Get motivational message based on stats
  const getMotivationalMessage = () => {
    const { currentGrade, completedTests, totalClasses, studyMaterials } = dashboardStats;
    
    if (currentGrade >= 90) {
      return {
        message: "Outstanding! You're excelling in your studies. Keep up the amazing work!",
        icon: Trophy,
        color: "text-yellow-500",
        bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
      };
    } else if (currentGrade >= 80) {
      return {
        message: "Great job! You're performing well. A little more effort and you'll reach the top!",
        icon: Target,
        color: "text-green-500",
        bgColor: "bg-green-50 dark:bg-green-900/20"
      };
    } else if (currentGrade >= 70) {
      return {
        message: "Good progress! Keep pushing forward. You're capable of achieving more!",
        icon: TrendingUp,
        color: "text-blue-500",
        bgColor: "bg-blue-50 dark:bg-blue-900/20"
      };
    } else if (currentGrade >= 60) {
      return {
        message: "You're on the right track! Focus on your weak areas and you'll see improvement.",
        icon: BookOpen,
        color: "text-orange-500",
        bgColor: "bg-orange-50 dark:bg-orange-900/20"
      };
    } else {
      return {
        message: "Every expert was once a beginner. Start small, stay consistent, and you'll succeed!",
        icon: GraduationCap,
        color: "text-purple-500",
        bgColor: "bg-purple-50 dark:bg-purple-900/20"
      };
    }
  };

  // Get time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Get progress percentage for goals
  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
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
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-black to-green-500 flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/loading.gif" 
            alt="Loading..." 
            className="w-80 h-80 mx-auto mb-4 border-4 border-green-400 rounded-lg"
          />
          <p className="text-white font-bold text-3xl">
            Loading
            <span className="inline-block animate-bounce delay-0">.</span>
            <span className="inline-block animate-bounce delay-200">.</span>
            <span className="inline-block animate-bounce delay-400">.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-black to-green-400 p-6">
        <div className="space-y-6">
        {/* Welcome Header - Ben 10 Theme */}
        <div className="bg-gradient-to-r from-green-500 via-black to-green-600 rounded-2xl text-white p-8 relative overflow-hidden border-4 border-black">
          {/* Ben 10 themed background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-300 rounded-full -translate-y-16 translate-x-16 animate-pulse opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black rounded-full translate-y-12 -translate-x-12 animate-pluse opacity-20"></div>
         

          <div className="flex items-center justify-between relative z-10">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-2">
                <img 
                  src="/welcome.png" 
                  alt="Welcome" 
                  className="w-40 h-40 rounded-full border-4 border-black ring-4 ring-green-400"
                />
                <div>
                  <h1 className="text-3xl font-bold">
                    Hey {student?.name}! Ready to transform your learning?
                  </h1>
                  <p className="text-green-200 text-lg font-semibold mt-2">
                    Let's make learning heroic with Ben 10's power!
                  </p>
                </div>
              </div>
              <p className="text-green-200 mb-4 text-base">
                Welcome to your alien learning headquarters!
              </p>
              <div className="flex items-center space-x-2 text-green-200">
                <span className="text-sm font-medium">{getMelbourneDateTime()}</span>
              </div>
            </div>
            {/* Omnitrix device removed per request */}
          </div>
        </div>

        {/* Motivational Message - Ben 10 Theme */}
        {!loading && dashboardStats.currentGrade > 0 && (
          <div className="bg-gradient-to-r from-green-400 via-black to-green-400 border-4 border-black rounded-xl p-6 animate-fade-in relative overflow-hidden">
        

            <div className="flex items-start space-x-4 relative z-10">
              <div className="relative">
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center">
                  {getMotivationalMessage().message}
                 
                </h3>
                <p className="text-white text-base leading-relaxed font-medium">
                  Remember, just like Ben 10's transformations, every great achievement starts with a single power-up!
                </p>
                <div className="mt-4 flex items-center space-x-4 text-sm text-white">
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">📊</span>
                    <span>Grade: <strong className="text-green-400">{dashboardStats.currentGrade}%</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">📝</span>
                    <span>Tests: <strong className="text-white">{dashboardStats.completedTests}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">👥</span>
                    <span>Classes: <strong className="text-green-400">{dashboardStats.totalClasses}</strong></span>
                  </div>
                </div>
                {/* Interactive encouragement */}
                <div className="mt-4 flex space-x-2">
                  <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all animate-pulse border-2 border-black">
                    Transform! 💪
                  </button>
                  <button className="bg-black hover:bg-gray-800 text-green-400 px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all border-2 border-green-400">
                    You're Heroic! 🌟
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards - Ben 10 Theme */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">My Classes</p>
                <p className="text-4xl font-black text-white mt-2 animate-pulse">
                  {dashboardStats.totalClasses}
                </p>
                <p className="text-white mt-1 font-semibold">Active courses</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className="bg-white h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${getProgressPercentage(dashboardStats.totalClasses, 10)}%` }}
                  ></div>
                </div>
                <p className="text-white text-xs mt-1 font-bold">
                  {dashboardStats.totalClasses}/10 goal 🦸‍♂️
                </p>
              </div>
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center border-4 border-white transform hover:rotate-12 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-black to-gray-800 rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-green-400 text-sm font-bold mb-2">Tests Completed</p>
                <p className="text-4xl font-black text-green-400 mt-2 animate-pulse">
                  {dashboardStats.completedTests}
                </p>
                <p className="text-green-400 mt-1 font-semibold">This semester</p>
                <div className="mt-3 bg-green-400/30 rounded-full h-3">
                  <div
                    className="bg-green-400 h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%` }}
                  ></div>
                </div>
                <p className="text-green-400 text-xs mt-1 font-bold">
                  {dashboardStats.completedTests}/20 goal 🎯
                </p>
              </div>
              <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform">
                <FileText className="w-8 h-8 text-black" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-black rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">Study Materials</p>
                <p className="text-4xl font-black text-green-400 mt-2 animate-pulse">
                  {dashboardStats.studyMaterials}
                </p>
                <p className="text-green-400 mt-1 font-semibold">Resources</p>
                <div className="mt-3 bg-green-400/30 rounded-full h-3">
                  <div
                    className="bg-green-400 h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%` }}
                  ></div>
                </div>
                <p className="text-green-400 text-xs mt-1 font-bold">
                  {dashboardStats.studyMaterials}/50 goal 📚
                </p>
              </div>
              <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform">
                <BookOpenCheck className="w-8 h-8 text-black" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-black rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">Current Grade</p>
                <p className="text-4xl font-black text-green-400 mt-2 animate-pulse">
                  {dashboardStats.currentGrade}%
                </p>
                <p className="text-green-400 mt-1 font-semibold">Average</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ease-out shadow-lg ${
                      dashboardStats.currentGrade >= 90 ? 'bg-green-400' :
                      dashboardStats.currentGrade >= 80 ? 'bg-green-500' :
                      dashboardStats.currentGrade >= 70 ? 'bg-green-600' :
                      dashboardStats.currentGrade >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${dashboardStats.currentGrade}%` }}
                  ></div>
                </div>
                <p className="text-green-400 text-xs mt-1 font-bold">
                  Target: 85% 🎓
                </p>
              </div>
              <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform">
                <BarChart3 className="w-8 h-8 text-black" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity & Updates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity - Ben 10 Theme */}
          <div className="bg-gradient-to-br from-green-300 via-black to-green-400 rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-xl font-black text-white mb-6 flex items-center">
              <span className="text-3xl mr-2 animate-pulse">🚀</span>
              Ben 10's Hero Activity
            </h3>
            <div className="space-y-4">
              {dashboardStats.completedTests > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-2 border-black">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      🦸‍♂️ Test Hero!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You completed {dashboardStats.completedTests} test{dashboardStats.completedTests !== 1 ? 's' : ''} this semester - Ben 10 is proud! 🏆
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.totalClasses > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.2s' }}>
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border-2 border-green-400">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      🔄 Class Transformer!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You're enrolled in {dashboardStats.totalClasses} class{dashboardStats.totalClasses !== 1 ? 'es' : ''} - What an alien adventure! �
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.studyMaterials > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.4s' }}>
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-2 border-black">
                    <BookOpenCheck className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      ⚡ Study Champion!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      {dashboardStats.studyMaterials} resource{dashboardStats.studyMaterials !== 1 ? 's' : ''} ready for your heroic learning journey! 🚀
                    </p>
                  </div>
                </div>
              )}

              {(!dashboardStats.completedTests && !dashboardStats.totalClasses && !dashboardStats.studyMaterials) && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-black mx-auto mb-4"></div>
                  <p className="text-black font-bold text-sm">
                    Loading Ben 10's power... ⚡
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Goals - Ben 10 Theme */}
          <div className="bg-gradient-to-br from-black via-green-500 to-black rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-xl font-black text-green-400 mb-6 flex items-center">
              <span className="text-3xl mr-2 animate-bounce">⚡</span>
              Ben 10's Power Goals
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-400 font-bold">🎯 Complete 20 Tests</span>
                  <span className="text-green-400 font-black">
                    {dashboardStats.completedTests}/20
                  </span>
                </div>
                <div className="bg-green-400/20 rounded-full h-4 border-2 border-black">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all duration-1000 ease-out border border-black"
                    style={{ width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-400 font-bold">🎓 Reach 85% Average</span>
                  <span className="text-green-400 font-black">
                    {dashboardStats.currentGrade}%
                  </span>
                </div>
                <div className="bg-green-400/20 rounded-full h-4 border-2 border-green-500">
                  <div
                    className={`h-4 rounded-full transition-all duration-1000 ease-out border border-black ${
                      dashboardStats.currentGrade >= 85 ? 'bg-green-500' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.min(dashboardStats.currentGrade, 85)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-400 font-bold">📚 Study 50 Materials</span>
                  <span className="text-green-400 font-black">
                    {dashboardStats.studyMaterials}/50
                  </span>
                </div>
                <div className="bg-green-400/20 rounded-full h-4 border-2 border-black">
                  <div
                    className="bg-black h-4 rounded-full transition-all duration-1000 ease-out border border-green-400"
                    style={{ width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-green-300 to-black border-2 border-black rounded-lg shadow-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl animate-spin">🔄</span>
                  <span className="text-green-400 font-black text-sm">
                    Next Transformation Unlocked Soon!
                  </span>
                </div>
                <p className="text-white font-bold text-xs mt-1">
                  Keep up the heroic work to unlock Ben 10's powers! ⚡
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Quick Actions - Ben 10 Theme */}
          <div className="bg-gradient-to-r from-green-400 via-black to-green-500 rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-2xl font-black text-white mb-6 flex items-center">
              <span className="text-4xl mr-2 animate-bounce">🔄</span>
              Ben 10's Hero Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className={`group bg-white border-4 border-black rounded-xl p-4 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 animate-fade-in`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center border-2 border-black group-hover:scale-110 transition-all duration-300 group-hover:rotate-12`}>
                        <Icon className="w-6 h-6 text-white group-hover:animate-bounce" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-black group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300 text-sm">
                          {action.title}
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mt-1 text-xs font-medium">
                          {action.description}
                        </p>
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-full bg-green-400/20 rounded-full h-1">
                            <div className="bg-green-500 h-1 rounded-full transition-all duration-500 w-0 group-hover:w-full"></div>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-black group-hover:text-green-500 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Account Information - Ben 10 Theme */}
        {student && (
          <div className="bg-gradient-to-r from-green-400 via-black to-green-500 rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-xl font-black text-white mb-6 flex items-center">
              <span className="text-3xl mr-2 animate-pulse">🦸‍♂️</span>
              Ben 10's Student Profile
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">🎫 Student ID:</span>
                <span className="text-sm font-black text-black bg-green-300 px-2 py-1 rounded border border-black">
                  {student.id || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">📅 Enrollment Date:</span>
                <span className="text-sm font-black text-green-400 bg-black px-2 py-1 rounded border border-green-400">
                  {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">🏷️ Status:</span>
                <span className={`text-sm font-black px-3 py-1 rounded-full border-2 border-black ${
                  student.status === 'Active' 
                    ? 'bg-green-400 text-black'
                    : student.status === 'Suspended'
                    ? 'bg-red-400 text-black'
                    : 'bg-gray-400 text-black'
                }`}>
                  {student.status || 'Active'} 🔄
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">📚 Courses Enrolled:</span>
                <span className="text-sm font-black text-black bg-green-500 px-2 py-1 rounded border border-black">
                  {enrollments.length} ⚡
                </span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
