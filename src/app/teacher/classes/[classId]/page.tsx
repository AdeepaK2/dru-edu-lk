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
  ExternalLink,
  UserCheck,
  X,
  MessageSquare,
  Send
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { Button } from '@/components/ui';
import Message from '@/components/teacher/Message';
import Mail from '@/components/teacher/Mail';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { 
  getStudyMaterialsByClassGroupedByWeek,
  getStudyMaterialsByClassGroupedByLesson,
  getStudyMaterialsByClassGrouped,
  convertToDisplayData,
  markMaterialCompleted,
  unmarkMaterialCompleted,
  incrementViewCount,
  incrementDownloadCount,
  deleteStudyMaterial,
  updateStudyMaterial
} from '@/apiservices/studyMaterialFirestoreService';
import { StudyMaterialDisplayData } from '@/models/studyMaterialSchema';
import StudyMaterialUploadModal from '@/components/modals/StudyMaterialUploadModal';
import AttendanceTab from '@/components/teacher/AttendanceTab';

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
        const groupedMaterials = await getStudyMaterialsByClassGrouped(classId);
        // Count individual files, not groups
        const totalCount = groupedMaterials.reduce((sum, group) => sum + group.totalFiles, 0);
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
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: Calendar,
      count: undefined
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      count: undefined
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
            {activeTab === 'attendance' && <AttendanceTab classData={classData} classId={classId} />}
            {activeTab === 'messages' && (
              <MessagesTab 
                classId={classId} 
                enrollments={enrollments} 
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
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

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

        // Load enrollments for completion tracking
        const enrollmentData = await getEnrollmentsByClass(classId);
        setEnrollments(enrollmentData);
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
        // Use the new grouped function for Google Classroom-like display
        const groupedMaterials = await getStudyMaterialsByClassGrouped(classId);
        setStudyMaterials(groupedMaterials);
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
      const groupedMaterials = await getStudyMaterialsByClassGrouped(classId);
      setStudyMaterials(groupedMaterials);
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

  const openCompletionModal = (material: any) => {
    setSelectedMaterial(material);
    setShowCompletionModal(true);
  };

  const getCompletionData = (material: any) => {
    const completedStudentIds = material.completedBy || [];
    const completed = enrollments.filter(enrollment => 
      completedStudentIds.includes(enrollment.studentId)
    );
    const notCompleted = enrollments.filter(enrollment => 
      !completedStudentIds.includes(enrollment.studentId)
    );
    
    return { completed, notCompleted };
  };

  const handleDeleteMaterial = (material: any) => {
    setMaterialToDelete(material);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!materialToDelete) return;
    
    try {
      setDeleteLoading(true);
      await deleteStudyMaterial(materialToDelete.id);
      await refreshMaterials();
      setShowDeleteConfirm(false);
      setMaterialToDelete(null);
    } catch (error) {
      console.error('Error deleting study material:', error);
      alert('Failed to delete study material. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditMaterial = (material: any) => {
    setMaterialToEdit({
      ...material,
      title: material.title || '',
      description: material.description || '',
      isRequired: material.isRequired || false
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (editedData: any) => {
    if (!materialToEdit) return;
    
    try {
      setEditLoading(true);
      await updateStudyMaterial(materialToEdit.id, {
        title: editedData.title,
        description: editedData.description,
        isRequired: editedData.isRequired
      });
      await refreshMaterials();
      setShowEditModal(false);
      setMaterialToEdit(null);
    } catch (error) {
      console.error('Error updating study material:', error);
      alert('Failed to update study material. Please try again.');
    } finally {
      setEditLoading(false);
    }
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
          {studyMaterials.map((group: any, index: number) => (
            <div key={group.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
              {/* Group Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      {group.isGroup ? (
                        <div className="text-blue-600 font-bold text-xs">
                          {group.totalFiles}
                        </div>
                      ) : (
                        getFileIcon(group.materials[0]?.fileType || 'other')
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                          {group.groupTitle || group.materials[0]?.title}
                        </h5>
                        {group.isGroup && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                            📁 {group.totalFiles} files
                          </span>
                        )}
                        {group.lessonId && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                            📚 {group.lessonName || getLessonBadge(group.lessonId)}
                          </span>
                        )}
                        {!group.lessonId && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            📂 General
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 mb-2">
                        {group.fileTypes.map((fileType: string) => (
                          <span key={fileType} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getFileTypeColor(fileType)}`}>
                            {fileType.toUpperCase()}
                          </span>
                        ))}
                        {group.isRequired && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-6 text-xs text-gray-500 dark:text-gray-400">
                        <span>{new Date(group.uploadedAt?.toDate ? group.uploadedAt.toDate() : group.uploadedAt).toLocaleDateString()}</span>
                        {group.totalDownloads > 0 && (
                          <span>{group.totalDownloads} downloads</span>
                        )}
                        <span>{group.completedBy.length} students completed</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openCompletionModal(group)}
                      className="flex items-center space-x-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">View Completion</span>
                    </Button>
                    {!group.isGroup && group.materials.length === 1 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditMaterial(group.materials[0])}
                        className="flex items-center space-x-1"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Files in Group */}
              <div className="p-6 space-y-3">
                {group.materials.map((material: any) => (
                  <div key={material.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 border">
                        {getFileIcon(material.fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {material.title}
                        </div>
                        {material.description && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
                            {material.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {material.formattedFileSize || '2.3 MB'}
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
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (material.fileUrl) {
                              const link = document.createElement('a');
                              link.href = material.fileUrl;
                              link.download = material.title || 'download';
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              incrementDownloadCount(material.id);
                            }
                          }}
                          className="flex items-center space-x-1"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditMaterial(material)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteMaterial(material)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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

      {/* Completion Details Modal */}
      {showCompletionModal && selectedMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Material Completion Status
              </h3>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Material Info */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {selectedMaterial.title}
                </h4>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                  <span className={`px-2 py-1 rounded-full text-xs ${getFileTypeColor(selectedMaterial.fileType || 'other')}`}>
                    {(selectedMaterial.fileType || 'FILE').toUpperCase()}
                  </span>
                  {selectedMaterial.lessonId && (
                    <span>📚 {getLessonBadge(selectedMaterial.lessonId)}</span>
                  )}
                </div>
              </div>

              {(() => {
                const { completed, notCompleted } = getCompletionData(selectedMaterial);
                
                return (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {completed.length}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          Completed
                        </div>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {notCompleted.length}
                        </div>
                        <div className="text-sm text-orange-700 dark:text-orange-300">
                          Not Completed
                        </div>
                      </div>
                    </div>

                    {/* Completed Students */}
                    {completed.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          Completed ({completed.length})
                        </h5>
                        <div className="space-y-2">
                          {completed.map((enrollment) => (
                            <div key={enrollment.id} className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                  {enrollment.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {enrollment.studentName}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  {enrollment.studentEmail}
                                </div>
                              </div>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Not Completed Students */}
                    {notCompleted.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                          <AlertCircle className="w-4 h-4 text-orange-500 mr-2" />
                          Not Completed ({notCompleted.length})
                        </h5>
                        <div className="space-y-2">
                          {notCompleted.map((enrollment) => (
                            <div key={enrollment.id} className="flex items-center space-x-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                  {enrollment.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {enrollment.studentName}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  {enrollment.studentEmail}
                                </div>
                              </div>
                              <AlertCircle className="w-5 h-5 text-orange-500" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {enrollments.length === 0 && (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No students enrolled in this class
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <Button 
                variant="outline"
                onClick={() => setShowCompletionModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && materialToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Study Material
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={deleteLoading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Are you sure you want to delete this material?
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    "{materialToDelete.title}"
                  </p>
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-red-800 dark:text-red-200 font-medium mb-1">
                      This action cannot be undone
                    </p>
                    <p className="text-red-700 dark:text-red-300">
                      This will permanently delete the study material and remove it from all students' access. 
                      Any completion data will also be lost.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p><span className="font-medium">Type:</span> {(materialToDelete.fileType || 'FILE').toUpperCase()}</p>
                <p><span className="font-medium">Completed by:</span> {materialToDelete.completedBy?.length || 0} students</p>
                {materialToDelete.lessonId && (
                  <p><span className="font-medium">Lesson:</span> {getLessonBadge(materialToDelete.lessonId)}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <Button 
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Material
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {showEditModal && materialToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Study Material
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={editLoading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleEditSubmit({
                    title: formData.get('title') as string,
                    description: formData.get('description') as string,
                    isRequired: formData.get('isRequired') === 'on'
                  });
                }}
                className="p-6 space-y-4"
              >
                {/* Material Info */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      {getFileIcon(materialToEdit.fileType || 'other')}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFileTypeColor(materialToEdit.fileType || 'other')}`}>
                          {(materialToEdit.fileType || 'FILE').toUpperCase()}
                        </span>
                        {materialToEdit.lessonId && (
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            📚 {getLessonBadge(materialToEdit.lessonId)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {materialToEdit.formattedFileSize || '2.3 MB'} • Uploaded {materialToEdit.relativeUploadTime || '2 days ago'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Title Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    defaultValue={materialToEdit.title}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter material title"
                  />
                </div>

                {/* Description Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={materialToEdit.description}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                    placeholder="Optional description"
                  />
                </div>

                {/* Required Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="isRequired"
                    id="isRequired"
                    defaultChecked={materialToEdit.isRequired}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isRequired" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mark as required material
                  </label>
                </div>

                {/* Current Stats */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Current Statistics</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Downloads:</span>
                      <span className="font-medium text-gray-900 dark:text-white ml-1">
                        {materialToEdit.downloadCount || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Completed:</span>
                      <span className="font-medium text-gray-900 dark:text-white ml-1">
                        {materialToEdit.completedBy?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer - Fixed */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={editLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.querySelector('form') as HTMLFormElement;
                  if (form) {
                    const formData = new FormData(form);
                    handleEditSubmit({
                      title: formData.get('title') as string,
                      description: formData.get('description') as string,
                      isRequired: formData.get('isRequired') === 'on'
                    });
                  }
                }}
              >
                {editLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Update Material
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
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
  const [studentsWithDetails, setStudentsWithDetails] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  // Load full student data with parent information
  useEffect(() => {
    const loadStudentsWithDetails = async () => {
      if (enrollments.length === 0) {
        setStudentsLoading(false);
        return;
      }

      try {
        setStudentsLoading(true);
        const { StudentFirestoreService } = await import('@/apiservices/studentFirestoreService');
        
        // Get full student documents for each enrollment
        const studentsPromises = enrollments.map(async (enrollment) => {
          try {
            const studentDoc = await StudentFirestoreService.getStudentById(enrollment.studentId);
            return {
              ...enrollment,
              parent: studentDoc?.parent || null,
              // Add mock stats (TODO: Replace with real data)
              testResults: Math.floor(Math.random() * 15) + 5,
              videosWatched: Math.floor(Math.random() * 30) + 10,
              lastActivity: getRandomLastActivity(),
              averageGrade: Math.floor(Math.random() * 30) + 70,
            };
          } catch (error) {
            console.error(`Failed to load student details for ${enrollment.studentId}:`, error);
            return {
              ...enrollment,
              parent: null,
              testResults: Math.floor(Math.random() * 15) + 5,
              videosWatched: Math.floor(Math.random() * 30) + 10,
              lastActivity: getRandomLastActivity(),
              averageGrade: Math.floor(Math.random() * 30) + 70,
            };
          }
        });

        const students = await Promise.all(studentsPromises);
        setStudentsWithDetails(students);
      } catch (error) {
        console.error('Error loading students with details:', error);
        // Fallback to enrollment data without parent info
        setStudentsWithDetails(enrollments.map(enrollment => ({
          ...enrollment,
          parent: null,
          testResults: Math.floor(Math.random() * 15) + 5,
          videosWatched: Math.floor(Math.random() * 30) + 10,
          lastActivity: getRandomLastActivity(),
          averageGrade: Math.floor(Math.random() * 30) + 70,
        })));
      } finally {
        setStudentsLoading(false);
      }
    };

    loadStudentsWithDetails();
  }, [enrollments]);

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

  // Filter students based on search term
  const filteredStudents = studentsWithDetails.filter(student =>
    student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.parent?.name && student.parent.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (student.parent?.email && student.parent.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading || studentsLoading) {
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
            placeholder="Search students or parents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
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
                          {student.studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
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
                          
                          {/* Parent Information */}
                          {student.parent && (
                            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Parent/Guardian Information:
                              </div>
                              <div className="space-y-1">
                                {student.parent.name && (
                                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    {student.parent.name}
                                  </div>
                                )}
                                {student.parent.email && (
                                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                    </svg>
                                    <a 
                                      href={`mailto:${student.parent.email}`}
                                      className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                    >
                                      {student.parent.email}
                                    </a>
                                  </div>
                                )}
                                {student.parent.phone && (
                                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                    </svg>
                                    <a 
                                      href={`tel:${student.parent.phone}`}
                                      className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                    >
                                      {student.parent.phone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
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

// Messages Tab Component
function MessagesTab({ 
  classId, 
  enrollments 
}: { 
  classId: string; 
  enrollments: any[]; 
}) {
  const [selectedMode, setSelectedMode] = useState<'message' | 'mail'>('message');

  return (
    <div className="space-y-6">
      {/* Large Mode Selector */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          onClick={() => setSelectedMode('message')}
          className={`flex-1 flex items-center justify-center space-x-3 px-6 py-4 rounded-md text-base font-medium transition-colors ${
            selectedMode === 'message'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Messages</span>
        </button>
        <button
          onClick={() => setSelectedMode('mail')}
          className={`flex-1 flex items-center justify-center space-x-3 px-6 py-4 rounded-md text-base font-medium transition-colors ${
            selectedMode === 'mail'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Send className="w-5 h-5" />
          <span>Email</span>
        </button>
      </div>

      {/* Conditional Content */}
      {selectedMode === 'message' && (
        <Message classId={classId} enrollments={enrollments} />
      )}
      
      {selectedMode === 'mail' && (
        <Mail classId={classId} enrollments={enrollments} />
      )}
    </div>
  );
}
