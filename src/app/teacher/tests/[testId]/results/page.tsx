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
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  lateSubmissionsCount: number;
  highestScoreStudent?: {
    name: string;
    email: string;
    score: number;
    marks: string;
  };
  classAverage: number;
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
        questionStats: [],
        passedCount: 0,
        failedCount: 0,
        pendingCount: submissions.length,
        lateSubmissionsCount: 0,
        classAverage: 0
      };
    }

    const scores = submittedSubmissions.map(s => s.percentage || 0);
    const times = submittedSubmissions.map(s => s.totalTimeSpent || 0);
    
    // Calculate pass rate based on teacher's passing score configuration
    const passedSubmissions = submittedSubmissions.filter(s => {
      // If there's a passing score configured, use it
      if (test.config?.passingScore) {
        const percentage = s.percentage || 0;
        return percentage >= test.config.passingScore;
      }
      // Fallback to passStatus if no passing score is configured
      return s.passStatus === 'passed';
    });

    const failedSubmissions = submittedSubmissions.filter(s => {
      if (test.config?.passingScore) {
        const percentage = s.percentage || 0;
        return percentage < test.config.passingScore;
      }
      return s.passStatus === 'failed';
    });

    const pendingSubmissions = submissions.filter(s => 
      s.status !== 'submitted' && s.status !== 'auto_submitted'
    );

    // Count late submissions
    const lateSubmissionsCount = submittedSubmissions.filter(s => 
      s.lateSubmission?.isLateSubmission
    ).length;

    // Find highest scoring student
    const highestScoringSubmission = submittedSubmissions.reduce((prev, current) => {
      return (current.percentage || 0) > (prev.percentage || 0) ? current : prev;
    }, submittedSubmissions[0]);

    // Calculate class average (including all submissions, not just submitted ones)
    const allScores = submissions.map(s => s.percentage || 0);
    const classAverage = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

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
      passRate: (passedSubmissions.length / submittedSubmissions.length) * 100,
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      questionStats,
      passedCount: passedSubmissions.length,
      failedCount: failedSubmissions.length,
      pendingCount: pendingSubmissions.length,
      lateSubmissionsCount,
      highestScoreStudent: highestScoringSubmission ? {
        name: highestScoringSubmission.studentName,
        email: highestScoringSubmission.studentEmail || '',
        score: highestScoringSubmission.percentage || 0,
        marks: `${highestScoringSubmission.autoGradedScore || 0}/${highestScoringSubmission.maxScore || 0}`
      } : undefined,
      classAverage: isNaN(classAverage) ? 0 : classAverage
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
                         (statusFilter === 'failed' && submissionPassStatus === 'failed') ||
                         (statusFilter === 'late' && submission.lateSubmission?.isLateSubmission);

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

  // Helper function to check if a submission is a late submission
  const isLateSubmission = (submission: StudentSubmission): boolean => {
    return submission.lateSubmission?.isLateSubmission || false;
  };

  // Helper function to format late submission details
  const getLateSubmissionInfo = (submission: StudentSubmission) => {
    if (!submission.lateSubmission?.isLateSubmission) return null;
    
    return {
      approvedBy: submission.lateSubmission.approvedByName,
      reason: submission.lateSubmission.reason,
      originalDeadline: submission.lateSubmission.originalDeadline,
      approvedAt: submission.lateSubmission.approvedAt
    };
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
    const headers = ['Student Name', 'Email', 'Score (%)', 'Status', 'Type', 'Time Spent', 'Submitted At'];
    const csvContent = [
      headers.join(','),
      ...filteredSubmissions.map(submission => [
        submission.studentName,
        submission.studentEmail || '',
        submission.percentage || 0,
        submission.status,
        isLateSubmission(submission) ? 'Late Submission' : 'Regular',
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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
                          Class Average
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stats.classAverage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Submitted: {stats.averageScore.toFixed(1)}%
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
                          {stats.passedCount} passed, {stats.failedCount} failed
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
                          {stats.pendingCount} pending
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <AlertTriangle className="h-8 w-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Late Submissions
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stats.lateSubmissionsCount}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          of {stats.submittedCount} submitted
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Highest Scoring Student */}
                  {stats.highestScoreStudent && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg shadow p-6 border border-yellow-200 dark:border-yellow-700">
                      <div className="flex items-center">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                          <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="ml-4 flex-1">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                            Highest Score
                          </p>
                          <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
                            {stats.highestScoreStudent.name}
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            {stats.highestScoreStudent.score}% ({stats.highestScoreStudent.marks} marks)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Score Distribution */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center mb-4">
                      <Target className="h-6 w-6 text-blue-600" />
                      <h4 className="ml-2 text-lg font-medium text-gray-900 dark:text-white">
                        Score Range
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Highest:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{stats.highestScore}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Lowest:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{stats.lowestScore}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Range:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{stats.highestScore - stats.lowestScore}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Summary */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center mb-4">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <h4 className="ml-2 text-lg font-medium text-gray-900 dark:text-white">
                        Status Summary
                      </h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">Passed</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{stats.passedCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">Failed</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{stats.failedCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">Pending</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{stats.pendingCount}</span>
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
                    <div className="space-y-6">
                      {stats.questionStats.map((questionStat, index) => {
                        const successRate = questionStat.totalAnswers > 0 
                          ? (questionStat.correctAnswers / questionStat.totalAnswers) * 100 
                          : 0;
                        
                        // Find the corresponding question from test data
                        const questionData = test.questions?.find(q => q.id === questionStat.questionId || q.questionId === questionStat.questionId);
                        
                        return (
                          <div key={questionStat.questionId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    Question {index + 1}
                                  </h4>
                                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                    <span className="flex items-center">
                                      <Target className="h-4 w-4 mr-1" />
                                      {questionStat.questionType.toUpperCase()}
                                    </span>
                                    <span className="flex items-center">
                                      <BarChart3 className="h-4 w-4 mr-1" />
                                      {questionStat.difficultyLevel}
                                    </span>
                                    {questionData?.points && (
                                      <span className="flex items-center">
                                        <Trophy className="h-4 w-4 mr-1" />
                                        {questionData.points} {questionData.points === 1 ? 'point' : 'points'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {successRate.toFixed(1)}%
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {questionStat.correctAnswers}/{questionStat.totalAnswers} correct
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    Avg: {questionStat.averageScore.toFixed(1)} pts
                                  </div>
                                </div>
                              </div>

                              {/* Question Content */}
                              <div className="mb-4">
                                {questionData?.questionText && (
                                  <div className="prose dark:prose-invert max-w-none mb-3">
                                    <p className="text-gray-900 dark:text-white">{questionData.questionText}</p>
                                  </div>
                                )}
                                
                                {/* Question Image */}
                                {questionData?.imageUrl && (
                                  <div className="mb-4">
                                    <img
                                      src={questionData.imageUrl}
                                      alt={`Question ${index + 1}`}
                                      className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
                                      style={{ maxHeight: '400px' }}
                                    />
                                  </div>
                                )}

                                {/* MCQ Options */}
                                {questionData?.questionType === 'mcq' && questionData?.options && (
                                  <div className="mt-4">
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Options:</h5>
                                    <div className="space-y-2">
                                      {questionData.options.map((option, optionIndex) => {
                                        const isCorrect = questionData.correctOption === optionIndex;
                                        return (
                                          <div 
                                            key={optionIndex}
                                            className={`p-3 rounded-lg border ${
                                              isCorrect 
                                                ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20' 
                                                : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50'
                                            }`}
                                          >
                                            <div className="flex items-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mr-3 ${
                                                isCorrect 
                                                  ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                                              }`}>
                                                {String.fromCharCode(65 + optionIndex)}
                                              </span>
                                              <span className={`flex-1 ${
                                                isCorrect 
                                                  ? 'text-green-900 dark:text-green-100 font-medium' 
                                                  : 'text-gray-700 dark:text-gray-300'
                                              }`}>
                                                {option}
                                              </span>
                                              {isCorrect && (
                                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Explanation */}
                                {questionData?.explanation && (
                                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                    <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Explanation:</h5>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">{questionData.explanation}</p>
                                    {questionData.explanationImageUrl && (
                                      <img
                                        src={questionData.explanationImageUrl}
                                        alt="Explanation"
                                        className="mt-2 max-w-full h-auto rounded border border-blue-200 dark:border-blue-600"
                                        style={{ maxHeight: '300px' }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Performance Bar */}
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all duration-300 ${
                                    successRate >= 80 ? 'bg-green-500' :
                                    successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${successRate}%` }}
                                ></div>
                              </div>
                              
                              {/* Performance Indicator */}
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {successRate >= 80 ? 'Excellent performance' :
                                 successRate >= 60 ? 'Good performance' :
                                 successRate >= 40 ? 'Needs improvement' : 'Difficult question'}
                              </div>
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
                      <option value="late">Late Submissions</option>
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
                        Type
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
                    {filteredSubmissions.map((submission) => {
                      const isHighestScorer = stats?.highestScoreStudent && 
                        submission.studentName === stats.highestScoreStudent.name &&
                        (submission.percentage || 0) === stats.highestScoreStudent.score;
                      
                      return (
                        <tr 
                          key={submission.id} 
                          className={`${
                            isHighestScorer
                              ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-400 hover:from-yellow-100 hover:to-orange-100 dark:hover:from-yellow-900/30 dark:hover:to-orange-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className={`text-sm font-medium ${
                                  isHighestScorer 
                                    ? 'text-yellow-900 dark:text-yellow-100' 
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                  {submission.studentName}
                                  {isHighestScorer && (
                                    <Trophy className="inline ml-2 h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                  )}
                                </div>
                                <div className={`text-sm ${
                                  isHighestScorer 
                                    ? 'text-yellow-700 dark:text-yellow-300' 
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {submission.studentEmail}
                                  {isHighestScorer && (
                                    <span className="ml-2 text-xs font-medium text-yellow-800 dark:text-yellow-200">
                                      🏆 Highest Score
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`text-sm font-medium ${
                                isHighestScorer 
                                  ? 'text-yellow-900 dark:text-yellow-100' 
                                  : 'text-gray-900 dark:text-white'
                              }`}>
                                {submission.percentage || 0}%
                                {isHighestScorer && (
                                  <span className="ml-2 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full font-medium">
                                    TOP SCORE
                                  </span>
                                )}
                              </div>
                              {(submission.percentage || 0) >= 80 ? (
                                <TrendingUp className="ml-2 h-4 w-4 text-green-500" />
                              ) : (submission.percentage || 0) >= 60 ? (
                                <Minus className="ml-2 h-4 w-4 text-yellow-500" />
                              ) : (
                                <TrendingDown className="ml-2 h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div className={`text-xs ${
                              isHighestScorer 
                                ? 'text-yellow-700 dark:text-yellow-300' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isLateSubmission(submission) ? (
                              <div className="group relative">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 cursor-help">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Late Submission
                                </span>
                                {getLateSubmissionInfo(submission) && (
                                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    <div className="font-medium mb-1">Late Submission Details:</div>
                                    <div>Approved by: {getLateSubmissionInfo(submission)?.approvedBy}</div>
                                    {getLateSubmissionInfo(submission)?.reason && (
                                      <div>Reason: {getLateSubmissionInfo(submission)?.reason}</div>
                                    )}
                                    <div>Original deadline: {formatDateTime(getLateSubmissionInfo(submission)?.originalDeadline)}</div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                Regular
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            isHighestScorer 
                              ? 'text-yellow-900 dark:text-yellow-100' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {formatTime(submission.totalTimeSpent || 0)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            isHighestScorer 
                              ? 'text-yellow-700 dark:text-yellow-300' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {formatDateTime(submission.submittedAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                // Navigate to detailed view
                                router.push(`/teacher/tests/${testId}/results/${submission.id}`);
                              }}
                              className={`${
                                isHighestScorer
                                  ? 'text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-200'
                                  : 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'
                              }`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
