'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter, 
  BookOpen, 
  FileQuestion, 
  Edit2, 
  Trash2, 
  Eye,
  Users,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { QuestionBank } from '@/models/questionBankSchema';
import { questionBankService } from '@/apiservices/questionBankFirestoreService';
import { teacherAccessBankService } from '@/apiservices/teacherAccessBankService';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { Button, Input, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui';
import QuestionBankModal from '@/components/modals/QuestionBankModal';

export default function TeacherQuestionBanks() {
  const router = useRouter();
  const { teacher, loading: authLoading, error: authError } = useTeacherAuth();
  const { showToast } = useToast();

  // State management
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Modals
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<QuestionBank | null>(null);

  // Grade options
  const grades = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  ];

  // Fetch question banks that the teacher has access to
  useEffect(() => {
    const fetchQuestionBanks = async () => {
      // Don't proceed if auth is still loading
      if (authLoading) {
        console.log('⏳ Authentication still loading, waiting...');
        return;
      }

      // Check for auth errors
      if (authError) {
        console.error('❌ Authentication error:', authError);
        setError(authError);
        setLoading(false);
        return;
      }

      // Check if teacher is authenticated
      if (!teacher?.id) {
        console.log('❌ Teacher not authenticated, skipping fetch');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get question banks the teacher has access to through the access control system
        const accessList = await teacherAccessBankService.getAccessibleQuestionBanks(teacher.id);
        
        // Convert access list to question banks
        const questionBankIds = accessList.map(access => access.questionBankId);
        const questionBanksPromises = questionBankIds.map(id => 
          questionBankService.getQuestionBank(id)
        );
        
        const questionBanksResults = await Promise.all(questionBanksPromises);
        const validQuestionBanks = questionBanksResults.filter(bank => bank !== null) as QuestionBank[];
        
        setQuestionBanks(validQuestionBanks);
      } catch (err) {
        console.error('Error fetching question banks:', err);
        setError('Failed to load question banks');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionBanks();
  }, [teacher?.id, authLoading, authError]);

  // Filter question banks based on search, grade, and subject
  const filteredBanks = useMemo(() => {
    return questionBanks.filter(bank => {
      const matchesSearch = bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (bank.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      const matchesGrade = selectedGrade === 'all' || bank.grade === selectedGrade;
      const matchesSubject = selectedSubject === 'all' || bank.subjectName === selectedSubject;
      
      return matchesSearch && matchesGrade && matchesSubject;
    });
  }, [questionBanks, searchTerm, selectedGrade, selectedSubject]);

  // Get unique subjects from accessible question banks
  const availableSubjects = useMemo(() => {
    const subjects = new Set(questionBanks.map(bank => bank.subjectName));
    return Array.from(subjects).sort();
  }, [questionBanks]);

  // Handle creating a new question bank
  const handleCreateBank = async (bankData: Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>) => {
    setActionLoading('create');
    
    try {
      const newBankId = await questionBankService.createQuestionBank(bankData);
      const newBank = await questionBankService.getQuestionBank(newBankId);
      
      if (newBank) {
        setQuestionBanks(prev => [newBank, ...prev]);
        showToast('Question bank created successfully!', 'success');
        setShowAddBankModal(false);
      }
    } catch (err) {
      console.error('Error creating question bank:', err);
      showToast('Failed to create question bank', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle editing a question bank
  const handleEditBank = (bank: QuestionBank) => {
    setEditingBank(bank);
    setShowAddBankModal(true);
  };

  // Handle updating a question bank
  const handleUpdateBank = async (bankData: Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingBank) return;
    
    setActionLoading('update');
    
    try {
      await questionBankService.updateQuestionBank(editingBank.id, bankData);
      
      // Update local state
      setQuestionBanks(prev => prev.map(bank => 
        bank.id === editingBank.id 
          ? { ...bank, ...bankData } 
          : bank
      ));
      
      showToast('Question bank updated successfully!', 'success');
      setShowAddBankModal(false);
      setEditingBank(null);
    } catch (err) {
      console.error('Error updating question bank:', err);
      showToast('Failed to update question bank', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (bank: QuestionBank) => {
    setBankToDelete(bank);
    setShowDeleteConfirm(true);
  };

  // Handle delete question bank
  const handleDeleteBank = async () => {
    if (!bankToDelete) return;
    
    setActionLoading('delete');
    
    try {
      await questionBankService.deleteQuestionBank(bankToDelete.id);
      
      // Update local state
      setQuestionBanks(prev => prev.filter(bank => bank.id !== bankToDelete.id));
      
      showToast('Question bank deleted successfully!', 'success');
      setShowDeleteConfirm(false);
      setBankToDelete(null);
    } catch (err) {
      console.error('Error deleting question bank:', err);
      showToast('Failed to delete question bank', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle modal submission
  const handleModalSubmit = async (bankData: Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingBank) {
      await handleUpdateBank(bankData);
    } else {
      await handleCreateBank(bankData);
    }
  };

  // Handle closing modals
  const handleCloseModal = () => {
    setShowAddBankModal(false);
    setEditingBank(null);
  };

  if (authLoading || loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">
              {authLoading ? 'Authenticating...' : 'Loading question banks...'}
            </p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Question Banks
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Create and manage question banks for your subjects
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Total: {questionBanks.length}
                </span>
              </div>
              <Button
                onClick={() => setShowAddBankModal(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Question Bank</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search question banks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Subjects</option>
                {availableSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
            
            <div>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Grades</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center justify-end">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredBanks.length} of {questionBanks.length} banks
              </span>
            </div>
          </div>
        </div>

        {/* Question Banks Grid */}
        {filteredBanks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <FileQuestion className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No question banks found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || selectedGrade !== 'all' || selectedSubject !== 'all'
                ? 'Try adjusting your search criteria' 
                : 'Create your first question bank to get started'
              }
            </p>
            {!searchTerm && selectedGrade === 'all' && selectedSubject === 'all' && (
              <Button onClick={() => setShowAddBankModal(true)}>
                Create Question Bank
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBanks.map((bank) => (
              <div key={bank.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {bank.name}
                    </h3>
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/teacher/questions/${bank.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditBank(bank)}
                        disabled={actionLoading === 'update'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(bank)}
                        disabled={actionLoading === 'delete'}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {bank.subjectName}
                    </span>
                    {bank.grade && (
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        {bank.grade}
                      </span>
                    )}
                  </div>
                  
                  {bank.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                      {bank.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <FileQuestion className="w-4 h-4 mr-1" />
                        {bank.totalQuestions || 0}
                      </span>
                      <span className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                        {bank.mcqCount || 0} MCQ
                      </span>
                      <span className="flex items-center">
                        <Edit2 className="w-4 h-4 mr-1 text-purple-500" />
                        {bank.essayCount || 0} Essay
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center space-x-2"
                      onClick={() => router.push(`/teacher/questions/${bank.id}`)}
                    >
                      <span>Manage Questions</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Question Bank Modal */}
        {showAddBankModal && (
          <QuestionBankModal
            isOpen={showAddBankModal}
            onClose={handleCloseModal}
            onSubmit={handleModalSubmit}
            loading={actionLoading === 'create' || actionLoading === 'update'}
            title={editingBank ? 'Edit Question Bank' : 'Create Question Bank'}
            submitButtonText={editingBank ? 'Update Question Bank' : 'Create Question Bank'}
            initialData={editingBank || undefined}
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
    </TeacherLayout>
  );
}
