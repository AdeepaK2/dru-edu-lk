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
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();
  
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
      <div className={`min-h-screen ${theme === 'cricketverse-australian' ? 'bg-[#ffff2a]' : `bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#a987f7] via-[#937df6] to-[#a087f2]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : theme === 'default' ? 'from-gray-50 to-white' : 'from-blue-400 to-indigo-600'}`} p-6`}>
        <div className="flex items-center justify-center py-12">
          <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'from-yellow-400 to-green-500' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'cricketverse-australian' ? 'from-[#b38f00] via-[#ffd700] to-[#8b6914]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-blue-500 to-purple-500'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-8`}>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
              <span className="text-2xl font-black text-black">Loading sheets...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${theme === 'cricketverse-australian' ? 'bg-[#ffff2a]' : `bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : theme === 'default' ? 'from-gray-50 to-white' : 'from-blue-400 to-indigo-600'}`} p-6`}>
        <div className="flex items-center justify-center py-12">
          <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f]/20 to-[#b2e05b]/20' : theme === 'tinkerbell' ? 'from-yellow-200 to-green-200' : theme === 'bounceworld' ? 'from-[#1D428A]/20 via-white/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267]/20 via-[#604AC7]/20 to-[#0F0826]/20' : theme === 'cricketverse-australian' ? 'from-[#b38f00]/20 to-[#ffd700]/20' : theme === 'ponyville' ? 'from-[#f1aed5]/20 to-[#e13690]/20' : 'from-red-200 to-orange-200'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-12 text-center`}>
            <div className="text-6xl mb-6">😔</div>
            <h3 className="text-2xl font-black text-black mb-4">
              Oops! Something went wrong
            </h3>
            <p className="text-black font-bold text-lg mb-6">{error}</p>
            <Button
              onClick={() => router.back()}
              className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]' : theme === 'tinkerbell' ? 'from-yellow-500 to-green-600 hover:from-yellow-600 hover:to-green-700' : theme === 'bounceworld' ? 'from-[#1D428A]  to-[#C8102E] hover:from-[#1D428A]/80  hover:to-[#C8102E]/80' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826] hover:from-[#2C1267]/80 hover:via-[#604AC7]/80 hover:to-[#0F0826]/80' : theme === 'cricketverse-australian' ? 'from-[#b38f00] to-[#daa520] hover:from-[#b38f00]/80 hover:to-[#daa520]/80' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690] hover:from-[#e8b8d8] hover:to-[#d42a7f]' : 'from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'} text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} flex items-center space-x-2`}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Go Back</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'cricketverse-australian' ? 'bg-[#ffff2a]' : `bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#916aec] via-[#917bf2] to-[#9f85f5]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690]/20 to-[#ff2e9f]' : theme === 'default' ? 'from-gray-50 to-white' : 'from-blue-600 via-indigo-700 to-slate-900'}`} p-6`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#486b05] ' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'cricketverse-australian' ? 'from-[#b38f00] via-[#ffd700] to-[#8b6914]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : theme === 'default' ? 'from-white to-gray-100' : 'from-blue-500 via-indigo-600 to-slate-800'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-8 mb-8 relative overflow-hidden`}>

        <div className="flex items-center space-x-4 relative z-10 mb-4">
          <Button
            onClick={() => router.back()}
            className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#222222] to-[#64cc4f] hover:from-[#222222] hover:to-[#b2e05b]' : theme === 'tinkerbell' ? 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700' : theme === 'bounceworld' ? 'from-[#1D428A]  to-[#C8102E] hover:from-[#1D428A]/80  hover:to-[#C8102E]/80' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826] hover:from-[#2C1267]/80 hover:via-[#604AC7]/80 hover:to-[#0F0826]/80' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690] hover:from-[#e8b8d8] hover:to-[#d42a7f]' : 'from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800'} text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 ${theme === 'bounceworld' ? 'border-[#959698]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} flex items-center space-x-2`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Button>
        </div>

        <div className="flex items-center space-x-4 relative z-10">
          {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'avengers' || theme === 'ponyville') && (
            <div className="text-6xl">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '' : ''}</div>
          )}
          <div>
            <h1 className={`text-4xl font-black mb-2 flex items-center ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
              <span>{className}</span>
              <span className="ml-2 text-white font-black text-5xl">Sheets</span>
            </h1>
            <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-white' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : theme === 'default' ? 'text-black' : 'text-blue-200'}`}>
              {theme === 'avengers' ? `Welcome back, ${student?.name}! Assemble your Google Sheets assignments! 🦸‍♂️` : theme === 'ponyville' ? `Welcome back, ${student?.name}! Cast magical Google Sheets spells! ✨🦄` : `Welcome back, ${student?.name}! Access your Google Sheets assignments!`}
            </p>
          </div>
        </div>
      </div>

      {/* Sheets Grid */}
      {classSheets.length === 0 ? (
        <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#222222] via-[#64cc4f] to-[#51760d]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : theme === 'default' ? 'from-gray-100 to-white' : 'from-slate-700 via-indigo-800 to-blue-900'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-12 text-center`}>
          <div className="text-6xl mb-6">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '🦄' : '📚'}</div>
          <h3 className="text-2xl font-black text-white mb-4">
            {theme === 'avengers' ? 'No Sheets Yet - Time to Assemble!' : theme === 'ponyville' ? 'No Sheets Yet - Time to Cast Magic!' : 'No Sheets Yet'}
          </h3>
          <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-yellow-200' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : theme === 'default' ? 'text-black' : 'text-blue-200'}`}>
            {theme === 'avengers' ? 'Your teacher hasn\'t allocated any Google Sheets for this class yet. Assemble your skills and check back soon! 🦸‍♂️' : theme === 'ponyville' ? 'Your teacher hasn\'t allocated any Google Sheets for this class yet. Cast your magical skills and check back soon! ✨🦄' : 'Your teacher hasn\'t allocated any Google Sheets for this class yet. Check back soon!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classSheets.map(({ allocation, sheet }) => (
            <div key={allocation.id} className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-white to-[#b2e05b]/10' : theme === 'tinkerbell' ? 'from-white to-yellow-100' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/10 to-[#C8102E]/10' : theme === 'avengers' ? 'from-[#604AC7]/10 via-[#604AC7]/10 to-[#2C1267]/10' : theme === 'ponyville' ? 'from-[#f1aed5]/10 to-[#e13690]/10' : theme === 'default' ? 'from-white to-gray-50' : 'from-white to-blue-100'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 hover:scale-105 transition-all`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="text-4xl">📊</div>
                <h3 className="text-xl font-black text-black truncate">
                  {allocation.templateName}
                </h3>
              </div>

              <div className="space-y-4">
                {allocation.templateDescription && (
                  <p className="text-black font-bold text-sm bg-white/80 rounded-2xl p-3 border-2 border-black">
                    {allocation.templateDescription}
                  </p>
                )}

                <div className="flex items-center space-x-2">
                  {getStatusIcon(sheet?.status)}
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} ${
                    sheet?.status === 'completed' ? `bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#b2e05b]' : theme === 'avengers' ? 'from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690]' : 'from-green-400 to-green-500'} text-white` :
                    sheet?.status === 'in-progress' ? `bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'avengers' ? 'from-[#604AC7] to-[#2C1267]' : theme === 'ponyville' ? 'from-[#e13690] to-[#ff2e9f]' : 'from-blue-400 to-blue-500'} text-white` :
                    sheet?.status === 'graded' ? `bg-gradient-to-r ${theme === 'ben10' ? 'from-[#222222] to-[#64cc4f]' : theme === 'avengers' ? 'from-[#0F0826] to-[#604AC7]' : theme === 'ponyville' ? 'from-[#ff2e9f] to-[#f1aed5]' : 'from-purple-400 to-purple-500'} text-white` :
                    sheet?.status === 'assigned' ? `bg-gradient-to-r ${theme === 'ben10' ? 'from-[#b2e05b] to-[#64cc4f]' : theme === 'avengers' ? 'from-[#C88DA5] to-[#604AC7]' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#ff2e9f]' : 'from-yellow-400 to-yellow-500'} text-black` :
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
                        <span className={`text-lg font-black ${theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'default' ? 'text-black' : 'text-purple-600'}`}>Grade: {sheet.grade}%</span>
                      </div>
                    )}
                  </div>
                )}

                {sheet?.feedback && (
                  <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f]/20 to-[#b2e05b]/20' : theme === 'tinkerbell' ? 'from-yellow-100 to-green-100' : theme === 'bounceworld' ? 'from-[#1D428A]/20 via-white/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267]/20 via-[#604AC7]/20 to-[#0F0826]/20' : theme === 'ponyville' ? 'from-[#f1aed5]/20 to-[#e13690]/20' : 'from-blue-100 to-purple-100'} rounded-2xl p-4 border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'}`}>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-2xl">💬</span>
                      <span className="font-black text-black">Teacher's Feedback:</span>
                    </div>
                    <p className="text-black font-bold text-sm">
                      {sheet.feedback}
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  {sheet?.googleSheetUrl ? (
                    <Button
                      onClick={() => handleOpenSheet(sheet.googleSheetUrl)}
                      className={`w-full ${theme === 'cricketverse-australian' ? 'bg-[#ffff2a] hover:bg-[#ffd700] text-black' : `bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#5a840a] hover:from-[#b2e05b] hover:to-[#64cc4f]' : theme === 'tinkerbell' ? 'from-green-500 to-yellow-500 hover:from-green-600 hover:to-yellow-600' : theme === 'bounceworld' ? 'from-[#1D428A] to-[#C8102E] hover:from-[#1D428A]/80  hover:to-[#C8102E]/80' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826] hover:from-[#2C1267]/80 hover:via-[#604AC7]/80 hover:to-[#0F0826]/80' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690] hover:from-[#e8b8d8] hover:to-[#d42a7f]' : 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'} text-white`} px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} flex items-center justify-center space-x-2`}
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span>Open Sheet</span>
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