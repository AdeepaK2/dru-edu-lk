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
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/utils/themeConfig';
import Link from 'next/link';

export default function StudentDashboard() {
  const { student } = useStudentAuth();
  const { theme } = useTheme();
  const themeConfig = THEMES[theme];

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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme === 'ben10'
          ? 'linear-gradient(to bottom right, rgb(74, 222, 128), rgb(0, 0, 0), rgb(74, 222, 128))'
          : 'linear-gradient(to bottom right, rgb(244, 114, 182), rgb(109, 40, 217), rgb(244, 114, 182))'
      }}>
        <div className="text-center">
          <img 
            src={theme === 'ben10' ? '/ben10-loading.gif' : '/tinkerbell-loading.gif'} 
            alt="Loading..." 
            style={{
              width: '320px',
              height: '320px',
              margin: '0 auto 16px auto',
              border: '4px solid',
              borderColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)',
              borderRadius: '8px'
            }}
            onError={(e) => {
              // Fallback to generic loading if theme image not found
              (e.target as HTMLImageElement).src = '/loading.gif';
            }}
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
      <div className="min-h-screen p-6" style={{
        background: theme === 'ben10'
          ? 'linear-gradient(to bottom right, rgb(74, 222, 128), rgb(0, 0, 0), rgb(74, 222, 128))'
          : 'linear-gradient(to bottom right, rgb(244, 114, 182), rgb(109, 40, 217), rgb(244, 114, 182))'
      }}>
        <div className="space-y-6">
        {/* Welcome Header - Dynamic Theme */}
        <div className={`rounded-2xl text-white p-8 relative overflow-hidden border-4 border-black ${
          theme === 'ben10'
            ? 'bg-gradient-to-r from-green-500 via-black to-green-600'
            : 'bg-gradient-to-r from-pink-500 via-purple-600 to-pink-600'
        }`}>
          {/* Themed background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 animate-pulse opacity-20" style={{
            backgroundColor: theme === 'ben10' ? 'rgb(134, 239, 172)' : 'rgb(244, 114, 182)'
          }}></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black rounded-full translate-y-12 -translate-x-12 animate-pulse opacity-20"></div>
         

          <div className="flex items-center justify-between relative z-10">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-2">
                <img 
                  src={theme === 'ben10' ? '/ben10-welcome.png' : '/tinkerbell-welcome.png'} 
                  alt="Welcome" 
                  className={`w-40 h-40 rounded-full border-4 border-black ring-4 ${
                    theme === 'ben10' ? 'ring-green-400' : 'ring-pink-400'
                  }`}
                  onError={(e) => {
                    // Fallback to generic welcome image if theme image not found
                    (e.target as HTMLImageElement).src = '/welcome.png';
                  }}
                />
                <div>
                  <h1 className="text-3xl font-bold">
                    Hey {student?.name}! Ready to {theme === 'ben10' ? 'transform' : 'enchant'} your learning?
                  </h1>
                  <p className="text-lg font-semibold mt-2" style={{
                    color: theme === 'ben10' ? 'rgb(187, 247, 208)' : 'rgb(251, 207, 232)'
                  }}>
                    {theme === 'ben10' 
                      ? "Let's make learning heroic with Ben 10's power!" 
                      : "Let's sprinkle some fairy magic into learning!"}
                  </p>
                </div>
              </div>
              <p className="mb-4 text-base" style={{
                color: theme === 'ben10' ? 'rgb(187, 247, 208)' : 'rgb(251, 207, 232)'
              }}>
                {theme === 'ben10' 
                  ? 'Welcome to your alien learning headquarters!' 
                  : 'Welcome to your enchanted learning sanctuary!'}
              </p>
              <div className="flex items-center space-x-2" style={{
                color: theme === 'ben10' ? 'rgb(187, 247, 208)' : 'rgb(251, 207, 232)'
              }}>
                <span className="text-sm font-medium">{getMelbourneDateTime()}</span>
              </div>
            </div>
            {/* Omnitrix device removed per request */}
          </div>
        </div>

        {/* Motivational Message - Dynamic Theme */}
        {!loading && dashboardStats.currentGrade > 0 && (
          <div className={`border-4 border-black rounded-xl p-6 animate-fade-in relative overflow-hidden ${
            theme === 'ben10'
              ? 'bg-gradient-to-r from-green-400 via-black to-green-400'
              : 'bg-gradient-to-r from-pink-400 via-purple-600 to-pink-400'
          }`}>
        

            <div className="flex items-start space-x-4 relative z-10">
              <div className="relative">
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center">
                  {getMotivationalMessage().message}
                 
                </h3>
                <p className="text-white text-base leading-relaxed font-medium">
                  {theme === 'ben10'
                    ? "Remember, just like Ben 10's transformations, every great achievement starts with a single power-up!"
                    : "Remember, like Tinkerbell's magic, every learning moment sparkles with possibility!"}
                </p>
                <div className="mt-4 flex items-center space-x-4 text-sm text-white">
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">{theme === 'ben10' ? '📊' : '📈'}</span>
                    <span>Grade: <strong style={{
                      color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                    }}>{dashboardStats.currentGrade}%</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">📝</span>
                    <span>Tests: <strong className="text-white">{dashboardStats.completedTests}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">{theme === 'ben10' ? '👥' : '✨'}</span>
                    <span>Classes: <strong style={{
                      color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                    }}>{dashboardStats.totalClasses}</strong></span>
                  </div>
                </div>
                {/* Interactive encouragement */}
                <div className="mt-4 flex space-x-2">
                  <button className={`text-white px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all animate-pulse border-2 border-black ${
                    theme === 'ben10'
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-pink-500 hover:bg-pink-600'
                  }`}>
                    {theme === 'ben10' ? 'Transform!' : 'Enchant!'} 💪
                  </button>
                  <button className={`px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all border-2 ${
                    theme === 'ben10'
                      ? 'bg-black hover:bg-gray-800 text-green-400 border-green-400'
                      : 'bg-black hover:bg-gray-800 text-pink-400 border-pink-400'
                  }`}>
                    {theme === 'ben10' ? "You're Heroic!" : "You're Magical!"} 🌟
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards - Dynamic Theme */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-400 to-green-600'
              : 'bg-gradient-to-br from-pink-400 to-pink-600'
          }`}>
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
                  {dashboardStats.totalClasses}/10 goal {theme === 'ben10' ? '🦸‍♂️' : '🧚‍♀️'}
                </p>
              </div>
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center border-4 border-white transform hover:rotate-12 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-black to-gray-800'
              : 'bg-gradient-to-br from-purple-800 to-purple-900'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-bold mb-2" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>Tests Completed</p>
                <p className="text-4xl font-black mt-2 animate-pulse" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>
                  {dashboardStats.completedTests}
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>This semester</p>
                <div className="mt-3 rounded-full h-3" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.3)' : 'rgba(244, 114, 182, 0.3)'
                }}>
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)',
                      width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>
                  {dashboardStats.completedTests}/20 goal 🎯
                </p>
              </div>
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform" style={{
                backgroundColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
              }}>
                <FileText className="w-8 h-8 text-black" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-500 to-black'
              : 'bg-gradient-to-br from-purple-500 to-black'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">Study Materials</p>
                <p className="text-4xl font-black mt-2 animate-pulse" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>
                  {dashboardStats.studyMaterials}
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>Resources</p>
                <div className="mt-3 rounded-full h-3" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.3)' : 'rgba(244, 114, 182, 0.3)'
                }}>
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)',
                      width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>
                  {dashboardStats.studyMaterials}/50 goal 📚
                </p>
              </div>
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform" style={{
                backgroundColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
              }}>
                <BookOpenCheck className="w-8 h-8 text-black" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-600 to-black'
              : 'bg-gradient-to-br from-purple-600 to-black'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-sm font-bold mb-2">Current Grade</p>
                <p className="text-4xl font-black mt-2 animate-pulse" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>
                  {dashboardStats.currentGrade}%
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>Average</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: 
                        dashboardStats.currentGrade >= 90 ? (theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)') :
                        dashboardStats.currentGrade >= 80 ? (theme === 'ben10' ? 'rgb(74, 222, 128)' : 'rgb(244, 114, 182)') :
                        dashboardStats.currentGrade >= 70 ? (theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(244, 114, 182)') :
                        dashboardStats.currentGrade >= 60 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)',
                      width: `${dashboardStats.currentGrade}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                }}>
                  Target: 85% 🎓
                </p>
              </div>
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-black transform hover:rotate-12 transition-transform" style={{
                backgroundColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
              }}>
                <BarChart3 className="w-8 h-8 text-black" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity & Updates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity - Dynamic Theme */}
          <div className={`rounded-xl shadow-lg border-4 border-black p-6 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-300 via-black to-green-400'
              : 'bg-gradient-to-br from-pink-300 via-purple-600 to-pink-400'
          }`}>
            <h3 className="text-xl font-black text-white mb-6 flex items-center">
              <span className="text-3xl mr-2 animate-pulse">{theme === 'ben10' ? '🚀' : '✨'}</span>
              {theme === 'ben10' ? "Ben 10's Hero Activity" : "Tinkerbell's Magic Activity"}
            </h3>
            <div className="space-y-4">
              {dashboardStats.completedTests > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-black" style={{
                    backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(236, 72, 153)'
                  }}>
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '🦸‍♂️' : '🧚‍♀️'} {theme === 'ben10' ? 'Test Hero' : 'Quiz Enchanter'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You completed {dashboardStats.completedTests} test{dashboardStats.completedTests !== 1 ? 's' : ''} this semester - {theme === 'ben10' ? "Ben 10 is proud! 🏆" : "Tinkerbell sprinkles magic! ✨"}
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.totalClasses > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.2s' }}>
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border-2" style={{
                    borderColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                  }}>
                    <Users className="w-5 h-5" style={{
                      color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                    }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '🔄' : '🌙'} {theme === 'ben10' ? 'Class Transformer' : 'Learning Dreamer'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You're enrolled in {dashboardStats.totalClasses} class{dashboardStats.totalClasses !== 1 ? 'es' : ''} - {theme === 'ben10' ? "What an alien adventure! 👽" : "Welcome to the enchanted realm! 🏰"}
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.studyMaterials > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.4s' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-black" style={{
                    backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(236, 72, 153)'
                  }}>
                    <BookOpenCheck className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '⚡' : '💫'} {theme === 'ben10' ? 'Study Champion' : 'Knowledge Seeker'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      {dashboardStats.studyMaterials} resource{dashboardStats.studyMaterials !== 1 ? 's' : ''} ready for your {theme === 'ben10' ? 'heroic learning journey! 🚀' : 'magical adventure! 🌟'}
                    </p>
                  </div>
                </div>
              )}

              {(!dashboardStats.completedTests && !dashboardStats.totalClasses && !dashboardStats.studyMaterials) && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-black mx-auto mb-4" style={{
                    borderColor: theme === 'ben10' ? 'rgb(74, 222, 128)' : 'rgb(244, 114, 182)',
                    borderTopColor: 'black'
                  }}></div>
                  <p className="text-black font-bold text-sm">
                    Loading {theme === 'ben10' ? "Ben 10's power... ⚡" : "Tinkerbell's magic... ✨"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Goals - Dynamic Theme */}
          <div className={`rounded-xl shadow-lg border-4 border-black p-6 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-black via-green-500 to-black'
              : 'bg-gradient-to-br from-black via-purple-500 to-black'
          }`}>
            <h3 className="mb-6 flex items-center text-xl font-black" style={{
              color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
            }}>
              <span className="text-3xl mr-2 animate-bounce">{theme === 'ben10' ? '⚡' : '✨'}</span>
              {theme === 'ben10' ? "Ben 10's Power Goals" : "Tinkerbell's Magic Goals"}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                  }}>{theme === 'ben10' ? '🎯' : '🌟'} {theme === 'ben10' ? 'Complete 20 Tests' : 'Complete 20 Quizzes'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                  }}>
                    {dashboardStats.completedTests}/20
                  </span>
                </div>
                <div className="rounded-full h-4 border-2 border-black" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.2)' : 'rgba(244, 114, 182, 0.2)'
                }}>
                  <div
                    className="h-4 rounded-full transition-all duration-1000 ease-out border border-black"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(236, 72, 153)',
                      width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                  }}>{theme === 'ben10' ? '🎓' : '📚'} {theme === 'ben10' ? 'Reach 85% Average' : 'Reach 85% Average'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                  }}>
                    {dashboardStats.currentGrade}%
                  </span>
                </div>
                <div className="rounded-full h-4 border-2" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.2)' : 'rgba(244, 114, 182, 0.2)',
                  borderColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(236, 72, 153)'
                }}>
                  <div
                    className="h-4 rounded-full transition-all duration-1000 ease-out border border-black"
                    style={{
                      backgroundColor: dashboardStats.currentGrade >= 85 
                        ? (theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(236, 72, 153)')
                        : (theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'),
                      width: `${dashboardStats.currentGrade}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                  }}>📚 {theme === 'ben10' ? 'Study 50 Materials' : 'Explore 50 Resources'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)'
                  }}>
                    {dashboardStats.studyMaterials}/50
                  </span>
                </div>
                <div className="rounded-full h-4 border-2 border-black" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.2)' : 'rgba(244, 114, 182, 0.2)'
                }}>
                  <div
                    className="h-4 rounded-full transition-all duration-1000 ease-out border"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'black' : 'rgb(236, 72, 153)',
                      borderColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(244, 114, 182)',
                      width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg shadow-lg border-2 border-black" style={{
                background: theme === 'ben10'
                  ? 'linear-gradient(to right, rgb(132, 204, 22), black)'
                  : 'linear-gradient(to right, rgb(244, 114, 182), rgb(109, 40, 217))'
              }}>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl animate-spin">{theme === 'ben10' ? '🔄' : '✨'}</span>
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
