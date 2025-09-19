'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  FileSpreadsheet,
  Users,
  Settings,
  Download,
  ExternalLink,
  Calendar,
  BookOpen,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { StudentEnrollmentFirestoreService } from '@/apiservices/studentEnrollmentFirestoreService';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { firestore } from '@/utils/firebase-client';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface SheetAllocation {
  id: string;
  templateId: string;
  templateName: string;
  classId: string;
  className: string;
  title: string;
  description: string;
  teacherId: string;
  teacherEmail: string;
  createdAt: any;
  status: 'pending' | 'completed' | 'failed';
  studentCount: number;
  sheetsCreated: number;
}

interface StudentSheet {
  id: string;
  allocationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  googleSheetId: string;
  googleSheetUrl: string;
  status: 'assigned' | 'in-progress' | 'completed' | 'graded';
  createdAt: any;
}

interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  year: string;
  studentCount: number;
}

interface StudentWithSheets {
  studentId: string;
  studentName: string;
  studentEmail: string;
  sheets: Array<{
    id: string;
    allocationId: string;
    templateName: string;
    googleSheetUrl: string;
    status: 'assigned' | 'in_progress' | 'submitted' | 'graded';
    createdAt: Date;
  }>;
}

export default function ClassSheetManagementPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  const { teacher, loading: authLoading } = useTeacherAuth();
  
  // State
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [studentsWithSheets, setStudentsWithSheets] = useState<StudentWithSheets[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && teacher?.id && classId) {
      loadClassData();
    }
  }, [authLoading, teacher, classId]);

  const loadClassData = async () => {
    if (!teacher?.id || !classId) return;
    
    try {
      setLoading(true);
      
      // Load class information
      const classData = await ClassFirestoreService.getClassById(classId);
      if (!classData) {
        alert('Class not found');
        router.push('/teacher/sheets');
        return;
      }
      
      const studentCount = await StudentEnrollmentFirestoreService.getEnrolledStudentsCount(classId);
      
      setClassInfo({
        id: classData.id,
        name: classData.name,
        subject: classData.subject,
        year: classData.year,
        studentCount
      });
      
      // Get all enrolled students for this class
      const enrolledStudents = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(classId);
      if (!enrolledStudents || enrolledStudents.length === 0) {
        setStudentsWithSheets([]);
        return;
      }

      // Get all allocations for this class to get template names
      const allocationsQuery = query(
        collection(firestore, 'sheetAllocations'),
        where('classId', '==', classId)
      );
      const allocationsSnapshot = await getDocs(allocationsQuery);
      const classAllocations = allocationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SheetAllocation));
      
      // For each student, get their individual sheets
      const studentsWithSheets = await Promise.all(
        enrolledStudents.map(async (enrollment) => {
          try {
            const studentData = await StudentFirestoreService.getStudentById(enrollment.studentId);
            if (!studentData) return null;

            // Get all student sheets for this student
            const studentSheetsQuery = query(
              collection(firestore, 'studentSheets'),
              where('studentId', '==', enrollment.studentId)
            );
            const studentSheetsSnapshot = await getDocs(studentSheetsQuery);
            const studentSheets = studentSheetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentSheet));
            
            // Filter sheets that belong to allocations for this class and add template names
            const classSheets = studentSheets
              .filter((sheet: StudentSheet) => classAllocations.some((alloc: SheetAllocation) => alloc.id === sheet.allocationId))
              .map((sheet: StudentSheet) => {
                const allocation = classAllocations.find((alloc: SheetAllocation) => alloc.id === sheet.allocationId);
                return {
                  id: sheet.id,
                  allocationId: sheet.allocationId,
                  templateName: allocation?.templateName || 'Unknown Template',
                  googleSheetUrl: sheet.googleSheetUrl,
                  status: sheet.status,
                  createdAt: sheet.createdAt.toDate()
                };
              });

            return {
              studentId: enrollment.studentId,
              studentName: studentData.name,
              studentEmail: studentData.email || `${studentData.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`,
              sheets: classSheets
            };
          } catch (error) {
            console.warn(`Could not load student data for ${enrollment.studentId}:`, error);
            return null;
          }
        })
      );

      const validStudents = studentsWithSheets.filter(student => student !== null) as StudentWithSheets[];
      setStudentsWithSheets(validStudents);
      
    } catch (error) {
      console.error('Error loading class data:', error);
      alert('Error loading class data');
    } finally {
      setLoading(false);
    }
  };

  const createNewAllocation = () => {
    router.push(`/teacher/sheets/allocate?classId=${classId}`);
  };

  const openSheet = (sheetUrl: string) => {
    window.open(sheetUrl, '_blank');
  };

  if (authLoading || loading) {
    return (
      <TeacherLayout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading class data...</p>
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!classInfo) {
    return (
      <TeacherLayout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Class Not Found</h2>
              <p className="text-gray-600 mb-4">The requested class could not be found.</p>
              <button
                onClick={() => router.push('/teacher/sheets')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Back to Sheet Management
              </button>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/teacher/sheets')}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900">{classInfo.name}</h1>
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <p className="text-gray-500">{classInfo.subject}</p>
                    <p className="text-gray-400">•</p>
                    <p className="text-gray-500">{classInfo.year}</p>
                    <p className="text-gray-400">•</p>
                    <p className="text-gray-500">{classInfo.studentCount} students</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={createNewAllocation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>New Allocation</span>
                </button>
              </div>
            </div>
          </div>

          {/* Students and Their Sheets */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Students & Their Sheets</h2>
              <span className="text-sm text-gray-600">
                {studentsWithSheets.length} student{studentsWithSheets.length !== 1 ? 's' : ''}
              </span>
            </div>

            {studentsWithSheets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg mb-2">No students with sheets yet</p>
                <p className="text-sm">
                  Students will appear here after you allocate sheets to this class
                </p>
                <button
                  onClick={createNewAllocation}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create First Allocation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {studentsWithSheets.map((student) => (
                  <div 
                    key={student.studentId}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 text-sm font-medium">
                            {student.studentName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{student.studentName}</h3>
                          <p className="text-sm text-gray-600">{student.studentEmail}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {student.sheets.length} sheet{student.sheets.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {student.sheets.length === 0 ? (
                      <p className="text-sm text-gray-500 italic ml-13">No sheets assigned yet</p>
                    ) : (
                      <div className="space-y-2 ml-13">
                        {student.sheets.map((sheet) => (
                          <div 
                            key={sheet.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{sheet.templateName}</p>
                              <p className="text-sm text-gray-600">
                                Created: {sheet.createdAt.toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                sheet.status === 'graded' 
                                  ? 'bg-green-100 text-green-800'
                                  : sheet.status === 'submitted'
                                  ? 'bg-blue-100 text-blue-800'
                                  : sheet.status === 'in_progress'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {sheet.status.replace('_', ' ')}
                              </span>
                              <button
                                onClick={() => openSheet(sheet.googleSheetUrl)}
                                className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4 mr-1.5" />
                                Open Sheet
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}