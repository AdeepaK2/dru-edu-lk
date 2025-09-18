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
import { GoogleSheetsService, SheetAllocation, StudentSheet } from '@/apiservices/googleSheetsService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { StudentEnrollmentFirestoreService } from '@/apiservices/studentEnrollmentFirestoreService';

interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  year: string;
  studentCount: number;
}

interface AllocationWithSheets {
  allocation: SheetAllocation;
  studentSheets: StudentSheet[];
}

export default function ClassSheetManagementPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  const { teacher, loading: authLoading } = useTeacherAuth();
  
  // State
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [allocationsWithSheets, setAllocationsWithSheets] = useState<AllocationWithSheets[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAllocation, setSelectedAllocation] = useState<string>('');

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
      
      // Load sheet allocations for this class
      const allAllocations = await GoogleSheetsService.getAllocations(teacher.id);
      const classAllocations = allAllocations.filter(alloc => alloc.classId === classId);
      
      // For each allocation, get the student sheets
      const allocationsWithSheets = await Promise.all(
        classAllocations.map(async (allocation) => {
          // For now, we'll return empty student sheets array since the method doesn't exist yet
          // In a real implementation, you'd have GoogleSheetsService.getStudentSheetsByAllocation(allocation.id)
          return {
            allocation,
            studentSheets: [] as StudentSheet[]
          };
        })
      );
      
      setAllocationsWithSheets(allocationsWithSheets);
      
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

  const downloadAllSheets = async (allocation: SheetAllocation) => {
    // This would implement downloading all sheets as a ZIP file
    alert('Download functionality will be implemented');
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

          {/* Allocations List */}
          <div className="space-y-6">
            {allocationsWithSheets.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Sheet Allocations</h3>
                <p className="text-gray-500 mb-6">
                  You haven't allocated any sheets to this class yet.
                </p>
                <button
                  onClick={createNewAllocation}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create First Allocation
                </button>
              </div>
            ) : (
              allocationsWithSheets.map(({ allocation, studentSheets }) => (
                <div key={allocation.id} className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {allocation.templateName}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Created {new Date(allocation.allocatedAt.toDate()).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{studentSheets.length} student sheets</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => downloadAllSheets(allocation)}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                          title="Download all sheets"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
                          title="Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Student Sheets */}
                  <div className="divide-y divide-gray-200">
                    {studentSheets.length === 0 ? (
                      <div className="p-8 text-center">
                        <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No student sheets yet</p>
                      </div>
                    ) : (
                      studentSheets.map((studentSheet, index) => (
                        <div key={index} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 text-sm font-medium">
                                  {studentSheet.studentName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {studentSheet.studentName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Student ID: {studentSheet.studentId}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-xs text-green-600">
                                  {studentSheet.status}
                                </span>
                              </div>
                              <button
                                onClick={() => openSheet(studentSheet.googleSheetUrl)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                title="Open sheet"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}