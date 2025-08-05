'use client';

import React from 'react';

export default function StudentLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout bypasses the main StudentLayout authentication check
  // allowing unauthenticated users to access the login page
  return <>{children}</>;
}
