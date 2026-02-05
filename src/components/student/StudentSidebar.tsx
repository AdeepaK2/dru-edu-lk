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
      id: 'in-class',
      label: 'In-Class Assignments',
      href: '/student/in-class',
      icon: FileCheck, 
    },
    {
      id: 'homework',
      label: 'Home Work',
      href: '/student/homework',
      icon: BookOpenCheck,
    },
    {
      id: 'study',
      label: 'Study Materials',
      href: '/student/study',
      icon: BookOpen,
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
  const [avatarKey, setAvatarKey] = useState(0); // Force re-render key

  // Force re-render when avatar changes
  useEffect(() => {
    setAvatarKey(prev => prev + 1); // Force re-render
  }, [student?.avatar]);

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

  const getAvatarImagePath = (avatarId?: string, currentTheme?: string) => {
    if (!avatarId || !currentTheme) return null;

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

    // Avengers avatars
    const avengersMap: Record<string, string> = {
      ironman: '/avengers/Iron Man.png',
      captainamerica: '/avengers/captain-america.png',
      thor: '/avengers/thor.png',
      hulk: '/avengers/hulk.png',
      spiderman: '/avengers/spiderman.png',
      batman: '/avengers/batman.png',
      superman: '/avengers/supermanpng.png',
      wonderwoman: '/avengers/wonder-women.png'
    };

    // BounceWorld avatars (NBA players)
    const bounceWorldMap: Record<string, string> = {
      lebron: '/bounceworld/LeBron James.webp',
      steph: '/bounceworld/Stephen Curry.webp',
      kd: '/bounceworld/Kevin Durant.webp',
      jayson: '/bounceworld/Jayson Tatum.webp',
      joel: '/bounceworld/Joel Embiid.webp',
      anthony: '/bounceworld/Anthony Davis.webp',
      devin: '/bounceworld/Devin Booker.webp',
      jrue: '/bounceworld/Jrue Holiday.webp',
      derrick: '/bounceworld/Derrick White.webp',
      tyrese: '/bounceworld/Tyrese Haliburton.webp',
      ant: '/bounceworld/Anthony Edwards.webp',
      bam: '/bounceworld/Bam Adebayowebp.webp'
    };

    // CricketVerse avatars (Cricket players)
    const cricketVerseMap: Record<string, string> = {
      // Indian Cricket Players
      'virat-kohli': '/cricketverse/indian/VIRAT KOHLI.avif',
      'rohit-sharma': '/cricketverse/indian/ROHIT SHARMA.avif',
      'shubman-gill': '/cricketverse/indian/SHUBMAN GILL.avif',
      'kl-rahul': '/cricketverse/indian/KL RAHUL.avif',
      'rishabh-pant': '/cricketverse/indian/RISHABH PANT.avif',
      'hardik-pandya': '/cricketverse/indian/HARDIK PANDYA.avif',
      'ravindra-jadeja': '/cricketverse/indian/RAVINDRA JADEJA.avif',
      'jasprit-bumrah': '/cricketverse/indian/JASPRIT BUMRAH.avif',
      'mohammed-shami': '/cricketverse/indian/MOHAMMAD SHAMI.avif',
      'mohammed-siraj': '/cricketverse/indian/MOHAMMED SIRAJ.avif',
      // Australian Cricket Players
      'adam-zampa': '/cricketverse/australian/Adam Zampa.webp',
      'alex-carey': '/cricketverse/australian/Alex Carey.webp',
      'cameron-green': '/cricketverse/australian/Cameron Green.webp',
      'glenn-maxwell': '/cricketverse/australian/Glenn Maxwell.webp',
      'josh-hazlewood': '/cricketverse/australian/Josh Hazlewood.webp',
      'josh-inglis': '/cricketverse/australian/Josh Inglis.webp',
      'lance-morris': '/cricketverse/australian/Lance Morris.webp',
      'matthew-short': '/cricketverse/australian/Matthew Short.webp',
      'mitchell-starc': '/cricketverse/australian/Mitchell Starc.webp',
      'nathan-ellis': '/cricketverse/australian/Nathan Ellis.webp',
      'travis-head': '/cricketverse/australian/Travis Head.webp',
      'usman-khawaja': '/cricketverse/australian/Usman Khawaja.webp',
      'xavier-bartlett': '/cricketverse/australian/Xavier Bartlett.webp'
    };

    // Ponyville avatars (Magical unicorns and ponies)
    const ponyvilleMap: Record<string, string> = {
      applejack: '/ponyville/applejack.png',
      pinkie: '/ponyville/pinky pie.png',
      luna: '/ponyville/princesluna.png',
      rainbow: '/ponyville/rainbow-dash.png',
      rarity: '/ponyville/rarity.png',
      sweetie: '/ponyville/sweetybelle.png'
    };

    // Only return avatar if it belongs to the current theme
    if (currentTheme === 'ben10' && ben10Map[avatarId]) return ben10Map[avatarId];
    if (currentTheme === 'tinkerbell' && tinkerMap[avatarId]) return tinkerMap[avatarId];
    if (currentTheme === 'avengers' && avengersMap[avatarId]) return avengersMap[avatarId];
    if (currentTheme === 'bounceworld' && bounceWorldMap[avatarId]) return bounceWorldMap[avatarId];
    if ((currentTheme === 'cricketverse' || currentTheme === 'cricketverse-australian') && cricketVerseMap[avatarId]) return cricketVerseMap[avatarId];
    if (currentTheme === 'ponyville' && ponyvilleMap[avatarId]) return ponyvilleMap[avatarId];

    // If avatarId looks like a path, return it directly (for backwards compatibility)
    if (avatarId.startsWith('/') || avatarId.includes('.png') || avatarId.includes('.jpg') || avatarId.includes('.avif') || avatarId.includes('.webp')) {
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
          className="fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          style={{
            background: theme === 'default'
              ? 'rgba(0, 0, 0, 0.8)'
              : theme === 'ben10'
              ? 'linear-gradient(to bottom right, rgba(100, 204, 79, 0.8), rgba(34, 34, 34, 0.6), rgba(178, 224, 91, 0.8))'
              : theme === 'tinkerbell'
              ? 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.8), rgba(253, 224, 71, 0.8), rgba(253, 224, 71, 0.8))'
              : theme === 'cricketverse'
              ? 'linear-gradient(to bottom right, rgba(96, 165, 250, 0.8), rgba(79, 70, 229, 0.8), rgba(79, 70, 229, 0.8))'
              : theme === 'cricketverse-australian'
              ? 'linear-gradient(to bottom right, rgba(134, 250, 92, 0.8) 0%, rgba(255, 255, 42, 0.8) 40%, rgba(255, 255, 42, 0.8) 60%, rgba(134, 250, 92, 0.8) 100%)'
              : theme === 'bounceworld'
              ? 'rgba(255, 255, 255, 0.8)'
              : theme === 'avengers'
              ? 'linear-gradient(to bottom right, rgba(44, 18, 103, 0.8), rgba(79, 44, 141, 0.8))'
              : theme === 'ponyville'
              ? 'linear-gradient(to bottom right, rgba(241, 174, 213, 0.8), rgba(225, 54, 144, 0.8), rgba(255, 46, 159, 0.8))'
              : 'rgba(0, 0, 0, 0.8)'
          }}
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 shadow-2xl transform transition-transform duration-300 ease-in-out border-r-4 border-black
        lg:translate-x-0 lg:static lg:inset-0 lg:w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `} style={{
        background: theme === 'default'
          ? 'rgb(255, 255, 255)'
          : theme === 'ben10'
          ? 'linear-gradient(to bottom, rgb(100, 204, 79), rgb(94, 194, 94), rgb(178, 224, 91))'
          : theme === 'tinkerbell'
          ? 'linear-gradient(to bottom right, rgb(34, 197, 94), rgb(253, 224, 71))'
          : theme === 'cricketverse'
          ? 'linear-gradient(to bottom, rgb(59, 130, 246), rgb(79, 70, 229), rgb(79, 70, 229))'
          : theme === 'cricketverse-australian'
          ? 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)'
          : theme === 'bounceworld'
          ? 'linear-gradient(to bottom, rgba(29, 66, 138, 0.7), rgb(200, 16, 46))'
          : theme === 'avengers'
          ? 'linear-gradient(to bottom, rgb(44, 18, 103), rgb(79, 44, 141))'
          : theme === 'ponyville'
          ? 'linear-gradient(to bottom, rgb(241, 174, 213), rgb(225, 54, 144), rgb(255, 46, 159))'
          : 'rgb(255, 255, 255)'
      }}>
        {/* Header */}
          <div className={`flex items-center justify-between px-6 py-3 ${
            theme === 'default'
              ? 'bg-gradient-to-r from-blue-600 via-indigo-700 to-indigo-900 border-b-4 border-black'
              : theme === 'ben10'
              ? 'bg-gradient-to-r from-[#2d871b] to-[#287b34]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-r from-yellow-500 to-green-600'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
              : theme === 'cricketverse-australian'
              ? 'bg-[#fff800]'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]'
              : theme === 'avengers'
              ? 'bg-gradient-to-r from-[#2C1267] to-[#4F2C8D]'
              : theme === 'ponyville'
              ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]'
              : 'bg-gradient-to-r from-blue-600 via-indigo-700 to-indigo-900'
          }`}>
            <div className="flex items-center space-x-3">
              <img 
                src="/Logo.png" 
                alt="Ben 10 Academy Logo" 
                className="w-10 h-10 rounded-2xl border-2 border-black shadow-lg"
              />
              <div className="hidden lg:block">
                  <h1 className={`text-lg font-black drop-shadow-lg ${theme === 'bounceworld' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                    Dr. U Education
                  </h1>
                </div>
            </div>
            <button
              onClick={onToggle}
              className={`lg:hidden p-2 rounded-full border-2 font-black transition-all ${theme === 'bounceworld' ? 'text-black border-black hover:text-[#1D428A] hover:bg-white' : 'text-white border-white'} ${
                theme === 'default'
                  ? 'hover:bg-blue-800'
                  : theme === 'ben10'
                  ? 'hover:text-green-400 hover:bg-black'
                  : theme === 'tinkerbell'
                  ? 'hover:text-yellow-400 hover:bg-black'
                  : theme === 'cricketverse'
                  ? 'hover:text-blue-400 hover:bg-indigo-700'
                  : theme === 'avengers'
                  ? 'hover:text-[#604AC7] hover:bg-[#2C1267]'
                  : theme === 'ponyville'
                  ? 'hover:text-[#ff2e9f] hover:bg-[#f1aed5]'
                  : ''
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* Student Profile */}
        {student && (
          <div className={`p-3 border-b-4 border-black ${
            theme === 'default'
              ? 'bg-white'
              : theme === 'ben10'
              ? 'bg-gradient-to-r from-[#64cc4f] to-[#2c9140]'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-r from-yellow-500 to-green-600'
              : theme === 'cricketverse'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-500'
              : theme === 'cricketverse-australian'
              ? 'bg-[#fff800]'
              : theme === 'bounceworld'
              ? 'bg-white'
              : theme === 'avengers'
              ? 'bg-gradient-to-r from-[#2C1267] to-[#4F2C8D]'
              : theme === 'ponyville'
              ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]'
              : 'bg-white'
          }`}>
            <div className="flex items-center space-x-2">
              {/* Avatar - No circle, just image visible */}
              <div className="flex-shrink-0 overflow-hidden">
                {(() => {
                  const avatarPath = getAvatarImagePath((student as any)?.avatar, theme);
                  if (avatarPath && theme !== 'default' && (theme === 'ben10' || theme === 'tinkerbell' || theme === 'avengers' || theme === 'bounceworld' || theme === 'cricketverse' || theme === 'ponyville')) {
                    return (
                      <Image 
                        key={`avatar-${avatarKey}-${(student as any)?.avatar || 'default'}`} 
                        src={avatarPath} 
                        alt={(student as any)?.name || 'Avatar'} 
                        width={48} 
                        height={48} 
                        className="object-cover" 
                      />
                    );
                  }

                  return (
                    <span className="text-3xl font-black">
                      {theme === 'default' ? '🎓' : theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'cricketverse' ? '🏏' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '🦄' : '📚'}
                    </span>
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${theme === 'bounceworld' || theme === 'default' || theme === 'cricketverse-australian' ? 'text-black' : 'text-white'} truncate`}>
                  {student.name}
                </p>
                <p className={`text-xs font-bold ${theme === 'avengers' ? 'text-white' : 'text-black'}`} style={{
                  opacity: 0.9
                }}>
                  {student.status === 'Active' 
                    ? (theme === 'ben10' ? 'Active' : theme === 'tinkerbell' ? ' Active' : 'Active') 
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
                    ? (theme === 'default'
                        ? 'bg-blue-100 text-blue-600 border-blue-600 shadow-lg'
                        : theme === 'ben10'
                        ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] text-white border-black shadow-lg'
                        : theme === 'tinkerbell'
                        ? 'bg-gradient-to-r from-yellow-400 to-green-500 text-white border-black shadow-lg'
                        : theme === 'cricketverse'
                        ? 'bg-gradient-to-r from-blue-400 to-indigo-600 text-white border-indigo-700 shadow-lg'
                        : theme === 'cricketverse-australian'
                        ? 'bg-[#fff800] text-black border-black shadow-lg'
                        : theme === 'bounceworld'
                        ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] text-white border-[#1D428A] shadow-lg'
                        : theme === 'avengers'
                        ? 'bg-gradient-to-r from-[#2C1267] to-[#4F2C8D] text-white border-black shadow-lg'
                        : theme === 'ponyville'
                        ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] text-white border-[#ff2e9f] shadow-lg'
                        : 'bg-blue-100 text-blue-600 border-blue-600 shadow-lg')
                    : `bg-white text-black hover:bg-gradient-to-r border-black hover:border-black ${
                        theme === 'default'
                          ? 'hover:bg-gray-100'
                          : theme === 'ben10'
                          ? 'hover:from-[#64cc4f] hover:to-[#222222] hover:text-white'
                          : theme === 'tinkerbell'
                          ? 'hover:from-yellow-300 hover:to-green-400 hover:text-white'
                          : theme === 'cricketverse'
                          ? 'hover:from-blue-300 hover:to-indigo-500 hover:text-white'
                          : theme === 'cricketverse-australian'
                          ? 'hover:bg-[#fff800] hover:text-black'
                          : theme === 'bounceworld'
                          ? 'hover:from-[#1D428A] hover:to-[#C8102E] hover:text-white'
                          : theme === 'avengers'
                          ? 'hover:from-[#604AC7] hover:to-[#2C1267] hover:text-white'
                          : theme === 'ponyville'
                          ? 'hover:from-[#f1aed5] hover:to-[#e13690] hover:text-white'
                          : 'hover:bg-gray-100'
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
                  <Icon className={`w-6 h-6 ${isActive ? (theme === 'default' ? 'text-blue-600' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white') : 'text-black'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`inline-flex items-center px-3 py-1 text-sm font-black text-white rounded-full border-2 border-black ${
                    theme === 'default'
                      ? 'bg-primary-600'
                      : theme === 'ben10'
                      ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]'
                      : theme === 'tinkerbell'
                      ? 'bg-gradient-to-r from-yellow-400 to-green-500'
                      : theme === 'ponyville'
                      ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]'
                      : 'bg-gradient-to-r from-blue-400 to-indigo-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <ChevronRight className={`w-5 h-5 ${theme === 'default' ? 'text-blue-600' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className={`p-6 border-t-4 border-black ${
          theme === 'default'
            ? 'bg-white'
            : theme === 'ben10'
            ? 'bg-gradient-to-r from-[#222222] to-[#64cc4f]'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-yellow-500 to-green-600'
            : theme === 'cricketverse'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
            : theme === 'cricketverse-australian'
            ? 'bg-[#fff800]'
            : theme === 'bounceworld'
            ? 'bg-white'
            : theme === 'avengers'
            ? 'bg-gradient-to-r from-[#2C1267] to-[#4F2C8D]'
            : theme === 'ponyville'
            ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]'
            : 'bg-white'
        }`}>
          <Button
            onClick={handleLogout}
            variant="outline"
            className={`w-full flex items-center justify-center space-x-3 text-white font-black border-2 border-black rounded-full py-3 transform hover:scale-105 transition-all shadow-lg bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800`}
          >
            <LogOut className="text-white w-5 h-5" />
            <span className="text-white"> Logout</span>
          </Button>
        </div>
      </div>
    </>
  );
}
