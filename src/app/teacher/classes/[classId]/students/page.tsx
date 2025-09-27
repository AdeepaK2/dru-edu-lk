'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users, 
  Search, 
  Eye, 
  BarChart3,
  VideoIcon,
  FileText,
  Calendar,
  Mail,
  Phone,
  ArrowLeft,
  AlertCircle,
  GraduationCap,
  TrendingUp,
  Clock,
  BookOpen,
  MessageSquare,
  Edit3,
  Plus
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import RemarkModal from '@/components/teacher/RemarkModal';
import Link from 'next/link';

// Import services and types
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { ClassDocument } from '@/models/classSchema';
import { 
  StudentRemark, 
  StudentRemarkData,
  getRemarkColor 
} from '@/models/studentRemarkSchema';
import { StudentRemarkFirestoreService } from '@/apiservices/studentRemarkFirestoreService';

interface StudentWithStats {
  id: string;
  studentId: string;
  classId: string;
  studentName: string;
  studentEmail: string;
  className: string;
  subject: string;
  enrolledAt: Date;
  status: 'Active' | 'Inactive' | 'Completed' | 'Dropped';
  grade?: number;
  attendance: number;
  notes?: string;
  testResults?: number;
  videosWatched?: number;
  lastActivity?: string;
  averageGrade?: number;
  remark?: StudentRemark;
}

export default function ClassStudents() {
  const params = useParams();
  const router = useRouter();
  const { teacher } = useTeacherAuth();
  const classId = params.classId as string;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [classInfo, setClassInfo] = useState<ClassDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remarkModal, setRemarkModal] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    existingRemark?: StudentRemark | null;
  }>({ isOpen: false, studentId: '', studentName: '' });
  const [savingRemark, setSavingRemark] = useState(false);

  // Load class info and students
  useEffect(() => {
    const loadClassAndStudents = async () => {
      if (!classId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Load class information
        const classDoc = await ClassFirestoreService.getClassById(classId);
        setClassInfo(classDoc);
        
        // Load enrolled students
        console.log('🔍 Loading students for class:', classId);
        const enrollments = await getEnrollmentsByClass(classId);
        console.log('✅ Found enrollments:', enrollments.length);
        
        // Load remarks for all students in this class
        const classRemarks = await StudentRemarkFirestoreService.getRemarksByClass(classId);
        console.log('✅ Found remarks:', classRemarks.length);
        
        // Create a map of student ID to remark
        const remarksMap = new Map<string, StudentRemark>();
        classRemarks.forEach(remark => {
          remarksMap.set(remark.studentId, remark);
        });
        
        // Add mock stats and remarks for each student
        const studentsWithStats: StudentWithStats[] = enrollments.map((enrollment: StudentEnrollment) => ({
          ...enrollment,
          testResults: Math.floor(Math.random() * 15) + 5, // 5-20 tests
          videosWatched: Math.floor(Math.random() * 30) + 10, // 10-40 videos
          lastActivity: getRandomLastActivity(),
          averageGrade: Math.floor(Math.random() * 30) + 70, // 70-100%
          remark: remarksMap.get(enrollment.studentId) || undefined,
        }));
        
        setStudents(studentsWithStats);
      } catch (err: any) {
        console.error('Error loading class students:', err);
        setError(err.message || 'Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    
    loadClassAndStudents();
  }, [classId]);

  // Helper function to generate random last activity
  const getRandomLastActivity = () => {
    const activities = [
      '2 hours ago',
      '1 day ago',
      '3 days ago',
      '1 week ago',
      '2 weeks ago'
    ];
    return activities[Math.floor(Math.random() * activities.length)];
  };

  // Handle opening remark modal
  const handleOpenRemarkModal = (student: StudentWithStats) => {
    setRemarkModal({
      isOpen: true,
      studentId: student.studentId,
      studentName: student.studentName,
      existingRemark: student.remark || null,
    });
  };

  // Handle closing remark modal
  const handleCloseRemarkModal = () => {
    setRemarkModal({ isOpen: false, studentId: '', studentName: '' });
  };

  // Handle saving remark
  const handleSaveRemark = async (remarkData: {
    remarkLevel: any;
    customRemark?: string;
    additionalNotes?: string;
    isVisible: boolean;
  }) => {
    if (!teacher || !classInfo) return;

    setSavingRemark(true);
    try {
      const currentStudent = students.find(s => s.studentId === remarkModal.studentId);
      if (!currentStudent) throw new Error('Student not found');

      const fullRemarkData: StudentRemarkData = {
        studentId: remarkModal.studentId,
        classId: classId,
        teacherId: teacher.id,
        studentName: remarkModal.studentName,
        className: classInfo.name,
        subject: classInfo.subject,
        remarkLevel: remarkData.remarkLevel,
        customRemark: remarkData.customRemark,
        additionalNotes: remarkData.additionalNotes,
        isVisible: remarkData.isVisible,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let remarkId: string;

      if (remarkModal.existingRemark) {
        // Update existing remark
        await StudentRemarkFirestoreService.updateRemark(
          remarkModal.existingRemark.id,
          fullRemarkData
        );
        remarkId = remarkModal.existingRemark.id;
      } else {
        // Create new remark
        remarkId = await StudentRemarkFirestoreService.createRemark(fullRemarkData);
      }

      // Update local state
      const updatedRemark: StudentRemark = {
        id: remarkId,
        ...fullRemarkData,
        createdAt: remarkModal.existingRemark?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      setStudents(prev => prev.map(student => 
        student.studentId === remarkModal.studentId
          ? { ...student, remark: updatedRemark }
          : student
      ));

      console.log('✅ Remark saved successfully');
    } catch (error: any) {
      console.error('❌ Error saving remark:', error);
      setError(error.message || 'Failed to save remark');
    } finally {
      setSavingRemark(false);
    }
  };

  // Filter students based on search term
  const filteredStudents = students.filter(student =>
    student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading students...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {classInfo?.name || 'Class'} - Students
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Manage enrolled students and view their progress
                </p>
              </div>
            </div>
            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {filteredStudents.length} Students
              </span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Class Info Summary */}
        {classInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {classInfo.year}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Year Level</p>
              </div>
              
              <div className="text-center">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <BookOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {classInfo.subject}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Subject</p>
              </div>
              
              <div className="text-center">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {students.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Enrolled</p>
              </div>
              
              <div className="text-center">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {students.length > 0 ? Math.round(students.reduce((acc, s) => acc + (s.averageGrade || 0), 0) / students.length) : 0}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Grade</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Students List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredStudents.map((student) => (
              <div key={student.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  {/* Student Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-lg">
                          {student.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      
                      {/* Student Details */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {student.studentName}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            student.status === 'Active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                          }`}>
                            {student.status}
                          </span>
                        </div>
                        
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <Mail className="w-4 h-4 mr-2" />
                            {student.studentEmail}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="w-4 h-4 mr-2" />
                            Enrolled: {student.enrolledAt.toLocaleDateString()}
                          </div>
                          {/* Remark Display */}
                          {student.remark && (
                            <div className="flex items-center text-sm">
                              <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRemarkColor(student.remark.remarkLevel)}`}>
                                {student.remark.remarkLevel === 'Custom' ? (student.remark.customRemark || student.remark.remarkLevel) : student.remark.remarkLevel}
                              </span>
                              {!student.remark.isVisible && (
                                <span className="ml-2 text-xs text-gray-400">(Hidden)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center space-x-8 mr-6">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {student.averageGrade}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg Grade</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {student.testResults}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tests</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {student.videosWatched}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Videos</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {student.lastActivity}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Last Active</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={student.remark ? "primary" : "outline"}
                      size="sm"
                      className="flex items-center space-x-1"
                      onClick={() => handleOpenRemarkModal(student)}
                    >
                      {student.remark ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      <span className="hidden sm:inline">
                        {student.remark ? 'Edit Remark' : 'Add Remark'}
                      </span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-1"
                      onClick={() => {
                        // TODO: Navigate to student results
                        alert('Student results view coming soon!');
                      }}
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Results</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-1"
                      onClick={() => {
                        // TODO: Navigate to videos watched
                        alert('Videos watched view coming soon!');
                      }}
                    >
                      <VideoIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Videos</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-1"
                      onClick={() => {
                        // TODO: Navigate to student profile
                        alert('Student profile view coming soon!');
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Profile</span>
                    </Button>
                  </div>
                </div>

                {/* Mobile Stats */}
                <div className="md:hidden mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {student.averageGrade}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Grade</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {student.testResults}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tests</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {student.videosWatched}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Videos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                      {student.lastActivity}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filteredStudents.length === 0 && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No students found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm 
                ? 'Try adjusting your search criteria' 
                : 'No students are enrolled in this class yet.'
              }
            </p>
            {!searchTerm && (
              <Button
                onClick={() => {
                  // TODO: Navigate to add student page
                  alert('Add student functionality coming soon!');
                }}
                className="flex items-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span>Add Student</span>
              </Button>
            )}
          </div>
        )}

        {/* Remark Modal */}
        {remarkModal.isOpen && classInfo && teacher && (
          <RemarkModal
            isOpen={remarkModal.isOpen}
            onClose={handleCloseRemarkModal}
            studentId={remarkModal.studentId}
            studentName={remarkModal.studentName}
            classId={classId}
            className={classInfo.name}
            subject={classInfo.subject}
            teacherId={teacher.id}
            existingRemark={remarkModal.existingRemark}
            onSave={handleSaveRemark}
            isSaving={savingRemark}
          />
        )}
      </div>
    </TeacherLayout>
  );
}
