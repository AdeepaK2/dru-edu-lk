'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  BookOpen,
  Home,
  Users,
  FileText,
  GraduationCap,
  Video,
  Trophy,
  Settings,
  LogOut,
  ChevronRight,
  X,
  BookOpenCheck,
  ShoppingCart,
  PlayCircle,
  FileCheck,
  FileSpreadsheet
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { TestService } from '@/apiservices/testService';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const getUpcomingUnattemptedQuizCount = async (studentId: string): Promise<number> => {
  try {
    // Get student's class enrollments
    const enrollments = await getEnrollmentsByStudent(studentId);
    const classIds = enrollments
      .filter(enrollment => enrollment.status === 'Active')
      .map(enrollment => enrollment.classId);
    
    if (classIds.length === 0) {
      return 0;
    }

    // Get upcoming unattempted test count using the efficient service
    return await TestService.getUpcomingUnattemptedTestCount(studentId, classIds);
  } catch (error) {
    console.error('Error getting upcoming quiz count:', error);
    return 0;
  }
};

function buildSidebarItems(upcomingQuizCount: number): SidebarItem[] {
  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/student',
      icon: Home,
    },
    {
      id: 'classes',
      label: 'My Classes',
      href: '/student/classes',
      icon: Users,
    },
    {
      id: 'tests',
      label: 'Tests & Quizzes',
      href: '/student/test',
      icon: FileText,
      badge: upcomingQuizCount > 0 ? String(upcomingQuizCount) : undefined,
    },
    {
      id: 'study',
      label: 'Study Materials',
      href: '/student/study',
      icon: BookOpenCheck,
    },
    {
      id: 'sheets',
      label: 'My Sheets',
      href: '/student/sheets',
      icon: FileSpreadsheet,
    },
    {
      id: 'videos',
      label: 'Video Library',
      href: '/student/video',
      icon: Video,
    },
    {
      id: 'results',
      label: 'Results & Grades',
      href: '/student/results',
      icon: Trophy,
    },
    {
      id: 'meeting',
      label: 'Meetings',
      href: '/student/meeting',
      icon: Video,
    },
    {
      id: 'documents',
      label: 'Documents',
      href: '/student/documents',
      icon: FileCheck,
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/student/settings',
      icon: Settings,
    },
  ];
}

interface StudentSidebarProps {
  student?: {
    name: string;
    email?: string;
    avatar?: string;
    status?: string;
  } | null;
  isOpen: boolean;
  onToggle: () => void;
}


export default function StudentSidebar({ student, isOpen, onToggle }: StudentSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const [upcomingQuizCount, setUpcomingQuizCount] = useState(0);

  useEffect(() => {
    if (student?.email || student?.name) {
      // Use student.id if available, fallback to email for student ID
      const studentId = (student as any)?.id || student?.email || student?.name;
      if (studentId) {
        getUpcomingUnattemptedQuizCount(studentId).then(setUpcomingQuizCount).catch(console.error);
      }
    }
  }, [student]);

  const sidebarItems = buildSidebarItems(upcomingQuizCount);

  const getAvatarImagePath = (avatarId?: string) => {
    if (!avatarId) return null;

    // Ben10 avatars (ids map to files in /public)
    const ben10Map: Record<string, string> = {
      heatblast: '/heatblast.png',
      wildmutt: '/Wildmutt.png',
      diamondhead: '/Diamondhead.png',
      ghostfreak: '/ghostfreak.png',
      benwolf: '/benwolf.png'
    };

    // Tinkerbell avatars
    const tinkerMap: Record<string, string> = {
      silvermist: '/silvermist.png',
      fawn: '/Fawn.png',
      iridessa: '/Iridessa .png',
      rosetta: '/Rosetta.png',
      tinkerbell: '/tinkerbell.png'
    };

    if (ben10Map[avatarId]) return ben10Map[avatarId];
    if (tinkerMap[avatarId]) return tinkerMap[avatarId];

    // If avatarId looks like a path, return it directly
    if (avatarId.startsWith('/') || avatarId.includes('.png') || avatarId.includes('.jpg') || avatarId.includes('.avif')) {
      return avatarId;
    }

    return null;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/student/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className={`fixed inset-0 z-40 backdrop-blur-sm lg:hidden ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-[#64cc4f]/80 via-[#222222]/80 to-[#b2e05b]/80'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-green-400/80 via-yellow-400/80 to-yellow-600/80'
              : 'bg-gradient-to-br from-blue-400/80 via-indigo-400/80 to-indigo-600/80'
          }`}
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 shadow-2xl transform transition-transform duration-300 ease-in-out border-r-4 border-black
        lg:translate-x-0 lg:static lg:inset-0 lg:w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${theme === 'ben10' 
          ? 'bg-gradient-to-b from-[#64cc4f] via-[#222222] to-[#b2e05b]' 
          : theme === 'tinkerbell'
          ? 'bg-gradient-to-br from-green-400 to-yellow-600'
          : 'bg-gradient-to-b from-blue-500 via-indigo-500 to-indigo-600'}
      `}>
        {/* Header */}
          <div className={`flex items-center justify-between px-6 py-3 ${
            theme === 'ben10' 
              ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' 
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-r from-yellow-500 to-green-600'
              : 'bg-gradient-to-r from-blue-600 to-indigo-700'
          }`}>
            <div className="flex items-center space-x-3">
              <img 
                src="/Logo.png" 
                alt="Ben 10 Academy Logo" 
                className="w-10 h-10 rounded-2xl border-2 border-black shadow-lg"
              />
              <div className="hidden lg:block">
                <h1 className="text-lg font-black text-white drop-shadow-lg">
                  Dr. U Education
                </h1>
              </div>
            </div>
            <button
              onClick={onToggle}
              className={`lg:hidden p-2 rounded-full text-white border-2 border-white font-black transition-all ${
                theme === 'ben10'
                  ? 'hover:text-green-400 hover:bg-black'
                  : theme === 'tinkerbell'
                  ? 'hover:text-yellow-400 hover:bg-black'
                  : 'hover:text-blue-400 hover:bg-indigo-700'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* Student Profile */}
        {student && (
          <div className={`p-3 border-b-4 border-black ${
            theme === 'ben10'
              ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-r from-yellow-500 to-green-600'
              : 'bg-gradient-to-r from-indigo-600 to-blue-500'
          }`}>
            <div className="flex items-center space-x-2">
              {/* Avatar - No circle, just image visible */}
              <div className="flex-shrink-0 overflow-hidden">
                {(() => {
                  const avatarPath = getAvatarImagePath((student as any)?.avatar);
                  if (avatarPath && (theme === 'ben10' || theme === 'tinkerbell')) {
                    return (
                      <Image src={avatarPath} alt={(student as any)?.name || 'Avatar'} width={48} height={48} className="object-cover" />
                    );
                  }

                  return (
                    <span className="text-3xl font-black">
                      {theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : '📚'}
                    </span>
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">
                  {student.name}
                </p>
                <p className="text-xs font-bold text-white" style={{
                  opacity: 0.9
                }}>
                  {student.status === 'Active' 
                    ? (theme === 'ben10' ? '🔥 Active' : theme === 'tinkerbell' ? '✨ Active' : '⭐ Active') 
                    : student.status || 'Student'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-6 py-6 space-y-3">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center justify-between px-4 py-3 text-sm font-black rounded-2xl transition-all transform hover:scale-105 border-2
                  ${isActive 
                    ? (theme === 'ben10'
                        ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] text-white border-black shadow-lg'
                        : theme === 'tinkerbell'
                        ? 'bg-gradient-to-r from-yellow-400 to-green-500 text-white border-black shadow-lg'
                        : 'bg-gradient-to-r from-blue-400 to-indigo-600 text-white border-indigo-700 shadow-lg')
                    : `bg-white text-black hover:bg-gradient-to-r border-gray-300 hover:border-black ${
                        theme === 'ben10'
                          ? 'hover:from-[#64cc4f] hover:to-[#222222] hover:text-white'
                          : theme === 'tinkerbell'
                          ? 'hover:from-yellow-300 hover:to-green-400 hover:text-white'
                          : 'hover:from-blue-300 hover:to-indigo-500 hover:text-white'
                      }`
                  }
                `}
                onClick={() => {
                  // Close mobile sidebar when navigating
                  if (window.innerWidth < 1024) {
                    onToggle();
                  }
                }}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-black'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`inline-flex items-center px-3 py-1 text-sm font-black text-white rounded-full border-2 border-black ${
                    theme === 'ben10'
                      ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]'
                      : theme === 'tinkerbell'
                      ? 'bg-gradient-to-r from-yellow-400 to-green-500'
                      : 'bg-gradient-to-r from-blue-400 to-indigo-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <ChevronRight className="w-5 h-5 text-white" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className={`p-6 border-t-4 border-black ${
          theme === 'ben10'
            ? 'bg-gradient-to-r from-[#222222] to-[#64cc4f]'
            : 'bg-gradient-to-r from-yellow-500 to-green-600'
        }`}>
          <Button
            onClick={handleLogout}
            variant="outline"
            className={`w-full flex items-center justify-center space-x-3 text-black font-black border-2 border-black rounded-full py-3 transform hover:scale-105 transition-all shadow-lg ${
              theme === 'ben10'
                ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]'
                : 'bg-gradient-to-r from-yellow-400 to-green-500 hover:from-yellow-500 hover:to-green-600'
            }`}
          >
            <LogOut className="text-black w-5 h-5" />
            <span className="text-black"> Logout</span>
          </Button>
        </div>
      </div>
    </>
  );
}
