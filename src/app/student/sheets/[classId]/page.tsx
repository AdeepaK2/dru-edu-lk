'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FileSpreadsheet,
  ExternalLink,
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Play
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { firestore } from '@/utils/firebase-client';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
  updatedAt?: any;
  grade?: number;
  feedback?: string;
}

interface SheetAllocation {
  id: string;
  classId: string;
  templateName: string;
  templateDescription?: string;
  createdAt: any;
  isActive: boolean;
}

interface ClassSheetData {
  allocation: SheetAllocation;
  sheet?: StudentSheet;
}

export default function ClassSheetsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const { user, student, loading: authLoading } = useStudentAuth();
  
  const [className, setClassName] = useState<string>('');
  const [classSheets, setClassSheets] = useState<ClassSheetData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!authLoading && student?.id && classId) {
      loadClassSheets();
    }
  }, [authLoading, student, classId]);

  const loadClassSheets = async (): Promise<void> => {
    if (!student?.id || !classId) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Get class details
      const classData = await ClassFirestoreService.getClassById(classId);
      if (!classData) {
        setError('Class not found');
        return;
      }
      setClassName(classData.name);

      // Get all allocations for this class
      const allocationsQuery = query(
        collection(firestore, 'sheetAllocations'),
        where('classId', '==', classId)
      );
      const allocationsSnapshot = await getDocs(allocationsQuery);
      const allocations = allocationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SheetAllocation[];

      // Get student's sheets
      const studentSheetsQuery = query(
        collection(firestore, 'studentSheets'),
        where('studentId', '==', student.id)
      );
      const studentSheetsSnapshot = await getDocs(studentSheetsQuery);
      const studentSheets = studentSheetsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentSheet[];

      // Combine allocations with student sheets
      const classSheetData: ClassSheetData[] = allocations.map(allocation => {
        const sheet = studentSheets.find(s => s.allocationId === allocation.id);
        return {
          allocation,
          sheet
        };
      });

      setClassSheets(classSheetData);
    } catch (error) {
      console.error('Error loading class sheets:', error);
      setError('Failed to load class sheets');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-progress':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'graded':
        return <CheckCircle className="h-4 w-4 text-purple-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'graded':
        return 'bg-purple-100 text-purple-800';
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  };

  const handleOpenSheet = (sheetUrl: string): void => {
    window.open(sheetUrl, '_blank');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="bg-gradient-to-r from-blue-400 to-purple-400 rounded-3xl shadow-2xl border-4 border-black p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin bg-gradient-to-r from-yellow-400 to-orange-400"></div>
              <span className="text-2xl font-black text-black">Loading your magical sheets... ✨</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="bg-gradient-to-r from-red-200 to-orange-200 rounded-3xl shadow-2xl border-4 border-black p-12 text-center">
            <div className="text-6xl mb-6">😔</div>
            <h3 className="text-2xl font-black text-black mb-4">
              Oops! Something went wrong
            </h3>
            <p className="text-black font-bold text-lg mb-6">{error}</p>
            <Button
              onClick={() => router.back()}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center space-x-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Go Back to Magic</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 p-6">
      {/* Mickey Mouse Header */}
      <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-3xl shadow-2xl border-4 border-black p-8 mb-8 relative overflow-hidden">
        {/* Mickey Mouse Ears */}
        <div className="absolute -top-4 -left-4 w-12 h-12 bg-black rounded-full"></div>
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-black rounded-full"></div>

        <div className="flex items-center space-x-4 relative z-10 mb-4">
          <Button
            onClick={() => router.back()}
            className="bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600 text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center space-x-2"
          >
            <span>← Back to Magic</span>
          </Button>
        </div>

        <div className="flex items-center space-x-4 relative z-10">
          <div className="text-6xl">📊</div>
          <div>
            <h1 className="text-4xl font-black text-black mb-2 flex items-center">
              <span>Mickey's</span>
              <span className="ml-2 text-white font-black text-5xl">{className}</span>
              <span className="ml-2 text-3xl">Sheets</span>
              <span className="ml-2 text-3xl">🎭</span>
            </h1>
            <p className="text-black font-bold text-lg">
              Welcome back, {student?.name}! Access your magical Google Sheets assignments! ✨
            </p>
          </div>
        </div>
      </div>

      {/* Sheets Grid */}
      {classSheets.length === 0 ? (
        <div className="bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200 rounded-3xl shadow-2xl border-4 border-black p-12 text-center">
          <div className="text-6xl mb-6">📚</div>
          <h3 className="text-2xl font-black text-black mb-4">
            No Magical Sheets Yet
          </h3>
          <p className="text-black font-bold text-lg">
            Your teacher hasn't allocated any Google Sheets for this class yet. Check back soon for magical assignments!
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classSheets.map(({ allocation, sheet }) => (
            <div key={allocation.id} className="bg-gradient-to-r from-white to-gray-100 rounded-3xl shadow-2xl border-4 border-black p-6 hover:scale-105 transition-all">
              <div className="flex items-center space-x-3 mb-4">
                <div className="text-4xl">📊</div>
                <h3 className="text-xl font-black text-black truncate">
                  {allocation.templateName}
                </h3>
              </div>

              <div className="space-y-4">
                {allocation.templateDescription && (
                  <p className="text-black font-bold text-lg bg-white/80 rounded-2xl p-3 border-2 border-black">
                    {allocation.templateDescription}
                  </p>
                )}

                <div className="flex items-center space-x-2">
                  {getStatusIcon(sheet?.status)}
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black border-2 border-black ${
                    sheet?.status === 'completed' ? 'bg-green-400 text-white' :
                    sheet?.status === 'in-progress' ? 'bg-blue-400 text-white' :
                    sheet?.status === 'graded' ? 'bg-purple-400 text-white' :
                    sheet?.status === 'assigned' ? 'bg-yellow-400 text-black' :
                    'bg-gray-400 text-white'
                  }`}>
                    {sheet?.status ? sheet.status.replace('-', ' ').toUpperCase() : 'Not Assigned'}
                  </span>
                </div>

                {sheet && (
                  <div className="space-y-3 text-sm text-black font-bold bg-white/60 rounded-2xl p-4 border-2 border-black">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">📅</span>
                      <span>Created: {formatDate(sheet.createdAt)}</span>
                    </div>

                    {sheet.updatedAt && (
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">🕒</span>
                        <span>Updated: {formatDate(sheet.updatedAt)}</span>
                      </div>
                    )}

                    {sheet.grade !== undefined && (
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">🏆</span>
                        <span className="text-lg font-black text-purple-600">Grade: {sheet.grade}%</span>
                      </div>
                    )}
                  </div>
                )}

                {sheet?.feedback && (
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl p-4 border-2 border-black">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-2xl">💬</span>
                      <span className="font-black text-black">Teacher's Feedback:</span>
                    </div>
                    <p className="text-black font-bold">
                      {sheet.feedback}
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  {sheet?.googleSheetUrl ? (
                    <Button
                      onClick={() => handleOpenSheet(sheet.googleSheetUrl)}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center justify-center space-x-2"
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span>Open Magical Sheet</span>
                    </Button>
                  ) : (
                    <Button
                      disabled
                      className="w-full bg-gradient-to-r from-gray-400 to-gray-500 text-white px-6 py-3 rounded-full font-black text-lg border-4 border-black flex items-center justify-center space-x-2"
                    >
                      <span>Sheet Not Ready Yet</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}