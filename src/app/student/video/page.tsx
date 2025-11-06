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
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';

// Import services and types
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { VideoFirestoreService } from '@/apiservices/videoFirestoreService';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';

export default function StudentVideos() {
  const { student } = useStudentAuth();
  const { theme } = useTheme();
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
      <div className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : 'bg-gradient-to-br from-gray-100 to-gray-200'} flex items-center justify-center`}>
        <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-black' : 'border-black'} rounded-3xl p-8 shadow-2xl`}>
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
            
            {/* Ponyville Loading Animation */}
            {theme === 'ponyville' && (
              <div className="flex flex-col items-center">
                <img
                  src="/ponyville-loading.gif"
                  alt="Ponyville Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#e13690] mt-4">Loading</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'cricketverse' && theme !== 'ponyville' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-gray-600 mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Videos...</h2>
            <p className={`text-gray-600 font-medium ${theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#2C1267]' : theme === 'ponyville' ? 'text-[#e13690]' : ''}`}>
              {theme === 'bounceworld' ? 'Get ready to slam dunk your video learning! 🏀' : theme === 'avengers' ? 'Get ready to assemble your video learning! 🦸‍♂️' : theme === 'ponyville' ? 'Get ready to transform your learning with magical unicorn videos! 🦄' : 'Get ready to transform your learning!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300'} p-6`}>
      {/* Header */}
      <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A]  to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#ed65b4] to-[#e13690]' : 'bg-gradient-to-r from-gray-100 to-gray-200'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} p-8 mb-8 relative overflow-hidden`}>
        

        <div className="flex items-center space-x-4 relative z-10">
          {theme === 'cricketverse' ? (
            <img
              src="/batman3.png"
              alt="Batman"
              className="w-24 h-24 object-contain"
            />
          ) : theme === 'ponyville' ? (
            <img
              src="/ponyville/rarity.png"
              alt="Rarity"
              className="w-16 h-16 object-contain"
            />
          ) : theme === 'avengers' ? (
            <img
              src="/avengers/thor.png"
              alt="Thor"
              className="w-24 h-24 object-contain"
            />
          ) : theme === 'bounceworld' ? (
            <img
              src="/bounce-world.png"
              alt="Bounce World"
              className="w-32 h-32 object-contain"
            />
          ) : (
            <div className="text-6xl">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : ''}</div>
          )}
          <div>
            <h1 className="text-4xl font-black text-black mb-2 flex items-center">
              
              <span className={`text-4xl ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-black' : theme === 'ponyville' ? 'text-white' : 'text-black'}`}>Video</span>
              <span className={`ml-2 text-4xl ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-black' : theme === 'ponyville' ? 'text-white' : 'text-black'}`}>Library</span>
              
            </h1>
            <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-[#314603]' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-[#f8e8f1]' : 'text-gray-700'}`}>
              {theme === 'bounceworld'
                ? `Welcome back, ${student?.name}! Slam dunk your video learning experience! 🏀`
                : theme === 'ben10'
                ? `Welcome back, ${student?.name}! Transform your learning with hero-powered videos!`
                : theme === 'tinkerbell'
                ? `Welcome back, ${student?.name}! Transform your learning with magical videos!`
                : theme === 'avengers'
                ? `Welcome back, ${student?.name}! Assemble your learning with hero-powered videos! 🦸‍♂️`
                : theme === 'ponyville'
                ? `Welcome back, ${student?.name}! Transform your learning with magical unicorn videos! 🦄`
                : `Welcome back, ${student?.name}! Transform your learning with enriching videos!`}
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={`bg-gradient-to-r ${theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690]' : 'from-red-200 to-orange-200'} rounded-3xl shadow-2xl border-4 ${theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} p-6`}>
          <div className="flex items-center space-x-4">
            <div className="text-4xl">{theme === 'ponyville' ? '🦄' : '😔'}</div>
            <div>
              <h3 className={`text-xl font-black ${theme === 'ponyville' ? 'text-white' : 'text-black'} mb-2`}>
                {theme === 'ponyville' ? 'Oops! Magical Error Occurred' : 'Oops! Something went wrong'}
              </h3>
              <p className={`font-bold ${theme === 'ponyville' ? 'text-[#f1aed5]' : 'text-black'}`}>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 mb-8`}>
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">🔍</div>
          <input
            type="text"
            placeholder={theme === 'bounceworld' ? 'Search video classes...' : theme === 'avengers' ? 'Search hero classes...' : theme === 'ponyville' ? 'Search magical video classes...' : 'Search hero classes...'}
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className={`pl-12 w-full px-6 py-3 border-4 ${theme === 'bounceworld' ? 'border-[#1D428A] focus:ring-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7] focus:ring-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690] focus:ring-[#e13690]' : 'border-black focus:ring-[#64cc4f]'} rounded-3xl focus:ring-4 focus:border-black bg-white text-black font-bold text-lg placeholder-black/60`}
          />
        </div>
      </div>

      {/* Teacher Selected Videos Section */}
      {individualVideos.length > 0 && (
        <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 mb-8`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-black mb-2 flex items-center">
                <span className="text-3xl mr-3">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '🦄' : ''}</span>
                {theme === 'bounceworld' ? 'Coach Selected Videos for You' : theme === 'avengers' ? 'Hero Selected Videos for You' : theme === 'ponyville' ? 'Unicorn Selected Videos for You' : 'Teacher Selected Videos for You'}
             
              </h2>
              <p className={`font-bold ${theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#2C1267]' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-black'}`}>
                {theme === 'bounceworld' ? 'Special video recommendations from your coaches - slam dunk your learning! 🏀' : theme === 'avengers' ? 'Special video recommendations from your heroes - assemble your learning! 🦸‍♂️' : theme === 'ponyville' ? 'Special video recommendations from your unicorns - transform your learning with magic! 🦄' : 'Special video recommendations from your teachers'}
              </p>
            </div>
            <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-r from-gray-400 to-gray-600'} rounded-full px-4 py-2 border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'}`}>
              <span className="text-white font-black text-sm">
                {individualVideos.length}  Video{individualVideos.length > 1 ? 's' : ''} 
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {individualVideos.map((video) => (
              <div key={video.id} className={`bg-white rounded-2xl shadow-lg border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6 overflow-hidden relative`}>
                <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-black'}`}></div>
                <div className="flex flex-col h-full">
                  <div className="flex items-start space-x-4 mb-4">
                    <div className="flex-shrink-0">
                      <div className={`w-16 h-12 ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-400 to-green-500' : theme === 'bounceworld' ? 'bg-gradient-to-br from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-br from-gray-400 to-gray-600'} rounded-xl flex items-center justify-center border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} shadow-md`}>
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
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border ${theme === 'bounceworld' ? 'bg-[#C8102E] text-white border-[#1D428A]' : theme === 'avengers' ? 'bg-[#2C1267] text-white border-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690] text-white border-[#ff2e9f]' : 'bg-green-100 text-green-800 border-green-300'}`}>
                        {video.subjectName}
                      </span>
                    </div>
                  </div>

                  <div className={`mt-auto pt-4 border-t-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`}>
                    <Link
                      href={`/student/video/${video.id}/watch`}
                      className={`w-full ${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826] hover:from-[#2C1267]/80 hover:via-[#604AC7]/80 hover:to-[#0F0826]/80' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'} text-white px-4 py-2 rounded-full font-bold text-sm transform hover:scale-105 transition-all border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} flex items-center justify-center space-x-2`}
                    >
                      <Play className="w-4 h-4" />
                      <span>{theme === 'bounceworld' ? 'Watch Now' : theme === 'avengers' ? ' Watch Now' : theme === 'ponyville' ? ' Watch Now' : 'Watch Now'}</span>
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
          <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#b2e05b] via-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-200 via-green-400 to-yellow-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : 'bg-gradient-to-r from-blue-200 via-indigo-400 to-slate-400'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-12 text-center`}>
            <div className="text-6xl mb-6">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '🦄' : ''}</div>
            <h3 className="text-2xl font-black text-black mb-4">
              {searchTerm ? (theme === 'bounceworld' ? 'No Video Classes Found' : theme === 'avengers' ? 'No Hero Classes Found' : theme === 'ponyville' ? 'No Magical Video Classes Found' : 'No Hero Classes Found') : (theme === 'bounceworld' ? 'No Classes Available Yet' : theme === 'avengers' ? 'No Classes Available Yet - Time to Assemble!' : theme === 'ponyville' ? 'No Classes Available Yet - Time to Transform!' : 'No Classes Available Yet')}
            </h3>
            <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-[#222222]' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-slate-100'}`}>
              {searchTerm
                ? (theme === 'bounceworld' ? 'Try adjusting your search to find your video classes!' : theme === 'avengers' ? 'Try adjusting your search to find your hero classes!' : theme === 'ponyville' ? 'Try adjusting your search to find your magical video classes!' : 'Try adjusting your search to find your hero classes!')
                : (theme === 'bounceworld' ? 'You haven\'t enrolled in any classes yet. Time to start your video learning journey and slam dunk those assignments! 🏀' : theme === 'avengers' ? 'You haven\'t enrolled in any classes yet. Time to assemble your team and start your hero learning journey! 🦸‍♂️' : theme === 'ponyville' ? 'You haven\'t enrolled in any classes yet. Time to transform your learning with magical unicorn videos! 🦄' : 'You haven\'t enrolled in any classes yet. Time to start your hero learning journey!')
              }
            </p>
          </div>
        ) : (
          <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-6`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredClasses().map((classInfo) => (
                <ClassCard
                  key={classInfo.id}
                  classInfo={classInfo}
                  theme={theme}
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
  theme: 'default' | 'ben10' | 'tinkerbell' | 'cricketverse' | 'bounceworld' | 'avengers' | 'ponyville';
}

const ClassCard: React.FC<ClassCardProps> = ({ classInfo, theme }) => {
  return (
    <Link href={`/student/classes/${classInfo.id}/videos`}>
      <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 via-green-400 to-yellow-400' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-600 via-indigo-700 to-slate-800' : theme === 'bounceworld' ? 'bg-gradient-to-r from-white via-[#1D428A]/10 to-[#C8102E]/10' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : 'bg-gradient-to-r from-gray-100 to-gray-200'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} overflow-hidden hover:scale-105 transition-all cursor-pointer`}>
        {/* Class Header */}
        <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#2c6508]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 to-indigo-600' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] to-[#4F2C8D]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-r from-gray-400 to-gray-600'} text-white p-6 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-black truncate mb-2">
                {classInfo.name}
              </h3>
              <p className={`text-lg font-bold ${theme === 'ben10' ? 'text-[#222222]' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : 'text-gray-700'}`}>
                {classInfo.subject} • Grade {classInfo.grade}
              </p>
            </div>
   
          </div>
        </div>

        {/* Class Info */}
        <div className="bg-white p-6">
          <div className="space-y-4">
            <div className="flex items-center text-black font-bold">
              <span className="text-2xl mr-3">{theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '📚' : '👨‍🏫'}</span>
              <span className="truncate">{theme === 'bounceworld' ? `Coach ${classInfo.teacherName}` : theme === 'avengers' ? `Hero ${classInfo.teacherName}` : theme === 'ponyville' ? `Teacher ${classInfo.teacherName}` : classInfo.teacherName}</span>
            </div>

            <div className="flex items-start text-black font-bold">
              <span className="text-2xl mr-3 mt-1">{theme === 'bounceworld' ? '🎥' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '✨' : '📚'}</span>
              <span className="line-clamp-2 break-words overflow-hidden">
                {classInfo.description && classInfo.description.length > 100
                  ? `${classInfo.description.substring(0, 100)}...`
                  : classInfo.description || (theme === 'bounceworld' ? 'Explore video content and slam dunk your learning! 🏀' : theme === 'avengers' ? 'Explore hero video content and assemble your knowledge! 🦸‍♂️' : theme === 'ponyville' ? 'Explore magical video content and transform your knowledge with unicorn magic! 🦄' : 'Explore hero video content for this class')
                }
              </span>
            </div>

            <div className={`pt-4 border-t-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'}`}>
              <div className="flex items-center justify-between">
                <span className="text-black font-bold">
                  {theme === 'bounceworld' ? 'Browse Videos' : 'Browse Videos'}
                </span>
                <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]' : 'bg-gradient-to-r from-blue-600 to-indigo-700'} text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : 'border-black'} flex items-center space-x-2`}>
                  <Play className="w-4 h-4" />
                  <span>{theme === 'bounceworld' ? 'Open' : theme === 'avengers' ? 'Open' : theme === 'ponyville' ? 'Open' : 'Open'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
