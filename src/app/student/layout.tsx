'use client';

import React from 'react';
import StudentLayout from '@/components/student/StudentLayout';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function StudentRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <StudentLayout>
        {children}
      </StudentLayout>
    </ThemeProvider>
  );
}
