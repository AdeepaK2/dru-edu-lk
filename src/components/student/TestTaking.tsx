'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Circle,
  ArrowLeft,
  ArrowRight,
  Send,
  Eye,
  Timer,
  Book,
  FileText
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { TestService } from '@/apiservices/testService';
import { 
  Test, 
  TestAttempt, 
  TestQuestion, 
  StudentAnswer,
  MCQAnswer,
  EssayAnswer 
} from '@/models/testSchema';
import { Timestamp } from 'firebase/firestore';

export default function StudentTestTaking() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;
  
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // Mock student data - replace with actual auth
  const studentId = 'student123';
  const studentName = 'John Doe';
  const classId = 'class1';

  useEffect(() => {
    initializeTest();
  }, [testId]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const initializeTest = async () => {
    try {
      setLoading(true);
      
      // Get test details
      const testData = await TestService.getTest(testId);
      if (!testData) {
        router.push('/student/dashboard');
        return;
      }
      setTest(testData);

      // Check if student already has an attempt
      let attemptData = await TestService.getStudentTestAttempt(testId, studentId);
      
      if (!attemptData) {
        // Start new attempt
        const attemptId = await TestService.startTestAttempt(testId, studentId, studentName, classId);
        attemptData = await TestService.getTestAttempt(attemptId);
      }

      if (!attemptData) {
        throw new Error('Failed to create test attempt');
      }

      setAttempt(attemptData);
      setTimeRemaining(attemptData.remainingTime || 0);

      // Load existing answers
      const answersMap = new Map<string, StudentAnswer>();
      attemptData.answers.forEach(answer => {
        answersMap.set(answer.questionId, answer);
      });
      setAnswers(answersMap);

    } catch (error) {
      console.error('Error initializing test:', error);
      alert('Failed to load test. Please try again.');
      router.push('/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = useCallback((questionId: string, answer: Partial<StudentAnswer>) => {
    const timeSpent = Date.now() - questionStartTime;
    
    setAnswers(prev => {
      const newAnswers = new Map(prev);
      const existingAnswer = newAnswers.get(questionId);
      
      const updatedAnswer: StudentAnswer = {
        questionId,
        timeSpent: (existingAnswer?.timeSpent || 0) + Math.floor(timeSpent / 1000),
        ...answer
      } as StudentAnswer;
      
      newAnswers.set(questionId, updatedAnswer);
      
      // Save to backend
      if (attempt) {
        TestService.saveAnswer(attempt.id, updatedAnswer).catch(console.error);
      }
      
      return newAnswers;
    });
    
    setQuestionStartTime(Date.now());
  }, [attempt, questionStartTime]);

  const handleMCQAnswer = (questionId: string, optionId: string) => {
    handleAnswerChange(questionId, {
      selectedOption: optionId
    } as Partial<MCQAnswer>);
  };

  const handleEssayAnswer = (questionId: string, content: string) => {
    const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    handleAnswerChange(questionId, {
      content,
      wordCount
    } as Partial<EssayAnswer>);
  };

  const navigateToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setQuestionStartTime(Date.now());
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < (test?.questions.length || 0) - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      navigateToQuestion(currentQuestionIndex - 1);
    }
  };

  const handleReview = () => {
    setShowReview(true);
  };

  const handleSubmit = async () => {
    if (!attempt) return;
    
    try {
      setSubmitting(true);
      await TestService.submitTest(attempt.id, false);
      router.push(`/student/test-result/${testId}`);
    } catch (error) {
      console.error('Error submitting test:', error);
      alert('Failed to submit test. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!attempt) return;
    
    try {
      await TestService.submitTest(attempt.id, true);
      router.push(`/student/test-result/${testId}`);
    } catch (error) {
      console.error('Error auto-submitting test:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnsweredCount = () => {
    return answers.size;
  };

  const isQuestionAnswered = (questionId: string) => {
    return answers.has(questionId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading test...</p>
        </div>
      </div>
    );
  }

  if (!test || !attempt) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Test Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            The test you're looking for doesn't exist or is no longer available.
          </p>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];

  if (showReview) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Review Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Review Your Answers
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {test.title}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-2 ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-600'}`}>
                  <Timer className="h-5 w-5" />
                  <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowReview(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Test
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#64cc4f] hover:bg-[#b2e05b] disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Test
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Review Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Question Navigation */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Questions ({getAnsweredCount()}/{test.questions.length})
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {test.questions.map((question, index) => (
                    <button
                      key={question.questionId}
                      onClick={() => {
                        setCurrentQuestionIndex(index);
                        setShowReview(false);
                      }}
                      className={`w-10 h-10 rounded-lg text-sm font-medium flex items-center justify-center ${
                        isQuestionAnswered(question.questionId)
                          ? 'bg-[#b2e05b] text-[#222222] dark:bg-[#b2e05b]/20 dark:text-[#222222]'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Review Summary */}
            <div className="lg:col-span-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                  Test Summary
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {test.questions.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Total Questions
                    </div>
                  </div>

                  <div className="text-center p-4 bg-[#b2e05b]/20 dark:bg-[#b2e05b]/10 rounded-lg">
                    <CheckCircle className="h-8 w-8 text-[#64cc4f] mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {getAnsweredCount()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Answered
                    </div>
                  </div>

                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <Circle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {test.questions.length - getAnsweredCount()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Unanswered
                    </div>
                  </div>
                </div>

                {/* Unanswered Questions Warning */}
                {getAnsweredCount() < test.questions.length && (
                  <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-orange-900 dark:text-orange-100">
                          Unanswered Questions
                        </h4>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                          You have {test.questions.length - getAnsweredCount()} unanswered questions. 
                          Questions without answers will receive 0 points.
                        </p>
                        <div className="mt-2">
                          <button
                            onClick={() => setShowReview(false)}
                            className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-500 font-medium"
                          >
                            Go back and answer remaining questions →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Final Submission Confirmation */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Ready to Submit?
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Once you submit your test, you cannot make any changes. Make sure you've reviewed all your answers.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowReview(false)}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500"
                    >
                      Review More
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#64cc4f] hover:bg-[#b2e05b] disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit Test
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Test Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {test.title}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Question {currentQuestionIndex + 1} of {test.questions.length}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-600'}`}>
                <Timer className={`h-5 w-5 ${timeRemaining < 300 ? 'animate-pulse' : ''}`} />
                <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
              </div>
              {timeRemaining < 300 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    Time running out!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Progress ({getAnsweredCount()}/{test.questions.length})
              </h3>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(getAnsweredCount() / test.questions.length) * 100}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-5 gap-2 mb-6">
                {test.questions.map((question, index) => (
                  <button
                    key={question.questionId}
                    onClick={() => navigateToQuestion(index)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium flex items-center justify-center transition-all ${
                      index === currentQuestionIndex
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-200'
                        : isQuestionAnswered(question.questionId)
                        ? 'bg-[#b2e05b] text-[#222222] dark:bg-[#b2e05b]/20 dark:text-[#222222] hover:bg-[#64cc4f]'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-600 rounded"></div>
                  <span className="text-gray-600 dark:text-gray-300">Current</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-[#b2e05b] dark:bg-[#b2e05b]/20 border border-[#64cc4f] dark:border-[#64cc4f] rounded"></div>
                  <span className="text-gray-600 dark:text-gray-300">Answered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"></div>
                  <span className="text-gray-600 dark:text-gray-300">Not answered</span>
                </div>
              </div>

              {test.config.allowReviewBeforeSubmit && (
                <button
                  onClick={handleReview}
                  className="w-full mt-6 inline-flex items-center justify-center px-4 py-2 border border-blue-300 dark:border-blue-600 text-sm font-medium rounded-md text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Review Answers
                </button>
              )}
            </div>
          </div>

          {/* Question Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {/* Question Header */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {currentQuestion.questionType === 'mcq' ? 'Multiple Choice' : 'Essay'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {currentQuestion.questionData?.title}
                </h2>
                
                {currentQuestion.questionData?.content && (
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    {currentQuestion.questionData.content}
                  </p>
                )}
                
                {currentQuestion.questionData?.imageUrl && (
                  <div className="mb-4">
                    <img
                      src={currentQuestion.questionData.imageUrl}
                      alt="Question"
                      className="max-w-full h-auto rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Answer Section */}
              <div className="mb-6">
                {currentQuestion.questionType === 'mcq' ? (
                  <div className="space-y-3">
                    {currentQuestion.questionData?.options?.map((option, index) => (
                      <label
                        key={option.id}
                        className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuestion.questionId}`}
                          value={option.id}
                          checked={(answers.get(currentQuestion.questionId) as MCQAnswer)?.selectedOption === option.id}
                          onChange={() => handleMCQAnswer(currentQuestion.questionId, option.id)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <div className="flex-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-full mr-3">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {option.text && option.text.trim() ? option.text : String.fromCharCode(65 + index)}
                          </span>
                          {option.imageUrl && (
                            <img
                              src={option.imageUrl}
                              alt={`Option ${String.fromCharCode(65 + index)}`}
                              className="mt-2 max-w-xs h-auto rounded"
                            />
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Answer:
                    </label>
                    <textarea
                      value={(answers.get(currentQuestion.questionId) as EssayAnswer)?.content || ''}
                      onChange={(e) => handleEssayAnswer(currentQuestion.questionId, e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Type your answer here..."
                    />
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Word count: {(answers.get(currentQuestion.questionId) as EssayAnswer)?.wordCount || 0}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={prevQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </button>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {isQuestionAnswered(currentQuestion.questionId) ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Answered
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Circle className="h-4 w-4 mr-1" />
                      Not answered
                    </span>
                  )}
                </div>

                {currentQuestionIndex === test.questions.length - 1 ? (
                  test.config.allowReviewBeforeSubmit ? (
                    <button
                      onClick={handleReview}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#64cc4f] hover:bg-[#b2e05b]"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review & Submit
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#64cc4f] hover:bg-[#b2e05b] disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit Test
                        </>
                      )}
                    </button>
                  )
                ) : (
                  <button
                    onClick={nextQuestion}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
