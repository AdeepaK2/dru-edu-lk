'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Save, 
  AlertCircle,
  Search,
  User,
  CheckCircle,
  UserCheck
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { VideoFirestoreService } from '@/apiservices/videoFirestoreService';
import { StudentFirestoreService, EnhancedStudentListItem } from '@/apiservices/studentFirestoreService';
import { VideoDisplayData } from '@/models/videoSchema';

interface StudentAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  video: VideoDisplayData | null;
  availableClasses: Array<{ id: string; name: string; subjectId: string; }>;
}

export default function StudentAssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  video,
  availableClasses
}: StudentAssignmentModalProps) {
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<EnhancedStudentListItem[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<EnhancedStudentListItem[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<string>('Active');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<'classes' | 'students'>('classes');

  // Initialize assignments when video changes
  useEffect(() => {
    if (video) {
      setSelectedClassIds(video.assignedClasses || []);
      setSelectedStudentIds(video.assignedStudents || []);
    }
  }, [video]);

  // Load all students with enrollments
  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const students = await StudentFirestoreService.getAllStudentsWithEnrollments();
        setAllStudents(students);
        setFilteredStudents(students);
      } catch (err: any) {
        console.error('Error loading students:', err);
        setError('Failed to load students');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadStudents();
    }
  }, [isOpen]);

  // Filter students based on search term, class filter, and enrollment status
  useEffect(() => {
    let filtered = allStudents;

    // Filter by enrollment status
    if (enrollmentStatusFilter !== 'All') {
      filtered = filtered.filter(student => 
        student.enrolledClasses.some(enrollment => enrollment.status === enrollmentStatusFilter)
      );
    }

    // Filter by selected classes
    if (classFilter.length > 0) {
      filtered = filtered.filter(student => 
        student.enrolledClasses.some(enrollment => classFilter.includes(enrollment.classId))
      );
    }

    // Filter by search term
    if (studentSearchTerm) {
      const searchLower = studentSearchTerm.toLowerCase();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        student.id.toLowerCase().includes(searchLower) ||
        student.enrolledClasses.some(enrollment => 
          enrollment.className.toLowerCase().includes(searchLower) ||
          enrollment.subject.toLowerCase().includes(searchLower)
        )
      );
    }

    setFilteredStudents(filtered);
  }, [allStudents, studentSearchTerm, classFilter, enrollmentStatusFilter]);

  const handleClassSelection = (classId: string) => {
    setSelectedClassIds(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleClassFilterToggle = (classId: string) => {
    setClassFilter(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSelectStudentsFromClass = (classId: string) => {
    const studentsInClass = filteredStudents.filter(student =>
      student.enrolledClasses.some(enrollment => 
        enrollment.classId === classId && enrollment.status === 'Active'
      )
    ).map(student => student.id);

    setSelectedStudentIds(prev => {
      const newIds = [...prev];
      studentsInClass.forEach(id => {
        if (!newIds.includes(id)) {
          newIds.push(id);
        }
      });
      return newIds;
    });
  };

  const getStudentsByClass = () => {
    const groupedStudents: Record<string, EnhancedStudentListItem[]> = {};
    
    filteredStudents.forEach(student => {
      student.enrolledClasses.forEach(enrollment => {
        if (enrollment.status === 'Active') {
          if (!groupedStudents[enrollment.classId]) {
            groupedStudents[enrollment.classId] = [];
          }
          if (!groupedStudents[enrollment.classId].some(s => s.id === student.id)) {
            groupedStudents[enrollment.classId].push(student);
          }
        }
      });
    });
    
    return groupedStudents;
  };

  const clearAllFilters = () => {
    setClassFilter([]);
    setEnrollmentStatusFilter('Active');
    setStudentSearchTerm('');
  };

  const handleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllStudents = () => {
    const allFilteredIds = filteredStudents.map(student => student.id);
    const allSelected = allFilteredIds.every(id => selectedStudentIds.includes(id));
    
    if (allSelected) {
      // Deselect all filtered students
      setSelectedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Select all filtered students
      setSelectedStudentIds(prev => {
        const newIds = [...prev];
        allFilteredIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!video) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Update video assignments
      await VideoFirestoreService.updateVideo(video.id, {
        assignedClassIds: selectedClassIds,
        assignedStudentIds: selectedStudentIds
      });
      
      onSuccess();
    } catch (err: any) {
      console.error('Error updating video assignments:', err);
      setError(err.message || 'Failed to update assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError(null);
      setStudentSearchTerm('');
      setClassFilter([]);
      setEnrollmentStatusFilter('Active');
      setViewMode('list');
      onClose();
    }
  };

  if (!isOpen || !video) return null;

  const getClassNameById = (classId: string) => {
    return availableClasses.find(cls => cls.id === classId)?.name || 'Unknown Class';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Assign Students
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {video.title}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Assignment Type Toggle */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setAssignmentType('classes')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                assignmentType === 'classes'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Assign by Classes
            </button>
            <button
              type="button"
              onClick={() => setAssignmentType('students')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                assignmentType === 'students'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Assign Individual Students
            </button>
          </div>

          {/* Simple Student Filters */}
          {assignmentType === 'students' && (
            <div className="flex gap-3 mb-4">
              {/* Student Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search students by name or email..."
                    value={studentSearchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentSearchTerm(e.target.value)}
                    className="pl-10"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Class Filter Dropdown */}
              <div className="w-48">
                <select
                  value={classFilter.length === 1 ? classFilter[0] : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      setClassFilter([value]);
                    } else {
                      setClassFilter([]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
                  disabled={saving}
                >
                  <option value="">All Classes</option>
                  {availableClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              {(classFilter.length > 0 || studentSearchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setClassFilter([]);
                    setStudentSearchTerm('');
                  }}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Class Assignment Section */}
          {assignmentType === 'classes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Select Classes to Assign
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedClassIds.length} selected
                </span>
              </div>
              
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-80 overflow-y-auto">
                {availableClasses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No classes available
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-3">
                    {availableClasses.map(cls => (
                      <label key={cls.id} className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={() => handleClassSelection(cls.id)}
                          disabled={saving}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                          {cls.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Individual Student Assignment Section */}
          {assignmentType === 'students' && (
            <div className="space-y-4">
              {/* Selected Students Summary */}
              {assignmentType === 'students' && selectedStudentIds.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-indigo-900 dark:text-indigo-100">
                      Selected Students ({selectedStudentIds.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIds([])}
                      className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  {/* Group selected students by class */}
                  <div className="space-y-3">
                    {Object.entries(
                      selectedStudentIds.reduce((acc, studentId) => {
                        const student = allStudents.find(s => s.id === studentId);
                        if (student) {
                          student.enrolledClasses
                            .filter(enrollment => enrollment.status === 'Active')
                            .forEach(enrollment => {
                              if (!acc[enrollment.className]) {
                                acc[enrollment.className] = [];
                              }
                              if (!acc[enrollment.className].some(s => s.id === student.id)) {
                                acc[enrollment.className].push(student);
                              }
                            });
                        }
                        return acc;
                      }, {} as Record<string, EnhancedStudentListItem[]>)
                    ).map(([className, students]) => (
                      <div key={className} className="bg-white dark:bg-gray-800 rounded-md p-3 border border-indigo-200 dark:border-indigo-600">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                            {className} ({students.length} student{students.length !== 1 ? 's' : ''})
                          </h5>
                          <button
                            type="button"
                            onClick={() => {
                              const studentIdsToRemove = students.map(s => s.id);
                              setSelectedStudentIds(prev => prev.filter(id => !studentIdsToRemove.includes(id)));
                            }}
                            className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                          >
                            Remove All
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {students.map(student => (
                            <span
                              key={student.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-700 text-indigo-800 dark:text-indigo-200 text-xs rounded-md"
                            >
                              {student.name}
                              <button
                                type="button"
                                onClick={() => handleStudentSelection(student.id)}
                                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-100 ml-1 font-bold"
                                title="Remove student"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Individual Students
                </h3>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredStudents.length} shown, {selectedStudentIds.length} selected
                  </span>
                  {classFilter.length === 1 && assignmentType === 'students' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectStudentsFromClass(classFilter[0])}
                      disabled={saving}
                      className="text-xs"
                    >
                      Select All from This Class
                    </Button>
                  )}
                </div>
              </div>

              {/* Student Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search students by name, email, or class..."
                  value={studentSearchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={saving || assignmentType !== 'students'}
                />
              </div>

              {/* Simple Class Filter */}
              {assignmentType === 'students' && classFilter.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Filtered by: {availableClasses.find(cls => cls.id === classFilter[0])?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setClassFilter([])}
                      className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                    >
                      Clear filter
                    </button>
                  </div>
                </div>
              )}

              {/* Select All Button & View Mode Toggle */}
              {filteredStudents.length > 0 && assignmentType === 'students' && (
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllStudents}
                    disabled={saving}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {filteredStudents.every(student => selectedStudentIds.includes(student.id))
                      ? 'Deselect All Filtered'
                      : 'Select All Filtered'
                    } ({filteredStudents.length})
                  </Button>
                  
                  {/* View Mode Toggle */}
                  <div className="flex border border-gray-300 dark:border-gray-600 rounded-md">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-2 text-xs transition-colors ${
                        viewMode === 'list'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                          : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      disabled={saving}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grouped')}
                      className={`px-3 py-2 text-xs border-l border-gray-300 dark:border-gray-600 transition-colors ${
                        viewMode === 'grouped'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                          : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      disabled={saving}
                    >
                      By Class
                    </button>
                  </div>
                </div>
              )}

              {/* Students List/Grouped View */}
              <div className="border border-gray-300 dark:border-gray-600 rounded-md max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading students...</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {studentSearchTerm || classFilter.length > 0 || enrollmentStatusFilter !== 'Active' 
                        ? 'No students found matching your filters' 
                        : 'No students available'}
                    </p>
                  </div>
                ) : viewMode === 'list' ? (
                  // List View
                  <div className="p-3 space-y-2">
                    {filteredStudents.map(student => (
                      <label key={student.id} className={`flex items-start p-3 rounded-lg cursor-pointer transition-colors border ${
                        selectedStudentIds.includes(student.id)
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
                      }`}>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => handleStudentSelection(student.id)}
                          disabled={saving || assignmentType !== 'students'}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1 flex-shrink-0"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                selectedStudentIds.includes(student.id)
                                  ? 'bg-indigo-100 dark:bg-indigo-900/40'
                                  : 'bg-blue-100 dark:bg-blue-900/20'
                              }`}>
                                <User className={`w-4 h-4 ${
                                  selectedStudentIds.includes(student.id)
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {student.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {student.email}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                              student.status === 'Active' 
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                : student.status === 'Suspended'
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                            }`}>
                              {student.status}
                            </span>
                          </div>
                          
                          {/* Enrolled Classes - Enhanced */}
                          {student.enrolledClasses.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Enrolled in {student.enrolledClasses.filter(e => e.status === 'Active').length} class{student.enrolledClasses.filter(e => e.status === 'Active').length !== 1 ? 'es' : ''}:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {student.enrolledClasses
                                  .filter(enrollment => enrollment.status === 'Active')
                                  .slice(0, 4)
                                  .map(enrollment => (
                                  <span
                                    key={enrollment.classId}
                                    className={`inline-flex px-2 py-1 text-xs rounded-md ${
                                      classFilter.includes(enrollment.classId)
                                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-600'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                    title={`${enrollment.className} - ${enrollment.subject}`}
                                  >
                                    {enrollment.className}
                                  </span>
                                ))}
                                {student.enrolledClasses.filter(e => e.status === 'Active').length > 4 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                                    +{student.enrolledClasses.filter(e => e.status === 'Active').length - 4} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  // Grouped View
                  <div className="p-3 space-y-4">
                    {Object.entries(getStudentsByClass()).map(([classId, classStudents]) => {
                      const className = availableClasses.find(cls => cls.id === classId)?.name || 'Unknown Class';
                      const selectedInClass = classStudents.filter(s => selectedStudentIds.includes(s.id)).length;
                      
                      return (
                        <div key={classId} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                {className}
                              </h4>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({classStudents.length} student{classStudents.length !== 1 ? 's' : ''})
                              </span>
                              {selectedInClass > 0 && (
                                <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 rounded-full">
                                  {selectedInClass} selected
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectStudentsFromClass(classId)}
                                disabled={saving}
                                className="text-xs"
                              >
                                {selectedInClass === classStudents.length ? 'Deselect All' : 'Select All'}
                              </Button>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            {classStudents.map(student => (
                              <label key={student.id} className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                                selectedStudentIds.includes(student.id)
                                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-600'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(student.id)}
                                  onChange={() => handleStudentSelection(student.id)}
                                  disabled={saving || assignmentType !== 'students'}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <div className="ml-3 flex items-center space-x-3 flex-1 min-w-0">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    selectedStudentIds.includes(student.id)
                                      ? 'bg-indigo-100 dark:bg-indigo-900/40'
                                      : 'bg-blue-100 dark:bg-blue-900/20'
                                  }`}>
                                    <User className={`w-3 h-3 ${
                                      selectedStudentIds.includes(student.id)
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                    }`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {student.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {student.email}
                                    </p>
                                  </div>
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    student.status === 'Active' 
                                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                      : student.status === 'Suspended'
                                      ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {student.status}
                                  </span>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Assignment Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Classes assigned:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {selectedClassIds.length}
                  </span>
                </div>
                {selectedClassIds.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 pl-2 border-l-2 border-gray-200 dark:border-gray-600">
                    {selectedClassIds.map(id => getClassNameById(id)).join(', ')}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Individual students:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {selectedStudentIds.length}
                  </span>
                </div>
                {assignmentType === 'students' && filteredStudents.length !== allStudents.length && (
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Filtered: {filteredStudents.length} of {allStudents.length} total students
                  </div>
                )}
              </div>
            </div>
            
            {/* Active Filters Summary */}
            {assignmentType === 'students' && (classFilter.length > 0 || enrollmentStatusFilter !== 'Active' || studentSearchTerm) && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Active filters:</p>
                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {classFilter.length > 0 && (
                    <div>• Classes: {classFilter.map(id => getClassNameById(id)).join(', ')}</div>
                  )}
                  {enrollmentStatusFilter !== 'Active' && (
                    <div>• Status: {enrollmentStatusFilter}</div>
                  )}
                  {studentSearchTerm && (
                    <div>• Search: "{studentSearchTerm}"</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Assignments'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
