'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  FileQuestion,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { TestService } from '@/apiservices/testService';
import { Test } from '@/models/testSchema';
import { Button } from '@/components/ui';

interface AttemptData {
  id: string;
  testId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  status: string;
  startedAt: any;
  endTime?: any;
  timeRemaining?: number;
  totalTimeAllowed?: number;
  answers?: Record<string, any>;
  currentQuestionIndex?: number;
}

export default function ReviewIncompleteAttempt() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;
  const attemptId = params.attemptId as string;

  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [testId, attemptId]);

  const loadData = async () => {
    if (!testId || !attemptId) return;

    setLoading(true);
    setError(null);

    try {
      // Load test data
      const testData = await TestService.getTestById(testId);
      setTest(testData);

      // Load attempt data from Firestore
      const { doc, getDoc } = await import('firebase/firestore');
      const { firestore, realtimeDb } = await import('@/utils/firebase-client');

      const attemptDoc = await getDoc(doc(firestore, 'testAttempts', attemptId));
      
      if (!attemptDoc.exists()) {
        setError('Attempt not found');
        return;
      }

      let attemptData = { id: attemptDoc.id, ...attemptDoc.data() } as AttemptData;

      // If no answers in Firestore, try Realtime Database
      if (!attemptData.answers || Object.keys(attemptData.answers).length === 0) {
        try {
          const { ref, get } = await import('firebase/database');
          const rtdbAnswersRef = ref(realtimeDb, `testAttempts/${attemptId}/answers`);
          const rtdbSnapshot = await get(rtdbAnswersRef);
          
          if (rtdbSnapshot.exists()) {
            attemptData.answers = rtdbSnapshot.val();
            console.log('📱 Loaded answers from Realtime Database');
          }
        } catch (rtdbError) {
          console.warn('Could not load from RTDB:', rtdbError);
        }
      }

      setAttempt(attemptData);
      console.log('✅ Loaded attempt data:', attemptData);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load attempt data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSubmission = async () => {
    if (!attempt) return;

    setApproving(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');

      await updateDoc(doc(firestore, 'testAttempts', attemptId), {
        status: 'auto_submitted',
        submittedAt: new Date().toISOString(),
        autoSubmittedReason: 'Teacher approved late submission',
        teacherApprovedAt: new Date().toISOString(),
      });

      toast.success('Submission approved successfully');
      router.push(`/teacher/tests/${testId}/results`);
    } catch (err) {
      console.error('Error approving submission:', err);
      toast.error('Failed to approve submission');
    } finally {
      setApproving(false);
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) return timestamp.toDate().toLocaleString();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleString();
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString();
    return 'N/A';
  };

  const getAnswerDisplay = (questionIndex: number, question: any): React.ReactNode => {
    if (!attempt?.answers) return <span className="text-gray-400 italic">Not answered</span>;

    const answer = attempt.answers[questionIndex] || attempt.answers[question.id] || attempt.answers[question.questionId];
    
    if (answer === undefined || answer === null || answer === '') {
      return <span className="text-gray-400 italic">Not answered</span>;
    }

    if (question.questionType === 'mcq' && question.options) {
      const selectedIndex = typeof answer === 'number' ? answer : parseInt(answer);
      const selectedOption = question.options[selectedIndex];
      const isCorrect = selectedIndex === question.correctOption;
      
      return (
        <div className={`flex items-center ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
          {isCorrect ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          <span>
            Option {String.fromCharCode(65 + selectedIndex)}: {typeof selectedOption === 'string' ? selectedOption : selectedOption?.text || String(selectedOption)}
          </span>
        </div>
      );
    }

    return <span className="text-gray-700 dark:text-gray-300">{String(answer)}</span>;
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading attempt...</span>
        </div>
      </TeacherLayout>
    );
  }

  if (error) {
    return (
      <TeacherLayout>
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">Error Loading Attempt</h2>
            <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
            <Button variant="outline" onClick={() => router.push(`/teacher/tests/${testId}/results`)}>
              Back to Results
            </Button>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  const answersCount = attempt?.answers ? Object.keys(attempt.answers).length : 0;
  const totalQuestions = test?.questions?.length || 0;

  return (
    <TeacherLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/teacher/tests/${testId}/results`)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Review Incomplete Attempt
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {test?.title || 'Test'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={handleApproveSubmission}
              disabled={approving}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {approving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Submission
                </>
              )}
            </button>
          </div>
        </div>

        {/* Student Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-blue-600" />
            Student Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p className="font-medium text-gray-900 dark:text-white">{attempt?.studentName || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{attempt?.studentEmail || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Started At</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatTimestamp(attempt?.startedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Time Expired - Incomplete
              </span>
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <FileQuestion className="h-5 w-5 mr-2 text-purple-600" />
            Attempt Progress
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Questions Answered</span>
                <span className="font-medium text-gray-900 dark:text-white">{answersCount} / {totalQuestions}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                <div
                  className="bg-orange-500 h-3 rounded-full transition-all"
                  style={{ width: `${totalQuestions > 0 ? (answersCount / totalQuestions) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-orange-600">
                {totalQuestions > 0 ? Math.round((answersCount / totalQuestions) * 100) : 0}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completion</p>
            </div>
          </div>
        </div>

        {/* Answers Review */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <HelpCircle className="h-5 w-5 mr-2 text-indigo-600" />
              Student Answers
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review the answers submitted by the student before time expired
            </p>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {test?.questions?.map((question, index) => {
              const hasAnswer = attempt?.answers && (
                attempt.answers[index] !== undefined ||
                attempt.answers[question.id] !== undefined ||
                attempt.answers[question.questionId] !== undefined
              );

              return (
                <div key={question.id || index} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium mr-3 ${
                        hasAnswer 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {question.questionType?.toUpperCase() || 'MCQ'}
                      </span>
                      {question.points && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {question.points} {question.points === 1 ? 'point' : 'points'}
                        </span>
                      )}
                    </div>
                    {hasAnswer ? (
                      <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Answered
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-gray-400">
                        <XCircle className="h-4 w-4 mr-1" />
                        Skipped
                      </span>
                    )}
                  </div>

                  {/* Question Text */}
                  <div className="mb-4">
                    <p className="text-gray-900 dark:text-white">{question.questionText}</p>
                    {question.imageUrl && (
                      <img
                        src={question.imageUrl}
                        alt={`Question ${index + 1}`}
                        className="mt-2 max-w-md rounded-lg border border-gray-200 dark:border-gray-600"
                      />
                    )}
                  </div>

                  {/* MCQ Options */}
                  {question.questionType === 'mcq' && question.options && (
                    <div className="mb-4 space-y-2">
                      {question.options.map((option: any, optIdx: number) => {
                        const optionText = typeof option === 'string' ? option : option?.text || String(option);
                        const isCorrect = optIdx === question.correctOption;
                        const isSelected = attempt?.answers && (
                          attempt.answers[index] === optIdx ||
                          attempt.answers[question.id] === optIdx ||
                          attempt.answers[question.questionId] === optIdx
                        );

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-lg border ${
                              isSelected && isCorrect 
                                ? 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20'
                                : isSelected && !isCorrect
                                ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
                                : isCorrect
                                ? 'border-green-200 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10'
                                : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mr-3 ${
                                  isSelected 
                                    ? isCorrect 
                                      ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100'
                                      : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100'
                                    : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                }`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className={`${
                                  isCorrect ? 'font-medium' : ''
                                } ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {optionText}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                {isSelected && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    Selected
                                  </span>
                                )}
                                {isCorrect && (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Student's Answer Summary */}
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Student's Answer:</p>
                    <div className="mt-1">
                      {getAnswerDisplay(index, question)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Take Action</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Approving will mark this as a valid submission with the current answers.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(`/teacher/tests/${testId}/results`)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSubmission}
                disabled={approving}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {approving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
