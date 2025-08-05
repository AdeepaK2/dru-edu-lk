'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Eye, 
  GraduationCap,
  Calendar,
  BookOpen,
  TrendingUp,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import Link from 'next/link';

// Import services and types
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { SubjectFirestoreService } from '@/apiservices/subjectFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { FirestoreOptimizer } from '@/utils/teacher-performance';

interface ClassWithStats extends ClassDocument {
  studentCount: number;
  avgGrade?: number;
  nextClass?: string;
  recentActivity?: string;
}

export default function TeacherClasses() {
  const { teacher } = useTeacherAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load teacher's classes
  useEffect(() => {
    const loadClasses = async () => {
      if (!teacher?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get classes assigned to this teacher
        console.log('🔍 Teacher ID in CLASSES page:', teacher.id);
        console.log('🔍 Teacher object in CLASSES page:', teacher);
        const teacherClasses = await ClassFirestoreService.getClassesByTeacher(teacher.id);
        console.log('✅ Raw teacher classes result in CLASSES page:', teacherClasses);
        console.log('✅ Number of classes found in CLASSES page:', teacherClasses.length);
        
        // Get additional stats for each class
        const classesWithStats = await Promise.all(
          teacherClasses.map(async (classDoc) => {
            try {
              // Use optimized student query with enrollment system
              const students = await FirestoreOptimizer.getStudentsByClassOptimized(classDoc.id);
              const studentCount = students.length;
              
              // Calculate next class time
              const nextClass = getNextClassTime(classDoc.schedule);
              
              return {
                ...classDoc,
                studentCount,
                avgGrade: Math.round(Math.random() * 30 + 70), // TODO: Calculate real average grade
                nextClass,
                recentActivity: `${studentCount} students enrolled`
              } as ClassWithStats;
            } catch (err) {
              console.error(`Error loading stats for class ${classDoc.id}:`, err);
              return {
                ...classDoc,
                studentCount: classDoc.enrolledStudents || 0,
                avgGrade: 0,
                nextClass: 'TBD',
                recentActivity: 'No recent activity'
              } as ClassWithStats;
            }
          })
        );
        
        setClasses(classesWithStats);
      } catch (err: any) {
        console.error('Error loading teacher classes:', err);
        setError(err.message || 'Failed to load classes');
      } finally {
        setLoading(false);
      }
    };
    
    loadClasses();
  }, [teacher?.id]);

  // Helper function to calculate next class time
  const getNextClassTime = (schedule: Array<{day: string, startTime: string, endTime: string}>) => {
    if (!schedule || schedule.length === 0) return 'No schedule set';
    
    const today = new Date();
    const currentDay = today.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = today.getHours() * 60 + today.getMinutes();
    
    // Find today's classes
    const todayClasses = schedule.filter(s => s.day === currentDay);
    
    for (const classTime of todayClasses) {
      const [hours, minutes] = classTime.startTime.split(':');
      const isPM = classTime.startTime.includes('PM');
      const classTimeMinutes = (parseInt(hours) + (isPM && parseInt(hours) !== 12 ? 12 : 0)) * 60 + parseInt(minutes);
      
      if (classTimeMinutes > currentTime) {
        return `Today, ${classTime.startTime}`;
      }
    }
    
    // Find next week day's first class
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = days.indexOf(currentDay);
    
    for (let i = 1; i < 7; i++) {
      const nextDayIndex = (todayIndex + i) % 7;
      const nextDay = days[nextDayIndex];
      const nextDayClasses = schedule.filter(s => s.day === nextDay);
      
      if (nextDayClasses.length > 0) {
        const nextDayName = i === 1 ? 'Tomorrow' : nextDay;
        return `${nextDayName}, ${nextDayClasses[0].startTime}`;
      }
    }
    
    return 'No upcoming classes';
  };

  // Filter classes based on search term
  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.year.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading classes...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                My Classes
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Manage your assigned classes and view student progress
              </p>
            </div>
            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
              <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {filteredClasses.length} Classes
              </span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredClasses.map((cls) => (
            <div
              key={cls.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Class Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {cls.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Class ID: {cls.classId}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {cls.description || 'No description available'}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      {cls.year}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      {cls.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Class Stats */}
              <div className="p-6">
                {/* Removed stats section: Students, Avg Grade, Monthly */}
                {/* Schedule */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Class Schedule
                  </h4>
                  <div className="space-y-1">
                    {cls.schedule.map((schedule, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{schedule.day}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {schedule.startTime} - {schedule.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm">
                    <BookOpen className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {cls.recentActivity}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="w-full"
                  >
                    <Button 
                      className="w-full flex items-center justify-center space-x-2"
                      size="sm"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredClasses.length === 0 && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No classes found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm 
                ? 'Try adjusting your search criteria' 
                : 'You have no classes assigned yet. Contact your administrator.'
              }
            </p>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
