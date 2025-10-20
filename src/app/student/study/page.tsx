'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { useSidebar } from '../layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Users, 
  Calendar, 
  Clock, 
  Award, 
  TrendingUp, 
  FileText, 
  Play, 
  Image, 
  ExternalLink, 
  CheckCircle, 
  Circle, 
  Eye, 
  Download, 
  ChevronDown, 
  ChevronUp,
  Link,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { getStudyMaterialsByClass, getStudyMaterialsByClassGrouped, markMaterialCompleted, unmarkMaterialCompleted } from '@/apiservices/studyMaterialFirestoreService';
import { usePDFViewer } from '@/components/student/StudentLayout';

interface ClassWithProgress {
  id: string;
  name: string;
  subject: string;
  totalMaterials: number;
  completedMaterials: number;
  requiredMaterials: number;
  completedRequired: number;
  recentMaterials: number;
  progress: number;
  requiredProgress: number;
}

interface StudyMaterial {
  id: string;
  title: string;
  description?: string;
  fileType: string;
  fileUrl?: string;
  externalUrl?: string; // Changed from linkUrl to externalUrl to match database
  isRequired: boolean;
  uploadedAt: any;
  lessonId?: string;
  lessonName?: string;
  completedBy?: string[];
  viewCount?: number;
  downloadCount?: number;
}

export default function StudentStudyPage() {
  const router = useRouter();
  const { student, loading } = useStudentAuth();
  const { setHideSidebar } = useSidebar();
  const { theme } = useTheme();
  const [classes, setClasses] = useState<ClassWithProgress[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [groupedMaterials, setGroupedMaterials] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [materialLoading, setMaterialLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isViewingMaterial, setIsViewingMaterial] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState<StudyMaterial | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Memoize PDFViewer to prevent re-mounting
  const PDFViewer = useMemo(() => dynamic(() => import('@/components/PDFViewer'), {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin"></div>
      </div>
    )
  }), []);

  useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
      return;
    }

    if (student) {
      loadStudentClasses();
    }
  }, [student, loading, router]);

  // Reset sidebar visibility when component unmounts
  useEffect(() => {
    return () => {
      setHideSidebar(false);
    };
  }, [setHideSidebar]);

  const loadStudentClasses = async () => {
    if (!student) return;
    
    try {
      const enrollments = await getEnrollmentsByStudent(student.id);
      const classesWithProgress: ClassWithProgress[] = [];

      for (const enrollment of enrollments) {
        const classMaterials = await getStudyMaterialsByClass(enrollment.classId);
        
        const totalMaterials = classMaterials.length;
        const completedMaterials = classMaterials.filter(m => 
          m.completedBy?.includes(student.id) || false
        ).length;
        const requiredMaterials = classMaterials.filter(m => m.isRequired).length;
        const completedRequired = classMaterials.filter(m => 
          m.isRequired && (m.completedBy?.includes(student.id) || false)
        ).length;
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentMaterials = classMaterials.filter(m => {
          const uploadDate = m.uploadedAt?.toDate ? m.uploadedAt.toDate() : (m.uploadedAt || new Date());
          return uploadDate > oneWeekAgo;
        }).length;

        const progress = totalMaterials > 0 ? (completedMaterials / totalMaterials) * 100 : 0;
        const requiredProgress = requiredMaterials > 0 ? (completedRequired / requiredMaterials) * 100 : 100;

        classesWithProgress.push({
          id: enrollment.classId,
          name: enrollment.className,
          subject: enrollment.subject,
          totalMaterials,
          completedMaterials,
          requiredMaterials,
          completedRequired,
          recentMaterials,
          progress,
          requiredProgress
        });
      }

      setClasses(classesWithProgress);
    } catch (error) {
      console.error('Error loading student classes:', error);
    }
  };

  const loadClassMaterials = async (classId: string) => {
    setMaterialLoading(true);
    try {
      // Use grouped materials like teacher side
      const groupedMats = await getStudyMaterialsByClassGrouped(classId);
      setGroupedMaterials(groupedMats);
      // Also keep flat materials for existing functionality
      const flatMaterials = groupedMats.flatMap(group => group.materials);
      console.log('Loaded materials:', flatMaterials.map(m => ({
        title: m.title,
        fileType: m.fileType,
        fileUrl: m.fileUrl ? 'present' : 'missing'
      })));
      setMaterials(flatMaterials);
      setSelectedClass(classId);
    } catch (error) {
      console.error('Error loading class materials:', error);
    } finally {
      setMaterialLoading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType?.toLowerCase()) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'video': return <Play className="w-5 h-5 text-purple-500" />;
      case 'link': return <ExternalLink className="w-5 h-5 text-blue-500" />;
      case 'image': return <Image className="w-5 h-5 text-green-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return theme === 'ben10' ? 'bg-green-500' : theme === 'tinkerbell' ? 'bg-green-400' : 'bg-blue-500';
    if (progress >= 60) return theme === 'ben10' ? 'bg-blue-500' : theme === 'tinkerbell' ? 'bg-yellow-500' : 'bg-indigo-500';
    if (progress >= 40) return theme === 'ben10' ? 'bg-yellow-500' : theme === 'tinkerbell' ? 'bg-green-300' : 'bg-yellow-500';
    return theme === 'ben10' ? 'bg-red-500' : theme === 'tinkerbell' ? 'bg-red-400' : 'bg-red-500';
  };

  const getProgressText = (progress: number) => {
    if (progress >= 80) return 'Excellent';
    if (progress >= 60) return 'Good';
    if (progress >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.lessonName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (filterType) {
      case 'required': return material.isRequired;
      case 'completed': return material.completedBy?.includes(student?.id || '') || false;
      case 'pending': return !(material.completedBy?.includes(student?.id || '') || false);
      case 'pdf': return material.fileType?.toLowerCase() === 'pdf';
      case 'video': return material.fileType?.toLowerCase() === 'video';
      case 'link': return material.fileType?.toLowerCase() === 'link';
      case 'image': return material.fileType?.toLowerCase() === 'image';
      default: return true;
    }
  });

  const openLink = (url: string) => {
    window.open(url, '_blank');
  };

  const exitMaterialView = () => {
    setIsViewingMaterial(false);
    setActiveMaterial(null);
    setHideSidebar(false);
    // Reset zoom state
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev * 1.2, 5)); // Max zoom 5x
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev / 1.2, 0.1)); // Min zoom 0.1x
  };

  const handleZoomReset = () => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
  };

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isViewingMaterial || !activeMaterial || activeMaterial.fileType?.toLowerCase() !== 'image') return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewingMaterial, activeMaterial]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageZoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePan.x, y: e.clientY - imagePan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageZoom > 1) {
      setImagePan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const viewMaterial = (material: StudyMaterial) => {
    console.log('viewMaterial called with:', {
      title: material.title,
      fileType: material.fileType,
      fileUrl: material.fileUrl,
      hasFileUrl: !!material.fileUrl
    });

    // Set the active material for viewing
    setActiveMaterial(material);
    setIsViewingMaterial(true);
    setHideSidebar(true);
  };

  const downloadMaterial = (material: StudyMaterial) => {
    if (material.fileUrl) {
      const link = document.createElement('a');
      link.href = material.fileUrl;
      link.download = material.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const toggleMaterialCompletion = async (material: StudyMaterial) => {
    if (!student) return;
    
    try {
      const isCompleted = material.completedBy?.includes(student.id) || false;
      
      if (isCompleted) {
        await unmarkMaterialCompleted(material.id, student.id);
      } else {
        await markMaterialCompleted(material.id, student.id);
      }
      
      // Refresh the materials list to show updated completion status
      if (selectedClass) {
        await loadClassMaterials(selectedClass);
      }
      
      // Refresh the classes list to update progress
      await loadStudentClasses();
    } catch (error) {
      console.error('Error toggling material completion:', error);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br p-6 ${
        theme === 'ben10'
          ? 'from-green-600 via-green-700 to-black'
          : theme === 'tinkerbell'
          ? 'bg-gradient-to-r from-green-300 via-yellow-500 to-green-300'
          : 'from-blue-600 via-indigo-700 to-blue-400'
      }`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-6 bg-gradient-to-r ${
                theme === 'ben10'
                  ? 'border-green-400 from-green-400 to-green-500'
                  : theme === 'tinkerbell'
                  ? 'bg-gradient-to-br from-green-400 to-yellow-600'
                  : 'border-blue-400 from-blue-400 to-indigo-500'
              }`}></div>
              <p className="text-white font-black text-xl">
                {theme === 'ben10'
                  ? 'Loading your study materials...'
                  : theme === 'tinkerbell'
                  ? 'Loading your study materials...'
                  : 'Loading your study materials...'}
              </p>
            </div>
          </div>
        </div>
      </div>
      );
  }

  if (!student) {
    return null;
  }

  const totalMaterials = classes.reduce((sum, cls) => sum + cls.totalMaterials, 0);
  const totalCompleted = classes.reduce((sum, cls) => sum + cls.completedMaterials, 0);
  const totalRequired = classes.reduce((sum, cls) => sum + cls.requiredMaterials, 0);
  const totalCompletedRequired = classes.reduce((sum, cls) => sum + cls.completedRequired, 0);
  const overallProgress = totalMaterials > 0 ? (totalCompleted / totalMaterials) * 100 : 0;
  const requiredProgress = totalRequired > 0 ? (totalCompletedRequired / totalRequired) * 100 : 100;

  if (selectedClass) {
    const currentClass = classes.find(c => c.id === selectedClass);

    if (isViewingMaterial && activeMaterial) {
      // PDF Viewing Layout - Full screen without top space
      return (
        <div className={`fixed inset-0 bg-gradient-to-br ${theme === 'ben10' ? 'from-green-600 via-green-700 to-black' : theme === 'tinkerbell' ? 'from-green-500 via-yellow-500 to-green-600' : 'from-blue-600 via-indigo-700 to-blue-400'} z-50`}>
          {/* Minimal Back Button - positioned absolutely */}
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={exitMaterialView}
              className="bg-black text-white font-black py-2 px-4 rounded-2xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 shadow-lg"
            >
              <span>← Back to Classes</span>
            </button>
          </div>

          <div className="flex h-full">
            {/* Materials Sidebar - narrower */}
            <div className={`w-72 bg-gradient-to-b ${theme === 'ben10' ? 'from-green-500 to-green-600' : theme === 'tinkerbell' ? 'from-green-400 to-yellow-500' : 'from-blue-500 to-indigo-600'} border-r-4 border-black overflow-y-auto shadow-2xl pt-16`}>
              <div className="p-4 border-b-4 border-black">
                <h2 className="text-lg font-black text-white text-center">
                  {theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : '📚'} Study Materials 
                </h2>
                <p className="text-sm font-black text-white/90 text-center">
                  {currentClass?.name}
                </p>
              </div>

              <div className="p-4 space-y-3">
                {groupedMaterials.map((group: any) => {
                  const isExpanded = expandedGroups.has(group.id);

                  return (
                    <div key={group.id} className={`bg-white rounded-2xl shadow-lg border-2 transition-all hover:scale-105 ${
                      group.materials.some((m: any) => m.id === activeMaterial.id)
                        ? theme === 'ben10'
                          ? 'border-green-500 bg-green-50 shadow-green-200'
                          : theme === 'tinkerbell'
                          ? 'border-yellow-500 bg-yellow-50 shadow-yellow-200'
                          : 'border-blue-500 bg-blue-50 shadow-blue-200'
                        : 'border-black'
                    }`}>
                      <div
                        className="cursor-pointer hover:bg-green-100 p-4 rounded-t-2xl"
                        onClick={() => toggleGroupExpansion(group.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className={`w-8 h-8 ${theme === 'ben10' ? 'bg-green-500' : theme === 'tinkerbell' ? 'bg-yellow-500' : 'bg-blue-500'} rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-black`}>
                              {group.isGroup ? (
                                <div className="text-white font-black text-sm">
                                  {group.totalFiles}
                                </div>
                              ) : (
                                getFileIcon(group.materials[0]?.fileType || 'other')
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="font-black text-gray-900 text-sm truncate">{group.groupTitle || group.materials[0]?.title}</span>
                                {isExpanded ? (
                                  <ChevronUp className={`w-4 h-4 ${theme === 'ben10' ? 'text-green-600' : theme === 'tinkerbell' ? 'text-yellow-600' : 'text-blue-600'} flex-shrink-0 font-black`} />
                                ) : (
                                  <ChevronDown className={`w-4 h-4 ${theme === 'ben10' ? 'text-green-600' : theme === 'tinkerbell' ? 'text-yellow-600' : 'text-blue-600'} flex-shrink-0 font-black`} />
                                )}
                              </div>

                              {group.materials[0]?.description && (
                                <p className="text-xs font-bold text-gray-700 mb-2 line-clamp-2">
                                  {group.materials[0].description}
                                </p>
                              )}

                              <div className="flex items-center space-x-2 mb-2">
                                {group.fileTypes.map((fileType: string) => (
                                  <span key={fileType} className={`text-white font-black text-xs px-2 py-1 rounded-lg border border-black ${
                                    theme === 'ben10' ? 'bg-green-500' : theme === 'tinkerbell' ? 'bg-yellow-500' : 'bg-blue-500'
                                  }`}>
                                    {fileType.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible content */}
                      {isExpanded && (
                        <div className="pt-0 px-4 pb-4 border-t-2 border-black">
                          <div className="space-y-3 border-t border-gray-100 pt-3">
                            {group.materials.map((material: any) => {
                              const isSelected = material.id === activeMaterial?.id;

                              return (
                                <div
                                  key={material.id}
                                  className={`flex items-center justify-between p-3 border-2 rounded-xl text-sm transition-all hover:scale-105 ${
                                    material.fileUrl ? 'cursor-pointer hover:bg-green-50' : ''
                                  } ${
                                    isSelected
                                      ? theme === 'ben10'
                                        ? 'border-green-500 bg-green-100 shadow-lg'
                                        : theme === 'tinkerbell'
                                        ? 'border-yellow-500 bg-yellow-100 shadow-lg'
                                        : 'border-blue-500 bg-blue-100 shadow-lg'
                                      : 'border-gray-300 bg-white'
                                  }`}
                                  onClick={() => material.fileUrl && viewMaterial(material)}
                                >
                                  <div className="flex items-center space-x-3 flex-1">
                                    <div className={`w-6 h-6 ${theme === 'ben10' ? 'bg-green-500' : theme === 'tinkerbell' ? 'bg-yellow-500' : 'bg-blue-500'} rounded-lg flex items-center justify-center flex-shrink-0 border-2 border-black`}>
                                      {getFileIcon(material.fileType)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`font-black truncate text-sm ${
                                        isSelected
                                          ? theme === 'ben10'
                                            ? 'text-green-700'
                                            : theme === 'tinkerbell'
                                            ? 'text-yellow-700'
                                            : 'text-blue-700'
                                          : 'text-gray-900'
                                      }`}>
                                        {material.title}
                                      </h4>
                                      <div className={`text-xs font-bold ${
                                        theme === 'ben10' ? 'text-green-600' : theme === 'tinkerbell' ? 'text-yellow-600' : 'text-blue-600'
                                      }`}>
                                        {material.fileType.toUpperCase()}
                                      </div>
                                    </div>
                                  </div>

                                  {material.fileUrl && (
                                    <Eye
                                      className={`w-4 h-4 flex-shrink-0 cursor-pointer hover:text-${theme === 'ben10' ? 'green' : 'yellow'}-600 transition-colors pointer-events-auto font-black ${
                                        isSelected ? `text-${theme === 'ben10' ? 'green' : 'yellow'}-600` : 'text-gray-500'
                                      }`}
                                      onClick={() => viewMaterial(material)}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Material Viewer - takes remaining space */}
            <div className={`flex-1 bg-gradient-to-br from-white ${theme === 'ben10' ? 'to-green-50' : 'to-yellow-50'} overflow-hidden`}>
              <div className="h-full w-full">
                {activeMaterial.fileType?.toLowerCase() === 'pdf' && activeMaterial.fileUrl && (
                  <PDFViewer
                    key={activeMaterial.id}
                    url={activeMaterial.fileUrl}
                    title={activeMaterial.title}
                    onClose={exitMaterialView}
                    inline={true}
                  />
                )}
                {activeMaterial.fileType?.toLowerCase() === 'image' && activeMaterial.fileUrl && (
                  <div className="h-full flex flex-col">
                    <div className={`p-6 border-b-4 border-black bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600' : theme === 'tinkerbell' ? 'from-green-400 to-yellow-500' : 'from-blue-500 to-indigo-600'}`}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-white flex items-center">
                          🖼️ {activeMaterial.title}
                        </h3>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={handleZoomOut}
                            disabled={imageZoom <= 0.1}
                            className="bg-black text-white p-3 rounded-xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 font-black"
                            title="Zoom Out (-)"
                          >
                            <ZoomOut className="h-5 w-5" />
                          </button>
                          <span className="text-lg font-black text-white min-w-[70px] text-center bg-black/20 rounded-lg px-3 py-2 border-2 border-white">
                            {Math.round(imageZoom * 100)}%
                          </span>
                          <button
                            onClick={handleZoomIn}
                            disabled={imageZoom >= 5}
                            className="bg-black text-white p-3 rounded-xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 font-black"
                            title="Zoom In (+)"
                          >
                            <ZoomIn className="h-5 w-5" />
                          </button>
                          <button
                            onClick={handleZoomReset}
                            className="bg-black text-white p-3 rounded-xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 font-black"
                            title="Reset Zoom (0)"
                          >
                            <RotateCcw className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm font-black text-white/90 mt-3 text-center">
                        🖱️ Use mouse to drag when zoomed • ⌨️ Keyboard: + zoom in, - zoom out, 0 reset ⚡
                      </div>
                    </div>
                    <div
                      className={`flex-1 flex items-center justify-center p-6 bg-gradient-to-br ${theme === 'ben10' ? 'from-green-50 to-white' : theme === 'tinkerbell' ? 'from-yellow-50 to-green-50' : 'from-blue-50 to-indigo-50'} overflow-hidden relative`}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      style={{ cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                    >
                      <img
                        src={activeMaterial.fileUrl}
                        alt={activeMaterial.title}
                        className="rounded-3xl shadow-2xl border-4 border-black select-none"
                        style={{
                          transform: `scale(${imageZoom}) translate(${imagePan.x / imageZoom}px, ${imagePan.y / imageZoom}px)`,
                          transformOrigin: 'center center',
                          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                          maxWidth: imageZoom > 1 ? 'none' : '100%',
                          maxHeight: imageZoom > 1 ? 'none' : '100%',
                          width: imageZoom > 1 ? 'auto' : 'auto',
                          height: imageZoom > 1 ? 'auto' : 'auto'
                        }}
                        draggable={false}
                      />
                    </div>
                  </div>
                )}
                {activeMaterial.fileType?.toLowerCase() === 'video' && activeMaterial.fileUrl && (
                  <div className="h-full flex flex-col">
                    <div className={`p-6 border-b-4 border-black bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600' : 'from-green-400 to-yellow-500'}`}>
                      <h3 className="text-xl font-black text-white flex items-center">
                        🎥 {activeMaterial.title}
                      </h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-green-50 to-white">
                      <video
                        src={activeMaterial.fileUrl}
                        controls
                        className="max-w-full max-h-full rounded-3xl shadow-2xl border-4 border-black"
                        preload="metadata"
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                )}
                {activeMaterial.fileType?.toLowerCase() === 'link' && activeMaterial.fileUrl && (
                  <div className="h-full flex flex-col">
                    <div className={`p-6 border-b-4 border-black bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600' : 'from-green-400 to-yellow-500'}`}>
                      <h3 className="text-xl font-black text-white flex items-center">
                        🔗 {activeMaterial.title}
                      </h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-green-50 to-white">
                      <div className="text-center space-y-8 max-w-md">
                        <div className={`w-20 h-20 bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600' : 'from-yellow-400 to-green-500'} rounded-3xl flex items-center justify-center mx-auto border-4 border-black shadow-2xl`}>
                          <Link className="h-10 w-10 text-white font-black" />
                        </div>
                        <div>
                          <h4 className="text-2xl font-black text-gray-900 mb-4"> External Link </h4>
                          <p className="text-sm font-bold text-gray-700 mb-6 break-all bg-white p-4 rounded-2xl border-2 border-black shadow-lg">{activeMaterial.fileUrl}</p>
                        </div>
                        <button
                          onClick={() => window.open(activeMaterial.fileUrl, '_blank')}
                          className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 'from-yellow-400 to-green-500 hover:from-green-500 hover:to-yellow-500'} text-white font-black px-8 py-4 rounded-2xl border-4 border-black shadow-2xl hover:shadow-3xl transition-all duration-300 text-lg`}
                        >
                          <ExternalLink className="h-5 w-5 mr-2 inline" />
                          Open Link 
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Normal Materials View
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme === 'ben10' ? 'from-green-600 via-green-700 to-black' : 'from-green-500 via-yellow-500 to-green-600'} p-6`}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => {
                setSelectedClass(null);
                setHideSidebar(false);
              }}
              className="bg-black text-white font-black py-3 px-6 rounded-2xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 shadow-lg mb-6"
            >
              ← Back to Dashboard
            </button>

            <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600' : 'from-green-400 to-yellow-500'} rounded-3xl shadow-2xl border-4 border-black p-8 mb-8`}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-4xl font-black text-white flex items-center">
                    🦸‍♂️ {currentClass?.name} 
                  </h1>
                  <p className="text-green-200 font-bold text-lg">{currentClass?.subject}</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-white">
                    {currentClass?.completedMaterials}/{currentClass?.totalMaterials}
                  </div>
                  <div className="text-sm font-black text-white/90">Materials Completed </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-600 to-green-700' : 'from-green-400 to-yellow-500'} rounded-3xl shadow-2xl border-4 border-black p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">Overall Progress</p>
                      <p className="text-3xl font-black text-white">{Math.round(currentClass?.progress || 0)}%</p>
                    </div>
                    <div className="text-4xl">📈</div>
                  </div>
                  <div className="mt-4 bg-white/20 rounded-full h-3 border-2 border-black">
                    <div
                      className="bg-white h-3 rounded-full transition-all duration-300"
                      style={{ width: `${currentClass?.progress || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-700 to-black' : 'from-yellow-500 to-green-600'} rounded-3xl shadow-2xl border-4 border-black p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">Required Materials</p>
                      <p className="text-3xl font-black text-white">{Math.round(currentClass?.requiredProgress || 0)}%</p>
                    </div>
                    <div className="text-4xl">🏆</div>
                  </div>
                  <div className="mt-4 bg-white/20 rounded-full h-3 border-2 border-black">
                    <div
                      className="bg-white h-3 rounded-full transition-all duration-300"
                      style={{ width: `${currentClass?.requiredProgress || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-black to-green-800' : 'from-green-600 to-yellow-600'} rounded-3xl shadow-2xl border-4 border-black p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">New This Week</p>
                      <p className="text-3xl font-black text-white">{currentClass?.recentMaterials || 0}</p>
                    </div>
                    
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-3xl shadow-2xl border-4 border-black p-6 mb-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={`🔍 Search materials...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-6 py-4 border-2 border-black rounded-2xl focus:ring-4 focus:ring-green-500 focus:border-green-500 font-bold text-lg bg-gradient-to-r from-green-50 to-white shadow-lg"
                  />
                </div>
                <div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-6 py-4 border-2 border-black rounded-2xl focus:ring-4 focus:ring-green-500 focus:border-green-500 font-bold text-lg bg-gradient-to-r from-green-50 to-white shadow-lg"
                  >
                    <option value="all">🎯 All Materials</option>
                    <option value="required">⭐ Required Only</option>
                    <option value="completed">✅ Completed</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="pdf">📄 PDF Files</option>
                    <option value="video">🎥 Videos</option>
                    <option value="link">🔗 Links</option>
                    <option value="image">🖼️ Images</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

        {materialLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-6 bg-gradient-to-r ${
                theme === 'ben10'
                  ? 'border-green-400 from-green-400 to-green-500'
                  : 'border-yellow-400 from-yellow-400 to-green-500'
              }`}></div>
              <p className="text-white font-black text-xl">
                {theme === 'ben10'
                  ? `Loading  materials...`
                  : 'Loading  materials...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMaterials.map((group: any) => {
              const isExpanded = expandedGroups.has(group.id);
              const completedCount = group.materials.filter((m: any) => m.completedBy?.includes(student?.id || '')).length;
              const totalCount = group.materials.length;
              const isGroupCompleted = completedCount === totalCount;
              
              return (
                <div key={group.id} className={`bg-white rounded-3xl shadow-2xl border-4 transition-all hover:scale-105 ${
                  isGroupCompleted ? 'border-green-500 bg-gradient-to-r from-green-50 to-white' : 'border-black'
                }`}>
                  <div
                    className="cursor-pointer hover:bg-green-100 p-6 rounded-t-3xl"
                    onClick={() => toggleGroupExpansion(group.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 border-black ${
                          theme === 'ben10'
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : 'bg-gradient-to-r from-yellow-400 to-green-500'
                        }`}>
                          {group.isGroup ? (
                            <div className="text-white font-black text-lg">
                              {group.totalFiles}
                            </div>
                          ) : (
                            getFileIcon(group.materials[0]?.fileType || 'other')
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-3">
                            <span className="font-black text-gray-900 text-xl truncate">{group.groupTitle || group.materials[0]?.title}</span>
                            {isGroupCompleted && (
                              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 font-black" />
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-6 h-6 text-green-600 flex-shrink-0 font-black" />
                            ) : (
                              <ChevronDown className="w-6 h-6 text-green-600 flex-shrink-0 font-black" />
                            )}
                          </div>
                          
                          {/* Display description from the first material (they all have the same description) */}
                          {group.materials[0]?.description && (
                            <p className="text-sm font-bold text-gray-700 mb-3">
                              {group.materials[0].description}
                            </p>
                          )}
                          
                          <div className="flex items-center space-x-3 mb-3">
                            {group.isGroup && (
                              <span className="bg-green-500 text-white font-black text-sm px-3 py-1 rounded-lg border border-black">
                                📁 {group.totalFiles} files
                              </span>
                            )}
                            {group.fileTypes.map((fileType: string) => (
                              <span key={fileType} className={`bg-${theme === 'ben10' ? 'green' : 'yellow'}-600 text-white font-black text-sm px-3 py-1 rounded-lg border border-black`}>
                                {fileType.toUpperCase()}
                              </span>
                            ))}
                            {group.isRequired && (
                              <span className="bg-red-500 text-white font-black text-sm px-3 py-1 rounded-lg border border-black">
                                ⭐ Required
                              </span>
                            )}
                            {group.lessonName && (
                              <span className="bg-blue-500 text-white font-black text-sm px-3 py-1 rounded-lg border border-black">
                                📚 {group.lessonName}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-sm font-bold text-gray-600 mb-3">
                            📅 {new Date(group.uploadedAt?.toDate ? group.uploadedAt.toDate() : group.uploadedAt).toLocaleDateString()}
                          </div>

                          {/* Progress bar for groups */}
                          {group.isGroup && (
                            <div className="mt-3">
                              <div className="flex justify-between text-sm font-black text-gray-700 mb-2">
                                <span>Progress</span>
                                <span>{completedCount}/{totalCount}</span>
                              </div>
                              <div className="bg-gray-200 rounded-full h-3 border-2 border-black">
                                <div
                                  className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600' : 'from-yellow-400 to-green-500'} h-3 rounded-full transition-all duration-300`}
                                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {!group.isGroup ? (
                          /* Single file actions */
                          <div className="flex space-x-2">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMaterialCompletion(group.materials[0]);
                              }}
                              variant={group.materials[0].completedBy?.includes(student?.id || '') ? "success" : "outline"}
                              size="sm"
                              className={group.materials[0].completedBy?.includes(student?.id || '')
                                ? "bg-green-600 hover:bg-green-700 text-white" 
                                : "border-green-600 text-green-600 hover:bg-green-50"
                              }
                            >
                              {group.materials[0].completedBy?.includes(student?.id || '') ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </Button>
                            
                            {group.materials[0].fileType === 'link' ? (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLink(group.materials[0].externalUrl || '');
                                }}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  viewMaterial(group.materials[0]);
                                }}
                                variant="outline"
                                size="sm"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          /* Group indicator */
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {completedCount}/{totalCount}
                            </div>
                            <div className="text-xs text-gray-500">completed</div>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  
                  {/* Collapsible content */}
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                        {group.materials.map((material: any) => {
                          const isCompleted = material.completedBy?.includes(student?.id || '') || false;
                          
                          return (
                            <div key={material.id} className={`flex items-center justify-between p-3 border rounded-lg dark:border-gray-700 transition-colors ${
                              isCompleted 
                                ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' 
                                : 'border-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}>
                              <div className="flex items-center space-x-3 flex-1">
                                <div className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 border">
                                  {getFileIcon(material.fileType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    {isCompleted && (
                                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    )}
                                    <h4 className={`font-medium truncate ${
                                      isCompleted 
                                        ? 'text-green-700 dark:text-green-400' 
                                        : 'text-gray-900 dark:text-white'
                                    }`}>
                                      {material.title}
                                    </h4>
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {material.formattedFileSize || '2.3 MB'} • {material.fileType.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {/* Completion Toggle Button */}
                                <Button
                                  onClick={() => toggleMaterialCompletion(material)}
                                  variant={isCompleted ? "success" : "outline"}
                                  size="sm"
                                  className={isCompleted
                                    ? "bg-green-600 hover:bg-green-700 text-white" 
                                    : "border-green-600 text-green-600 hover:bg-green-50"
                                  }
                                >
                                  {isCompleted ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : (
                                    <Circle className="w-4 h-4" />
                                  )}
                                </Button>

                                {/* Action Button */}
                                {material.fileType === 'link' ? (
                                  <Button
                                    onClick={() => openLink(material.externalUrl || '')}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Eye button clicked for material:', material);
                                        try {
                                          viewMaterial(material);
                                        } catch (error) {
                                          console.error('Error calling viewMaterial:', error);
                                        }
                                      }}
                                      variant="outline"
                                      size="sm"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      onClick={() => downloadMaterial(material)}
                                      variant="outline"
                                      size="sm"
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    );
  }

  return (
    <div key={`study-${theme}`} className={`min-h-screen bg-gradient-to-br p-6 ${
      theme === 'ben10'
        ? 'from-green-600 via-green-700 to-black'
        : 'from-green-400 via-green-400 to-yellow-500'
    }`}>
      <div className="max-w-6xl mx-auto">
        {/* Theme-aware Hero Header */}
        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 border-black p-8 mb-8 relative overflow-hidden ${
          theme === 'ben10'
            ? 'from-green-500 via-green-600 to-black'
            : 'bg-gradient-to-r from-green-400 via-green-500 to-yellow-500'
        }`}>
         

          <div className="flex items-center space-x-4 relative z-10">
            <div className="text-6xl">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : '📚'}</div>
            <div>
              <h1 className="text-4xl font-black text-black mb-2 flex items-center">
                <span>Your</span>
                <span className={`ml-2 font-black text-4xl text-black
                }`}>Study</span>
               
              </h1>
              <p className={`font-bold text-lg ${
                theme === 'ben10' ? 'text-green-200' : 'text-white'
              }`}>
                {theme === 'ben10'
                  ? `Welcome back, ${student.name}! Access your study materials!`
                  : `Welcome back, ${student.name}! Access your study materials!`}
              </p>
            </div>
          </div>
        </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 border-black p-6 ${
          theme === 'ben10'
            ? 'from-green-500 to-green-600'
            : 'from-green-400 to-yellow-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-white">
                Overall Progress
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-2xl font-black text-white">
                  {Math.round(overallProgress)}%
                </span>
                <Badge className={`font-black border-2 border-black ${
                  getProgressColor(overallProgress) === 'bg-green-500' ? 'bg-green-400' :
                  getProgressColor(overallProgress) === 'bg-blue-500' ? 'bg-blue-400' :
                  getProgressColor(overallProgress) === 'bg-yellow-500' ? 'bg-yellow-400' : 'bg-red-400'
                }`}>
                  {getProgressText(overallProgress)}
                </Badge>
              </div>
            </div>
            <div className="text-4xl">{theme === 'ben10' ? '📈' : '📊'}</div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2 border-2 border-black">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-300" 
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>

        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 border-black p-6 ${
          theme === 'ben10'
            ? 'from-green-600 to-green-700'
            : 'from-green-400 to-yellow-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-white">
                Required Materials
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-2xl font-black text-white">
                  {Math.round(requiredProgress)}%
                </span>
              </div>
            </div>
            <div className="text-4xl">🏆</div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2 border-2 border-black">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-300" 
              style={{ width: `${requiredProgress}%` }}
            ></div>
          </div>
        </div>

        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 border-black p-6 ${
          theme === 'ben10'
            ? 'from-green-700 to-black'
            : 'from-green-400 to-yellow-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-white">
                {theme === 'ben10' ? 'Your Classes' : 'Your Classes'}
              </p>
              <p className="text-3xl font-black text-white mt-2">
                {classes.length}
              </p>
            </div>
           
          </div>
        </div>

        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 border-black p-6 ${
          theme === 'ben10'
            ? 'from-black to-green-800'
            : 'from-green-400 to-yellow-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-white">
                New This Week
              </p>
              <p className="text-3xl font-black text-white mt-2">
                {classes.reduce((sum, cls) => sum + cls.recentMaterials, 0)}
              </p>
            </div>
          
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="mb-8">
        <h2 className={`text-3xl font-black text-black mb-6 text-center rounded-3xl p-4 border-4 border-black shadow-2xl ${
          theme === 'ben10'
            ? 'bg-gradient-to-r from-green-500 to-green-600'
            : 'bg-gradient-to-r from-green-400 to-yellow-500'
        }`}>
          {theme === 'ben10' ? ' Your Classes ' : ' Your Classes '}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div key={classItem.id} className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 border-black hover:shadow-3xl transition-all duration-300 cursor-pointer hover:scale-105 ${
              theme === 'ben10'
                ? 'from-green-500 to-green-600'
                : 'from-green-400 to-yellow-500'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-white">{classItem.name}</h3>
                  {classItem.recentMaterials > 0 && (
                    <Badge className={`font-black border-2 border-black ${
                      theme === 'ben10' ? 'bg-yellow-400 text-black' : 'bg-green-400 text-black'
                    }`}>
                       {classItem.recentMaterials} new
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-black text-white/90 mb-4">{classItem.subject}</p>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm font-black text-white mb-2">
                      <span>Overall Progress</span>
                      <span>{Math.round(classItem.progress)}%</span>
                    </div>
                    <div className="bg-white/20 rounded-full h-3 border-2 border-black">
                      <div
                        className="bg-white h-3 rounded-full transition-all duration-300"
                        style={{ width: `${classItem.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm font-black text-white mb-2">
                      <span>Required Materials</span>
                      <span>{classItem.completedRequired}/{classItem.requiredMaterials}</span>
                    </div>
                    <div className="bg-white/20 rounded-full h-3 border-2 border-black">
                      <div
                        className="bg-white h-3 rounded-full transition-all duration-300"
                        style={{ width: `${classItem.requiredProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm font-black text-white">
                    <span>Total Materials</span>
                    <span>{classItem.completedMaterials}/{classItem.totalMaterials}</span>
                  </div>

                  <button
                    onClick={() => loadClassMaterials(classItem.id)}
                    className="w-full mt-4 bg-black text-white font-black py-3 px-6 rounded-2xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 shadow-lg"
                  >
                    {theme === 'ben10' ? ' View Materials ' : ' View Materials '}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {classes.length === 0 && (
        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 border-black text-center py-12 ${
          theme === 'ben10'
            ? 'from-green-500 to-green-600'
            : 'from-yellow-400 to-green-500'
        }`}>
          <div className="p-8">
            <div className="text-6xl mb-4">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : '📚'}</div>
            <h3 className="text-2xl font-black text-white mb-4">
              {theme === 'ben10' ? 'No Classes Yet!' : 'No Classes Yet!'}
            </h3>
            <p className="text-white/90 font-black mb-6">
              {theme === 'ben10'
                ? 'Ready to become a learning hero? Enroll in your first class and start your adventure!'
                : theme === 'tinkerbell'
                ? 'Ready to become a magical learner? Enroll in your first class and start your magical journey!'
                : 'Ready to become an enriching learner? Enroll in your first class and start your learning journey!'}
            </p>
            <button
              onClick={() => router.push('/enroll')}
              className="bg-black text-white font-black py-4 px-8 rounded-2xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 shadow-lg text-lg"
            >
              {theme === 'ben10' ? ' Browse Classes ' : ' Browse Classes '}
            </button>
          </div>
        </div>
      )}

        </div>
      </div>
    
    
    );
  }