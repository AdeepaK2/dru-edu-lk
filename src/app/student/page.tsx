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
          : theme === 'tinkerbell'
          ? 'linear-gradient(to bottom right, rgb(134, 239, 172), rgb(202, 138, 4), rgb(134, 239, 172))'
          : 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(79, 70, 229), rgb(96, 165, 250))'
      }}>
        <div className="text-center">
          <p className="text-white font-bold text-4xl mb-4">
            {theme === 'ben10' ? 'Loading' : theme === 'tinkerbell' ? 'Loading' : 'Loading'}
          </p>
          <p className="text-white font-bold text-2xl">
            <span className="inline-block animate-bounce" style={{animationDelay: '0s'}}>.</span>
            <span className="inline-block animate-bounce" style={{animationDelay: '0.2s'}}>.</span>
            <span className="inline-block animate-bounce" style={{animationDelay: '0.4s'}}>.</span>
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
          : theme === 'tinkerbell'
          ? 'linear-gradient(to bottom right, rgb(134, 239, 172), rgb(202, 138, 4), rgb(134, 239, 172))'
          : 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(79, 70, 229), rgb(96, 165, 250))'
      }}>
        <div className="space-y-6">
        {/* Welcome Header - Dynamic Theme */}
        <div className={`rounded-2xl text-white p-8 relative overflow-hidden border-4 border-black ${
          theme === 'ben10'
            ? 'bg-gradient-to-br from-green-500 to-black'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'
            : 'bg-gradient-to-r from-blue-500 to-indigo-600'
        }`}>
          {/* Themed background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16  opacity-20" style={{
            backgroundColor: theme === 'ben10' ? 'rgb(134, 239, 172)' : theme === 'tinkerbell' ? 'rgb(202, 138, 4)' : 'rgb(147, 197, 253)'
          }}></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full translate-y-12 -translate-x-12  opacity-20" style={{
            backgroundColor: theme === 'ben10' ? 'rgb(0, 0, 0)' : theme === 'tinkerbell' ? 'rgb(0, 0, 0)' : 'rgb(55, 65, 81)'
          }}></div>
         

          <div className="flex items-center justify-between relative z-10">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-2">
                <img 
                  src={theme === 'ben10' ? '/ben10-welcome.png' : theme === 'tinkerbell' ? '/tinkerbell-welcome.png' : '/welcome-professional.png'} 
                  alt="Welcome" 
                  className={`w-40 h-40 rounded-full border-4 border-black ring-4 ${
                    theme === 'ben10' ? 'ring-green-400' : theme === 'tinkerbell' ? 'ring-green-600' : 'ring-blue-400'
                  }`}
                  onError={(e) => {
                    // Fallback to generic welcome image if theme image not found
                    (e.target as HTMLImageElement).src = '/welcome.png';
                  }}
                />
                <div>
                  <h1 className="text-3xl font-bold">
                    Hey {student?.name}! Ready to {theme === 'ben10' ? 'transform' : theme === 'tinkerbell' ? 'enchant' : 'excel'} your learning?
                  </h1>
                  <p className="text-lg font-semibold mt-2" style={{
                    color: theme === 'ben10' ? 'rgb(187, 247, 208)' : theme === 'tinkerbell' ? 'rgb(0, 0, 30)' : 'rgb(191, 219, 254)'
                  }}>
                    {theme === 'ben10' 
                      ? "Let's make learning heroic with Ben 10's power!" 
                      : theme === 'tinkerbell'
                      ? "Let's sprinkle some fairy magic into learning!"
                      : "Let's focus on your educational goals!"}
                  </p>
                </div>
              </div>
              <p className="mb-4 text-base" style={{
                color: theme === 'ben10' ? 'rgb(187, 247, 208)' : theme === 'tinkerbell' ? 'rgb(0, 100, 8)' : 'rgb(191, 219, 254)'
              }}>
                {theme === 'ben10' 
                  ? 'Welcome to your alien learning headquarters!' 
                  : theme === 'tinkerbell'
                  ? 'Welcome to your enchanted learning sanctuary!'
                  : 'Welcome to your learning dashboard!'}
              </p>
              <div className="flex items-center space-x-2" style={{
                color: theme === 'ben10' ? 'rgb(0,0,0)' : theme === 'tinkerbell' ? 'rgb(0, 0, 8)' : 'rgb(226, 232, 240)'
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
            ? 'bg-gradient-to-br from-green-500 to-black'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-green-300 via-yellow-500 to-green-300'
            : 'bg-gradient-to-r from-blue-400 to-indigo-500'
        }`}>
            <div className="flex items-start space-x-4 relative z-10">
              <div className="relative">
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center">
                  {getMotivationalMessage().message}
                 
                </h3>
                <p className="text-black text-base leading-relaxed font-medium">
                  {theme === 'ben10'
                    ? "Remember, just like Ben 10's transformations, every great achievement starts with a single power-up!"
                    : theme === 'tinkerbell'
                    ? "Remember, like Tinkerbell's magic, every learning moment sparkles with possibility!"
                    : "Stay focused and consistent. Success comes from small steps taken every day!"}
                </p>
                <div className="mt-4 flex items-center space-x-4 text-sm text-black">
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">{theme === 'ben10' ? '📊' : theme === 'tinkerbell' ? '📈' : '📈'}</span>
                    <span>Grade: <strong style={{
                      color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(0, 138, 4)'
                    }}>{dashboardStats.currentGrade}%</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">📝</span>
                    <span>Tests: <strong className="text-green-800">{dashboardStats.completedTests}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    
                    <span>Classes: <strong style={{
                      color: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(0, 138, 4)'
                    }}>{dashboardStats.totalClasses}</strong></span>
                  </div>
                </div>
                {/* Interactive encouragement */}
                <div className="mt-4 flex space-x-2">
                 
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
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-500'
              : 'bg-gradient-to-br from-blue-400 to-blue-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-black text-sm font-bold mb-2">My Classes</p>
                <p className="text-4xl font-black text-white mt-2 ">
                  {dashboardStats.totalClasses}
                </p>
                <p className="text-black mt-1 font-semibold">Active courses</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className="bg-white h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${getProgressPercentage(dashboardStats.totalClasses, 10)}%` }}
                  ></div>
                </div>
                <p className="text-black text-xs mt-1 font-bold">
                  {dashboardStats.totalClasses}/10 goal {theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : '📚'}
                </p>
              </div>
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center border-4 border-white transform hover:rotate-12 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-400 to-green-600'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-600'
              : 'bg-gradient-to-br from-indigo-400 to-indigo-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-bold mb-2" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' : theme === 'tinkerbell' ? 'rgb(0, 0, 0)' : 'rgb(0, 0, 0)'
                }}>Tests Completed</p>
                <p className="text-4xl font-black mt-2" style={{
                  color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)'
                }}>
                  {dashboardStats.completedTests}
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 4)'
                }}>This semester</p>
                <div className="mt-3 rounded-full h-3" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(0,0,0, 0.3)' : 'rgba(0, 0, 0, 0.3)'
                }}>
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)',
                      width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 8)'
                }}>
                  {dashboardStats.completedTests}/20 goal 🎯
                </p>
              </div>
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-white transform hover:rotate-12 transition-transform" style={{
                backgroundColor: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 5)'
              }}>
                <FileText className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-400 to-green-600'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-600'
              : 'bg-gradient-to-br from-cyan-400 to-blue-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-black text-sm font-bold mb-2">Study Materials</p>
                <p className="text-4xl font-black mt-2 " style={{
                  color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)'
                }}>
                  {dashboardStats.studyMaterials}
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 4)'
                }}>Resources</p>
                <div className="mt-3 rounded-full h-3" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(0,0,0, 0.3)' : 'rgba(0, 0, 4, 0.3)'
                }}>
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)',
                      width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,4)' : 'rgb(0, 0, 4)'
                }}>
                  {dashboardStats.studyMaterials}/50 goal 📚
                </p>
              </div>
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-white transform hover:rotate-12 transition-transform" style={{
                backgroundColor: theme === 'ben10' ? 'rgb(0,0,5)' : 'rgb(0, 0, 5)'
              }}>
                <BookOpenCheck className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-400 to-green-600'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-600'
              : 'bg-gradient-to-br from-purple-400 to-indigo-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-black text-sm font-bold mb-2">Current Grade</p>
                <p className="text-4xl font-black mt-2 " style={{
                  color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)'
                }}>
                  {dashboardStats.currentGrade}%
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 4)'
                }}>Average</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: 
                        dashboardStats.currentGrade >= 90 ? (theme === 'ben10' ? 'rgb(132, 204, 22)' : theme === 'tinkerbell' ? 'rgb(202, 138, 4)' : 'rgb(34, 197, 94)') :
                        dashboardStats.currentGrade >= 80 ? (theme === 'ben10' ? 'rgb(74, 222, 128)' : theme === 'tinkerbell' ? 'rgb(202, 138, 4)' : 'rgb(34, 197, 94)') :
                        dashboardStats.currentGrade >= 70 ? (theme === 'ben10' ? 'rgb(34, 197, 94)' : theme === 'tinkerbell' ? 'rgb(202, 138, 4)' : 'rgb(96, 165, 250)') :
                        dashboardStats.currentGrade >= 60 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)',
                      width: `${dashboardStats.currentGrade}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 4)'
                }}>
                  Target: 85% 🎓
                </p>
              </div>
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-white transform hover:rotate-12 transition-transform" style={{
                backgroundColor: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 4)'
              }}>
                <BarChart3 className="w-8 h-8 text-white" />
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
              : 'bg-gradient-to-br from-yellow-300 via-green-500 to-yellow-400'
          }`}>
            <h3 className="text-xl font-black text-black mb-6 flex items-center">
       
              {theme === 'ben10' ? "Class Activity" : "Class Activity"}
            </h3>
            <div className="space-y-4">
              {dashboardStats.completedTests > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-black" style={{
                    backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(255, 255, 255)'
                  }}>
                    <FileText className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : '📚'} {theme === 'ben10' ? 'Test Hero' : theme === 'tinkerbell' ? 'Quiz Enchanter' : 'Quiz Champion'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You completed {dashboardStats.completedTests} test{dashboardStats.completedTests !== 1 ? 's' : ''} this semester - {theme === 'ben10' ? "Ben 10 is proud! 🏆" : theme === 'tinkerbell' ? "Tinkerbell sprinkles magic! ✨" : "Great progress! 🎯"}
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.totalClasses > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.2s' }}>
                  <div className="w-10 h-10  rounded-full flex items-center justify-center border-2" style={{
                    borderColor: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0, 0, 0)', backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(255, 255, 255)'
                  }}>
                    <Users className="w-5 h-5" style={{
                      color: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0,0,0)'
                    }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '🔄' : theme === 'tinkerbell' ? '🌙' : '📚'} {theme === 'ben10' ? 'Class Transformer' : theme === 'tinkerbell' ? 'Learning Dreamer' : 'Academic Achiever'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You're enrolled in {dashboardStats.totalClasses} class{dashboardStats.totalClasses !== 1 ? 'es' : ''} - {theme === 'ben10' ? "What an alien adventure! 👽" : theme === 'tinkerbell' ? "Welcome to the enchanted realm! 🏰" : "Your learning community! 🎓"}
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.studyMaterials > 0 && (
                <div className="flex items-start space-x-3 p-4 bg-white border-2 border-black rounded-lg animate-fade-in shadow-lg" style={{ animationDelay: '0.4s' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-black" style={{
                    backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(255, 255, 255)'
                  }}>
                    <BookOpenCheck className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '⚡' : theme === 'tinkerbell' ? '💫' : '📚'} {theme === 'ben10' ? 'Study Champion' : theme === 'tinkerbell' ? 'Knowledge Seeker' : 'Learning Guide'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      {dashboardStats.studyMaterials} resource{dashboardStats.studyMaterials !== 1 ? 's' : ''} ready for your {theme === 'ben10' ? 'heroic learning journey! 🚀' : theme === 'tinkerbell' ? 'magical adventure! 🌟' : 'educational journey! 📚'}
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
                    Loading {theme === 'ben10' ? "Ben 10's power... ⚡" : theme === 'tinkerbell' ? "Tinkerbell's magic... ✨" : "your data... 📚"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Goals - Dynamic Theme */}
          <div className={`rounded-xl shadow-lg border-4 border-black p-6 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-green-300 via-black to-green-400'
              : 'bg-gradient-to-br from-green-400 to-yellow-600'
          }`}>
            <h3 className="mb-6 flex items-center text-xl font-black" style={{
              color: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0,0,0)'
            }}>
              
              {theme === 'ben10' ? "Your Goals" : "Your Goals"}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255,255,255)'
                  }}> {theme === 'ben10' ? 'Complete 20 Tests' : theme === 'tinkerbell' ? 'Complete 20 Quizzes' : 'Complete 20 Assessments'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)'
                  }}>
                    {dashboardStats.completedTests}/20
                  </span>
                </div>
                <div className="rounded-full h-4 border-2 border-black" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.2)' : 'rgba(202, 138, 4, 0.2)'
                }}>
                  <div
                    className="h-4 rounded-full transition-all duration-1000 ease-out border border-black"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(202, 138, 4)',
                      width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255,255,255)'
                  }}> {theme === 'ben10' ? 'Reach 85% Average' : 'Reach 85% Average'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)'
                  }}>
                    {dashboardStats.currentGrade}%
                  </span>
                </div>
                <div className="rounded-full h-4 border-2" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.2)' : 'rgba(202, 138, 4, 0.2)',
                  borderColor: theme === 'ben10' ? 'rgb(0,0,0)' : 'rgb(0,0,0)'
                }}>
                  <div
                    className="h-4 rounded-full transition-all duration-1000 ease-out border border-black"
                    style={{
                      backgroundColor: dashboardStats.currentGrade >= 85 
                        ? (theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(202, 138, 4)')
                        : (theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(202, 138, 4)'),
                      width: `${dashboardStats.currentGrade}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)'
                  }}>{theme === 'ben10' ? 'Study 50 Materials' : 'Explore 50 Resources'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' : 'rgb(255, 255, 255)'
                  }}>
                    {dashboardStats.studyMaterials}/50
                  </span>
                </div>
                <div className="rounded-full h-4 border-2 border-black" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(132, 204, 22, 0.2)' : 'rgba(202, 138, 4, 0.2)'
                }}>
                  <div
                    className="h-4 rounded-full transition-all duration-1000 ease-out border"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(34, 197, 94)' : 'rgb(202, 138, 4)',
                      borderColor: theme === 'ben10' ? 'rgb(132, 204, 22)' : 'rgb(202, 138, 4)',
                      width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg shadow-lg border-2 border-black" style={{
                background: theme === 'ben10'
                  ? 'bg-gradient-to-br from-green-300 via-black to-green-400'
                  : 'bg-gradient-to-br from-green-400 to-yellow-600'
              }}>
                <div className="flex items-center space-x-2">
                 
                  <span className="text-green-800 font-black text-sm">
                    {theme === 'ben10' ? 'Next Transformation Unlocked Soon!' : 'Next Magic Spell Unlocked Soon!'}
                  </span>
                </div>
                <p className="text-white font-bold text-xs mt-1">
                  {theme === 'ben10' 
                    ? "Keep up the heroic work to unlock Ben 10's powers! " 
                    : "Keep up the magical work to unlock Tinkerbell's spells! ✨"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Quick Actions - Dynamic Theme */}
          <div className={`bg-gradient-to-r rounded-xl shadow-lg border-4 border-black p-6 ${
            theme === 'ben10'
              ? 'from-green-400 via-black to-green-500'
              : 'from-yellow-400 via-green-500 to-yellow-500'
          }`}>
            <h3 className="text-2xl font-black text-black mb-6 flex items-center">
          
              {theme === 'ben10' ? "Quick Actions" : "Quick Actions"}
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

        {/* Account Information - Dynamic Theme */}
        {student && (
          <div className={`bg-gradient-to-r rounded-xl shadow-lg border-4 border-black p-6 ${
            theme === 'ben10'
              ? 'from-green-400 via-black to-green-500'
              : 'from-yellow-400 via-green-500 to-yellow-500'
          }`}>
            <h3 className="text-xl font-black text-white mb-6 flex items-center">
              <span className="text-6xl mr-2 ">{theme === 'ben10' ? '🦸‍♂️' : '🧚‍♀️'}</span>
              {theme === 'ben10' ? "Student Profile" : "Student Profile"}
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
                    ? (theme === 'ben10' ? 'bg-green-400 text-black' : 'bg-yellow-400 text-black')
                    : student.status === 'Suspended'
                    ? 'bg-red-400 text-black'
                    : 'bg-gray-400 text-black'
                }`}>
                  {student.status || 'Active'} 
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">📚 Courses Enrolled:</span>
                <span className={`text-sm font-black text-black px-2 py-1 rounded border border-black ${
                  theme === 'ben10' ? 'bg-green-500' : 'bg-yellow-500'
                }`}>
                  {enrollments.length} 
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
