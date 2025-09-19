'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  Users,
  BookOpen,
  ExternalLink,
  Clock,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentEnrollmentFirestoreService } from '@/apiservices/studentEnrollmentFirestoreService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { firestore } from '@/utils/firebase-client';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface ClassWithSheets {
  id: string;
  name: string;
  subject: string;
  year: string;
  sheetCount: number;
  lastActivity?: Date;
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

export default function StudentSheetsPage() {
  const router = useRouter();
  const { user, student, loading: authLoading } = useStudentAuth();
  
  const [classes, setClasses] = useState<ClassWithSheets[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSheets, setTotalSheets] = useState(0);

  useEffect(() => {
    if (!authLoading && student?.id) {
      loadStudentClasses();
    }
  }, [authLoading, student]);

  const loadStudentClasses = async () => {
    if (!student?.id) return;
    
    try {
      setLoading(true);
      
      // Get student's enrolled classes
      const enrollments = await StudentEnrollmentFirestoreService.getEnrollmentsByStudentId(student.id);
      
      if (!enrollments || enrollments.length === 0) {
        setClasses([]);
        setTotalSheets(0);
        return;
      }

      let totalSheetsCount = 0;

      // For each enrollment, get class details and sheet count
      const classesWithSheets = await Promise.all(
        enrollments.map(async (enrollment) => {
          try {
            const classData = await ClassFirestoreService.getClassById(enrollment.classId);
            if (!classData) return null;

            // Get student sheets for this class
            const studentSheetsQuery = query(
              collection(firestore, 'studentSheets'),
              where('studentId', '==', student.id)
            );
            const studentSheetsSnapshot = await getDocs(studentSheetsQuery);
            const allStudentSheets = studentSheetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentSheet));

            // Get allocations for this class to filter relevant sheets
            const allocationsQuery = query(
              collection(firestore, 'sheetAllocations'),
              where('classId', '==', enrollment.classId)
            );
            const allocationsSnapshot = await getDocs(allocationsQuery);
            const classAllocations = allocationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter sheets that belong to this class
            const classSheets = allStudentSheets.filter(sheet => 
              classAllocations.some(alloc => alloc.id === sheet.allocationId)
            );

            totalSheetsCount += classSheets.length;

            // Find the most recent sheet activity
            let lastActivity: Date | undefined;
            if (classSheets.length > 0) {
              const sortedSheets = classSheets.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
              lastActivity = sortedSheets[0].createdAt.toDate();
            }

            return {
              id: classData.id,
              name: classData.name,
              subject: classData.subject,
              year: classData.year,
              sheetCount: classSheets.length,
              lastActivity
            };
          } catch (error) {
            console.warn(`Could not load class data for ${enrollment.classId}:`, error);
            return null;
          }
        })
      );

      const validClasses = classesWithSheets.filter(cls => cls !== null) as ClassWithSheets[];
      setClasses(validClasses);
      setTotalSheets(totalSheetsCount);
      
    } catch (error) {
      console.error('Error loading student classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const openClassSheets = (classData: ClassWithSheets) => {
    router.push(`/student/sheets/${classData.id}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-t-2 border-green-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your sheets...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Sheets</h1>
              <p className="text-gray-500 mt-1">
                Access your Google Sheets assignments from all classes
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FileSpreadsheet className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-600">Total Sheets</span>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-1">{totalSheets}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-600">Classes</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 mt-1">{classes.length}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <BookOpen className="h-5 w-5 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-purple-600">Active</span>
              </div>
              <p className="text-2xl font-bold text-purple-700 mt-1">
                {classes.filter(cls => cls.sheetCount > 0).length}
              </p>
            </div>
          </div>
        </div>

        {/* Classes List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your Classes</h2>
            <p className="text-gray-500 text-sm mt-1">
              Click on a class to view and access your sheets
            </p>
          </div>

          {classes.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
              <p className="text-gray-500">
                You are not enrolled in any classes yet. Contact your teacher to get enrolled.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {classes.map((classData) => (
                <div
                  key={classData.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openClassSheets(classData)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {classData.name}
                        </h3>
                        <p className="text-sm text-gray-500">{classData.subject}</p>
                        <p className="text-xs text-gray-400">{classData.year}</p>
                        
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <FileSpreadsheet className="h-4 w-4 mr-1" />
                            <span>{classData.sheetCount} sheet{classData.sheetCount !== 1 ? 's' : ''}</span>
                          </div>
                          {classData.lastActivity && (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>Last activity: {classData.lastActivity.toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {classData.sheetCount > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {classData.sheetCount} sheet{classData.sheetCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}