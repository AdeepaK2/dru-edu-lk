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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading sheets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4 -ml-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Sheets
        </Button>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {className} - Sheets
        </h1>
        <p className="text-gray-600">
          Your allocated Google Sheets for this class
        </p>
      </div>

      {/* Sheets Grid */}
      {classSheets.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Sheets Available</h3>
              <p className="text-gray-600">
                No sheets have been allocated for this class yet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classSheets.map(({ allocation, sheet }) => (
            <Card key={allocation.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  <span className="truncate">{allocation.templateName}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allocation.templateDescription && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {allocation.templateDescription}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {getStatusIcon(sheet?.status)}
                    <Badge className={getStatusColor(sheet?.status)}>
                      {sheet?.status ? sheet.status.replace('-', ' ') : 'Not Assigned'}
                    </Badge>
                  </div>

                  {sheet && (
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Created: {formatDate(sheet.createdAt)}
                      </div>
                      
                      {sheet.updatedAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Updated: {formatDate(sheet.updatedAt)}
                        </div>
                      )}
                      
                      {sheet.grade !== undefined && (
                        <div className="text-sm font-medium text-purple-600">
                          Grade: {sheet.grade}%
                        </div>
                      )}
                    </div>
                  )}

                  {sheet?.feedback && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Feedback:</strong> {sheet.feedback}
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    {sheet?.googleSheetUrl ? (
                      <Button
                        onClick={() => handleOpenSheet(sheet.googleSheetUrl)}
                        className="w-full flex items-center gap-2"
                      >
                        Open Sheet
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button disabled className="w-full">
                        Sheet Not Ready
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}