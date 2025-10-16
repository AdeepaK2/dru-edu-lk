'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
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
  ChevronUp
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
  const [classes, setClasses] = useState<ClassWithProgress[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [groupedMaterials, setGroupedMaterials] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [materialLoading, setMaterialLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const { openPDFViewer } = usePDFViewer();

  useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
      return;
    }

    if (student) {
      loadStudentClasses();
    }
  }, [student, loading, router]);

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
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
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

    if (material.fileType?.toLowerCase() === 'pdf' && material.fileUrl) {
      console.log('Opening PDF viewer for:', material.title);
      openPDFViewer({ title: material.title, fileUrl: material.fileUrl });
    } else if (material.fileUrl) {
      console.log('Opening external link for:', material.title);
      window.open(material.fileUrl, '_blank');
    } else {
      console.log('No fileUrl found for material:', material.title);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 flex items-center justify-center">
        <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-3xl shadow-2xl border-4 border-black p-12 text-center">
          {/* Mickey Mouse Ears */}
          <div className="absolute -top-4 -left-4 w-12 h-12 bg-black rounded-full"></div>
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-black rounded-full"></div>

          <div className="text-8xl mb-6">📚</div>
          <div className="w-12 h-12 border-t-4 border-black border-solid rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-3xl font-black text-black mb-4">
            Loading Magical Study Materials
          </h2>
          <p className="text-black font-bold text-lg">
            Getting your learning adventures ready! ✨
          </p>
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

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 p-6">
        <div className="mb-6">
          <Button
            onClick={() => setSelectedClass(null)}
            className="mb-4 bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600 text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center space-x-2"
          >
            <span>← Back to Magical Dashboard</span>
          </Button>

          {/* Class Header */}
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-2xl border-4 border-black p-8 mb-6 relative overflow-hidden">
            {/* Mickey Mouse Ears */}
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-black rounded-full"></div>
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-black rounded-full"></div>

            <div className="flex justify-between items-center relative z-10">
              <div>
                <h1 className="text-4xl font-black text-black mb-2 flex items-center">
                  <span className="text-5xl mr-2">🏫</span>
                  {currentClass?.name}
                </h1>
                <p className="text-black font-bold text-lg">{currentClass?.subject}</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-black">
                  {currentClass?.completedMaterials}/{currentClass?.totalMaterials}
                </div>
                <div className="text-lg text-black font-bold">Magical Materials Completed</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-r from-blue-400 to-cyan-400 rounded-3xl shadow-2xl border-4 border-black p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-black mb-2">
                    Overall Progress
                  </p>
                  <p className="text-3xl font-black text-black">{Math.round(currentClass?.progress || 0)}%</p>
                </div>
                <div className="text-4xl">📊</div>
              </div>
              <div className="mt-4 bg-black rounded-full h-4 border-2 border-black">
                <div
                  className="bg-gradient-to-r from-blue-400 to-cyan-400 h-4 rounded-full transition-all duration-300 border-2 border-black"
                  style={{ width: `${currentClass?.progress || 0}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-400 to-emerald-400 rounded-3xl shadow-2xl border-4 border-black p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-black mb-2">
                    Required Materials
                  </p>
                  <p className="text-3xl font-black text-black">{Math.round(currentClass?.requiredProgress || 0)}%</p>
                </div>
                <div className="text-4xl">🏆</div>
              </div>
              <div className="mt-4 bg-black rounded-full h-4 border-2 border-black">
                <div
                  className="bg-gradient-to-r from-green-400 to-lime-400 h-4 rounded-full transition-all duration-300 border-2 border-black"
                  style={{ width: `${currentClass?.requiredProgress || 0}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-400 to-red-400 rounded-3xl shadow-2xl border-4 border-black p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-black mb-2">
                    New This Week
                  </p>
                  <p className="text-3xl font-black text-black">{currentClass?.recentMaterials || 0}</p>
                </div>
                <div className="text-4xl">🕒</div>
              </div>
            </div>
          </div>

          {/* Materials Section */}
          <div className="mb-6">
            <h2 className="text-3xl font-black text-black mb-6 flex items-center">
              <span className="text-4xl mr-3">📖</span>
              Magical Study Materials
              <span className="ml-3 text-2xl">✨</span>
            </h2>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="🔍 Search magical materials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-6 py-3 border-4 border-black rounded-3xl focus:ring-4 focus:ring-yellow-400 focus:border-black bg-white text-black font-bold text-lg placeholder-black/60"
                />
              </div>
              <div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-6 py-3 border-4 border-black rounded-3xl focus:ring-4 focus:ring-yellow-400 focus:border-black bg-white text-black font-bold text-lg"
                >
                  <option value="all">All Materials ✨</option>
                  <option value="required">Required Only 🏆</option>
                  <option value="completed">Completed 🎉</option>
                  <option value="pending">Pending 📝</option>
                  <option value="pdf">PDF Files 📄</option>
                  <option value="video">Videos 🎥</option>
                  <option value="link">Links 🔗</option>
                  <option value="image">Images 🖼️</option>
                </select>
              </div>
            </div>

            {materialLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="bg-gradient-to-r from-blue-400 to-purple-400 rounded-3xl shadow-2xl border-4 border-black p-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-2xl font-black text-black">Loading Magical Materials...</span>
                  </div>
                </div>
              </div>
            ) : groupedMaterials.length === 0 ? (
              <div className="bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200 rounded-3xl shadow-2xl border-4 border-black p-12 text-center">
                <div className="text-6xl mb-6">📚</div>
                <h3 className="text-2xl font-black text-black mb-4">
                  No Materials Found
                </h3>
                <p className="text-black font-bold text-lg">
                  No study materials match your search. Try adjusting your filters!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedMaterials.map((group: any) => {
                  const isExpanded = expandedGroups.has(group.id);
                  const completedCount = group.materials.filter((m: any) => m.completedBy?.includes(student?.id || '')).length;
                  const totalCount = group.materials.length;
                  const isGroupCompleted = completedCount === totalCount;

                  return (
                    <div key={group.id} className={`bg-gradient-to-r ${isGroupCompleted ? 'from-green-400 to-emerald-400' : 'from-indigo-400 via-purple-400 to-pink-400'} rounded-3xl shadow-2xl border-4 border-black overflow-hidden hover:scale-105 transition-all`}>
                      <div
                        className="p-6 cursor-pointer hover:bg-black/10 transition-all"
                        onClick={() => toggleGroupExpansion(group.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 border-4 border-black">
                              {group.isGroup ? (
                                <div className="text-black font-black text-xl">
                                  {group.totalFiles}
                                </div>
                              ) : (
                                <div className="text-3xl">
                                  {group.materials[0]?.fileType === 'pdf' ? '📄' :
                                   group.materials[0]?.fileType === 'video' ? '🎥' :
                                   group.materials[0]?.fileType === 'link' ? '🔗' :
                                   group.materials[0]?.fileType === 'image' ? '🖼️' : '📚'}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-2xl font-black text-black mb-2 flex items-center">
                                <span className="truncate">{group.groupTitle || group.materials[0]?.title}</span>
                                {isGroupCompleted && (
                                  <span className="ml-2 text-2xl">🎉</span>
                                )}
                                <span className="ml-2 text-xl">
                                  {isExpanded ? '🔽' : '▶️'}
                                </span>
                              </h3>

                              {group.materials[0]?.description && (
                                <p className="text-black font-bold text-lg mb-3">
                                  {group.materials[0].description}
                                </p>
                              )}

                              <div className="flex items-center space-x-3 mb-3">
                                {group.isGroup && (
                                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-black bg-white text-black border-2 border-black">
                                    {group.totalFiles} files 📁
                                  </span>
                                )}
                                {group.fileTypes.map((fileType: string) => (
                                  <span key={fileType} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-black bg-white text-black border-2 border-black">
                                    {fileType.toUpperCase()}
                                  </span>
                                ))}
                                {group.isRequired && (
                                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-black bg-red-400 text-white border-2 border-black">
                                    Required 🏆
                                  </span>
                                )}
                                {group.lessonName && (
                                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-black bg-blue-400 text-white border-2 border-black">
                                    {group.lessonName}
                                  </span>
                                )}
                              </div>

                              <div className="text-black font-bold text-lg mb-3">
                                📅 {new Date(group.uploadedAt?.toDate ? group.uploadedAt.toDate() : group.uploadedAt).toLocaleDateString()}
                              </div>

                              {group.isGroup && (
                                <div className="mt-4">
                                  <div className="flex justify-between text-lg mb-2">
                                    <span className="font-black text-black">Progress</span>
                                    <span className="font-black text-black">{completedCount}/{totalCount}</span>
                                  </div>
                                  <div className="bg-black rounded-full h-6 border-2 border-black">
                                    <div
                                      className="bg-gradient-to-r from-yellow-400 to-orange-400 h-6 rounded-full transition-all duration-300 border-2 border-black"
                                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right ml-4">
                            {!group.isGroup ? (
                              <div className="flex space-x-3">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMaterialCompletion(group.materials[0]);
                                  }}
                                  className={`px-4 py-2 rounded-full font-black text-sm border-2 border-black transform hover:scale-105 transition-all ${
                                    group.materials[0].completedBy?.includes(student?.id || '')
                                      ? 'bg-green-400 text-white hover:bg-green-500'
                                      : 'bg-yellow-400 text-black hover:bg-yellow-500'
                                  }`}
                                >
                                  {group.materials[0].completedBy?.includes(student?.id || '') ? '✓ Completed' : 'Mark Complete'}
                                </Button>

                                {group.materials[0].fileType === 'link' ? (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openLink(group.materials[0].externalUrl || '');
                                    }}
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black"
                                  >
                                    🔗 Open Link
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        viewMaterial(group.materials[0]);
                                      }}
                                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black"
                                    >
                                      👁️ View
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadMaterial(group.materials[0]);
                                      }}
                                      className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black"
                                    >
                                      ⬇️ Download
                                    </Button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="text-3xl font-black text-black">
                                  {completedCount}/{totalCount}
                                </div>
                                <div className="text-lg text-black font-bold">completed</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t-4 border-black bg-white/90 p-6">
                          <div className="space-y-4">
                            {group.materials.map((material: any) => {
                              const isCompleted = material.completedBy?.includes(student?.id || '') || false;

                              return (
                                <div key={material.id} className={`flex items-center justify-between p-4 border-4 ${isCompleted ? 'border-green-400 bg-green-100' : 'border-gray-400 bg-white'} rounded-2xl transition-all hover:scale-105`}>
                                  <div className="flex items-center space-x-4 flex-1">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-black">
                                      <div className="text-2xl">
                                        {material.fileType === 'pdf' ? '📄' :
                                         material.fileType === 'video' ? '🎥' :
                                         material.fileType === 'link' ? '🔗' :
                                         material.fileType === 'image' ? '🖼️' : '📚'}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-1">
                                        {isCompleted && (
                                          <span className="text-2xl">✅</span>
                                        )}
                                        <h4 className={`text-xl font-black truncate ${isCompleted ? 'text-green-700' : 'text-black'}`}>
                                          {material.title}
                                        </h4>
                                      </div>
                                      <div className="text-black font-bold">
                                        {material.formattedFileSize || '2.3 MB'} • {material.fileType.toUpperCase()}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-3 flex-shrink-0">
                                    <Button
                                      onClick={() => toggleMaterialCompletion(material)}
                                      className={`px-4 py-2 rounded-full font-black text-sm border-2 border-black transform hover:scale-105 transition-all ${
                                        isCompleted
                                          ? 'bg-green-400 text-white hover:bg-green-500'
                                          : 'bg-yellow-400 text-black hover:bg-yellow-500'
                                      }`}
                                    >
                                      {isCompleted ? '✓ Completed' : 'Mark Complete'}
                                    </Button>

                                    {material.fileType === 'link' ? (
                                      <Button
                                        onClick={() => openLink(material.externalUrl || '')}
                                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black"
                                      >
                                        🔗 Open
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          onClick={() => viewMaterial(material)}
                                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black"
                                        >
                                          👁️ View
                                        </Button>
                                        <Button
                                          onClick={() => downloadMaterial(material)}
                                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black"
                                        >
                                          ⬇️ Download
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 p-6">
      <div className="mb-8">
        {/* Mickey Mouse Header */}
        <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-3xl shadow-2xl border-4 border-black p-8 mb-8 relative overflow-hidden">
          {/* Mickey Mouse Ears */}
          <div className="absolute -top-4 -left-4 w-12 h-12 bg-black rounded-full"></div>
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-black rounded-full"></div>

          <div className="flex items-center space-x-4 relative z-10">
            <div className="text-6xl">📚</div>
            <div>
              <h1 className="text-4xl font-black text-black mb-2 flex items-center">
                <span>Mickey's</span>
                <span className="ml-2 text-white font-black text-5xl">Study</span>
                <span className="ml-2 text-3xl">🎭</span>
              </h1>
              <p className="text-black font-bold text-lg">
                Welcome back, {student.name}! Track your magical learning progress! ✨
              </p>
            </div>
          </div>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-400 to-cyan-400 rounded-3xl shadow-2xl border-4 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-black">
                  Overall Progress
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-3xl font-black text-black">
                    {Math.round(overallProgress)}%
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black border-2 border-black ${
                    overallProgress >= 80 ? 'bg-green-400 text-white' :
                    overallProgress >= 60 ? 'bg-blue-400 text-white' :
                    overallProgress >= 40 ? 'bg-yellow-400 text-black' :
                    'bg-red-400 text-white'
                  }`}>
                    {getProgressText(overallProgress)}
                  </span>
                </div>
              </div>
              <div className="text-4xl">📊</div>
            </div>
            <div className="mt-4 bg-black rounded-full h-4 border-2 border-black">
              <div
                className="bg-gradient-to-r from-yellow-400 to-orange-400 h-4 rounded-full transition-all duration-300 border-2 border-black"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-400 to-emerald-400 rounded-3xl shadow-2xl border-4 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-black">
                  Required Materials
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-3xl font-black text-black">
                    {Math.round(requiredProgress)}%
                  </span>
                </div>
              </div>
              <div className="text-4xl">🏆</div>
            </div>
            <div className="mt-4 bg-black rounded-full h-4 border-2 border-black">
              <div
                className="bg-gradient-to-r from-green-400 to-lime-400 h-4 rounded-full transition-all duration-300 border-2 border-black"
                style={{ width: `${requiredProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-400 to-pink-400 rounded-3xl shadow-2xl border-4 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-black">
                  Enrolled Classes
                </p>
                <p className="text-3xl font-black text-black mt-2">
                  {classes.length}
                </p>
              </div>
              <div className="text-4xl">📖</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-400 to-red-400 rounded-3xl shadow-2xl border-4 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-black">
                  New This Week
                </p>
                <p className="text-3xl font-black text-black mt-2">
                  {classes.reduce((sum, cls) => sum + cls.recentMaterials, 0)}
                </p>
              </div>
              <div className="text-4xl">🕒</div>
            </div>
          </div>
        </div>

      {/* Classes Grid */}
      <div className="mb-8">
        <h2 className="text-3xl font-black text-black mb-8 flex items-center">
          <span className="text-4xl mr-3">🏫</span>
          Your Magical Classes
          <span className="ml-3 text-2xl">✨</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div key={classItem.id} className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 rounded-3xl shadow-2xl border-4 border-black p-6 hover:scale-105 transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-black text-black">{classItem.name}</h3>
                {classItem.recentMaterials > 0 && (
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-black bg-orange-400 text-black border-2 border-black">
                    {classItem.recentMaterials} New! ✨
                  </span>
                )}
              </div>
              <p className="text-black font-bold text-lg mb-6">{classItem.subject}</p>

              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-black text-black">Overall Progress</span>
                    <span className="font-black text-black">{Math.round(classItem.progress)}%</span>
                  </div>
                  <div className="bg-black rounded-full h-4 border-2 border-black">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-cyan-400 h-4 rounded-full transition-all duration-300 border-2 border-black"
                      style={{ width: `${classItem.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-black text-black">Required Materials</span>
                    <span className="font-black text-black">{classItem.completedRequired}/{classItem.requiredMaterials}</span>
                  </div>
                  <div className="bg-black rounded-full h-4 border-2 border-black">
                    <div
                      className="bg-gradient-to-r from-green-400 to-lime-400 h-4 rounded-full transition-all duration-300 border-2 border-black"
                      style={{ width: `${classItem.requiredProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex justify-between text-sm text-black font-bold">
                  <span>Total Materials</span>
                  <span>{classItem.completedMaterials}/{classItem.totalMaterials}</span>
                </div>
              </div>

              <Button
                onClick={() => loadClassMaterials(classItem.id)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center justify-center space-x-2"
              >
                <BookOpen className="w-5 h-5" />
                <span>View Magical Materials</span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {classes.length === 0 && (
        <div className="bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200 rounded-3xl shadow-2xl border-4 border-black p-12 text-center">
          <div className="text-6xl mb-6">📚</div>
          <h3 className="text-2xl font-black text-black mb-4">
            No Magical Classes Yet
          </h3>
          <p className="text-black font-bold text-lg mb-6">
            You haven't enrolled in any classes yet. Time to start your learning adventure!
          </p>
          <Button
            onClick={() => router.push('/enroll')}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black flex items-center space-x-3"
          >
            <BookOpen className="w-5 h-5" />
            <span>Browse Magical Classes</span>
          </Button>
        </div>
      )}
    </div>
    </div>
  );
}