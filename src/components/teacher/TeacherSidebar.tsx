import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  GraduationCap,
  Home,
  Users,
  BookOpen,
  Video,
  FileQuestion,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Book,
  DollarSign,
  FileSpreadsheet,
  Mail
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useTeacherNavigation } from '@/hooks/useTeacherNavigation';

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/teacher',
    icon: Home,
  },
  {
    id: 'classes',
    label: 'My Classes',
    href: '/teacher/classes',
    icon: Users,
  },
  {
    id: 'videos',
    label: 'Video Library',
    href: '/teacher/videos',
    icon: Video,
  },
  {
    id: 'tests',
    label: 'Tests & Quizzes',
    href: '/teacher/tests',
    icon: FileText,
  },
  {
    id: 'questions',
    label: 'Question Bank',
    href: '/teacher/questions',
    icon: FileQuestion,
  },
  {
    id: 'lessons',
    label: 'Lessons',
    href: '/teacher/lessons',
    icon: Book,
  },
  {
    id: 'sheets',
    label: 'Sheet Management',
    href: '/teacher/sheets',
    icon: FileSpreadsheet,
  },
  {
    id: 'grades',
    label: 'Grade Book',
    href: '/teacher/grades',
    icon: BarChart3,
  },
  {
    id: 'meeting',
    label: 'Meetings',
    href: '/teacher/meeting',
    icon: Video,
  },
  {
    id: 'email-batches',
    label: 'Email History',
    href: '/teacher/email-batches',
    icon: Mail,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    href: '/teacher/transactions',
    icon: DollarSign,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/teacher/settings',
    icon: Settings,
  },
];

interface TeacherSidebarProps {
  teacher?: {
    name: string;
    subjects?: string[];
    avatar?: string;
  } | null;
  isOpen: boolean;
  onToggle: () => void;
}

export default function TeacherSidebar({ teacher, isOpen, onToggle }: TeacherSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { navigateWithLoading, preloadRoute } = useTeacherNavigation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/teacher/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Optimized navigation handler
  const handleNavigation = (href: string) => {
    // Close mobile sidebar
    if (window.innerWidth < 1024) {
      onToggle();
    }
    
    // Use optimized navigation
    if (pathname !== href) {
      navigateWithLoading(href);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden" 
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0 lg:w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Dr U Education
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Teacher Portal</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Teacher Profile */}
        {teacher && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                  {teacher.avatar || teacher.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {teacher.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {teacher.subjects && teacher.subjects.length > 0 
                    ? teacher.subjects.length === 1 
                      ? `${teacher.subjects[0]} Teacher`
                      : 'Multi-Subject Teacher'
                    : 'Teacher'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <div
                key={item.id}
                className={`
                  flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer
                  ${isActive 
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                onClick={() => handleNavigation(item.href)}
                onMouseEnter={() => preloadRoute(item.href)}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center space-x-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </>
  );
}
