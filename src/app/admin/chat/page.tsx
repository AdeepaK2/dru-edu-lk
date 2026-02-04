'use client';

import { useEffect, useState } from 'react';
import ChatInterface from '@/components/chat/ChatInterface';

import { auth } from '@/utils/firebase-client';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminChatPage() {
  const [adminInfo, setAdminInfo] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAdminInfo({
          id: user.uid, // Use Firebase UID as admin ID
          name: user.displayName || 'Admin',
          email: user.email || 'admin@drueducation.com.au',
        });
      } else {
        setAdminInfo(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!adminInfo) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <p className="text-gray-500">Please log in to access chat</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)]">
      <ChatInterface
        currentUserId={adminInfo.id}
        currentUserName={adminInfo.name}
        currentUserEmail={adminInfo.email}
        currentUserRole="admin"
      />
    </div>
  );
}
