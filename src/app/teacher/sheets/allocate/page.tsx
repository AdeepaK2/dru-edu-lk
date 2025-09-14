'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Calendar,
  FileSpreadsheet,
  Send,
  User,
  Mail,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { GoogleSheetsService, SheetTemplate } from '@/apiservices/googleSheetsService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { StudentEnrollmentFirestoreService, EnrollmentWithParent } from '@/apiservices/studentEnrollmentFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { StudentDocument } from '@/models/studentSchema';

interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  selected: boolean;
  parent?: {
    name: string;
    email: string;
    phone: string;
  };
}

interface Class {
  id: string;
  name: string;
  subject: string;
  studentCount: number;
}

export default function AllocateSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');

  const [template, setTemplate] = useState<SheetTemplate | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Mock teacher data - replace with actual teacher context
  const teacherId = 'teacher123';
  const teacherName = 'John Smith';

  useEffect(() => {
    if (templateId) {
      loadInitialData();
    }
  }, [templateId]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load template details
      const templates = await GoogleSheetsService.getTeacherTemplates(teacherId);
      const currentTemplate = templates.find(t => t.id === templateId);
      
      if (!currentTemplate) {
        alert('Template not found');
        router.back();
        return;
      }
      
      setTemplate(currentTemplate);
      setTitle(`${currentTemplate.name} Assignment`);
      
      // Load teacher's classes with enrollment counts
      const teacherClasses = await ClassFirestoreService.getClassesByTeacher(teacherId);
      const classesWithCounts = await Promise.all(
        teacherClasses.map(async (cls) => {
          const studentCount = await StudentEnrollmentFirestoreService.getEnrolledStudentsCount(cls.id);
          return {
            id: cls.id,
            name: cls.name,
            subject: cls.subject,
            studentCount
          };
        })
      );
      setClasses(classesWithCounts);
      
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadClassStudents = async () => {
    try {
      setStudentsLoading(true);
      
      // Get enrolled students for the class
      const enrolledStudents = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(selectedClassId);
      
      if (!enrolledStudents || enrolledStudents.length === 0) {
        setStudents([]);
        return;
      }

      // Get full student details for each enrolled student
      const studentPromises = enrolledStudents.map(async (enrollment) => {
        try {
          const studentData = await StudentFirestoreService.getStudentById(enrollment.studentId);
          if (studentData) {
            return {
              id: enrollment.id, // enrollment ID
              studentId: enrollment.studentId,
              name: studentData.name,
              email: studentData.email || `${studentData.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`,
              selected: true, // Default to all selected
              parent: enrollment.parent
            };
          }
          return null;
        } catch (error) {
          console.warn(`Could not load student ${enrollment.studentId}:`, error);
          return null;
        }
      });
      
      const studentData = await Promise.all(studentPromises);
      const validStudents = studentData
        .filter(student => student !== null)
        .map(student => student!);
      
      setStudents(validStudents);
    } catch (error) {
      console.error('Error loading students:', error);
      alert('Error loading students. Please try again.');
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    setStudents(prev => 
      prev.map(student => 
        student.id === studentId 
          ? { ...student, selected: !student.selected }
          : student
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = students.every(s => s.selected);
    setStudents(prev => 
      prev.map(student => ({ ...student, selected: !allSelected }))
    );
  };

  const handleAllocate = async () => {
    try {
      if (!selectedClassId) {
        alert('Please select a class');
        return;
      }

      if (!title.trim()) {
        alert('Please enter a title');
        return;
      }

      const selectedStudents = students.filter(s => s.selected);
      if (selectedStudents.length === 0) {
        alert('Please select at least one student');
        return;
      }

      setAllocating(true);

      const selectedClass = classes.find(c => c.id === selectedClassId);
      
      await GoogleSheetsService.allocateSheetToClass(
        templateId!,
        selectedClassId,
        selectedClass?.name || 'Unknown Class',
        teacherId,
        teacherName,
        selectedStudents.map(s => ({ id: s.studentId, name: s.name, email: s.email })),
        title,
        description || undefined,
        dueDate ? new Date(dueDate) : undefined
      );

      alert(`Successfully allocated sheets to ${selectedStudents.length} students!`);
      router.push('/teacher/sheets');
    } catch (error) {
      console.error('Error allocating sheets:', error);
      alert('Error allocating sheets. Please try again.');
    } finally {
      setAllocating(false);
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="grid grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!template) {
    return (
      <TeacherLayout>
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Template Not Found
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

  const selectedCount = students.filter(s => s.selected).length;

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.back()}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Allocate Sheet to Class
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Template: {template.name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Configuration
            </h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter assignment title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter assignment description"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Class Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Class *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Choose a class...</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.subject} ({cls.studentCount} students)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Student Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Select Students
              </h3>
              {students.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  {students.every(s => s.selected) ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {!selectedClassId ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  Select a class to view students
                </p>
              </div>
            ) : studentsLoading ? (
              <div className="text-center py-8">
                <Loader className="mx-auto h-8 w-8 text-blue-500 animate-spin mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  Loading students...
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  No students found in this class
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {students.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={student.selected}
                      onChange={() => handleStudentToggle(student.id)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {student.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {student.email}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {selectedCount > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  {selectedCount} student{selectedCount !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCount > 0 && (
                <>
                  Ready to allocate sheets to {selectedCount} student{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAllocate}
                disabled={!selectedClassId || !title.trim() || selectedCount === 0 || allocating}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {allocating ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Allocating...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Allocate Sheets
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}