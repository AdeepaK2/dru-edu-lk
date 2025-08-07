'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  BookOpen,
  Target,
  Award,
  AlertCircle,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  ArrowRight,
  GraduationCap,
  Users,
  Clock
} from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button, Input } from '@/components/ui';
import Link from 'next/link';

// Import services and types
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { SubmissionService } from '@/apiservices/submissionService';
import { TestService } from '@/apiservices/testService';
import { GradeAnalyticsService } from '@/apiservices/gradeAnalyticsService';

interface ClassProgress {
  id: string;
  name: string;
  subject: string;
  grade: string;
  totalTests: number;
  completedTests: number;
  averageScore: number;
  improvement: number;
  lastTestDate?: Date;
  difficultTopics: string[];
  strongTopics: string[];
  enrollmentId: string;
}

interface TestResult {
  id: string;
  testTitle: string;
  subject: string;
  className: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  completedAt: Date;
  timeSpent: number;
  lessonTopics: string[];
  difficultQuestions: any[];
}

interface DifficultyAnalysis {
  topic: string;
  subject: string;
  className: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  improvementNeeded: boolean;
}

export default function StudentResults() {
  const { student } = useStudentAuth();
  const [studentClasses, setStudentClasses] = useState<ClassProgress[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [difficultyAnalysis, setDifficultyAnalysis] = useState<DifficultyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load student's classes and overall progress
  useEffect(() => {
    const loadStudentProgress = async () => {
      if (!student?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get student's enrollments
        const enrollments = await getEnrollmentsByStudent(student.id);
        const activeEnrollments = enrollments.filter(e => e.status === 'Active');
        
        // Get detailed progress for each class
        const classProgress = await Promise.all(
          activeEnrollments.map(async (enrollment) => {
            try {
              const classDetails = await ClassFirestoreService.getClassById(enrollment.classId);
              
              // Use GradeAnalyticsService to get proper student performance data
              const performanceData = await GradeAnalyticsService.getStudentPerformanceData(
                student.id, 
                enrollment.classId
              );
              
              console.log('Performance data from GradeAnalyticsService:', performanceData);
              
              return {
                id: enrollment.classId,
                name: enrollment.className,
                subject: enrollment.subject,
                grade: classDetails?.year || 'N/A',
                totalTests: performanceData.totalTests,
                completedTests: performanceData.totalTests,
                averageScore: Math.round(performanceData.overallAverage),
                improvement: performanceData.improvementTrend === 'improving' ? 10 : 
                            performanceData.improvementTrend === 'declining' ? -10 : 0,
                lastTestDate: performanceData.lastActiveDate?.toDate(),
                difficultTopics: performanceData.weakTopics.map(t => t.topic),
                strongTopics: performanceData.strongTopics.map(t => t.topic),
                enrollmentId: enrollment.id
              } as ClassProgress;
            } catch (err) {
              console.error(`Error loading progress for class ${enrollment.classId}:`, err);
              return {
                id: enrollment.classId,
                name: enrollment.className,
                subject: enrollment.subject,
                grade: 'N/A',
                totalTests: 0,
                completedTests: 0,
                averageScore: 0,
                improvement: 0,
                difficultTopics: [],
                strongTopics: [],
                enrollmentId: enrollment.id
              } as ClassProgress;
            }
          })
        );
        
        setStudentClasses(classProgress);
        
      } catch (err: any) {
        console.error('Error loading student progress:', err);
        setError(err.message || 'Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    loadStudentProgress();
  }, [student?.id]);

  // Load detailed results for selected class
  const loadClassResults = async (classId: string) => {
    if (!student?.id) return;
    
    setLoadingResults(true);
    setSelectedClass(classId);
    
    try {
      // Use GradeAnalyticsService to get comprehensive student performance data
      const performanceData = await GradeAnalyticsService.getStudentPerformanceData(
        student.id, 
        classId
      );
      
      console.log('Detailed performance data:', performanceData);
      
      // Convert recent test scores to TestResult format and group by test ID to show only best attempts
      const testScoresByTestId = new Map<string, any>();
      
      // Group test scores by test ID and keep the best score for each test
      performanceData.recentTestScores.forEach((testScore) => {
        const existingScore = testScoresByTestId.get(testScore.testId);
        if (!existingScore || testScore.score > existingScore.score) {
          testScoresByTestId.set(testScore.testId, testScore);
        }
      });
      
      // Convert the best attempts to TestResult format
      const testResults: TestResult[] = Array.from(testScoresByTestId.values()).map((testScore) => ({
        id: testScore.testId,
        testTitle: testScore.testTitle,
        subject: studentClasses.find(c => c.id === classId)?.subject || 'Unknown',
        className: studentClasses.find(c => c.id === classId)?.name || 'Unknown Class',
        score: Math.round(testScore.score),
        totalQuestions: 0, // This would need to be calculated from the test
        correctAnswers: 0, // This would need to be calculated from the submission
        completedAt: testScore.completedAt?.toDate() || new Date(),
        timeSpent: 0, // This would need to be retrieved from submission
        lessonTopics: [], // This would need to be populated from test questions
        difficultQuestions: [] // This would need to be retrieved from submission
      }));
      
      // Sort by completion date (most recent first)
      testResults.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      
      setTestResults(testResults);
      
      // Convert weak topics to difficulty analysis
      const difficultyAnalysis: DifficultyAnalysis[] = performanceData.weakTopics.map((topic) => ({
        topic: topic.topic,
        subject: studentClasses.find(c => c.id === classId)?.subject || 'Unknown',
        className: studentClasses.find(c => c.id === classId)?.name || 'Unknown Class',
        totalQuestions: topic.totalQuestions,
        correctAnswers: topic.correctAnswers,
        accuracy: topic.averageScore,
        improvementNeeded: topic.averageScore < 60
      }));
      
      setDifficultyAnalysis(difficultyAnalysis);
      
    } catch (err: any) {
      console.error('Error loading class results:', err);
      setError(err.message || 'Failed to load test results');
    } finally {
      setLoadingResults(false);
    }
  };

  // Analyze difficult topics based on test results
  const analyzeDifficultTopics = (results: TestResult[]) => {
    const topicStats: Record<string, {
      total: number;
      correct: number;
      subject: string;
      className: string;
    }> = {};
    
    results.forEach(result => {
      result.lessonTopics.forEach(topic => {
        if (!topicStats[topic]) {
          topicStats[topic] = {
            total: 0,
            correct: 0,
            subject: result.subject,
            className: result.className
          };
        }
        
        // Estimate questions per topic (simplified)
        const questionsPerTopic = Math.floor(result.totalQuestions / result.lessonTopics.length);
        const correctPerTopic = Math.floor(result.correctAnswers / result.lessonTopics.length);
        
        topicStats[topic].total += questionsPerTopic;
        topicStats[topic].correct += correctPerTopic;
      });
    });
    
    const analysis: DifficultyAnalysis[] = Object.entries(topicStats).map(([topic, stats]) => ({
      topic,
      subject: stats.subject,
      className: stats.className,
      totalQuestions: stats.total,
      correctAnswers: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      improvementNeeded: stats.total > 0 && (stats.correct / stats.total) < 0.6 // Less than 60% accuracy
    }));
    
    // Sort by accuracy (worst first)
    analysis.sort((a, b) => a.accuracy - b.accuracy);
    setDifficultyAnalysis(analysis);
  };

  // Filter classes by search term
  const filteredClasses = studentClasses.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate overall stats
  const overallStats = {
    totalTests: testResults.length, // Use the length of distinct test results instead of sum from classes
    averageScore: studentClasses.length > 0 
      ? Math.round(studentClasses.reduce((sum, c) => sum + c.averageScore, 0) / studentClasses.length)
      : 0,
    improvingClasses: studentClasses.filter(c => c.improvement > 0).length,
    strugglingSubjects: difficultyAnalysis.filter(d => d.improvementNeeded).length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
          
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                My Progress & Results
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Track your test performance and identify areas for improvement
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search classes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tests Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {overallStats.totalTests}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {overallStats.averageScore}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Improving Classes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {overallStats.improvingClasses}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Topics to Improve</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {overallStats.strugglingSubjects}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  My Classes
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a class to view detailed results
                </p>
              </div>
              
              <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
                {filteredClasses.map((classInfo) => (
                  <div
                    key={classInfo.id}
                    onClick={() => loadClassResults(classInfo.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedClass === classInfo.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                          {classInfo.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {classInfo.subject} • Grade {classInfo.grade}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {classInfo.averageScore}%
                        </p>
                        <div className="flex items-center text-xs">
                          {classInfo.improvement > 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                          ) : classInfo.improvement < 0 ? (
                            <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
                          ) : null}
                          <span className={`${
                            classInfo.improvement > 0 ? 'text-green-500' : 
                            classInfo.improvement < 0 ? 'text-red-500' : 'text-gray-500'
                          }`}>
                            {classInfo.improvement > 0 ? '+' : ''}{classInfo.improvement}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{classInfo.completedTests} tests completed</span>
                      {classInfo.lastTestDate && (
                        <span>
                          Last: {classInfo.lastTestDate.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {filteredClasses.length === 0 && (
                  <div className="text-center py-8">
                    <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm ? 'No classes match your search' : 'No classes available'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="lg:col-span-2">
            {selectedClass ? (
              <div className="space-y-6">
                {/* Test Results */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Test Results
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Your best performance for each test
                    </p>
                  </div>
                  
                  <div className="p-6">
                    {loadingResults ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : testResults.length > 0 ? (
                      <div className="space-y-4">
                        {testResults.map((result) => (
                          <div
                            key={result.id}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {result.testTitle}
                                  </h3>
                                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full">
                                    Best Attempt
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {result.completedAt.toLocaleDateString()} • {result.subject}
                                </p>
                              </div>
                              
                              <div className="text-right">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-lg font-bold ${
                                    result.score >= 80 ? 'text-green-600' :
                                    result.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {result.score}%
                                  </span>
                                  {result.score >= 80 ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {result.totalQuestions > 0 ? 
                                    `${result.correctAnswers}/${result.totalQuestions} correct` :
                                    'Score calculated'
                                  }
                                </p>
                              </div>
                            </div>
                            
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span>
                                Time: {result.timeSpent > 0 ? `${Math.round(result.timeSpent / 60)} min` : 'Not recorded'}
                              </span>
                              <span>
                                {result.lessonTopics.length > 0 ? 
                                  `Topics: ${result.lessonTopics.join(', ')}` : 
                                  'Topics: General'
                                }
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No test results available for this class
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Difficulty Analysis */}
                {difficultyAnalysis.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Topics to Improve
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Areas where you need more practice
                      </p>
                    </div>
                    
                    <div className="p-6">
                      <div className="space-y-4">
                        {difficultyAnalysis.slice(0, 5).map((analysis, index) => (
                          <div
                            key={analysis.topic}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">
                                  {analysis.topic}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {analysis.subject}
                                </p>
                              </div>
                              
                              <div className="text-right">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-lg font-bold ${
                                    analysis.accuracy >= 80 ? 'text-green-600' :
                                    analysis.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {Math.round(analysis.accuracy)}%
                                  </span>
                                  {analysis.improvementNeeded && (
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {analysis.correctAnswers}/{analysis.totalQuestions} correct
                                </p>
                              </div>
                            </div>
                            
                            {analysis.improvementNeeded && (
                              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <p className="text-sm text-red-700 dark:text-red-300">
                                  💡 Focus on this topic - accuracy below 60%
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Select a Class
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose a class from the left to view your detailed test results and progress analysis
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Growth Insights */}
        {studentClasses.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Your Learning Journey
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Keep up the great work! Here's what we noticed about your progress:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {overallStats.improvingClasses} subjects showing improvement
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Target className="w-4 h-4 text-blue-500 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {overallStats.averageScore}% average performance
                    </span>
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="w-4 h-4 text-purple-500 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {overallStats.totalTests} tests completed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
