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
      <div className={`min-h-screen bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-yellow-300 via-green-400 to-yellow-400' : 'from-blue-400 to-indigo-600'} flex items-center justify-center`}>
        <div className="bg-white border-4 border-black rounded-3xl p-8 shadow-2xl">
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
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Your Classes...</h2>
            <p className="text-gray-600 font-medium">Get ready to transform your learning! 🔄⚡</p>
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
        className={`min-h-screen p-6 ${theme === 'ben10' ? '' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600'}`}
        style={
          theme === 'ben10'
            ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' }
            : undefined
        }
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-300 via-green-500 to-yellow-400' : 'from-blue-400 to-indigo-600'} rounded-3xl shadow-2xl border-4 border-black p-8 mb-6 relative overflow-hidden`}>
      
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
             
              <div>
                <h1 className="text-4xl font-black text-black mb-2 flex items-center">
                  <span>My</span>
                  <span className="ml-2 text-3xl">Classroom</span>
                
                </h1>
                <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-white' : 'text-blue-100'}`}>
                  Transform your learning with amazing adventures! 
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
        </div>

        {/* Search and Filter */}
        <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-300 via-green-400 to-yellow-400' : 'from-blue-300 via-indigo-400 to-indigo-500'} rounded-2xl shadow-xl border-4 border-black p-6 mb-6`}>
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
                  className={`pl-12 pr-4 py-3 text-lg border-4 border-black rounded-2xl bg-white text-black placeholder-gray-500 focus:outline-none shadow-lg ${theme === 'ben10' ? 'focus:ring-4 focus:ring-[#64cc4f]' : theme === 'tinkerbell' ? 'focus:ring-4 focus:ring-yellow-400' : 'focus:ring-4 focus:ring-blue-400'}`}
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
             
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`border-4 border-black rounded-2xl px-6 py-3 bg-white text-black font-bold text-lg focus:outline-none shadow-lg hover:bg-gray-50 transition-all ${theme === 'ben10' ? 'focus:ring-4 focus:ring-[#64cc4f]' : theme === 'tinkerbell' ? 'focus:ring-4 focus:ring-yellow-400' : 'focus:ring-4 focus:ring-blue-400'}`}
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
          <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#b2e05b] via-[#222222] to-[#64cc4f]' : theme === 'tinkerbell' ? 'from-yellow-200 via-green-400 to-yellow-300' : 'from-blue-300 via-indigo-400 to-blue-400'} rounded-3xl shadow-2xl border-4 border-black p-12`}>
            <div className="text-center">
              <div className="text-8xl mb-6">📚</div>
              <h3 className="text-3xl font-black text-white mb-4">
                {searchTerm || statusFilter !== 'all' ? 'No Classes Found' : 'No Classes Yet'}
              </h3>
              <p className={`font-bold text-lg mb-6 ${theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-yellow-100' : 'text-blue-100'}`}>
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria ' 
                  : 'Contact your teacher to get enrolled in some epic classes! '}
              </p>
             
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className={`rounded-3xl shadow-2xl border-4 border-black p-6 hover:shadow-3xl hover:scale-105 transition-all duration-300 hover:rotate-1 ${theme === 'ben10' ? 'bg-gradient-to-br from-[#b2e05b] via-[#222222] to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-200 via-green-400 to-yellow-300' : 'bg-gradient-to-br from-blue-300 via-indigo-400 to-blue-400'}`}
              >
                {/* Class Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-black shadow-lg  ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : 'bg-blue-500'}`}>
                      <div className="text-3xl">📚</div>
                    </div>
                    <div>
                      <h3 className="font-black text-black text-xl mb-1">
                        {enrollment.className}
                      </h3>
                      <p className={`text-black font-bold text-sm rounded-full px-3 py-1 border-2 border-black ${theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-200' : 'bg-blue-200'}`}>
                        {enrollment.subject}
                      </p>
                    </div>
                  </div>
                  <span className={`px-4 py-2 text-sm font-black rounded-full border-4 border-black shadow-lg ${
                    enrollment.status === 'Active' 
                      ? `${theme === 'ben10' ? 'bg-[#64cc4f] text-black' : theme === 'tinkerbell' ? 'bg-yellow-400 text-black' : 'bg-blue-400 text-black'}`
                      : enrollment.status === 'Completed'
                      ? `${theme === 'ben10' ? 'bg-[#222222] text-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-black text-yellow-400' : 'bg-black text-blue-400'}`
                      : enrollment.status === 'Inactive'
                      ? `${theme === 'ben10' ? 'bg-[#b2e05b] text-black' : theme === 'tinkerbell' ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-black'}`
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
                      <span className={`text-sm font-black rounded-full px-3 py-1 border-2 text-black border-black ${theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-200' : 'bg-blue-200'}`}>
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
                          ? `${theme === 'ben10' ? 'bg-[#64cc4f] text-black' : theme === 'tinkerbell' ? 'bg-yellow-400 text-black' : 'bg-blue-400 text-black'}`
                          : enrollment.grade >= 60
                          ? `${theme === 'ben10' ? 'bg-[#b2e05b] text-black' : theme === 'tinkerbell' ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-black'}`
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
                            ? `${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b]' : 'bg-gradient-to-r from-yellow-400 to-yellow-600'}`
                            : enrollment.grade >= 60
                            ? `${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#64cc4f]' : 'bg-gradient-to-r from-yellow-500 to-yellow-700'}`
                            : 'bg-gradient-to-r from-red-400 to-red-600'
                        }`}
                        style={{ width: `${enrollment.grade}%` }}
                      ></div>
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-sm font-bold text-white">Transform to Excellence! </span>
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
                      <p className={`text-black font-medium rounded-lg p-3 border-2 border-black ${theme === 'ben10' ? 'bg-[#b2e05b]' : 'bg-yellow-100'}`}>
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
                              <div className={`p-4 rounded-xl border-2 border-black ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#222222]' : 'bg-gradient-to-r from-yellow-100 to-black'}`}>
                                <p className="text-white font-medium">
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
                        <div className={`p-3 rounded-xl border-2 border-black ${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] to-[#222222]' : 'bg-gradient-to-r from-yellow-200 to-black'}`}>
                          <p className="text-white font-medium break-all text-sm">
                            {enrollment.classData.zoomLink}
                          </p>
                        </div>
                      </div>
                      {/* Join Button */}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleJoinZoom(enrollment.classData!.zoomLink!)}
                        className={`w-full text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center justify-center space-x-3 ${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]' : 'bg-gradient-to-r from-yellow-500 to-black hover:from-yellow-600 hover:to-gray-900'}`}
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
                    className={`text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:rotate-3 flex flex-col items-center py-3 ${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f]' : 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500'}`}>
                    <span className="text-2xl mb-1">📝</span>
                    <span className="text-xs text-black">Tests</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to study materials page for this class
                      window.location.href = `/student/study?classId=${enrollment.classId}`;
                    }}
                    className={`text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:-rotate-3 flex flex-col items-center py-3 ${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f]' : 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500'}`}>
                    <span className="text-2xl mb-1">📚</span>
                    <span className="text-xs text-black">Study</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to videos page for this class
                      window.location.href = `/student/classes/${enrollment.classId}/videos`;
                    }}
                    className={`text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:rotate-3 flex flex-col items-center py-3 ${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f]' : 'bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500'}`}>
                    <span className="text-2xl mb-1">🎬</span>
                    <span className="text-xs text-black">Videos</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {filteredEnrollments.length > 0 && (
          <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222] via-[#64cc4f]' : 'from-yellow-300 via-green-400 to-yellow-400'} rounded-3xl shadow-2xl border-4 border-black p-8 mt-8`}>
            <div className="flex items-center justify-center space-x-3 mb-8">
              <div className="text-4xl">📊</div>
              <h3 className="text-3xl font-black text-black">Classes Summary</h3>
         
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">🎯</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'ben10' ? 'text-[#64cc4f]' : 'text-yellow-600'}`}>
                  {filteredEnrollments.filter(e => e.status === 'Active').length}
                </div>
                <div className="text-sm font-bold text-black">Active Classes</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">🏆</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'ben10' ? 'text-[#64cc4f]' : 'text-yellow-600'}`}>
                  {filteredEnrollments.filter(e => e.status === 'Completed').length}
                </div>
                <div className="text-sm font-bold text-black">Completed Classes</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">📈</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'ben10' ? 'text-[#64cc4f]' : 'text-yellow-600'}`}>
                  {Math.round(filteredEnrollments.reduce((acc, e) => acc + e.attendance, 0) / filteredEnrollments.length) || 0}%
                </div>
                <div className="text-sm font-bold text-black">Attendance</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">⭐</div>
                <div className={`text-3xl font-black mb-1 ${theme === 'ben10' ? 'text-[#64cc4f]' : 'text-yellow-600'}`}>
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
