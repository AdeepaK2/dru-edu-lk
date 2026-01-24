'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { getStudyMaterialsByClass } from '@/apiservices/studyMaterialFirestoreService';
import { HomeworkSubmissionService } from '@/apiservices/homeworkSubmissionService';
import { ClassDocument } from '@/models/classSchema';
import { StudyMaterialDocument } from '@/models/studyMaterialSchema';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui';

interface HomeworkWithStats extends StudyMaterialDocument {
  submissionCount: number;
  totalStudents: number; // Placeholder, ideally specific to assignment
}

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const { teacher, loading: authLoading } = useTeacherAuth();
  const [classes, setClasses] = useState<ClassDocument[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [homeworks, setHomeworks] = useState<HomeworkWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teacher?.id) {
      loadData();
    }
  }, [teacher?.id]);

  useEffect(() => {
    if (selectedClassId) {
      loadHomeworks(selectedClassId);
    }
  }, [selectedClassId, classes]);

  const loadData = async () => {
    try {
      if (!teacher?.id) return;
      const classesData = await ClassFirestoreService.getClassesByTeacher(teacher.id);
      setClasses(classesData);
      
      if (classesData.length > 0) {
        setSelectedClassId(classesData[0].id);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadHomeworks = async (classId: string) => {
    setLoading(true);
    try {
      let materials: StudyMaterialDocument[] = [];
      
      if (classId === 'all') {
        const promises = classes.map(c => getStudyMaterialsByClass(c.id));
        const results = await Promise.all(promises);
        materials = results.flat();
      } else {
        materials = await getStudyMaterialsByClass(classId);
      }

      // Filter for homework only
      const homeworkMaterials = materials.filter(m => m.isHomework);

      // Fetch stats for each (simplified for now)
      const homeworksWithStats = await Promise.all(homeworkMaterials.map(async (hw) => {
        const submissions = await HomeworkSubmissionService.getSubmissionsForMaterial(hw.id);
        return {
          ...hw,
          submissionCount: submissions.length,
          totalStudents: 0 // We'd need to fetch class enrollment count effectively
        };
      }));

      // Sort by due date (nearest first), then uploaded date
      homeworksWithStats.sort((a, b) => {
        const dateA = a.dueDate ? (a.dueDate instanceof Date ? a.dueDate : a.dueDate.toDate()) : new Date(8640000000000000);
        const dateB = b.dueDate ? (b.dueDate instanceof Date ? b.dueDate : b.dueDate.toDate()) : new Date(8640000000000000);
        return dateA.getTime() - dateB.getTime();
      });

      setHomeworks(homeworksWithStats);
    } catch (error) {
      console.error('Error loading homeworks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (dueDate?: any) => {
    if (!dueDate) return 'bg-gray-100 text-gray-800';
    const date = dueDate instanceof Date ? dueDate : dueDate.toDate();
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'bg-red-100 text-red-800'; // Overdue
    if (days <= 3) return 'bg-yellow-100 text-yellow-800'; // Due soon
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (dueDate?: any) => {
    if (!dueDate) return 'No Deadline';
    const date = dueDate instanceof Date ? dueDate : dueDate.toDate();
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `Closed ${Math.abs(days)} days ago`;
    if (days === 0) return 'Due Today';
    if (days === 1) return 'Due Tomorrow';
    return `Due in ${days} days`;
  };

  if (authLoading) return <TeacherLayout>Loading...</TeacherLayout>;

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Homework Management</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Track and grade student assignments</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.subject})</option>
            ))}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">Loading homeworks...</div>
        ) : homeworks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No homework assigned</h3>
            <p className="text-gray-500 dark:text-gray-400">Upload study materials and mark them as homework to see them here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {homeworks.map((hw) => (
              <div 
                key={hw.id}
                onClick={() => router.push(`/teacher/homework/${hw.id}`)}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(hw.dueDate)}`}>
                      {getStatusText(hw.dueDate)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {hw.dueDate ? (hw.dueDate instanceof Date ? hw.dueDate : hw.dueDate.toDate()).toLocaleDateString() : 'No Date'}
                    </span>
                    {hw.homeworkType === 'manual' && (
                      <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        Manual Task
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {hw.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                    {hw.description || 'No description'}
                  </p>
                </div>

                <div className="flex items-center space-x-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {hw.submissionCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Submissions</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
