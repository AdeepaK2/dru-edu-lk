'use client';

import React from 'react';
import { BarChart3, Users, Target, BookOpen } from 'lucide-react';

export default function GradesDemo() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Grade Analytics System Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Comprehensive student performance tracking and learning gap analysis
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Class Analytics
              </h3>
            </div>
            <ul className="space-y-2 text-gray-600 dark:text-gray-300">
              <li>• Overall class performance tracking</li>
              <li>• Student ranking and comparison</li>
              <li>• Test completion rates</li>
              <li>• Pass/fail rate analysis</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Individual Students
              </h3>
            </div>
            <ul className="space-y-2 text-gray-600 dark:text-gray-300">
              <li>• Detailed performance breakdown</li>
              <li>• Weak topic identification</li>
              <li>• Progress trend analysis</li>
              <li>• Personalized recommendations</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-purple-600 dark:text-purple-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Topic Analysis
              </h3>
            </div>
            <ul className="space-y-2 text-gray-600 dark:text-gray-300">
              <li>• Subject-wise performance</li>
              <li>• Learning gap identification</li>
              <li>• Difficulty level assessment</li>
              <li>• Question-wise analysis</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <BookOpen className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Learning Recommendations
              </h3>
            </div>
            <ul className="space-y-2 text-gray-600 dark:text-gray-300">
              <li>• Targeted lesson suggestions</li>
              <li>• Study plan generation</li>
              <li>• Resource recommendations</li>
              <li>• Progress tracking</li>
            </ul>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">1</span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Data Collection
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Automatically analyzes test submissions and student responses
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-green-600 dark:text-green-400">2</span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Performance Analysis
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Identifies patterns, trends, and learning gaps across topics
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">3</span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Actionable Insights
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Provides targeted recommendations and learning resources
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
