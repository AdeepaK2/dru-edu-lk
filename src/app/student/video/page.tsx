'use client';

import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Play, 
  Search, 
  BookOpen,
  Users,
  GraduationCap
} from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Link from 'next/link';

// Import services and types
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { VideoFirestoreService } from '@/apiservices/videoFirestoreService';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';

export default function StudentVideos() {
  const { student } = useStudentAuth();
  const [studentClasses, setStudentClasses] = useState<any[]>([]);
  const [individualVideos, setIndividualVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load student's classes
  useEffect(() => {
    const loadStudentClasses = async () => {
      if (!student?.id) return;
      
      console.log('🔍 Student object in videos page:', student);
      
      setLoading(true);
      setError(null);
      
      try {
        // Get student's enrollments first
        const enrollments = await getEnrollmentsByStudent(student.id);
        console.log('🔍 Student enrollments loaded:', enrollments);
        
        // Filter for active enrollments only
        const activeEnrollments = enrollments.filter(enrollment => 
          enrollment.status === 'Active'
        );
        
        // Get class details for each active enrollment
        const classesWithDetails = await Promise.all(
          activeEnrollments.map(async (enrollment) => {
            try {
              const classDetails = await ClassFirestoreService.getClassById(enrollment.classId);
              
              // Get teacher information if teacherId is available
              let teacherName = 'Teacher';
              if (classDetails?.teacherId) {
                try {
                  const teacher = await TeacherFirestoreService.getTeacherById(classDetails.teacherId);
                  teacherName = teacher ? teacher.name : 'Teacher';
                } catch (teacherErr) {
                  console.error(`Error loading teacher ${classDetails.teacherId}:`, teacherErr);
                }
              }
              
              return {
                id: enrollment.classId,
                name: enrollment.className,
                subject: enrollment.subject,
                grade: classDetails?.year || 'N/A',
                teacherName: teacherName,
                description: classDetails?.description || enrollment.className,
                enrollmentId: enrollment.id,
                enrolledAt: enrollment.enrolledAt
              };
            } catch (err) {
              console.error(`Error loading class details for ${enrollment.classId}:`, err);
              // Return basic info from enrollment if class fetch fails
              return {
                id: enrollment.classId,
                name: enrollment.className,
                subject: enrollment.subject,
                grade: 'N/A',
                teacherName: 'Teacher',
                description: enrollment.className,
                enrollmentId: enrollment.id,
                enrolledAt: enrollment.enrolledAt
              };
            }
          })
        );
        
        console.log('🔍 Student classes with details loaded:', classesWithDetails);
        setStudentClasses(classesWithDetails);
        
        // Load videos individually assigned to this student
        try {
          const assignedVideos = await VideoFirestoreService.getVideosByStudent(student.id);
          console.log('🔍 Individual videos assigned to student:', assignedVideos);
          setIndividualVideos(assignedVideos);
        } catch (videoErr) {
          console.error('Error loading individual videos:', videoErr);
          setIndividualVideos([]);
        }
        
      } catch (err: any) {
        console.error('Error loading student classes:', err);
        setError(err.message || 'Failed to load classes');
      } finally {
        setLoading(false);
      }
    };
    
    loadStudentClasses();
  }, [student?.id]);

  // Filter classes by search term
  const getFilteredClasses = () => {
    if (!searchTerm) return studentClasses;
    
    return studentClasses.filter(cls =>
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.teacherName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 via-green-700 to-black p-6">
        <div className="flex items-center justify-center py-12">
          <div className="bg-gradient-to-r from-green-600 to-black rounded-3xl shadow-2xl border-4 border-black p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin bg-gradient-to-r from-green-400 to-green-600"></div>
              <span className="text-2xl font-black text-white">Loading your hero videos... ⚡</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-green-700 to-black p-6">
      {/* Ben 10 Hero Header */}
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-black rounded-3xl shadow-2xl border-4 border-black p-8 mb-8 relative overflow-hidden">
        {/* Omnitrix Symbols */}
        <div className="absolute -top-4 -left-4 w-12 h-12 bg-green-400 rounded-full border-2 border-black flex items-center justify-center">
          <span className="text-black font-black text-lg">Ω</span>
        </div>
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-green-400 rounded-full border-2 border-black flex items-center justify-center">
          <span className="text-black font-black text-lg">Ω</span>
        </div>

        <div className="flex items-center space-x-4 relative z-10">
          <div className="text-6xl">⚡</div>
          <div>
            <h1 className="text-4xl font-black text-white mb-2 flex items-center">
              <span>Ben 10's</span>
              <span className="ml-2 text-green-300 font-black text-5xl">Hero</span>
              <span className="ml-2 text-3xl">Video</span>
              <span className="ml-2 text-3xl">Library</span>
              <span className="ml-2 text-3xl">Ω</span>
            </h1>
            <p className="text-green-100 font-bold text-lg">
              Welcome back, {student?.name}! Transform your learning with hero-powered videos! ⚡
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-gradient-to-r from-red-200 to-orange-200 rounded-3xl shadow-2xl border-4 border-black p-6">
          <div className="flex items-center space-x-4">
            <div className="text-4xl">😔</div>
            <div>
              <h3 className="text-xl font-black text-black mb-2">Oops! Something went wrong</h3>
              <p className="text-black font-bold">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-3xl shadow-2xl border-4 border-black p-6 mb-8">
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">🔍</div>
          <input
            type="text"
            placeholder="🔍 Search hero classes..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-12 w-full px-6 py-3 border-4 border-black rounded-3xl focus:ring-4 focus:ring-green-400 focus:border-black bg-white text-black font-bold text-lg placeholder-black/60"
          />
        </div>
      </div>

      {/* Teacher Selected Videos Section */}
      {individualVideos.length > 0 && (
        <div className="bg-white rounded-3xl shadow-2xl border-4 border-black p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-black mb-2 flex items-center">
                <span className="text-3xl mr-3">🎯</span>
                Teacher Selected Videos for You
                <span className="ml-3 text-xl">⚡</span>
              </h2>
              <p className="text-black font-bold">
                Special video recommendations from your teachers
              </p>
            </div>
            <div className="bg-gradient-to-r from-green-600 to-black rounded-full px-4 py-2 border-2 border-black">
              <span className="text-white font-black text-sm">
                {individualVideos.length} Hero Video{individualVideos.length > 1 ? 's' : ''} ⚡
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {individualVideos.map((video) => (
              <div key={video.id} className="bg-white rounded-2xl shadow-lg border-2 border-black p-6 overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="flex items-start space-x-4 mb-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-12 bg-gradient-to-br from-green-600 to-black rounded-xl flex items-center justify-center border-2 border-black shadow-md">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-black mb-2 line-clamp-2">
                        {video.title}
                      </h3>
                      <p className="text-gray-700 font-medium text-sm mb-3 line-clamp-3">
                        {video.description}
                      </p>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                        {video.subjectName}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t-2 border-black">
                    <Link
                      href={`/student/video/${video.id}/watch`}
                      className="w-full bg-gradient-to-r from-green-600 to-black hover:from-green-700 hover:to-gray-900 text-white px-4 py-2 rounded-full font-bold text-sm transform hover:scale-105 transition-all border-2 border-black flex items-center justify-center space-x-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Watch Now</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classes Grid */}
      <div>
        {getFilteredClasses().length === 0 ? (
          <div className="bg-gradient-to-r from-green-200 via-green-300 to-black rounded-3xl shadow-2xl border-4 border-black p-12 text-center">
            <div className="text-6xl mb-6">Ω</div>
            <h3 className="text-2xl font-black text-white mb-4">
              {searchTerm ? 'No Hero Classes Found' : 'No Classes Available Yet'}
            </h3>
            <p className="text-green-100 font-bold text-lg">
              {searchTerm
                ? 'Try adjusting your search to find your hero classes!'
                : 'You haven\'t enrolled in any classes yet. Time to start your hero learning journey!'
              }
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-2xl border-4 border-black p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredClasses().map((classInfo) => (
                <ClassCard
                  key={classInfo.id}
                  classInfo={classInfo}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Class Card Component
interface ClassCardProps {
  classInfo: any;
}

const ClassCard: React.FC<ClassCardProps> = ({ classInfo }) => {
  return (
    <Link href={`/student/classes/${classInfo.id}/videos`}>
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-black rounded-3xl shadow-2xl border-4 border-black overflow-hidden hover:scale-105 transition-all cursor-pointer">
        {/* Class Header */}
        <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-6 border-b-4 border-black">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-black truncate mb-2">
                {classInfo.name}
              </h3>
              <p className="text-green-100 text-lg font-bold">
                {classInfo.subject} • Grade {classInfo.grade}
              </p>
            </div>
            <div className="text-4xl">⚡</div>
          </div>
        </div>

        {/* Class Info */}
        <div className="bg-white p-6">
          <div className="space-y-4">
            <div className="flex items-center text-black font-bold">
              <span className="text-2xl mr-3">👨‍🏫</span>
              <span className="truncate">{classInfo.teacherName}</span>
            </div>

            <div className="flex items-start text-black font-bold">
              <span className="text-2xl mr-3 mt-1">📚</span>
              <span className="line-clamp-2 break-words overflow-hidden">
                {classInfo.description && classInfo.description.length > 100
                  ? `${classInfo.description.substring(0, 100)}...`
                  : classInfo.description || 'Explore hero video content for this class'
                }
              </span>
            </div>

            <div className="pt-4 border-t-4 border-black">
              <div className="flex items-center justify-between">
                <span className="text-black font-bold">
                  Browse Hero Videos
                </span>
                <div className="bg-gradient-to-r from-green-600 to-black text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black flex items-center space-x-2">
                  <Play className="w-4 h-4" />
                  <span>Open</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
