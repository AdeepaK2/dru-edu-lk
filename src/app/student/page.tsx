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
        color: "text-[#64cc4f]",
        bgColor: "bg-[#b2e05b]/20 dark:bg-[#b2e05b]/10"
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
      color: 'bg-[#64cc4f]'
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
    const loadingBgClass = theme === 'default' ? 'bg-gradient-to-br from-gray-50 to-gray-100' : theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'cricketverse' ? 'bg-gradient-to-br from-blue-400 to-indigo-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-br from-[#fff800] via-[#fff800] to-[#fff800]' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267]/20 to-[#4F2C8D]/20' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : 'bg-gradient-to-br from-gray-50 to-gray-100';
    const loadingBoxClass = theme === 'default' ? 'bg-white border-4 border-black' : theme === 'bounceworld' ? 'bg-white border-4 border-[#1D428A]' : theme === 'ponyville' ? 'bg-white border-4 border-[#e13690]' : 'bg-white border-4 border-black';
    return (
      <div className={'min-h-screen ' + loadingBgClass + ' flex items-center justify-center'}>
        <div className={loadingBoxClass + ' rounded-3xl p-8 shadow-2xl'}>
          {/* Theme-Specific Loading Animation */}
          <div className="relative mb-6 flex flex-col items-center">
            {/* Tinkerbell Loading GIF */}
            {theme === 'tinkerbell' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/tinkerbell-loading.gif" 
                  alt="Tinkerbell Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-yellow-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* Ben 10 Loading GIF */}
            {theme === 'ben10' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/ben10-loading.gif" 
                  alt="Ben 10 Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#64cc4f] mt-4">Loading</span>
              </div>
            )}
            
            {/* CricketVerse Loading */}
            {(theme === 'cricketverse' || theme === 'cricketverse-australian') && (
              <div className="flex flex-col items-center">
                <img
                  src="/batsman.gif"
                  alt="CricketVerse Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* BounceWorld Loading */}
            {theme === 'bounceworld' && (
              <div className="flex flex-col items-center">
                <img
                  src="/bounceworld.gif"
                  alt="BounceWorld Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading</span>
              </div>
            )}
            
            {/* Avengers Loading */}
            {theme === 'avengers' && (
              <div className="flex flex-col items-center">
                <img
                  src="/avenger.gif"
                  alt="Avengers Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#2C1267] mt-4">Loading</span>
              </div>
            )}
            
            {/* Ponyville Loading */}
            {theme === 'ponyville' && (
              <div className="flex flex-col items-center">
                <img
                  src="/ponyville-loading.gif"
                  alt="Ponyville Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#e13690] mt-4">Loading</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {!['tinkerbell', 'ben10', 'cricketverse', 'cricketverse-australian', 'bounceworld', 'avengers', 'ponyville'].includes(theme) && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-black mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Dashboard...</h2>
            <p className="text-gray-600 font-medium">Get ready to transform your learning! </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen p-6" style={{
        background: theme === 'default'
          ? 'linear-gradient(to bottom right, rgb(134, 239, 172), rgb(243, 244, 246), rgb(134, 239, 172))'
          : theme === 'ben10'
          ? 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))'
          : theme === 'tinkerbell'
          ? 'linear-gradient(to bottom right, rgb(134, 239, 172), rgb(202, 138, 4), rgb(134, 239, 172))'
          : theme === 'cricketverse'
          ? 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(79, 70, 229), rgb(96, 165, 250))'
          : theme === 'cricketverse-australian'
          ? 'linear-gradient(to bottom right, rgb(255, 255, 65), rgb(255, 255, 65), rgb(255, 255, 65))'
          : theme === 'bounceworld'
          ? 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(29, 66, 138), rgb(200, 16, 46))'
          : theme === 'avengers'
          ? 'linear-gradient(to bottom right, rgba(44, 18, 103, 0.3), rgba(79, 44, 141, 0.2), rgba(44, 18, 103, 0.3))'
          : theme === 'ponyville'
          ? 'linear-gradient(to bottom right, rgb(255, 245, 251), rgb(241, 174, 213), rgb(255, 46, 159))'
          : 'linear-gradient(to bottom right, rgb(134, 239, 172), rgb(243, 244, 246), rgb(134, 239, 172))'
      }}>
        <div className="space-y-6">
        {/* Welcome Header - Dynamic Theme */}
        <div className={`rounded-2xl text-white p-8 relative overflow-hidden border-4 ${theme === 'default' ? 'border-black' : theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'cricketverse-australian' ? 'border-black' : 'border-black'} ${
          theme === 'default'
            ? 'bg-gradient-to-r from-blue-600 via-indigo-700 to-indigo-900'
            : theme === 'ben10'
            ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'
            : theme === 'cricketverse'
            ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
            : theme === 'cricketverse-australian'
            ? 'bg-gradient-to-br from-white via-[#f6f672] to-[#ffff2a]'
            : theme === 'bounceworld'
            ? 'bg-gradient-to-r from-white via-[#1D428A] to-[#C8102E] text-black border-[#1D428A]'
            : theme === 'avengers'
            ? 'bg-gradient-to-r from-[#2C1267] to-[#4F2C8D]'
            : theme === 'ponyville'
            ? 'bg-gradient-to-r from-[#f58bc9] via-[#e13690] to-[#ff2e9f]'
            : 'bg-gradient-to-r from-blue-600 via-indigo-700 to-indigo-900'
        }`}>
          {/* Themed background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16  opacity-20" style={{
            backgroundColor: theme === 'default' ? 'rgb(96, 165, 250)'
              : theme === 'ben10' ? 'rgb(178, 224, 91)'
              : theme === 'tinkerbell' ? 'rgb(202, 138, 4)'
              : theme === 'cricketverse' ? 'rgb(147, 197, 253)'
              : theme === 'cricketverse-australian' ? 'rgb(255, 248, 0)'
              : theme === 'bounceworld' ? 'rgb(200, 16, 46)'
              : theme === 'avengers' ? 'rgb(96, 74, 199)'
              : theme === 'ponyville' ? 'rgb(255, 46, 159)'
              : 'rgb(96, 165, 250)'
          }}></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full translate-y-12 -translate-x-12  opacity-20" style={{
            backgroundColor: theme === 'default' ? 'rgb(55, 65, 81)'
              : theme === 'ben10' ? 'rgb(34, 34, 34)'
              : theme === 'tinkerbell' ? 'rgb(0, 0, 0)'
              : theme === 'cricketverse' ? 'rgb(55, 65, 81)'
              : theme === 'cricketverse-australian' ? 'rgb(255, 248, 0)'
              : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
              : theme === 'avengers' ? 'rgb(44, 18, 103)'
              : theme === 'ponyville' ? 'rgb(241, 174, 213)'
              : 'rgb(55, 65, 81)'
          }}></div>
         

          <div className="flex items-center justify-between relative z-10">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-2">
                {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'cricketverse' || theme === 'cricketverse-australian' || theme === 'avengers' || theme === 'bounceworld' || theme === 'ponyville' || theme === 'default') && (
                  <img
                    src={theme === 'default' ? '/Logo.png'
                        : theme === 'ben10' ? '/ben10-welcome.png'
                        : theme === 'tinkerbell' ? '/tinkerbell-welcome.png'
                        : (theme === 'cricketverse' || theme === 'cricketverse-australian') ? '/cricketverse.png'
                        : theme === 'avengers' ? '/avengers/thor.png'
                        : theme === 'bounceworld' ? '/bounce_world.jpg'
                        : theme === 'ponyville' ? '/ponyville.webp'
                        : '/Logo.png'}
                    alt="Welcome"
                    className={`${
                      theme === 'default' ? 'w-32 h-32'
                      : theme === 'avengers' ? 'w-48 h-48'
                      : theme === 'bounceworld' ? 'w-48 h-48'
                      : theme === 'ponyville' ? 'w-48 h-48'
                      : (theme === 'cricketverse' || theme === 'cricketverse-australian') ? 'w-56 h-48'
                      : 'w-40 h-40'
                    } ${
                      theme === 'avengers' ? '' : 'rounded-full'
                    } ${
                      theme === 'default' ? 'ring-4 ring-blue-500 border-4 border-black'
                      : theme === 'ben10' ? 'ring-4 ring-[#64cc4f] border-4 border-black'
                      : theme === 'tinkerbell' ? 'ring-4 ring-green-600 border-4 border-black'
                      : theme === 'cricketverse' ? 'ring-4 ring-blue-500 border-4 border-black'
                      : theme === 'cricketverse-australian' ? 'ring-4 ring-[#fff800] border-4 border-black'
                      : theme === 'bounceworld' ? 'ring-4 ring-[#1D428A] border-4 border-black'
                      : theme === 'ponyville' ? 'ring-4 ring-[#e13690] border-4 border-black'
                      : 'ring-4 ring-blue-500 border-4 border-black'
                    }`}
                    onError={(e) => {
                      // Fallback to generic welcome image if theme image not found
                      (e.target as HTMLImageElement).src = '/welcome.png';
                    }}
                  />
                )}
                <div>
                  <h1 className={`text-3xl font-bold ${theme === 'bounceworld' || theme === 'default' || theme === 'cricketverse-australian' ? 'text-black' : ''}`}>
                    Hey, {student?.name}! Ready to {
                      theme === 'default' ? 'excel in'
                      : theme === 'ben10' ? 'transform'
                      : theme === 'tinkerbell' ? 'enchant'
                      : theme === 'cricketverse' ? 'score big in'
                      : theme === 'cricketverse-australian' ? 'smash boundaries in'
                      : theme === 'bounceworld' ? 'bounce into'
                      : theme === 'ponyville' ? 'gallop into'
                      : theme === 'avengers' ? 'assemble for'
                      : 'excel in'
                    } your learning?
                  </h1>
                  <p className="text-lg font-semibold mt-2" style={{
                    color: theme === 'default' ? 'rgb(255, 255, 255)'
                      : theme === 'ben10' ? 'rgb(178, 224, 91)'
                      : theme === 'tinkerbell' ? 'rgb(0, 0, 30)'
                      : theme === 'cricketverse' ? 'rgb(191, 219, 254)'
                      : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                      : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                      : theme === 'avengers' ? 'rgb(200, 138, 165)'
                      : theme === 'ponyville' ? 'rgb(255, 245, 251)'
                      : 'rgb(255, 255, 255)'
                  }}>
                    {theme === 'default'
                      ? "Let's focus on your educational goals!"
                      : theme === 'ben10'
                      ? "Let's make learning heroic with Ben 10's power!"
                      : theme === 'tinkerbell'
                      ? "Let's sprinkle some fairy magic into learning!"
                      : theme === 'cricketverse'
                      ? "Let's hit learning for six in the CricketVerse!"
                      : theme === 'cricketverse-australian'
                      ? "Let's smash learning boundaries, Aussie style!"
                      : theme === 'bounceworld'
                      ? "Let's bounce into exciting learning adventures!"
                      : theme === 'avengers'
                      ? "Let's assemble the greatest learning team!"
                      : theme === 'ponyville'
                      ? "Let's gallop into magical learning adventures!"
                      : "Let's focus on your educational goals!"}
                  </p>
                </div>
              </div>
              <p className="mb-4 text-base" style={{
                color: theme === 'default' ? 'rgb(255, 255, 255)'
                  : theme === 'ben10' ? 'rgb(178, 224, 91)'
                  : theme === 'tinkerbell' ? 'rgb(0, 100, 8)'
                  : theme === 'cricketverse' ? 'rgb(191, 219, 254)'
                  : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                  : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                  : theme === 'avengers' ? 'rgb(200, 138, 165)'
                  : theme === 'ponyville' ? 'rgb(255, 245, 251)'
                  : 'rgb(255, 255, 255)'
              }}>
                {theme === 'default'
                  ? 'Welcome to your learning dashboard!'
                  : theme === 'ben10'
                  ? 'Welcome to your alien learning headquarters!'
                  : theme === 'tinkerbell'
                  ? 'Welcome to your enchanted learning sanctuary!'
                  : theme === 'cricketverse'
                  ? 'Welcome to your CricketVerse learning ground!'
                  : theme === 'cricketverse-australian'
                  ? 'Welcome to your Australian CricketVerse learning pitch!'
                  : theme === 'bounceworld'
                  ? 'Welcome to your BounceWorld learning arena!'
                  : theme === 'avengers'
                  ? 'Welcome to your Avengers learning headquarters!'
                  : theme === 'ponyville'
                  ? 'Welcome to your Ponyville Funland learning paradise!'
                  : 'Welcome to your learning dashboard!'}
              </p>
              <div className="flex items-center space-x-2" style={{
                color: theme === 'default' ? 'rgb(255, 255, 255)'
                  : theme === 'ben10' ? 'rgb(0,0,0)'
                  : theme === 'tinkerbell' ? 'rgb(0, 0, 8)'
                  : theme === 'cricketverse' ? 'rgb(226, 232, 240)'
                  : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                  : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                  : theme === 'avengers' ? 'rgb(226, 232, 240)'
                  : theme === 'ponyville' ? 'rgb(255, 245, 251)'
                  : 'rgb(255, 255, 255)'
              }}>
                <span className="text-sm font-medium">{getMelbourneDateTime()}</span>
              </div>
            </div>
          
          </div>
        </div>

        {/* Motivational Message - Dynamic Theme */}
        {!loading && dashboardStats.currentGrade > 0 && (
        <div className={`border-4 ${theme === 'default' ? 'border-black' : theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-xl p-6 animate-fade-in relative overflow-hidden ${
          theme === 'default'
            ? 'bg-white'
            : theme === 'ben10'
            ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-green-300 via-yellow-500 to-green-300'
            : theme === 'cricketverse'
            ? 'bg-gradient-to-r from-blue-400 to-indigo-500'
            : theme === 'cricketverse-australian'
            ? 'bg-gradient-to-br from-white via-[#f6f672] to-[#ffff2a]'
            : theme === 'bounceworld'
            ? 'bg-gradient-to-r from-white via-[#1D428A]/20 to-white border-[#1D428A]'
            : theme === 'avengers'
            ? 'bg-gradient-to-r from-[#2C1267]/50 to-[#4F2C8D]/50'
            : theme === 'ponyville'
            ? 'bg-gradient-to-r from-[#f1aed5] via-[#ec79b6] to-[#fe9fd2]'
            : 'bg-white'
        }`}>
            <div className="flex items-start space-x-4 relative z-10">
              <div className="relative">
              </div>
              <div className="flex-1">
                <h3 className={`text-2xl font-bold mb-2 flex items-center ${theme === 'default' || theme === 'ponyville' || theme === 'bounceworld' || theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                  {getMotivationalMessage().message}

                </h3>
                <p className={`text-base leading-relaxed font-medium text-black`}>
                  {theme === 'default'
                    ? "Stay focused and consistent. Success comes from small steps taken every day!"
                    : theme === 'ben10'
                    ? "Remember, just like Ben 10's transformations, every great achievement starts with a single power-up!"
                    : theme === 'tinkerbell'
                    ? "Remember, like Tinkerbell's magic, every learning moment sparkles with possibility!"
                    : theme === 'cricketverse'
                    ? "Remember, like a perfect cricket match, every learning session is a chance to score big!"
                    : theme === 'cricketverse-australian'
                    ? "Remember, like the Australian cricket legends, every learning session is your chance to dominate!"
                    : theme === 'bounceworld'
                    ? "Remember, every bounce back from a challenge makes you stronger and higher!"
                    : theme === 'avengers'
                    ? "Remember, like the Avengers, your learning powers grow stronger when you practice together!"
                    : theme === 'ponyville'
                    ? "Remember, like Ponyville's magic, every learning adventure brings joy and discovery!"
                    : "Stay focused and consistent. Success comes from small steps taken every day!"}
                </p>
                <div className={`mt-4 flex items-center space-x-4 text-sm text-black`}>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">{theme === 'default' ? '📊' : theme === 'ben10' ? '📊' : theme === 'tinkerbell' ? '📈' : theme === 'cricketverse' ? '🏏' : theme === 'cricketverse-australian' ? '📈' : theme === 'bounceworld' ? '⚽' : theme === 'avengers' ? '' : '📈'}</span>
                    <span>Grade: <strong style={{
                      color: theme === 'default' ? 'rgb(37, 99, 235)'
                        : theme === 'ben10' ? 'rgb(100, 204, 79)'
                        : theme === 'tinkerbell' ? 'rgb(0, 138, 4)'
                        : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                        : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                        : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(37, 99, 235)'
                    }}>{dashboardStats.currentGrade}%</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">📝</span>
                    <span>Tests: <strong style={{
                      color: theme === 'default' ? 'rgb(37, 99, 235)'
                        : theme === 'ben10' ? 'rgb(100, 204, 79)'
                        : theme === 'tinkerbell' ? 'rgb(0, 138, 4)'
                        : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                        : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                        : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(37, 99, 235)'
                    }}>{dashboardStats.completedTests}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1">

                    <span>Classes: <strong style={{
                      color: theme === 'default' ? 'rgb(37, 99, 235)'
                        : theme === 'ben10' ? 'rgb(100, 204, 79)'
                        : theme === 'tinkerbell' ? 'rgb(0, 138, 4)'
                        : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                        : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                        : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(37, 99, 235)'
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
            theme === 'default'
              ? 'bg-white'
              : theme === 'ben10'
              ? 'bg-gradient-to-br from-[#64cc4f] to-[#b2e05b]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-500'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-br from-blue-400 to-blue-600'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-white to-[#ffff2a]'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white to-[#1D428A]/20 border-[#1D428A]'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#604AC7]/30 to-[#C88DA5]/30'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#f1aed5] to-[#ff2e9f]'
              : 'bg-white'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-black text-sm font-bold mb-2">My Classes</p>
                <p className={`text-4xl font-black mt-2 ${theme === 'default' ? 'text-blue-600' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                  {dashboardStats.totalClasses}
                </p>
                <p className="text-black mt-1 font-semibold">Active courses</p>
                <div className="mt-3 bg-black/30 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ease-out shadow-lg ${theme === 'default' ? 'bg-blue-600' : theme === 'cricketverse-australian' ? 'bg-black' : 'bg-white'}`}
                    style={{ width: `${getProgressPercentage(dashboardStats.totalClasses, 10)}%` }}
                  ></div>
                </div>
                <p className="text-black text-xs mt-1 font-bold">
                  {dashboardStats.totalClasses}/10 goal {theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : ''}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 transform hover:rotate-12 transition-transform ${theme === 'default' ? 'bg-blue-600 border-blue-800' : 'bg-black border-white'}`}>
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'default'
              ? 'bg-white'
              : theme === 'ben10'
              ? 'bg-gradient-to-br from-[#64cc4f] to-[#b2e05b]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-600'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-br from-blue-400 to-blue-600'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-white to-[#ffff2a]'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white to-[#1D428A]/20 border-l-8 border-l-[#C8102E] border-r-8 border-r-[#1D428A]'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#604AC7]/30 to-[#C88DA5]/30'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#f1aed5] to-[#ff2e9f]'
              : 'bg-white'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-bold mb-2 text-black">Tests Completed</p>
                <p className="text-4xl font-black mt-2" style={{
                  color: theme === 'default' ? 'rgb(37, 99, 235)'
                    : theme === 'ben10' ? 'rgb(255,255,255)'
                    : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                    : theme === 'cricketverse' ? 'rgb(255, 255, 255)'
                    : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                    : theme === 'avengers' ? 'rgb(255, 255, 255)'
                    : 'rgb(37, 99, 235)'
                }}>
                  {dashboardStats.completedTests}
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' 
                    : theme === 'tinkerbell' ? 'rgb(0, 0, 4)'
                    : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                    : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                    : theme === 'avengers' ? 'rgb(0, 0, 0)'
                    : 'rgb(0, 0, 4)'
                }}>This semester</p>
                <div className="mt-3 rounded-full h-3" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(0,0,0, 0.3)' 
                    : theme === 'tinkerbell' ? 'rgba(0, 0, 0, 0.3)'
                    : theme === 'cricketverse' ? 'rgba(0, 0, 0, 0.3)'
                    : theme === 'cricketverse-australian' ? 'rgba(0,0,0, 0.3) '
                    : theme === 'bounceworld' ? 'rgba(29, 66, 138, 0.3)'
                    : theme === 'avengers' ? 'rgba(44, 18, 103, 0.3)'
                    : 'rgba(0, 0, 0, 0.3)'
                }}>
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(255,255,255)' 
                        : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                        : theme === 'cricketverse' ? 'rgb(255, 255, 255)'
                        : theme === 'cricketverse-australian' ? 'rgba(0,0,0) '
                        : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(37, 99, 235)',
                      width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' 
                    : theme === 'tinkerbell' ? 'rgb(0, 0, 8)'
                    : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                    : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                    : theme === 'avengers' ? 'rgb(0, 0, 0)'
                    : 'rgb(0, 0, 8)'
                }}>
                  {dashboardStats.completedTests}/20 goal {theme === 'ben10' ? '🎯' : theme === 'tinkerbell' ? '🎯' : theme === 'cricketverse' ? '🏏' : theme === 'cricketverse-australian' ? '🎯' : theme === 'bounceworld' ? '⚽' : theme === 'avengers' ? '🛡️' : '🎯'}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 transform hover:rotate-12 transition-transform ${theme === 'default' ? 'bg-blue-600 border-blue-800' : 'border-white'}`} style={{
                backgroundColor: theme === 'default' ? 'rgb(37, 99, 235)'
                  : theme === 'ben10' ? 'rgb(0,0,0)'
                  : theme === 'tinkerbell' ? 'rgb(0, 0, 5)'
                  : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                  : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                  : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                  : theme === 'avengers' ? 'rgb(44, 18, 103)'
                  : 'rgb(37, 99, 235)'
              }}>
                <FileText className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'default'
              ? 'bg-white'
              : theme === 'ben10'
              ? 'bg-gradient-to-br from-[#64cc4f] to-[#b2e05b]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-600'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-br from-blue-400 to-blue-600'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-white to-[#ffff2a]'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white to-[#1D428A]/20'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#604AC7]/30 to-[#C88DA5]/30'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#f1aed5] to-[#ff2e9f]'
              : 'bg-white'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-black text-sm font-bold mb-2">Study Materials</p>
                <p className="text-4xl font-black mt-2 " style={{
                  color: theme === 'default' ? 'rgb(37, 99, 235)'
                    : theme === 'ben10' ? 'rgb(255,255,255)'
                    : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                    : theme === 'cricketverse' ? 'rgb(255, 255, 255)'
                    : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                    : theme === 'avengers' ? 'rgb(255, 255, 255)'
                    : 'rgb(37, 99, 235)'
                }}>
                  {dashboardStats.studyMaterials}
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' 
                    : theme === 'tinkerbell' ? 'rgb(0, 0, 4)'
                    : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                    : theme === 'avengers' ? 'rgb(0, 0, 0)'
                    : 'rgb(0, 0, 4)'
                }}>Resources</p>
                <div className="mt-3 rounded-full h-3" style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(0,0,0, 0.3)' 
                    : theme === 'tinkerbell' ? 'rgba(0, 0, 4, 0.3)'
                    : theme === 'cricketverse' ? 'rgba(0, 0, 0, 0.3)'
                    : theme === 'cricketverse-australian' ? 'rgba(0, 0, 0, 0.3)'
                    : theme === 'bounceworld' ? 'rgba(29, 66, 138, 0.3)'
                    : theme === 'avengers' ? 'rgba(44, 18, 103, 0.3)'
                    : 'rgba(0, 0, 4, 0.3)'
                }}>
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(255,255,255)' 
                        : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                        : theme === 'cricketverse' ? 'rgb(255, 255, 255)'
                        : theme === 'cricketverse-australian' ? 'rgba(0, 0, 0)'
                        : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(37, 99, 235)',
                      width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,4)' 
                    : theme === 'tinkerbell' ? 'rgb(0, 0, 4)'
                    : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                    : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                    : theme === 'avengers' ? 'rgb(0, 0, 0)'
                    : 'rgb(0, 0, 4)'
                }}>
                  {dashboardStats.studyMaterials}/50 goal {theme === 'ben10' ? '📚' : theme === 'tinkerbell' ? '📚' : theme === 'cricketverse' ? '📖' : theme === 'cricketverse-australian' ? '📖' : theme === 'bounceworld' ? '📖' : theme === 'avengers' ? '📖' : '📚'}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 transform hover:rotate-12 transition-transform ${theme === 'default' ? 'bg-blue-600 border-blue-800' : 'border-white'}`} style={{
                backgroundColor: theme === 'default' ? 'rgb(37, 99, 235)'
                  : theme === 'ben10' ? 'rgb(0,0,5)'
                  : theme === 'tinkerbell' ? 'rgb(0, 0, 5)'
                  : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                  : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                  : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                  : theme === 'avengers' ? 'rgb(44, 18, 103)'
                  : 'rgb(37, 99, 235)'
              }}>
                <BookOpenCheck className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl shadow-lg border-4 border-black p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 ${
            theme === 'default'
              ? 'bg-white'
              : theme === 'ben10'
              ? 'bg-gradient-to-br from-[#64cc4f] to-[#b2e05b]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-600'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-br from-blue-400 to-blue-600'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-white to-[#ffff2a]'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white to-[#1D428A]/20'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#604AC7]/30 to-[#C88DA5]/30'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#f1aed5] to-[#ff2e9f]'
              : 'bg-white'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-black text-sm font-bold mb-2">Current Grade</p>
                <p className="text-4xl font-black mt-2 " style={{
                  color: theme === 'default' ? 'rgb(37, 99, 235)'
                    : theme === 'ben10' ? 'rgb(255,255,255)'
                    : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                    : theme === 'cricketverse' ? 'rgb(255, 255, 255)'
                    : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                    : theme === 'avengers' ? 'rgb(255, 255, 255)'
                    : 'rgb(37, 99, 235)'
                }}>
                  {dashboardStats.currentGrade}%
                </p>
                <p className="mt-1 font-semibold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' 
                    : theme === 'tinkerbell' ? 'rgb(0, 0, 4)'
                    : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                    : theme === 'avengers' ? 'rgb(0, 0, 0)'
                    : 'rgb(0, 0, 4)'
                }}>Average</p>
                <div className="mt-3 rounded-full h-3" style={{
                  backgroundColor: theme === 'bounceworld' ? 'rgba(29, 66, 138, 0.3)' 
                    : theme === 'avengers' ? 'rgba(44, 18, 103, 0.3)'
                    : 'rgba(0, 0, 0, 0.3)'
                }}>
                  <div
                    className="h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{
                      backgroundColor: 
                        dashboardStats.currentGrade >= 90 ? (
                          theme === 'ben10' ? 'rgb(100, 204, 79)' 
                          : theme === 'tinkerbell' ? 'rgb(202, 138, 4)' 
                          : theme === 'cricketverse' ? 'rgb(34, 197, 94)'
                          : theme === 'cricketverse-australian' ? 'rgb(255, 248, 0)'
                          : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                          : theme === 'avengers' ? 'rgb(96, 74, 199)'
                          : 'rgb(34, 197, 94)'
                        ) :
                        dashboardStats.currentGrade >= 80 ? (
                          theme === 'ben10' ? 'rgb(178, 224, 91)' 
                          : theme === 'tinkerbell' ? 'rgb(202, 138, 4)' 
                          : theme === 'cricketverse' ? 'rgb(34, 197, 94)'
                          : theme === 'cricketverse-australian' ? 'rgb(255, 248, 0)'
                          : theme === 'bounceworld' ? 'rgb(200, 16, 46)'
                          : theme === 'avengers' ? 'rgb(200, 138, 165)'
                          : 'rgb(34, 197, 94)'
                        ) :
                        dashboardStats.currentGrade >= 70 ? (
                          theme === 'ben10' ? 'rgb(100, 204, 79)' 
                          : theme === 'tinkerbell' ? 'rgb(202, 138, 4)' 
                          : theme === 'cricketverse' ? 'rgb(96, 165, 250)'
                          : theme === 'cricketverse-australian' ? 'rgb(255, 248, 0)'
                          : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                          : theme === 'avengers' ? 'rgb(96, 74, 199)'
                          : 'rgb(96, 165, 250)'
                        ) :
                        dashboardStats.currentGrade >= 60 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)',
                      width: `${dashboardStats.currentGrade}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 font-bold" style={{
                  color: theme === 'ben10' ? 'rgb(0,0,0)' 
                    : theme === 'tinkerbell' ? 'rgb(0, 0, 4)'
                    : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                    : theme === 'bounceworld' ? 'rgb(0, 0, 0)'
                    : theme === 'avengers' ? 'rgb(0, 0, 0)'
                    : 'rgb(0, 0, 4)'
                }}>
                  Target: 85% {theme === 'ben10' ? '🎓' : theme === 'tinkerbell' ? '🎓' : theme === 'cricketverse' ? '🏆' : theme === 'cricketverse-australian' ? '🎓' : theme === 'bounceworld' ? '🎯' : theme === 'avengers' ? '🛡️' : '🎓'}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 transform hover:rotate-12 transition-transform ${theme === 'default' ? 'bg-blue-600 border-blue-800' : 'border-white'}`} style={{
                backgroundColor: theme === 'default' ? 'rgb(37, 99, 235)'
                  : theme === 'ben10' ? 'rgb(0,0,0)'
                  : theme === 'tinkerbell' ? 'rgb(0, 0, 4)'
                  : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                  : theme === 'cricketverse-australian' ? 'rgb(0, 0, 0)'
                  : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                  : theme === 'avengers' ? 'rgb(44, 18, 103)'
                  : 'rgb(37, 99, 235)'
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
            theme === 'default'
              ? 'bg-white'
              : theme === 'ben10'
              ? 'bg-gradient-to-br from-[#b2e05b] via-[#222222] to-[#64cc4f]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-yellow-300 via-green-500 to-yellow-400'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-br from-blue-300 via-indigo-500 to-blue-400'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-white via-[#f6f672] to-[#ffff2a]'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-white'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#2C1267]/20 via-[#604AC7]/30 to-[#C88DA5]/20'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]'
              : 'bg-white'
          }`}>
            <h3 className="text-xl font-black text-black mb-6 flex items-center">
       
              {theme === 'ben10' ? "Class Activity" : "Class Activity"}
            </h3>
            <div className="space-y-4">
              {dashboardStats.completedTests > 0 && (
                <div className={`flex items-start space-x-3 p-4 ${theme === 'bounceworld' ? 'bg-white' : 'bg-white'} border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-lg animate-fade-in shadow-lg`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`} style={{
                    backgroundColor: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                      : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                      : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                      : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                      : theme === 'avengers' ? 'rgb(96, 74, 199)'
                      : 'rgb(255, 255, 255)'
                  }}>
                    <FileText className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '🦸‍♂️ Test Hero' : theme === 'tinkerbell' ? '🧚‍♀️ Quiz Enchanter' : 'Quiz Champion'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You completed {dashboardStats.completedTests} test{dashboardStats.completedTests !== 1 ? 's' : ''} this semester - {theme === 'ben10' ? "Ben 10 is proud! 🏆" : theme === 'tinkerbell' ? "Tinkerbell sprinkles magic! ✨" : "Great progress!"}
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.totalClasses > 0 && (
                <div className={`flex items-start space-x-3 p-4 ${theme === 'bounceworld' ? 'bg-white' : 'bg-white'} border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-lg animate-fade-in shadow-lg`} style={{ animationDelay: '0.2s' }}>
                  <div className="w-10 h-10  rounded-full flex items-center justify-center border-2" style={{
                    borderColor: theme === 'ben10' ? 'rgb(0,0,0)' 
                      : theme === 'tinkerbell' ? 'rgb(0, 0, 0)'
                      : theme === 'cricketverse' ? 'rgb(0, 0, 0)'
                      : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                      : theme === 'avengers' ? 'rgb(44, 18, 103)'
                      : 'rgb(0, 0, 0)', 
                    backgroundColor: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                      : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                      : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                      : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                      : theme === 'avengers' ? 'rgb(96, 74, 199)'
                      : 'rgb(255, 255, 255)'
                  }}>
                    <Users className="w-5 h-5" style={{
                      color: theme === 'ben10' ? 'rgb(0,0,0)' 
                        : theme === 'tinkerbell' ? 'rgb(0,0,0)'
                        : theme === 'cricketverse' ? 'rgb(255,255,255)'
                        : theme === 'cricketverse-australian' ? 'rgb(0,0,0)'
                        : theme === 'bounceworld' ? 'rgb(255,255,255)'
                        : theme === 'avengers' ? 'rgb(255,255,255)'
                        : 'rgb(0,0,0)'
                    }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '🔄 Class Transformer' 
                        : theme === 'tinkerbell' ? '🌙 Learning Dreamer' 
                        : theme === 'cricketverse' ? '🏏 Cricket Scholar'
                        : theme === 'cricketverse-australian' ? ' Academic Achiever'
                        : theme === 'bounceworld' ? '⚽ Learning Striker'
                        : theme === 'avengers' ? '🛡️ Knowledge Guardian'
                        : 'Academic Achiever'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      You're enrolled in {dashboardStats.totalClasses} class{dashboardStats.totalClasses !== 1 ? 'es' : ''} - {theme === 'ben10' ? "What an alien adventure! 👽" 
                        : theme === 'tinkerbell' ? "Welcome to the enchanted realm! 🏰" 
                        : theme === 'cricketverse' ? "Ready for the learning pitch! 🏏"
                        : theme === 'cricketverse-australian' ? "Time to dominate the learning field, Aussie style!"
                        : theme === 'bounceworld' ? "Time to bounce higher in learning! ⚽"
                        : theme === 'avengers' ? "Assemble your knowledge team! 🦸‍♂️"
                        : "Your learning community!"}
                    </p>
                  </div>
                </div>
              )}

              {dashboardStats.studyMaterials > 0 && (
                <div className={`flex items-start space-x-3 p-4 ${theme === 'bounceworld' ? 'bg-white' : 'bg-white'} border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-lg animate-fade-in shadow-lg`} style={{ animationDelay: '0.4s' }}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`} style={{
                    backgroundColor: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                      : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                      : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                      : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                      : theme === 'avengers' ? 'rgb(96, 74, 199)'
                      : 'rgb(255, 255, 255)'
                  }}>
                    <BookOpenCheck className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">
                      {theme === 'ben10' ? '⚡ Study Champion' 
                        : theme === 'tinkerbell' ? '💫 Knowledge Seeker' 
                        : theme === 'cricketverse' ? '🏏 Study Batsman'
                        : theme === 'bounceworld' ? '⚽ Learning Scorer'
                        : theme === 'avengers' ? '📖 Knowledge Collector'
                        : 'Learning Guide'}!
                    </p>
                    <p className="text-xs text-gray-700 font-medium">
                      {dashboardStats.studyMaterials} resource{dashboardStats.studyMaterials !== 1 ? 's' : ''} ready for your {theme === 'ben10' ? 'heroic learning journey! 🚀' 
                        : theme === 'tinkerbell' ? 'magical adventure! 🌟' 
                        : theme === 'cricketverse' ? 'learning innings! 🏏'
                        : theme === 'bounceworld' ? 'learning match! ⚽'
                        : theme === 'avengers' ? 'heroic mission! 🛡️'
                        : 'educational journey!'}
                    </p>
                  </div>
                </div>
              )}

              {(!dashboardStats.completedTests && !dashboardStats.totalClasses && !dashboardStats.studyMaterials) && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-black mx-auto mb-4" style={{
                    borderColor: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                      : theme === 'tinkerbell' ? 'rgb(244, 114, 182)'
                      : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                      : theme === 'cricketverse-australian' ? 'rgb(255, 248, 0)'
                      : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                      : theme === 'avengers' ? 'rgb(96, 74, 199)'
                      : 'rgb(244, 114, 182)',
                    borderTopColor: theme === 'bounceworld' ? 'rgb(200, 16, 46)' : 'black'
                  }}></div>
                  <p className="text-black font-bold text-sm">
                    Loading {theme === 'ben10' ? "Ben 10's power... ⚡" 
                      : theme === 'tinkerbell' ? "Tinkerbell's magic... ✨" 
                      : theme === 'cricketverse' ? "CricketVerse data... 🏏"
                      : theme === 'cricketverse-australian' ? "Australian CricketVerse data... 🇦🇺"
                      : theme === 'bounceworld' ? "BounceWorld stats... ⚽"
                      : theme === 'avengers' ? "Avengers intel... 🛡️"
                      : "your data..."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Goals - Dynamic Theme */}
          <div className={`rounded-xl shadow-lg border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-6 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-[#b2e05b] via-[#222222] to-[#64cc4f]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400 to-yellow-600'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-br from-indigo-400 to-blue-600'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-white via-[#f6f672] to-[#ffff2a]'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-white'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#2C1267]/20 via-[#604AC7]/30 to-[#C88DA5]/20'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]'
              : 'bg-white'
          }`}>
            <h3 className="mb-6 flex items-center text-xl font-black" style={{
              color: theme === 'ben10' ? 'rgb(0,0,0)' 
                : theme === 'tinkerbell' ? 'rgb(0,0,0)'
                : theme === 'cricketverse' ? 'rgb(0,0,0)'
                : theme === 'cricketverse-australian' ? 'rgb(0,0,0)'
                : theme === 'bounceworld' ? 'rgb(0,0,0)'
                : theme === 'avengers' ? 'rgb(0,0,0)'
                : 'rgb(0,0,0)'
            }}>
              
              {theme === 'ben10' ? "Your Goals" 
                : theme === 'tinkerbell' ? "Your Goals"
                : theme === 'cricketverse' ? "Your Goals"
                : theme === 'bounceworld' ? "Your Goals"
                : theme === 'avengers' ? "Your Goals"
                : "Your Goals"}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' 
                      : theme === 'tinkerbell' ? 'rgb(255,255,255)'
                      : theme === 'cricketverse' ? 'rgb(255,255,255)'
                      : theme === 'cricketverse-australian' ? 'rgb(0,0,0)'
                      : theme === 'bounceworld' ? 'rgb(0,0,0)'
                      : theme === 'avengers' ? 'rgb(255,255,255)'
                      : theme === 'ponyville' ? 'rgb(0,0,0)'
                      : 'rgb(0,0,0)'
                  }}> {theme === 'ben10' ? 'Complete 20 Tests' 
                    : theme === 'tinkerbell' ? 'Complete 20 Quizzes' 
                    : theme === 'cricketverse' ? 'Complete 20 Matches'
                    : theme === 'cricketverse-australian' ? 'Complete 20 Aussie Battles'
                    : theme === 'bounceworld' ? 'Complete 20 Challenges'
                    : theme === 'avengers' ? 'Complete 20 Missions'
                    : 'Complete 20 Assessments'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' 
                      : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                      : theme === 'cricketverse' ? 'rgb(255,255,255)'
                      : theme === 'bounceworld' ? 'rgb(0,0,0)'
                      : theme === 'avengers' ? 'rgb(255,255,255)'
                      : theme === 'ponyville' ? 'rgb(0,0,0)'
                      : 'rgb(0,0,0)'
                  }}>
                    {dashboardStats.completedTests}/20
                  </span>
                </div>
                <div className={`rounded-full h-4 border-2 ${theme === 'bounceworld' ? 'border-[#C8102E]' : 'border-black'}`} style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(100, 204, 79, 0.2)' 
                    : theme === 'tinkerbell' ? 'rgba(202, 138, 4, 0.2)'
                    : theme === 'cricketverse' ? 'rgba(59, 130, 246, 0.2)'
                    : theme === 'bounceworld' ? 'rgba(200, 16, 46, 0.2)'
                    : theme === 'avengers' ? 'rgba(96, 74, 199, 0.2)'
                    : 'rgba(202, 138, 4, 0.2)'
                }}>
                  <div
                    className={`h-4 rounded-full transition-all duration-1000 ease-out border ${theme === 'bounceworld' ? 'border-[#C8102E]' : 'border-black'}`}
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                        : theme === 'tinkerbell' ? 'rgb(202, 138, 4)'
                        : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                        : theme === 'bounceworld' ? 'rgb(200, 16, 46)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(202, 138, 4)',
                      width: `${getProgressPercentage(dashboardStats.completedTests, 20)}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' 
                      : theme === 'tinkerbell' ? 'rgb(255,255,255)'
                      : theme === 'cricketverse' ? 'rgb(255,255,255)'
                      : theme === 'bounceworld' ? 'rgb(0,0,0)'
                      : theme === 'avengers' ? 'rgb(255,255,255)'
                      : theme === 'ponyville' ? 'rgb(0,0,0)'
                      : 'rgb(0,0,0)'
                  }}>
                    {theme === 'ben10' ? 'Reach 85% Average' 
                    : theme === 'tinkerbell' ? 'Reach 85% Average'
                    : theme === 'cricketverse' ? 'Score 85% Average'
                    : theme === 'bounceworld' ? 'Achieve 85% Score'
                    : theme === 'avengers' ? 'Maintain 85% Power'
                    : 'Reach 85% Average'}
                  </span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' 
                      : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                      : theme === 'cricketverse' ? 'rgb(255,255,255)'
                      : theme === 'bounceworld' ? 'rgb(0,0,0)'
                      : theme === 'avengers' ? 'rgb(255,255,255)'
                      : theme === 'ponyville' ? 'rgb(0,0,0)'
                      
                      : 'rgb(0,0,0)'
                  }}>
                    {dashboardStats.currentGrade}%
                  </span>
                </div>
                <div className={`rounded-full h-4 border-2`} style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(100, 204, 79, 0.2)' 
                    : theme === 'tinkerbell' ? 'rgba(202, 138, 4, 0.2)'
                    : theme === 'cricketverse' ? 'rgba(59, 130, 246, 0.2)'
                    : theme === 'bounceworld' ? 'rgba(29, 66, 138, 0.2)'
                    : theme === 'avengers' ? 'rgba(96, 74, 199, 0.2)'
                    : 'rgba(202, 138, 4, 0.2)',
                  borderColor: theme === 'ben10' ? 'rgb(0,0,0)' 
                    : theme === 'tinkerbell' ? 'rgb(0,0,0)'
                    : theme === 'cricketverse' ? 'rgb(0,0,0)'
                    : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                    : theme === 'avengers' ? 'rgb(44, 18, 103)'
                    : 'rgb(0,0,0)'
                }}>
                  <div
                    className={`h-4 rounded-full transition-all duration-1000 ease-out border ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`}
                    style={{
                      backgroundColor: dashboardStats.currentGrade >= 85 
                        ? (theme === 'ben10' ? 'rgb(100, 204, 79)' 
                          : theme === 'tinkerbell' ? 'rgb(202, 138, 4)'
                          : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                          : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                          : theme === 'avengers' ? 'rgb(96, 74, 199)'
                          : 'rgb(202, 138, 4)')
                        : (theme === 'ben10' ? 'rgb(178, 224, 91)' 
                          : theme === 'tinkerbell' ? 'rgb(202, 138, 4)'
                          : theme === 'cricketverse' ? 'rgb(96, 165, 250)'
                          : theme === 'bounceworld' ? 'rgb(200, 16, 46)'
                          : theme === 'avengers' ? 'rgb(200, 138, 165)'
                          : 'rgb(202, 138, 4)'),
                      width: `${dashboardStats.currentGrade}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' 
                      : theme === 'tinkerbell' ? 'rgb(255,255,255)'
                      : theme === 'cricketverse' ? 'rgb(255,255,255)'
                      : theme === 'bounceworld' ? 'rgb(0,0,0)'
                      : theme === 'avengers' ? 'rgb(255,255,255)'
                      : theme === 'ponyville' ? 'rgb(0,0,0)'
                      : 'rgb(0,0,0)'
                  }}>{theme === 'ben10' ? 'Study 50 Materials' 
                    : theme === 'tinkerbell' ? 'Explore 50 Resources'
                    : theme === 'cricketverse' ? 'Master 50 Strategies'
                    : theme === 'bounceworld' ? 'Practice 50 Techniques'
                    : theme === 'avengers' ? 'Collect 50 Insights'
                    : 'Explore 50 Resources'}</span>
                  <span className="font-black" style={{
                    color: theme === 'ben10' ? 'rgb(255,255,255)' 
                      : theme === 'tinkerbell' ? 'rgb(255, 255, 255)'
                      : theme === 'cricketverse' ? 'rgb(255,255,255)'
                      : theme === 'bounceworld' ? 'rgb(0,0,0)'
                      : theme === 'avengers' ? 'rgb(255,255,255)'
                      : theme === 'ponyville' ? 'rgb(0,0,0)'
                      : 'rgb(0,0,0)'
                  }}>
                    {dashboardStats.studyMaterials}/50
                  </span>
                </div>
                <div className={`rounded-full h-4 border-2 ${theme === 'bounceworld' ? 'border-[#C8102E]' : 'border-black'}`} style={{
                  backgroundColor: theme === 'ben10' ? 'rgba(100, 204, 79, 0.2)' 
                    : theme === 'tinkerbell' ? 'rgba(202, 138, 4, 0.2)'
                    : theme === 'cricketverse' ? 'rgba(59, 130, 246, 0.2)'
                    : theme === 'bounceworld' ? 'rgba(200, 16, 46, 0.2)'
                    : theme === 'avengers' ? 'rgba(96, 74, 199, 0.2)'
                    : 'rgba(202, 138, 4, 0.2)'
                }}>
                  <div
                    className={`h-4 rounded-full transition-all duration-1000 ease-out border`}
                    style={{
                      backgroundColor: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                        : theme === 'tinkerbell' ? 'rgb(202, 138, 4)'
                        : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                        : theme === 'bounceworld' ? 'rgb(200, 16, 46)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(202, 138, 4)',
                      borderColor: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                        : theme === 'tinkerbell' ? 'rgb(202, 138, 4)'
                        : theme === 'cricketverse' ? 'rgb(59, 130, 246)'
                        : theme === 'bounceworld' ? 'rgb(200, 16, 46)'
                        : theme === 'avengers' ? 'rgb(96, 74, 199)'
                        : 'rgb(202, 138, 4)',
                      width: `${getProgressPercentage(dashboardStats.studyMaterials, 50)}%`
                    }}
                  ></div>
                </div>
              </div>

              {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'cricketverse' || theme === 'bounceworld' || theme === 'avengers') && (
                <div className={`mt-6 p-4 rounded-lg shadow-lg border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`} style={{
                  background: theme === 'ben10'
                    ? 'linear-gradient(to bottom right, rgb(178, 224, 91), rgb(34, 34, 34), rgb(100, 204, 79))'
                    : theme === 'tinkerbell'
                    ? 'linear-gradient(to bottom right, rgb(34, 197, 94), rgb(0, 0, 0), rgb(34, 197, 94))'
                    : theme === 'cricketverse'
                    ? 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(55, 65, 81), rgb(59, 130, 246))'
                    : theme === 'bounceworld'
                    ? 'linear-gradient(to bottom right, rgb(255, 255, 255), rgba(29, 66, 138, 0.3), rgb(255, 255, 255))'
                    : theme === 'avengers'
                    ? 'linear-gradient(to bottom right, rgba(96, 74, 199, 0.8), rgba(44, 18, 103, 0.8), rgba(200, 138, 165, 0.8))'
                    : 'linear-gradient(to bottom right, rgb(34, 197, 94), rgb(0, 0, 0), rgb(34, 197, 94))'
                }}>
                  <div className="flex items-center space-x-2">
                    
                    <span style={{
                      color: theme === 'ben10' ? 'rgb(100, 204, 79)' 
                        : theme === 'tinkerbell' ? 'rgb(0, 138, 4)'
                        : theme === 'cricketverse' ? 'rgb(255, 255, 255)'
                        : theme === 'bounceworld' ? 'rgb(29, 66, 138)'
                        : theme === 'avengers' ? 'rgb(255, 255, 255)'
                        : 'rgb(0, 138, 4)'
                    }} className="font-black text-sm">
                      {theme === 'ben10' ? 'Next Transformation Unlocked Soon!' 
                        : theme === 'tinkerbell' ? 'Next Magic Spell Unlocked Soon!'
                        : theme === 'cricketverse' ? 'Next Achievement Badge Unlocked Soon!'
                        : theme === 'bounceworld' ? 'Next Level Boost Unlocked Soon!'
                        : theme === 'avengers' ? 'Next Super Power Unlocked Soon!'
                        : 'Next Magic Spell Unlocked Soon!'}
                    </span>
                  </div>
                  <p className={`font-bold text-xs mt-1 ${theme === 'bounceworld' ? 'text-black' : 'text-white'}`}>
                    {theme === 'ben10' 
                      ? "Keep up the heroic work to unlock Ben 10's powers! " 
                      : theme === 'tinkerbell'
                      ? "Keep up the magical work to unlock Tinkerbell's spells! "
                      : theme === 'cricketverse'
                      ? "Keep scoring runs to unlock your next cricket achievement! "
                      : theme === 'bounceworld'
                      ? "Keep bouncing higher to unlock your next level! "
                      : theme === 'avengers'
                      ? "Keep assembling knowledge to unlock your next superpower! "
                      : "Keep up the magical work to unlock Tinkerbell's spells! "}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Quick Actions - Dynamic Theme */}
          <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} rounded-xl shadow-lg border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-6 ${
            theme === 'ben10'
              ? 'from-[#64cc4f] via-[#222222] to-[#b2e05b]'
              : theme === 'tinkerbell'
              ? 'from-yellow-400 via-green-500 to-yellow-500'
              : theme === 'cricketverse'
              ? 'from-blue-400 via-indigo-500 to-blue-500'
              : theme === 'bounceworld'
              ? 'from-white via-[#1D428A]/20 to-white'
              : theme === 'avengers'
              ? 'from-[#2C1267]/30 via-[#604AC7]/20 to-[#C88DA5]/30'
              : theme === 'ponyville'
              ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
              : ''
          }`}>
            <h3 className={`text-2xl font-black mb-6 flex items-center ${theme === 'default' ? 'text-black' : theme === 'bounceworld' ? 'text-black' : 'text-black'}`}>
          
              {theme === 'ben10' ? "Quick Actions" 
                : theme === 'tinkerbell' ? "Quick Actions"
                : theme === 'cricketverse' ? "Quick Actions"
                : theme === 'bounceworld' ? "Quick Actions"
                : theme === 'avengers' ? "Quick Actions"
                : "Quick Actions"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className={`group ${theme === 'bounceworld' ? 'bg-white border-4 border-[#1D428A]' : 'bg-white border-4 border-black'} rounded-xl p-4 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 animate-fade-in`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} group-hover:scale-110 transition-all duration-300 group-hover:rotate-12`}>
                        <Icon className="w-6 h-6 text-white group-hover:animate-bounce" />
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-bold transition-colors duration-300 text-sm ${theme === 'default' ? 'text-gray-700' : 'text-black'} ${
                          theme === 'ben10' ? 'group-hover:text-[#64cc4f]'
                          : theme === 'tinkerbell' ? 'group-hover:text-green-600'
                          : theme === 'cricketverse' ? 'group-hover:text-blue-600'
                          : theme === 'bounceworld' ? 'group-hover:text-[#C8102E]'
                          : theme === 'avengers' ? 'group-hover:text-[#604AC7]'
                          : 'group-hover:text-[#64cc4f]'
                        }`}>
                          {action.title}
                        </h4>
                        <p className={`mt-1 text-xs font-medium ${theme === 'default' ? 'text-gray-700' : 'text-gray-700 dark:text-gray-300'}`}>
                          {action.description}
                        </p>
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className={`w-full rounded-full h-1 ${
                            theme === 'ben10' ? 'bg-[#64cc4f]/20'
                            : theme === 'tinkerbell' ? 'bg-green-600/20'
                            : theme === 'cricketverse' ? 'bg-blue-600/20'
                            : theme === 'bounceworld' ? 'bg-[#1D428A]/20'
                            : theme === 'avengers' ? 'bg-[#604AC7]/20'
                            : 'bg-[#64cc4f]/20'
                          }`}>
                            <div className={`h-1 rounded-full transition-all duration-500 w-0 group-hover:w-full ${
                              theme === 'ben10' ? 'bg-[#64cc4f]'
                              : theme === 'tinkerbell' ? 'bg-green-600'
                              : theme === 'cricketverse' ? 'bg-blue-600'
                              : theme === 'bounceworld' ? 'bg-[#C8102E]'
                              : theme === 'avengers' ? 'bg-[#604AC7]'
                              : 'bg-[#64cc4f]'
                            }`}></div>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-black group-hover:translate-x-1 transition-all duration-300 ${
                        theme === 'ben10' ? 'group-hover:text-[#64cc4f]'
                        : theme === 'tinkerbell' ? 'group-hover:text-green-600'
                        : theme === 'cricketverse' ? 'group-hover:text-blue-600'
                        : theme === 'bounceworld' ? 'group-hover:text-[#C8102E]'
                        : theme === 'avengers' ? 'group-hover:text-[#604AC7]'
                        : 'group-hover:text-[#64cc4f]'
                      }`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Account Information - Dynamic Theme */}
        {student && (
          <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} rounded-xl shadow-lg border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-6 ${
            theme === 'ben10'
              ? 'from-[#64cc4f] via-[#222222] to-[#b2e05b]'
              : theme === 'tinkerbell'
              ? 'from-yellow-400 via-green-500 to-yellow-500'
              : theme === 'cricketverse'
              ? 'from-blue-400 via-indigo-500 to-blue-500'
              : theme === 'bounceworld'
              ? 'from-white via-[#1D428A]/20 to-white'
              : theme === 'avengers'
              ? 'from-[#2C1267]/30 via-[#604AC7]/20 to-[#C88DA5]/30'
              : theme === 'ponyville'
              ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
              : ''
          }`}>
            <h3 className={`text-xl font-black mb-6 flex items-center ${theme === 'default' ? 'text-black' : theme === 'bounceworld' ? 'text-black' : 'text-black'}`}>
              {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'cricketverse' || theme === 'bounceworld' || theme === 'avengers' || theme === 'ponyville') && 
                <span className="text-6xl mr-2 ">
                  {theme === 'ben10' ? '🦸‍♂️' 
                    : theme === 'tinkerbell' ? '🧚‍♀️'
                    : theme === 'cricketverse' ? '🏏'
                    : theme === 'bounceworld' ? '⚽'
                    : theme === 'avengers' ? '🛡️'
                    : theme === 'ponyville' ? '🦄'
                    : '🦸‍♂️'}
                </span>}
              Student Profile
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white border-2 border-black rounded-lg">
                <span className="text-sm text-black font-bold">{theme === 'ben10' ? '🎫' : theme === 'tinkerbell' ? '🎫' : ''} Student ID:</span>
                <span className={`text-sm font-black text-black px-2 py-1 rounded border border-black ${
                  theme === 'ben10' ? 'bg-[#64cc4f]' :theme === 'cricketverse-australian' ? 'bg-yellow-400' : theme === 'tinkerbell' ? 'bg-yellow-400' : 'bg-[#3b82f6]'
                }`}>
                  {student.id || 'N/A'}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 bg-white border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-lg`}>
                <span className="text-sm text-black font-bold">{theme === 'ben10' ? '📅' 
                  : theme === 'tinkerbell' ? '📅'
                  : theme === 'cricketverse' ? '📅'
                  : theme === 'bounceworld' ? '📅'
                  : theme === 'avengers' ? '📅'
                  : '📅'} Enrollment Date:</span>
                <span className={`text-sm font-black px-2 py-1 rounded border ${
                  theme === 'ben10' ? 'text-[#64cc4f] bg-black border-[#64cc4f]' 
                  : theme === 'tinkerbell' ? 'text-yellow-400 bg-black border-yellow-400' 
                  : theme === 'cricketverse' ? 'text-blue-400 bg-black border-blue-400'
                  :theme === 'cricketverse-australian' ? 'text-black bg-yellow-400 border-yellow-400'
                  : theme === 'bounceworld' ? 'text-[#1D428A] bg-white border-[#1D428A]'
                  : theme === 'avengers' ? 'text-[#604AC7] bg-black border-[#604AC7]'
                  : 'text-[#3b82f6] bg-black border-[#3b82f6]'
                }`}>
                  {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 bg-white border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-lg`}>
                <span className="text-sm text-black font-bold">{theme === 'ben10' ? '🏷️' 
                  : theme === 'tinkerbell' ? '🏷️'
                  : theme === 'cricketverse' ? '🏷️'
                  : theme === 'bounceworld' ? '🏷️'
                  : theme === 'avengers' ? '🏷️'
                  : '🏷️'} Status:</span>
                <span className={`text-sm font-black px-3 py-1 rounded-full border-2 ${theme === 'bounceworld' ? 'border-[#C8102E]' : 'border-black'} ${
                  student.status === 'Active' 
                    ? (theme === 'ben10' ? 'bg-[#64cc4f] text-black' 
                      : theme === 'tinkerbell' ? 'bg-yellow-400 text-black' 
                      : theme === 'cricketverse' ? 'bg-[#3b82f6] text-white'
                      : theme === 'cricketverse-australian' ? 'bg-yellow-400 text-black'
                      : theme === 'bounceworld' ? 'bg-[#1D428A] text-white'
                      : theme === 'avengers' ? 'bg-[#604AC7] text-white'
                      : 'bg-[#3b82f6] text-white')
                    : student.status === 'Suspended'
                    ? 'bg-red-400 text-black'
                    : 'bg-gray-400 text-black'
                }`}>
                  {student.status || 'Active'} 
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 bg-white border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-lg`}>
                <span className="text-sm text-black font-bold">{theme === 'ben10' ? '📚' 
                  : theme === 'tinkerbell' ? '📚'
                  : theme === 'cricketverse' ? '📚'
                  : theme === 'bounceworld' ? '📚'
                  : theme === 'avengers' ? '📚'
                  : '📚'} Courses Enrolled:</span>
                <span className={`text-sm font-black text-black px-2 py-1 rounded border ${theme === 'bounceworld' ? 'border-[#C8102E]' : 'border-black'} ${
                  theme === 'ben10' ? 'bg-[#b2e05b]' 
                  : theme === 'tinkerbell' ? 'bg-yellow-500' 
                  : theme === 'cricketverse' ? 'bg-[#60a5fa]'
                  :theme === 'cricketverse-australian' ? 'bg-yellow-400'
                  : theme === 'bounceworld' ? 'bg-[#1D428A]/20'
                  : theme === 'avengers' ? 'bg-[#604AC7]/20'
                  : 'bg-[#60a5fa]'
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
