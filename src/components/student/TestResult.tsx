'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award,
  BookOpen,
  TrendingUp,
  ArrowLeft,
  FileText,
  AlertTriangle,
  X,
  Quote
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import Confetti from 'react-confetti';
import { TestService } from '@/apiservices/testService';
import { Test, TestAttempt } from '@/models/testSchema';

export default function StudentTestResult() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;
  
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCongratulations, setShowCongratulations] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<{quote: string, author: string} | null>(null);

  // Motivational quotes for passing exams
  const motivationalQuotes = [
    {
      quote: "Success is not final, failure is not fatal: It is the courage to continue that counts.",
      author: "Winston Churchill"
    },
    {
      quote: "The only way to do great work is to love what you do.",
      author: "Steve Jobs"
    },
    {
      quote: "Believe you can and you're halfway there.",
      author: "Theodore Roosevelt"
    },
    {
      quote: "The future belongs to those who believe in the beauty of their dreams.",
      author: "Eleanor Roosevelt"
    },
    {
      quote: "Your education is a dress rehearsal for a life that is yours to lead.",
      author: "Nora Ephron"
    },
    {
      quote: "The beautiful thing about learning is that no one can take it away from you.",
      author: "B.B. King"
    },
    {
      quote: "Education is the most powerful weapon which you can use to change the world.",
      author: "Nelson Mandela"
    },
    {
      quote: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.",
      author: "Dr. Seuss"
    },
    {
      quote: "Success is walking from failure to failure with no loss of enthusiasm.",
      author: "Winston Churchill"
    },
    {
      quote: "The expert in anything was once a beginner.",
      author: "Helen Hayes"
    }
  ];

  // Mock student data - replace with actual auth
  const studentId = 'student123';

  useEffect(() => {
    loadTestResult();
  }, [testId]);

  const loadTestResult = async () => {
    try {
      setLoading(true);
      
      const [testData, attemptData] = await Promise.all([
        TestService.getTest(testId),
        TestService.getStudentTestAttempt(testId, studentId)
      ]);

      if (!testData || !attemptData) {
        router.push('/student/dashboard');
        return;
      }

      setTest(testData);
      setAttempt(attemptData);

      // Show confetti and congratulations if student passed
      if (attemptData.passStatus === 'passed') {
        setShowConfetti(true);
        setShowCongratulations(true);
        setSelectedQuote(getRandomQuote());
        // Hide confetti after 5 seconds
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (error) {
      console.error('Error loading test result:', error);
      router.push('/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'C+';
    if (percentage >= 65) return 'C';
    if (percentage >= 60) return 'D+';
    if (percentage >= 55) return 'D';
    return 'F';
  };

  const closeCongratulations = () => {
    setShowCongratulations(false);
  };

  // Get a random motivational quote
  const getRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
    return motivationalQuotes[randomIndex];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading results...</p>
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
            Results Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Test results are not available at this time.
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

  const hasEssayQuestions = test.questions.some(q => q.questionType === 'essay');
  const isFullyGraded = attempt.passStatus !== 'pending';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Confetti Animation */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.1}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push('/student/dashboard')}
                className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Test Results
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {test.title}
              </p>
            </div>
            
            {attempt.percentage !== undefined && (
              <div className="text-center">
                <div className={`text-4xl font-bold ${getGradeColor(attempt.percentage)}`}>
                  {getGradeLetter(attempt.percentage)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {attempt.percentage.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Results pending for essay questions */}
        {hasEssayQuestions && !isFullyGraded && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
                  Results Pending
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Your test includes essay questions that need to be reviewed by your teacher. 
                  MCQ results are shown below, but your final score is pending teacher review.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                Score Overview
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {attempt.score || 0}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Total Score
                  </div>
                  <div className="text-xs text-gray-400">
                    out of {attempt.totalMarks || test.totalMarks}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {attempt.mcqCorrect || 0}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Correct MCQ
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600 mb-1">
                    {attempt.mcqWrong || 0}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Wrong MCQ
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {formatTime(attempt.timeSpent)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Time Spent
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {attempt.percentage !== undefined && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Overall Performance
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {attempt.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${
                        attempt.percentage >= 90 ? 'bg-green-500' :
                        attempt.percentage >= 80 ? 'bg-blue-500' :
                        attempt.percentage >= 70 ? 'bg-yellow-500' :
                        attempt.percentage >= 60 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(attempt.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Pass/Fail Status */}
              {test.config.passingScore && attempt.passStatus && attempt.passStatus !== 'pending' && (
                <div className="mt-6 p-4 rounded-lg">
                  {attempt.passStatus === 'passed' ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div>
                          <h3 className="font-medium text-green-900 dark:text-green-100">
                            Congratulations! You Passed
                          </h3>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            You scored {attempt.percentage?.toFixed(1)}%, which is above the passing score of {test.config.passingScore}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <XCircle className="h-6 w-6 text-red-600" />
                        <div>
                          <h3 className="font-medium text-red-900 dark:text-red-100">
                            Test Not Passed
                          </h3>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            You scored {attempt.percentage?.toFixed(1)}%. The passing score is {test.config.passingScore}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Question Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                Question Analysis
              </h2>

              <div className="space-y-4">
                {test.questions.map((question, index) => {
                  const answer = attempt.answers.find(a => a.questionId === question.questionId);
                  const isAnswered = !!answer;
                  
                  // For MCQ questions, we can show if it's correct/wrong
                  let isCorrect = false;
                  if (question.questionType === 'mcq' && answer) {
                    // This would need to be calculated by comparing with correct answer
                    // For now, we'll use a placeholder logic
                    isCorrect = Math.random() > 0.3; // Placeholder
                  }

                  return (
                    <div
                      key={question.questionId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-full">
                              {index + 1}
                            </span>
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {question.questionData?.title}
                              </h3>
                              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                                <span>{question.questionType === 'mcq' ? 'Multiple Choice' : 'Essay'}</span>
                                <span>•</span>
                                <span>{question.points} point{question.points !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {question.questionType === 'mcq' ? (
                            isAnswered ? (
                              isCorrect ? (
                                <div className="flex items-center space-x-1 text-green-600">
                                  <CheckCircle className="h-5 w-5" />
                                  <span className="text-sm font-medium">Correct</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 text-red-600">
                                  <XCircle className="h-5 w-5" />
                                  <span className="text-sm font-medium">Wrong</span>
                                </div>
                              )
                            ) : (
                              <div className="flex items-center space-x-1 text-gray-400">
                                <XCircle className="h-5 w-5" />
                                <span className="text-sm font-medium">No Answer</span>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center space-x-1 text-blue-600">
                              <FileText className="h-5 w-5" />
                              <span className="text-sm font-medium">
                                {isAnswered ? 'Submitted' : 'No Answer'}
                              </span>
                            </div>
                          )}

                          {answer && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatTime(answer.timeSpent)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Test Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Test Information
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Subject:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{test.subjectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Questions:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{test.questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Marks:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{test.totalMarks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Test Type:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {test.type === 'live' ? 'Live Test' : 'Flexible'}
                  </span>
                </div>
                {test.config.passingScore && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Passing Score:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{test.config.passingScore}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Insights */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Performance Insights
              </h3>
              
              <div className="space-y-4">
                {attempt.percentage !== undefined && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Overall Performance
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {attempt.percentage >= 90 ? 'Excellent work! You have mastered this topic.' :
                       attempt.percentage >= 80 ? 'Great job! You have a good understanding of the material.' :
                       attempt.percentage >= 70 ? 'Good effort! Review the areas you got wrong.' :
                       attempt.percentage >= 60 ? 'You passed, but there\'s room for improvement.' :
                       'Consider reviewing the material and retaking if possible.'}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Time Management
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    You completed the test in {formatTime(attempt.timeSpent)}.
                    {attempt.timeSpent < (test.type === 'live' ? (test as any).duration * 60 * 0.5 : (test as any).duration * 60 * 0.5) 
                      ? ' You finished quickly - make sure you reviewed your answers.'
                      : attempt.timeSpent > (test.type === 'live' ? (test as any).duration * 60 * 0.9 : (test as any).duration * 60 * 0.9)
                      ? ' You used most of the available time - good thoroughness!'
                      : ' Good time management!'}
                  </p>
                </div>

                {hasEssayQuestions && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <BookOpen className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Essay Questions
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Your essay answers are being reviewed by your teacher. 
                      Final results will be available once grading is complete.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-4">
                What's Next?
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start space-x-2">
                  <Award className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span className="text-blue-800 dark:text-blue-200">
                    Review the questions you got wrong to improve your understanding
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <BookOpen className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span className="text-blue-800 dark:text-blue-200">
                    Continue practicing with more questions on this topic
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span className="text-blue-800 dark:text-blue-200">
                    Ask your teacher about any concepts you found challenging
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Congratulations Modal */}
      {showCongratulations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="relative">
              {/* Close button */}
              <button
                onClick={closeCongratulations}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Header */}
              <div className="text-center pt-8 pb-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <Award className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Congratulations! 🎉
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  You passed the exam with {attempt?.percentage?.toFixed(1)}%!
                </p>
              </div>

              {/* Motivational Quote */}
              <div className="px-8 pb-8">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <Quote className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                    <div>
                      <blockquote className="text-gray-800 dark:text-gray-200 font-medium italic mb-3 leading-relaxed">
                        "{selectedQuote?.quote}"
                      </blockquote>
                      <cite className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        — {selectedQuote?.author}
                      </cite>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={closeCongratulations}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => {
                      closeCongratulations();
                      router.push('/student/dashboard');
                    }}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-3 px-4 rounded-xl transition-all duration-200"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
