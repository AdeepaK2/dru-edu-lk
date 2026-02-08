'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { TestService } from '@/apiservices/testService';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { InClassSubmissionService } from '@/services/inClassSubmissionService';
import { InClassSubmission } from '@/models/inClassSubmissionSchema';
import { Test } from '@/models/testSchema';
import { Button, Card } from '@/components/ui';
import { Calendar, Clock, FileText, ChevronRight, AlertCircle, CheckCircle, Filter } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

interface ClassInfo {
  id: string;
  name: string;
}

export default function StudentInClassTestsPage() {
  const router = useRouter();
  const { user } = useStudentAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, InClassSubmission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  useEffect(() => {
    if (!user) {
      console.log('[In-Class] No user found, skipping fetch');
      return;
    }

    let unsubscribeSubmissions: (() => void) | null = null;

    const fetchTests = async () => {
      try {
        setLoading(true);
        console.log('[In-Class] Fetching tests for user:', user.uid);

        // Get student's enrolled classes
        const enrollments = await getEnrollmentsByStudent(user.uid);
        const classIds = enrollments.map(e => e.classId);

        // Store class info for filtering
        const classInfoList: ClassInfo[] = enrollments.map(e => ({
          id: e.classId,
          name: e.className || 'Unknown Class'
        }));
        setClasses(classInfoList);

        console.log('[In-Class] Student enrolled in classes:', classIds);
        console.log('[In-Class] Total enrollments:', enrollments.length);

        if (classIds.length === 0) {
          console.warn('[In-Class] Student has no class enrollments');
          setTests([]);
          return;
        }

        // Fetch in-class tests for those classes
        const inClassTests = await TestService.getInClassTestsForStudent(classIds);

        console.log('[In-Class] Fetched tests:', inClassTests);
        console.log('[In-Class] Total tests found:', inClassTests.length);

        inClassTests.forEach((test, index) => {
          console.log(`[In-Class] Test ${index + 1}:`, {
            id: test.id,
            title: test.title,
            type: test.type,
            status: test.status,
            classIds: (test as any).classIds,
            scheduledStartTime: (test as any).scheduledStartTime
          });
        });

        setTests(inClassTests);

        // Set up real-time listener for all student's submissions
        const submissionsQuery = query(
          collection(firestore, 'inClassSubmissions'),
          where('studentId', '==', user.uid)
        );

        unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
          const submissionMap = new Map<string, InClassSubmission>();
          snapshot.docs.forEach((doc) => {
            const submissionData = {
              id: doc.id,
              ...doc.data()
            } as InClassSubmission;
            submissionMap.set(submissionData.testId, submissionData);
          });
          console.log('[In-Class] Submissions updated:', submissionMap.size);
          setSubmissions(submissionMap);
        }, (error) => {
          console.error('[In-Class] Submissions listener error:', error);
        });
      } catch (error) {
        console.error('[In-Class] Error fetching tests:', error);
        if (error instanceof Error) {
          console.error('[In-Class] Error details:', error.message, error.stack);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTests();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribeSubmissions) {
        unsubscribeSubmissions();
      }
    };
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

  const getTestStatus = (test: Test) => {
    const now = new Date();
    const scheduledTime = (test as any).scheduledStartTime?.toDate ? (test as any).scheduledStartTime.toDate() : new Date((test as any).scheduledStartTime);
    const duration = (test as any).duration || 0;
    const endTime = new Date(scheduledTime.getTime() + duration * 60 * 1000);

    // Check if student has a submission for this test
    const submission = submissions.get(test.id);

    // If graded, show grade regardless of time
    if (submission?.status === 'graded') {
      const percentage = submission.totalMarks ? Math.round((submission.marks! / submission.totalMarks) * 100) : 0;
      return {
        label: `Graded: ${submission.marks}/${submission.totalMarks}`,
        color: percentage >= 50 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200',
        isGraded: true,
        marks: submission.marks,
        totalMarks: submission.totalMarks
      };
    }

    // If submitted (online), show submitted status
    if (submission?.status === 'submitted') {
      return { label: 'Submitted - Pending Grade', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    }

    // If marked absent
    if (submission?.status === 'absent') {
      return { label: 'Absent', color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }

    // Check if time expired (only show if not graded)
    if (now > endTime) {
      const isOffline = (test as any).submissionMethod === 'offline_collection';
      if (isOffline) {
        return { label: 'Pending Grade', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
      }
      return { label: 'Time Expired', color: 'bg-red-50 text-red-700 border-red-200' };
    }

    // Check if active (within test window)
    if (now >= scheduledTime && now <= endTime) {
      return { label: 'Active', color: 'bg-green-50 text-green-700 border-green-200 animate-pulse' };
    }

    // Check if scheduled (future)
    if (now < scheduledTime) {
      return { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }

    return { label: test.status, color: getStatusColor(test.status) };
  };

  // Filter tests by selected class
  const filteredTests = selectedClassId === 'all'
    ? tests
    : tests.filter(test => {
        const testClassIds = (test as any).classIds || [];
        return testClassIds.includes(selectedClassId);
      });

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
    <main className="flex-1 overflow-y-auto p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">In-Class Assignments</h1>
            <p className="text-gray-500 mt-1">View and manage your in-class tests and offline assessments</p>
          </div>

          {/* Class Filter */}
          {classes.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Assignments Found</h3>
            <p className="text-gray-500 max-w-sm mx-auto mt-2">
              {selectedClassId === 'all'
                ? "You don't have any in-class assignments scheduled at the moment."
                : "No assignments found for this class."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTests.map((test) => {
              const testStatus = getTestStatus(test);
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
                        (testStatus as any).isGraded ? 'bg-green-100 text-green-600' :
                        testStatus.label === 'Active' ? 'bg-green-100 text-green-600' :
                        testStatus.label === 'Time Expired' ? 'bg-red-100 text-red-600' :
                        testStatus.label === 'Pending Grade' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {(testStatus as any).isGraded ? <CheckCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${testStatus.color}`}>
                          {testStatus.label}
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
                      {(testStatus as any).isGraded ? (
                        <div className="text-center px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-2xl font-bold text-green-600">
                            {(testStatus as any).marks}/{(testStatus as any).totalMarks}
                          </div>
                          <div className="text-xs text-green-600 font-medium">
                            {(testStatus as any).totalMarks ? Math.round(((testStatus as any).marks / (testStatus as any).totalMarks) * 100) : 0}%
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="hidden md:flex">
                          View Details <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
