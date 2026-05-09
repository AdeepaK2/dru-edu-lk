'use client';

import React, { createContext, useContext, useState } from 'react';
import StudentLayout from '@/components/student/StudentLayout';

// Context for controlling sidebar visibility
interface SidebarContextType {
  hideSidebar: boolean;
  setHideSidebar: (hide: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export default function StudentRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hideSidebar, setHideSidebar] = useState(false);

  return (
    <SidebarContext.Provider value={{ hideSidebar, setHideSidebar }}>
      <StudentLayout hideSidebar={hideSidebar}>
        {children}
      </StudentLayout>
    </SidebarContext.Provider>
  );
}