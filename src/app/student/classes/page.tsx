'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Users, Clock, Award, Search, Filter, ExternalLink, MessageSquare } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { Button, Input } from '@/components/ui';
import { 
  StudentRemark, 
  getRemarkColor 
} from '@/models/studentRemarkSchema';
import { StudentRemarkFirestoreService } from '@/apiservices/studentRemarkFirestoreService';

// Extended interface to include class details with zoom link and remark
interface EnrollmentWithClassData extends StudentEnrollment {
  classData?: ClassDocument;
  remark?: StudentRemark;
}

export default function StudentClassesPage() {
  const { student, loading: authLoading } = useStudentAuth();
  const { theme } = useTheme();
  const [enrollments, setEnrollments] = useState<EnrollmentWithClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load student's enrollments and class data
  useEffect(() => {
    const loadEnrollments = async () => {
      if (!student?.id) return;

      try {
        setLoading(true);
        const studentEnrollments = await getEnrollmentsByStudent(student.id);
        
        // Load visible remarks for this student
        const studentRemarks = await StudentRemarkFirestoreService.getVisibleRemarksByStudent(student.id);
        const remarksMap = new Map<string, StudentRemark>();
        studentRemarks.forEach(remark => {
          remarksMap.set(remark.classId, remark);
        });
        
        // Fetch class details for each enrollment (including zoom links)
        const enrollmentsWithClassData = await Promise.all(
          studentEnrollments.map(async (enrollment) => {
            try {
              const classData = await ClassFirestoreService.getClassById(enrollment.classId);
              return {
                ...enrollment,
                classData,
                remark: remarksMap.get(enrollment.classId)
              } as EnrollmentWithClassData;
            } catch (error) {
              console.error(`Error loading class data for ${enrollment.classId}:`, error);
              return {
                ...enrollment,
                classData: undefined,
                remark: remarksMap.get(enrollment.classId)
              } as EnrollmentWithClassData;
            }
          })
        );
        
        setEnrollments(enrollmentsWithClassData);
      } catch (error) {
        console.error('Error loading enrollments:', error);
      } finally {
        setLoading(false);
      }
    };

    if (student?.id) {
      loadEnrollments();
    }
  }, [student?.id]);

  // Handle joining Zoom meeting
  const handleJoinZoom = (zoomLink: string) => {
    if (zoomLink) {
      window.open(zoomLink, '_blank', 'noopener,noreferrer');
    }
  };

  // Filter enrollments based on search and status
  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch = 
      enrollment.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (authLoading || loading) {
    return (
      <div className={`${theme === 'avengers' ? 'min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2C1267]/20 to-[#4F2C8D]/20' : 'min-h-screen flex items-center justify-center'}`} style={theme === 'avengers' ? {} : {
        background: theme === 'default'
          ? 'linear-gradient(to bottom right, rgb(249, 250, 251), rgb(243, 244, 246))'
          : theme === 'ben10'
          ? 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(34, 34, 34))'
          : theme === 'tinkerbell'
          ? 'linear-gradient(to bottom right, rgb(253, 224, 71), rgb(34, 197, 94), rgb(253, 224, 71))'
          : theme === 'cricketverse'
          ? 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(79, 70, 229))'
          : theme === 'cricketverse-australian'
          ? 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)'
          : theme === 'bounceworld'
          ? 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(29, 66, 138), rgb(200, 16, 46))'
          : theme === 'ponyville'
          ? 'linear-gradient(to bottom right, rgb(255, 245, 251), rgb(241, 174, 213), rgb(255, 46, 159))'
          : 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(79, 70, 229))'
      }}>
        <div className={`${theme === 'default' ? 'bg-white border-4 border-black' : theme === 'bounceworld' ? 'bg-white border-4 border-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267]/20 to-[#4F2C8D]/20 border-4 border-[#2C1267]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] to-[#e13690] border-4 border-[#f1aed5]' : 'bg-white border-4 border-black'} rounded-3xl p-8 shadow-2xl`}>
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
            
            {/* Default Theme Spinner with Loading Text */}

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

            {/* Australian CricketVerse Loading GIF */}
            {theme === 'cricketverse-australian' && (
              <div className="flex flex-col items-center">
                <img
                  src="/cricketverse-australian.gif"
                  alt="Australian CricketVerse Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#fff800] mt-4">Loading</span>
              </div>
            )}

            {/* Ponyville Loading Animation */}
            {theme === 'ponyville' && (
              <div className="flex flex-col items-center">
                <img
                  src="/ponyville-loading.gif"
                  alt="Ponyville Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#e13690] mt-4">Transforming</span>
              </div>
            )}

            {/* Default Theme Spinner */}
            {theme === 'default' && (
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 border-8 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Your Classes...</h2>
            <p className={`font-medium ${theme === 'default' ? 'text-gray-600' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-gray-600'}`}>
              {theme === 'ben10' ? 'Get ready to transform your learning!' 
                : theme === 'tinkerbell' ? 'Get ready for magical adventures!' 
                : theme === 'cricketverse-australian' ? 'Get ready to smash learning boundaries, Aussie style!'
                : theme === 'bounceworld' ? 'Get ready to bounce into learning!'
                : theme === 'avengers' ? 'Get ready to assemble your classes!'
                : theme === 'ponyville' ? 'Get ready to transform your classes with magic!'
                : 'Get ready to transform your learning!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Please log in to view your classes.</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={`min-h-screen p-6 ${theme === 'default' ? 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50' : theme === 'ben10' ? '' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'cricketverse' ? 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-br from-[#ffff2a] via-[#ffff2a] to-[#ffff2a]' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/10 to-white' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267]/10 via-[#604AC7]/10 to-[#0F0826]/10' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600'}`}
        style={
          theme === 'ben10'
            ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' }
            : theme === 'cricketverse-australian'
            ? { background: 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)' }
            : undefined
        }
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme === 'default' ? 'from-gray-100 to-gray-200' : theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-300 via-green-500 to-yellow-400' : theme === 'cricketverse' ? 'from-blue-500 to-indigo-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-br from-[#f9f9bb] via-[#f6f672] to-[#ffff2a]' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#604AC7] border-[#2C1267]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f] border-[#f1aed5]' : 'from-blue-400 to-indigo-600'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-8 mb-6 relative overflow-hidden`}>
      
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
            {theme === 'cricketverse' ? (
              <img src="/indian/batman2.png" alt="Batman" className="w-40 h-32 object-contain" />
            ) : theme === 'cricketverse-australian' ? (
              <img src="/australian/batman2.png" alt="Australian Cricket" className="w-40 h-32 object-contain" />
            ) : theme === 'ponyville' ? (
              <img src="/ponyville/rainbow-dash.png" alt="Rainbow Dash" className="w-24 h-24 object-contain" />
            ) : theme === 'avengers' ? (
              <img src="/avengers/pngegg.png" alt="Avengers Hero" className="w-24 h-24 object-contain" />
            ) : theme === 'bounceworld' ? (
              <img src="/bounce-world.png" alt="Bounce World" className="w-32 h-32 object-contain" />
            ) : (
              <div className="text-6xl">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : ''}</div>
            )}
              
              <div>
                <h1 className={`text-4xl font-black mb-2 flex items-center ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                  <span>My</span>
                  <span className="ml-2 text-3xl">Classroom</span>
                  {theme === 'cricketverse-australian' && <span className="ml-2 text-4xl"></span>}
                  {theme === 'bounceworld' && <span className="ml-2 text-4xl">🏀</span>}
                  {theme === 'ponyville' && <span className="ml-2 text-4xl">🦄</span>}
                </h1>
                <p className={`font-bold text-lg ${theme === 'default' ? 'text-black' : theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-white' : theme === 'cricketverse' ? 'text-blue-100' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : 'text-blue-100'}`}>
                  {theme === 'default' ? 'Explore all your enrolled classes'
                    : theme === 'ben10' ? 'Transform your learning with amazing adventures!'
                    : theme === 'tinkerbell' ? 'Transform your learning with magical adventures!'
                    : theme === 'cricketverse' ? 'Transform your learning with amazing adventures!'
                    : theme === 'cricketverse-australian' ? 'Smash learning boundaries with Australian cricket spirit!'
                    : theme === 'bounceworld' ? 'Bounce into learning with amazing adventures!'
                    : theme === 'avengers' ? 'Assemble your learning with heroic adventures!'
                    : theme === 'ponyville' ? 'Transform your learning with magical pony adventures!'
                    : 'Transform your learning with amazing adventures!'}
                </p>
              </div>
            </div>
            <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="text-4xl">📚</div>
                <div className="text-center">
                  <div className="text-3xl font-black text-black">{filteredEnrollments.length}</div>
                  <div className="text-sm font-bold text-gray-700">Classes</div>
                </div>
              </div>
            </div>
          </div>
        </div>        {/* Search and Filter */}
        <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-300 via-green-400 to-yellow-400' : theme === 'cricketverse' ? 'from-blue-300 via-indigo-400 to-indigo-500' : theme === 'cricketverse-australian' ? 'from-white via-white to-white' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/20 to-white border-[#1D428A]' : theme === 'avengers' ? 'from-[#604AC7]/20 via-[#2C1267]/20 to-[#0F0826]/20 border-[#2C1267]' : theme === 'ponyville' ? 'from-[#f1aed5]/20 via-[#e13690]/20 to-[#ff2e9f]/20 border-[#f1aed5]' : 'from-blue-300 via-indigo-400 to-indigo-500'} rounded-2xl shadow-xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-6 mb-6`}>
          <div className="flex items-center space-x-3 mb-4">
            <div className="text-3xl">🔍</div>
            <h2 className="text-2xl font-bold text-black">Search Classes</h2>
            
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">🔍</div>
                <Input
                  type="text"
                  placeholder="Search for classes or subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-12 pr-4 py-3 text-lg border-4 border-black rounded-2xl bg-white text-black placeholder-gray-500 focus:outline-none shadow-lg ${theme === 'default' ? 'focus:ring-4 focus:ring-blue-600' : theme === 'ben10' ? 'focus:ring-4 focus:ring-[#64cc4f]' : theme === 'tinkerbell' ? 'focus:ring-4 focus:ring-yellow-400' : theme === 'cricketverse' ? 'focus:ring-4 focus:ring-blue-400' : theme === 'cricketverse-australian' ? 'focus:ring-4 focus:ring-[#fff800]' : theme === 'bounceworld' ? 'focus:ring-4 focus:ring-[#1D428A]' : theme === 'avengers' ? 'focus:ring-4 focus:ring-[#604AC7]' : theme === 'ponyville' ? 'focus:ring-4 focus:ring-[#e13690]' : 'focus:ring-4 focus:ring-blue-400'}`}
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
             
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`border-4 border-black rounded-2xl px-6 py-3 bg-white text-black font-bold text-lg focus:outline-none shadow-lg hover:bg-gray-50 transition-all ${theme === 'default' ? 'focus:ring-4 focus:ring-blue-600' : theme === 'ben10' ? 'focus:ring-4 focus:ring-[#64cc4f]' : theme === 'tinkerbell' ? 'focus:ring-4 focus:ring-yellow-400' : theme === 'cricketverse' ? 'focus:ring-4 focus:ring-blue-400' : theme === 'cricketverse-australian' ? 'focus:ring-4 focus:ring-[#fff800]' : theme === 'bounceworld' ? 'focus:ring-4 focus:ring-[#1D428A]' : theme === 'avengers' ? 'focus:ring-4 focus:ring-[#604AC7]' : theme === 'ponyville' ? 'focus:ring-4 focus:ring-[#e13690]' : 'focus:ring-4 focus:ring-blue-400'}`}
              >
                <option value="all"> All Classes</option>
                <option value="Active">Active Classes</option>
                <option value="Completed"> Completed Classes</option>
                <option value="Inactive">Inactive Classes</option>
                <option value="Dropped"> Dropped Classes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Classes Grid */}
        {filteredEnrollments.length === 0 ? (
          <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#b2e05b] via-[#222222] to-[#64cc4f]' : theme === 'tinkerbell' ? 'from-yellow-200 via-green-400 to-yellow-300' : theme === 'cricketverse' ? 'from-blue-300 via-indigo-400 to-blue-400' : theme === 'cricketverse-australian' ? 'from-white via-white to-white' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/20 to-white border-[#1D428A]' : theme === 'avengers' ? 'from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30 border-[#2C1267]' : theme === 'ponyville' ? 'from-[#f1aed5]/30 via-[#e13690]/30 to-[#ff2e9f]/30 border-[#f1aed5]' : 'from-blue-300 via-indigo-400 to-blue-400'} rounded-3xl shadow-2xl border-4 border-black p-12`}>
            <div className="text-center">
              <div className="text-8xl mb-6">📚</div>
              <h3 className={`text-3xl font-black mb-4 ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
                {searchTerm || statusFilter !== 'all' ? 'No Classes Found' : 'No Classes Yet'}
              </h3>
              <p className={`font-bold text-lg mb-6 ${theme === 'default' ? 'text-gray-600' : theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'cricketverse' ? 'text-blue-100' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-blue-100'}`}>
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria ' 
                  : theme === 'cricketverse-australian' ? 'Contact your teacher to get enrolled in some Australian cricket classes! 🇦🇺'
                  : theme === 'bounceworld' ? 'Contact your teacher to get enrolled in some bouncing classes!'
                  : theme === 'avengers' ? 'Contact your teacher to get enrolled in some heroic classes! 🦸'
                  : theme === 'ponyville' ? 'Contact your teacher to get enrolled in some magical pony classes! 🦄'
                  : 'Contact your teacher to get enrolled in some epic classes! '}
              </p>
             
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className={`rounded-3xl shadow-2xl border-4 border-black p-6 hover:shadow-3xl hover:scale-105 transition-all duration-300 hover:rotate-1 ${theme === 'default' ? 'bg-white' : theme === 'ben10' ? 'bg-gradient-to-br from-[#b2e05b] via-[#222222] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-200 via-green-400 to-yellow-300' : theme === 'cricketverse' ? 'bg-gradient-to-br from-blue-300 via-indigo-400 to-blue-400' : theme === 'cricketverse-australian' ? 'bg-gradient-to-br from-white via-white to-white' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-white' : theme === 'avengers' ? 'bg-gradient-to-br from-[#604AC7] via-[#2C1267] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-br from-blue-300 via-indigo-400 to-blue-400'}`}
              >
                {/* Class Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-black shadow-lg  ${theme === 'default' ? 'bg-blue-600' : theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'cricketverse' ? 'bg-blue-500' : theme === 'cricketverse-australian' ? 'bg-[#fff800]' : theme === 'bounceworld' ? 'bg-[#1D428A]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#f1aed5]' : 'bg-blue-500'}`}>
                      <div className="text-3xl">📚</div>
                    </div>
                    <div>
                      <h3 className={`font-black text-xl mb-1 ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                        {enrollment.className}
                      </h3>
                      <p className={`text-black font-bold text-sm rounded-full px-3 py-1 border-2 border-black ${theme === 'default' ? 'bg-blue-100' : theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-200' : theme === 'cricketverse' ? 'bg-blue-200' : theme === 'cricketverse-australian' ? 'bg-[#ffff2a]' : theme === 'bounceworld' ? 'bg-[#C8102E]/20' : theme === 'avengers' ? 'bg-[#604AC7]/30 text-white' : theme === 'ponyville' ? 'bg-[#e13690]/20' : 'bg-blue-200'}`}>
                        {enrollment.subject}
                      </p>
                    </div>
                  </div>
                  <span className={`px-4 py-2 text-sm font-black rounded-full border-4 border-black shadow-lg ${
                    enrollment.status === 'Active'
                      ? `${theme === 'default' ? 'bg-blue-600 text-white' : theme === 'ben10' ? 'bg-[#64cc4f] text-black' : theme === 'tinkerbell' ? 'bg-yellow-400 text-black' : theme === 'cricketverse' ? 'bg-blue-400 text-black' : theme === 'cricketverse-australian' ? 'bg-[#fff800] text-black' : theme === 'bounceworld' ? 'bg-[#1D428A] text-white' : theme === 'avengers' ? 'bg-[#604AC7] text-white' : theme === 'ponyville' ? 'bg-[#f1aed5] text-black' : 'bg-blue-400 text-black'}`
                      : enrollment.status === 'Completed'
                      ? `${theme === 'default' ? 'bg-green-600 text-white' : theme === 'ben10' ? 'bg-[#222222] text-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-black text-yellow-400' : theme === 'cricketverse' ? 'bg-black text-blue-400' : theme === 'cricketverse-australian' ? 'bg-black text-[#fff800]' : theme === 'bounceworld' ? 'bg-[#C8102E] text-white' : theme === 'avengers' ? 'bg-[#0F0826] text-[#604AC7]' : theme === 'ponyville' ? 'bg-[#ff2e9f] text-white' : 'bg-black text-blue-400'}`
                      : enrollment.status === 'Inactive'
                      ? `${theme === 'default' ? 'bg-gray-500 text-white' : theme === 'ben10' ? 'bg-[#b2e05b] text-black' : theme === 'tinkerbell' ? 'bg-yellow-500 text-black' : theme === 'cricketverse' ? 'bg-blue-500 text-black' : theme === 'cricketverse-australian' ? 'bg-[#fff800]/50 text-black' : theme === 'bounceworld' ? 'bg-[#1D428A]/50 text-white' : theme === 'avengers' ? 'bg-[#604AC7]/50 text-white' : theme === 'ponyville' ? 'bg-[#e13690]/50 text-white' : 'bg-blue-500 text-black'}`
                      : 'bg-red-400 text-black'
                  }`}>
                    {enrollment.status}
                  </span>
                </div>

                {/* Hero Class Info */}
                <div className="bg-white border-4 border-black rounded-2xl p-4 mb-4 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">📅</div>
                      <span className="text-sm font-bold text-black">Enrolled</span>
                    </div>
                      <span className={`text-sm font-black rounded-full px-3 py-1 border-2 text-black border-black ${theme === 'default' ? 'bg-blue-100' : theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-200' : theme === 'cricketverse' ? 'bg-blue-200' : theme === 'cricketverse-australian' ? 'bg-[#ffff2a]' : theme === 'bounceworld' ? 'bg-[#1D428A]/20' : theme === 'avengers' ? 'bg-[#604AC7]/30' : theme === 'ponyville' ? 'bg-[#e13690]/20' : 'bg-blue-200'}`}>
                      {enrollment.enrolledAt.toLocaleDateString()}
                    </span>
                  </div>
                  
                  {enrollment.grade !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">🏆</div>
                        <span className="text-sm font-bold text-black">Hero Grade</span>
                      </div>
                      <span className={`text-lg font-black px-3 py-1 rounded-full border-2 border-black ${
                        enrollment.grade >= 80
                          ? `${theme === 'default' ? 'bg-blue-600 text-white' : theme === 'ben10' ? 'bg-[#64cc4f] text-black' : theme === 'tinkerbell' ? 'bg-yellow-400 text-black' : theme === 'cricketverse' ? 'bg-blue-400 text-black' : theme === 'cricketverse-australian' ? 'bg-[#fff800] text-black' : theme === 'bounceworld' ? 'bg-[#1D428A] text-white' : theme === 'avengers' ? 'bg-[#604AC7] text-white' : theme === 'ponyville' ? 'bg-[#f1aed5] text-black' : 'bg-blue-400 text-black'}`
                          : enrollment.grade >= 60
                          ? `${theme === 'default' ? 'bg-blue-500 text-white' : theme === 'ben10' ? 'bg-[#b2e05b] text-black' : theme === 'tinkerbell' ? 'bg-yellow-500 text-black' : theme === 'cricketverse' ? 'bg-blue-500 text-black' : theme === 'cricketverse-australian' ? 'bg-[#fff800]/70 text-black' : theme === 'bounceworld' ? 'bg-[#C8102E] text-white' : theme === 'avengers' ? 'bg-[#C88DA5] text-white' : theme === 'ponyville' ? 'bg-[#e13690] text-white' : 'bg-blue-500 text-black'}`
                          : 'bg-red-400 text-black'
                      }`}>
                        {enrollment.grade}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Hero Progress Bar */}
                {enrollment.grade !== undefined && (
                  <div className="mb-4">
                    <div className="bg-white border-4 border-black rounded-full h-6 p-1 shadow-lg">
                      <div
                        className={`h-4 rounded-full transition-all duration-1000 border-2 border-black ${
                          enrollment.grade >= 80
                            ? `${theme === 'default' ? 'bg-gradient-to-r from-blue-500 to-blue-700' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-amber-400' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 to-indigo-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800] to-[#ffff2a]' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#C88DA5]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-r from-blue-400 to-indigo-600'}`
                            : enrollment.grade >= 60
                            ? `${theme === 'default' ? 'bg-gradient-to-r from-blue-400 to-blue-600' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-300 to-blue-500' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800]/70 to-[#ffff2a]' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#C8102E] to-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#C88DA5] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#e13690] to-[#f1aed5]' : 'bg-gradient-to-r from-blue-300 to-blue-500'}`
                            : 'bg-gradient-to-r from-red-400 to-red-600'
                        }`}
                        style={{ width: `${enrollment.grade}%` }}
                      />
                    </div>
                    <div className="text-center mt-2">
                      <span className={`text-sm font-bold ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>Transform to Excellence! </span>
                    </div>
                  </div>
                )}

                {/* Hero Notes */}
                {enrollment.notes && (
                  <div className="border-t-4 border-black pt-4 mb-4">
                    <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="text-2xl">📝</div>
                        <p className="text-sm font-black text-black">Teacher's Hero Notes:</p>
                      </div>
                      <p className={`text-black font-medium rounded-lg p-3 border-2 border-black ${theme === 'default' ? 'bg-gray-100' : theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-100' : theme === 'cricketverse' ? 'bg-blue-100' : theme === 'cricketverse-australian' ? 'bg-[#fff800]/30' : theme === 'bounceworld' ? 'bg-[#1D428A]/10' : theme === 'avengers' ? 'bg-[#604AC7]/20' : theme === 'ponyville' ? 'bg-[#f1aed5]/20' : 'bg-blue-100'}`}>
                        {enrollment.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Teacher's Hero Remark */}
                {enrollment.remark && (
                  <div className="border-t-4 border-black pt-4 mb-4">
                    <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-lg">
                      <div className="flex items-start space-x-3">
                        <div className="text-3xl">🦸‍♂️</div>
                        <div className="flex-1">
                          <p className="text-lg font-black text-black mb-3">
                            Teacher's Remark:
                          </p>
                          <div className="space-y-3">
                            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black border-2 border-black shadow-lg ${getRemarkColor(enrollment.remark.remarkLevel)}`}>
                              {enrollment.remark.remarkLevel === 'Custom' ? enrollment.remark.customRemark : enrollment.remark.remarkLevel}
                            </span>
                            {enrollment.remark.additionalNotes && (
                              <div className={`p-4 rounded-xl border-2 border-black ${theme === 'default' ? 'bg-gray-100' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-100 to-pink-200' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-100 to-indigo-200' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800]/30 to-[#ffff2a]/30' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A]/10 to-[#C8102E]/10' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 to-[#C88DA5]/20' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5]/30 to-[#e13690]/20' : 'bg-gradient-to-r from-blue-100 to-indigo-200'}`}>
                                <p className={`font-medium ${theme === 'default' ? 'text-gray-700' : theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-gray-800' : theme === 'cricketverse' ? 'text-gray-700' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-gray-700' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-gray-700'}`}>
                                  {enrollment.remark.additionalNotes}
                                </p>
                              </div>
                            )}
                            <p className="text-xs font-bold text-gray-600 bg-white rounded-full px-3 py-1 border border-black">
                              Updated: {enrollment.remark.updatedAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hero Zoom Meeting Link */}
                {enrollment.classData?.zoomLink && (
                  <div className="border-t-4 border-black pt-4 mb-4">
                    <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-lg">
                      <div className="mb-4">
                        <p className="text-lg font-black text-black mb-3 flex items-center">
                          <span className="text-2xl mr-2">🎥</span>
                          Meeting Link:
                        </p>
                        <div className={`p-3 rounded-xl border-2 border-black ${theme === 'default' ? 'bg-gray-100' : theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-200 to-pink-200' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-200 to-indigo-300' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800]/30 to-[#ffff2a]/30' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A]/10 to-[#C8102E]/10' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7]/30 to-[#C88DA5]/20' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5]/30 to-[#e13690]/20' : 'bg-gradient-to-r from-blue-200 to-indigo-300'}`}>
                          <p className={`font-medium break-all text-sm ${theme === 'default' ? 'text-gray-700' : theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-gray-800' : theme === 'cricketverse' ? 'text-gray-700' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-gray-700' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-gray-700'}`}>
                            {enrollment.classData.zoomLink}
                          </p>
                        </div>
                      </div>
                      {/* Join Button */}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleJoinZoom(enrollment.classData!.zoomLink!)}
                        className={`w-full text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center justify-center space-x-3 ${theme === 'default' ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-500 to-pink-500 hover:from-yellow-600 hover:to-pink-600' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800] to-[#ffff2a] hover:from-[#ffff2a] hover:to-[#fff800] text-black' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267] hover:from-[#2C1267] hover:to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'}`}
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span>Join Meeting 📹</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to tests page
                      window.location.href = `/student/test`;
                    }}
                    className={`text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:rotate-3 flex flex-col items-center py-3 ${theme === 'default' ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800] to-[#ffff2a] hover:from-[#ffff2a] hover:to-[#fff800]' :theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#C88DA5] hover:from-[#C88DA5] hover:to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#f1aed5]' : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'}`}>
                    <span className="text-2xl mb-1">📝</span>
                    <span className={`text-xs ${theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>Test</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to study materials page for this class
                      window.location.href = `/student/study?classId=${enrollment.classId}`;
                    }}
                    className={`text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:-rotate-3 flex flex-col items-center py-3 ${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800] to-[#ffff2a] hover:from-[#ffff2a] hover:to-[#fff800]' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#C88DA5] hover:from-[#C88DA5] hover:to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#f1aed5]' : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'}`}>
                    <span className="text-2xl mb-1">📚</span>
                    <span className={`text-xs ${theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>Study</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to videos page for this class
                      window.location.href = `/student/classes/${enrollment.classId}/videos`;
                    }}
                    className={`text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:rotate-3 flex flex-col items-center py-3 ${theme === 'default' ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f]' : theme === 'cricketverse-australian' ? 'bg-gradient-to-br from-[#ffff2a] via-[#f6f672] to-[#ffff2a]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#C88DA5] hover:from-[#C88DA5] hover:to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#f1aed5]' : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'}`}>
                    <span className="text-2xl mb-1">🎬</span>
                    <span className={`text-xs ${theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>Videos</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {filteredEnrollments.length > 0 && (
          <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f] to-[#222222] via-[#64cc4f]' : theme === 'tinkerbell' ? 'from-yellow-300 via-green-400 to-yellow-400' : theme === 'cricketverse' ? 'from-blue-400 via-indigo-500 to-blue-500' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#fff800] to-[#ffff2a] hover:from-[#ffff2a] hover:to-[#fff800]'  : theme === 'bounceworld' ? 'from-[#1D428A] to-[#C8102E] via-[#1D428A]' : theme === 'avengers' ? 'from-[#604AC7] via-[#2C1267] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-blue-400 via-indigo-500 to-blue-500'} rounded-3xl shadow-2xl border-4 border-black p-8 mt-8`}>
            <div className="flex items-center justify-center space-x-3 mb-8">
              {(theme === 'default' || theme === 'ben10' || theme === 'tinkerbell' || theme === 'cricketverse' || theme === 'ponyville') && <div className="text-4xl">📊</div>}
              <h3 className={`text-3xl font-black ${theme === 'avengers' ? 'text-white' :theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>Classes Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">🎯</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'default' ? 'text-blue-600' : theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-yellow-600' : theme === 'cricketverse' ? 'text-[#3b82f6]' : theme === 'cricketverse-australian' ? 'text-[#fff800]' : theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#604AC7]' : theme === 'ponyville' ? 'text-[#f1aed5]' : 'text-[#3b82f6]'}`}>
                  {filteredEnrollments.filter(e => e.status === 'Active').length}
                </div>
                <div className="text-sm font-bold text-black">Active Classes</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">🏆</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'default' ? 'text-blue-600' : theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-yellow-600' : theme === 'cricketverse' ? 'text-[#3b82f6]' : theme === 'cricketverse-australian' ? 'text-[#fff800]' : theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#0F0826]' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-[#3b82f6]'}`}>
                  {filteredEnrollments.filter(e => e.status === 'Completed').length}
                </div>
                <div className="text-sm font-bold text-black">Completed Classes</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">📈</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'default' ? 'text-blue-600' : theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-yellow-600' : theme === 'cricketverse' ? 'text-[#3b82f6]' : theme === 'cricketverse-australian' ? 'text-[#fff800]' : theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-[#ff2e9f]' : 'text-[#3b82f6]'}`}>
                  {Math.round(filteredEnrollments.reduce((acc, e) => acc + e.attendance, 0) / filteredEnrollments.length) || 0}%
                </div>
                <div className="text-sm font-bold text-black">Attendance</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">⭐</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'default' ? 'text-blue-600' : theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-yellow-600' : theme === 'cricketverse' ? 'text-[#3b82f6]' : theme === 'cricketverse-australian' ? 'text-[#fff800]' : theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#604AC7]' : theme === 'ponyville' ? 'text-[#f1aed5]' : 'text-[#3b82f6]'}`}>
                  {filteredEnrollments.filter(e => e.grade !== undefined).length > 0 
                    ? Math.round(filteredEnrollments
                        .filter(e => e.grade !== undefined)
                        .reduce((acc, e) => acc + (e.grade || 0), 0) / 
                      filteredEnrollments.filter(e => e.grade !== undefined).length) 
                    : 'N/A'
                  }{filteredEnrollments.filter(e => e.grade !== undefined).length > 0 ? '%' : ''}
                </div>
                <div className="text-sm font-bold text-black">Grade</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
