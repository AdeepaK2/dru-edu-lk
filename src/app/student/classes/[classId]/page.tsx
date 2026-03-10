'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  FileText,
  PlayCircle,
  ExternalLink,
  FileIcon,
  CheckCircle,
  Clock,
  Download,
  Eye,
  ArrowLeft,
  Calendar,
  Target,
  TrendingUp,
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { getStudyMaterialsByClassGroupedByWeek, markMaterialCompleted, unmarkMaterialCompleted, incrementViewCount, incrementDownloadCount } from '@/apiservices/studyMaterialFirestoreService';
import { LessonFirestoreService } from '@/apiservices/lessonFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { StudyMaterialDocument } from '@/models/studyMaterialSchema';
import { usePDFViewer } from '@/components/student/StudentLayout';

interface WeeklyMaterials {
  week: number;
  weekTitle: string;
  materials: StudyMaterialDocument[];
  stats: {
    totalMaterials: number;
    requiredMaterials: number;
    averageCompletion: number;
  };
}

export default function StudentClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { student, loading: authLoading } = useStudentAuth();
  const { openPDFViewer } = usePDFViewer();

  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [weeklyMaterials, setWeeklyMaterials] = useState<WeeklyMaterials[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [processingMaterials, setProcessingMaterials] = useState<Set<string>>(new Set());

  // Load class data and materials
  useEffect(() => {
    const loadClassData = async () => {
      if (!student?.id) return;

      try {
        setLoading(true);
        setError(null);

        // Load class information
        const classInfo = await ClassFirestoreService.getClassById(classId);
        if (!classInfo) {
          setError('Class not found');
          return;
        }
        setClassData(classInfo);

        // Load lessons for badge display
        if (classInfo.subjectId) {
          const lessonData = await LessonFirestoreService.getLessonsBySubject(classInfo.subjectId);
          setLessons(lessonData);
        }

        // Load study materials
        const currentYear = new Date().getFullYear();
        const materialsData = await getStudyMaterialsByClassGroupedByWeek(classId, currentYear);
        setWeeklyMaterials(materialsData);

      } catch (err) {
        console.error('Error loading class data:', err);
        setError('Failed to load class data');
      } finally {
        setLoading(false);
      }
    };

    if (student?.id && classId) {
      loadClassData();
    }
  }, [student?.id, classId]);

  // Toggle week expansion
  const toggleWeekExpansion = (week: number) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(week)) {
      newExpanded.delete(week);
    } else {
      newExpanded.add(week);
    }
    setExpandedWeeks(newExpanded);
  };

  // Handle material completion toggle
  const handleCompletionToggle = async (material: StudyMaterialDocument) => {
    if (!student?.id) return;

    const materialKey = material.id;
    setProcessingMaterials(prev => new Set(prev).add(materialKey));

    try {
      const isCompleted = material.completedBy?.includes(student.id) || false;

      if (isCompleted) {
        await unmarkMaterialCompleted(material.id, student.id);
      } else {
        await markMaterialCompleted(material.id, student.id);
      }

      // Update local state
      setWeeklyMaterials(prevWeeks =>
        prevWeeks.map(week => ({
          ...week,
          materials: week.materials.map(mat => {
            if (mat.id === material.id) {
              const updatedCompletedBy = isCompleted
                ? (mat.completedBy || []).filter(id => id !== student.id)
                : [...(mat.completedBy || []), student.id];
              return { ...mat, completedBy: updatedCompletedBy };
            }
            return mat;
          })
        }))
      );
    } catch (error) {
      console.error('Error toggling material completion:', error);
    } finally {
      setProcessingMaterials(prev => {
        const newSet = new Set(prev);
        newSet.delete(materialKey);
        return newSet;
      });
    }
  };

  // Handle material view/download
  const handleMaterialAction = async (material: StudyMaterialDocument, action: 'view' | 'download') => {
    try {
      if (action === 'view') {
        await incrementViewCount(material.id);
        if (material.fileType === 'pdf' && material.fileUrl) {
          openPDFViewer({ title: material.fileName || material.title, fileUrl: material.fileUrl });
        } else if (material.fileType === 'link') {
          window.open(material.externalUrl || material.fileUrl, '_blank');
        } else {
          window.open(material.fileUrl, '_blank');
        }
      } else if (action === 'download') {
        await incrementDownloadCount(material.id);
        const link = document.createElement('a');
        link.href = material.fileUrl;
        link.download = material.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error(`Error handling material ${action}:`, error);
    }
  };

  // Get lesson badge
  const getLessonBadge = (lessonId?: string) => {
    if (!lessonId) return 'General';
    const lesson = lessons.find(l => l.id === lessonId);
    return lesson ? lesson.name : 'Unknown Lesson';
  };

  // Get file icon based on type
  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'video': case 'mp4': case 'avi': return <PlayCircle className="w-5 h-5 text-purple-500" />;
      case 'link': return <ExternalLink className="w-5 h-5 text-blue-500" />;
      case 'image': case 'jpg': case 'png': return <FileIcon className="w-5 h-5 text-green-500" />;
      default: return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get file type color
  const getFileTypeColor = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'video': case 'mp4': case 'avi': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'link': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'image': case 'jpg': case 'png': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Filter materials based on search and filters
  const filteredWeeklyMaterials = weeklyMaterials
    .map(week => ({
      ...week,
      materials: week.materials.filter(material => {
        const matchesSearch = searchTerm === '' ||
          material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesFilter = filterType === 'all' ||
          (filterType === 'required' && material.isRequired) ||
          (filterType === 'completed' && (material.completedBy?.includes(student?.id || '') || false)) ||
          (filterType === 'pending' && !(material.completedBy?.includes(student?.id || '') || false)) ||
          (filterType === material.fileType);

        return matchesSearch && matchesFilter;
      })
    }))
    .filter(week => week.materials.length > 0);

  // Calculate progress stats
  const totalMaterials = weeklyMaterials.reduce((sum, week) => sum + week.materials.length, 0);
  const completedMaterials = weeklyMaterials.reduce((sum, week) =>
    sum + week.materials.filter(m => m.completedBy?.includes(student?.id || '') || false).length, 0
  );
  const requiredMaterials = weeklyMaterials.reduce((sum, week) =>
    sum + week.materials.filter(m => m.isRequired).length, 0
  );
  const completedRequiredMaterials = weeklyMaterials.reduce((sum, week) =>
    sum + week.materials.filter(m => m.isRequired && (m.completedBy?.includes(student?.id || '') || false)).length, 0
  );

  const progressPercentage = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;
  const requiredProgressPercentage = requiredMaterials > 0 ? Math.round((completedRequiredMaterials / requiredMaterials) * 100) : 100;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading class materials...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Please log in to view class materials.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Class</h3>
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center space-x-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/student/dashboard')}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Button>
      </div>

      {/* Class Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {classData?.name || 'Class Materials'}
            </h1>
            <p className="text-blue-100 mb-4">
              {classData?.subject || 'Subject'} • Track your learning progress
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-200">Your Progress</p>
            <p className="text-3xl font-bold">{progressPercentage}%</p>
            <p className="text-xs text-blue-200">
              {completedMaterials}/{totalMaterials} materials completed
            </p>
          </div>
        </div>
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalMaterials}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Materials</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedMaterials}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-orange-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {completedRequiredMaterials}/{requiredMaterials}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Required</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{requiredProgressPercentage}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Required Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Class Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Class Resources
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Videos */}
            <Link href={`/student/classes/${classData?.id}/videos`}>
              <div className="group p-6 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40 transition-colors">
                    <PlayCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">-</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Video Library
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Access videos with All, Purchased, and Marketplace tabs
                </p>
              </div>
            </Link>

            {/* Tests */}
            <Link href={`/student/classes/${classData?.id}/tests`}>
              <div className="group p-6 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-400 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/40 transition-colors">
                    <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">-</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  Tests & Quizzes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Take tests and quizzes assigned to this class
                </p>
              </div>
            </Link>

            {/* Study Materials */}
            <div className="group p-6 border-2 border-purple-500 dark:border-purple-400 rounded-lg bg-purple-50 dark:bg-purple-900/10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{weeklyMaterials.length}</span>
              </div>
              <h3 className="text-lg font-medium text-purple-600 dark:text-purple-400">
                Study Materials
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Current page - PDFs and study materials for this class
              </p>
            </div>

            {/* Assignments */}
            <Link href={`/student/classes/${classData?.id}/assignments`}>
              <div className="group p-6 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-orange-500 dark:hover:border-orange-400 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900/40 transition-colors">
                    <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">-</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  Assignments
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  View and submit assignments for this class
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Study Materials</h2>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Materials</option>
              <option value="required">Required Only</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="pdf">PDF Documents</option>
              <option value="video">Videos</option>
              <option value="link">External Links</option>
              <option value="image">Images</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[200px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Materials Timeline */}
      {filteredWeeklyMaterials.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {weeklyMaterials.length === 0 ? 'No Study Materials Available' : 'No Materials Match Your Filters'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {weeklyMaterials.length === 0
              ? 'Your teacher hasn\'t uploaded any study materials yet. Check back later.'
              : 'Try adjusting your search terms or filters to find materials.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWeeklyMaterials.map((weekData) => {
            const isExpanded = expandedWeeks.has(weekData.week);
            const weekCompleted = weekData.materials.filter(m => m.completedBy?.includes(student?.id || '') || false).length;
            const weekTotal = weekData.materials.length;
            const weekProgress = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

            return (
              <div key={weekData.week} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {/* Week Header */}
                <button
                  onClick={() => toggleWeekExpansion(weekData.week)}
                  className="w-full bg-gray-50 dark:bg-gray-700 p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Week {weekData.week}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {weekData.weekTitle}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {weekProgress}% complete
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {weekCompleted}/{weekTotal} materials
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${weekProgress >= 80 ? 'bg-green-500' :
                            weekProgress >= 60 ? 'bg-blue-500' :
                              weekProgress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                        style={{ width: `${weekProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </button>

                {/* Week Materials */}
                {isExpanded && (
                  <div className="p-6 space-y-4 border-t border-gray-200 dark:border-gray-700">
                    {weekData.materials.map((material) => {
                      const isCompleted = material.completedBy?.includes(student?.id || '') || false;
                      const isProcessing = processingMaterials.has(material.id);

                      return (
                        <div key={material.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4 flex-1">
                              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                {getFileIcon(material.fileType || 'other')}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h5 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                                    {material.title}
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
                                  {isCompleted && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Completed
                                    </span>
                                  )}
                                </div>

                                {material.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                                    {material.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col space-y-2 flex-shrink-0 ml-4">
                              {/* Action Buttons */}
                              <div className="flex space-x-2">
                                {material.fileType === 'link' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMaterialAction(material, 'view')}
                                    className="flex items-center space-x-1"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    <span className="hidden sm:inline">Open Link</span>
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMaterialAction(material, 'view')}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMaterialAction(material, 'download')}
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>

                              {/* Completion Toggle */}
                              <Button
                                onClick={() => handleCompletionToggle(material)}
                                disabled={isProcessing}
                                className={`flex items-center space-x-1 ${isCompleted
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                                size="sm"
                              >
                                {isProcessing ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Processing...</span>
                                  </>
                                ) : isCompleted ? (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="hidden sm:inline">Completed</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-4 h-4" />
                                    <span className="hidden sm:inline">Mark Complete</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
