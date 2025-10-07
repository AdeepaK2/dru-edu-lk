'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  FileText,
  User,
  Calendar,
  Target,
  Award,
  Edit3
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { TestService } from '@/apiservices/testService';
import { SubmissionService } from '@/apiservices/submissionService';
import { Test } from '@/models/testSchema';
import { StudentSubmission, FinalAnswer } from '@/models/studentSubmissionSchema';

export default function IndividualResultPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;
  const submissionId = params.submissionId as string;

  const [test, setTest] = useState<Test | null>(null);
  const [submission, setSubmission] = useState<StudentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEssay, setEditingEssay] = useState<string | null>(null);
  const [essayGrades, setEssayGrades] = useState<{[key: string]: {score: number, feedback: string}}>({});

  useEffect(() => {
    if (testId && submissionId) {
      loadSubmissionDetails();
    }
  }, [testId, submissionId]);

  const loadSubmissionDetails = async () => {
    try {
      setLoading(true);
      
      // Load test data
      const testData = await TestService.getTest(testId);
      if (!testData) {
        throw new Error('Test not found');
      }

      // Enhance test data with full question details if needed
      if (testData.questions && testData.questions.length > 0) {
        console.log('🔍 Loading full question details for individual submission...');
        
        try {
          // Import questionService
          const { questionService } = await import('@/apiservices/questionBankFirestoreService');
          
          // Load full question details for each question
          const enhancedQuestions = await Promise.all(
            testData.questions.map(async (testQuestion) => {
              try {
                // Get the question ID (could be in questionId or id field)
                const questionId = testQuestion.questionId || testQuestion.id;
                
                // If the question already has full details (imageUrl, options, etc.), use it as is
                if (testQuestion.imageUrl || (testQuestion.options && testQuestion.options.length > 0)) {
                  return testQuestion;
                }
                
                // Otherwise, fetch full question details from question bank
                if (questionId) {
                  console.log('📥 Fetching full details for question:', questionId);
                  const fullQuestion = await questionService.getQuestion(questionId);
                  
                  if (fullQuestion) {
                    // Merge test question data with full question details
                    return {
                      ...testQuestion,
                      questionText: fullQuestion.content || fullQuestion.title || testQuestion.questionText,
                      imageUrl: fullQuestion.imageUrl,
                      options: fullQuestion.type === 'mcq' && 'options' in fullQuestion 
                        ? fullQuestion.options?.map((opt: any) => opt.text) || testQuestion.options
                        : testQuestion.options,
                      correctOption: fullQuestion.type === 'mcq' && 'options' in fullQuestion
                        ? fullQuestion.options?.findIndex((opt: any) => opt.isCorrect) ?? testQuestion.correctOption
                        : testQuestion.correctOption,
                      explanation: fullQuestion.type === 'mcq' && 'explanation' in fullQuestion 
                        ? fullQuestion.explanation || testQuestion.explanation
                        : testQuestion.explanation,
                      explanationImageUrl: fullQuestion.type === 'mcq' && 'explanationImageUrl' in fullQuestion
                        ? fullQuestion.explanationImageUrl || testQuestion.explanationImageUrl
                        : testQuestion.explanationImageUrl,
                      difficultyLevel: fullQuestion.difficultyLevel || testQuestion.difficultyLevel,
                      points: fullQuestion.points || testQuestion.points,
                    };
                  }
                }
                
                return testQuestion;
              } catch (questionError) {
                console.warn('⚠️ Failed to load full details for question:', testQuestion.questionId || testQuestion.id, questionError);
                return testQuestion;
              }
            })
          );
          
          // Update test data with enhanced questions
          testData.questions = enhancedQuestions;
          console.log('✅ Enhanced questions with full details for individual submission');
          
        } catch (enhanceError) {
          console.warn('⚠️ Failed to enhance questions with full details:', enhanceError);
          // Continue with original test data if enhancement fails
        }
      }

      setTest(testData);

      // Load submission data
      const submissionData = await SubmissionService.getSubmission(submissionId);
      if (!submissionData) {
        throw new Error('Submission not found');
      }
      setSubmission(submissionData);

      // Initialize essay grades if any exist
      const initialGrades: {[key: string]: {score: number, feedback: string}} = {};
      submissionData.essayResults?.forEach(result => {
        initialGrades[result.questionId] = {
          score: result.marksAwarded || 0,
          feedback: result.feedback || ''
        };
      });
      setEssayGrades(initialGrades);

      console.log('✅ Submission details loaded:', {
        test: testData.title,
        student: submissionData.studentName,
        score: submissionData.percentage,
        questionsWithImages: testData.questions?.filter(q => q.imageUrl).length || 0
      });
    } catch (error) {
      console.error('Error loading submission details:', error);
      alert('Failed to load submission details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp: any) => {
    let date: Date;
    
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (timestamp && timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date();
    }
    
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const getQuestionFromTest = (questionId: string) => {
    return test?.questions?.find(q => q.id === questionId);
  };

  const saveEssayGrade = async (questionId: string) => {
    if (!submission || !test) return;

    const grade = essayGrades[questionId];
    if (!grade) return;

    try {
      await SubmissionService.gradeEssayQuestion(
        submission.id,
        questionId,
        grade.score,
        grade.feedback,
        'teacher-id' // You should get this from your auth context
      );
      
      setEditingEssay(null);
      await loadSubmissionDetails(); // Reload to get updated data
      alert('Essay graded successfully!');
    } catch (error) {
      console.error('Error grading essay:', error);
      alert('Failed to save grade. Please try again.');
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!test || !submission) {
    return (
      <TeacherLayout>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Submission Not Found
          </h2>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-500"
          >
            Go back
          </button>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {submission.studentName}'s Result
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {test.title}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {submission.percentage || 0}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {submission.autoGradedScore || 0}/{submission.maxScore || 0} marks
              </div>
            </div>
          </div>
        </div>

        {/* Student Info & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <User className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Student Info
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                <p className="text-gray-900 dark:text-white">{submission.studentName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                <p className="text-gray-900 dark:text-white">{submission.studentEmail || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Class</label>
                <p className="text-gray-900 dark:text-white">{submission.className}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Clock className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Timing
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Started</label>
                <p className="text-gray-900 dark:text-white">{formatDateTime(submission.startTime)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Submitted</label>
                <p className="text-gray-900 dark:text-white">{formatDateTime(submission.submittedAt)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Time Spent</label>
                <p className="text-gray-900 dark:text-white">{formatTime(submission.totalTimeSpent || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Award className="h-5 w-5 text-purple-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Performance
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                <div className="flex items-center mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    submission.passStatus === 'passed' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : submission.passStatus === 'failed'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}>
                    {submission.passStatus === 'passed' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {submission.passStatus === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                    {submission.passStatus === 'pending_review' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {submission.passStatus === 'passed' ? 'Passed' : 
                     submission.passStatus === 'failed' ? 'Failed' : 'Pending Review'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Attempted</label>
                <p className="text-gray-900 dark:text-white">
                  {submission.questionsAttempted || 0}/{test.questions?.length || 0} questions
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Attempt #</label>
                <p className="text-gray-900 dark:text-white">{submission.attemptNumber || 1}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Question by Question Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Question by Question Analysis
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Detailed breakdown of student responses
            </p>
          </div>
          
          <div className="p-6">
            <div className="space-y-6">
              {submission.finalAnswers?.map((answer: FinalAnswer, index: number) => {
                const testQuestion = getQuestionFromTest(answer.questionId);
                const isEssay = answer.questionType === 'essay';
                const isEditing = editingEssay === answer.questionId;

                return (
                  <div key={answer.questionId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Question {index + 1}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            answer.questionType === 'mcq' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                          }`}>
                            {answer.questionType?.toUpperCase() || 'UNKNOWN'}
                          </span>
                          {answer.isCorrect ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                          {answer.questionText}
                        </h4>
                        
                        {/* Question Image */}
                        {testQuestion?.imageUrl && (
                          <div className="mb-4">
                            <img
                              src={testQuestion.imageUrl}
                              alt={`Question ${index + 1}`}
                              className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
                              style={{ maxHeight: '400px' }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {answer.marksAwarded || 0}/{answer.questionMarks || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          marks
                        </div>
                      </div>
                    </div>

                    {/* MCQ Answer */}
                    {answer.questionType === 'mcq' && testQuestion && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
                            Student's Answer:
                          </label>
                          <div className={`p-3 rounded-lg border ${
                            answer.isCorrect 
                              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                          }`}>
                            <p className="text-gray-900 dark:text-white">
                              {answer.selectedOptionText || 'No answer selected'}
                            </p>
                          </div>
                        </div>
                        
                        {testQuestion.options && (
                          <div>
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
                              All Options:
                            </label>
                            <div className="space-y-2">
                              {testQuestion.options?.map((option: any, optIndex: number) => {
                                // Handle both string arrays and object arrays
                                const optionText = typeof option === 'string' ? option : (option as any)?.text || String(option);
                                
                                return (
                                  <div 
                                    key={optIndex}
                                    className={`p-2 rounded border text-sm ${
                                      optIndex === testQuestion.correctOption
                                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 text-green-900 dark:text-green-100'
                                        : optIndex === (answer.selectedOption || -1)
                                        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-red-900 dark:text-red-100'
                                        : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    <span className="font-medium">
                                      {String.fromCharCode(65 + optIndex)}.
                                    </span>{' '}
                                    {optionText}
                                    {optIndex === testQuestion.correctOption && (
                                      <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                        (Correct)
                                      </span>
                                    )}
                                    {optIndex === (answer.selectedOption || -1) && optIndex !== testQuestion.correctOption && (
                                      <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                                        (Student's Choice)
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Explanation */}
                        {testQuestion.explanation && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                            <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Explanation:</h5>
                            <p className="text-sm text-blue-800 dark:text-blue-200">{testQuestion.explanation}</p>
                            {testQuestion.explanationImageUrl && (
                              <img
                                src={testQuestion.explanationImageUrl}
                                alt="Explanation"
                                className="mt-2 max-w-full h-auto rounded border border-blue-200 dark:border-blue-600"
                                style={{ maxHeight: '300px' }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Essay Answer */}
                    {answer.questionType === 'essay' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
                            Student's Response:
                          </label>
                          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700">
                            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                              {answer.textContent || 'No response provided'}
                            </p>
                          </div>
                        </div>

                        {/* Grading Section */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          {isEditing ? (
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Score (out of {answer.questionMarks || 0})
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={answer.questionMarks || 0}
                                  value={essayGrades[answer.questionId]?.score || 0}
                                  onChange={(e) => setEssayGrades(prev => ({
                                    ...prev,
                                    [answer.questionId]: {
                                      ...prev[answer.questionId],
                                      score: parseInt(e.target.value) || 0
                                    }
                                  }))}
                                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Feedback
                                </label>
                                <textarea
                                  value={essayGrades[answer.questionId]?.feedback || ''}
                                  onChange={(e) => setEssayGrades(prev => ({
                                    ...prev,
                                    [answer.questionId]: {
                                      ...prev[answer.questionId],
                                      feedback: e.target.value
                                    }
                                  }))}
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="Enter feedback for the student..."
                                />
                              </div>
                              <div className="flex space-x-3">
                                <button
                                  onClick={() => saveEssayGrade(answer.questionId)}
                                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                                >
                                  Save Grade
                                </button>
                                <button
                                  onClick={() => setEditingEssay(null)}
                                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                {submission.essayResults?.find(r => r.questionId === answer.questionId)?.feedback ? (
                                  <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Teacher Feedback:
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {submission.essayResults?.find(r => r.questionId === answer.questionId)?.feedback}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No feedback provided yet
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setEditingEssay(answer.questionId);
                                  if (!essayGrades[answer.questionId]) {
                                    setEssayGrades(prev => ({
                                      ...prev,
                                      [answer.questionId]: {
                                        score: answer.marksAwarded || 0,
                                        feedback: submission.essayResults?.find(r => r.questionId === answer.questionId)?.feedback || ''
                                      }
                                    }));
                                  }
                                }}
                                className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                              >
                                <Edit3 className="h-4 w-4 mr-1" />
                                {submission.essayResults?.find(r => r.questionId === answer.questionId)?.feedback ? 'Edit Grade' : 'Grade'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Integrity Report */}
        {submission.integrityReport && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Integrity Report
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Test-taking behavior analysis
              </p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tab Switches
                    </span>
                    <span className={`text-lg font-bold ${
                      submission.integrityReport.tabSwitches > 5 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {submission.integrityReport.tabSwitches}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Disconnections
                    </span>
                    <span className={`text-lg font-bold ${
                      submission.integrityReport.disconnections > 2 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {submission.integrityReport.disconnections}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Integrity Status
                    </span>
                    <span className={`text-sm font-bold ${
                      submission.integrityReport.isIntegrityCompromised ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {submission.integrityReport.isIntegrityCompromised ? 'Compromised' : 'Clear'}
                    </span>
                  </div>
                </div>
              </div>
              
              {submission.integrityReport.suspiciousActivities && 
               submission.integrityReport.suspiciousActivities.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Suspicious Activities:
                  </h4>
                  <ul className="space-y-2">
                    {submission.integrityReport.suspiciousActivities.map((activity, index) => (
                      <li key={index} className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        {activity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {submission.integrityReport.notes && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Additional Notes:
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {submission.integrityReport.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
