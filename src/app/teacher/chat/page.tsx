'use client';

import { useEffect, useState } from 'react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import ChatInterface from '@/components/chat/ChatInterface';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';

export default function TeacherChatPage() {
  const { teacher, loading, error, isAuthenticated } = useTeacherAuth();
  
  if (loading) {
    return (
      <TeacherLayout>
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (error || !isAuthenticated || !teacher) {
    return (
      <TeacherLayout>
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-2">{error || 'Please log in to access chat'}</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="h-[calc(100vh-80px)]">
        <ChatInterface
          currentUserId={teacher.id}
          currentUserName={teacher.name}
          currentUserEmail={teacher.email}
          currentUserRole="teacher"
        />
      </div>
    </TeacherLayout>
  );
}
