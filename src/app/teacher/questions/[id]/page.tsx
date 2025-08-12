'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft,
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Eye,
  Upload,
  Download,
  Filter,
  MoreVertical,
  FileQuestion,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  BookOpen
} from 'lucide-react';
import { QuestionBank, Question } from '@/models/questionBankSchema';
import { questionBankService, questionService } from '@/apiservices/questionBankFirestoreService';
import { teacherAccessBankService } from '@/apiservices/teacherAccessBankService';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { Button, Input, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui';
import QuestionForm from '@/components/questions/QuestionForm';

export default function TeacherQuestionBankDetail() {
  const router = useRouter();
  const params = useParams();
  const bankId = params.id as string;
  const { teacher, loading: authLoading, error: authError } = useTeacherAuth();
  const { showToast } = useToast();

  // State management
  const [questionBank, setQuestionBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // UI state
  const [selectedTab, setSelectedTab] = useState<'view' | 'add'>('view');
  const [questionType, setQuestionType] = useState<'mcq' | 'essay'>('mcq');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'essay'>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Add this state for showing search help
  const [showSearchHelp, setShowSearchHelp] = useState(false);

  // Load question bank and its questions
  useEffect(() => {
    const loadData = async () => {
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
        console.error('❌ Teacher not authenticated');
        setError('Teacher not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Loading question bank with ID:', bankId);
        console.log('🔍 Teacher:', teacher);
        
        // Fetch question bank
        const bank = await questionBankService.getQuestionBank(bankId);
        if (!bank) {
          throw new Error('Question bank not found');
        }
        
        console.log('🔍 Question bank loaded:', bank);
        
        // Check if teacher has access to this question bank using proper access control
        const hasAccess = await teacherAccessBankService.hasAccess(teacher.id, bankId);
        if (!hasAccess) {
          throw new Error('You do not have access to this question bank');
        }
        
        console.log('✅ Teacher has access to question bank');
        
        setQuestionBank(bank);
        
        // Fetch questions in this bank
        if (bank.questionIds && bank.questionIds.length > 0) {
          setQuestionsLoading(true);
          const bankQuestions = await Promise.all(
            bank.questionIds.map(id => questionService.getQuestion(id))
          );
          // Filter out null questions (in case some were deleted)
          const validQuestions = bankQuestions.filter(q => q !== null) as Question[];
          setQuestions(validQuestions);
          setQuestionsLoading(false);
        }
        
      } catch (err: any) {
        console.error("Error loading data:", err);
        setError(err.message || 'Failed to load question bank');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [bankId, teacher?.id, authLoading, authError]);

  // Enhanced filter function
  const filteredQuestions = questions.filter(question => {
    // If no search term, only apply type and difficulty filters
    if (!searchTerm.trim()) {
      const matchesType = filterType === 'all' || question.type === filterType;
      const matchesDifficulty = filterDifficulty === 'all' || question.difficultyLevel === filterDifficulty;
      return matchesType && matchesDifficulty;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    
    // Search by question number (Q1, Q2, etc.)
    const questionIndex = questions.indexOf(question) + 1;
    const questionNumber = `q${questionIndex}`;
    const matchesQuestionNumber = questionNumber.includes(searchLower) || 
                                   `question ${questionIndex}`.includes(searchLower);

    // Search by title
    const matchesTitle = question.title.toLowerCase().includes(searchLower);
    
    // Search by content
    const matchesContent = question.content?.toLowerCase().includes(searchLower) || false;
    
    // Search by MCQ options and explanation
    let matchesMCQContent = false;
    if (question.type === 'mcq' && 'options' in question) {
      // Search in option texts
      const optionMatches = question.options.some(option => 
        option.text?.toLowerCase().includes(searchLower)
      );
      
      // Search in explanation
      const explanationMatches = question.explanation?.toLowerCase().includes(searchLower) || false;
      
      matchesMCQContent = optionMatches || explanationMatches;
    }
    
    // Search by Essay suggested answer
    let matchesEssayContent = false;
    if (question.type === 'essay' && 'suggestedAnswerContent' in question) {
      matchesEssayContent = question.suggestedAnswerContent?.toLowerCase().includes(searchLower) || false;
    }
    
    // Search by topic (if available)
    const matchesTopic = question.topic?.toLowerCase().includes(searchLower) || false;
    
    // Search by difficulty level
    const matchesDifficulty = question.difficultyLevel.toLowerCase().includes(searchLower);
    
    // Search by question type
    const matchesType = question.type.toLowerCase().includes(searchLower) ||
                       (question.type === 'mcq' && 'multiple choice'.includes(searchLower)) ||
                       (question.type === 'essay' && 'essay'.includes(searchLower));
    
    // Combine all search criteria
    const matchesSearch = matchesQuestionNumber || 
                           matchesTitle || 
                           matchesContent || 
                           matchesMCQContent || 
                           matchesEssayContent || 
                           matchesTopic || 
                           matchesDifficulty || 
                           matchesType;
    
    // Apply filters
    const matchesTypeFilter = filterType === 'all' || question.type === filterType;
    const matchesDifficultyFilter = filterDifficulty === 'all' || question.difficultyLevel === filterDifficulty;
    
    return matchesSearch && matchesTypeFilter && matchesDifficultyFilter;
  }).sort((a, b) => {
    // Custom sorting function to order questions logically
    // M1, M2, M3... then E1, E2, E3...
    
    // Extract the prefix (M or E) and number from titles like "M1", "E2"
    const extractTitleInfo = (title: string) => {
      const match = title.match(/^([ME])(\d+)$/);
      if (match) {
        return {
          type: match[1], // 'M' or 'E'
          number: parseInt(match[2], 10), // 1, 2, 3, etc.
          isValid: true
        };
      }
      return { type: '', number: 0, isValid: false };
    };
    
    const aInfo = extractTitleInfo(a.title);
    const bInfo = extractTitleInfo(b.title);
    
    // If both have valid format (M1, E2, etc.)
    if (aInfo.isValid && bInfo.isValid) {
      // First sort by type: M comes before E
      if (aInfo.type !== bInfo.type) {
        return aInfo.type === 'M' ? -1 : 1;
      }
      // Then sort by number within the same type
      return aInfo.number - bInfo.number;
    }
    
    // If only one has valid format, it comes first
    if (aInfo.isValid) return -1;
    if (bInfo.isValid) return 1;
    
    // Fallback: alphabetical sort for non-standard titles
    return a.title.localeCompare(b.title);
  });

  // Handle creating a new question
  const handleCreateQuestion = async (questionData: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!questionBank) return;
    
    setActionLoading('create');
    
    try {
      console.log('🔍 Creating question with data:', questionData);
      
      // Create the question
      const newQuestionId = await questionService.createQuestion(questionData);
      
      // Add to question bank
      await questionBankService.addQuestionsToBank(bankId, [newQuestionId]);
      
      // Get the new question and add to local state
      const newQuestion = await questionService.getQuestion(newQuestionId);
      if (newQuestion) {
        console.log('✅ New question created:', newQuestion);
        setQuestions(prev => [...prev, newQuestion]); // Add to end instead of beginning
        
        // Update question bank counts locally first for immediate UI update
        setQuestionBank(prev => {
          if (!prev) return prev;
          const updatedBank = { ...prev };
          updatedBank.totalQuestions = (updatedBank.totalQuestions || 0) + 1;
          
          if (newQuestion.type === 'mcq') {
            updatedBank.mcqCount = (updatedBank.mcqCount || 0) + 1;
          } else {
            updatedBank.essayCount = (updatedBank.essayCount || 0) + 1;
          }
          
          console.log('🔄 Updated question bank counts locally:', {
            total: updatedBank.totalQuestions,
            mcq: updatedBank.mcqCount,
            essay: updatedBank.essayCount
          });
          
          return updatedBank;
        });
        
        // Also fetch the updated bank from server to ensure consistency
        setTimeout(async () => {
          try {
            const updatedBank = await questionBankService.getQuestionBank(bankId);
            if (updatedBank) {
              console.log('🔄 Fetched updated question bank from server:', updatedBank);
              setQuestionBank(updatedBank);
            }
          } catch (error) {
            console.error('Error fetching updated question bank:', error);
          }
        }, 500);
      }
      
      showToast('Question created successfully!', 'success');
      setSelectedTab('view');
    } catch (err) {
      console.error('Error creating question:', err);
      showToast('Failed to create question', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle editing a question
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionType(question.type);
    setSelectedTab('add');
  };

  // Handle updating a question
  const handleUpdateQuestion = async (questionData: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingQuestion) return;
    
    setActionLoading('update');
    
    try {
      await questionService.updateQuestion(editingQuestion.id, questionData);
      
      // Update local state
      setQuestions(prev => prev.map(q => 
        q.id === editingQuestion.id 
          ? { ...editingQuestion, ...questionData } as Question
          : q
      ));
      
      showToast('Question updated successfully!', 'success');
      setSelectedTab('view');
      setEditingQuestion(null);
    } catch (err) {
      console.error('Error updating question:', err);
      showToast('Failed to update question', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (question: Question) => {
    setQuestionToDelete(question);
    setShowDeleteConfirm(true);
  };

  // Handle delete question
  const handleDeleteQuestion = async () => {
    if (!questionToDelete || !questionBank) return;
    
    setActionLoading('delete');
    
    try {
      // Remove from question bank first
      await questionBankService.removeQuestionsFromBank(bankId, [questionToDelete.id]);
      
      // Delete the question itself
      await questionService.deleteQuestion(questionToDelete.id);
      
      // Update local state
      setQuestions(prev => prev.filter(q => q.id !== questionToDelete.id));
      
      // Update question bank counts
      const updatedBank = await questionBankService.getQuestionBank(bankId);
      if (updatedBank) {
        setQuestionBank(updatedBank);
      }
      
      showToast('Question deleted successfully!', 'success');
      setShowDeleteConfirm(false);
      setQuestionToDelete(null);
    } catch (err) {
      console.error('Error deleting question:', err);
      showToast('Failed to delete question', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle tab changes
  const handleTabChange = (tab: 'view' | 'add') => {
    setSelectedTab(tab);
    if (tab === 'view') {
      setEditingQuestion(null);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (questionData: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingQuestion) {
      await handleUpdateQuestion(questionData);
    } else {
      await handleCreateQuestion(questionData);
    }
  };

  if (authLoading || loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">
              {authLoading ? 'Authenticating...' : 'Loading question bank...'}
            </p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (error || !questionBank) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error || 'Question bank not found'}</p>
              </div>
            </div>
          </div>
          <div>
            <Link href="/teacher/questions" className="text-blue-600 hover:text-blue-800 flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Question Banks
            </Link>
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
              <div className="flex items-center mb-2">
                <Link href="/teacher/questions" className="text-blue-600 hover:text-blue-800 flex items-center">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Question Banks
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {questionBank.name}
              </h1>
              <div className="flex items-center mt-2 space-x-4">
                <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-sm font-medium px-3 py-1 rounded-full">
                  {questionBank.subjectName}
                </span>
                {questionBank.grade && (
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-sm font-medium px-3 py-1 rounded-full">
                    {questionBank.grade}
                  </span>
                )}
                <span className="text-gray-500 dark:text-gray-400">
                  {questionBank.totalQuestions || 0} Questions ({questionBank.mcqCount || 0} MCQ, {questionBank.essayCount || 0} Essay)
                </span>
              </div>
              {questionBank.description && (
                <p className="text-gray-600 dark:text-gray-300 mt-2">{questionBank.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => handleTabChange('view')}
                className={`${
                  selectedTab === 'view'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                View Questions ({questions.length})
              </button>
              <button
                onClick={() => handleTabChange('add')}
                className={`${
                  selectedTab === 'add'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {editingQuestion ? 'Edit Question' : 'Add Question'}
              </button>
            </nav>
          </div>

          {/* View Questions Tab */}
          {selectedTab === 'view' && (
            <div className="p-6">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="relative">
                  <div className="relative flex">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Search by question number (Q1), content, answers, topic..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowSearchHelp(!showSearchHelp)}
                      className="ml-2 px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-300 dark:border-gray-600 rounded-md"
                      title="Search help"
                    >
                      ?
                    </button>
                  </div>
                  {showSearchHelp && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Search Tips:</h4>
                      <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                        <li>• Type "Q1" or "Question 1" to find specific questions by number</li>
                        <li>• Search question content, MCQ options, or essay answers</li>
                        <li>• Search by difficulty: "easy", "medium", "hard"</li>
                        <li>• Search by type: "mcq", "multiple choice", "essay"</li>
                        <li>• Search by topic if questions have topics assigned</li>
                      </ul>
                    </div>
                  )}
                </div>
                
                <div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Types</option>
                    <option value="mcq">Multiple Choice</option>
                    <option value="essay">Essay</option>
                  </select>
                </div>
                
                <div>
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-end">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredQuestions.length} of {questions.length} questions
                  </span>
                </div>
              </div>

              {/* Questions List */}
              {questionsLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-300">Loading questions...</p>
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <FileQuestion className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No questions found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchTerm || filterType !== 'all' || filterDifficulty !== 'all'
                      ? 'Try adjusting your search criteria'
                      : 'Add your first question to get started'
                    }
                  </p>
                  <Button onClick={() => handleTabChange('add')}>
                    Add Question
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map((question, index) => (
                    <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Q{index + 1} ({question.title})
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              question.type === 'mcq' 
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
                                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                            }`}>
                              {question.type === 'mcq' ? 'Multiple Choice' : 'Essay'}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              question.difficultyLevel === 'easy' 
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                : question.difficultyLevel === 'medium'
                                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                            }`}>
                              {question.difficultyLevel}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {question.points} points
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            Question {index + 1}
                          </h3>
                          
                          <div className="mb-2">
                            {question.content && (
                              <p className="text-gray-600 dark:text-gray-400 mb-2">
                                {question.content}
                              </p>
                            )}
                            
                            {question.imageUrl && (
                              <div className="mb-2">
                                <img
                                  src={question.imageUrl}
                                  alt="Question"
                                  className="max-w-md max-h-48 object-contain border rounded-lg"
                                />
                              </div>
                            )}
                            
                            {!question.content && !question.imageUrl && (
                              <p className="text-gray-500 dark:text-gray-400 italic">
                                No question content or image provided
                              </p>
                            )}
                          </div>
                          
                          {question.type === 'mcq' && 'options' in question && (
                            <div className="mt-2 space-y-1">
                              {question.options.map((option, optionIndex) => (
                                <div key={option.id} className={`text-sm p-2 rounded ${
                                  option.isCorrect 
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}>
                                  <span className="font-medium mr-2">
                                    {String.fromCharCode(65 + optionIndex)}.
                                  </span>
                                  {option.text || `Option ${String.fromCharCode(65 + optionIndex)}`}
                                  {option.isCorrect && (
                                    <CheckCircle className="inline w-4 h-4 ml-2 text-green-500" />
                                  )}
                                </div>
                              ))}
                              
                              {/* Show MCQ explanation */}
                              {question.explanation && (
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-400">
                                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Explanation:</h4>
                                  <p className="text-sm text-blue-700 dark:text-blue-400">{question.explanation}</p>
                                  
                                  {'explanationImageUrl' in question && question.explanationImageUrl && (
                                    <div className="mt-2">
                                      <img
                                        src={question.explanationImageUrl}
                                        alt="Explanation"
                                        className="max-w-md max-h-32 object-contain border rounded"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {question.type === 'essay' && (
                            <div className="mt-2">
                              {'suggestedAnswerContent' in question && question.suggestedAnswerContent && (
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded border-l-4 border-purple-400">
                                  <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">Suggested Answer:</h4>
                                  <p className="text-sm text-purple-700 dark:text-purple-400 whitespace-pre-wrap">{question.suggestedAnswerContent}</p>
                                  
                                  {'suggestedAnswerImageUrl' in question && question.suggestedAnswerImageUrl && (
                                    <div className="mt-2">
                                      <img
                                        src={question.suggestedAnswerImageUrl}
                                        alt="Suggested Answer"
                                        className="max-w-md max-h-32 object-contain border rounded"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {(!('suggestedAnswerContent' in question) || !question.suggestedAnswerContent) && 
                               'suggestedAnswerImageUrl' in question && question.suggestedAnswerImageUrl && (
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded border-l-4 border-purple-400">
                                  <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">Suggested Answer:</h4>
                                  <div className="mt-2">
                                    <img
                                      src={question.suggestedAnswerImageUrl}
                                      alt="Suggested Answer"
                                      className="max-w-md max-h-32 object-contain border rounded"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditQuestion(question)}
                            disabled={actionLoading === 'update'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(question)}
                            disabled={actionLoading === 'delete'}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Question Tab */}
          {selectedTab === 'add' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {editingQuestion ? 'Edit Question' : 'Create New Question'}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setQuestionType('mcq')}
                    disabled={!!editingQuestion} // Disable when editing
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      editingQuestion ? 'bg-gray-200 text-gray-500 cursor-not-allowed' :
                      questionType === 'mcq'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Multiple Choice
                  </button>
                  <button
                    onClick={() => setQuestionType('essay')}
                    disabled={!!editingQuestion} // Disable when editing
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      editingQuestion ? 'bg-gray-200 text-gray-500 cursor-not-allowed' :
                      questionType === 'essay'
                        ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Essay
                  </button>
                </div>
              </div>
              
              <QuestionForm
                questionType={questionType}
                onSubmit={handleFormSubmit}
                subjectId={questionBank.subjectId}
                subjectName={questionBank.subjectName}
                loading={actionLoading === 'create' || actionLoading === 'update'}
                currentQuestionCounts={{
                  mcqCount: questionBank.mcqCount || 0,
                  essayCount: questionBank.essayCount || 0
                }}
                editingQuestion={editingQuestion}
                onCancel={() => handleTabChange('view')}
              />
              {/* Debug info */}
              <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
                Debug: MCQ Count = {questionBank.mcqCount || 0}, Essay Count = {questionBank.essayCount || 0}
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && questionToDelete && (
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onClose={() => {
              setShowDeleteConfirm(false);
              setQuestionToDelete(null);
            }}
            onConfirm={handleDeleteQuestion}
            isLoading={actionLoading === 'delete'}
            title="Delete Question"
            description={`Are you sure you want to delete "${questionToDelete.title}"? This action cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
          />
        )}
      </div>
    </TeacherLayout>
  );
}