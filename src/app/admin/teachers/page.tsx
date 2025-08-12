'use client';

import React, { useState, useMemo } from 'react';
import { UserPlus, Users, Search, Edit2, Trash2, GraduationCap, XCircle } from 'lucide-react';
import { Teacher, TeacherDocument, TeacherData } from '@/models/teacherSchema';
import { firestore } from '@/utils/firebase-client';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Button, ConfirmDialog, Input } from '@/components/ui';
import { useToast } from '@/components/ui';
import TeacherModal from '@/components/modals/TeacherModal';
import { useCachedData } from '@/hooks/useAdminCache';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { getMultipleTeacherClassCounts } from '@/utils/teacher-class-utils';

export default function TeacherManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherDocument | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<TeacherDocument | null>(null);
  const [localTeachers, setLocalTeachers] = useState<TeacherDocument[]>([]);
  const [actualClassCounts, setActualClassCounts] = useState<Record<string, number>>({});

  // Use toast for user feedback
  const { showToast } = useToast();

  // Use cached data hook for efficient data management
  const { data: teachers = [], loading, error, refetch, invalidate } = useCachedData<TeacherDocument[]>(
    'teachers',
    async () => {
      return new Promise<TeacherDocument[]>((resolve, reject) => {
        const teachersQuery = query(
          collection(firestore, 'teachers'),
          orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
          teachersQuery,
          (snapshot) => {
            const teachersData: TeacherDocument[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              teachersData.push({
                id: doc.id,
                ...data,
              } as TeacherDocument);
            });
            resolve(teachersData);
            unsubscribe(); // Unsubscribe after first load for caching
          },
          (error) => {
            reject(error);
            unsubscribe();
          }
        );
      });
    },
    { ttl: 120 } // Cache for 2 minutes
  );

  // Sync cached data with local state (but don't override user actions)
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(0);
  
  React.useEffect(() => {
    if (teachers && teachers.length > 0) {
      // Only sync if this is initial load or if we haven't made recent changes
      const now = Date.now();
      if (now - lastSyncTimestamp > 1000) { // Wait 1 second after last user action
        console.log('Syncing cached data with local state');
        setLocalTeachers(teachers);
        
        // Load actual class counts for all teachers
        loadActualClassCounts(teachers);
      }
    }
  }, [teachers, lastSyncTimestamp]);

  // Load actual class counts for all teachers
  const loadActualClassCounts = async (teachersList: TeacherDocument[]) => {
    try {
      console.log('🔍 Loading actual class counts for', teachersList.length, 'teachers');
      
      // Use utility function for better performance
      const teacherIds = teachersList.map(t => t.id);
      const counts = await getMultipleTeacherClassCounts(teacherIds);
      
      setActualClassCounts(counts);
      console.log('✅ Loaded actual class counts:', counts);
    } catch (error) {
      console.error('❌ Error loading class counts:', error);
    }
  };

  // Debug function to test class loading
  const debugClassData = async () => {
    try {
      console.log('🔍 DEBUG: Testing class data loading...');
      
      // Get all classes
      const allClasses = await ClassFirestoreService.getAllClasses();
      console.log('📋 All classes in database:', allClasses.length);
      
      allClasses.forEach((cls, index) => {
        console.log(`📝 Class ${index + 1}:`, {
          id: cls.id,
          name: cls.name,
          teacherId: cls.teacherId || 'NO TEACHER',
          status: cls.status
        });
      });
      
      // Test specific teacher
      if (localTeachers.length > 0) {
        const firstTeacher = localTeachers[0];
        console.log('🧪 Testing with first teacher:', firstTeacher.id, firstTeacher.name);
        
        const teacherClasses = await ClassFirestoreService.getClassesByTeacher(firstTeacher.id);
        console.log('📊 Classes for this teacher:', teacherClasses.length);
      }
      
      showToast('Debug info logged to console', 'info');
    } catch (error) {
      console.error('❌ Debug error:', error);
      showToast('Debug failed - check console', 'error');
    }
  };

  // Use local teachers for display
  const displayTeachers = localTeachers;

  // Use simple console logging for now
  // const showSuccess = (message: string) => console.log('Success:', message);
  // const showError = (message: string) => console.error('Error:', message);
  // Teacher create handler
  const handleTeacherCreate = async (teacherData: TeacherData) => {
    setActionLoading('create');
    
    try {
      const response = await fetch('/api/teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...teacherData,
          avatar: '',
          // Removed classesAssigned - will use dynamic queries instead
          studentsCount: 0,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create teacher');
      }

      const savedTeacher = await response.json();
      showToast('Teacher created successfully!', 'success');
      setShowAddModal(false);
      
      // Add to local state immediately
      setLocalTeachers(prev => [savedTeacher, ...prev]);
      setLastSyncTimestamp(Date.now());
      
      // Also refresh cache
      refetch();
    } catch (error) {
      console.error('Error creating teacher:', error);
      showToast(error instanceof Error ? error.message : 'Failed to create teacher', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Teacher update handler
  const handleTeacherUpdate = async (teacherData: TeacherData) => {
    if (!editingTeacher) return;
    
    setActionLoading('update');
    
    try {
      const response = await fetch(`/api/teacher?id=${editingTeacher.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teacherData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update teacher');
      }

      const updatedTeacher = await response.json();
      showToast('Teacher updated successfully!', 'success');
      setShowEditModal(false);
      setEditingTeacher(null);
      
      // Update local state immediately
      setLocalTeachers(prev => prev.map(teacher => 
        teacher.id === editingTeacher.id ? updatedTeacher : teacher
      ));
      setLastSyncTimestamp(Date.now());
      
      // Also refresh cache
      refetch();
    } catch (error) {
      console.error('Error updating teacher:', error);
      showToast(error instanceof Error ? error.message : 'Failed to update teacher', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Teacher delete handler
  const handleTeacherDelete = async () => {
    if (!teacherToDelete) return;
    
    setActionLoading('delete');
    
    try {
      const response = await fetch(`/api/teacher?id=${teacherToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete teacher');
      }

      showToast('Teacher deleted successfully!', 'success');
      setShowDeleteConfirm(false);
      setTeacherToDelete(null);
      
      // Immediately remove from local state for instant UI update
      console.log('Before deletion - teachers count:', localTeachers.length);
      console.log('Deleting teacher with ID:', teacherToDelete.id);
      
      setLocalTeachers(prev => {
        const updated = prev.filter(teacher => teacher.id !== teacherToDelete.id);
        console.log('After deletion - teachers count:', updated.length);
        return updated;
      });
      setLastSyncTimestamp(Date.now());
      
      // Also invalidate cache and refetch to stay in sync
      invalidate();
      setTimeout(async () => {
        await refetch();
      }, 500); // Small delay to ensure deletion has propagated
    } catch (error) {
      console.error('Error deleting teacher:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete teacher', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter teachers based on search term
  const filteredTeachers = useMemo(() => {
    if (!displayTeachers) return [];
    
    return displayTeachers.filter(teacher => {
      const searchLower = searchTerm.toLowerCase();
      
      // Search in basic fields
      const basicMatch = teacher.name.toLowerCase().includes(searchLower) ||
        teacher.email.toLowerCase().includes(searchLower) ||
        teacher.phone.includes(searchTerm) ||
        teacher.id.toLowerCase().includes(searchLower);
      
      // Search in subject-grade combinations
      const subjectGradeMatch = teacher.subjectGrades?.some(sg => 
        sg.subjectName.toLowerCase().includes(searchLower) ||
        sg.grade.toLowerCase().includes(searchLower) ||
        `${sg.subjectName} grade ${sg.grade}`.toLowerCase().includes(searchLower)
      ) || false;
      
      // Search in legacy subjects array (fallback)
      const legacySubjectMatch = teacher.subjects?.some(subject => 
        subject.toLowerCase().includes(searchLower)
      ) || false;
      
      return basicMatch || subjectGradeMatch || legacySubjectMatch;
    });
  }, [displayTeachers, searchTerm]);


  // Handle edit button click
  const handleEditClick = (teacher: TeacherDocument) => {
    setEditingTeacher(teacher);
    setShowEditModal(true);
  };

  // Handle delete button click
  const handleDeleteClick = (teacher: TeacherDocument) => {
    setTeacherToDelete(teacher);
    setShowDeleteConfirm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-primary-600 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-secondary-600 dark:text-secondary-300 font-medium">Loading teachers...</p>
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
              Teachers Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage teacher records, assignments, and information
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={debugClassData}
              variant="outline"
              size="sm"
              className="text-purple-600 border-purple-300 hover:bg-purple-50"
            >
              Debug Classes
            </Button>
            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
              <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                Total: {teachers?.length || 0}
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search teachers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Teacher</span>
          </Button>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-60">
                  Subject/Experience
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Classes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {teacher.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        ID: {teacher.id}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{teacher.email}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{teacher.phone}</div>
                  </td>                  <td className="px-6 py-4 w-60">
                    <div className="max-h-16 overflow-y-auto">
                      <div className="text-sm text-gray-900 dark:text-white break-words">
                        {teacher.subjectGrades && teacher.subjectGrades.length > 0 
                          ? teacher.subjectGrades.map(sg => `${sg.subjectName} (Grade ${sg.grade})`).join(', ')
                          : teacher.subjects && teacher.subjects.length > 0 
                            ? teacher.subjects.join(', ')
                            : 'No subjects assigned'
                        }
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 break-words">{teacher.qualifications || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      teacher.status === 'Active' 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    }`}>
                      {teacher.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {actualClassCounts[teacher.id] !== undefined 
                        ? `${actualClassCounts[teacher.id]} classes`
                        : 'Loading classes...'
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(teacher)}
                        disabled={actionLoading === 'update'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(teacher)}
                        disabled={actionLoading === 'delete'}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTeachers.length === 0 && (
          <div className="text-center py-12">
            <GraduationCap className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No teachers found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding a new teacher'}
            </p>
          </div>
        )}
      </div>      {/* Add Teacher Modal */}
      {showAddModal && (
        <TeacherModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleTeacherCreate}
          loading={actionLoading === 'create'}
          title="Add New Teacher"
          submitButtonText="Add Teacher"
        />
      )}

      {/* Edit Teacher Modal */}
      {showEditModal && editingTeacher && (
        <TeacherModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingTeacher(null);
          }}
          onSubmit={handleTeacherUpdate}
          loading={actionLoading === 'update'}
          title="Edit Teacher"
          submitButtonText="Update Teacher"
          initialData={editingTeacher}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && teacherToDelete && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setTeacherToDelete(null);
          }}
          onConfirm={handleTeacherDelete}
          isLoading={actionLoading === 'delete'}
          title="Delete Teacher"
          description={`Are you sure you want to delete ${teacherToDelete.name}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </div>
  );
}
