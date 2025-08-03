'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Clock,
  Target,
  CheckCircle,
  ArrowRight,
  Play,
  FileText,
  Download,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui';
import { LessonDocument } from '@/models/lessonSchema';
import { GradeAnalyticsService } from '@/apiservices/gradeAnalyticsService';

interface StudentLessonRecommendationsProps {
  studentId: string;
  weakTopics: Array<{
    topic: string;
    averageScore: number;
    totalQuestions: number;
    correctAnswers: number;
    lessonsRecommended: string[];
  }>;
  onClose: () => void;
}

interface LessonRecommendation {
  topic: string;
  currentScore: number;
  targetScore: number;
  lessons: LessonDocument[];
  priority: 'high' | 'medium' | 'low';
}

export default function StudentLessonRecommendations({ 
  studentId, 
  weakTopics, 
  onClose 
}: StudentLessonRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<LessonRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<LessonDocument | null>(null);

  useEffect(() => {
    const generateRecommendations = async () => {
      setLoading(true);
      
      try {
        const recs: LessonRecommendation[] = [];
        
        for (const topic of weakTopics) {
          // Get lesson recommendations for this topic
          const lessons = await getRecommendedLessonsForTopic(topic.topic);
          
          // Determine priority based on score
          let priority: 'high' | 'medium' | 'low' = 'low';
          if (topic.averageScore < 40) priority = 'high';
          else if (topic.averageScore < 60) priority = 'medium';
          
          // Calculate target score (aim for at least 80%)
          const targetScore = Math.max(80, topic.averageScore + 20);
          
          recs.push({
            topic: topic.topic,
            currentScore: topic.averageScore,
            targetScore,
            lessons,
            priority
          });
        }
        
        // Sort by priority and score
        recs.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          return a.currentScore - b.currentScore;
        });
        
        setRecommendations(recs);
      } catch (error) {
        console.error('Error generating recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    generateRecommendations();
  }, [weakTopics]);

  // Mock function to get recommended lessons (replace with actual service)
  const getRecommendedLessonsForTopic = async (topic: string): Promise<LessonDocument[]> => {
    // This would typically call a service to get lessons related to the topic
    // For now, return mock data
    return [
      {
        id: `lesson-${topic}-1`,
        name: `Introduction to ${topic}`,
        description: `Basic concepts and fundamentals of ${topic}`,
        subjectId: 'math',
        order: 1,
        isActive: true,
        duration: 45,
        objectives: [`Understand ${topic} basics`, `Apply ${topic} concepts`],
        materials: ['Textbook Chapter 5', 'Practice Worksheets'],
        prerequisites: ['Basic algebra'],
        createdAt: new Date(),
        updatedAt: new Date()
      } as LessonDocument,
      {
        id: `lesson-${topic}-2`,
        name: `Advanced ${topic} Techniques`,
        description: `Advanced problem-solving techniques for ${topic}`,
        subjectId: 'math',
        order: 2,
        isActive: true,
        duration: 60,
        objectives: [`Master advanced ${topic}`, `Solve complex problems`],
        materials: ['Advanced Practice Tests', 'Video Tutorials'],
        prerequisites: [`Introduction to ${topic}`],
        createdAt: new Date(),
        updatedAt: new Date()
      } as LessonDocument
    ];
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/40';
      case 'low': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40';
    }
  };

  const estimateStudyTime = (lessons: LessonDocument[]): number => {
    return lessons.reduce((total, lesson) => total + (lesson.duration || 45), 0);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Personalized Learning Recommendations
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Targeted lessons to improve performance in weak areas
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {recommendations.length === 0 ? (
            <div className="p-6 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No specific recommendations needed. Student is performing well!
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Study Plan Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Recommended Study Plan
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Focus on {recommendations.length} key areas for improvement
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {estimateStudyTime(recommendations.flatMap(r => r.lessons))} min
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Estimated study time
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div key={rec.topic} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    {/* Topic Header */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {rec.topic}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Current: {Math.round(rec.currentScore)}% → Target: {rec.targetScore}%
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(rec.priority)}`}>
                            {rec.priority} priority
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Progress to target</span>
                          <span>{Math.round((rec.currentScore / rec.targetScore) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div 
                            className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min((rec.currentScore / rec.targetScore) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lessons */}
                    <div className="p-4">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                        Recommended Lessons
                      </h5>
                      <div className="space-y-3">
                        {rec.lessons.map((lesson) => (
                          <div 
                            key={lesson.id} 
                            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedLesson(lesson)}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {lesson.name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {lesson.description}
                                </p>
                                <div className="flex items-center space-x-4 mt-1">
                                  <span className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {lesson.duration || 45} min
                                  </span>
                                  <span className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Target className="w-3 h-3 mr-1" />
                                    {lesson.objectives?.length || 0} objectives
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="outline">
                                <Play className="w-4 h-4 mr-2" />
                                Start
                              </Button>
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download Plan
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Print Summary
                  </Button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Start Learning
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lesson Details Modal */}
        {selectedLesson && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedLesson.name}
                </h3>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                      Description
                    </h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selectedLesson.description}
                    </p>
                  </div>

                  {selectedLesson.objectives && selectedLesson.objectives.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        Learning Objectives
                      </h4>
                      <ul className="space-y-1">
                        {selectedLesson.objectives.map((objective, index) => (
                          <li key={index} className="flex items-center text-gray-600 dark:text-gray-300">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                            {objective}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedLesson.materials && selectedLesson.materials.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        Materials Needed
                      </h4>
                      <ul className="space-y-1">
                        {selectedLesson.materials.map((material, index) => (
                          <li key={index} className="flex items-center text-gray-600 dark:text-gray-300">
                            <FileText className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                            {material}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Duration: {selectedLesson.duration || 45} minutes
                    </span>
                    <span className="flex items-center">
                      <Target className="w-4 h-4 mr-1" />
                      Order: {selectedLesson.order}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-3">
                <Button variant="outline" onClick={() => setSelectedLesson(null)}>
                  Close
                </Button>
                <Button>
                  <Play className="w-4 h-4 mr-2" />
                  Start Lesson
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
