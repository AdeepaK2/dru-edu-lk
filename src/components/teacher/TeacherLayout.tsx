'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Menu } from 'lucide-react';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherSidebar from '@/components/teacher/TeacherSidebar';
import TeacherLoadingBar from '@/components/teacher/TeacherLoadingBar';
import { Button } from '@/components/ui';
import { optimizeTeacherNavigation } from '@/utils/teacher-performance';
import { useTeacherNavigation } from '@/hooks/useTeacherNavigation';

interface TeacherLayoutProps {
  children: React.ReactNode;
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  const { teacher, loading, error, isAuthenticated } = useTeacherAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isNavigating } = useTeacherNavigation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Initialize performance optimizations
  useEffect(() => {
    optimizeTeacherNavigation();
  }, []);

  // Loading component for better UX
  const LoadingSpinner = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    </div>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 dark:bg-red-900/20 p-6 rounded-lg">
            <p className="text-red-600 dark:text-red-400 mb-4">
              {error || 'Authentication required'}
            </p>
            <Button onClick={() => window.location.href = '/teacher/login'} variant="outline">
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Loading bar for navigation */}
      <TeacherLoadingBar />
      
      <div className="flex">
        {/* Sidebar */}
        <TeacherSidebar 
          teacher={teacher} 
          isOpen={sidebarOpen} 
          onToggle={toggleSidebar} 
        />

        {/* Main Content */}
        <div className="flex-1 lg:ml-0 overflow-x-hidden">
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
                Teacher Portal
              </h1>
              <div className="w-9" /> {/* Spacer for centering */}
            </div>
          </div>

          {/* Page Content */}
          <main className="p-6 relative overflow-y-auto">
            {/* Navigation loading overlay */}
            {isNavigating && (
              <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 z-10 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-6 h-6 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Loading...</p>
                </div>
              </div>
            )}
            
            <Suspense fallback={<LoadingSpinner />}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
