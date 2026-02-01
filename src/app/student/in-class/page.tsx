'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { TestService } from '@/apiservices/testService';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { Test } from '@/models/testSchema';
import { Button, Card } from '@/components/ui';
import { Calendar, Clock, FileText, ChevronRight, AlertCircle } from 'lucide-react';
import StudentSidebar from '@/components/student/StudentSidebar';

export default function StudentInClassTestsPage() {
  const router = useRouter();
  const { user } = useStudentAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchTests = async () => {
      if (!user) return;

      try {
        setLoading(true);
        // 1. Get enrollments to get class IDs
        const enrollments = await getEnrollmentsByStudent(user.uid);
        const activeClassIds = enrollments
          .filter(e => e.status === 'Active')
          .map(e => e.classId);

        if (activeClassIds.length === 0) {
          setTests([]);
          setLoading(false);
          return;
        }

        // 2. Fetch in-class tests for these classes
        const fetchedTests = await TestService.getInClassTestsForStudent(activeClassIds);
        setTests(fetchedTests);
      } catch (error) {
        console.error('Error fetching in-class tests:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [user]);

  const handleTestClick = (testId: string) => {
    router.push(`/student/in-class/${testId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-100 text-green-800 border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'TBA';
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <StudentSidebar 
        student={user ? { 
          name: user.displayName || 'Student', 
          email: user.email || '',
          avatar: user.photoURL || undefined
        } : null}
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
      />

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">In-Class Assignments</h1>
              <p className="text-gray-500 mt-1">View and manage your in-class tests and offline assessments</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No Assignments Found</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2">
                You don't have any in-class assignments scheduled at the moment.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {tests.map((test) => {
                const isLive = test.status === 'live';
                const scheduledTime = (test as any).scheduledStartTime;
                
                return (
                  <Card 
                    key={test.id}
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary-500"
                    onClick={() => handleTestClick(test.id)}
                  >
                    <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          isLive ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <FileText className="w-6 h-6" />
                        </div>
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(test.status)}`}>
                            {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {test.subjectName}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{test.title}</h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDateTime(scheduledTime)}</span>
                          </div>
                          {(test as any).duration && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              <span>{(test as any).duration} mins</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 self-start md:self-center">
                        <Button variant="outline" size="sm" className="hidden md:flex">
                          View Details <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
