'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Play,
  BarChart3,
  Info
} from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui';
import { RetestRequestService } from '@/apiservices/retestRequestService';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';
import { Timestamp } from 'firebase/firestore';

interface RetakeWithComparison {
  retakeTest: Test;
  originalSubmission: any | null;
  retakeSubmission: any | null;
  improvement: number | null;
  status: 'upcoming' | 'available' | 'in_progress' | 'completed';
}

export default function StudentRetakes() {
  const { student, loading: authLoading } = useStudentAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const [retakes, setRetakes] = useState<RetakeWithComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && student) {
      loadRetakes();
    }
  }, [student, authLoading]);

  const convertTimestamp = (timestamp: any): Date => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    return new Date();
  };

  const getRetakeStatus = (test: Test): 'upcoming' | 'available' | 'in_progress' | 'completed' => {
    const now = new Date();

    if (test.type === 'flexible') {
      const flexTest = test as FlexibleTest;
      const from = convertTimestamp(flexTest.availableFrom);
      const to = convertTimestamp(flexTest.availableTo);
      if (now < from) return 'upcoming';
      if (now > to) return 'completed';
      return 'available';
    } else if (test.type === 'live') {
      const liveTest = test as LiveTest;
      const start = convertTimestamp(liveTest.scheduledStartTime);
      const end = convertTimestamp(liveTest.actualEndTime);
      if (now < start) return 'upcoming';
      if (now > end) return 'completed';
      return 'available';
    }
    return 'completed';
  };

  const loadRetakes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get student's class enrollments
      const enrollments = await getEnrollmentsByStudent(student?.id || '');
      const classIds = enrollments
        .filter(e => e.status === 'Active')
        .map(e => e.classId);

      if (classIds.length === 0) {
        setRetakes([]);
        setLoading(false);
        return;
      }

      // Get all retake tests
      const retakeTests = await RetestRequestService.getStudentRetakes(
        student?.id || '',
        classIds
      );

      // Get comparisons for each retake
      const retakesWithComparison: RetakeWithComparison[] = await Promise.all(
        retakeTests.map(async (retakeTest) => {
          const comparison = await RetestRequestService.getRetakeComparison(
            student?.id || '',
            retakeTest.id,
            retakeTest.originalTestId || ''
          );

          return {
            retakeTest,
            originalSubmission: comparison.originalSubmission,
            retakeSubmission: comparison.retakeSubmission,
            improvement: comparison.improvement,
            status: getRetakeStatus(retakeTest)
          };
        })
      );

      setRetakes(retakesWithComparison);
    } catch (err) {
      console.error('Error loading retakes:', err);
      setError('Failed to load retakes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any): string => {
    const date = convertTimestamp(timestamp);
    return date.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Melbourne',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800 border-2 border-blue-300">
            <Clock className="w-3 h-3 mr-1" />
            Upcoming
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800 border-2 border-green-300">
            <Play className="w-3 h-3 mr-1" />
            Available
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-800 border-2 border-gray-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <RefreshCw className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">
            Retakes
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          View your approved retake tests and compare your improvement with original scores.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading retakes...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={loadRetakes} variant="outline">
            Try Again
          </Button>
        </div>
      ) : retakes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center border-2 border-gray-200 dark:border-gray-700">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Retakes Yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            When your teacher approves a retest request, it will appear here.
            You can request retests from completed tests (older than 1 week) in your Tests tab.
          </p>
          <Button
            onClick={() => router.push('/student/test')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Go to Tests
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {retakes.map((retake) => {
            const { retakeTest, originalSubmission, retakeSubmission, improvement, status } = retake;

            return (
              <div
                key={retakeTest.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">
                        {retakeTest.title}
                      </h3>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {retakeTest.subjectName}
                        </span>
                        {retakeTest.displayNumber && (
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {retakeTest.displayNumber}
                          </span>
                        )}
                        {retakeTest.retestApprovedBy && (
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            Approved by {retakeTest.retestApprovedBy}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(status)}
                    </div>
                  </div>
                </div>

                {/* Comparison Cards */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Original Score */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Original Test
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                        {retakeTest.originalDisplayNumber || retakeTest.originalTestTitle || 'Original'}
                      </div>
                      {originalSubmission ? (
                        <>
                          <div className="text-3xl font-black text-gray-900 dark:text-white">
                            {originalSubmission.percentage != null
                              ? `${Math.round(originalSubmission.percentage)}%`
                              : `${originalSubmission.totalScore || originalSubmission.autoGradedScore || 0}`}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Score: {originalSubmission.totalScore || originalSubmission.autoGradedScore || 0}/{retakeTest.totalMarks}
                          </div>
                          {originalSubmission.submittedAt && (
                            <div className="text-xs text-gray-400 mt-1">
                              {formatDate(originalSubmission.submittedAt)}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-gray-400 dark:text-gray-500 text-sm">
                          No submission found
                        </div>
                      )}
                    </div>

                    {/* Improvement Indicator */}
                    <div className="flex items-center justify-center">
                      {retakeSubmission && improvement !== null ? (
                        <div className={`text-center p-4 rounded-lg ${
                          improvement > 0
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : improvement < 0
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-gray-50 dark:bg-gray-900/20'
                        }`}>
                          <div className={`flex items-center justify-center mb-1 ${
                            improvement > 0
                              ? 'text-green-600'
                              : improvement < 0
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}>
                            {improvement > 0 ? (
                              <TrendingUp className="w-8 h-8" />
                            ) : improvement < 0 ? (
                              <TrendingDown className="w-8 h-8" />
                            ) : (
                              <Minus className="w-8 h-8" />
                            )}
                          </div>
                          <div className={`text-2xl font-black ${
                            improvement > 0
                              ? 'text-green-600'
                              : improvement < 0
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}>
                            {improvement > 0 ? '+' : ''}{Math.round(improvement)}%
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {improvement > 0
                              ? 'Improvement'
                              : improvement < 0
                              ? 'Decline'
                              : 'No Change'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <ArrowRight className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <div className="text-sm text-gray-400">
                            {status === 'completed' && !retakeSubmission
                              ? 'Not attempted'
                              : 'Take the retest to see comparison'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Retake Score */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                        Retake Test
                      </div>
                      <div className="text-xs text-blue-400 dark:text-blue-500 mb-2">
                        {retakeTest.displayNumber || 'Retake'}
                      </div>
                      {retakeSubmission ? (
                        <>
                          <div className="text-3xl font-black text-blue-700 dark:text-blue-300">
                            {retakeSubmission.percentage != null
                              ? `${Math.round(retakeSubmission.percentage)}%`
                              : `${retakeSubmission.totalScore || retakeSubmission.autoGradedScore || 0}`}
                          </div>
                          <div className="text-sm text-blue-500 dark:text-blue-400 mt-1">
                            Score: {retakeSubmission.totalScore || retakeSubmission.autoGradedScore || 0}/{retakeTest.totalMarks}
                          </div>
                          {retakeSubmission.submittedAt && (
                            <div className="text-xs text-blue-400 mt-1">
                              {formatDate(retakeSubmission.submittedAt)}
                            </div>
                          )}
                        </>
                      ) : status === 'available' ? (
                        <div className="mt-2">
                          <Button
                            onClick={() => router.push(`/student/test/${retakeTest.id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Take Retest
                          </Button>
                        </div>
                      ) : status === 'upcoming' ? (
                        <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Not yet available
                        </div>
                      ) : (
                        <div className="text-gray-400 dark:text-gray-500 text-sm">
                          Not attempted
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end mt-4 space-x-3">
                    {originalSubmission && (
                      <Button
                        onClick={() => router.push(`/student/test/${retakeTest.originalTestId}/result`)}
                        variant="outline"
                        className="text-sm"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        View Original Results
                      </Button>
                    )}
                    {retakeSubmission && (
                      <Button
                        onClick={() => router.push(`/student/test/${retakeTest.id}/result`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        View Retake Results
                      </Button>
                    )}
                    {status === 'available' && !retakeSubmission && (
                      <Button
                        onClick={() => router.push(`/student/test/${retakeTest.id}`)}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start Retake
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
