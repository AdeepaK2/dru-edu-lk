"use client";

import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { firestore } from '@/utils/firebase-client';
import Link from 'next/link';
import { questionService, questionBankService } from '@/apiservices/questionBankFirestoreService';
import { Question, QuestionBank, MCQQuestion, EssayQuestion } from '@/models/questionBankSchema';
import { ArrowLeft, CheckCircle, FileText, Plus, Package } from 'lucide-react';

// Define subject data structure that extends QuestionBank 
interface SubjectWithQuestionCount extends QuestionBank {
  questionCount: number;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithQuestionCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    subjectId: '',
    type: '',
    difficulty: ''
  });
  const [activeView, setActiveView] = useState<'subjects' | 'questions'>('subjects');
  const [selectedSubject, setSelectedSubject] = useState<SubjectWithQuestionCount | null>(null);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [questionType, setQuestionType] = useState<'mcq' | 'essay'>('mcq');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get authentication token on initial load
  useEffect(() => {
    const fetchAuthToken = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          const token = await user.getIdToken();
          setAuthToken(token);
        } else {
          console.error("No authenticated user found");
          setError("You must be logged in to access this page");
        }
      } catch (err: any) {
        console.error("Error getting auth token:", err);
        setError("Authentication error. Please try logging in again.");
      }
    };
    
    fetchAuthToken();
  }, []);

  // Fetch question banks to use as subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!authToken) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const banks = await questionBankService.listQuestionBanks();
        
        // Transform question banks into subjects with question counts
        const subjectsData = banks.map(bank => ({
          ...bank,
          questionCount: bank.totalQuestions
        }));
        
        setSubjects(subjectsData);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching subjects:", err);
        setError("Failed to load subjects. Please try again.");
        setLoading(false);
      }
    };
    
    fetchSubjects();
  }, [authToken]);

  // Fetch questions based on filters
  useEffect(() => {
    if (activeView !== 'questions' || !selectedSubject) return;
    
    const fetchQuestions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // First get the full question bank to get question IDs
        const questionBank = await questionBankService.getQuestionBank(selectedSubject.id);
        
        if (!questionBank || !questionBank.questionIds || questionBank.questionIds.length === 0) {
          // Empty question bank
          setQuestions([]);
          setLoading(false);
          return;
        }
        
        // Now fetch all the questions in this bank
        const questionPromises = questionBank.questionIds.map(id => 
          questionService.getQuestion(id)
        );
        
        const fetchedQuestions = await Promise.all(questionPromises);
        // Filter out null values (in case some questions weren't found)
        const validQuestions = fetchedQuestions.filter(q => q !== null) as Question[];
        
        // Apply additional filters
        let filteredQuestions = validQuestions;
        
        if (filter.type) {
          filteredQuestions = filteredQuestions.filter(q => q.type === filter.type);
        }
        
        if (filter.difficulty) {
          filteredQuestions = filteredQuestions.filter(q => q.difficultyLevel === filter.difficulty);
        }
        
        setQuestions(filteredQuestions);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching questions:", err);
        setError("Failed to load questions. Please try again.");
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, [selectedSubject, activeView, filter, authToken]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Delete the question from Firestore
      await questionService.deleteQuestion(id);
      
      // Remove the question from the local state
      setQuestions(prev => prev.filter(q => q.id !== id));
      
      // Update the question count in the selected subject
      if (selectedSubject) {
        const updatedSubject = {
          ...selectedSubject,
          questionCount: selectedSubject.questionCount - 1
        };
        setSelectedSubject(updatedSubject);
        
        // Also update in the subjects list
        setSubjects(prev => 
          prev.map(subject => 
            subject.id === selectedSubject.id ? updatedSubject : subject
          )
        );
      }
    } catch (err: any) {
      console.error("Error deleting question:", err);
      alert(`Error: ${err.message || 'Failed to delete question'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle subject selection
  const handleSelectSubject = (subject: SubjectWithQuestionCount) => {
    setSelectedSubject(subject);
    setActiveView('questions');
    setFilter({
      ...filter, 
      subjectId: subject.id
    });
  };

  // Handle adding a new question
  const toggleAddQuestionModal = () => {
    setShowAddQuestionModal(!showAddQuestionModal);
  };

  const handleQuestionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setQuestionType(e.target.value as 'mcq' | 'essay');
  };

  const handleQuestionSubmit = async (questionData: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      
      // Create the question in Firestore
      const questionId = await questionService.createQuestion(questionData);
      
      if (!selectedSubject) {
        throw new Error("No subject selected");
      }
      
      // Add the question to the question bank
      await questionBankService.addQuestionsToBank(selectedSubject.id, [questionId]);
      
      // Fetch the created question with its ID
      const createdQuestion = await questionService.getQuestion(questionId);
      
      if (!createdQuestion) {
        throw new Error("Failed to retrieve created question");
      }
      
      // Add the new question to our questions state
      setQuestions(prevQuestions => [...prevQuestions, createdQuestion]);
      
      // Update the question count in the selected subject
      const updatedSubject = {
        ...selectedSubject,
        questionCount: selectedSubject.questionCount + 1
      };
      setSelectedSubject(updatedSubject);
      
      // Also update in the subjects list
      setSubjects(prev => 
        prev.map(subject => 
          subject.id === selectedSubject.id ? updatedSubject : subject
        )
      );
      
      // Close the modal
      setShowAddQuestionModal(false);
      
      alert('Question added successfully!');
    } catch (err: any) {
      console.error("Error adding question:", err);
      alert(`Error: ${err.message || 'Failed to add question'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Question Banks</h1>            <div className="mt-1 flex items-center">
              <Link href="/admin/question-banks" className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                <Package className="h-4 w-4 mr-1" />
                Manage Question Banks
              </Link>
            </div>
            {selectedSubject && (              <div className="flex items-center mt-2">
                <button
                  onClick={() => setActiveView('subjects')}
                  className="text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Question Banks
                </button>
                <span className="mx-2 text-gray-500">/</span>
                <span className="text-gray-700">{selectedSubject.name} {selectedSubject.grade && `(${selectedSubject.grade})`}</span>
              </div>
            )}
          </div>

          {selectedSubject && (
            <div className="flex space-x-3">              <button 
                onClick={() => {
                  setQuestionType('mcq');
                  toggleAddQuestionModal();
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Add MCQ
              </button>              <button 
                onClick={() => {
                  setQuestionType('essay');
                  toggleAddQuestionModal();
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <FileText className="h-5 w-5 mr-2" />
                Add Essay
              </button>
            </div>
          )}
        </div>

        {/* Subject Selection View */}
        {activeView === 'subjects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && (
              <div className="col-span-3 text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading question banks...</p>
              </div>
            )}
            
            {error && (
              <div className="col-span-3 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
                <p>{error}</p>
              </div>
            )}
            
            {!loading && !error && subjects.length === 0 && (
              <div className="col-span-3 text-center py-8">
                <p className="text-gray-500">No question banks found. Please create a question bank first.</p>
                <Link 
                  href="/admin/question-banks" 
                  className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                >
                  Create Question Bank
                </Link>
              </div>
            )}
            
            {!loading && !error && subjects.map((subject) => (
              <div 
                key={subject.id} 
                onClick={() => handleSelectSubject(subject)}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer transition-transform transform hover:scale-105 border border-transparent hover:border-blue-500"
              >
                <div className="mb-2 flex justify-between items-start">
                  <h3 className="text-xl font-semibold text-gray-800">{subject.name}</h3>
                  {subject.grade && (
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {subject.grade}
                    </span>
                  )}
                </div>
                <div className="mb-4 text-sm text-gray-600">
                  {subject.description || "No description available"}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {subject.questionCount} Questions ({subject.mcqCount} MCQ, {subject.essayCount} Essay)
                  </span>
                  <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                    View Questions
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Questions List View */}
        {activeView === 'questions' && (
          <>
            {/* Question Type Tabs */}
            <div className="flex mb-6 space-x-4">
              <button
                onClick={() => setFilter(prev => ({ ...prev, type: '' }))}
                className={`px-6 py-3 rounded-lg font-medium text-sm ${
                  filter.type === '' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                All Questions
              </button>
              <button
                onClick={() => setFilter(prev => ({ ...prev, type: 'mcq' }))}
                className={`px-6 py-3 rounded-lg font-medium text-sm ${
                  filter.type === 'mcq' 
                  ? 'bg-green-600 text-white shadow-md' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Multiple Choice
              </button>
              <button
                onClick={() => setFilter(prev => ({ ...prev, type: 'essay' }))}
                className={`px-6 py-3 rounded-lg font-medium text-sm ${
                  filter.type === 'essay' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Essay Questions
              </button>
            </div>

            {/* Difficulty Filter */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Difficulty</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setFilter(prev => ({ ...prev, difficulty: '' }))}
                  className={`px-4 py-2 rounded-md text-sm ${
                    filter.difficulty === '' ? 'bg-gray-200 font-medium' : 'bg-white border border-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter(prev => ({ ...prev, difficulty: 'easy' }))}
                  className={`px-4 py-2 rounded-md text-sm ${
                    filter.difficulty === 'easy' ? 'bg-green-100 text-green-800 font-medium' : 'bg-white border border-gray-200'
                  }`}
                >
                  Easy
                </button>
                <button
                  onClick={() => setFilter(prev => ({ ...prev, difficulty: 'medium' }))}
                  className={`px-4 py-2 rounded-md text-sm ${
                    filter.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800 font-medium' : 'bg-white border border-gray-200'
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setFilter(prev => ({ ...prev, difficulty: 'hard' }))}
                  className={`px-4 py-2 rounded-md text-sm ${
                    filter.difficulty === 'hard' ? 'bg-red-100 text-red-800 font-medium' : 'bg-white border border-gray-200'
                  }`}
                >
                  Hard
                </button>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading questions...</p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
                <p>{error}</p>
              </div>
            )}

            {/* Questions list */}
            {!loading && !error && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {/* MCQ Questions Table */}
                {(filter.type === '' || filter.type === 'mcq') && questions.filter(q => q.type === 'mcq').length > 0 && (
                  <div className="mb-8">
                    <div className="bg-green-50 px-6 py-3 border-b border-green-200">
                      <h3 className="text-lg font-medium text-green-800">Multiple Choice Questions</h3>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Topic
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Difficulty
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Options
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Points
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">                        {questions.filter(q => q.type === 'mcq').map((question) => {
                          const mcqQuestion = question as MCQQuestion;
                          const correctOption = mcqQuestion.options.find(opt => opt.isCorrect);
                          
                          return (
                            <tr key={question.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                <div className="max-w-xs truncate">{question.title}</div>
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                  {question.content ? question.content.substring(0, 50) + '...' : 'No content - Image only'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div>
                                  {question.topic || <span className="text-gray-400">Not specified</span>}
                                  {question.reference && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                        Ref: {question.reference}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  question.difficultyLevel === 'easy' ? 'bg-green-100 text-green-800' :
                                  question.difficultyLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {question.difficultyLevel.charAt(0).toUpperCase() + question.difficultyLevel.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div className="space-y-1">
                                  {mcqQuestion.options.slice(0, 2).map((option, optionIndex) => (
                                    <div key={option.id} className={option.isCorrect 
                                      ? "text-green-700 font-medium flex items-center" 
                                      : "text-gray-600 flex items-center"}>                                      {option.isCorrect && (
                                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                                      )}
                                      <span className={option.isCorrect ? "px-2 py-1 bg-green-50 border border-green-200 rounded" : ""}>
                                        {(option.text || `Option ${String.fromCharCode(65 + optionIndex)}`).substring(0, 20)}{(option.text || `Option ${String.fromCharCode(65 + optionIndex)}`).length > 20 ? '...' : ''}
                                      </span>
                                    </div>
                                  ))}
                                  {mcqQuestion.options.length > 2 && (
                                    <div className="text-gray-400 text-xs">
                                      +{mcqQuestion.options.length - 2} more options
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {question.points}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  <Link 
                                    href={`/admin/question/edit/${question.id}`}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    Edit
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteQuestion(question.id)}
                                    className="text-red-600 hover:text-red-900"
                                    disabled={isDeleting}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* Essay Questions Table */}
                {(filter.type === '' || filter.type === 'essay') && questions.filter(q => q.type === 'essay').length > 0 && (
                  <div>
                    <div className="bg-purple-50 px-6 py-3 border-b border-purple-200">
                      <h3 className="text-lg font-medium text-purple-800">Essay Questions</h3>
                    </div>                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Topic
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Difficulty
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Points
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">                        {questions.filter(q => q.type === 'essay').map((question) => {
                          const essayQuestion = question as EssayQuestion;
                          
                          return (
                            <tr key={question.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                <div className="max-w-xs truncate">{question.title}</div>
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                  {question.content ? question.content.substring(0, 50) + '...' : 'No content - Image only'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div>
                                  {question.topic || <span className="text-gray-400">Not specified</span>}
                                  {question.reference && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                        Ref: {question.reference}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  question.difficultyLevel === 'easy' ? 'bg-green-100 text-green-800' :
                                  question.difficultyLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {question.difficultyLevel.charAt(0).toUpperCase() + question.difficultyLevel.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {question.points}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  <Link 
                                    href={`/admin/question/edit/${question.id}`}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    Edit
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteQuestion(question.id)}
                                    className="text-red-600 hover:text-red-900"
                                    disabled={isDeleting}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* No Questions Message */}
                {questions.length === 0 && (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No questions found for this question bank. Click 'Add MCQ' or 'Add Essay' to create one.
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        {/* Add Question Modal */}
        {showAddQuestionModal && selectedSubject && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={toggleAddQuestionModal}></div>
              
              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Add New {questionType === 'mcq' ? 'Multiple Choice' : 'Essay'} Question 
                        to {selectedSubject?.name} {selectedSubject?.grade && `(${selectedSubject.grade})`}
                      </h3>
                      
              
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={toggleAddQuestionModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
