'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Search, 
  Filter,
  User,
  CheckCircle,
  UserCheck,
  Book,
  Mail,
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { StudentFirestoreService, EnhancedStudentListItem } from '@/apiservices/studentFirestoreService';
import { StudentTestAssignment, StudentAssignmentSummary } from '@/models/testAssignmentSchema';
import { Timestamp } from 'firebase/firestore';

interface StudentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (assignments: StudentTestAssignment[], summary: StudentAssignmentSummary) => void;
  teacherId: string;
  teacherName: string;
  availableClasses: Array<{
    id: string;
    name: string;
    subject: string;
    year: string;
    subjectId: string;
  }>;
  title?: string;
  description?: string;
}

export default function StudentSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  teacherId,
  teacherName,
  availableClasses,
  title = "Select Students for Test",
  description = "Choose individual students from your classes to assign this test"
}: StudentSelectionModalProps) {
  // State management
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<EnhancedStudentListItem[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<EnhancedStudentListItem[]>([]);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [selectedClassForViewing, setSelectedClassForViewing] = useState<string>(''); // New: for class dropdown selection
  
  // UI state
  const [viewMode, setViewMode] = useState<'list' | 'grouped' | 'class-view'>('class-view'); // New view mode
  const [expandedClasses, setExpandedClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlySelectedClasses, setShowOnlySelectedClasses] = useState(false);
  
  // Get students for selected class (for class-view mode)
  const studentsInSelectedClass = React.useMemo(() => {
    if (!selectedClassForViewing || viewMode !== 'class-view') return [];
    
    return allStudents.filter(student => 
      student.enrolledClasses.some(enrollment => 
        enrollment.classId === selectedClassForViewing && 
        enrollment.status === 'Active'
      )
    ).filter(student => {
      // Apply search filter
      if (searchTerm) {
        return student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
               student.id.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [allStudents, selectedClassForViewing, viewMode, searchTerm]);

  // Load students when modal opens
  useEffect(() => {
    if (isOpen) {
      loadStudents();
      // Set first class as default selection for class-view mode
      if (availableClasses.length > 0) {
        setSelectedClassForViewing(availableClasses[0].id);
      }
      // Expand all classes by default for better UX (for grouped view)
      setExpandedClasses(availableClasses.map(cls => cls.id));
    }
  }, [isOpen]);

  // Filter students based on criteria
  useEffect(() => {
    applyFilters();
  }, [allStudents, searchTerm, classFilter, statusFilter, subjectFilter]);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const students = await StudentFirestoreService.getAllStudentsWithEnrollments();
      
      // Filter to only include students from teacher's classes
      const teacherClassIds = availableClasses.map(cls => cls.id);
      const filteredStudents = students.filter(student => 
        student.enrolledClasses.some(enrollment => 
          teacherClassIds.includes(enrollment.classId) && 
          enrollment.status === 'Active'
        )
      );
      
      setAllStudents(filteredStudents);
      console.log('✅ Loaded students for teacher classes:', filteredStudents.length);
    } catch (err) {
      console.error('Error loading students:', err);
      setError('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allStudents];

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        student.enrolledClasses.some(enrollment => 
          enrollment.className.toLowerCase().includes(searchLower) ||
          enrollment.subject.toLowerCase().includes(searchLower)
        )
      );
    }

    // Filter by class
    if (classFilter.length > 0) {
      filtered = filtered.filter(student => 
        student.enrolledClasses.some(enrollment => 
          classFilter.includes(enrollment.classId)
        )
      );
    }

    // Filter by enrollment status
    if (statusFilter !== 'All') {
      filtered = filtered.filter(student => 
        student.enrolledClasses.some(enrollment => 
          enrollment.status === statusFilter
        )
      );
    }

    // Filter by subject
    if (subjectFilter) {
      filtered = filtered.filter(student => 
        student.enrolledClasses.some(enrollment => 
          enrollment.subject === subjectFilter
        )
      );
    }

    setFilteredStudents(filtered);
  };

  // Handle student selection
  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Select all students in a class
  const handleSelectClass = (classId: string) => {
    const studentsInClass = filteredStudents
      .filter(student => 
        student.enrolledClasses.some(enrollment => 
          enrollment.classId === classId && enrollment.status === 'Active'
        )
      )
      .map(student => student.id);

    const allSelected = studentsInClass.every(id => selectedStudentIds.includes(id));
    
    if (allSelected) {
      // Deselect all students in this class
      setSelectedStudentIds(prev => prev.filter(id => !studentsInClass.includes(id)));
    } else {
      // Select all students in this class
      setSelectedStudentIds(prev => {
        const newIds = [...prev];
        studentsInClass.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  // Select all visible students
  const handleSelectAll = () => {
    const allVisibleIds = filteredStudents.map(student => student.id);
    const allSelected = allVisibleIds.every(id => selectedStudentIds.includes(id));
    
    if (allSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !allVisibleIds.includes(id)));
    } else {
      setSelectedStudentIds(prev => {
        const newIds = [...prev];
        allVisibleIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  // Toggle class expansion
  const handleClassToggle = (classId: string) => {
    setExpandedClasses(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  // Expand/collapse all classes
  const handleToggleAllClasses = () => {
    if (expandedClasses.length === availableClasses.length) {
      setExpandedClasses([]); // Collapse all
    } else {
      setExpandedClasses(availableClasses.map(cls => cls.id)); // Expand all
    }
  };

  // Select all students from all classes
  const handleSelectAllClasses = () => {
    const allStudentIds = allStudents.map(s => s.id);
    const allSelected = allStudentIds.every(id => selectedStudentIds.includes(id));
    
    if (allSelected) {
      setSelectedStudentIds([]); // Deselect all
    } else {
      setSelectedStudentIds(allStudentIds); // Select all
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setClassFilter([]);
    setStatusFilter('Active');
    setSubjectFilter('');
  };

  // Generate student assignments and summary
  const generateAssignments = (): { assignments: StudentTestAssignment[], summary: StudentAssignmentSummary } => {
    const assignments: StudentTestAssignment[] = [];
    const byClass: Record<string, { className: string; studentCount: number; students: Array<{ id: string; name: string; email: string; }>; }> = {};

    selectedStudentIds.forEach(studentId => {
      const student = allStudents.find(s => s.id === studentId);
      if (student) {
        // For each enrollment, create an assignment
        student.enrolledClasses
          .filter(enrollment => 
            availableClasses.some(cls => cls.id === enrollment.classId) && 
            enrollment.status === 'Active'
          )
          .forEach(enrollment => {
            assignments.push({
              studentId: student.id,
              studentName: student.name,
              studentEmail: student.email,
              classId: enrollment.classId,
              className: enrollment.className,
              assignedAt: Timestamp.now(),
              assignedBy: teacherId,
              status: 'assigned'
            });

            // Update summary
            if (!byClass[enrollment.classId]) {
              byClass[enrollment.classId] = {
                className: enrollment.className,
                studentCount: 0,
                students: []
              };
            }
            
            // Avoid duplicates in summary
            if (!byClass[enrollment.classId].students.some(s => s.id === student.id)) {
              byClass[enrollment.classId].studentCount += 1;
              byClass[enrollment.classId].students.push({
                id: student.id,
                name: student.name,
                email: student.email
              });
            }
          });
      }
    });

    return {
      assignments,
      summary: {
        totalStudents: selectedStudentIds.length,
        byClass,
        assignmentType: 'student-based'
      }
    };
  };

  // Handle confirmation
  const handleConfirm = () => {
    if (selectedStudentIds.length === 0) {
      setError('Please select at least one student');
      return;
    }

    const { assignments, summary } = generateAssignments();
    onConfirm(assignments, summary);
  };

  // Get students grouped by class
  const getStudentsByClass = () => {
    const grouped: Record<string, EnhancedStudentListItem[]> = {};
    
    filteredStudents.forEach(student => {
      student.enrolledClasses
        .filter(enrollment => 
          availableClasses.some(cls => cls.id === enrollment.classId) && 
          enrollment.status === 'Active'
        )
        .forEach(enrollment => {
          if (!grouped[enrollment.classId]) {
            grouped[enrollment.classId] = [];
          }
          if (!grouped[enrollment.classId].some(s => s.id === student.id)) {
            grouped[enrollment.classId].push(student);
          }
        });
    });

    return grouped;
  };

  // Get unique subjects for filter
  const getUniqueSubjects = () => {
    const subjects = new Set<string>();
    allStudents.forEach(student => {
      student.enrolledClasses.forEach(enrollment => {
        subjects.add(enrollment.subject);
      });
    });
    return Array.from(subjects).sort();
  };

  if (!isOpen) return null;

  const studentsByClass = getStudentsByClass();
  const uniqueSubjects = getUniqueSubjects();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Class Selection Dropdown (for class-view mode) */}
            {viewMode === 'class-view' ? (
              <div className="relative">
                <Book className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedClassForViewing}
                  onChange={(e) => setSelectedClassForViewing(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Select a class to view students...</option>
                  {availableClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.subject} ({cls.year})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Subjects</option>
                {uniqueSubjects.map(subject => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            )}

            {/* View Mode - Make Class View default */}
            <div className="flex">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'list' | 'grouped' | 'class-view')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="class-view">📚 Select Class & View Students</option>
                <option value="grouped">�️ View All Classes</option>
                <option value="list">📋 List All Students</option>
              </select>
            </div>

            {/* Clear Filters */}
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Clear Filters
            </button>
          </div>

          {/* Selection Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {selectedStudentIds.length} students selected
              </span>
              {viewMode === 'class-view' && selectedClassForViewing && studentsInSelectedClass.length > 0 && (
                <button
                  onClick={() => {
                    const studentsInClass = studentsInSelectedClass.map(s => s.id);
                    const allSelected = studentsInClass.every(id => selectedStudentIds.includes(id));
                    
                    if (allSelected) {
                      setSelectedStudentIds(prev => prev.filter(id => !studentsInClass.includes(id)));
                    } else {
                      setSelectedStudentIds(prev => {
                        const newIds = [...prev];
                        studentsInClass.forEach(id => {
                          if (!newIds.includes(id)) {
                            newIds.push(id);
                          }
                        });
                        return newIds;
                      });
                    }
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {studentsInSelectedClass.every(s => selectedStudentIds.includes(s.id)) && studentsInSelectedClass.length > 0
                    ? 'Deselect All' 
                    : `Select All ${studentsInSelectedClass.length}`
                  }
                </button>
              )}
              {viewMode !== 'class-view' && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length 
                     ? 'Deselect All Visible' : 'Select All Visible'}
                </button>
              )}
            </div>
            
            {/* Clear All Control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedStudentIds([])}
                className="px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                Clear All
              </button>
              
              {viewMode === 'grouped' && (
                <button
                  onClick={handleToggleAllClasses}
                  className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {expandedClasses.length === availableClasses.length ? 'Collapse All' : 'Expand All'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-300px)]">
          {/* Selection Summary Banner */}
          {selectedStudentIds.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                    <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-green-900 dark:text-green-100">
                      {selectedStudentIds.length} Student{selectedStudentIds.length !== 1 ? 's' : ''} Selected
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {Object.keys(
                        selectedStudentIds.reduce((acc: Record<string, boolean>, studentId: string) => {
                          const student = allStudents.find(s => s.id === studentId);
                          if (student) {
                            student.enrolledClasses.forEach(enrollment => {
                              if (availableClasses.find(cls => cls.id === enrollment.classId)) {
                                acc[enrollment.classId] = true;
                              }
                            });
                          }
                          return acc;
                        }, {})
                      ).length} class{Object.keys(
                        selectedStudentIds.reduce((acc: Record<string, boolean>, studentId: string) => {
                          const student = allStudents.find(s => s.id === studentId);
                          if (student) {
                            student.enrolledClasses.forEach(enrollment => {
                              if (availableClasses.find(cls => cls.id === enrollment.classId)) {
                                acc[enrollment.classId] = true;
                              }
                            });
                          }
                          return acc;
                        }, {})
                      ).length !== 1 ? 'es' : ''} will be affected by this test assignment
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudentIds([])}
                  className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Loading students...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={loadStudents}
                className="mt-2 px-4 py-2 text-sm text-blue-600 hover:underline"
              >
                Try Again
              </button>
            </div>
          ) : filteredStudents.length === 0 && viewMode !== 'class-view' ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No students found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-6">
              {viewMode === 'class-view' ? (
                // Class View Mode - Simple class selection and student display
                selectedClassForViewing && studentsInSelectedClass.length > 0 ? (
                  <div className="space-y-2">
                    {studentsInSelectedClass.map(student => (
                      <div
                        key={student.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedStudentIds.includes(student.id)
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600'
                            : 'border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => handleStudentToggle(student.id)}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
                          selectedStudentIds.includes(student.id) ? 'bg-blue-600' : 'bg-gray-400'
                        }`}>
                          {selectedStudentIds.includes(student.id) ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {student.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                            {student.email}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ID: {student.id}
                          </span>
                          {selectedStudentIds.includes(student.id) && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                              ✓ Selected
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : selectedClassForViewing ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm 
                        ? `No students found matching "${searchTerm}" in this class`
                        : 'No students found in this class'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Book className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select a Class to View Students
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Choose a class from the dropdown above to see all students
                    </p>
                  </div>
                )
              ) : viewMode === 'grouped' ? (
                // Grouped view by class
                Object.entries(studentsByClass).map(([classId, students]) => {
                  const classInfo = availableClasses.find(cls => cls.id === classId);
                  if (!classInfo) return null;

                  const studentsInClass = students.map(s => s.id);
                  const selectedInClass = studentsInClass.filter(id => selectedStudentIds.includes(id));
                  const isExpanded = expandedClasses.includes(classId);

                  return (
                    <div key={classId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Class Header */}
                      <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${
                        selectedInClass.length > 0 
                          ? 'bg-blue-50 dark:bg-blue-900/20' 
                          : 'bg-gray-50 dark:bg-gray-700/50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleClassToggle(classId)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className={`p-2 rounded-full ${
                              selectedInClass.length > 0 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-400 text-white'
                            }`}>
                              <Book className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium text-gray-900 dark:text-white">
                                  {classInfo.name}
                                </h3>
                                {selectedInClass.length === studentsInClass.length && studentsInClass.length > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                    All Selected
                                  </span>
                                )}
                                {selectedInClass.length > 0 && selectedInClass.length < studentsInClass.length && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    Partially Selected
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {classInfo.subject} • {classInfo.year} • {students.length} students
                              </p>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className={`text-xs font-medium ${
                                  selectedInClass.length > 0 
                                    ? 'text-blue-600 dark:text-blue-400' 
                                    : 'text-gray-600 dark:text-gray-300'
                                }`}>
                                  {selectedInClass.length}/{studentsInClass.length} selected
                                </span>
                                {selectedInClass.length > 0 && (
                                  <span className="text-xs text-green-600 dark:text-green-400">
                                    ✓ {selectedInClass.length} student{selectedInClass.length !== 1 ? 's' : ''} will receive this test
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleSelectClass(classId)}
                              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                                selectedInClass.length === studentsInClass.length
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30'
                                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30'
                              }`}
                            >
                              {selectedInClass.length === studentsInClass.length ? (
                                <span className="flex items-center">
                                  <X className="h-3 w-3 mr-1" />
                                  Deselect All
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Select All ({studentsInClass.length})
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Students List */}
                      {isExpanded && (
                        <div className="p-4">
                          {students.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                              <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                              <p>No students found in this class</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {students.map(student => (
                                <div
                                  key={student.id}
                                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                    selectedStudentIds.includes(student.id)
                                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 shadow-md transform scale-[1.02]'
                                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                                  }`}
                                  onClick={() => handleStudentToggle(student.id)}
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
                                      selectedStudentIds.includes(student.id) ? 'bg-blue-600' : 'bg-gray-400'
                                    }`}>
                                      {selectedStudentIds.includes(student.id) ? (
                                        <CheckCircle className="h-4 w-4" />
                                      ) : (
                                        <User className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 dark:text-white truncate">
                                        {student.name}
                                      </p>
                                      <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                        {student.email}
                                      </p>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          ID: {student.id}
                                        </span>
                                        {selectedStudentIds.includes(student.id) && (
                                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                            ✓ Selected
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // List view
                <div className="space-y-2">
                  {filteredStudents.map(student => (
                    <div
                      key={student.id}
                      className={`p-4 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer transition-colors ${
                        selectedStudentIds.includes(student.id)
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handleStudentToggle(student.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${
                            selectedStudentIds.includes(student.id) ? 'bg-blue-600' : 'bg-gray-400'
                          }`}>
                            {selectedStudentIds.includes(student.id) ? (
                              <CheckCircle className="h-6 w-6" />
                            ) : (
                              <User className="h-6 w-6" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {student.name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                              <Mail className="h-4 w-4 mr-1" />
                              {student.email}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              {student.enrolledClasses
                                .filter(enrollment => 
                                  availableClasses.some(cls => cls.id === enrollment.classId) && 
                                  enrollment.status === 'Active'
                                )
                                .map((enrollment, index) => (
                                  <span key={index} className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                                    {enrollment.className}
                                  </span>
                                ))
                              }
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {student.id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <strong>{selectedStudentIds.length}</strong> students selected
            {selectedStudentIds.length > 0 && (
              <span className="ml-2">
                across {Object.keys(generateAssignments().summary.byClass).length} class{Object.keys(generateAssignments().summary.byClass).length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedStudentIds.length === 0}
              className={`px-6 py-2 rounded-lg font-medium ${
                selectedStudentIds.length === 0
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Continue with {selectedStudentIds.length} Student{selectedStudentIds.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
