'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import StudentSidebar from '@/components/student/StudentSidebar';
import { Button } from '@/components/ui';

interface StudentLayoutProps {
  children: React.ReactNode;
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  const { user, student, loading, error, isAuthenticated } = useStudentAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // If we're on a login-related route, bypass authentication checks
  const isLoginRoute = pathname?.startsWith('/student/login');
  
  // For login routes, just render the children without auth checks
  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 dark:bg-red-900/20 p-6 rounded-lg">
            <p className="text-red-600 dark:text-red-400 mb-4">
              {error || 'Authentication required'}
            </p>
            <Button onClick={() => window.location.href = '/student/login'} variant="outline">
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <StudentSidebar 
          student={student} 
          isOpen={sidebarOpen} 
          onToggle={toggleSidebar} 
        />

        {/* Main Content */}
        <div className="flex-1 lg:ml-0">
          {/* Mobile Header */}
          <div className="lg:hidden bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between h-16 px-4">
              <Button
                onClick={toggleSidebar}
                variant="outline"
                size="sm"
                className="p-2"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Student Portal
              </h1>
              <div className="w-9" /> {/* Spacer for centering */}
            </div>
          </div>

          {/* Page Content */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
