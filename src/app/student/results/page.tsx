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
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="bg-gradient-to-r from-blue-400 to-purple-400 rounded-3xl shadow-2xl border-4 border-black p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin bg-gradient-to-r from-yellow-400 to-orange-400"></div>
              <span className="text-2xl font-black text-black">Loading your magical results... ✨</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Mickey Mouse Header */}
        <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-3xl shadow-2xl border-4 border-black p-8 relative overflow-hidden">
          {/* Mickey Mouse Ears */}
          <div className="absolute -top-4 -left-4 w-12 h-12 bg-black rounded-full"></div>
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-black rounded-full"></div>

          <div className="flex items-center space-x-4 relative z-10">
            <div className="text-6xl">📊</div>
            <div>
              <h1 className="text-4xl font-black text-black mb-2 flex items-center">
                <span>Mickey's</span>
                <span className="ml-2 text-white font-black text-5xl">Results</span>
                <span className="ml-2 text-3xl">&</span>
                <span className="ml-2 text-3xl">Progress</span>
                <span className="ml-2 text-3xl">🎭</span>
              </h1>
              <p className="text-black font-bold text-lg">
                Welcome back, {student?.name}! Let's see how magical your learning journey has been! ✨
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-3xl shadow-2xl border-4 border-black p-6">
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">🔍</div>
            <input
              type="text"
              placeholder="🔍 Search magical classes..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-12 w-full px-6 py-3 border-4 border-black rounded-3xl focus:ring-4 focus:ring-yellow-400 focus:border-black bg-white text-black font-bold text-lg placeholder-black/60"
            />
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-400 to-indigo-500 rounded-3xl shadow-2xl border-4 border-black p-6 hover:scale-105 transition-all">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center border-4 border-black shadow-lg">
                <BookOpen className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-white font-black text-sm mb-1">Tests Completed</p>
                <p className="text-3xl font-black text-white">
                  {overallStats.totalTests}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-3xl shadow-2xl border-4 border-black p-6 hover:scale-105 transition-all">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center border-4 border-black shadow-lg">
                <Target className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-white font-black text-sm mb-1">Average Score</p>
                <p className="text-3xl font-black text-white">
                  {overallStats.averageScore}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-400 to-pink-500 rounded-3xl shadow-2xl border-4 border-black p-6 hover:scale-105 transition-all">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center border-4 border-black shadow-lg">
                <TrendingUp className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-white font-black text-sm mb-1">Improving Classes</p>
                <p className="text-3xl font-black text-white">
                  {overallStats.improvingClasses}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl shadow-2xl border-4 border-black p-6 hover:scale-105 transition-all">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-pink-400 rounded-2xl flex items-center justify-center border-4 border-black shadow-lg">
                <AlertCircle className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-white font-black text-sm mb-1">Topics to Improve</p>
                <p className="text-3xl font-black text-white">
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
            <div className="bg-white rounded-3xl shadow-2xl border-4 border-black overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 border-b-4 border-black">
                <h2 className="text-xl font-black flex items-center">
                  <span className="text-2xl mr-3">🎓</span>
                  My Magical Classes
                </h2>
                <p className="text-green-100 font-bold text-sm">
                  Select a class to view your enchanted results! ✨
                </p>
              </div>
              
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                {filteredClasses.map((classInfo) => (
                  <div
                    key={classInfo.id}
                    onClick={() => loadClassResults(classInfo.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 ${
                      selectedClass === classInfo.id
                        ? 'border-yellow-400 bg-gradient-to-r from-yellow-100 to-orange-100'
                        : 'border-gray-300 hover:border-black bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-black text-black text-sm mb-1">
                          {classInfo.name}
                        </h3>
                        <p className="text-gray-600 font-bold text-xs">
                          {classInfo.subject} • Grade {classInfo.grade}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-black">
                          {classInfo.averageScore}%
                        </p>
                        <div className="flex items-center text-xs">
                          {classInfo.improvement > 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                          ) : classInfo.improvement < 0 ? (
                            <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                          ) : null}
                          <span className={`font-black ${
                            classInfo.improvement > 0 ? 'text-green-600' : 
                            classInfo.improvement < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {classInfo.improvement > 0 ? '+' : ''}{classInfo.improvement}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-600 font-bold">
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
                    <div className="text-4xl mb-4">🎓</div>
                    <h3 className="text-xl font-black text-black mb-2">
                      {searchTerm ? 'No Magical Classes Found' : 'No Classes Available Yet'}
                    </h3>
                    <p className="text-gray-600 font-bold">
                      {searchTerm
                        ? 'Try adjusting your search to find your magical classes! 🔍'
                        : 'You haven\'t enrolled in any classes yet. Time to start your learning adventure! ✨'
                      }
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
                <div className="bg-white rounded-3xl shadow-2xl border-4 border-black overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 border-b-4 border-black">
                    <h2 className="text-xl font-black flex items-center">
                      <span className="text-2xl mr-3">📝</span>
                      Test Results
                    </h2>
                    <p className="text-blue-100 font-bold text-sm">
                      Your best magical performance for each test ✨
                    </p>
                  </div>
                  
                  <div className="p-6">
                    {loadingResults ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl p-4 border-2 border-gray-400">
                            <div className="h-4 bg-gray-400 rounded mb-2"></div>
                            <div className="h-3 bg-gray-300 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : testResults.length > 0 ? (
                      <div className="space-y-4">
                        {testResults.map((result) => (
                          <div
                            key={result.id}
                            className="bg-gradient-to-r from-white to-gray-50 rounded-2xl border-2 border-gray-300 p-4 hover:border-black transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h3 className="font-black text-black text-base">
                                    {result.testTitle}
                                  </h3>
                                  <span className="px-3 py-1 text-xs font-black bg-gradient-to-r from-yellow-400 to-orange-400 text-black rounded-full border-2 border-black">
                                    Best Attempt 🏆
                                  </span>
                                </div>
                                <p className="text-gray-600 font-bold text-sm">
                                  {result.completedAt.toLocaleDateString()} • {result.subject}
                                </p>
                              </div>
                              
                              <div className="text-right">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-2xl font-black ${
                                    result.score >= 80 ? 'text-green-600' :
                                    result.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {result.score}%
                                  </span>
                                  {result.score >= 80 ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                  ) : (
                                    <XCircle className="w-6 h-6 text-red-600" />
                                  )}
                                </div>
                                <p className="text-gray-600 font-bold text-xs">
                                  {result.totalQuestions > 0 ? 
                                    `${result.correctAnswers}/${result.totalQuestions} correct` :
                                    'Score calculated'
                                  }
                                </p>
                              </div>
                            </div>
                            
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-600 font-bold">
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
                        <div className="text-4xl mb-4">📊</div>
                        <h3 className="text-xl font-black text-black mb-2">
                          No Test Results Yet
                        </h3>
                        <p className="text-gray-600 font-bold">
                          Complete some magical tests to see your results here! ✨
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Difficulty Analysis */}
                {difficultyAnalysis.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-2xl border-4 border-black overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-6 border-b-4 border-black">
                      <h2 className="text-xl font-black flex items-center">
                        <span className="text-2xl mr-3">🎯</span>
                        Topics to Improve
                      </h2>
                      <p className="text-red-100 font-bold text-sm">
                        Areas where you need more magical practice ✨
                      </p>
                    </div>
                    
                    <div className="p-6">
                      <div className="space-y-4">
                        {difficultyAnalysis.slice(0, 5).map((analysis, index) => (
                          <div
                            key={analysis.topic}
                            className="bg-gradient-to-r from-white to-gray-50 rounded-2xl border-2 border-gray-300 p-4 hover:border-black transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="font-black text-black text-base">
                                  {analysis.topic}
                                </h3>
                                <p className="text-gray-600 font-bold text-sm">
                                  {analysis.subject}
                                </p>
                              </div>
                              
                              <div className="text-right">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xl font-black ${
                                    analysis.accuracy >= 80 ? 'text-green-600' :
                                    analysis.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {Math.round(analysis.accuracy)}%
                                  </span>
                                  {analysis.improvementNeeded && (
                                    <AlertCircle className="w-6 h-6 text-red-600" />
                                  )}
                                </div>
                                <p className="text-gray-600 font-bold text-xs">
                                  {analysis.correctAnswers}/{analysis.totalQuestions} correct
                                </p>
                              </div>
                            </div>
                            
                            {analysis.improvementNeeded && (
                              <div className="mt-3 p-3 bg-gradient-to-r from-red-100 to-pink-100 rounded-xl border-2 border-red-300">
                                <p className="text-red-700 font-black text-sm">
                                  💡 Focus on this topic - accuracy below 60%! Let's make it magical! ✨
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
              <div className="bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200 rounded-3xl shadow-2xl border-4 border-black p-12 text-center">
                <div className="text-6xl mb-6">🎓</div>
                <h3 className="text-2xl font-black text-black mb-4">
                  Select a Magical Class
                </h3>
                <p className="text-black font-bold text-lg">
                  Choose a class from the left to view your detailed test results and progress analysis! ✨
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Growth Insights */}
        {studentClasses.length > 0 && (
          <div className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 rounded-3xl shadow-2xl border-4 border-black p-8">
            <div className="flex items-start space-x-6">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-3xl flex items-center justify-center border-4 border-black shadow-lg flex-shrink-0">
                <Award className="w-10 h-10 text-black" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black text-white mb-3 flex items-center">
                  <span>Your Learning Journey</span>
                  <span className="ml-3 text-3xl">🚀</span>
                </h3>
                <p className="text-white font-bold text-lg mb-6">
                  Keep up the great work! Here's what we noticed about your magical progress:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center bg-white/20 rounded-2xl p-4 border-2 border-white/30">
                    <TrendingUp className="w-6 h-6 text-green-300 mr-3 flex-shrink-0" />
                    <span className="text-white font-black">
                      {overallStats.improvingClasses} subjects showing improvement
                    </span>
                  </div>
                  <div className="flex items-center bg-white/20 rounded-2xl p-4 border-2 border-white/30">
                    <Target className="w-6 h-6 text-blue-300 mr-3 flex-shrink-0" />
                    <span className="text-white font-black">
                      {overallStats.averageScore}% average performance
                    </span>
                  </div>
                  <div className="flex items-center bg-white/20 rounded-2xl p-4 border-2 border-white/30">
                    <BookOpen className="w-6 h-6 text-purple-300 mr-3 flex-shrink-0" />
                    <span className="text-white font-black">
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
