'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Filter,
  Search,
  BarChart3,
  Users,
  Clock,
  Trophy,
  Target,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { TestService } from '@/apiservices/testService';
import { SubmissionService } from '@/apiservices/submissionService';
import { Test, LiveTest, FlexibleTest } from '@/models/testSchema';
import { StudentSubmission } from '@/models/studentSubmissionSchema';

interface TestStats {
  totalStudents: number;
  submittedCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  averageTime: number;
  questionStats: QuestionStat[];
}

interface QuestionStat {
  questionId: string;
  questionText: string;
  questionType: string;
  correctAnswers: number;
  totalAnswers: number;
  averageScore: number;
  difficultyLevel: string;
}

export default function TestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;

  const [test, setTest] = useState<Test | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [stats, setStats] = useState<TestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'summary' | 'individual'>('summary');

  useEffect(() => {
    if (testId) {
      loadTestResults();
    }
  }, [testId]);

  const loadTestResults = async () => {
    try {
      setLoading(true);
      
      // Load test data
      const testData = await TestService.getTest(testId);
      if (!testData) {
        throw new Error('Test not found');
      }
      setTest(testData);

      // Load submissions
      const submissionsData = await SubmissionService.getTestSubmissions(testId);
      setSubmissions(submissionsData);

      // Calculate statistics
      const testStats = calculateTestStats(testData, submissionsData);
      setStats(testStats);

      console.log('✅ Test results loaded:', {
        test: testData.title,
        passingScore: testData.config?.passingScore,
        submissions: submissionsData.length,
        stats: testStats
      });
    } catch (error) {
      console.error('Error loading test results:', error);
      alert('Failed to load test results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTestStats = (test: Test, submissions: StudentSubmission[]): TestStats => {
    const submittedSubmissions = submissions.filter(s => 
      s.status === 'submitted' || s.status === 'auto_submitted'
    );

    if (submittedSubmissions.length === 0) {
      return {
        totalStudents: submissions.length,
        submittedCount: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passRate: 0,
        averageTime: 0,
        questionStats: []
      };
    }

    const scores = submittedSubmissions.map(s => s.percentage || 0);
    const times = submittedSubmissions.map(s => s.totalTimeSpent || 0);
    
    // Calculate pass rate based on teacher's passing score configuration
    const passedCount = submittedSubmissions.filter(s => {
      // If there's a passing score configured, use it
      if (test.config?.passingScore) {
        const percentage = s.percentage || 0;
        return percentage >= test.config.passingScore;
      }
      // Fallback to passStatus if no passing score is configured
      return s.passStatus === 'passed';
    }).length;

    // Calculate question statistics
    const questionStats: QuestionStat[] = [];
    if (test.questions) {
      test.questions.forEach(question => {
        const questionAnswers = submittedSubmissions.map(s => 
          s.finalAnswers?.find(a => a.questionId === question.id)
        ).filter(Boolean);

        const correctAnswers = questionAnswers.filter(answer => {
          if (question.questionType === 'mcq') {
            return answer?.isCorrect;
          } else {
            return (answer?.marksAwarded || 0) > 0;
          }
        }).length;

        questionStats.push({
          questionId: question.id || '',
          questionText: question.questionText || question.content || '',
          questionType: question.questionType || question.type || '',
          correctAnswers,
          totalAnswers: questionAnswers.length,
          averageScore: questionAnswers.reduce((sum, a) => sum + (a?.marksAwarded || 0), 0) / questionAnswers.length,
          difficultyLevel: question.difficultyLevel || 'medium'
        });
      });
    }

    return {
      totalStudents: submissions.length,
      submittedCount: submittedSubmissions.length,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      passRate: (passedCount / submittedSubmissions.length) * 100,
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      questionStats
    };
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submission.studentEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Helper function to determine if submission passes based on teacher's config
    const getSubmissionPassStatus = (submission: StudentSubmission): 'passed' | 'failed' | 'pending' => {
      if (test?.config?.passingScore) {
        const percentage = submission.percentage || 0;
        return percentage >= test.config.passingScore ? 'passed' : 'failed';
      }
      // Fallback to stored passStatus if no passing score is configured
      return submission.passStatus as 'passed' | 'failed' | 'pending';
    };
    
    const submissionPassStatus = getSubmissionPassStatus(submission);
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'submitted' && (submission.status === 'submitted' || submission.status === 'auto_submitted')) ||
                         (statusFilter === 'pending' && submission.manualGradingPending) ||
                         (statusFilter === 'passed' && submissionPassStatus === 'passed') ||
                         (statusFilter === 'failed' && submissionPassStatus === 'failed');

    return matchesSearch && matchesStatus;
  });

  // Helper function to determine submission pass status based on teacher's configuration
  const getSubmissionPassStatus = (submission: StudentSubmission): 'passed' | 'failed' | 'pending' => {
    if (test?.config?.passingScore) {
      const percentage = submission.percentage || 0;
      return percentage >= test.config.passingScore ? 'passed' : 'failed';
    }
    // Fallback to stored passStatus if no passing score is configured
    return submission.passStatus as 'passed' | 'failed' | 'pending';
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

  const exportResults = () => {
    // Create CSV content
    const headers = ['Student Name', 'Email', 'Score (%)', 'Status', 'Time Spent', 'Submitted At'];
    const csvContent = [
      headers.join(','),
      ...filteredSubmissions.map(submission => [
        submission.studentName,
        submission.studentEmail || '',
        submission.percentage || 0,
        submission.status,
        formatTime(submission.totalTimeSpent || 0),
        formatDateTime(submission.submittedAt)
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${test?.title || 'test'}_results.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!test) {
    return (
      <TeacherLayout>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Test Not Found
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Test Results: {test.title}
                </h1>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {test.type === 'live' 
                      ? formatDateTime((test as LiveTest).scheduledStartTime)
                      : formatDateTime((test as FlexibleTest).availableFrom)
                    }
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {test.type === 'live' 
                      ? `${(test as LiveTest).duration} minutes`
                      : `${(test as FlexibleTest).duration} minutes`
                    }
                  </span>
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    {test.questions?.length || 0} questions
                  </span>
                  {test.config?.passingScore && (
                    <span className="flex items-center">
                      <Trophy className="h-4 w-4 mr-1" />
                      {test.config.passingScore}% to pass
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                <button
                  onClick={() => setViewMode('summary')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'summary'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                      : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setViewMode('individual')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'individual'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                      : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100'
                  }`}
                >
                  Individual Results
                </button>
              </div>
              <button
                onClick={exportResults}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'summary' ? (
          <>
            {/* Summary Statistics */}
            {stats && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total Submissions
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stats.submittedCount}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          of {stats.totalStudents} students
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <BarChart3 className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Average Score
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stats.averageScore.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          High: {stats.highestScore}% | Low: {stats.lowestScore}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <Trophy className="h-8 w-8 text-yellow-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Pass Rate
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stats.passRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {Math.round((stats.passRate / 100) * stats.submittedCount)} passed
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <Clock className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Average Time
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatTime(Math.round(stats.averageTime))}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          per submission
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Question Analysis */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Question Analysis
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Performance breakdown by question
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {stats.questionStats.map((questionStat, index) => {
                        const successRate = questionStat.totalAnswers > 0 
                          ? (questionStat.correctAnswers / questionStat.totalAnswers) * 100 
                          : 0;
                        
                        return (
                          <div key={questionStat.questionId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                  Question {index + 1}: {questionStat.questionText.slice(0, 100)}...
                                </h4>
                                <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="flex items-center">
                                    <Target className="h-3 w-3 mr-1" />
                                    {questionStat.questionType.toUpperCase()}
                                  </span>
                                  <span className="flex items-center">
                                    <BarChart3 className="h-3 w-3 mr-1" />
                                    {questionStat.difficultyLevel}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-900 dark:text-white">
                                  {successRate.toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {questionStat.correctAnswers}/{questionStat.totalAnswers} correct
                                </div>
                              </div>
                            </div>
                            
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  successRate >= 80 ? 'bg-green-500' :
                                  successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${successRate}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Individual Results */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Individual Student Results
                  </h3>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Status</option>
                      <option value="submitted">Submitted</option>
                      <option value="pending">Pending Review</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Time Spent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSubmissions.map((submission) => (
                      <tr key={submission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {submission.studentName}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {submission.studentEmail}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {submission.percentage || 0}%
                            </div>
                            {(submission.percentage || 0) >= 80 ? (
                              <TrendingUp className="ml-2 h-4 w-4 text-green-500" />
                            ) : (submission.percentage || 0) >= 60 ? (
                              <Minus className="ml-2 h-4 w-4 text-yellow-500" />
                            ) : (
                              <TrendingDown className="ml-2 h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {submission.autoGradedScore || 0}/{submission.maxScore || 0} marks
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const passStatus = getSubmissionPassStatus(submission);
                            return (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                passStatus === 'passed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                  : passStatus === 'failed'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}>
                                {passStatus === 'passed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                {passStatus === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                                {passStatus === 'pending' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {passStatus === 'passed' ? 'Passed' : 
                                 passStatus === 'failed' ? 'Failed' : 'Pending'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatTime(submission.totalTimeSpent || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(submission.submittedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              // Navigate to detailed view
                              router.push(`/teacher/tests/${testId}/results/${submission.id}`);
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredSubmissions.length === 0 && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No results found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Try adjusting your search or filter criteria.'
                      : 'No students have submitted this test yet.'
                    }
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </TeacherLayout>
  );
}
