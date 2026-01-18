'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Save,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  HomeworkFirestoreService, 
  HomeworkDocument,
  HomeworkSubmissionData,
  HomeworkSubmissionDocument 
} from '@/apiservices/homeworkFirestoreService';
import { StudentEnrollmentFirestoreService } from '@/apiservices/studentEnrollmentFirestoreService';

interface MarkHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  homework: HomeworkDocument;
  classId: string;
}

interface StudentSubmission {
  studentId: string;
  studentName: string;
  status: 'submitted' | 'not_submitted' | 'late' | 'excused';
  marks?: number;
  remarks?: string;
  isChanged: boolean;
}

const MarkHomeworkModal: React.FC<MarkHomeworkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  homework,
  classId
}) => {
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (isOpen && homework) {
      loadStudentsAndSubmissions();
    }
  }, [isOpen, homework]);

  const loadStudentsAndSubmissions = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load enrolled students
      const enrollments = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(classId);
      
      // Load existing submissions
      const existingSubmissions = await HomeworkFirestoreService.getSubmissions(homework.id);
      const submissionMap = new Map(existingSubmissions.map(s => [s.studentId, s]));

      // Merge into student list
      const studentList: StudentSubmission[] = enrollments.map((enrollment: { studentId: string; studentName: string }) => {
        const existing = submissionMap.get(enrollment.studentId);
        return {
          studentId: enrollment.studentId,
          studentName: enrollment.studentName,
          status: existing?.status || 'not_submitted',
          marks: existing?.marks,
          remarks: existing?.remarks,
          isChanged: false,
        };
      });

      // Sort by name
      studentList.sort((a, b) => a.studentName.localeCompare(b.studentName));
      setStudents(studentList);
    } catch (err) {
      console.error('Error loading students:', err);
      setError('Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: StudentSubmission['status']) => {
    setStudents(prev => prev.map(s => 
      s.studentId === studentId 
        ? { ...s, status, isChanged: true }
        : s
    ));
  };

  const handleMarksChange = (studentId: string, marks: string) => {
    const marksValue = marks === '' ? undefined : parseInt(marks);
    setStudents(prev => prev.map(s => 
      s.studentId === studentId 
        ? { ...s, marks: marksValue, isChanged: true }
        : s
    ));
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setStudents(prev => prev.map(s => 
      s.studentId === studentId 
        ? { ...s, remarks, isChanged: true }
        : s
    ));
  };

  const handleMarkAllAs = (status: StudentSubmission['status']) => {
    setStudents(prev => prev.map(s => ({ ...s, status, isChanged: true })));
  };

  const handleSelectAllToggle = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      handleMarkAllAs('submitted');
    } else {
      handleMarkAllAs('not_submitted');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');

      // Only save changed submissions
      const changedSubmissions = students.filter(s => s.isChanged);
      
      if (changedSubmissions.length === 0) {
        onSave();
        return;
      }

      const submissions: HomeworkSubmissionData[] = changedSubmissions.map(s => ({
        studentId: s.studentId,
        studentName: s.studentName,
        status: s.status,
        marks: s.marks,
        remarks: s.remarks,
        markedBy: 'teacher', // Should come from auth
      }));

      await HomeworkFirestoreService.bulkMarkSubmissions(homework.id, submissions, 'teacher');
      onSave();
    } catch (err) {
      console.error('Error saving submissions:', err);
      setError('Failed to save submissions');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: StudentSubmission['status']) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'late':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'excused':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const changedCount = students.filter(s => s.isChanged).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Mark Submissions</h2>
            <p className="text-sm text-gray-500">{homework.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMarkAllAs('submitted')}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                All Submitted
              </button>
              <button
                onClick={() => handleMarkAllAs('not_submitted')}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
              >
                <XCircle className="w-3 h-3 mr-1" />
                All Missing
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Student List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">Loading students...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No students found
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <div
                  key={student.studentId}
                  className={`border rounded-lg p-4 transition-colors ${
                    student.isChanged ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Student Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{student.studentName}</p>
                    </div>

                    {/* Status Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStatusChange(student.studentId, 'submitted')}
                        className={`p-2 rounded-lg transition-colors ${
                          student.status === 'submitted'
                            ? 'bg-green-100 text-green-700'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title="Submitted"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, 'late')}
                        className={`p-2 rounded-lg transition-colors ${
                          student.status === 'late'
                            ? 'bg-amber-100 text-amber-700'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title="Late"
                      >
                        <Clock className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, 'not_submitted')}
                        className={`p-2 rounded-lg transition-colors ${
                          student.status === 'not_submitted'
                            ? 'bg-red-100 text-red-700'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title="Not Submitted"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, 'excused')}
                        className={`p-2 rounded-lg transition-colors ${
                          student.status === 'excused'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title="Excused"
                      >
                        <AlertCircle className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Marks (if applicable) */}
                    {homework.maxMarks && (
                      <div className="w-24">
                        <input
                          type="number"
                          value={student.marks ?? ''}
                          onChange={(e) => handleMarksChange(student.studentId, e.target.value)}
                          placeholder={`/ ${homework.maxMarks}`}
                          min="0"
                          max={homework.maxMarks}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Remarks (expandable) */}
                  <div className="mt-2">
                    <input
                      type="text"
                      value={student.remarks || ''}
                      onChange={(e) => handleRemarksChange(student.studentId, e.target.value)}
                      placeholder="Add remark (optional)..."
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {changedCount > 0 && (
              <span className="text-indigo-600 font-medium">
                {changedCount} student{changedCount > 1 ? 's' : ''} modified
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || changedCount === 0}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkHomeworkModal;
