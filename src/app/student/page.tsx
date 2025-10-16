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
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 via-blue-400 to-purple-400 flex items-center justify-center">
        <div className="text-center bg-white border-4 border-black rounded-2xl p-8 shadow-2xl">
          {/* Mickey Mouse loading animation */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center relative mx-auto animate-bounce">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-pulse delay-300"></div>
                </div>
                <div className="absolute bottom-4 w-1 h-1 bg-red-500 rounded-full animate-ping"></div>
              </div>
              {/* Mickey ears */}
              <div className="absolute -top-3 -left-3 w-6 h-6 bg-black rounded-full animate-pulse"></div>
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-black rounded-full animate-pulse delay-500"></div>
            </div>
            <div className="text-center mt-4">
              <span className="text-black font-bold text-lg">Mickey</span>
            </div>
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-yellow-400 mx-auto mb-4"></div>
          <p className="text-black font-bold text-lg">Loading Mickey's Magic Dashboard... 🎩✨</p>
          <p className="text-gray-600 font-medium mt-2">Get ready for some fun learning! 🎓</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Welcome Header - Mickey Mouse Theme */}
        <div className="bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 rounded-2xl text-white p-8 relative overflow-hidden">
          {/* Mickey Mouse themed background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300 rounded-full -translate-y-16 translate-x-16 animate-bounce opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-400 rounded-full translate-y-12 -translate-x-12 animate-pulse opacity-20"></div>
          {/* Mickey Mouse ears */}
          <div className="absolute top-4 right-4 flex space-x-2">
            <div className="w-8 h-8 bg-black rounded-full animate-pulse"></div>
            <div className="w-8 h-8 bg-black rounded-full animate-pulse delay-300"></div>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-2">
                <div className="text-6xl animate-bounce">🧸</div>
                <div>
                  <h1 className="text-3xl font-bold">
                    Hey there, {student?.name}! Ready for some fun learning? 🎓
                  </h1>
                  <p className="text-black text-lg font-semibold mt-2">
                    Let's make learning as magical as Mickey's adventures! ✨
                  </p>
                </div>
              </div>
              <p className="text-black mb-4 text-base">
                Welcome to your magical learning clubhouse! 🏰
              </p>
              <div className="flex items-center space-x-2 text-black">
                <span className="text-2xl">⏰</span>
                <span className="text-sm font-medium">{getMelbourneDateTime()}</span>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="relative">
                {/* Mickey Mouse face */}
                <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center relative">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-black rounded-full"></div>
                      <div className="w-3 h-3 bg-black rounded-full"></div>
                    </div>
                    <div className="absolute bottom-6 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  </div>
                  {/* Mickey ears */}
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-black rounded-full"></div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-black rounded-full"></div>
                </div>
                <div className="text-center mt-2">
                  <span className="text-black font-bold text-sm">Mickey</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Motivational Message - Mickey Mouse Theme */}
        {!loading && dashboardStats.currentGrade > 0 && (
          <div className="bg-gradient-to-r from-yellow-200 via-red-200 to-blue-200 border-4 border-black rounded-xl p-6 animate-fade-in relative overflow-hidden">
            {/* Mickey Mouse themed decorations */}
            <div className="absolute top-2 right-2 text-2xl animate-spin">⭐</div>
            <div className="absolute bottom-2 left-2 text-xl animate-bounce">🎈</div>

            <div className="flex items-start space-x-4 relative z-10">
              <div className="relative">
                {/* Minnie Mouse character */}
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center relative">
                  <div className="w-12 h-12 bg-pink-300 rounded-full flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                    </div>
                    <div className="absolute bottom-4 w-1 h-1 bg-red-600 rounded-full"></div>
                  </div>
                  {/* Minnie bow */}
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-6 h-4 bg-red-600 rounded-full"></div>
                </div>
                <div className="text-center mt-1">
                  <span className="text-black font-bold text-xs">Minnie</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-black mb-2 flex items-center">
                  {getMotivationalMessage().message}
                  <span className="ml-2 animate-pulse">🎉</span>
                </h3>
                <p className="text-black text-base leading-relaxed font-medium">
                  Remember, just like Mickey's adventures, every great achievement starts with a single step! 🚀
                </p>
                <div className="mt-4 flex items-center space-x-4 text-sm text-black">
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">📊</span>
                    <span>Grade: <strong className="text-red-600">{dashboardStats.currentGrade}%</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">📝</span>
                    <span>Tests: <strong className="text-blue-600">{dashboardStats.completedTests}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">👥</span>
                    <span>Classes: <strong className="text-green-600">{dashboardStats.totalClasses}</strong></span>
                  </div>
                </div>
                {/* Interactive encouragement */}
                <div className="mt-4 flex space-x-2">
                  <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all animate-pulse">
                    Keep Going! 💪
                  </button>
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all">
                    You're Amazing! 🌟
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards - Mickey Mouse Theme */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">My Classes</p>
                <p className="text-4xl font-black text-yellow-300 mt-2 animate-pulse">
                  {dashboardStats.totalClasses}
                </p>
                <p className="text-yellow-200 mt-1 font-semibold">Active courses</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className="bg-yellow-400 h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${getProgressPercentage(dashboardStats.totalClasses, 10)}%` }}
                  ></div>
                </div>
                <p className="text-yellow-200 text-xs mt-1 font-bold">
                  {dashboardStats.totalClasses}/10 goal 🏆
                </p>
              </div>
              <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform">
                <Users className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">Tests Completed</p>
                <p className="text-4xl font-black text-yellow-300 mt-2 animate-pulse">
                  {dashboardStats.completedTests}
                </p>
                <p className="text-yellow-200 mt-1 font-semibold">This semester</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className="bg-yellow-400 h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%` }}
                  ></div>
                </div>
                <p className="text-yellow-200 text-xs mt-1 font-bold">
                  {dashboardStats.completedTests}/20 goal 🎯
                </p>
              </div>
              <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">Study Materials</p>
                <p className="text-4xl font-black text-yellow-300 mt-2 animate-pulse">
                  {dashboardStats.studyMaterials}
                </p>
                <p className="text-yellow-200 mt-1 font-semibold">Resources</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className="bg-yellow-400 h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%` }}
                  ></div>
                </div>
                <p className="text-yellow-200 text-xs mt-1 font-bold">
                  {dashboardStats.studyMaterials}/50 goal 📚
                </p>
              </div>
              <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform">
                <BookOpenCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">Current Grade</p>
                <p className="text-4xl font-black text-yellow-300 mt-2 animate-pulse">
                  {dashboardStats.currentGrade}%
                </p>
                <p className="text-yellow-200 mt-1 font-semibold">Average</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ease-out shadow-lg ${
                      dashboardStats.currentGrade >= 90 ? 'bg-yellow-400' :
                      dashboardStats.currentGrade >= 80 ? 'bg-green-400' :
                      dashboardStats.currentGrade >= 70 ? 'bg-blue-400' :
                      dashboardStats.currentGrade >= 60 ? 'bg-orange-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${dashboardStats.currentGrade}%` }}
                  ></div>
                </div>
                <p className="text-yellow-200 text-xs mt-1 font-bold">
                  Target: 85% 🎓
                </p>
              </div>
              <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity & Updates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity - Mickey Mouse Theme */}
          <div className="bg-gradient-to-br from-blue-300 via-purple-300 to-pink-300 rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-xl font-black text-black mb-6 flex items-center">
              <span className="text-3xl mr-2 animate-pulse">🎪</span>
              Mickey's Activity Circus
            </h3>
            <div className="space-y-4">
              {dashboardStats.completedTests > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center border-2 border-black">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      🎭 Test Champion!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You completed {dashboardStats.completedTests} test{dashboardStats.completedTests !== 1 ? 's' : ''} this semester - Mickey is proud! 🏆
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.totalClasses > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.2s' }}>
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-2 border-black">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      🎓 Class Explorer!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You're enrolled in {dashboardStats.totalClasses} class{dashboardStats.totalClasses !== 1 ? 'es' : ''} - What an adventure! 🌟
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.studyMaterials > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.4s' }}>
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-2 border-black">
                    <BookOpenCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      📖 Study Star!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      {dashboardStats.studyMaterials} resource{dashboardStats.studyMaterials !== 1 ? 's' : ''} ready for your magical learning journey! ✨
                    </p>
                  </div>
                </div>
              )}

              {(!dashboardStats.completedTests && !dashboardStats.totalClasses && !dashboardStats.studyMaterials) && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-black border-t-yellow-400 mx-auto mb-4"></div>
                  <p className="text-black font-bold text-sm">
                    Loading Mickey's magic... 🎩
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Goals - Mickey Mouse Theme */}
          <div className="bg-gradient-to-br from-green-300 via-yellow-300 to-orange-300 rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-xl font-black text-black mb-6 flex items-center">
              <span className="text-3xl mr-2 animate-bounce">🏆</span>
              Mickey's Treasure Goals
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-black font-bold">🎯 Complete 20 Tests</span>
                  <span className="text-black font-black">
                    {dashboardStats.completedTests}/20
                  </span>
                </div>
                <div className="bg-black/20 rounded-full h-4 border-2 border-black">
                  <div
                    className="bg-yellow-400 h-4 rounded-full transition-all duration-1000 ease-out border border-black"
                    style={{ width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-black font-bold">🎓 Reach 85% Average</span>
                  <span className="text-black font-black">
                    {dashboardStats.currentGrade}%
                  </span>
                </div>
                <div className="bg-black/20 rounded-full h-4 border-2 border-black">
                  <div
                    className={`h-4 rounded-full transition-all duration-1000 ease-out border border-black ${
                      dashboardStats.currentGrade >= 85 ? 'bg-green-400' : 'bg-yellow-400'
                    }`}
                    style={{ width: `${Math.min(dashboardStats.currentGrade, 85)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-black font-bold">📚 Study 50 Materials</span>
                  <span className="text-black font-black">
                    {dashboardStats.studyMaterials}/50
                  </span>
                </div>
                <div className="bg-black/20 rounded-full h-4 border-2 border-black">
                  <div
                    className="bg-purple-400 h-4 rounded-full transition-all duration-1000 ease-out border border-black"
                    style={{ width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-yellow-200 to-red-200 border-2 border-black rounded-lg shadow-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl animate-spin">🎁</span>
                  <span className="text-black font-black text-sm">
                    Next Treasure Unlocked Soon!
                  </span>
                </div>
                <p className="text-gray-800 font-bold text-xs mt-1">
                  Keep up the magical work to find Mickey's treasures! 🌟
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Quick Actions - Mickey Mouse Theme */}
          <div className="bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-2xl font-black text-black mb-6 flex items-center">
              <span className="text-4xl mr-2 animate-bounce">🚀</span>
              Mickey's Magic Actions
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
                        <h4 className="font-bold text-black group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors duration-300 text-sm">
                          {action.title}
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mt-1 text-xs font-medium">
                          {action.description}
                        </p>
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-full bg-black/20 rounded-full h-1">
                            <div className="bg-yellow-400 h-1 rounded-full transition-all duration-500 w-0 group-hover:w-full"></div>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-black group-hover:text-red-500 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Account Information - Mickey Mouse Theme */}
        {student && (
          <div className="bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 rounded-xl shadow-lg border-4 border-black p-6">
            <h3 className="text-xl font-black text-black mb-6 flex items-center">
              <span className="text-3xl mr-2 animate-pulse">👑</span>
              Mickey's Student Profile
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">🎫 Student ID:</span>
                <span className="text-sm font-black text-black bg-yellow-300 px-2 py-1 rounded border border-black">
                  {student.id || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">📅 Enrollment Date:</span>
                <span className="text-sm font-black text-black bg-blue-300 px-2 py-1 rounded border border-black">
                  {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">🏷️ Status:</span>
                <span className={`text-sm font-black px-3 py-1 rounded-full border-2 border-black ${
                  student.status === 'Active' 
                    ? 'bg-green-300 text-black'
                    : student.status === 'Suspended'
                    ? 'bg-red-300 text-black'
                    : 'bg-gray-300 text-black'
                }`}>
                  {student.status || 'Active'} 🎭
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">📚 Courses Enrolled:</span>
                <span className="text-sm font-black text-black bg-purple-300 px-2 py-1 rounded border border-black">
                  {enrollments.length} 🌟
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
