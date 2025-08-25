'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, Mail, School, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { StudentTestAssignmentService, StudentTestAssignmentDocument } from '@/apiservices/studentTestAssignmentService';
import { Test } from '@/models/testSchema';

interface ViewAssignedStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
}

export default function ViewAssignedStudentsModal({
  isOpen,
  onClose,
  test
}: ViewAssignedStudentsModalProps) {
  const [assignments, setAssignments] = useState<StudentTestAssignmentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && test.id) {
      loadAssignments();
    }
  }, [isOpen, test.id]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const testAssignments = await StudentTestAssignmentService.getTestAssignments(test.id);
      setAssignments(testAssignments);
      
      console.log('✅ Loaded assignments for test:', testAssignments.length);
    } catch (err) {
      console.error('Error loading test assignments:', err);
      setError('Failed to load student assignments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
      case 'started':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
            <Clock className="h-3 w-3 mr-1" />
            Assigned
          </span>
        );
    }
  };

  const formatDateTime = (timestamp: any) => {
    let date: Date;
    
    // Handle Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    }
    // Handle plain Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    // Handle number (milliseconds)
    else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    // Handle Firestore Timestamp object structure
    else if (timestamp && timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    // Handle string
    else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    }
    // Fallback
    else {
      date = new Date();
    }
    
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group assignments by student to get unique students with their classes
  const studentAssignments = assignments.reduce((acc, assignment) => {
    if (!acc[assignment.studentId]) {
      acc[assignment.studentId] = {
        studentId: assignment.studentId,
        studentName: assignment.studentName,
        studentEmail: assignment.studentEmail,
        classes: [],
        statuses: [],
        assignedAt: assignment.assignedAt,
        assignedByName: assignment.assignedByName
      };
    }
    
    acc[assignment.studentId].classes.push({
      classId: assignment.classId,
      className: assignment.className,
      status: assignment.status
    });
    
    acc[assignment.studentId].statuses.push(assignment.status);
    
    return acc;
  }, {} as Record<string, { 
    studentId: string;
    studentName: string;
    studentEmail: string;
    classes: Array<{classId: string; className: string; status: string}>;
    statuses: string[];
    assignedAt: any;
    assignedByName: string;
  }>);

  const uniqueStudents = Object.values(studentAssignments);

  const getStatusCounts = () => {
    // Count unique students, not assignments
    const uniqueStudentStatuses = uniqueStudents.map(student => {
      // Determine overall status based on all assignments for this student
      if (student.statuses.some(status => status === 'completed')) {
        return 'completed';
      } else if (student.statuses.some(status => status === 'started')) {
        return 'started';
      } else if (student.statuses.some(status => status === 'expired')) {
        return 'expired';
      } else {
        return 'assigned';
      }
    });

    const counts = {
      assigned: uniqueStudentStatuses.filter(status => status === 'assigned').length,
      started: uniqueStudentStatuses.filter(status => status === 'started').length,
      completed: uniqueStudentStatuses.filter(status => status === 'completed').length,
      expired: uniqueStudentStatuses.filter(status => status === 'expired').length
    };
    return counts;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Assigned Students
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Loading assigned students...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Error Loading Students
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={loadAssignments}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : uniqueStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Students Assigned
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                This test has no individual student assignments.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Statistics */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Assignment Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(() => {
                    const counts = getStatusCounts();
                    return (
                      <>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {uniqueStudents.length}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Total Assigned
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {counts.completed}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Completed
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {counts.started}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            In Progress
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-600">
                            {counts.assigned}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Not Started
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Students List */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Assigned Students
                </h4>
                
                <div className="space-y-3">
                  {uniqueStudents.map((student) => {
                    // Determine overall status for this student
                    const overallStatus = student.statuses.some(status => status === 'completed') 
                      ? 'completed' 
                      : student.statuses.some(status => status === 'started')
                      ? 'started'
                      : student.statuses.some(status => status === 'expired')
                      ? 'expired'
                      : 'assigned';

                    return (
                      <div
                        key={student.studentId}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2">
                              <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white mb-1">
                                {student.studentName}
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                                <Mail className="h-3 w-3" />
                                <span>{student.studentEmail}</span>
                              </div>
                              
                              {/* Student's Classes */}
                              <div className="mt-2">
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  Registered Classes:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {student.classes.map((classInfo) => (
                                    <span
                                      key={classInfo.classId}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                    >
                                      <School className="h-3 w-3 mr-1" />
                                      {classInfo.className}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end space-y-2">
                            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                              <div>Assigned: {formatDateTime(student.assignedAt)}</div>
                              <div>By: {student.assignedByName}</div>
                            </div>
                            {getStatusBadge(overallStatus)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
