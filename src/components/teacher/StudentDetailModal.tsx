'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  BookOpen, 
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
  Calendar,
  BarChart3,
  User,
  Mail,
  GraduationCap
} from 'lucide-react';
import { StudentPerformanceData } from '@/apiservices/gradeAnalyticsService';
import { LessonDocument } from '@/models/lessonSchema';

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentPerformanceData | null;
  classId: string;
}

export function StudentDetailModal({ isOpen, onClose, student, classId }: StudentDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [recommendedLessons, setRecommendedLessons] = useState<string[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);

  // Load recommended lessons when student changes
  useEffect(() => {
    if (student && isOpen) {
      loadRecommendedLessons();
    }
  }, [student, isOpen]);

  const loadRecommendedLessons = async () => {
    if (!student) return;
    
    setLoadingLessons(true);
    try {
      // Generate lesson recommendations based on weak topics
      const weakTopics = student.weakTopics.slice(0, 3);
      const allLessonIds: string[] = [];
      
      for (const topic of weakTopics) {
        // Generate lesson IDs based on topic names (placeholder implementation)
        const lessonId = `lesson-${topic.topic.toLowerCase().replace(/\s+/g, '-')}`;
        allLessonIds.push(lessonId);
      }
      
      // Remove duplicates
      const uniqueLessonIds = [...new Set(allLessonIds)];
      
      setRecommendedLessons(uniqueLessonIds.slice(0, 6)); // Limit to 6 lessons
    } catch (error) {
      console.error('Error loading recommended lessons:', error);
    } finally {
      setLoadingLessons(false);
    }
  };

  if (!student) return null;

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
  };

  const getGradeFromPercentage = (percentage: number) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'tests', label: 'Test Results', icon: CheckCircle },
    { id: 'topics', label: 'Topics Analysis', icon: Target },
    { id: 'lessons', label: 'Recommendations', icon: BookOpen }
  ];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={student.studentName}
      size="xl"
      className="max-h-[90vh] overflow-hidden"
    >
      <div className="flex flex-col h-full">
        {/* Student Header */}
        <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getPerformanceColor(student.overallAverage)}`}>
            <User className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{student.studentName}</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <Mail className="w-4 h-4" />
              <span>{student.studentEmail}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getPerformanceColor(student.overallAverage)}`}>
              {Math.round(student.overallAverage)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Grade {getGradeFromPercentage(student.overallAverage)}
            </div>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">{renderOverviewTab()}</div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-4">{renderTestsTab()}</div>
          )}

          {activeTab === 'topics' && (
            <div className="space-y-4">{renderTopicsTab()}</div>
          )}

          {activeTab === 'lessons' && (
            <div className="space-y-4">{renderLessonsTab()}</div>
          )}
        </div>
      </div>
    </Modal>
  );

  function renderOverviewTab() {
    if (!student) return null;
    
    return (
      <>
        {/* Performance Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Average</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(student.overallAverage)}%
              </span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                Grade {getGradeFromPercentage(student.overallAverage)}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tests Completed</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {student.totalTests}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Activity</span>
            </div>
            <div className="mt-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {student.lastActiveDate?.toDate().toLocaleDateString() || 'Never'}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              {student.improvementTrend === 'improving' && <TrendingUp className="w-5 h-5 text-green-500" />}
              {student.improvementTrend === 'declining' && <TrendingDown className="w-5 h-5 text-red-500" />}
              {student.improvementTrend === 'stable' && <BarChart3 className="w-5 h-5 text-gray-500" />}
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Trend</span>
            </div>
            <div className="mt-2">
              <span className={`text-sm font-medium capitalize ${
                student.improvementTrend === 'improving' ? 'text-green-600 dark:text-green-400' :
                student.improvementTrend === 'declining' ? 'text-red-600 dark:text-red-400' :
                'text-gray-600 dark:text-gray-400'
              }`}>
                {student.improvementTrend}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Topic Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Struggling Areas */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-medium text-gray-900 dark:text-white">Areas Needing Attention</h3>
            </div>
            <div className="space-y-3">
              {student.weakTopics.slice(0, 3).map((topic) => (
                <div key={topic.topic} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{topic.topic}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {topic.correctAnswers}/{topic.totalQuestions} correct
                    </p>
                  </div>
                  <Badge variant="destructive">
                    {Math.round(topic.averageScore)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Strong Areas */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Award className="w-5 h-5 text-green-500" />
              <h3 className="font-medium text-gray-900 dark:text-white">Strong Areas</h3>
            </div>
            <div className="space-y-3">
              {student.strongTopics.slice(0, 3).map((topic) => (
                <div key={topic.topic} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{topic.topic}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {topic.correctAnswers}/{topic.totalQuestions} correct
                    </p>
                  </div>
                  <Badge variant="success">
                    {Math.round(topic.averageScore)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderTestsTab() {
    if (!student) return null;
    
    return (
      <>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Test Results History</h3>
          <Badge variant="secondary">{student.totalTests} completed</Badge>
        </div>

        <div className="space-y-3">
          {student.recentTestScores.map((test) => (
            <div key={test.testId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">{test.testTitle}</h4>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {test.completedAt.toDate().toLocaleDateString()}
                    </span>
                    <Badge variant="secondary">
                      Completed
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {test.score} points
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Score
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderTopicsTab() {
    if (!student) return null;
    
    return (
      <>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Detailed Topic Analysis</h3>
        
        <div className="grid grid-cols-1 gap-4">
          {/* Weak Topics */}
          <div>
            <h4 className="text-md font-medium text-red-600 dark:text-red-400 mb-3 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Topics Needing Improvement ({student.weakTopics.length})
            </h4>
            <div className="space-y-3">
              {student.weakTopics.map((topic) => (
                <div key={topic.topic} className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-white">{topic.topic}</h5>
                    <Badge variant="destructive">{Math.round(topic.averageScore)}%</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Accuracy:</span>
                      <span className="ml-2 font-medium">{topic.correctAnswers}/{topic.totalQuestions}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Success Rate:</span>
                      <span className="ml-2 font-medium">{Math.round((topic.correctAnswers / topic.totalQuestions) * 100)}%</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Lesson recommendations available
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strong Topics */}
          <div>
            <h4 className="text-md font-medium text-green-600 dark:text-green-400 mb-3 flex items-center">
              <Award className="w-4 h-4 mr-2" />
              Strong Topics ({student.strongTopics.length})
            </h4>
            <div className="space-y-3">
              {student.strongTopics.map((topic) => (
                <div key={topic.topic} className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-white">{topic.topic}</h5>
                    <Badge variant="success">
                      {Math.round(topic.averageScore)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Accuracy:</span>
                      <span className="ml-2 font-medium">{topic.correctAnswers}/{topic.totalQuestions}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Success Rate:</span>
                      <span className="ml-2 font-medium">{Math.round((topic.correctAnswers / topic.totalQuestions) * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderLessonsTab() {
    return (
      <>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recommended Lessons</h3>
          <Badge variant="secondary">{recommendedLessons.length} recommendations</Badge>
        </div>

        {loadingLessons ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {recommendedLessons.map((lessonId, index) => (
              <div key={lessonId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Recommended Lesson #{index + 1}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Lesson ID: {lessonId}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>Based on weak topic performance</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <Target className="w-4 h-4 mr-2" />
                    Assign
                  </Button>
                </div>
              </div>
            ))}
            
            {recommendedLessons.length === 0 && (
              <div className="text-center py-8">
                <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No specific lesson recommendations at this time.
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Student is performing well across all topics!
                </p>
              </div>
            )}
          </div>
        )}
      </>
    );
  }
}
