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
  // Homework fields
  isHomework?: boolean;
  homeworkType?: 'manual' | 'submission';
  manualInstruction?: string;
  maxMarks?: number;
  allowLateSubmission?: boolean;
  lateSubmissionDays?: number;
  dueDate?: any;
}

import HomeworkSubmissionModal from '@/components/student/HomeworkSubmissionModal';
import { HomeworkSubmissionService } from '@/apiservices/homeworkSubmissionService';
import { HomeworkSubmissionDocument } from '@/models/homeworkSubmissionSchema';

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

  // Homework State
  
  // Loading States
  const [classesLoading, setClassesLoading] = useState(true);

  // Homework State
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<StudyMaterial | null>(null);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<Record<string, HomeworkSubmissionDocument>>({});

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
    
    setClassesLoading(true);
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
    } finally {
      setClassesLoading(false);
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
      
      setMaterials(flatMaterials);
      setSelectedClass(classId);

      // Load submissions for homework materials
      if (student) {
        const homeworks = flatMaterials.filter(m => m.isHomework);
        if (homeworks.length > 0) {
          const submissionPromises = homeworks.map(async (hw) => {
            const sub = await HomeworkSubmissionService.getStudentSubmission(hw.id, student.id);
            return { id: hw.id, sub };
          });
          
          const results = await Promise.all(submissionPromises);
          const subMap: Record<string, HomeworkSubmissionDocument> = {};
          results.forEach(res => {
            if (res.sub) subMap[res.id] = res.sub;
          });
          setHomeworkSubmissions(subMap);
        } else {
          setHomeworkSubmissions({});
        }
      }

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
      case 'image': return <Image className={`w-5 h-5 ${theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-green-500' : theme === 'avengers' ? 'text-[#604AC7]' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-green-500'}`} />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-green-400' : theme === 'cricketverse-australian' ? 'bg-[#b38f00]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500';
    if (progress >= 60) return theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'cricketverse-australian' ? 'bg-[#ffd700]' : theme === 'avengers' ? 'bg-[#2C1267]' : theme === 'ponyville' ? 'bg-[#f1aed5]' : 'bg-indigo-500';
    if (progress >= 40) return theme === 'ben10' ? 'bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-green-300' : theme === 'cricketverse-australian' ? 'bg-yellow-500' : theme === 'avengers' ? 'bg-[#0F0826]' : theme === 'ponyville' ? 'bg-[#ff2e9f]' : 'bg-yellow-500';
    return theme === 'ben10' ? 'bg-red-500' : theme === 'tinkerbell' ? 'bg-red-400' : theme === 'cricketverse-australian' ? 'bg-red-500' : theme === 'avengers' ? 'bg-red-500' : theme === 'ponyville' ? 'bg-red-500' : 'bg-red-500';
  };

  const getProgressText = (progress: number) => {
    if (progress >= 80) return 'Excellent';
    if (progress >= 60) return 'Good';
    if (progress >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const getHomeworkDeadlineStatus = (dueDate?: string) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));

    if (diffTime < 0) {
      return { status: 'overdue', color: 'bg-red-100 text-red-700 border-red-500', label: 'Overdue' };
    }

    if (diffDays > 7) {
      return { status: 'comfortable', color: 'bg-green-100 text-green-700 border-green-500', label: `${diffDays} days left` };
    } else if (diffDays > 3) {
      return { status: 'moderate', color: 'bg-yellow-100 text-yellow-700 border-yellow-500', label: `${diffDays} days left` };
    } else if (diffDays > 1) {
       return { status: 'soon', color: 'bg-orange-100 text-orange-700 border-orange-500', label: `${diffDays} days left` };
    } else {
      return { status: 'urgent', color: 'bg-red-100 text-red-700 border-red-500 animate-pulse', label: diffHours > 1 ? `${diffHours} hours left` : '< 1 hour left' };
    }
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
      <div className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'cricketverse' ? 'bg-gradient-to-br from-blue-400 to-indigo-600' : theme === 'cricketverse-australian' ? '' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#604AC7] via-[#2C1267] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'bg-gradient-to-br from-gray-100 to-white'} flex items-center justify-center`} style={theme === 'cricketverse-australian' ? { background: 'linear-gradient(to bottom right, rgb(255, 255, 42) 0%, rgb(255, 255, 42) 40%, rgb(134, 250, 92) 60%, rgb(255, 255, 42) 100%)' } : undefined}>
        <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-black' : 'border-black'} rounded-3xl p-8 shadow-2xl`}>
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

            {/* Ponyville Loading Animation */}
            {theme === 'ponyville' && (
              <div className="flex flex-col items-center">
                <img
                  src="/ponyville-loading.gif"
                  alt="Ponyville Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#e13690] mt-4">Casting Magic</span>
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

            {/* Australian CricketVerse Loading GIF */}
            {theme === 'cricketverse-australian' && (
              <div className="flex flex-col items-center">
                <img
                  src="/cricketverse-australian.gif"
                  alt="Australian CricketVerse Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#fff800] mt-4">Loading</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'cricketverse' && theme !== 'cricketverse-australian' && theme !== 'ponyville' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-gray-600 mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Study Materials...</h2>
            <p className={`text-gray-600 font-medium ${theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'ponyville' ? 'text-[#e13690]' : ''}`}>
              {theme === 'bounceworld' ? 'Get ready to score big with your studies! 🏀' : theme === 'ponyville' ? '✨ Get ready for magical learning adventures!' : 'Get ready to transform your learning!'}
            </p>
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
        <div className={`fixed inset-0 bg-gradient-to-br ${theme === 'ben10' ? '' : theme === 'tinkerbell' ? 'from-green-500 via-yellow-500 to-green-600' : theme === 'cricketverse' ? 'from-blue-400 to-indigo-600' : theme === 'cricketverse-australian' ? '' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'from-[#604AC7] via-[#2C1267] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-gray-100 to-white'} z-50`} style={theme === 'ben10' ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' } : theme === 'cricketverse-australian' ? { background: 'linear-gradient(to bottom right, rgb(255, 255, 42) 0%, rgb(255, 255, 42) 40%, rgb(134, 250, 92) 60%, rgb(255, 255, 42) 100%)' } : undefined}>
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
            <div className={`w-72 bg-gradient-to-b ${theme === 'default' ? 'from-gray-100 to-gray-200' : theme === 'ben10' ? 'from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'from-green-400 to-yellow-500' : theme === 'cricketverse-australian' ? 'bg-white' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#0F0826] via-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-blue-500 to-indigo-600'} border-r-4 ${theme === 'cricketverse-australian' ? 'border-[#b38f00]' : theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} overflow-y-auto shadow-2xl pt-16`}>
              <div className={`p-4 border-b-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'}`}>
                <h2 className={`text-lg font-black ${theme === 'default' ? 'text-black' : 'text-white'} text-center`}>
                  {(theme === 'ben10' || theme === 'tinkerbell') && <span className="text-2xl mr-2">{theme === 'ben10' ? '�‍♂️' : '🧚‍♀️'}</span>}Study Materials 
                </h2>
                <p className={`text-sm font-black ${theme === 'default' ? 'text-gray-600' : 'text-white/90'} text-center`}>
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
                          ? 'border-[#64cc4f] bg-[#64cc4f]/10 shadow-[#64cc4f]/30'
                          : theme === 'tinkerbell'
                          ? 'border-yellow-500 bg-yellow-50 shadow-yellow-200'
                          : theme === 'bounceworld'
                          ? 'border-[#C8102E] bg-[#C8102E]/10 shadow-[#C8102E]/30'
                          : theme === 'avengers'
                          ? 'border-[#604AC7] bg-[#604AC7]/10 shadow-[#604AC7]/30'
                          : theme === 'ponyville'
                          ? 'border-[#e13690] bg-[#e13690]/10 shadow-[#e13690]/30'
                          : 'border-blue-500 bg-blue-50 shadow-blue-200'
                        : theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'
                    }`}>
                      <div
                        className={`cursor-pointer p-4 rounded-t-2xl ${
                          theme === 'ben10' ? 'hover:bg-[#64cc4f]/10' : 'hover:bg-green-100'
                        }`}
                        onClick={() => toggleGroupExpansion(group.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className={`w-8 h-8 ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'cricketverse-australian' ? 'bg-[#b38f00]' : theme === 'bounceworld' ? 'bg-[#1D428A]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500'} rounded-xl flex items-center justify-center flex-shrink-0 border-2 ${theme === 'cricketverse-australian' ? 'border-[#ffd700]' : theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'}`}>
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
                                  <ChevronUp className={`w-4 h-4 ${theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-yellow-600' : theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#604AC7]' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-blue-600'} flex-shrink-0 font-black`} />
                                ) : (
                                  <ChevronDown className={`w-4 h-4 ${theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-yellow-600' : theme === 'bounceworld' ? 'text-[#C8102E]' : theme === 'avengers' ? 'text-[#604AC7]' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-blue-600'} flex-shrink-0 font-black`} />
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
                                    theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'bounceworld' ? 'bg-[#1D428A]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500'
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
                              const submission = homeworkSubmissions[material.id];
                              const teacherMark = submission?.teacherMark;
                              
                              let markStyle = '';
                              if (teacherMark === 'Good') markStyle = 'border-green-500 bg-green-50 ring-1 ring-green-500';
                              else if (teacherMark === 'Satisfied') markStyle = 'border-blue-500 bg-blue-50 ring-1 ring-blue-500';
                              else if (teacherMark === 'Not Sufficient') markStyle = 'border-red-500 bg-red-50 ring-1 ring-red-500';

                              return (
                                <div
                                  key={material.id}
                                  className={`flex items-center justify-between p-3 border-2 rounded-xl text-sm transition-all hover:scale-105 ${
                                    material.fileUrl ? `cursor-pointer ${theme === 'ben10' ? 'hover:bg-[#64cc4f]/10' : 'hover:bg-green-50'}` : ''
                                  } ${
                                    isSelected
                                      ? theme === 'ben10'
                                        ? 'border-[#64cc4f] bg-[#64cc4f]/10 shadow-lg'
                                        : theme === 'tinkerbell'
                                        ? 'border-yellow-500 bg-yellow-100 shadow-lg'
                                        : theme === 'bounceworld'
                                        ? 'border-[#1D428A] bg-[#1D428A]/10 shadow-lg'
                                        : 'border-blue-500 bg-blue-100 shadow-lg'
                                      : markStyle || 'border-gray-300 bg-white'
                                  }`}
                                  onClick={() => material.fileUrl && viewMaterial(material)}
                                >
                                  <div className="flex items-center space-x-3 flex-1">
                                    <div className={`w-6 h-6 ${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'tinkerbell' ? 'bg-yellow-500' : theme === 'cricketverse-australian' ? 'bg-[#b38f00]' : theme === 'bounceworld' ? 'bg-[#1D428A]' : theme === 'avengers' ? 'bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#e13690]' : 'bg-blue-500'} rounded-lg flex items-center justify-center flex-shrink-0 border-2 border-black`}>
                                      {getFileIcon(material.fileType)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`font-black truncate text-sm ${
                                        isSelected
                                          ? theme === 'ben10'
                                            ? 'text-[#64cc4f]'
                                            : theme === 'tinkerbell'
                                            ? 'text-yellow-700'
                                            : theme === 'bounceworld'
                                            ? 'text-[#1D428A]'
                                            : theme === 'avengers'
                                            ? 'text-[#604AC7]'
                                            : theme === 'ponyville'
                                            ? 'text-[#e13690]'
                                            : 'text-blue-700'
                                          : 'text-gray-900'
                                      }`}>
                                        {material.title}
                                      </h4>
                                      <div className={`text-xs font-bold ${
                                        theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'tinkerbell' ? 'text-yellow-600' : theme === 'bounceworld' ? 'text-[#C8102E]' : 'text-blue-600'
                                      }`}>
                                        {material.fileType.toUpperCase()}
                                      </div>
                                    </div>
                                  </div>

                                  {material.fileUrl && (
                                    <Eye
                                      className="w-4 h-4 flex-shrink-0 cursor-pointer transition-colors pointer-events-auto font-black"
                                      style={{
                                        color: isSelected 
                                          ? (theme === 'ben10' ? '#22c55e' : theme === 'tinkerbell' ? '#eab308' : theme === 'bounceworld' ? '#1D428A' : '#3b82f6')
                                          : '#9ca3af'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = theme === 'ben10' ? '#16a34a' : theme === 'tinkerbell' ? '#ca8a04' : theme === 'bounceworld' ? '#C8102E' : '#1d4ed8';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = isSelected 
                                          ? (theme === 'ben10' ? '#22c55e' : theme === 'tinkerbell' ? '#eab308' : theme === 'bounceworld' ? '#1D428A' : '#3b82f6')
                                          : '#9ca3af';
                                      }}
                                      onClick={() => viewMaterial(material)}
                                    />
                                  )}

                                  {/* Homework UI */}
                                  {material.isHomework && (
                                    <div className="ml-2 flex items-center space-x-2">
                                      {(() => {
                                         const deadlineStatus = getHomeworkDeadlineStatus(material.dueDate);
                                         return (
                                          <Badge variant="secondary" className={`${
                                            material.dueDate && new Date(material.dueDate) < new Date() 
                                              ? 'border-red-500 text-red-500 bg-red-50' 
                                              : deadlineStatus?.color || 'border-blue-500 text-blue-500 bg-blue-50'
                                          }`}>
                                            {material.homeworkType === 'manual' ? 'Manual Task' : 'Homework'}
                                            {deadlineStatus && !homeworkSubmissions[material.id] && (
                                              <span className="ml-1 border-l border-current pl-1">
                                                {deadlineStatus.label}
                                              </span>
                                            )}
                                          </Badge>
                                         );
                                      })()}
                                      
                                      {homeworkSubmissions[material.id] ? (
                                        <div className="flex items-center space-x-1">
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            homeworkSubmissions[material.id].status === 'resubmit_needed' ? 'bg-orange-100 text-orange-700' :
                                            homeworkSubmissions[material.id].status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                          }`}>
                                            {homeworkSubmissions[material.id].status === 'resubmit_needed' ? 'Resubmit Req' : 'Submitted'}
                                          </span>
                                          {/* Show grade if available */}
                                          {homeworkSubmissions[material.id].teacherMark && (
                                            <span className="text-xs font-bold text-gray-700">
                                              {homeworkSubmissions[material.id].teacherMark}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                         material.dueDate && new Date(material.dueDate) < new Date() && !material.allowLateSubmission ? (
                                          <span className="text-xs text-red-500 font-bold">Closed</span>
                                        ) : (
                                          material.homeworkType !== 'manual' && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedHomework(material);
                                                setShowHomeworkModal(true);
                                              }}
                                              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700 transition"
                                            >
                                              Submit
                                            </button>
                                          )
                                        )
                                      )}
                                    </div>
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
            <div className={`flex-1 ${theme === 'default' ? 'bg-white' : 'bg-gradient-to-br from-white'} ${theme === 'default' ? '' : theme === 'ben10' ? 'to-[#b2e05b]/10' : theme === 'tinkerbell' ? 'to-yellow-50' : theme === 'bounceworld' ? 'to-[#1D428A]/10' : theme === 'avengers' ? 'to-[#C88DA5]/10' : theme === 'ponyville' ? 'to-[#f1aed5]/10' : 'to-blue-50'} overflow-hidden`}>
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
                    <div className={`p-6 border-b-4 bg-gradient-to-r ${theme === 'cricketverse-australian' ? 'border-[#b38f00] bg-white' : theme === 'default' ? 'border-black from-gray-100 to-gray-200' : theme === 'ben10' ? 'border-black from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'border-black from-green-400 to-yellow-500' : theme === 'bounceworld' ? 'border-black from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'border-black from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'border-black from-[#f1aed5] to-[#e13690]' : 'border-black from-blue-500 to-indigo-600'}`}>
                      <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-black ${theme === 'default' || theme === 'cricketverse-australian' ? 'text-black' : 'text-white'} flex items-center`}>
                          {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville' || theme === 'bounceworld') && <span className="mr-2">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'ponyville' ? '🦄' : theme === 'bounceworld' ? '🏀' : ''}</span>}{activeMaterial.title}
                        </h3>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={handleZoomOut}
                            disabled={imageZoom <= 0.1}
                            className={`${theme === 'default' ? 'bg-white text-black border-black hover:bg-black hover:text-white' : 'bg-black text-white border-white hover:bg-white hover:text-black'} p-3 rounded-xl border-2 transition-all duration-300 font-black`}
                            title="Zoom Out (-)"
                          >
                            <ZoomOut className="h-5 w-5" />
                          </button>
                          <span className={`text-lg font-black ${theme === 'default' ? 'text-black' : 'text-white'} min-w-[70px] text-center ${theme === 'default' ? 'bg-gray-100' : 'bg-black/20'} rounded-lg px-3 py-2 border-2 ${theme === 'default' ? 'border-black' : 'border-white'}`}>
                            {Math.round(imageZoom * 100)}%
                          </span>
                          <button
                            onClick={handleZoomIn}
                            disabled={imageZoom >= 5}
                            className={`${theme === 'default' ? 'bg-white text-black border-black hover:bg-black hover:text-white' : 'bg-black text-white border-white hover:bg-white hover:text-black'} p-3 rounded-xl border-2 transition-all duration-300 font-black`}
                            title="Zoom In (+)"
                          >
                            <ZoomIn className="h-5 w-5" />
                          </button>
                          <button
                            onClick={handleZoomReset}
                            className={`${theme === 'default' ? 'bg-white text-black border-black hover:bg-black hover:text-white' : 'bg-black text-white border-white hover:bg-white hover:text-black'} p-3 rounded-xl border-2 transition-all duration-300 font-black`}
                            title="Reset Zoom (0)"
                          >
                            <RotateCcw className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <div className={`text-sm font-black ${theme === 'default' ? 'text-black' : 'text-white/90'} mt-3 text-center`}>
                        🖱️ Use mouse to drag when zoomed • ⌨️ Keyboard: + zoom in, - zoom out, 0 reset ⚡
                      </div>
                    </div>
                    <div
                      className={`flex-1 flex items-center justify-center p-6 ${theme === 'default' ? 'bg-white' : 'bg-gradient-to-br'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f]/10 to-white' : theme === 'tinkerbell' ? 'from-yellow-50 to-green-50' : theme === 'bounceworld' ? 'from-[#1D428A]/10 to-white' : theme === 'avengers' ? 'from-[#C88DA5]/10 to-white' : 'from-blue-50 to-indigo-50'} overflow-hidden relative`}
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
                    <div className={`p-6 border-b-4 bg-gradient-to-r ${theme === 'cricketverse-australian' ? 'border-[#b38f00] bg-white' : theme === 'default' ? 'border-black from-gray-100 to-gray-200' : theme === 'ben10' ? 'border-black from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'border-black from-green-400 to-yellow-500' : theme === 'avengers' ? 'border-black from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'border-black from-[#f1aed5] to-[#e13690]' : 'border-black from-blue-500 to-indigo-600'}`}>
                      <h3 className={`text-xl font-black ${theme === 'default' || theme === 'cricketverse-australian' ? 'text-black' : 'text-white'} flex items-center`}>
                        {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <span className="mr-2">🎥</span>}{activeMaterial.title}
                      </h3>
                    </div>
                    <div className={`flex-1 flex items-center justify-center p-6 ${theme === 'default' ? 'bg-white' : 'bg-gradient-to-br'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f]/10 to-white' : theme === 'avengers' ? 'from-[#C88DA5]/10 to-white' : 'from-green-50 to-white'}`}>
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
                    <div className={`p-6 border-b-4 bg-gradient-to-r ${theme === 'cricketverse-australian' ? 'border-[#b38f00] bg-white' : theme === 'default' ? 'border-black from-gray-100 to-gray-200' : theme === 'ben10' ? 'border-black from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'border-black from-green-400 to-yellow-500' : theme === 'avengers' ? 'border-black from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'border-black from-[#f1aed5] to-[#e13690]' : 'border-black from-blue-500 to-indigo-600'}`}>
                      <h3 className={`text-xl font-black ${theme === 'default' || theme === 'cricketverse-australian' ? 'text-black' : 'text-white'} flex items-center`}>
                        {(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') && <span className="mr-2">🔗</span>}{activeMaterial.title}
                      </h3>
                    </div>
                    <div className={`flex-1 flex items-center justify-center p-6 ${theme === 'default' ? 'bg-white' : 'bg-gradient-to-br'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f]/10 to-white' : theme === 'avengers' ? 'from-[#C88DA5]/10 to-white' : 'from-green-50 to-white'}`}>
                      <div className="text-center space-y-8 max-w-md">
                        <div className={`w-20 h-20 ${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'from-yellow-400 to-green-500' : theme === 'avengers' ? 'from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690]' : 'from-blue-400 to-indigo-600'} rounded-3xl flex items-center justify-center mx-auto border-4 border-black shadow-2xl`}>
                          <Link className={`h-10 w-10 ${theme === 'default' ? 'text-black' : 'text-white'} font-black`} />
                        </div>
                        <div>
                          <h4 className="text-2xl font-black text-gray-900 mb-4"> External Link </h4>
                          <p className="text-sm font-bold text-gray-700 mb-6 break-all bg-white p-4 rounded-2xl border-2 border-black shadow-lg">{activeMaterial.fileUrl}</p>
                        </div>
                        <button
                          onClick={() => window.open(activeMaterial.fileUrl, '_blank')}
                          className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : theme === 'tinkerbell' ? 'from-yellow-400 to-green-500 hover:from-green-500 hover:to-yellow-500' : theme === 'cricketverse-australian' ? 'from-[#b38f00] to-[#ffd700] hover:from-[#ffd700] hover:to-[#b38f00]' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f]' : 'from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-700'} text-white font-black px-8 py-4 rounded-2xl border-4 border-black shadow-2xl hover:shadow-3xl transition-all duration-300 text-lg`}
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
      <div className={`min-h-screen bg-gradient-to-br ${theme === 'default' ? 'from-gray-50 via-gray-100 to-gray-50' : theme === 'ben10' ? '' : theme === 'tinkerbell' ? 'from-green-500 via-yellow-500 to-green-600' : theme === 'cricketverse' ? 'from-blue-400 to-indigo-600' : theme === 'cricketverse-australian' ? '' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-blue-600 via-indigo-700 to-blue-400'} p-6`} style={theme === 'ben10' ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' } : theme === 'cricketverse' ? { background: 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))' } : theme === 'cricketverse-australian' ? { background: 'linear-gradient(to bottom right, rgb(255, 255, 42) 0%, rgb(255, 255, 42) 40%, rgb(134, 250, 92) 60%, rgb(255, 255, 42) 100%)' } : undefined}>
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

            <div className={`bg-gradient-to-r ${theme === 'default' ? 'from-gray-100 to-gray-200' : theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-400 to-yellow-500' : theme === 'cricketverse-australian' ? 'bg-[#fff800]' : theme === 'bounceworld' ? 'from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#5323f0]' : theme === 'ponyville' ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : 'from-blue-500 to-indigo-600'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#604AC7]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'} p-8 mb-8`}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className={`text-4xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'} flex items-center`}>
                     {currentClass?.name} 
                  </h1>
                  <p className={`font-bold text-2xl ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>{currentClass?.subject}</p>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                    {currentClass?.completedMaterials}/{currentClass?.totalMaterials}
                  </div>
                  <div className={`text-sm font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>Materials Completed </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'from-green-400 to-yellow-500' : theme === 'cricketverse-australian' ? 'bg-[#fff800]' : theme === 'bounceworld' ? 'from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] to-[#604AC7]' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690]' : 'from-blue-500 to-indigo-600'} rounded-3xl shadow-2xl border-4 border-black p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-black ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>Overall Progress</p>
                      <p className={`text-3xl font-black ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>{Math.round(currentClass?.progress || 0)}%</p>
                    </div>
                    <div className="text-4xl">{(theme === 'ben10' || theme === 'tinkerbell') && '📈'}</div>
                  </div>
                  <div className="mt-4 bg-white/20 rounded-full h-3 border-2 border-black">
                    <div
                      className={`${theme === 'default' ? 'bg-gray-600' : theme === 'cricketverse-australian' ? 'bg-black' : 'bg-white'} h-3 rounded-full transition-all duration-300`}
                      style={{ width: `${currentClass?.progress || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-yellow-500 to-green-600' : theme === 'cricketverse-australian' ? 'bg-[#fff800]' : theme === 'bounceworld' ? 'from-[#C8102E] to-[#1D428A]' : theme === 'avengers' ? 'from-[#604AC7] to-[#2C1267]' : theme === 'ponyville' ? 'from-[#e13690] to-[#f1aed5]' : 'from-indigo-700 to-blue-600'} rounded-3xl shadow-2xl border-4 border-black p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-black ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>Required Materials</p>
                      <p className={`text-3xl font-black ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>{Math.round(currentClass?.requiredProgress || 0)}%</p>
                    </div>
                    <div className="text-4xl">{(theme === 'ben10' || theme === 'tinkerbell') && '🏆'}</div>
                  </div>
                  <div className="mt-4 bg-white/20 rounded-full h-3 border-2 border-black">
                    <div
                      className={`${theme === 'default' ? 'bg-gray-600' : theme === 'cricketverse-australian' ? 'bg-black' : 'bg-white'} h-3 rounded-full transition-all duration-300`}
                      style={{ width: `${currentClass?.requiredProgress || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} ${theme === 'default' ? '' : theme === 'ben10' ? 'from-[#b2e05b] to-[#64cc4f]' : theme === 'tinkerbell' ? 'from-green-600 to-yellow-600' : theme === 'cricketverse-australian' ? 'bg-[#fff800]' : theme === 'bounceworld' ? 'from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'from-[#604AC7] to-[#2C1267]' : theme === 'ponyville' ? 'from-[#ff2e9f] to-[#e13690]' : 'from-slate-700 to-indigo-700'} rounded-3xl shadow-2xl border-4 border-black p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-black ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>New This Week</p>
                      <p className={`text-3xl font-black ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>{currentClass?.recentMaterials || 0}</p>
                    </div>
                    
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-3xl shadow-2xl border-4 border-black p-6 mb-8">
              <div className="flex flex-col md:flex-row gap-6 text-black">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={`${(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '🔍 ' : ''}Search materials...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full px-6 py-4 border-2 border-black rounded-2xl focus:ring-4 focus:ring-green-500 focus:border-green-500 font-bold text-lg shadow-lg ${
                      theme === 'ben10' ? 'bg-gradient-to-r from-green-50 to-white' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-50 to-green-50' : theme === 'avengers' ? 'bg-gradient-to-r from-[#C88DA5]/10 to-white' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5]/10 to-white' : 'bg-gradient-to-r from-blue-50 to-indigo-50'
                    }`}
                  />
                </div>
                <div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className={`px-6 py-4 border-2 border-black rounded-2xl focus:ring-4 focus:ring-green-500 focus:border-green-500 font-bold text-lg shadow-lg ${
                      theme === 'ben10' ? 'bg-gradient-to-r from-green-50 to-white' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-50 to-green-50' : theme === 'avengers' ? 'bg-gradient-to-r from-[#C88DA5]/10 to-white' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5]/10 to-white' : 'bg-gradient-to-r from-blue-50 to-indigo-50'
                    }`}
                  >
                    <option value="all">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '🎯 ' : ''}All Materials</option>
                    <option value="required">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '⭐ ' : ''}Required Only</option>
                    <option value="completed">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '✅ ' : ''}Completed</option>
                    <option value="pending">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '⏳ ' : ''}Pending</option>
                    <option value="pdf">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '📄 ' : ''}PDF Files</option>
                    <option value="video">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '🎥 ' : ''}Videos</option>
                    <option value="link">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '🔗 ' : ''}Links</option>
                    <option value="image">{(theme === 'ben10' || theme === 'tinkerbell' || theme === 'ponyville') ? '🖼️ ' : ''}Images</option>
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
                  : theme === 'ponyville'
                  ? 'border-black from-[#f1aed5] to-[#e13690]'
                  : 'border-yellow-400 from-yellow-400 to-green-500'
              }`}></div>
              <p className="text-white font-black text-xl">
                {theme === 'ben10'
                  ? `Loading  materials...`
                  : theme === 'ponyville'
                  ? `✨ Loading magical materials...`
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
                    className={`cursor-pointer p-6 rounded-t-3xl ${
                      theme === 'ben10' ? 'hover:bg-[#64cc4f]/10' : 'hover:bg-green-100'
                    }`}
                    onClick={() => toggleGroupExpansion(group.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 border-black ${
                          theme === 'ben10'
                            ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b]'
                            : theme === 'cricketverse-australian'
                            ? 'bg-[#fff800]'
                            : theme === 'ponyville'
                            ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690]'
                            : 'bg-gradient-to-r from-yellow-400 to-green-500'
                        }`}>
                          {group.isGroup ? (
                            <div className={`font-black text-lg ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>
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
                              <CheckCircle className={`w-6 h-6 ${theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'cricketverse-australian' ? 'text-black' : 'text-green-600'} flex-shrink-0 font-black`} />
                            )}
                            {isExpanded ? (
                              <ChevronUp className={`w-6 h-6 ${theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'cricketverse-australian' ? 'text-black' : 'text-green-600'} flex-shrink-0 font-black`} />
                            ) : (
                              <ChevronDown className={`w-6 h-6 ${theme === 'ben10' ? 'text-[#64cc4f]' : theme === 'cricketverse-australian' ? 'text-black' : 'text-green-600'} flex-shrink-0 font-black`} />
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
                              <span className={`${theme === 'ben10' ? 'bg-[#64cc4f]' : theme === 'cricketverse-australian' ? 'bg-[#fff800] text-black' : 'bg-green-500'} ${theme === 'cricketverse-australian' ? 'text-black' : 'text-white'} font-black text-sm px-3 py-1 rounded-lg border border-black`}>
                                📁 {group.totalFiles} files
                              </span>
                            )}
                            {group.fileTypes.map((fileType: string) => (
                              <span key={fileType} className="text-white font-black text-sm px-3 py-1 rounded-lg border border-black" style={{
                                backgroundColor: theme === 'ben10' ? '#16a34a' : theme === 'tinkerbell' ? '#ca8a04' : theme === 'ponyville' ? '#e13690' : '#2563eb'
                              }}>
                                {fileType.toUpperCase()}
                              </span>
                            ))}
                            {group.isRequired && (
                              <span className="bg-red-500 text-white font-black text-sm px-3 py-1 rounded-lg border border-black">
                                ⭐ Required
                              </span>
                            )}
                            {group.lessonName && (
                              <span className={`text-white font-black text-sm px-3 py-1 rounded-lg border border-black ${theme === 'cricketverse-australian' ? 'bg-[#b38f00]' : 'bg-blue-500'}`}>
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
                                  className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-green-600' : theme === 'tinkerbell' ? 'from-yellow-400 to-green-500' : theme === 'cricketverse-australian' ? 'bg-black' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690]' : 'from-blue-500 to-indigo-600'} h-3 rounded-full transition-all duration-300`}
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
                            {!group.materials[0].isHomework && (
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
                            )}
                            
                            {group.materials[0].fileType === 'link' ? (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLink(group.materials[0].externalUrl || '');
                                }}
                                size="sm"
                                className={theme === 'cricketverse-australian' ? 'bg-[#b38f00] hover:bg-[#ffd700]' : 'bg-blue-600 hover:bg-blue-700'}
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
                    <div className="pt-0 px-6 pb-6">
                      <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                        {group.materials.map((material: any) => {
                          const isSubmitted = material.isHomework && homeworkSubmissions[material.id]?.status === 'submitted';
                          const isCompleted = (material.completedBy?.includes(student?.id || '') || false) || isSubmitted;
                          
                          return (
                            <div key={material.id} className={`flex items-center justify-between p-3 border rounded-lg dark:border-gray-700 transition-colors ${
                              isCompleted 
                                ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' 
                                : 'border-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}>
                              <div className="flex items-center space-x-3 flex-1">
                                <div className={`w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 border ${theme === 'ponyville' ? 'border-black' : ''}`}>
                                  {getFileIcon(material.fileType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    {isCompleted && (
                                      <CheckCircle className={`w-4 h-4 ${theme === 'ben10' ? 'text-[#64cc4f]' : 'text-green-600'} flex-shrink-0`} />
                                    )}
                                    <h4 className={`font-medium truncate ${
                                      isCompleted 
                                        ? theme === 'ben10' 
                                          ? 'text-[#64cc4f] dark:text-[#64cc4f]' 
                                          : 'text-green-700 dark:text-green-400' 
                                        : 'text-gray-900 dark:text-white'
                                    }`}>
                                      {material.title}
                                    </h4>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {material.formattedFileSize || '2.3 MB'} • {material.fileType.toUpperCase()}
                                  </div>
                                  
                                  {/* Homework Badge & Status */}
                                  {material.isHomework && (
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                          {/* Explicit Due Date Display */}
                                          {material.dueDate && (
                                              <div className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600">
                                                  <Calendar className="w-3 h-3 mr-1.5" />
                                                  <span>
                                                      {new Date(material.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                  </span>
                                                  <span className="mx-1.5 text-gray-300">|</span>
                                                  <Clock className="w-3 h-3 mr-1.5" />
                                                  <span>
                                                      {new Date(material.dueDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                  </span>
                                              </div>
                                          )}


                                          {/* Status Badge */}
                                          {(() => {
                                             const deadlineStatus = getHomeworkDeadlineStatus(material.dueDate);
                                             return (
                                              <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-md border shadow-sm ${
                                                  material.dueDate && new Date(material.dueDate) < new Date() 
                                                  ? 'border-red-200 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' 
                                                  : deadlineStatus?.color || 'border-blue-200 bg-blue-50 text-blue-600'
                                              }`}>
                                                  <span className="mr-1.5">
                                                      {material.homeworkType === 'manual' ? '📝 Manual Task' : '🏠 Homework'}
                                                  </span>
                                                  
                                                  {deadlineStatus && !homeworkSubmissions[material.id] && (
                                                      <>
                                                          <span className="mr-1.5 text-current opacity-50">•</span>
                                                          <span>
                                                              {deadlineStatus.label}
                                                          </span>
                                                      </>
                                                  )}
                                              </div>
                                             );
                                          })()}

                                          {/* Submission Status */}
                                          {homeworkSubmissions[material.id] && (
                                               <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-md border ${
                                                  homeworkSubmissions[material.id].status === 'resubmit_needed' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                  homeworkSubmissions[material.id].status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                  'bg-green-100 text-green-700 border-green-200'
                                              }`}>
                                                  {homeworkSubmissions[material.id].status === 'resubmit_needed' ? '⚠️ Resubmit Req' : '✅ Submitted'}
                                              </div>
                                          )}
                                      </div>
                                  )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center space-x-2 ml-4">
                                  {material.isHomework && !homeworkSubmissions[material.id] && (
                                      material.dueDate && new Date(material.dueDate) < new Date() && !material.allowLateSubmission ? (
                                           <span className="text-xs text-red-500 font-bold px-3">Closed</span>
                                      ) : (
                                          material.homeworkType !== 'manual' && (
                                          <Button
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedHomework(material);
                                                  setShowHomeworkModal(true);
                                              }}
                                              size="sm"
                                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 h-8"
                                          >
                                              Submit
                                          </Button>
                                          )
                                      )
                                  )}
                                  
                                  {/* Resubmit Button */}
                                  {material.isHomework && 
                                   homeworkSubmissions[material.id] && 
                                   homeworkSubmissions[material.id].status === 'resubmit_needed' && 
                                   material.homeworkType !== 'manual' && (
                                      <Button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedHomework(material);
                                              setShowHomeworkModal(true);
                                          }}
                                          size="sm"
                                          className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1 h-8 mr-2"
                                      >
                                          Resubmit
                                      </Button>
                                  )}

                                  {/* View Submission Button */}
                                  {material.isHomework && homeworkSubmissions[material.id] && material.homeworkType !== 'manual' && (
                                      <Button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedHomework(material);
                                              setShowHomeworkModal(true);
                                          }}
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-8"
                                      >
                                          View Submission
                                      </Button>
                                  )}
                                </div>
                              
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {/* Completion Toggle Button */}
                                {!material.isHomework && (
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
                                )}

                                {/* Action Button */}
                                {material.fileType === 'link' ? (
                                  <Button
                                    onClick={() => openLink(material.externalUrl || '')}
                                    size="sm"
                                    className={theme === 'cricketverse-australian' ? 'bg-[#b38f00] hover:bg-[#ffd700]' : 'bg-blue-600 hover:bg-blue-700'}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      {/* Homework Submission Modal */}
      {student && selectedHomework && selectedClass && (
        <HomeworkSubmissionModal
          isOpen={showHomeworkModal}
          onClose={() => {
            setShowHomeworkModal(false);
            setSelectedHomework(null);
            // Reload to get updated submission
            if (selectedClass) loadClassMaterials(selectedClass);
          }}
          material={selectedHomework as any} 
          studentId={student.id}
          studentName={student.name}
          classId={selectedClass}
          existingSubmission={homeworkSubmissions[selectedHomework.id]}
          theme={theme || 'default'}
        />
      )}
      </div>
    </div>
  );
  }

  return (
    <div key={`study-${theme}`} className={`min-h-screen bg-gradient-to-br p-6 ${
      theme === 'ben10'
        ? ''
        : theme === 'tinkerbell'
        ? 'from-green-400 via-green-400 to-yellow-500'
        : theme === 'cricketverse'
        ? 'from-blue-400 to-indigo-600'
        : theme === 'cricketverse-australian'
        ? ''
        : theme === 'bounceworld'
        ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20'
        : theme === 'avengers'
        ? 'from-[#b9a2ef] to-[#c9b0f6]'
        : theme === 'ponyville'
        ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
        : 'from-gray-100 to-white'
    }`} style={theme === 'ben10' ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' } : theme === 'cricketverse' ? { background: 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))' } : theme === 'cricketverse-australian' ? { background: 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)' } : undefined}>
      <div className="max-w-6xl mx-auto">
        {/* Theme-aware Hero Header */}
        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-black' : theme === 'ponyville' ? 'border-black' : theme === 'cricketverse' ? 'border-blue-600' : 'border-black'} p-8 mb-8 relative overflow-hidden ${
          theme === 'ben10'
            ? 'from-[#64cc4f] to-[#4dac55]'
            : theme === 'tinkerbell'
            ? 'from-green-400 via-green-500 to-yellow-500'
            : theme === 'cricketverse'
            ? 'from-blue-400 to-indigo-600'
            : theme === 'cricketverse-australian'
            ? 'bg-white'
            : theme === 'bounceworld'
            ? 'from-[#1D428A] via-white to-[#C8102E]'
            : theme === 'avengers'
            ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]'
            : theme === 'ponyville'
            ? 'from-[#f1aed5] via-[#f46eb5] to-[#f55eaf]'
            : 'from-gray-100 to-gray-200'
        }`}>
          <div className="flex items-center space-x-4 relative z-10">
            {theme === 'cricketverse' ? (
              <img src="/indian/batman1.png" alt="Batman" className="w-40 h-32 object-contain" />
            ) : theme === 'ponyville' ? (
              <img src="/ponyville/rainbow-dash.png" alt="Rainbow Dash" className="w-24 h-24 object-contain" />
            ) : theme === 'avengers' ? (
              <img src="/avengers/pngegg.png" alt="Avengers Hero" className="w-24 h-24 object-contain" />
            ) : theme === 'bounceworld' ? (
              <img src="/bounce-world.png" alt="Bounce World" className="w-32 h-32 object-contain" />
            ) : (
              <div className="text-6xl">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : ''}</div>
            )}
            <div>
              <h1 className={`text-4xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'} mb-2 flex items-center`}>
                <span>Your</span>
                <span className={`ml-2 font-black text-4xl ${theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-white' : 'text-black'}`}>Study</span>
              </h1>
              <p className={`font-bold text-lg ${
                theme === 'ben10' ? 'text-green-200' : theme === 'tinkerbell' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : 'text-gray-700'
              }`}>
                {theme === 'bounceworld'
                  ? `Welcome back, ${student.name}! Score big with your studies! 🏀`
                  : theme === 'avengers'
                  ? `Welcome back, ${student.name}! Assemble your knowledge! 🦸‍♂️`
                  : theme === 'ponyville'
                  ? `Welcome back, ${student.name}! Let's cast some magical study spells! ✨`
                  : theme === 'cricketverse'
                  ? `Welcome back, ${student.name}! Hit a six with your studies! 🏏`
                  : theme === 'cricketverse-australian'
                  ? `Welcome back, ${student.name}! Access your study materials! 📚`
                  : theme === 'ben10'
                  ? `Welcome back, ${student.name}! Access your study materials!`
                  : `Welcome back, ${student.name}! Access your study materials!`}
              </p>
            </div>
          </div>
        </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-black' : theme === 'ponyville' ? 'border-black' : 'border-black'} p-6 ${
          theme === 'ben10'
            ? 'from-[#64cc4f] to-[#3e7e19]'
            : theme === 'tinkerbell'
            ? 'from-green-400 to-yellow-500'
            : theme === 'cricketverse-australian'
            ? 'from-white  to-[#ffff2a]'
            : theme === 'bounceworld'
            ? 'from-[#1D428A] via-white to-[#C8102E]'
            : theme === 'avengers'
            ? 'from-[#6d3ddc] to-[#604AC7]'
            : theme === 'ponyville'
            ? 'from-[#f1aed5] to-[#e13690]'
            : 'from-gray-100 to-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                Overall Progress
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`text-2xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                  {Math.round(overallProgress)}%
                </span>
                <Badge className={`font-black border-2 border-black ${
                  getProgressColor(overallProgress) === 'bg-[#64cc4f]' ? 'bg-[#b2e05b]' :
                  getProgressColor(overallProgress) === 'bg-blue-500' ? 'bg-blue-400' :
                  getProgressColor(overallProgress) === 'bg-[#b2e05b]' ? 'bg-[#64cc4f]' :
                  getProgressColor(overallProgress) === 'bg-yellow-500' ? 'bg-yellow-400' : 'bg-red-400'
                }`}>
                  {getProgressText(overallProgress)}
                </Badge>
              </div>
            </div>
            <div className="text-4xl">{theme === 'ben10' ? '📈' : theme === 'tinkerbell' ? '📊' : theme === 'bounceworld' ? '🏀' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '✨' : '📚'}</div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2 border-2 border-black">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                theme === 'ben10' ? 'bg-white' : theme === 'tinkerbell' ? 'bg-white' : theme === 'cricketverse-australian' ? 'bg-black' : theme === 'bounceworld' ? 'bg-white' : theme === 'avengers' ? 'bg-white' : theme === 'ponyville' ? 'bg-white' : 'bg-gray-500'
              }`}
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>

        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'avengers' ? 'border-black' : theme === 'ponyville' ? 'border-black' : 'border-black'} p-6 ${
          theme === 'ben10'
            ? 'from-[#64cc4f] to-[#3e7e19]'
            : theme === 'tinkerbell'
            ? 'from-green-400 to-yellow-500'
            : theme === 'cricketverse-australian'
            ? 'from-white  to-[#ffff2a]'
            : theme === 'bounceworld'
            ? 'from-[#1D428A] via-white to-[#C8102E]'
            : theme === 'avengers'
            ? 'from-[#6d3ddc] to-[#604AC7]'
            : theme === 'ponyville'
            ? 'from-[#f1aed5] to-[#e13690]'
            : 'from-gray-100 to-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                Required Materials
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`text-2xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                  {Math.round(requiredProgress)}%
                </span>
              </div>
            </div>
            <div className="text-4xl">🏆</div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2 border-2 border-black">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                theme === 'ben10' ? 'bg-white' : theme === 'tinkerbell' ? 'bg-white' : theme === 'cricketverse-australian' ? 'bg-black' : theme === 'bounceworld' ? 'bg-white' : theme === 'avengers' ? 'bg-white' : theme === 'ponyville' ? 'bg-white' : 'bg-gray-500'
              }`}
              style={{ width: `${requiredProgress}%` }}
            ></div>
          </div>
        </div>

        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-black' : theme === 'ponyville' ? 'border-black' : 'border-black'} p-6 ${
          theme === 'ben10'
            ? 'from-[#64cc4f] to-[#3e7e19]'
            : theme === 'tinkerbell'
            ? 'from-green-400 to-yellow-500'
            : theme === 'cricketverse-australian'
            ? 'from-white  to-[#ffff2a]'
            : theme === 'bounceworld'
            ? 'from-[#1D428A] via-white to-[#C8102E]'
            : theme === 'avengers'
            ? 'from-[#6d3ddc] to-[#604AC7]'
            : theme === 'ponyville'
            ? 'from-[#f1aed5] to-[#e13690]'
            : 'from-gray-100 to-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                {theme === 'ben10' ? 'Your Classes' : 'Your Classes'}
              </p>
              <p className={`text-3xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'} mt-2`}>
                {classes.length}
              </p>
            </div>

          </div>
        </div>

        <div className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-black' : theme === 'ponyville' ? 'border-black' : 'border-black'} p-6 ${
          theme === 'ben10'
            ? 'from-[#64cc4f] to-[#3e7e19]'
            : theme === 'tinkerbell'
            ? 'from-green-400 to-yellow-500'
            : theme === 'cricketverse-australian'
            ? 'from-white  to-[#ffff2a]'
            : theme === 'bounceworld'
            ? 'from-[#1D428A] via-white to-[#C8102E]'
            : theme === 'avengers'
            ? 'from-[#6d3ddc] to-[#604AC7]'
            : theme === 'ponyville'
            ? 'from-[#f1aed5] to-[#e13690]'
            : 'from-gray-100 to-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>
                New This Week
              </p>
              <p className={`text-3xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'} mt-2`}>
                {classes.reduce((sum, cls) => sum + cls.recentMaterials, 0)}
              </p>
            </div>
          
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="mb-8">
        <h2 className={`text-3xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'} mb-6 text-center rounded-3xl p-4 border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-black' : theme === 'ponyville' ? 'border-black' : 'border-black'} shadow-2xl ${
          theme === 'ben10'
            ? 'bg-gradient-to-r from-[#64cc4f] to-[#3e7e19]'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-green-400 to-yellow-500'
            : theme === 'cricketverse-australian'
            ? 'bg-white'
            : theme === 'bounceworld'
            ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]'
            : theme === 'avengers'
            ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]'
            : theme === 'ponyville'
            ? 'bg-gradient-to-r from-[#fb91cf] via-[#f18ac6] to-[#f596cd]'
            : 'bg-gradient-to-r from-gray-100 to-gray-200'
        }`}>
          {theme === 'bounceworld' ? 'Your Classes' : theme === 'ponyville' ? '✨ Your Magical Classes ✨' : theme === 'ben10' ? ' Your Classes ' : ' Your Classes '}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div key={classItem.id} className={`bg-gradient-to-r rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#C8102E]' : theme === 'avengers' ? 'border-black' : theme === 'ponyville' ? 'border-black' : 'border-black'} hover:shadow-3xl transition-all duration-300 cursor-pointer hover:scale-105 ${
              theme === 'ben10'
                ? 'from-[#64cc4f] to-[#3e7e19]'
                : theme === 'tinkerbell'
                ? 'from-green-400 to-yellow-500'
                : theme === 'cricketverse-australian'
                ? 'bg-white'
                : theme === 'bounceworld'
                ? 'from-[#1D428A]  to-[#C8102E]'
                : theme === 'avengers'
                ? 'from-[#6d3ddc] to-[#604AC7]'
                : theme === 'ponyville'
                ? 'from-[#f1aed5] to-[#f1aed5]'
                : 'from-gray-100 to-gray-200'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>{classItem.name}</h3>
                  {classItem.recentMaterials > 0 && (
                    <Badge className={`font-black border-2 border-black ${
                      theme === 'ben10' ? 'bg-yellow-400 text-black' : theme === 'tinkerbell' ? 'bg-green-400 text-black' : theme === 'cricketverse-australian' ? 'bg-[#ffd700] text-black' : theme === 'bounceworld' ? 'bg-[#C8102E] text-white' : theme === 'avengers' ? 'bg-[#604AC7] text-white' : 'bg-blue-300 text-white'
                    }`}>
                       {classItem.recentMaterials} new
                    </Badge>
                  )}
                </div>
                <p className={`text-3xl font-black mb-4 ${
                  theme === 'ben10' ? 'text-white/90' : theme === 'tinkerbell' ? 'text-white/90' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'bounceworld' ? 'text-white/90' : theme === 'avengers' ? 'text-white/90' : theme === 'ponyville' ? 'text-white/90' : 'text-gray-600'
                }`}>{classItem.subject}</p>

                <div className="space-y-4">
                  <div>
                    <div className={`flex justify-between text-sm font-black ${theme === 'avengers' || theme === 'bounceworld' ? 'text-white' : 'text-black'} mb-2`}>
                      <span>Overall Progress</span>
                      <span>{Math.round(classItem.progress)}%</span>
                    </div>
                    <div className="bg-white/20 rounded-full h-3 border-2 border-black">
                      <div
                        className={`${theme === 'default' ? 'bg-gray-600' : 'bg-black'} h-3 rounded-full transition-all duration-300`}
                        style={{ width: `${classItem.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className={`flex justify-between text-sm font-black ${theme === 'avengers' || theme === 'bounceworld' ? 'text-white' : 'text-black'} mb-2`}>
                      <span>Required Materials</span>
                      <span>{classItem.completedRequired}/{classItem.requiredMaterials}</span>
                    </div>
                    <div className="bg-white/20 rounded-full h-3 border-2 border-black">
                      <div
                        className={`${theme === 'default' ? 'bg-gray-600' : 'bg-black'} h-3 rounded-full transition-all duration-300`}
                        style={{ width: `${classItem.requiredProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className={`flex justify-between text-sm font-black ${theme === 'avengers' || theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>
                    <span>Total Materials</span>
                    <span>{classItem.completedMaterials}/{classItem.totalMaterials}</span>
                  </div>

                  <button
                    onClick={() => loadClassMaterials(classItem.id)}
                    className="w-full mt-4 bg-black text-white font-black py-3 px-6 rounded-2xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 shadow-lg"
                  >
                    {theme === 'ben10' ? ' View Materials ' : theme === 'ponyville' ? '✨ View Magical Materials ✨' : ' View Materials '}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Loading Skeleton for Classes */}
      {classesLoading && classes.length === 0 && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-3xl bg-gray-200 animate-pulse"></div>
            ))}
         </div>
      )}

      {!classesLoading && classes.length === 0 && (
        <div className={`${theme === 'default' ? 'bg-white' : 'bg-gradient-to-r'} rounded-3xl shadow-2xl border-4 ${theme === 'ponyville' ? 'border-black' : 'border-black'} text-center py-12 ${
          theme === 'default' ? '' : theme === 'ben10'
            ? 'from-green-500 to-green-600'
            : theme === 'tinkerbell'
            ? 'from-yellow-400 to-green-500'
            : theme === 'cricketverse-australian'
            ? 'bg-[#fff800]'
            : theme === 'avengers'
            ? 'from-[#2C1267] to-[#604AC7]'
            : theme === 'ponyville'
            ? 'from-[#f1aed5] to-[#e13690]'
            : 'from-blue-500 to-indigo-600'
        }`}>
          <div className="p-8">
            <div className="text-6xl mb-4">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'avengers' ? '🦸‍♂️' : theme === 'ponyville' ? '✨' : ''}</div>
            <h3 className={`text-2xl font-black ${theme === 'default' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'} mb-4`}>
              {theme === 'ben10' ? 'No Classes Yet!' : theme === 'avengers' ? 'No Classes Yet!' : theme === 'ponyville' ? '✨ No Magical Classes Yet! ✨' : 'No Classes Yet!'}
            </h3>
            <p className={`${theme === 'default' ? 'text-gray-600' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white/90'} font-black mb-6`}>
              {theme === 'ben10'
                ? 'Ready to become a learning hero? Enroll in your first class and start your adventure!'
                : theme === 'tinkerbell'
                ? 'Ready to become a magical learner? Enroll in your first class and start your magical journey!'
                : theme === 'avengers'
                ? 'Ready to become a learning hero? Enroll in your first class and assemble your knowledge!'
                : theme === 'ponyville'
                ? 'Ready to become a magical learner? Enroll in your first class and start casting study spells! ✨'
                : 'Ready to become an enriching learner? Enroll in your first class and start your learning journey!'}
            </p>
            <button
              onClick={() => router.push('/enroll')}
              className="bg-black text-white font-black py-4 px-8 rounded-2xl border-2 border-white hover:bg-white hover:text-black transition-all duration-300 shadow-lg text-lg"
            >
              {theme === 'ben10' ? ' Browse Classes ' : theme === 'ponyville' ? '✨ Browse Magical Classes ✨' : ' Browse Classes '}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
