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
import { useTheme } from '@/contexts/ThemeContext';

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
  const { theme } = useTheme();
  
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
      <div className={`min-h-screen bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : 'from-blue-400 to-indigo-600'} flex items-center justify-center`}>
        <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : 'border-black'} rounded-3xl p-8 shadow-2xl`}>
          {/* Theme-Specific Loading Animation */}
          <div className="relative mb-6 flex flex-col items-center">
            {/* Tinkerbell Loading GIF */}
            {theme === 'tinkerbell' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/tinkerbell-loading.gif" 
                  alt="Tinkerbell Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-yellow-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* Ben 10 Loading GIF */}
            {theme === 'ben10' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/ben10-loading.gif" 
                  alt="Ben 10 Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#64cc4f] mt-4">Loading</span>
              </div>
            )}

            {/* BounceWorld Loading Animation */}
            {theme === 'bounceworld' && (
              <div className="flex flex-col items-center">
                <img
                  src="/bounceworld.gif"
                  alt="BounceWorld Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading</span>
              </div>
            )}

            {/* Avengers Loading Animation */}
            {theme === 'avengers' && (
              <div className="flex flex-col items-center">
                <img
                  src="/avenger.gif"
                  alt="Avengers Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#2C1267] mt-4">Assembling</span>
              </div>
            )}

            {/* CricketVerse Loading GIF */}
            {theme === 'cricketverse' && (
              <div className="flex flex-col items-center">
                <img
                  src="/batsman.gif"
                  alt="CricketVerse Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'cricketverse' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Sheets...</h2>
            <p className={`text-gray-600 font-medium ${theme === 'bounceworld' ? 'text-[#1D428A]' : ''}`}>
              {theme === 'bounceworld' ? 'Get ready to slam dunk your assignments! 🏀' : 'Get ready to transform your learning!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={`sheets-${theme}`} className={`min-h-screen bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : 'from-blue-600 via-indigo-400 to-blue-500'} p-6`}>
      <div className="max-w-4xl mx-auto">
        {/* Theme-aware Header */}
        <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : 'from-blue-400 to-blue-500'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'} p-8 mb-8 relative overflow-hidden`}>
         

          <div className="flex items-center space-x-4 relative z-10">
            <div className="text-6xl">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : ''}</div>
            <div>
              <h1 className="text-4xl font-black text-black mb-2 flex items-center">

                <span className={`ml-2 font-black text-5xl ${theme === 'bounceworld' ? 'text-white' : 'text-black'}`}> My Sheets</span>
       
              </h1>
              <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-white' : theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-[#C88DA5]' : 'text-blue-200'}`}>
                {theme === 'bounceworld'
                  ? `Welcome back, ${student?.name}! Slam dunk your Google Sheets assignments! 🏀`
                  : theme === 'ben10'
                  ? `Welcome back, ${student?.name}! Access your Google Sheets assignments!`
                  : theme === 'avengers'
                  ? `Welcome back, ${student?.name}! Assemble your Google Sheets assignments! 🦸‍♂️`
                  : `Welcome back, ${student?.name}! Access your Google Sheets assignments!`}
              </p>
            </div>
          </div>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`bg-white rounded-lg shadow-lg p-6 border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'} relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : 'bg-black'}`}></div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Sheets</h3>
                <p className="text-4xl font-black text-gray-900">{totalSheets}</p>
              </div>
              <div className={`text-6xl ${theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#2C1267]' : 'text-black'}`}>📊</div>
            </div>
          </div>

          <div className={`bg-white rounded-lg shadow-lg p-6 border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'} relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : 'bg-black'}`}></div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Classes</h3>
                <p className="text-4xl font-black text-gray-900">{classes.length}</p>
              </div>
              <div className={`text-6xl ${theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#2C1267]' : 'text-black'}`}>🏫</div>
            </div>
          </div>

          <div className={`bg-white rounded-lg shadow-lg p-6 border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'} relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : 'bg-black'}`}></div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Active Classes</h3>
                <p className="text-4xl font-black text-gray-900">{classes.filter(cls => cls.sheetCount > 0).length}</p>
              </div>
              <div className={`text-6xl ${theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#2C1267]' : 'text-black'}`}>🎯</div>
            </div>
          </div>
        </div>        {/* Classes List */}
        <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} overflow-hidden`}>
          <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#48a735]  to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : 'from-blue-400 via-blue-500 to-blue-600'} p-6 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'}`}>
            <h2 className="text-2xl font-black text-black mb-2 flex items-center">
              <span className="text-3xl mr-3">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : ''}</span>
              Your Classes
             
            </h2>
            <p className={`font-bold ${theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-yellow-200' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : 'text-blue-200'}`}>
              {theme === 'bounceworld' ? 'Click on a class to slam dunk your Google Sheets assignments! 🏀' : theme === 'avengers' ? 'Click on a class to assemble your Google Sheets assignments! 🦸‍♂️' : 'Click on a class to view and access your sheets'}
            </p>
          </div>

          {classes.length === 0 ? (
            <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#222222] via-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : 'from-blue-400 via-indigo-500 to-blue-600'} p-12 text-center border-t-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'}`}>
              <div className="text-6xl mb-6">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : ''}</div>
              <h3 className="text-2xl font-black text-black mb-4">
                {theme === 'bounceworld' ? 'No Classes Yet - Time to Start Your Game!' : theme === 'avengers' ? 'No Classes Yet - Time to Assemble Your Team!' : 'No Classes Yet'}
              </h3>
              <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-yellow-200' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : 'text-blue-200'}`}>
                {theme === 'bounceworld' ? 'You haven\'t enrolled in any classes yet. Time to start your training and slam dunk those assignments! 🏀' : theme === 'avengers' ? 'You haven\'t enrolled in any classes yet. Time to assemble your team and start your hero journey! 🦸‍♂️' : 'You haven\'t enrolled in any classes yet. Time to start your training!'}
              </p>
            </div>
          ) : (
            <div className="divide-y-4 divide-black">
              {classes.map((classData) => (
                <div
                  key={classData.id}
                  className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f]  to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 via-green-500 to-yellow-600': theme === 'bounceworld' ? 'from-white via-[#1D428A]/10 to-[#C8102E]/10' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : 'from-blue-400 to-blue-600'} p-6 hover:scale-105 transition-all cursor-pointer border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'} last:border-b-0`}
                  onClick={() => openClassSheets(classData)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className={`w-16 h-16 bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'from-yellow-400 to-green-500' : theme === 'bounceworld' ? 'from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] to-[#604AC7]' : 'from-blue-400 to-indigo-600'} rounded-2xl flex items-center justify-center border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'} shadow-lg`}>
                          <BookOpen className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-black mb-1">
                          {classData.name}
                        </h3>
                        <p className={`font-bold text-lg mb-1 ${theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-white' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : 'text-blue-200'}`}>{classData.subject}</p>
                        <p className={`font-bold text-sm mb-3 ${theme === 'ben10' ? 'text-[#123a0a]' : theme === 'tinkerbell' ? 'text-white' : theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#604AC7]' : 'text-blue-300'}`}>{classData.year}</p>

                        <div className={`flex items-center space-x-6 text-sm font-bold ${theme === 'ben10' ? 'text-black' : theme === 'tinkerbell' ? 'text-black' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : 'text-blue-200'}`}>
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">📊</span>
                            <span>{classData.sheetCount} sheet{classData.sheetCount !== 1 ? 's' : ''}</span>
                          </div>
                          {classData.lastActivity && (
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl">🕒</span>
                              <span>Last activity: {classData.lastActivity.toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {classData.sheetCount > 0 && (
                        <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : 'border-black'} shadow-lg ${theme === 'ben10' ? 'bg-[#64cc4f] text-white' : theme === 'tinkerbell' ? 'bg-yellow-500 text-white' : theme === 'bounceworld' ? 'bg-[#C8102E] text-white' : theme === 'avengers' ? 'bg-[#2C1267] text-white' : 'bg-blue-500 text-white'}`}>
                          {classData.sheetCount} Sheet{classData.sheetCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      <div className={`text-3xl transform group-hover:translate-x-1 transition-transform ${theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : 'text-white'}`}>➡️</div>
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