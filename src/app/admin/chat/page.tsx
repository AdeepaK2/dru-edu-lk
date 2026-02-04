'use client';

import { useEffect, useState } from 'react';
import ChatInterface from '@/components/chat/ChatInterface';

export default function AdminChatPage() {
  const [adminInfo, setAdminInfo] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch current admin info
    const fetchAdminInfo = async () => {
      try {
        // Get admin info from localStorage or session
        const storedAdmin = localStorage.getItem('adminUser');
        if (storedAdmin) {
          const admin = JSON.parse(storedAdmin);
          setAdminInfo({
            id: admin.id || admin.uid || 'admin',
            name: admin.name || 'Admin',
            email: admin.email || 'admin@drueducation.com.au',
          });
        } else {
          // Fallback: use default admin info
          setAdminInfo({
            id: 'admin',
            name: 'Admin',
            email: 'admin@drueducation.com.au',
          });
        }
      } catch (error) {
        console.error('Error fetching admin info:', error);
        // Use default admin info
        setAdminInfo({
          id: 'admin',
          name: 'Admin',
          email: 'admin@drueducation.com.au',
        });
      } finally {
        setIsLoading(false);
      }
    };

  fetchAdminInfo();
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
