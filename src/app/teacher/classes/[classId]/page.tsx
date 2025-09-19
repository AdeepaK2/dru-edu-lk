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
import { ClassScheduleFirestoreService } from '@/apiservices/classScheduleFirestoreService';
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
import { StudyMaterialDisplayData, StudyMaterialData } from '@/models/studyMaterialSchema';
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
  const [autoScheduleLoading, setAutoScheduleLoading] = useState(false);

  // Auto-schedule classes for next week
  const autoScheduleClasses = async (classDoc: ClassDocument) => {
    try {
      setAutoScheduleLoading(true);
      console.log('🔄 Auto-scheduling classes for next week...', classDoc.name);
      
      // Check if class has a schedule configured
      if (!classDoc.schedule || classDoc.schedule.length === 0) {
        console.log('⚠️ No schedule configured for this class, skipping auto-scheduling');
        return;
      }
      
      // Auto-schedule for the next 7 days
      const scheduledCount = await ClassScheduleFirestoreService.autoScheduleForClass(classDoc, 7);
      
      if (scheduledCount > 0) {
        console.log(`✅ Auto-scheduled ${scheduledCount} classes for next week`);
      } else {
        console.log('ℹ️ No new classes needed to be scheduled (already scheduled or no schedule configured)');
      }
    } catch (error) {
      console.error('❌ Error auto-scheduling classes:', error);
      // Don't show error to user as this is a background operation
    } finally {
      setAutoScheduleLoading(false);
    }
  };

  // Load class data
  useEffect(() => {
    const loadClassData = async () => {
      try {
        setLoading(true);
        const classDoc = await ClassFirestoreService.getClassById(classId);
        if (classDoc) {
          setClassData(classDoc);
          console.log('🔍 Page Debug: Class data loaded:', classDoc);
          console.log('🔍 Page Debug: Teacher ID:', classDoc.teacherId);
          console.log('🔍 Page Debug: Class Name:', classDoc.name);
          
          // Auto-schedule classes for next week if needed
          autoScheduleClasses(classDoc);
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
                {autoScheduleLoading && (
                  <div className="flex items-center space-x-2 text-blue-200 bg-blue-500/20 px-3 py-1 rounded-full">
                    <div className="w-3 h-3 border border-blue-200 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs">Auto-scheduling classes...</span>
                  </div>
                )}
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
                classData={classData}
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
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [newFilesToAdd, setNewFilesToAdd] = useState<any[]>([]);
  const [filesToRemove, setFilesToRemove] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const handleEditMaterial = (material: any, group?: any) => {
    if (group?.isGroup && group?.materials?.length > 1) {
      // Editing a group
      setEditingGroup({
        ...group,
        groupId: group.materials[0]?.groupId || group.id // Ensure we have the actual groupId
      });
      setMaterialToEdit({
        id: group.id,
        title: group.groupTitle || group.title,
        description: group.materials[0]?.description || '',
        isRequired: group.isRequired || false,
        lessonId: group.lessonId,
        groupId: group.materials[0]?.groupId || group.id,
        materials: group.materials
      });
    } else {
      // Editing single material
      setEditingGroup(null);
      setMaterialToEdit({
        ...material,
        title: material.title || '',
        description: material.description || '',
        isRequired: material.isRequired || false
      });
    }
    setNewFilesToAdd([]);
    setFilesToRemove([]);
    setUploadProgress(0);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (editedData: any) => {
    if (!materialToEdit) return;
    
    try {
      setEditLoading(true);
      
      // Declare groupId and groupTitle outside the loop
      let groupId: string | undefined;
      let groupTitle: string | undefined;
      
      // Step 1: Upload new files if any
      if (newFilesToAdd.length > 0) {
        console.log('📤 Uploading new files:', newFilesToAdd.length);
        const { StudyMaterialStorageService } = await import('@/apiservices/studyMaterialStorageService');
        const { createStudyMaterial } = await import('@/apiservices/studyMaterialFirestoreService');
        
        let uploadedCount = 0;
        const totalFiles = newFilesToAdd.length;
        
        for (const fileItem of newFilesToAdd) {
          try {
            let fileUrl = '';
            let fileName = '';
            let fileSize = 0;
            let mimeType = '';
            
            if (fileItem.fileType === 'link') {
              fileUrl = fileItem.externalUrl;
              fileName = fileItem.title;
              fileSize = 0;
              mimeType = 'text/html';
            } else if (fileItem.file) {
              console.log(`📤 Uploading file: ${fileItem.file.name}`);
              
              const uploadResult = await StudyMaterialStorageService.uploadStudyMaterial(
                fileItem.file,
                classData!.id,
                materialToEdit.id
              );
              
              fileUrl = uploadResult as string;
              fileName = fileItem.file.name;
              fileSize = fileItem.file.size;
              mimeType = fileItem.file.type;
            }
            
            // Use same groupId if editing a group, or create new group if adding to single
            
            console.log('🔍 Debug groupId assignment:', {
              editingGroup: !!editingGroup,
              editingGroupGroupId: editingGroup?.groupId,
              editingGroupIsGroup: editingGroup?.isGroup,
              materialToEditMaterials: !!materialToEdit.materials,
              firstMaterialGroupId: editingGroup?.materials?.[0]?.groupId,
              newFilesToAddLength: newFilesToAdd.length
            });
            
            if (editingGroup && editingGroup.isGroup && editingGroup.groupId) {
              // When editing a real group (has groupId), use the existing groupId
              groupId = editingGroup.groupId;
              groupTitle = editingGroup.groupTitle || editedData.title;
              console.log('📦 Using existing real group:', { groupId, groupTitle });
            } else if (editingGroup && !editingGroup.isGroup && newFilesToAdd.length > 0) {
              // When editing a single material (fake group) and adding files, create a new group
              groupId = `group_${Date.now()}`;
              groupTitle = editedData.title;
              console.log('📦 Converting single to group:', { groupId, groupTitle });
            } else if (materialToEdit.materials && materialToEdit.materials.length > 0 && materialToEdit.groupId) {
              // Fallback: use groupId from materialToEdit if it has materials and groupId
              groupId = materialToEdit.groupId;
              groupTitle = materialToEdit.title;
              console.log('📦 Using material group:', { groupId, groupTitle });
            } else if (newFilesToAdd.length > 1) {
              // Creating a new group when adding multiple files
              groupId = `group_${Date.now()}`;
              groupTitle = editedData.title;
              console.log('📦 Creating new group for multiple files:', { groupId, groupTitle });
            } else {
              // Single material - no group
              groupId = undefined;
              groupTitle = undefined;
              console.log('📦 Single material, no group');
            }
            
            // Create new material in the same group
            const materialData: StudyMaterialData = {
              title: fileItem.title || fileName.split('.')[0],
              description: editedData.description,
              classId: classData!.id,
              subjectId: classData!.subjectId,
              teacherId: classData!.teacherId || '',
              lessonId: materialToEdit.lessonId,
              groupId,
              groupTitle,
              week: 1,
              weekTitle: 'By Lesson',
              year: new Date().getFullYear(),
              fileUrl,
              fileName,
              fileSize,
              fileType: fileItem.fileType,
              mimeType,
              externalUrl: fileItem.fileType === 'link' ? fileItem.externalUrl : undefined,
              isRequired: fileItem.isRequired,
              isVisible: true,
              order: 0,
              tags: fileItem.tags || [],
              uploadedAt: new Date(),
              viewCount: 0
            };
            
            await createStudyMaterial(materialData);
            uploadedCount++;
            setUploadProgress((uploadedCount / totalFiles) * 100);
            console.log(`✅ Uploaded ${uploadedCount}/${totalFiles} files`);
            
          } catch (error) {
            console.error('Error uploading file:', fileItem.title, error);
          }
        }
      }
      
      // Step 2: Remove selected files
      if (filesToRemove.length > 0) {
        console.log('🗑️ Removing files:', filesToRemove);
        for (const materialId of filesToRemove) {
          try {
            await deleteStudyMaterial(materialId);
            console.log('✅ Removed material:', materialId);
          } catch (error) {
            console.error('Error removing material:', materialId, error);
          }
        }
      }
      
      // Step 3: Update main material properties
      if (editingGroup && editingGroup.isGroup) {
        // For real groups, update the group properties by updating the first material
        const firstMaterial = materialToEdit.materials[0];
        if (firstMaterial && !filesToRemove.includes(firstMaterial.id)) {
          await updateStudyMaterial(firstMaterial.id, {
            groupTitle: editedData.title,
            description: editedData.description,
            isRequired: editedData.isRequired
          });
        }
      } else if (editingGroup && !editingGroup.isGroup && newFilesToAdd.length > 0) {
        // Converting single material to group - update the original material to have groupId
        const originalMaterial = materialToEdit.materials[0];
        if (originalMaterial && !filesToRemove.includes(originalMaterial.id)) {
          await updateStudyMaterial(originalMaterial.id, {
            groupId: groupId,
            groupTitle: editedData.title,
            title: editedData.title, // Also update the title
            description: editedData.description,
            isRequired: editedData.isRequired
          });
        }
      } else {
        // For single materials, update normally
        await updateStudyMaterial(materialToEdit.id, {
          title: editedData.title,
          description: editedData.description,
          isRequired: editedData.isRequired
        });
      }
      
      await refreshMaterials();
      setShowEditModal(false);
      setMaterialToEdit(null);
      setEditingGroup(null);
      setNewFilesToAdd([]);
      setFilesToRemove([]);
      setUploadProgress(0);
      
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
                      {/* Show description if available (for both groups and single files) */}
                      {(group.materials[0]?.description) && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {group.materials[0].description}
                        </div>
                      )}
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
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditMaterial(
                        group.materials[0], 
                        group.isGroup ? group : null
                      )}
                      className="flex items-center space-x-1"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingGroup ? 'Edit Material Group' : 'Edit Study Material'}
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setMaterialToEdit(null);
                  setEditingGroup(null);
                  setNewFilesToAdd([]);
                  setFilesToRemove([]);
                }}
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
                className="p-6 space-y-6"
              >
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">Basic Information</h4>
                  
                  {/* Material Info */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        {editingGroup ? (
                          <div className="text-blue-600 font-bold text-xs">
                            {materialToEdit.materials?.length || 0}
                          </div>
                        ) : (
                          getFileIcon(materialToEdit.fileType || 'other')
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          {editingGroup ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                              GROUP ({materialToEdit.materials?.length || 0} files)
                            </span>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFileTypeColor(materialToEdit.fileType || 'other')}`}>
                              {(materialToEdit.fileType || 'FILE').toUpperCase()}
                            </span>
                          )}
                          {materialToEdit.lessonId && (
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              📚 {getLessonBadge(materialToEdit.lessonId)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {materialToEdit.formattedFileSize || 'Multiple files'} • Uploaded {materialToEdit.relativeUploadTime || 'recently'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Title Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {editingGroup ? 'Group Title' : 'Title'} *
                    </label>
                    <input
                      type="text"
                      name="title"
                      defaultValue={materialToEdit.title}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder={editingGroup ? "Enter group title" : "Enter material title"}
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
                </div>

                {/* Current Files Section */}
                {(editingGroup || materialToEdit.materials) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white">Current Files</h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {(materialToEdit.materials?.length || 1) - filesToRemove.length} files
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(materialToEdit.materials || [materialToEdit]).map((material: any) => (
                        <div 
                          key={material.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            filesToRemove.includes(material.id)
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 opacity-50'
                              : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 border">
                              {getFileIcon(material.fileType)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium truncate ${filesToRemove.includes(material.id) ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                {material.title}
                              </div>
                              {material.description && (
                                <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                  {material.description}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {material.formattedFileSize || '2.3 MB'} • {(material.fileType || 'FILE').toUpperCase()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {material.fileType === 'link' ? (
                              <Button 
                                type="button"
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(material.externalUrl || material.fileUrl, '_blank')}
                                disabled={filesToRemove.includes(material.id)}
                                className="flex items-center space-x-1"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button 
                                type="button"
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  if (material.fileUrl) {
                                    const link = document.createElement('a');
                                    link.href = material.fileUrl;
                                    link.download = material.fileName || material.title;
                                    link.click();
                                  }
                                }}
                                disabled={filesToRemove.includes(material.id)}
                                className="flex items-center space-x-1"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                if (filesToRemove.includes(material.id)) {
                                  setFilesToRemove(prev => prev.filter(id => id !== material.id));
                                } else {
                                  setFilesToRemove(prev => [...prev, material.id]);
                                }
                              }}
                              className={`flex items-center space-x-1 ${
                                filesToRemove.includes(material.id)
                                  ? 'bg-green-50 text-green-600 border-green-300 hover:bg-green-100'
                                  : 'text-red-600 hover:text-red-700 hover:border-red-300'
                              }`}
                            >
                              {filesToRemove.includes(material.id) ? (
                                <>
                                  <Plus className="w-4 h-4" />
                                  <span className="hidden sm:inline">Keep</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4" />
                                  <span className="hidden sm:inline">Remove</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add New Files Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-white">Add New Files</h4>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.multiple = true;
                          input.accept = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.mp4,.mov,.avi';
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (files) {
                              Array.from(files).forEach(file => {
                                let fileType: 'pdf' | 'video' | 'image' | 'link' | 'other' = 'other';
                                if (file.type.includes('pdf')) fileType = 'pdf';
                                else if (file.type.startsWith('video/')) fileType = 'video';
                                else if (file.type.startsWith('image/')) fileType = 'image';

                                setNewFilesToAdd(prev => [...prev, {
                                  id: `new_${Date.now()}_${Math.random()}`,
                                  file,
                                  title: file.name.split('.')[0],
                                  fileType,
                                  isRequired: false,
                                  tags: []
                                }]);
                              });
                            }
                          };
                          input.click();
                        }}
                        className="flex items-center space-x-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Files</span>
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewFilesToAdd(prev => [...prev, {
                            id: `link_${Date.now()}_${Math.random()}`,
                            title: '',
                            fileType: 'link',
                            externalUrl: '',
                            isRequired: false,
                            tags: []
                          }]);
                        }}
                        className="flex items-center space-x-2"
                      >
                        <Link className="w-4 h-4" />
                        <span>Add Link</span>
                      </Button>
                    </div>
                  </div>

                  {newFilesToAdd.length > 0 && (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {newFilesToAdd.map((fileItem, index) => (
                        <div key={fileItem.id} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              {getFileIcon(fileItem.fileType)}
                            </div>
                            
                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Title *
                                  </label>
                                  <input
                                    type="text"
                                    value={fileItem.title}
                                    onChange={(e) => {
                                      setNewFilesToAdd(prev => prev.map(item => 
                                        item.id === fileItem.id ? { ...item, title: e.target.value } : item
                                      ));
                                    }}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    placeholder="Enter title"
                                  />
                                </div>
                                
                                {fileItem.fileType === 'link' && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      URL *
                                    </label>
                                    <input
                                      type="url"
                                      value={fileItem.externalUrl || ''}
                                      onChange={(e) => {
                                        setNewFilesToAdd(prev => prev.map(item => 
                                          item.id === fileItem.id ? { ...item, externalUrl: e.target.value } : item
                                        ));
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                      placeholder="https://example.com"
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`required_${fileItem.id}`}
                                    checked={fileItem.isRequired}
                                    onChange={(e) => {
                                      setNewFilesToAdd(prev => prev.map(item => 
                                        item.id === fileItem.id ? { ...item, isRequired: e.target.checked } : item
                                      ));
                                    }}
                                    className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <label htmlFor={`required_${fileItem.id}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Required
                                  </label>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">
                                    {fileItem.file ? `${(fileItem.file.size / 1024 / 1024).toFixed(1)} MB` : 'External Link'}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setNewFilesToAdd(prev => prev.filter(item => item.id !== fileItem.id));
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {newFilesToAdd.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No new files to add
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Use the buttons above to add files or links
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Progress */}
                {editLoading && uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Uploading files...</span>
                      <span className="text-gray-600 dark:text-gray-300">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Current Stats */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Current Statistics</h4>
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
            <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filesToRemove.length > 0 && (
                  <span className="text-red-600">
                    {filesToRemove.length} file(s) will be removed
                  </span>
                )}
                {filesToRemove.length > 0 && newFilesToAdd.length > 0 && ' • '}
                {newFilesToAdd.length > 0 && (
                  <span className="text-green-600">
                    {newFilesToAdd.length} file(s) will be added
                  </span>
                )}
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setMaterialToEdit(null);
                    setEditingGroup(null);
                    setNewFilesToAdd([]);
                    setFilesToRemove([]);
                  }}
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
                      {uploadProgress > 0 ? 'Uploading...' : 'Updating...'}
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
  enrollments,
  classData
}: { 
  classId: string; 
  enrollments: any[];
  classData: any;
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
        <Message 
          classId={classId} 
          enrollments={enrollments}
          classData={classData}
        />
      )}
      
      {selectedMode === 'mail' && (
        <Mail 
          classId={classId} 
          enrollments={enrollments}
          classData={classData}
        />
      )}
    </div>
  );
}
