'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';

export default function StudentTestLayout({ children }: { children: React.ReactNode }) {
  const { student, loading } = useStudentAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
    }
  }, [student, loading, router]);

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
