'use client';

import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Upload, 
  Search, 
  Eye, 
  Edit2, 
  Trash2, 
  Plus,
  AlertCircle,
  Calendar,
  Play,
  Users,
  Filter,
  ChevronDown,
  ChevronRight,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import Link from 'next/link';

// Import services and types
import { VideoFirestoreService } from '@/apiservices/videoFirestoreService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { SubjectFirestoreService } from '@/apiservices/subjectFirestoreService';
import { VideoDocument, VideoDisplayData, videoDocumentToDisplay } from '@/models/videoSchema';

// Import modals
import TeacherVideoUploadModal from '@/components/modals/TeacherVideoUploadModal';
import VideoViewModal from '@/components/modals/VideoViewModal';
import VideoEditModal from '@/components/modals/VideoEditModal';
import StudentAssignmentModal from '@/components/modals/StudentAssignmentModal';

interface TeacherVideoData extends VideoDisplayData {
  assignedClassesCount: number;
  isOwner: boolean;
}

interface SubjectGroup {
  id: string;
  name: string;
  grade: string;
  videos: TeacherVideoData[];
  totalVideos: number;
  totalViews: number;
}

interface FilterState {
  selectedSubject: string;
  selectedClass: string;
  searchTerm: string;
}

export default function TeacherVideos() {
  const { teacher } = useTeacherAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [videos, setVideos] = useState<TeacherVideoData[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<TeacherVideoData | null>(null);
  const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grouped' | 'all'>('grouped');
  const [activeTab, setActiveTab] = useState<'main' | 'co'>('main');
  const [coClasses, setCoClasses] = useState<any[]>([]);
  const [coVideos, setCoVideos] = useState<TeacherVideoData[]>([]);
  const [coSubjectGroups, setCoSubjectGroups] = useState<SubjectGroup[]>([]);
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    selectedSubject: '',
    selectedClass: '',
    searchTerm: ''
  });

  // Load teacher's data
  useEffect(() => {
    const loadTeacherData = async () => {
      if (!teacher?.id) return;
      
      console.log('🔍 Teacher object in videos page:', teacher);
      console.log('🔍 Teacher ID:', teacher.id);
      console.log('🔍 Teacher subjects:', teacher.subjects);
      
      setLoading(true);
      setError(null);
      
      try {
        // Load teacher's classes and subjects
        const [classes, allSubjects] = await Promise.all([
          ClassFirestoreService.getClassesByTeacher(teacher.id),
          SubjectFirestoreService.getAllSubjects()
        ]);
        
        console.log('🔍 Teacher subject debugging:');
        console.log('🔍 Teacher subjects from auth:', teacher.subjects);
        console.log('🔍 All subjects from database:', allSubjects);
        console.log('🔍 Classes loaded:', classes);
        
        // Filter subjects for teacher - try multiple approaches
        let subjects: any[] = [];
        
        // Approach 1: Use teacher.subjects array (if available)
        if (teacher.subjects && teacher.subjects.length > 0) {
          subjects = allSubjects.filter(subject => 
            teacher.subjects?.includes(subject.name)
          );
          console.log('🔍 Method 1 - Filtered subjects by teacher.subjects:', subjects);
        }
        
        // Approach 2: If no subjects from teacher.subjects, derive from classes
        if (subjects.length === 0 && classes.length > 0) {
          const subjectNamesFromClasses = [...new Set(classes.map(cls => cls.subject))];
          subjects = allSubjects.filter(subject => 
            subjectNamesFromClasses.includes(subject.name)
          );
          console.log('🔍 Method 2 - Filtered subjects from classes:', subjects);
          console.log('🔍 Subject names from classes:', subjectNamesFromClasses);
        }
        
        // Approach 3: If still no subjects, give all subjects (fallback)
        if (subjects.length === 0) {
          console.log('🔍 Method 3 - Using all subjects as fallback');
          subjects = allSubjects;
        }
        
        // Convert subjects to the format expected by the modal (with grade)
        const formattedSubjects = subjects.map(subject => ({
          id: subject.id,
          name: `${subject.name} Grade ${subject.grade}`, // Include grade in display name
          originalName: subject.name, // Keep original name for filtering
          grade: subject.grade // Keep grade separate for reference
        }));
        
        // Convert classes to the format expected by the modal
        const formattedClasses = classes.map(cls => ({
          id: cls.id,
          name: cls.name,
          subjectId: cls.subjectId,
          subject: cls.subject
        }));
        
        console.log('🔍 Final subjects for teacher:', subjects);
        console.log('🔍 Formatted subjects for modal:', formattedSubjects);
        console.log('🔍 Original classes:', classes);
        console.log('🔍 Formatted classes for modal:', formattedClasses);
        
        setTeacherClasses(formattedClasses); // Use formatted classes
        setTeacherSubjects(formattedSubjects); // Use formatted subjects instead
        
        // Load teacher's videos
        const teacherVideos = await VideoFirestoreService.getVideosByTeacher(teacher.id);
        
        // Convert to display format with additional stats
        const videosWithStats = teacherVideos.map(video => {
          const displayData = videoDocumentToDisplay(video, {}, {}, teacher.name);
          return {
            ...displayData,
            assignedClassesCount: video.assignedClassIds?.length || 0,
            isOwner: true
          } as TeacherVideoData;
        });
        
        setVideos(videosWithStats);
        
        // Group videos by subjects
        const groupedData = groupVideosBySubjects(videosWithStats, formattedSubjects);
        setSubjectGroups(groupedData);
        
        // Load co-teacher classes and videos
        const coTeacherClasses = await ClassFirestoreService.getClassesByCoTeacher(teacher.id);
        console.log('✅ Raw co-teacher classes result:', coTeacherClasses);
        
        // Convert co-teacher classes to the format expected by the modal
        const formattedCoClasses = coTeacherClasses.map(cls => ({
          id: cls.id,
          name: cls.name,
          subjectId: cls.subjectId,
          subject: cls.subject
        }));
        
        setCoClasses(formattedCoClasses);
        
        // Get videos assigned to co-teacher classes
        if (coTeacherClasses.length > 0) {
          const coClassIds = coTeacherClasses.map(cls => cls.id);
          const allVideos = await VideoFirestoreService.getAllVideos();
          
          // Filter videos assigned to co-teacher classes
          const coTeacherVideos = allVideos.filter(video => 
            video.assignedClassIds?.some(classId => coClassIds.includes(classId))
          );
          
          console.log('✅ Videos assigned to co-teacher classes:', coTeacherVideos.length);
          
          // Convert to display format with additional stats
          const coVideosWithStats = coTeacherVideos.map(video => {
            const isOwner = video.teacherId === teacher.id;
            const displayData = videoDocumentToDisplay(video, {}, {}, isOwner ? teacher.name : 'Co-Teacher');
            return {
              ...displayData,
              assignedClassesCount: video.assignedClassIds?.length || 0,
              isOwner
            } as TeacherVideoData;
          });
          
          setCoVideos(coVideosWithStats);
          
          // Group co-videos by subjects
          const coGroupedData = groupVideosBySubjects(coVideosWithStats, formattedSubjects);
          setCoSubjectGroups(coGroupedData);
        }
        
        // Expand all subjects by default
        setExpandedSubjects(new Set(formattedSubjects.map(s => s.id)));
        
      } catch (err: any) {
        console.error('Error loading teacher data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadTeacherData();
  }, [teacher?.id, teacher?.subjects, teacher?.name]);

  // Group videos by subjects
  const groupVideosBySubjects = (videos: TeacherVideoData[], subjects: any[]): SubjectGroup[] => {
    const groups: SubjectGroup[] = [];
    
    subjects.forEach(subject => {
      const subjectVideos = videos.filter(video => video.subjectId === subject.id);
      const totalViews = subjectVideos.reduce((sum, video) => sum + (video.views || 0), 0);
      
      groups.push({
        id: subject.id,
        name: subject.originalName || subject.name,
        grade: subject.grade,
        videos: subjectVideos,
        totalVideos: subjectVideos.length,
        totalViews
      });
    });
    
    // Sort by number of videos (descending)
    return groups.sort((a, b) => b.totalVideos - a.totalVideos);
  };

  // Apply filters to videos
  const getFilteredVideos = () => {
    let filteredVideos = activeTab === 'main' ? videos : coVideos;
    
    // Filter by subject
    if (filters.selectedSubject) {
      filteredVideos = filteredVideos.filter(video => video.subjectId === filters.selectedSubject);
    }
    
    // Filter by class
    if (filters.selectedClass) {
      filteredVideos = filteredVideos.filter(video => 
        video.assignedClasses?.includes(filters.selectedClass) || false
      );
    }
    
    // Filter by search term
    if (filters.searchTerm) {
      filteredVideos = filteredVideos.filter(video =>
        video.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        video.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        video.subjectName.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }
    
    return filteredVideos;
  };

  // Apply filters to subject groups
  const getFilteredSubjectGroups = () => {
    if (!filters.selectedSubject && !filters.selectedClass && !filters.searchTerm) {
      return activeTab === 'main' ? subjectGroups : coSubjectGroups;
    }
    
    const filteredVideos = getFilteredVideos();
    return groupVideosBySubjects(filteredVideos, teacherSubjects);
  };

  // Toggle subject expansion
  const toggleSubjectExpansion = (subjectId: string) => {
    setExpandedSubjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subjectId)) {
        newSet.delete(subjectId);
      } else {
        newSet.add(subjectId);
      }
      return newSet;
    });
  };

  // Handle successful video upload
  const handleVideoUploaded = () => {
    setShowUploadModal(false);
    setSelectedSubjectForUpload(null);
    // Reload videos
    const loadVideos = async () => {
      if (!teacher?.id) return;
      try {
        const teacherVideos = await VideoFirestoreService.getVideosByTeacher(teacher.id);
        const videosWithStats = teacherVideos.map(video => {
          const displayData = videoDocumentToDisplay(video, {}, {}, teacher.name);
          return {
            ...displayData,
            assignedClassesCount: video.assignedClassIds?.length || 0,
            isOwner: true
          } as TeacherVideoData;
        });
        setVideos(videosWithStats);
        
        // Update subject groups
        const groupedData = groupVideosBySubjects(videosWithStats, teacherSubjects);
        setSubjectGroups(groupedData);
      } catch (err: any) {
        console.error('Error reloading videos:', err);
      }
    };
    loadVideos();
  };

  // Handle video view
  const handleViewVideo = (video: TeacherVideoData) => {
    setSelectedVideo(video);
    setShowViewModal(true);
  };

  // Handle video edit
  const handleEditVideo = (video: TeacherVideoData) => {
    setSelectedVideo(video);
    setShowEditModal(true);
  };

  // Handle student assignment
  const handleAssignStudents = (video: TeacherVideoData) => {
    setSelectedVideo(video);
    setShowAssignModal(true);
  };

  // Handle upload to specific subject
  const handleUploadToSubject = (subjectId: string) => {
    setSelectedSubjectForUpload(subjectId);
    setShowUploadModal(true);
  };

  // Handle successful video update
  const handleVideoUpdated = () => {
    setShowEditModal(false);
    setSelectedVideo(null);
    // Reload videos (same as upload)
    handleVideoUploaded();
  };

  // Handle successful assignment update
  const handleAssignmentUpdated = () => {
    setShowAssignModal(false);
    setSelectedVideo(null);
    // Reload videos (same as upload)
    handleVideoUploaded();
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      selectedSubject: '',
      selectedClass: '',
      searchTerm: ''
    });
    setSearchTerm('');
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading videos...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Video Library
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Manage your lesson videos organized by subjects
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
                <Video className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {activeTab === 'main' ? videos.length : coVideos.length} Videos
                </span>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    viewMode === 'grouped'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  By Subject
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  All Videos
                </button>
              </div>
              
              {activeTab === 'main' && (
                <Button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Video</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('main')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'main'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              My Videos ({videos.length})
            </button>
            <button
              onClick={() => setActiveTab('co')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'co'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Co-Class Videos ({coVideos.length})
            </button>
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

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search videos..."
                  value={filters.searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFilters(prev => ({ ...prev, searchTerm: e.target.value }));
                    setSearchTerm(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Subject Filter */}
            <div className="lg:w-48">
              <select
                value={filters.selectedSubject}
                onChange={(e) => setFilters(prev => ({ ...prev, selectedSubject: e.target.value }))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Subjects</option>
                {teacherSubjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.originalName || subject.name} (Grade {subject.grade})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Class Filter */}
            <div className="lg:w-48">
              <select
                value={filters.selectedClass}
                onChange={(e) => setFilters(prev => ({ ...prev, selectedClass: e.target.value }))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Classes</option>
                {(activeTab === 'main' ? teacherClasses : coClasses).map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.subject})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Clear Filters */}
            {(filters.selectedSubject || filters.selectedClass || filters.searchTerm) && (
              <Button
                variant="outline"
                onClick={resetFilters}
                className="flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'grouped' ? (
          /* Subject Grouped View */
          <div className="space-y-6">
            {getFilteredSubjectGroups().length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No subjects with videos found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {filters.selectedSubject || filters.selectedClass || filters.searchTerm
                    ? 'Try adjusting your filters'
                    : activeTab === 'main' 
                      ? 'Get started by uploading videos to your subjects'
                      : 'No videos have been assigned to your co-teacher classes yet'
                  }
                </p>
                {!filters.selectedSubject && !filters.selectedClass && !filters.searchTerm && activeTab === 'main' && (
                  <Button onClick={() => setShowUploadModal(true)} className="flex items-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>Upload Video</span>
                  </Button>
                )}
              </div>
            ) : (
              getFilteredSubjectGroups().map((subject) => (
                <div key={subject.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  {/* Subject Header */}
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 cursor-pointer"
                    onClick={() => toggleSubjectExpansion(subject.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {expandedSubjects.has(subject.id) ? (
                          <ChevronDown className="w-6 h-6" />
                        ) : (
                          <ChevronRight className="w-6 h-6" />
                        )}
                        <div>
                          <h2 className="text-xl font-bold">{subject.name}</h2>
                          <p className="text-blue-100">Grade {subject.grade}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{subject.totalVideos}</div>
                          <div className="text-sm text-blue-100">Videos</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{subject.totalViews}</div>
                          <div className="text-sm text-blue-100">Total Views</div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUploadToSubject(subject.id);
                          }}
                          className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Video
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Subject Videos */}
                  {expandedSubjects.has(subject.id) && (
                    <div className="p-6">
                      {subject.videos.length === 0 ? (
                        <div className="text-center py-8">
                          <Video className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No videos in this subject
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Upload your first video to get started
                          </p>
                          <Button 
                            onClick={() => handleUploadToSubject(subject.id)}
                            className="flex items-center space-x-2"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Upload Video</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {subject.videos.map((video) => (
                            <VideoCard
                              key={video.id}
                              video={video}
                              onView={handleViewVideo}
                              onEdit={handleEditVideo}
                              onAssign={handleAssignStudents}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* All Videos View */
          <div>
            {getFilteredVideos().length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <Video className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No videos found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {filters.selectedSubject || filters.selectedClass || filters.searchTerm
                    ? 'Try adjusting your search criteria or filters'
                    : activeTab === 'main'
                      ? 'Get started by uploading your first lesson video'
                      : 'No videos have been assigned to your co-teacher classes yet'
                  }
                </p>
                {!filters.selectedSubject && !filters.selectedClass && !filters.searchTerm && activeTab === 'main' && (
                  <Button onClick={() => setShowUploadModal(true)} className="flex items-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>Upload Video</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getFilteredVideos().map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onView={handleViewVideo}
                      onEdit={handleEditVideo}
                      onAssign={handleAssignStudents}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video Upload Modal */}
        {showUploadModal && (
          <TeacherVideoUploadModal
            isOpen={showUploadModal}
            onClose={() => {
              setShowUploadModal(false);
              setSelectedSubjectForUpload(null);
            }}
            onSuccess={handleVideoUploaded}
            teacherId={teacher?.id || ''}
            teacherName={teacher?.name || ''}
            availableSubjects={teacherSubjects}
            availableClasses={teacherClasses}
            preselectedSubjectId={selectedSubjectForUpload || undefined}
          />
        )}

        {/* Video View Modal */}
        {showViewModal && (
          <VideoViewModal
            isOpen={showViewModal}
            onClose={() => {
              setShowViewModal(false);
              setSelectedVideo(null);
            }}
            video={selectedVideo}
          />
        )}

        {/* Video Edit Modal */}
        {showEditModal && (
          <VideoEditModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedVideo(null);
            }}
            onSuccess={handleVideoUpdated}
            video={selectedVideo}
            availableSubjects={teacherSubjects}
            availableClasses={teacherClasses}
          />
        )}

        {/* Student Assignment Modal */}
        {showAssignModal && (
          <StudentAssignmentModal
            isOpen={showAssignModal}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedVideo(null);
            }}
            onSuccess={handleAssignmentUpdated}
            video={selectedVideo}
            availableClasses={teacherClasses}
          />
        )}
      </div>
    </TeacherLayout>
  );
}

// Video Card Component
interface VideoCardProps {
  video: TeacherVideoData;
  onView: (video: TeacherVideoData) => void;
  onEdit: (video: TeacherVideoData) => void;
  onAssign: (video: TeacherVideoData) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onView, onEdit, onAssign }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Video Thumbnail */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${video.thumbnailUrl ? 'hidden' : ''}`}>
          <Video className="w-16 h-16 text-gray-400" />
        </div>
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Play className="w-12 h-12 text-white" />
        </div>
        <div className="absolute top-2 right-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            video.status === 'active' 
              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
              : video.status === 'processing'
              ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
              : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
          }`}>
            {video.status}
          </span>
        </div>
        
        {/* Lesson Badge */}
        {video.lessonName && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
              <BookOpen className="w-3 h-3 mr-1" />
              {video.lessonName}
            </span>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {video.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {video.description}
          </p>
        </div>

        {/* Video Meta */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-4 h-4 mr-2" />
            <span>Subject: {video.subjectName}</span>
          </div>
          {video.lessonName && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <BookOpen className="w-4 h-4 mr-2" />
              <span>Lesson: {video.lessonName}</span>
            </div>
          )}
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Users className="w-4 h-4 mr-2" />
            <span>{video.assignedClassesCount} Classes Assigned</span>
          </div>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Eye className="w-4 h-4 mr-2" />
            <span>{video.views} Views</span>
          </div>
        </div>

        {/* Visibility Badge */}
        <div className="mb-4">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            video.visibility === 'public' 
              ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
              : video.visibility === 'unlisted'
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
          }`}>
            {video.visibility}
          </span>
        </div>

        {/* Actions */}
        {video.isOwner ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(video)}
              className="flex items-center justify-center space-x-1"
            >
              <Eye className="w-4 h-4" />
              <span>View</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(video)}
              className="flex items-center justify-center space-x-1"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAssign(video)}
              className="col-span-2 flex items-center justify-center space-x-1"
            >
              <Users className="w-4 h-4" />
              <span>Assign Students</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(video)}
              className="w-full flex items-center justify-center space-x-1"
            >
              <Eye className="w-4 h-4" />
              <span>View</span>
            </Button>
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <span>Uploaded by {video.teacherName}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
