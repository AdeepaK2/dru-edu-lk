'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle, Plus, BookOpen, Edit, Trash2 } from 'lucide-react';
import { QuestionBank, Question } from '@/models/questionBankSchema';
import { questionBankService, questionService } from '@/apiservices/questionBankFirestoreService';
import { Button, ConfirmDialog } from '@/components/ui';

export default function QuestionBankDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bankId = params.id as string;
  
  const [questionBank, setQuestionBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    type: '',
    difficulty: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Load question bank details and questions
  useEffect(() => {
    const loadQuestionBankData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch question bank details
        const bank = await questionBankService.getQuestionBank(bankId);
        if (!bank) {
          throw new Error('Question bank not found');
        }
        
        setQuestionBank(bank);
        
        // Fetch all questions in this bank
        if (bank.questionIds && bank.questionIds.length > 0) {
          const questionPromises = bank.questionIds.map(questionId => 
            questionService.getQuestion(questionId)
          );
          
          const fetchedQuestions = await Promise.all(questionPromises);
          const validQuestions = fetchedQuestions.filter(q => q !== null) as Question[];
          
          // Apply filters
          let filteredQuestions = [...validQuestions];
          
          if (filter.type) {
            filteredQuestions = filteredQuestions.filter(q => q.type === filter.type);
          }
          
          if (filter.difficulty) {
            filteredQuestions = filteredQuestions.filter(q => q.difficultyLevel === filter.difficulty);
          }
          
          setQuestions(filteredQuestions);
        } else {
          setQuestions([]);
        }
        
      } catch (err: any) {
        console.error("Error loading question bank:", err);
        setError(`Error: ${err.message || 'Failed to load question bank'}`);
      } finally {
        setLoading(false);
      }
    };
      loadQuestionBankData();
  }, [bankId, filter]);

  // Handle filter changes
  const handleFilterChange = (type: keyof typeof filter, value: string) => {
    setFilter(prev => ({
      ...prev,
      [type]: value === prev[type] ? '' : value // Toggle filter off if already active
    }));
  };

  // Handle removing a question from the bank
  const handleRemoveQuestionClick = (question: Question) => {
    setQuestionToDelete(question);
    setShowDeleteConfirm(true);
  };

  const handleRemoveQuestion = async () => {
    if (!questionToDelete) return;
    
    setActionLoading('remove');
    
    try {
      // Remove question from the bank
      await questionBankService.removeQuestionsFromBank(bankId, [questionToDelete.id]);
      
      // Update local state
      setQuestions(prev => prev.filter(q => q.id !== questionToDelete.id));
      
      if (questionBank) {
        const updatedBank = { ...questionBank };
        updatedBank.questionIds = questionBank.questionIds.filter(id => id !== questionToDelete.id);
        updatedBank.totalQuestions--;
        
        // Update counts based on question type
        if (questionToDelete.type === 'mcq') {
          updatedBank.mcqCount = Math.max(0, updatedBank.mcqCount - 1);
        } else if (questionToDelete.type === 'essay') {
          updatedBank.essayCount = Math.max(0, updatedBank.essayCount - 1);
        }
        
        setQuestionBank(updatedBank);
      }

      // Close confirmation dialog
      setShowDeleteConfirm(false);
      setQuestionToDelete(null);
      
    } catch (err: any) {
      console.error("Error removing question:", err);
      setError(`Error: ${err.message || 'Failed to remove question'}`);
    } finally {      setActionLoading(null);
    }
  };

  // Function to get letter option (A, B, C) from option index
  const getOptionLetter = (index: number) => {
    return String.fromCharCode(65 + index); // A = 65 in ASCII
  };

  if (loading) {
    return (
      <div className="px-6 py-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading question bank...</p>
        </div>
      </div>
    );
  }

  if (error || !questionBank) {
    return (
      <div className="px-6 py-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
            <p>{error || 'Question bank not found'}</p>
          </div>
          <div className="mt-6">
            <Link href="/admin/question-banks" className="text-blue-600 hover:text-blue-800 font-medium">
              &larr; Back to Question Banks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">          <div className="flex items-center mb-2">
            <Link href="/admin/question-banks" className="text-blue-600 hover:text-blue-800 flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Question Banks
            </Link>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{questionBank.name}</h1>
              <div className="mt-2 flex items-center">
                <span className="text-gray-600 mr-2">{questionBank.subjectName}</span>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {questionBank.grade}
                </span>
              </div>
              {questionBank.description && (
                <p className="text-gray-600 mt-2 max-w-2xl">{questionBank.description}</p>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                onClick={() => router.push(`/admin/question-banks/${bankId}/add-questions`)}
              >
                Add Questions
              </Button>
              <Button
                variant="primary"
                onClick={() => router.push(`/admin/question-banks/${bankId}/assign`)}
              >
                Assign to Class
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-6 max-w-md">
            <div className="bg-gray-100 p-4 rounded-lg text-center">
              <span className="block text-2xl font-bold text-gray-700">{questionBank.totalQuestions}</span>
              <span className="text-sm text-gray-500">Total Questions</span>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <span className="block text-2xl font-bold text-green-700">{questionBank.mcqCount}</span>
              <span className="text-sm text-green-600">Multiple Choice</span>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <span className="block text-2xl font-bold text-purple-700">{questionBank.essayCount}</span>
              <span className="text-sm text-purple-600">Essay</span>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Filters</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => handleFilterChange('type', 'mcq')}
              className={`px-4 py-2 rounded-md text-sm ${
                filter.type === 'mcq' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Multiple Choice
            </button>
            <button
              onClick={() => handleFilterChange('type', 'essay')}
              className={`px-4 py-2 rounded-md text-sm ${
                filter.type === 'essay' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Essay
            </button>
            <button
              onClick={() => handleFilterChange('difficulty', 'easy')}
              className={`px-4 py-2 rounded-md text-sm ${
                filter.difficulty === 'easy' 
                  ? 'bg-green-100 text-green-800 font-medium' 
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => handleFilterChange('difficulty', 'medium')}
              className={`px-4 py-2 rounded-md text-sm ${
                filter.difficulty === 'medium' 
                  ? 'bg-yellow-100 text-yellow-800 font-medium' 
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => handleFilterChange('difficulty', 'hard')}
              className={`px-4 py-2 rounded-md text-sm ${
                filter.difficulty === 'hard' 
                  ? 'bg-red-100 text-red-800 font-medium' 
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Hard
            </button>
          </div>
        </div>
          {/* Questions List */}
        {questions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {questionBank?.questionIds.length === 0 
                ? 'This question bank has no questions yet.' 
                : 'No questions found matching your filters.'
              }
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => router.push(`/admin/question-banks/${bankId}/add-questions`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Questions
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((question) => (
              <div 
                key={question.id} 
                className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200"
              >
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        question.type === 'mcq' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {question.type === 'mcq' ? 'Multiple Choice' : 'Essay'}
                      </span>
                      
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        question.difficultyLevel === 'easy' ? 'bg-green-100 text-green-800' :
                        question.difficultyLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {question.difficultyLevel.charAt(0).toUpperCase() + question.difficultyLevel.slice(1)}
                      </span>
                      
                      {question.topic && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {question.topic}
                        </span>
                      )}
                      
                      {question.reference && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Ref: {question.reference}
                        </span>
                      )}
                      
                      <span className="text-sm text-gray-500">
                        {question.points} points
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/question/edit/${question.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveQuestionClick(question)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-gray-900 mt-3">{question.title}</h3>
                  <p className="text-gray-700 mt-2">{question.content}</p>
                  
                  {question.imageUrl && (
                    <div className="mt-4">
                      <Image 
                        src={question.imageUrl} 
                        alt="Question image"
                        width={400}
                        height={200}
                        className="rounded-md object-contain"
                      />
                    </div>
                  )}
                  
                  {/* MCQ Options */}
                  {question.type === 'mcq' && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Options:</h4>
                      <div className="grid gap-2">
                        {question.options.map((option, index) => (
                          <div 
                            key={option.id}
                            className={`flex items-center p-3 rounded-md ${
                              option.isCorrect 
                                ? 'bg-green-50 border border-green-200' 
                                : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <span className={`flex items-center justify-center h-6 w-6 rounded-full mr-3 text-xs font-medium ${
                              option.isCorrect
                                ? 'bg-green-200 text-green-800'
                                : 'bg-gray-200 text-gray-800'
                            }`}>
                              {getOptionLetter(index)}
                            </span>
                            <span>{option.text}</span>
                            {option.isCorrect && (
                              <CheckCircle className="h-5 w-5 ml-auto text-green-600" />
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 bg-gray-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-gray-700">Explanation:</h4>
                        <p className="text-gray-600 mt-1">{question.explanation}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Essay Details */}
                  {question.type === 'essay' && (
                    <div className="mt-4 space-y-4">
                      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 rounded-md">
                        <div>
                          <span className="text-sm text-gray-500">Word Requirements:</span>
                          <span className="ml-2 font-medium">Min: {question.minWordCount}, Max: {question.wordLimit}</span>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-gray-700">Suggested Answer:</h4>
                        <p className="text-gray-600 mt-1">{question.suggestedAnswerContent}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && questionToDelete && (
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onClose={() => {
              setShowDeleteConfirm(false);
              setQuestionToDelete(null);
            }}
            onConfirm={handleRemoveQuestion}
            isLoading={actionLoading === 'remove'}
            title="Remove Question"
            description={`Are you sure you want to remove "${questionToDelete.title}" from this question bank? The question itself will not be deleted.`}
            confirmText="Remove"
            cancelText="Cancel"
            variant="danger"
          />
        )}
      </div>
    </div>
  );
}
