'use client';

import { useEffect, useState } from 'react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import ChatInterface from '@/components/chat/ChatInterface';

export default function TeacherChatPage() {
  const [teacherInfo, setTeacherInfo] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch current teacher info
    const fetchTeacherInfo = async () => {
      try {
        // Get teacher info from localStorage or session
        const storedTeacher = localStorage.getItem('teacherUser');
        if (storedTeacher) {
          const teacher = JSON.parse(storedTeacher);
          setTeacherInfo({
            id: teacher.id || teacher.uid || 'teacher',
            name: teacher.name || 'Teacher',
            email: teacher.email || 'teacher@drueducation.com.au',
          });
        } else {
          // Fallback: use default teacher info
          setTeacherInfo({
            id: 'teacher',
            name: 'Teacher',
            email: 'teacher@drueducation.com.au',
          });
        }
      } catch (error) {
        console.error('Error fetching teacher info:', error);
        // Use default teacher info
        setTeacherInfo({
          id: 'teacher',
          name: 'Teacher',
          email: 'teacher@drueducation.com.au',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeacherInfo();
  }, []);

  if (isLoading) {
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

  if (!teacherInfo) {
    return (
      <TeacherLayout>
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
          <p className="text-gray-500">Please log in to access chat</p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="h-[calc(100vh-80px)]">
        <ChatInterface
          currentUserId={teacherInfo.id}
          currentUserName={teacherInfo.name}
          currentUserEmail={teacherInfo.email}
          currentUserRole="teacher"
        />
      </div>
    </TeacherLayout>
  );
}
