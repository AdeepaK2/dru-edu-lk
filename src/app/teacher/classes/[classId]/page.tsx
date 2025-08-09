'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  BookOpen, 
  FileText, 
  GraduationCap, 
  Users, 
  Calendar,
  Clock,
  Award,
  Plus,
  Upload,
  Edit,
  Trash2,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  Link,
  PlayCircle,
  FileIcon,
  ExternalLink
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { Button } from '@/components/ui';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { 
  getStudyMaterialsByClassGroupedByWeek,
  getStudyMaterialsByClassGroupedByLesson,
  convertToDisplayData,
  markMaterialCompleted,
  unmarkMaterialCompleted,
  incrementViewCount,
  incrementDownloadCount
} from '@/apiservices/studyMaterialFirestoreService';
import { StudyMaterialDisplayData } from '@/models/studyMaterialSchema';
import StudyMaterialUploadModal from '@/components/modals/StudyMaterialUploadModal';

interface TabData {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  count?: number;
}

export default function ClassDetails() {
  const params = useParams();
  const classId = params.classId as string;
  
  const [activeTab, setActiveTab] = useState('study-materials');
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);
  const [materialsCount, setMaterialsCount] = useState<number>(0);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  // Load class data
  useEffect(() => {
    const loadClassData = async () => {
      try {
        setLoading(true);
        const classDoc = await ClassFirestoreService.getClassById(classId);
        if (classDoc) {
          setClassData(classDoc);
        } else {
          setError('Class not found');
        }
      } catch (err) {
        console.error('Error loading class:', err);
        setError('Failed to load class data');
      } finally {
        setLoading(false);
      }
    };

    if (classId) {
      loadClassData();
    }
  }, [classId]);

  // Load enrollments data
  useEffect(() => {
    const loadEnrollments = async () => {
      try {
        setEnrollmentsLoading(true);
        const enrollmentData = await getEnrollmentsByClass(classId);
        setEnrollments(enrollmentData);
      } catch (err) {
        console.error('Error loading enrollments:', err);
        // Don't set error state for enrollments, just log it
      } finally {
        setEnrollmentsLoading(false);
      }
    };

    if (classId) {
      loadEnrollments();
    }
  }, [classId]);

  // Load materials count
  useEffect(() => {
    const loadMaterialsCount = async () => {
      try {
        setMaterialsLoading(true);
        const currentYear = new Date().getFullYear();
        const materialsData = await getStudyMaterialsByClassGroupedByWeek(classId, currentYear);
        const totalCount = materialsData.reduce((sum, week) => sum + week.materials.length, 0);
        setMaterialsCount(totalCount);
      } catch (err) {
        console.error('Error loading materials count:', err);
        // Don't set error state for materials count, just log it
      } finally {
        setMaterialsLoading(false);
      }
    };

    if (classId) {
      loadMaterialsCount();
    }
  }, [classId]);

  const tabs: TabData[] = [
    {
      id: 'study-materials',
      label: 'Study Materials',
      icon: BookOpen,
      count: materialsLoading ? undefined : materialsCount
    },
    {
      id: 'students',
      label: 'Students',
      icon: Users,
      count: enrollmentsLoading ? undefined : enrollments.length
    }
  ];

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading class details...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (error) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Class</h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Class Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {classData?.name || 'Class Details'}
              </h1>
              <div className="flex items-center space-x-6 text-blue-100">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>
                    {enrollmentsLoading ? '...' : enrollments.length} Students
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{classData?.subject || 'Subject'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{classData?.year || 'Year'}</span>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="w-16 h-16 bg-blue-400/30 rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        isActive 
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'study-materials' && <StudyMaterialsTab classId={classId} />}
            {activeTab === 'students' && (
              <StudentsTab 
                classId={classId} 
                enrollments={enrollments} 
                loading={enrollmentsLoading} 
              />
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

// Study Materials Tab Component
function StudyMaterialsTab({ classId }: { classId: string }) {
  const [studyMaterials, setStudyMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>(undefined);
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [lessons, setLessons] = useState<any[]>([]); // Store lessons for badge display

  // Load class data and lessons
  useEffect(() => {
    const loadClassData = async () => {
      try {
        const data = await ClassFirestoreService.getClassById(classId);
        setClassData(data);
        
        // Load lessons for badge display
        if (data?.subjectId) {
          const { LessonFirestoreService } = await import('@/apiservices/lessonFirestoreService');
          const lessonData = await LessonFirestoreService.getLessonsBySubject(data.subjectId);
          setLessons(lessonData);
        }
      } catch (err) {
        console.error('Error loading class data:', err);
      }
    };

    if (classId) {
      loadClassData();
    }
  }, [classId]);

  // Load study materials
  useEffect(() => {
    const loadStudyMaterials = async () => {
      try {
        setLoading(true);
        const currentYear = new Date().getFullYear();
        // Get materials in chronological order instead of grouped by lesson
        const materialsData = await getStudyMaterialsByClassGroupedByWeek(classId, currentYear);
        // Flatten and sort by upload date
        const allMaterials = materialsData.flatMap(week => week.materials)
          .sort((a, b) => {
            const dateA = a.uploadedAt instanceof Date ? a.uploadedAt : a.uploadedAt.toDate();
            const dateB = b.uploadedAt instanceof Date ? b.uploadedAt : b.uploadedAt.toDate();
            return dateB.getTime() - dateA.getTime();
          });
        setStudyMaterials(allMaterials);
      } catch (err) {
        console.error('Error loading study materials:', err);
        setError('Failed to load study materials');
      } finally {
        setLoading(false);
      }
    };

    if (classId) {
      loadStudyMaterials();
    }
  }, [classId]);

  // Refresh materials after upload
  const refreshMaterials = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const materialsData = await getStudyMaterialsByClassGroupedByWeek(classId, currentYear);
      // Flatten and sort by upload date
      const allMaterials = materialsData.flatMap(week => week.materials)
        .sort((a, b) => {
          const dateA = a.uploadedAt instanceof Date ? a.uploadedAt : a.uploadedAt.toDate();
          const dateB = b.uploadedAt instanceof Date ? b.uploadedAt : b.uploadedAt.toDate();
          return dateB.getTime() - dateA.getTime();
        });
      setStudyMaterials(allMaterials);
    } catch (err) {
      console.error('Error refreshing study materials:', err);
    }
  };

  const handleUploadSuccess = () => {
    refreshMaterials();
    setShowUploadModal(false);
    setSelectedLessonId(undefined);
  };

  const openUploadModal = (lessonId?: string) => {
    setSelectedLessonId(lessonId);
    setShowUploadModal(true);
  };

  const getLessonBadge = (lessonId?: string) => {
    if (!lessonId) return 'General';
    const lesson = lessons.find(l => l.id === lessonId);
    return lesson ? lesson.name : 'Unknown Lesson';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'video': case 'mp4': case 'avi': return <PlayCircle className="w-5 h-5 text-purple-500" />;
      case 'link': return <ExternalLink className="w-5 h-5 text-blue-500" />;
      case 'image': case 'jpg': case 'png': return <FileIcon className="w-5 h-5 text-green-500" />;
      default: return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getFileTypeColor = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'video': case 'mp4': case 'avi': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'link': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'image': case 'jpg': case 'png': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading study materials...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Materials</h3>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Study Materials
          </h3>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDFs</option>
              <option value="video">Videos</option>
              <option value="link">Links</option>
              <option value="required">Required Only</option>
            </select>
            <Button 
              className="flex items-center space-x-2"
              onClick={() => openUploadModal()}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Material</span>
            </Button>
          </div>
        </div>

      {/* Timeline View */}
      {studyMaterials.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Study Materials</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Get started by uploading your first study material.
          </p>
          <Button onClick={() => openUploadModal()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Material
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {studyMaterials.map((material: any, index: number) => (
            <div key={material.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getFileIcon(material.fileType || 'other')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                        {material.title || `Material ${index + 1}`}
                      </h5>
                      {material.lessonId && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                          📚 {getLessonBadge(material.lessonId)}
                        </span>
                      )}
                      {!material.lessonId && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          📂 General
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getFileTypeColor(material.fileType || 'other')}`}>
                        {(material.fileType || 'FILE').toUpperCase()}
                      </span>
                      {material.isRequired && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                          Required
                        </span>
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {material.formattedFileSize || '2.3 MB'} • {material.formattedDuration || 'No duration'}
                      </span>
                    </div>
                    {material.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                        {material.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-6 text-xs text-gray-500 dark:text-gray-400">
                      <span>{material.relativeUploadTime || '2 days ago'}</span>
                      <span>{material.downloadCount || 0} downloads</span>
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>{material.completedBy?.length || 0} completed</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2 flex-shrink-0">
                  {material.fileType === 'link' ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(material.externalUrl || material.fileUrl, '_blank')}
                      className="flex items-center space-x-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">Open Link</span>
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Upload Modal */}
      <StudyMaterialUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
        classData={classData || undefined}
        preSelectedLessonId={selectedLessonId}
      />
    </>
  );
}

// Students Tab Component
function StudentsTab({ 
  classId, 
  enrollments, 
  loading 
}: { 
  classId: string; 
  enrollments: StudentEnrollment[]; 
  loading: boolean; 
}) {
  const [searchTerm, setSearchTerm] = useState('');

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

  // Add mock stats for each student (TODO: Replace with real data)
  const studentsWithStats = enrollments.map(enrollment => ({
    ...enrollment,
    testResults: Math.floor(Math.random() * 15) + 5, // 5-20 tests
    videosWatched: Math.floor(Math.random() * 30) + 10, // 10-40 videos
    lastActivity: getRandomLastActivity(),
    averageGrade: Math.floor(Math.random() * 30) + 70, // 70-100%
  }));

  // Filter students based on search term
  const filteredStudents = studentsWithStats.filter(student =>
    student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {enrollments.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Students</p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <BookOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {enrollments.filter(s => s.status === 'Active').length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active Students</p>
        </div>
      </div>

      {/* Search and Add Student */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <Button className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </Button>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No students found' : 'No students enrolled'}
          </h4>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm 
              ? 'Try adjusting your search criteria' 
              : 'Add students to this class to get started.'
            }
          </p>
          {!searchTerm && (
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add First Student
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
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
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            {student.studentEmail}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="w-4 h-4 mr-2" />
                            Enrolled: {student.enrolledAt.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats section removed per user request */}

                  {/* Action Buttons - Removed per user request */}
                </div>

                {/* Mobile Stats - Removed per user request */}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
