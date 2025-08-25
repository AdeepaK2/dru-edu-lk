'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { QuestionBank } from '@/models/questionBankSchema';
import { questionBankService } from '@/apiservices/questionBankFirestoreService';
import { SubjectFirestoreService } from '@/apiservices/subjectFirestoreService';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { teacherAccessBankService } from '@/apiservices/teacherAccessBankService';
import { TeacherAccessBank } from '@/models/teacherAccessBankSchema';
import { SubjectDocument } from '@/models/subjectSchema';
import QuestionBankModal from '@/components/modals/QuestionBankModal';
import QuestionBankDetailModal from '@/components/modals/QuestionBankDetailModal';
import QuestionManagementModal from '@/components/modals/QuestionManagementModal';
import ClassAssignmentModal from '@/components/modals/ClassAssignmentModal';
import { Button, ConfirmDialog } from '@/components/ui';
import { auth } from '@/utils/firebase-client';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { AccessLevel, getAccessLevelLabel, getAvailableAccessLevels } from '@/utils/accessLevels';

// Interface for teachers to display in assignment dropdown
interface Teacher {
  id: string;
  name: string;
  email: string;
}

export default function QuestionBanksPage() {
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [filter, setFilter] = useState({
    subject: '',
    grade: ''
  });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<SubjectDocument[]>([]);
  const [teacherAccessMap, setTeacherAccessMap] = useState<Map<string, TeacherAccessBank[]>>(new Map());

  const [assigningTeachers, setAssigningTeachers] = useState<{
    bankId: string, 
    showing: boolean, 
    selectedTeachers: { teacherId: string; accessLevel: AccessLevel }[]
  }>({
    bankId: '',
    showing: false,
    selectedTeachers: []
  });  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<QuestionBank | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
    // Modal states
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showClassAssignmentModal, setShowClassAssignmentModal] = useState(false);

  // Grades list
  const grades = [
    'Grade 1',
    'Grade 2',
    'Grade 3',
    'Grade 4', 
    'Grade 5',
    'Grade 6',
    'Grade 7',
    'Grade 8',
    'Grade 9',
    'Grade 10',
    'Grade 11',
    'Grade 12',
  ];

  // Fetch subjects and teachers
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectList = await SubjectFirestoreService.getAllSubjects();
        setSubjects(subjectList);
      } catch (err) {
        console.error('Error fetching subjects:', err);
      }
    };

    fetchSubjects();
  }, []);
  // Fetch teachers
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const teacherData = await TeacherFirestoreService.getTeachersForSelection();
        setTeachers(teacherData);
      } catch (err) {
        console.error('Error fetching teachers:', err);
      }
    };
    
    fetchTeachers();
  }, []);

  // Load question banks with filters and their teacher access
  useEffect(() => {
    const fetchQuestionBanks = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Build filter object
        const filterOptions: { subjectId?: string, grade?: string } = {};
        
        if (filter.subject) {
          filterOptions.subjectId = filter.subject;
        }
        
        if (filter.grade) {
          filterOptions.grade = filter.grade;
        }
        
        // Fetch question banks from Firebase
        const banks = await questionBankService.listQuestionBanks(filterOptions);
        setQuestionBanks(banks);
        
        // Load teacher access for all banks
        const accessMap = new Map<string, TeacherAccessBank[]>();
        for (const bank of banks) {
          try {
            const access = await teacherAccessBankService.getTeachersWithAccess(bank.id);
            accessMap.set(bank.id, access);
          } catch (err) {
            console.warn(`Failed to load access for bank ${bank.id}:`, err);
            accessMap.set(bank.id, []);
          }
        }
        setTeacherAccessMap(accessMap);
        
      } catch (err: any) {
        console.error("Error fetching question banks:", err);
        setError(`Error: ${err.message || 'Failed to load question banks'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionBanks();
  }, [filter]);

  // Toggle add question bank modal
  const toggleAddBankModal = () => {
    setShowAddBankModal(!showAddBankModal);
    if (editingBank) {
      setEditingBank(null);
    }
  };

  // Handle edit bank click
  const handleEditBank = (bank: QuestionBank) => {
    setEditingBank(bank);
    setShowAddBankModal(true);
  };
  // Handle delete bank click
  const handleDeleteClick = (bank: QuestionBank) => {
    setBankToDelete(bank);
    setShowDeleteConfirm(true);
  };

  // Handle delete bank confirmation
  const handleDeleteBank = async () => {
    if (!bankToDelete) return;
    
    setActionLoading('delete');
    
    try {
      await questionBankService.deleteQuestionBank(bankToDelete.id);
      
      // Update state after successful deletion
      setQuestionBanks(prev => prev.filter(bank => bank.id !== bankToDelete.id));
      
      // Close the confirmation dialog
      setShowDeleteConfirm(false);
      setBankToDelete(null);
    } catch (err: any) {
      console.error("Error deleting question bank:", err);
      setError(`Error: ${err.message || 'Failed to delete question bank'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle filter changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
  };

  // Handle assign teachers toggle
  const toggleAssignTeachers = (bank: QuestionBank) => {
    const currentAccess = teacherAccessMap.get(bank.id) || [];
    const currentTeacherSelections = currentAccess.map(access => ({
      teacherId: access.teacherId,
      accessLevel: access.accessType
    }));
    
    setAssigningTeachers({
      bankId: bank.id,
      showing: bank.id !== assigningTeachers.bankId || !assigningTeachers.showing,
      selectedTeachers: currentTeacherSelections
    });
  };

  // Handle teacher selection changes
  const handleTeacherSelectionChange = (teacherId: string, isChecked: boolean, accessLevel: AccessLevel = 'read_add') => {
    setAssigningTeachers(prev => {
      const newSelectedTeachers = isChecked 
        ? [...prev.selectedTeachers, { teacherId, accessLevel }]
        : prev.selectedTeachers.filter(selection => selection.teacherId !== teacherId);
        
      return {
        ...prev,
        selectedTeachers: newSelectedTeachers
      };
    });
  };

  // Handle access level change for a teacher
  const handleAccessLevelChange = (teacherId: string, newAccessLevel: AccessLevel) => {
    setAssigningTeachers(prev => ({
      ...prev,
      selectedTeachers: prev.selectedTeachers.map(selection =>
        selection.teacherId === teacherId 
          ? { ...selection, accessLevel: newAccessLevel }
          : selection
      )
    }));
  };

  // Check current teacher access for a question bank
  const handleCheckTeacherAccess = async (bank: QuestionBank) => {
    try {
      const accessList = await teacherAccessBankService.getTeachersWithAccess(bank.id);
      
      console.log(`🔍 Teachers with access to "${bank.name}":`);
      if (accessList.length === 0) {
        console.log('  No teachers have access');
      } else {
        accessList.forEach(access => {
          console.log(`  - ${access.teacherName} (${access.teacherEmail}) - ${access.accessType} access`);
        });
      }
      
      alert(`Access check complete for "${bank.name}". Check the browser console for details.\n\nTeachers with access: ${accessList.length}`);
      
    } catch (error) {
      console.error('Error checking teacher access:', error);
      alert('Failed to check teacher access. Please try again.');
    }
  };

  // Save teacher assignments
  const handleSaveTeacherAssignments = async () => {
    try {
      const bank = questionBanks.find(b => b.id === assigningTeachers.bankId);
      if (!bank) return;
      
      setActionLoading('assign-teachers');
      
      // Get current teacher access to know who to add/remove
      const currentAccess = await teacherAccessBankService.getTeachersWithAccess(assigningTeachers.bankId);
      const currentTeacherIds = currentAccess.map(access => access.teacherId);
      const selectedTeacherIds = assigningTeachers.selectedTeachers.map(selection => selection.teacherId);
      
      // Determine teachers to add and remove
      const teachersToAdd = assigningTeachers.selectedTeachers.filter(
        selection => !currentTeacherIds.includes(selection.teacherId)
      );
      const teachersToRemove = currentTeacherIds.filter(
        teacherId => !selectedTeacherIds.includes(teacherId)
      );
      const teachersToUpdate = assigningTeachers.selectedTeachers.filter(
        selection => {
          const existingAccess = currentAccess.find(access => access.teacherId === selection.teacherId);
          return existingAccess && existingAccess.accessType !== selection.accessLevel;
        }
      );
      
      console.log('🔍 Teacher access changes:', {
        toAdd: teachersToAdd.length,
        toRemove: teachersToRemove.length,
        toUpdate: teachersToUpdate.length,
        currentAccess: currentTeacherIds.length,
        newSelection: assigningTeachers.selectedTeachers.length
      });
      
      // Grant access to newly selected teachers
      for (const selection of teachersToAdd) {
        const teacher = teachers.find(t => t.id === selection.teacherId);
        if (teacher) {
          try {
            await teacherAccessBankService.grantAccess(
              teacher.id,
              teacher.name,
              teacher.email,
              bank.id,
              bank.name,
              bank.subjectId,
              bank.subjectName,
              selection.accessLevel,
              'admin_system', // Admin system ID
              'Admin System', // Admin system name
              undefined, // No expiry
              `Access granted via admin question bank assignment with ${selection.accessLevel} permissions`,
            );
            console.log('✅ Granted access:', teacher.name, 'with', selection.accessLevel, 'permissions');
          } catch (error) {
            console.warn('❌ Failed to grant access to', teacher.name, ':', error);
          }
        }
      }
      
      // Update access for existing teachers with changed permissions
      for (const selection of teachersToUpdate) {
        const teacher = teachers.find(t => t.id === selection.teacherId);
        if (teacher) {
          try {
            // Revoke old access and grant new access
            await teacherAccessBankService.revokeAccess(selection.teacherId, bank.id);
            await teacherAccessBankService.grantAccess(
              teacher.id,
              teacher.name,
              teacher.email,
              bank.id,
              bank.name,
              bank.subjectId,
              bank.subjectName,
              selection.accessLevel as 'read' | 'read_add' | 'write' | 'admin',
              'admin_system',
              'Admin System',
              undefined,
              `Access updated via admin question bank assignment with ${selection.accessLevel} permissions`,
            );
            console.log('✅ Updated access:', teacher.name, 'to', selection.accessLevel, 'permissions');
          } catch (error) {
            console.warn('❌ Failed to update access for', teacher.name, ':', error);
          }
        }
      }
      
      // Revoke access from unselected teachers
      for (const teacherId of teachersToRemove) {
        try {
          await teacherAccessBankService.revokeAccess(teacherId, bank.id);
          const teacher = teachers.find(t => t.id === teacherId);
          console.log('✅ Revoked access:', teacher?.name || teacherId);
        } catch (error) {
          console.warn('❌ Failed to revoke access from', teacherId, ':', error);
        }
      }
      
      // Update local teacher access map
      const updatedAccess = await teacherAccessBankService.getTeachersWithAccess(bank.id);
      setTeacherAccessMap(prev => {
        const newMap = new Map(prev);
        newMap.set(bank.id, updatedAccess);
        return newMap;
      });
      
      // Close the assignment panel
      setAssigningTeachers(prev => ({ ...prev, showing: false }));
      
      console.log('✅ Teacher assignments updated successfully!');
      
    } catch (err: any) {
      console.error("Error assigning teachers:", err);
      setError(`Error: ${err.message || 'Failed to assign teachers'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle form submission
  const handleSubmitBank = async (bankData: Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingBank) {
        // Update existing bank
        await questionBankService.updateQuestionBank(editingBank.id, bankData);
        
        // Update state after successful update
        setQuestionBanks(prev => prev.map(bank => 
          bank.id === editingBank.id 
            ? { ...bank, ...bankData, updatedAt: Timestamp.now() } 
            : bank
        ));
      } else {
        // Create new bank
        const newBankId = await questionBankService.createQuestionBank(bankData);
        
        // Get the newly created bank to add to state
        const newBank = await questionBankService.getQuestionBank(newBankId);
        
        if (newBank) {
          setQuestionBanks(prev => [...prev, newBank]);
        }
      }
      
      toggleAddBankModal();
    } catch (err: any) {
      console.error("Error saving question bank:", err);
      setError(`Error: ${err.message || 'Failed to save question bank'}`);
    }
  };
  // Get assigned teacher names for a bank
  const getAssignedTeacherNames = (bank: QuestionBank): string => {
    const accessList = teacherAccessMap.get(bank.id) || [];
    
    if (accessList.length === 0) {
      return 'No teachers assigned';
    }
    
    if (accessList.length === 1) {
      return `${accessList[0].teacherName} (${getAccessLevelLabel(accessList[0].accessType as AccessLevel)})`;
    }
    
    if (accessList.length === 2) {
      return `${accessList[0].teacherName} (${getAccessLevelLabel(accessList[0].accessType as AccessLevel)}) and ${accessList[1].teacherName} (${getAccessLevelLabel(accessList[1].accessType as AccessLevel)})`;
    }
    
    return `${accessList[0].teacherName} (${getAccessLevelLabel(accessList[0].accessType as AccessLevel)}) and ${accessList.length - 1} others`;
  };

  // Modal handlers
  const handleViewQuestions = (bank: QuestionBank) => {
    setSelectedBank(bank);
    setShowDetailModal(true);
  };
  const handleAddQuestions = (bank: QuestionBank) => {
    setSelectedBank(bank);
    setShowQuestionModal(true);
  };

  const handleAssignToClasses = (bank: QuestionBank) => {
    setSelectedBank(bank);
    setShowClassAssignmentModal(true);
  };

  const handleQuestionBankUpdate = (updatedBank: QuestionBank) => {
    setQuestionBanks(prev => prev.map(bank => 
      bank.id === updatedBank.id ? updatedBank : bank
    ));
    setSelectedBank(updatedBank);
  };

  const closeModals = () => {
    setShowDetailModal(false);
    setShowQuestionModal(false);
    setShowClassAssignmentModal(false);
    setSelectedBank(null);
  };

  const handleAssignmentComplete = () => {
    // Optionally refresh data or show success message
    console.log('Assignment completed successfully');
  };

  return (
    <div className="px-6 py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Question Banks</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage question banks for your classes
            </p>
          </div>
          
          <Button 
            variant="primary"
            onClick={toggleAddBankModal}
          >
            Create Question Bank
          </Button>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Subject
              </label>
              <select
                name="subject"
                value={filter.subject}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">All Subjects</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Grade
              </label>
              <select
                name="grade"
                value={filter.grade}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">All Grades</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
              <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
            </div>
            <p className="mt-2 text-gray-600">Loading question banks...</p>
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {/* Question banks list */}
        {!loading && !error && questionBanks.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No question banks found. Create your first question bank to get started!</p>
          </div>
        )}
        
        {!loading && !error && questionBanks.length > 0 && (
          <div className="grid grid-cols-1 gap-6">
            {questionBanks.map(bank => (
              <div key={bank.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">{bank.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {bank.subjectName} • {bank.grade || 'No grade assigned'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">{bank.description || 'No description provided'}</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditBank(bank)}
                      >
                        Edit
                      </Button>                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteClick(bank)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-4">
                    <div className="bg-blue-50 rounded-md px-3 py-1 text-sm text-blue-800">
                      {bank.totalQuestions} Questions
                    </div>
                    <div className="bg-green-50 rounded-md px-3 py-1 text-sm text-green-800">
                      {bank.mcqCount} MCQ
                    </div>
                    <div className="bg-purple-50 rounded-md px-3 py-1 text-sm text-purple-800">
                      {bank.essayCount} Essay
                    </div>
                  </div>
                  
                  {/* Teacher assignment section */}
                  <div className="mt-6 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-medium text-gray-700">Assigned Teachers</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {getAssignedTeacherNames(bank)}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleAssignTeachers(bank)}
                        >
                          {assigningTeachers.bankId === bank.id && assigningTeachers.showing 
                            ? 'Cancel' 
                            : 'Assign Teachers'}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Teacher assignment interface */}
                    {assigningTeachers.bankId === bank.id && assigningTeachers.showing && (
                      <div className="mt-4 border border-gray-200 rounded-md p-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-700 mb-4">Select Teachers and Access Levels</h4>
                        <div className="mb-4 text-xs text-gray-600 space-y-1">
                          {getAvailableAccessLevels().map(level => (
                            <p key={level.value}>
                              <strong>{level.label}:</strong> {level.description}
                            </p>
                          ))}
                        </div>
                        
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {teachers.map(teacher => {
                            const currentSelection = assigningTeachers.selectedTeachers.find(s => s.teacherId === teacher.id);
                            const currentAccessLevel = currentSelection?.accessLevel || 'none';
                            
                            return (
                              <div key={teacher.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="flex-1">
                                  <span className="text-sm text-gray-700">
                                    {teacher.name} ({teacher.email})
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <select
                                    value={currentAccessLevel}
                                    onChange={(e) => {
                                      const newAccessLevel = e.target.value as AccessLevel | 'none';
                                      if (newAccessLevel === 'none') {
                                        handleTeacherSelectionChange(teacher.id, false);
                                      } else {
                                        handleTeacherSelectionChange(teacher.id, true, newAccessLevel);
                                        handleAccessLevelChange(teacher.id, newAccessLevel);
                                      }
                                    }}
                                    className="text-xs px-2 py-1 border border-gray-300 rounded"
                                  >
                                    <option value="none">No Access</option>
                                    {getAvailableAccessLevels().map(level => (
                                      <option key={level.value} value={level.value}>
                                        {level.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveTeacherAssignments}
                            disabled={actionLoading === 'assign-teachers'}
                          >
                            {actionLoading === 'assign-teachers' ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                              </>
                            ) : (
                              'Save Assignments'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>                  
                  <div className="mt-6 flex justify-between items-center">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewQuestions(bank)}
                        className="flex items-center space-x-1"
                      >
                        <span>View Questions</span>
                      </Button>
                      
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAddQuestions(bank)}
                        className="flex items-center space-x-1"
                      >
                        <span>Add Questions</span>
                      </Button>
                      
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAssignToClasses(bank)}
                        className="flex items-center space-x-1"
                      >
                        <span>Assign to Classes</span>
                      </Button>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Created: {bank.createdAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}        {/* Question bank modal */}
        <QuestionBankModal
          isOpen={showAddBankModal}
          onClose={toggleAddBankModal}
          onSubmit={handleSubmitBank}
          title={editingBank ? 'Edit Question Bank' : 'Create Question Bank'}
          submitButtonText={editingBank ? 'Update Question Bank' : 'Create Question Bank'}
          initialData={editingBank || undefined}
        />

        {/* Question Bank Detail Modal */}
        {selectedBank && (
          <QuestionBankDetailModal
            isOpen={showDetailModal}
            onClose={closeModals}
            questionBank={selectedBank}
            onQuestionBankUpdate={handleQuestionBankUpdate}
            onAddQuestions={handleAddQuestions}
          />
        )}        {/* Question Management Modal */}
        {selectedBank && (
          <QuestionManagementModal
            isOpen={showQuestionModal}
            onClose={closeModals}
            questionBank={selectedBank}
            onQuestionBankUpdate={handleQuestionBankUpdate}
          />
        )}

        {/* Class Assignment Modal */}
        {selectedBank && (
          <ClassAssignmentModal
            isOpen={showClassAssignmentModal}
            onClose={closeModals}
            questionBank={selectedBank}
            onAssignmentComplete={handleAssignmentComplete}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && bankToDelete && (
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onClose={() => {
              setShowDeleteConfirm(false);
              setBankToDelete(null);
            }}
            onConfirm={handleDeleteBank}
            isLoading={actionLoading === 'delete'}
            title="Delete Question Bank"
            description={`Are you sure you want to delete "${bankToDelete.name}"? This will permanently delete all questions in this bank and cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
          />
        )}
      </div>
    </div>
  );
}
