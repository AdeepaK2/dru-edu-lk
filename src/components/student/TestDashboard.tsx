'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  Users, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  BookOpen
} from 'lucide-react';
import { TestService } from '@/apiservices/testService';
import { Test, LiveTest, FlexibleTest } from '@/models/testSchema';
import { Timestamp } from 'firebase/firestore';

export default function StudentTestDashboard() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock student data - replace with actual auth
  const studentId = 'student123';
  const studentName = 'John Doe';
  const classIds = ['class1', 'class2'];

  useEffect(() => {
    loadAvailableTests();
  }, []);

  const loadAvailableTests = async () => {
    try {
      setLoading(true);
      // Use Firebase client service directly - much faster!
      const availableTests = await TestService.getStudentTests(studentId, classIds);
      setTests(availableTests);
    } catch (error) {
      console.error('Error loading tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const startTest = async (testId: string) => {
    try {
      // Start test attempt using Firebase client service
      const attemptId = await TestService.startTestAttempt(testId, studentId, studentName, classIds[0]);
      
      // Navigate to test taking interface (you'd implement this route)
      window.location.href = `/student/test/${testId}?attemptId=${attemptId}`;
    } catch (error) {
      console.error('Error starting test:', error);
      alert('Failed to start test. Please try again.');
    }
  };

  const formatDateTime = (timestamp: any) => {
    let date: Date;
    
    // Handle Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    }
    // Handle plain Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    // Handle number (milliseconds)
    else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    // Handle Firestore Timestamp object structure
    else if (timestamp && timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    // Handle string
    else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    }
    // Fallback
    else {
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

  const getTimeUntil = (timestamp: any) => {
    const now = new Date();
    let target: Date;
    
    // Handle different timestamp formats
    if (timestamp && typeof timestamp.toDate === 'function') {
      target = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      target = timestamp;
    } else if (typeof timestamp === 'number') {
      target = new Date(timestamp);
    } else if (timestamp && timestamp.seconds) {
      target = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    } else if (typeof timestamp === 'string') {
      target = new Date(timestamp);
    } else {
      return 'Available now';
    }
    
    const diff = target.getTime() - now.getTime();
    
    if (diff <= 0) return 'Available now';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} remaining`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  };

  const isTestAvailable = (test: Test) => {
    const now = Timestamp.now();
    
    if (test.type === 'live') {
      const liveTest = test as LiveTest;
      return now.seconds >= liveTest.studentJoinTime.seconds && 
             now.seconds <= liveTest.actualEndTime.seconds;
    } else {
      const flexTest = test as FlexibleTest;
      return now.seconds >= flexTest.availableFrom.seconds && 
             now.seconds <= flexTest.availableTo.seconds;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Available Tests
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Take your assigned tests and quizzes
          </p>
        </div>

        {/* Tests Grid */}
        {tests.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tests available
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              There are no tests available for you at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {tests.map((test) => {
              const isAvailable = isTestAvailable(test);
              const isLive = test.type === 'live';
              const liveTest = isLive ? test as LiveTest : null;
              const flexTest = !isLive ? test as FlexibleTest : null;

              return (
                <div
                  key={test.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {test.title}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isLive
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}
                        >
                          {isLive ? 'Live Test' : 'Flexible'}
                        </span>
                        {isAvailable && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#b2e05b] text-[#222222] dark:bg-[#b2e05b]/20 dark:text-[#222222]">
                            Available Now
                          </span>
                        )}
                      </div>

                      {test.description && (
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                          {test.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <BookOpen className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {test.questions.length} questions
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {isLive ? `${liveTest!.duration} min` : `${flexTest!.duration} min`}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {test.subjectName}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {test.totalMarks} marks
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-6">
                      {isAvailable ? (
                        <button
                          onClick={() => startTest(test.id)}
                          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#64cc4f] hover:bg-[#b2e05b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#64cc4f]"
                        >
                          <Play className="h-5 w-5 mr-2" />
                          Start Test
                        </button>
                      ) : (
                        <button
                          disabled
                          className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                        >
                          <Clock className="h-5 w-5 mr-2" />
                          Not Available
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Test Timing Information */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    {isLive ? (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-red-900 dark:text-red-100">
                              Live Test Schedule
                            </h4>
                            <div className="text-sm text-red-700 dark:text-red-300 mt-1 space-y-1">
                              <p><strong>Start Time:</strong> {formatDateTime(liveTest!.scheduledStartTime)}</p>
                              <p><strong>Duration:</strong> {liveTest!.duration} minutes</p>
                              <p><strong>Join Window:</strong> From start time</p>
                              {!isAvailable && (
                                <p><strong>Status:</strong> {getTimeUntil(liveTest!.studentJoinTime)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-900 dark:text-blue-100">
                              Flexible Test Period
                            </h4>
                            <div className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                              <p><strong>Available From:</strong> {formatDateTime(flexTest!.availableFrom)}</p>
                              <p><strong>Available Until:</strong> {formatDateTime(flexTest!.availableTo)}</p>
                              <p><strong>Duration:</strong> {flexTest!.duration} minutes once started</p>
                              <p><strong>Attempts:</strong> {flexTest!.attemptsAllowed} attempt allowed</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  {test.instructions && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                        Instructions:
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {test.instructions}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
