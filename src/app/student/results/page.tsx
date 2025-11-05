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
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();
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
      <div className={`min-h-screen bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-blue-400 to-indigo-600'} flex items-center justify-center`}>
        <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} rounded-3xl p-8 shadow-2xl`}>
          {/* Theme-Specific Loading Animation */}
          <div className="relative mb-6 flex flex-col items-center">
            {/* Tinkerbell Loading GIF */}
            {theme === 'tinkerbell' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/tinkerbell-loading.gif" 
                  alt="Tinkerbell Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-yellow-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* Ben 10 Loading GIF */}
            {theme === 'ben10' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/ben10-loading.gif" 
                  alt="Ben 10 Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#64cc4f] mt-4">Loading</span>
              </div>
            )}

            {/* BounceWorld Loading Animation */}
            {theme === 'bounceworld' && (
              <div className="flex flex-col items-center">
                <img
                  src="/bounceworld.gif"
                  alt="BounceWorld Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading</span>
              </div>
            )}

            {/* Avengers Loading Animation */}
            {theme === 'avengers' && (
              <div className="flex flex-col items-center">
                <img
                  src="/avenger.gif"
                  alt="Avengers Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#2C1267] mt-4">Assembling</span>
              </div>
            )}

            {/* Ponyville Loading Animation */}
            {theme === 'ponyville' && (
              <div className="flex flex-col items-center">
                <img
                  src="/ponyville-loading.gif"
                  alt="Ponyville Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#e13690] mt-4">Casting Magic</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'cricketverse' && theme !== 'ponyville' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Results...</h2>
            <p className={`text-gray-600 font-medium ${theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#2C1267]' : theme === 'ponyville' ? 'text-[#e13690]' : ''}`}>
              {theme === 'bounceworld' ? 'Get ready to slam dunk your progress analysis! 🏀' : theme === 'avengers' ? 'Assemble your progress analysis! 🛡️' : theme === 'ponyville' ? 'Get ready to transform your learning with magical results! 🦄' : 'Get ready to transform your learning!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={`results-${theme}`} className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] via-[#604AC7]/20 to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] via-[#ec79b6] to-[#ff2e9f]' : 'bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-400'} p-6`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Theme-aware Header */}
        <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#5ab34a] via-[#64cc4f] to-[#111511]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-500 to-indigo-600'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} p-8 relative overflow-hidden`}>
         
          <div className="flex items-center space-x-4 relative z-10">
            {theme === 'ponyville' ? (
              <img
                src="/ponyville/applejack.png"
                alt="Applejack"
                className="w-24 h-24 object-contain"
              />
            ) : theme === 'avengers' ? (
              <img
                src="/avengers/captain-america.png"
                alt="Captain America"
                className="w-24 h-24 object-contain"
              />
            ) : (
              <div className="text-6xl">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : ''}</div>
            )}
            <div>
              <h1 className="text-4xl font-black text-black mb-2 flex items-center">
               
               
                <span className={`ml-2 text-4xl ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : 'text-black'}`}>Results</span>
                <span className={`ml-2 text-4xl ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : 'text-black'}`}>&</span>
                <span className={`ml-2 text-4xl ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : 'text-black'}`}>Progress</span>
             
              </h1>
              <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-[#1f2902]' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : 'text-blue-200'}`}>
                {theme === 'bounceworld'
                  ? `Welcome back, ${student?.name}! Slam dunk your progress analysis! 🏀`
                  : theme === 'ben10'
                  ? `Welcome back, ${student?.name}! Let's see how heroic your learning journey has been!`
                  : theme === 'tinkerbell'
                  ? `Welcome back, ${student?.name}! Let's see how magical your learning journey has been!`
                  : theme === 'avengers'
                  ? `Welcome back, ${student?.name}! Assemble your progress analysis! 🛡️`
                  : theme === 'ponyville'
                  ? `Welcome back, ${student?.name}! Let's cast magical spells on your learning results! ✨🦄`
                  : `Welcome back, ${student?.name}! Let's see how your learning journey has been!`}
              </p>
            </div>
          </div>
        </div>        {/* Search */}
        <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6`}>
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">{(theme === 'ben10' || theme === 'tinkerbell') && '🔍'}</div>
            <input
              type="text"
              placeholder={theme === 'bounceworld' ? 'Search classes...' : theme === 'avengers' ? 'Search hero classes...' : theme === 'ponyville' ? 'Search magical classes...' : '🔍 Search classes...'}
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className={`pl-12 w-full px-6 py-3 border-4 ${theme === 'bounceworld' ? 'border-[#1D428A] focus:ring-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267] focus:ring-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690] focus:ring-[#e13690]' : 'border-black focus:ring-[#64cc4f]'} rounded-3xl focus:ring-4 focus:border-black bg-white text-black font-bold text-lg placeholder-black/60`}
            />
          </div>
        </div>

        {/* Theme-aware Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 hover:scale-105 transition-all relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-black'}`}></div>
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-br from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-br from-blue-400 to-indigo-600'} rounded-2xl flex items-center justify-center border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} shadow-lg`}>
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-black font-black text-sm mb-1">Tests Completed</p>
                <p className="text-3xl font-black text-black">
                  {overallStats.totalTests}
                </p>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 hover:scale-105 transition-all relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-black'}`}></div>
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${theme === 'ben10' ? 'bg-gradient-to-br from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-br from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-br from-blue-400 to-indigo-600'} rounded-2xl flex items-center justify-center border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} shadow-lg`}>
                <Target className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-black font-black text-sm mb-1">Average Score</p>
                <p className="text-3xl font-black text-black">
                  {overallStats.averageScore}%
                </p>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 hover:scale-105 transition-all relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-black'}`}></div>
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-br from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-br from-blue-400 to-indigo-600'} rounded-2xl flex items-center justify-center border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} shadow-lg`}>
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-black font-black text-sm mb-1">Improving Classes</p>
                <p className="text-3xl font-black text-black">
                  {overallStats.improvingClasses}
                </p>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 hover:scale-105 transition-all relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-black'}`}></div>
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-br from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-br from-blue-400 to-indigo-600'} rounded-2xl flex items-center justify-center border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} shadow-lg`}>
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-black font-black text-sm mb-1">Topics to Improve</p>
                <p className="text-3xl font-black text-black">
                  {overallStats.strugglingSubjects}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Theme-aware Class List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-2xl border-4 border-black overflow-hidden">
              <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#4cc235] to-lime-800' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-500 via-indigo-600 to-indigo-800'} text-white p-6 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'}`}>
                <h2 className="text-xl text-black font-black flex items-center">
                  <span className="text-3xl mr-3">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? ' ' : ''}</span>
                  {theme === 'bounceworld' ? 'My Classes' : theme === 'ponyville' ? 'My Magical Classes' : 'My Classes'}
                </h2>
                <p className={`font-bold text-sm ${theme === 'ben10' ? 'text-green-100' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : 'text-blue-200'}`}>
                  {theme === 'bounceworld' ? 'Select a class to slam dunk your detailed results! 🏀' : theme === 'avengers' ? 'Select a class to assemble your detailed results! 🛡️' : theme === 'ponyville' ? 'Select a class to cast magical spells on your results! ✨🦄' : 'Select a class to view your detailed results!'}
                </p>
              </div>
              
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                {filteredClasses.map((classInfo) => (
                  <div
                    key={classInfo.id}
                    onClick={() => loadClassResults(classInfo.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 ${
                      selectedClass === classInfo.id
                        ? 'border-green-400 bg-gradient-to-r from-green-100 to-green-200'
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
                    
                    <h3 className="text-xl font-black text-black mb-2">
                      {searchTerm ? `No Classes Found` : `No Classes Available Yet`}
                    </h3>
                    <p className="text-gray-600 font-bold">
                      {searchTerm
                        ? `Try adjusting your search to find your classes! 🔍`
                        : (theme === 'bounceworld' ? `You haven't enrolled in any classes yet. Time to start your slam dunk learning journey! 🏀` : theme === 'avengers' ? `You haven't enrolled in any classes yet. Time to assemble your team and start your hero learning journey! 🛡️` : theme === 'ponyville' ? `You haven't enrolled in any classes yet. Time to start your magical learning journey and cast your first spells! ✨🦄` : `You haven't enrolled in any classes yet. Time to start your ${theme === 'ben10' ? 'hero' : 'magical'} learning journey!`)
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
                {/* Theme-aware Test Results */}
                <div className="bg-white rounded-3xl shadow-2xl border-4 border-black overflow-hidden">
                  <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#4cc235] to-lime-800' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-500 via-indigo-600 to-indigo-800'} text-white p-6 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'}`}>
                    <h2 className="text-xl font-black text-black flex items-center">
                      <span className="text-2xl mr-3">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '🦄' : '📊'}</span>
                      {theme === 'bounceworld' ? 'Test Results' : theme === 'ponyville' ? 'Magical Test Results' : 'Test Results'}
                    </h2>
                    <p className={`font-bold text-sm ${theme === 'ben10' ? 'text-green-100' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : 'text-blue-200'}`}>
                      {theme === 'bounceworld' ? 'Your best slam dunk performance for each test! 🏀' : theme === 'avengers' ? 'Your best heroic performance for each test! 🛡️' : theme === 'ponyville' ? 'Your best magical performance for each test! ✨🦄' : `Your best ${theme === 'ben10' ? 'heroic' : 'magical'} performance for each test.`}
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
                                  <span className="px-3 py-1 text-xs font-black bg-gradient-to-r from-green-400 to-green-600 text-white rounded-full border-2 border-black">
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
                       
                        <h3 className="text-xl font-black text-black mb-2">
                          No Test Results Yet
                        </h3>
                        <p className="text-gray-600 font-bold">
                          {theme === 'bounceworld' ? 'Complete some tests to see your slam dunk results here! 🏀' : theme === 'avengers' ? 'Complete some tests to see your heroic results here! 🛡️' : theme === 'ponyville' ? 'Complete some tests to see your magical results here! ✨🦄' : `Complete some ${theme === 'ben10' ? 'hero' : 'magical'} tests to see your results here!`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Theme-aware Difficulty Analysis */}
                {difficultyAnalysis.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-2xl border-4 border-black overflow-hidden">
                    <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#4cc235] to-lime-800' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-500 via-indigo-600 to-indigo-800'} text-white p-6 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'}`}>
                      <h2 className="text-xl font-black flex items-center">
                        <span className="text-2xl mr-3">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '🦄' : '🎯'}</span>
                        {theme === 'bounceworld' ? 'Topics to Improve' : theme === 'ponyville' ? 'Magical Topics to Improve' : 'Topics to Improve'}
                      </h2>
                      <p className={`font-bold text-sm ${theme === 'ben10' ? 'text-green-100' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : 'text-blue-200'}`}>
                        {theme === 'bounceworld' ? 'Areas where you need more practice to slam dunk your skills! 🏀' : theme === 'avengers' ? 'Areas where you need more heroic practice to assemble your skills! 🛡️' : theme === 'ponyville' ? 'Areas where you need more magical practice to cast perfect spells! ✨🦄' : `Areas where you need more ${theme === 'ben10' ? 'heroic' : 'magical'} practice to boost your skills!`}
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
                                  💡 Focus on this topic - accuracy below 60%! Let's make it {theme === 'bounceworld' ? 'slam dunk worthy' : theme === 'ben10' ? 'heroic' : theme === 'avengers' ? 'assemble-worthy' : theme === 'ponyville' ? 'magical' : 'magical'}! {theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🛡️' : theme === 'ponyville' ? '✨🦄' : ''}
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
              <div className={`${
                theme === 'ben10'
                  ? 'bg-gradient-to-r from-lime-600 via-green-600 to-lime-600'
                  : theme === 'tinkerbell'
                  ? 'bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300'
                  : theme === 'bounceworld'
                  ? 'bg-gradient-to-r from-white via-[#1D428A]/20 to-[#C8102E]/20'
                  : theme === 'avengers'
                  ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]'
                  : theme === 'ponyville'
                  ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
                  : 'bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600'
              } rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-12 text-center`}>
                <div className="text-6xl mb-6">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '🦄' : ''}</div>
                <h3 className="text-2xl font-black text-black mb-4">
                  Select a Class
                </h3>
                <p className="text-black font-bold text-lg">
                  {theme === 'bounceworld' ? 'Choose a class from the left to slam dunk your detailed results! 🏀' : theme === 'avengers' ? 'Choose a class from the left to assemble your detailed results! 🛡️' : theme === 'ponyville' ? 'Choose a class from the left to cast your magical results! ✨🦄' : 'Choose a class from the left to view your detailed test results and progress analysis!'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Theme-aware Growth Insights */}
        {studentClasses.length > 0 && (
          <div className={`${
            theme === 'ben10'
              ? 'bg-gradient-to-r from-[#4cc235] via-[#4cc235] to-lime-800'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'
              : theme === 'bounceworld'
              ? 'bg-white'
              : theme === 'avengers'
              ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]'
              : theme === 'ponyville'
              ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
              : 'bg-gradient-to-r from-blue-600 via-indigo-700 to-blue-800'
          } rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-8`}>
            <div className="flex items-start space-x-6">
              <div className={`w-20 h-20 ${
                theme === 'ben10'
                  ? 'bg-gradient-to-br from-green-400 to-green-600'
                  : theme === 'tinkerbell'
                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                  : theme === 'bounceworld'
                  ? 'bg-gradient-to-br from-[#1D428A] to-[#C8102E]'
                  : theme === 'avengers'
                  ? 'bg-gradient-to-br from-[#2C1267] to-[#604AC7]'
                  : theme === 'ponyville'
                  ? 'bg-gradient-to-br from-[#f1aed5] to-[#e13690]'
                  : 'bg-gradient-to-br from-blue-400 to-indigo-600'
              } rounded-3xl flex items-center justify-center border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} shadow-lg flex-shrink-0`}>
                <Award className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black text-black mb-3 flex items-center">
                  <span>{theme === 'bounceworld' ? 'Your Learning Journey' : theme === 'ponyville' ? 'Your Magical Journey' : 'Your Learning Journey'}</span>
                </h3>
                <p className={`${theme === 'bounceworld' ? 'text-black' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : 'text-white'} font-bold text-lg mb-6`}>
                  {theme === 'bounceworld' ? 'Keep up the great work! Here\'s what we noticed about your slam dunk progress:' : theme === 'avengers' ? 'Keep up the great work! Here\'s what we noticed about your heroic progress:' : theme === 'ponyville' ? 'Keep up the great work! Here\'s what we noticed about your magical progress: ✨🦄' : 'Keep up the great work! Here\'s what we noticed about your progress:'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center bg-white/20 rounded-2xl p-4 border-2 border-white/30">
                    <TrendingUp className="w-6 h-6 text-green-300 mr-3 flex-shrink-0" />
                    <span className={`${theme === 'bounceworld' ? 'text-black' : theme === 'ponyville' ? 'text-black' : 'text-white'} font-black`}>
                      {overallStats.improvingClasses} subjects showing improvement
                    </span>
                  </div>
                  <div className="flex items-center bg-white/20 rounded-2xl p-4 border-2 border-white/30">
                    <Target className="w-6 h-6 text-blue-300 mr-3 flex-shrink-0" />
                    <span className={`${theme === 'bounceworld' ? 'text-black' : theme === 'ponyville' ? 'text-black' : 'text-white'} font-black`}>
                      {overallStats.averageScore}% average performance
                    </span>
                  </div>
                  <div className="flex items-center bg-white/20 rounded-2xl p-4 border-2 border-white/30">
                    <BookOpen className="w-6 h-6 text-purple-300 mr-3 flex-shrink-0" />
                    <span className={`${theme === 'bounceworld' ? 'text-black' : theme === 'ponyville' ? 'text-black' : 'text-white'} font-black`}>
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
