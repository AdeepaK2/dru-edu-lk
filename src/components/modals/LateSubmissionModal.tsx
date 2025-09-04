'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, Clock, CheckCircle, AlertCircle, Calendar, User } from 'lucide-react';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';
import { StudentSubmission } from '@/models/studentSubmissionSchema';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { SubmissionService } from '@/apiservices/submissionService';
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';
// Import LateSubmissionService dynamically to avoid import issues
import { Button } from '@/components/ui';

interface LateSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
  teacherId: string;
  teacherName: string;
  onLateSubmissionApproved: () => void;
}

interface StudentWithSubmissionStatus {
  studentId: string;
  studentName: string;
  studentEmail: string;
  classId: string;
  className: string;
  hasSubmitted: boolean;
  submissionId?: string;
  submissionStatus?: string;
}

export default function LateSubmissionModal({
  isOpen,
  onClose,
  test,
  teacherId,
  teacherName,
  onLateSubmissionApproved
}: LateSubmissionModalProps) {
  const [students, setStudents] = useState<StudentWithSubmissionStatus[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDeadline, setNewDeadline] = useState<string>('');

  useEffect(() => {
    if (isOpen && test.id) {
      loadStudentsAndSubmissions();
      setDefaultDeadline();
    }
  }, [isOpen, test.id]);

  const setDefaultDeadline = () => {
    // Set default deadline to 7 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    const formattedDate = defaultDate.toISOString().slice(0, 16); // Format for datetime-local input
    setNewDeadline(formattedDate);
  };

  const loadStudentsAndSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Only work with class-based tests
      if (test.assignmentType === 'student-based') {
        setError('Late submissions are only available for class-based tests.');
        return;
      }

      // Get all students from the test's assigned classes
      const allStudents: StudentWithSubmissionStatus[] = [];
      
      // Get submissions for this test
      const submissions = await SubmissionService.getTestSubmissions(test.id);
      const submittedStudentIds = new Set(submissions.map(s => s.studentId));

      // Process each class assigned to this test
      for (const classId of test.classIds) {
        try {
          // Get enrollments for this class
          const enrollments = await getEnrollmentsByClass(classId);
          const activeEnrollments = enrollments.filter(e => e.status === 'Active');

          // Add students from this class
          activeEnrollments.forEach(enrollment => {
            const hasSubmitted = submittedStudentIds.has(enrollment.studentId);
            const submission = submissions.find(s => s.studentId === enrollment.studentId);

            allStudents.push({
              studentId: enrollment.studentId,
              studentName: enrollment.studentName,
              studentEmail: enrollment.studentEmail,
              classId: enrollment.classId,
              className: enrollment.className,
              hasSubmitted,
              submissionId: submission?.id,
              submissionStatus: submission?.status
            });
          });
        } catch (classError) {
          console.warn(`Failed to load students for class ${classId}:`, classError);
        }
      }

      setStudents(allStudents);
      console.log('✅ Loaded students and submission status:', {
        totalStudents: allStudents.length,
        submitted: allStudents.filter(s => s.hasSubmitted).length,
        notSubmitted: allStudents.filter(s => !s.hasSubmitted).length
      });
    } catch (err) {
      console.error('Error loading students and submissions:', err);
      setError('Failed to load student data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTestDeadline = (): Date => {
    if (test.type === 'flexible') {
      const flexTest = test as FlexibleTest;
      // Handle different timestamp formats
      if (flexTest.availableTo && typeof flexTest.availableTo.toDate === 'function') {
        return flexTest.availableTo.toDate();
      } else if (flexTest.availableTo && typeof flexTest.availableTo.seconds === 'number') {
        return new Date(flexTest.availableTo.seconds * 1000);
      }
    } else if (test.type === 'live') {
      const liveTest = test as LiveTest;
      // Handle different timestamp formats
      if (liveTest.actualEndTime && typeof liveTest.actualEndTime.toDate === 'function') {
        return liveTest.actualEndTime.toDate();
      } else if (liveTest.actualEndTime && typeof liveTest.actualEndTime.seconds === 'number') {
        return new Date(liveTest.actualEndTime.seconds * 1000);
      }
    }
    
    // Fallback to current date
    return new Date();
  };

  const isTestExpired = (): boolean => {
    const deadline = getTestDeadline();
    return new Date() > deadline;
  };

  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const notSubmittedStudents = students.filter(s => !s.hasSubmitted);

  const handleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.length === notSubmittedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(notSubmittedStudents.map(s => s.studentId));
    }
  };

  const handleApproveLateSubmission = async () => {
    if (selectedStudentIds.length === 0) {
      setError('Please select at least one student.');
      return;
    }

    if (!newDeadline) {
      setError('Please set a new deadline.');
      return;
    }

    const deadlineDate = new Date(newDeadline);
    if (deadlineDate <= new Date()) {
      setError('New deadline must be in the future.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Import the service dynamically
      const { LateSubmissionService } = await import('@/apiservices/lateSubmissionService');

      // Create late submission approvals for selected students
      const approvalPromises = selectedStudentIds.map(studentId => {
        const student = students.find(s => s.studentId === studentId);
        if (!student) return Promise.resolve();

        return LateSubmissionService.approveLateSubmission(
          test.id,
          student.studentId,
          student.studentName,
          student.classId,
          student.className,
          deadlineDate,
          teacherId,
          teacherName,
          `Late submission opportunity approved for ${test.title}`
        );
      });

      await Promise.all(approvalPromises);

      console.log('✅ Late submission approvals created for', selectedStudentIds.length, 'students');
      onLateSubmissionApproved();
      onClose();
    } catch (err) {
      console.error('Error approving late submissions:', err);
      setError('Failed to approve late submissions. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Clock className="h-6 w-6 text-orange-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Late Submission Approval
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {test.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Loading student data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Error
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <Button onClick={loadStudentsAndSubmissions} variant="outline">
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Test Status */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Test Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Original Deadline:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatDateTime(getTestDeadline())}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <div className={`font-medium ${isTestExpired() ? 'text-red-600' : 'text-green-600'}`}>
                      {isTestExpired() ? 'Expired' : 'Active'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Students:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {students.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submission Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Submission Summary
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {students.filter(s => s.hasSubmitted).length}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Submitted
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {notSubmittedStudents.length}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Not Submitted
                    </div>
                  </div>
                </div>
              </div>

              {notSubmittedStudents.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    All Students Have Submitted
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    There are no students who need late submission approval.
                  </p>
                </div>
              ) : (
                <>
                  {/* New Deadline Setting */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Set New Deadline
                    </h3>
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <input
                        type="datetime-local"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  </div>

                  {/* Student Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Students Who Haven't Submitted ({notSubmittedStudents.length})
                      </h3>
                      <Button
                        onClick={handleSelectAll}
                        variant="outline"
                        size="sm"
                      >
                        {selectedStudentIds.length === notSubmittedStudents.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {notSubmittedStudents.map((student) => (
                        <div
                          key={student.studentId}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedStudentIds.includes(student.studentId)
                              ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                              : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => handleStudentSelection(student.studentId)}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(student.studentId)}
                              onChange={() => handleStudentSelection(student.studentId)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2">
                              <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {student.studentName}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {student.studentEmail}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                Class: {student.className}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && notSubmittedStudents.length > 0 && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedStudentIds.length} student{selectedStudentIds.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleApproveLateSubmission}
                disabled={submitting || selectedStudentIds.length === 0 || !newDeadline}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Approve Late Submission
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
