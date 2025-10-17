'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Users, Clock, Award, Search, Filter, ExternalLink, MessageSquare } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
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
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-black to-green-500 flex items-center justify-center">
        <div className="bg-white border-4 border-black rounded-3xl p-8 shadow-2xl">
          {/* Ben 10 Loading Animation */}
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center relative mx-auto animate-spin border-4 border-black">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center">
                <span className="text-green-400 text-xl font-bold animate-pulse">10</span>
                <div className="absolute inset-0 rounded-full border-2 border-black animate-ping"></div>
              </div>
            </div>
            <div className="text-center mt-4">
              <span className="text-green-600 font-bold text-xl">Ben 10</span>
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Hero Classes...</h2>
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
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-black to-green-500 p-6">
        {/* Ben 10 Header */}
        <div className="bg-gradient-to-r from-green-500 via-black to-green-600 rounded-3xl shadow-2xl border-4 border-black p-8 mb-6 relative overflow-hidden">
          {/* Omnitrix Symbols */}
          <div className="absolute -top-4 -left-4 w-12 h-12 bg-green-400 rounded-full animate-bounce border-2 border-black flex items-center justify-center">
            <span className="text-black text-lg font-bold">10</span>
          </div>
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-black rounded-full animate-bounce delay-300 border-2 border-black flex items-center justify-center">
            <span className="text-green-400 text-lg font-bold">B</span>
          </div>

          {/* Hero Sparkles */}
          <div className="absolute top-4 right-16 text-2xl">⚡</div>
          <div className="absolute bottom-4 left-16 text-2xl">🚀</div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              <div className="text-6xl">🦸‍♂️</div>
              <div>
                <h1 className="text-4xl font-black text-white mb-2 flex items-center">
                  <span>Ben 10's</span>
                  <span className="ml-2 text-green-400 font-black text-5xl">Hero</span>
                  <span className="ml-2 text-3xl">Classroom</span>
                  <span className="ml-2 text-2xl">🔄</span>
                </h1>
                <p className="text-green-200 font-bold text-lg">
                  Transform your learning with alien-powered adventures! �
                </p>
              </div>
            </div>
            <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="text-4xl">📚</div>
                <div className="text-center">
                  <div className="text-3xl font-black text-black">{filteredEnrollments.length}</div>
                  <div className="text-sm font-bold text-gray-700">Hero Classes</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ben 10 Search and Filter */}
        <div className="bg-gradient-to-r from-green-400 via-black to-green-500 rounded-2xl shadow-xl border-4 border-black p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="text-3xl">🔍</div>
            <h2 className="text-2xl font-black text-white">Ben 10's Hero Search</h2>
            <div className="text-2xl">⚡</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">🔍</div>
                <Input
                  type="text"
                  placeholder="Search for hero classes or subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-3 text-lg border-4 border-black rounded-2xl bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-green-400 shadow-lg"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-2xl">🦸‍♂️</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border-4 border-black rounded-2xl px-6 py-3 bg-white text-black font-bold text-lg focus:outline-none focus:ring-4 focus:ring-green-400 shadow-lg hover:bg-gray-50 transition-all"
              >
                <option value="all">⚡ All Hero Classes</option>
                <option value="Active">🎯 Active Missions</option>
                <option value="Completed">🏆 Completed Battles</option>
                <option value="Inactive">😴 Resting Classes</option>
                <option value="Dropped">👋 Dropped Classes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Classes Grid */}
        {filteredEnrollments.length === 0 ? (
          <div className="bg-gradient-to-r from-green-300 via-black to-green-400 rounded-3xl shadow-2xl border-4 border-black p-12">
            <div className="text-center">
              <div className="text-8xl mb-6">🦸‍♂️</div>
              <h3 className="text-3xl font-black text-white mb-4">
                {searchTerm || statusFilter !== 'all' ? 'No Hero Classes Found' : 'No Alien Classes Yet'}
              </h3>
              <p className="text-green-200 font-bold text-lg mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your hero search or filter criteria ⚡' 
                  : 'Contact your teacher to get enrolled in some epic classes! 🦸‍♂️'}
              </p>
              <div className="flex justify-center space-x-4">
                <div className="text-4xl">🦸‍♂️</div>
                <div className="text-4xl animate-pulse delay-300">🔄</div>
                <div className="text-4xl animate-pulse delay-500">⚡</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="bg-gradient-to-br from-green-300 via-black to-green-400 rounded-3xl shadow-2xl border-4 border-black p-6 hover:shadow-3xl hover:scale-105 transition-all duration-300 hover:rotate-1"
              >
                {/* Ben 10 Class Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center border-4 border-black shadow-lg animate-pulse">
                      <div className="text-3xl">🦸‍♂️</div>
                    </div>
                    <div>
                      <h3 className="font-black text-white text-xl mb-1">
                        {enrollment.className}
                      </h3>
                      <p className="text-black font-bold text-sm bg-green-200 rounded-full px-3 py-1 border-2 border-black">
                        {enrollment.subject}
                      </p>
                    </div>
                  </div>
                  <span className={`px-4 py-2 text-sm font-black rounded-full border-4 border-black shadow-lg ${
                    enrollment.status === 'Active' 
                      ? 'bg-green-400 text-black'
                      : enrollment.status === 'Completed'
                      ? 'bg-black text-green-400'
                      : enrollment.status === 'Inactive'
                      ? 'bg-green-500 text-black'
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
                    <span className="text-sm font-black text-black bg-green-300 rounded-full px-3 py-1 border-2 border-black">
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
                          ? 'bg-green-400 text-black'
                          : enrollment.grade >= 60
                          ? 'bg-green-500 text-black'
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
                            ? 'bg-gradient-to-r from-green-400 to-green-600'
                            : enrollment.grade >= 60
                            ? 'bg-gradient-to-r from-green-500 to-green-700'
                            : 'bg-gradient-to-r from-red-400 to-red-600'
                        }`}
                        style={{ width: `${enrollment.grade}%` }}
                      ></div>
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-sm font-bold text-white">Transform to Excellence! ⚡</span>
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
                      <p className="text-black font-medium bg-green-100 rounded-lg p-3 border-2 border-black">
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
                            Teacher's Hero Remark:
                          </p>
                          <div className="space-y-3">
                            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-black border-2 border-black shadow-lg ${getRemarkColor(enrollment.remark.remarkLevel)}`}>
                              {enrollment.remark.remarkLevel === 'Custom' ? enrollment.remark.customRemark : enrollment.remark.remarkLevel}
                            </span>
                            {enrollment.remark.additionalNotes && (
                              <div className="bg-gradient-to-r from-green-100 to-black p-4 rounded-xl border-2 border-black">
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
                        <div className="p-3 bg-gradient-to-r from-green-200 to-black rounded-xl border-2 border-black">
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
                        className="w-full bg-gradient-to-r from-green-500 to-black hover:from-green-600 hover:to-gray-900 text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center justify-center space-x-3"
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span>Join Hero Meeting! 🦸‍♂️</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Hero Action Buttons */}
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to tests page
                      window.location.href = `/student/test`;
                    }}
                    className="bg-gradient-to-r from-green-400 to-emerald-400 hover:from-green-500 hover:to-emerald-500 text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:rotate-3 flex flex-col items-center py-3"
                  >
                    <span className="text-2xl mb-1">📝</span>
                    <span className="text-xs">Hero Tests</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to study materials page for this class
                      window.location.href = `/student/study?classId=${enrollment.classId}`;
                    }}
                    className="bg-gradient-to-r from-green-400 to-emerald-400 hover:from-green-500 hover:to-emerald-500 text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:-rotate-3 flex flex-col items-center py-3"
                  >
                    <span className="text-2xl mb-1">📚</span>
                    <span className="text-xs">Hero Study</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to videos page for this class
                      window.location.href = `/student/classes/${enrollment.classId}/videos`;
                    }}
                    className="bg-gradient-to-r from-green-400 to-emerald-400 hover:from-green-500 hover:to-emerald-500 text-black font-black border-4 border-black rounded-2xl transform hover:scale-110 transition-all shadow-lg hover:rotate-3 flex flex-col items-center py-3"
                  >
                    <span className="text-2xl mb-1">🎬</span>
                    <span className="text-xs">Hero Videos</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ben 10 Hero Summary Stats */}
        {filteredEnrollments.length > 0 && (
          <div className="bg-gradient-to-r from-green-400 via-black to-green-400 rounded-3xl shadow-2xl border-4 border-black p-8 mt-8">
            <div className="flex items-center justify-center space-x-3 mb-8">
              <div className="text-4xl">🦸‍♂️</div>
              <h3 className="text-3xl font-black text-white">Ben 10 Hero Summary</h3>
              <div className="text-4xl">⚡</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">🎯</div>
                <div className="text-3xl font-black text-green-600 mb-1">
                  {filteredEnrollments.filter(e => e.status === 'Active').length}
                </div>
                <div className="text-sm font-bold text-black">Active Adventures</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">🏆</div>
                <div className="text-3xl font-black text-green-600 mb-1">
                  {filteredEnrollments.filter(e => e.status === 'Completed').length}
                </div>
                <div className="text-sm font-bold text-black">Completed Quests</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">📈</div>
                <div className="text-3xl font-black text-green-600 mb-1">
                  {Math.round(filteredEnrollments.reduce((acc, e) => acc + e.attendance, 0) / filteredEnrollments.length) || 0}%
                </div>
                <div className="text-sm font-bold text-black">Hero Attendance</div>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-all">
                <div className="text-4xl mb-2">⭐</div>
                <div className="text-3xl font-black text-green-600 mb-1">
                  {filteredEnrollments.filter(e => e.grade !== undefined).length > 0 
                    ? Math.round(filteredEnrollments
                        .filter(e => e.grade !== undefined)
                        .reduce((acc, e) => acc + (e.grade || 0), 0) / 
                      filteredEnrollments.filter(e => e.grade !== undefined).length) 
                    : 'N/A'
                  }{filteredEnrollments.filter(e => e.grade !== undefined).length > 0 ? '%' : ''}
                </div>
                <div className="text-sm font-bold text-black">Hero Grade</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
