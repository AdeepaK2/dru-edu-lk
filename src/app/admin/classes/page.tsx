'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Search, Edit2, Trash2, Plus, XCircle, Users, Clock, Download } from 'lucide-react';
import { ClassDocument, ClassDisplayData, classDocumentToDisplay } from '@/models/classSchema';
import { CenterDocument } from '@/apiservices/centerFirestoreService';
import { SubjectDocument } from '@/models/subjectSchema';
import { TeacherDocument } from '@/models/teacherSchema';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { CenterFirestoreService } from '@/apiservices/centerFirestoreService';
import { SubjectFirestoreService } from '@/apiservices/subjectFirestoreService';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { Button, ConfirmDialog, Input, Select } from '@/components/ui';
import { useCachedData } from '@/hooks/useAdminCache';
import ClassModal from '@/components/modals/ClassModal';
import { ClassData } from '@/models/classSchema';

export default function ClassManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassDisplayData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassDisplayData | null>(null);
  const [classes, setClasses] = useState<ClassDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Cache centers data
  const { data: centers = [] } = useCachedData<CenterDocument[]>(
    'centers',
    async () => {
      return new Promise<CenterDocument[]>((resolve, reject) => {
        const unsubscribe = CenterFirestoreService.subscribeToCenters(
          (centerDocuments: CenterDocument[]) => {
            resolve(centerDocuments);
            unsubscribe();
          },
          (error: Error) => {
            reject(error);
            unsubscribe();
          }
        );
      });
    },
    { ttl: 300 } // Cache for 5 minutes
  );

  // Cache subjects data
  const { data: subjects = [] } = useCachedData<SubjectDocument[]>(
    'subjects',
    async () => {
      return new Promise<SubjectDocument[]>((resolve, reject) => {
        const unsubscribe = SubjectFirestoreService.subscribeToSubjects(
          (subjectDocuments: SubjectDocument[]) => {
            resolve(subjectDocuments);
            unsubscribe();
          },
          (error: Error) => {
            reject(error);
            unsubscribe();
          }
        );
      });
    },
    { ttl: 300 } // Cache for 5 minutes
  );

  // Cache teachers data
  const { data: teachers = [] } = useCachedData<TeacherDocument[]>(
    'teachers',
    async () => {
      return new Promise<TeacherDocument[]>((resolve, reject) => {
        TeacherFirestoreService.getAllTeachers()
          .then(teacherDocuments => {
            resolve(teacherDocuments);
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    { ttl: 300 } // Cache for 5 minutes
  );

  // Real-time subscription to classes data
  useEffect(() => {
    // Wait for centers and teachers to load (arrays can be empty, just check they exist)
    if (centers === undefined || teachers === undefined) {
      console.log('Waiting for centers and teachers to load...');
      return;
    }
    
    console.log('Setting up real-time class subscription for admin...');
    setLoading(true);
    
    const unsubscribe = ClassFirestoreService.subscribeToClasses(
      (classDocuments: ClassDocument[]) => {
        console.log('Admin received class updates:', classDocuments.length);
        const displayClasses = classDocuments.map(doc => {
          const center = centers?.find(c => c.center.toString() === doc.centerId);
          const teacher = teachers?.find(t => t.id === doc.teacherId);
          const coTeacher = teachers?.find(t => t.id === doc.coTeacherId);
          return classDocumentToDisplay(doc, center?.location, teacher?.name, coTeacher?.name);
        });
        setClasses(displayClasses);
        setLoading(false);
        setError(null);
      },
      (error: Error) => {
        console.error('Error in admin class subscription:', error);
        setError(error);
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up admin class subscription');
      unsubscribe();
    };
  }, [centers, teachers]); // Re-subscribe when centers or teachers change

  // Use simple console logging for now
  const showSuccess = (message: string) => console.log('Success:', message);
  const showError = (message: string) => console.error('Error:', message);

  // Handle class deletion
  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    
    setActionLoading('delete');
    
    try {
      await ClassFirestoreService.deleteClass(classToDelete.id);
      showSuccess('Class deleted successfully!');
      setShowDeleteConfirm(false);
      setClassToDelete(null);
      // Real-time subscription will auto-update the list
    } catch (error) {
      console.error('Error deleting class:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete class');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter classes based on search term and filters
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    
    return classes.filter(cls => {
      const matchesSearch = (
        cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.teacher.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.classId.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesSubject = !subjectFilter || cls.subject.toLowerCase() === subjectFilter.toLowerCase();
      const matchesYear = !yearFilter || cls.year === yearFilter;

      return matchesSearch && matchesSubject && matchesYear;
    });
  }, [classes, searchTerm, subjectFilter, yearFilter]);
  // Get unique subjects and years for filters
  const uniqueSubjects = useMemo(() => {
    if (!classes) return [];
    const subjects = new Set(classes.map(cls => cls.subject));
    return Array.from(subjects).sort();
  }, [classes]);

  const uniqueYears = useMemo(() => {
    if (!classes) return [];
    const years = new Set(classes.map(cls => cls.year));
    return Array.from(years).sort();
  }, [classes]);

  // Handle CSV export
  const handleExportCSV = () => {
    if (!filteredClasses.length) {
      showError('No classes to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Class ID',
      'Name',
      'Subject',
      'Year',
      'Teacher',
      'Co-Teacher',
      'Schedule',
      'Students',
      'Status',
      'Center',
      'Session Fee'
    ];

    // Convert data to CSV format
    const csvContent = [
      headers.join(','),
      ...filteredClasses.map(cls => {
        const row = [
          cls.classId,
          cls.name,
          cls.subject,
          cls.year,
          cls.teacher,
          cls.coTeacher || 'N/A',
          `"${cls.schedule}"`, // Wrap in quotes to handle commas in schedule
          cls.students,
          cls.status,
          cls.centerName,
          cls.sessionFee
        ];
        return row.join(',');
      })
    ].join('\n');

    // Create a Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `classes_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle edit button click
  const handleEditClick = (cls: ClassDisplayData) => {
    setSelectedClass(cls);
    setEditMode(true);
    setModalOpen(true);
  };
  // Handle delete button click
  const handleDeleteClick = (cls: ClassDisplayData) => {
    setClassToDelete(cls);
    setShowDeleteConfirm(true);
  };

  // Handle class creation
  const handleCreateClass = async (classData: ClassData) => {
    setActionLoading('create');
    
    try {
      await ClassFirestoreService.createClass(classData);
      showSuccess('Class created successfully!');
      setModalOpen(false);
      setSelectedClass(null);
      setEditMode(false);
      // Real-time subscription will auto-update the list
    } catch (error) {
      console.error('Error creating class:', error);
      showError(error instanceof Error ? error.message : 'Failed to create class');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle class update
  const handleUpdateClass = async (classData: ClassData) => {
    if (!selectedClass) return;
    
    setActionLoading('update');
    
    try {
      await ClassFirestoreService.updateClass(selectedClass.id, classData);
      showSuccess('Class updated successfully!');
      setModalOpen(false);
      setSelectedClass(null);
      setEditMode(false);
      // Real-time subscription will auto-update the list
    } catch (error) {
      console.error('Error updating class:', error);
      showError(error instanceof Error ? error.message : 'Failed to update class');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-primary-600 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-secondary-600 dark:text-secondary-300 font-medium">Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Class Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage class schedules, assignments, and information
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                Total: {classes?.length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="min-w-[150px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Subjects</option>
              {uniqueSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Years</option>
              {uniqueYears.map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </Button>
            <Button
              onClick={() => {
                setSelectedClass(null);
                setEditMode(false);
                setModalOpen(true);
              }}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Class</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map((cls) => (
          <div key={cls.id} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {cls.name}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <BookOpen className="w-4 h-4 mr-2" />
                      <span>{cls.subject} - Year {cls.year}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Users className="w-4 h-4 mr-2" />
                      <span>Teacher: {cls.teacher}</span>
                    </div>
                    {cls.coTeacher && cls.coTeacher !== 'Not Assigned' && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Users className="w-4 h-4 mr-2" />
                        <span>Co-Teacher: {cls.coTeacher}</span>
                      </div>
                    )}                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{cls.schedule}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {cls.classId}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(cls)}
                    disabled={actionLoading === 'update'}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(cls)}
                    disabled={actionLoading === 'delete'}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Location: {cls.centerName}
                  </span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    cls.status === 'Active' 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                  }`}>
                    {cls.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredClasses.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No classes found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm || subjectFilter || yearFilter ? 'Try adjusting your search criteria' : 'Get started by adding a new class'}
          </p>
        </div>      )}

      {/* Add/Edit Class Modal */}
      {modalOpen && (
        <ClassModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedClass(null);
            setEditMode(false);
          }}          onSubmit={editMode ? handleUpdateClass : handleCreateClass}
          loading={actionLoading === 'create' || actionLoading === 'update'}
          title={editMode ? 'Edit Class' : 'Add New Class'}          submitButtonText={editMode ? 'Update Class' : 'Add Class'}
          initialData={editMode ? selectedClass || undefined : undefined}
          centers={centers || []}
          subjects={subjects || []}
          teachers={teachers || []}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && classToDelete && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setClassToDelete(null);
          }}
          onConfirm={handleDeleteClass}
          isLoading={actionLoading === 'delete'}
          title="Delete Class"
          description={`Are you sure you want to delete "${classToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </div>
  );
}
