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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            onClick={() => setSelectedClass(null)}
            variant="outline"
            className="mb-4"
          >
            ← Back to Dashboard
          </Button>
          
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {currentClass?.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{currentClass?.subject}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {currentClass?.completedMaterials}/{currentClass?.totalMaterials}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Materials Completed</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Overall Progress</p>
                    <p className="text-2xl font-bold">{Math.round(currentClass?.progress || 0)}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
                <div className="mt-2 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${currentClass?.progress || 0}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Required Materials</p>
                    <p className="text-2xl font-bold">{Math.round(currentClass?.requiredProgress || 0)}%</p>
                  </div>
                  <Award className="w-8 h-8 text-green-500" />
                </div>
                <div className="mt-2 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${currentClass?.requiredProgress || 0}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">New This Week</p>
                    <p className="text-2xl font-bold">{currentClass?.recentMaterials || 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Materials</option>
                <option value="required">Required Only</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="pdf">PDF Files</option>
                <option value="video">Videos</option>
                <option value="link">Links</option>
                <option value="image">Images</option>
              </select>
            </div>
          </div>
        </div>

        {materialLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMaterials.map((group: any) => {
              const isExpanded = expandedGroups.has(group.id);
              const completedCount = group.materials.filter((m: any) => m.completedBy?.includes(student?.id || '')).length;
              const totalCount = group.materials.length;
              const isGroupCompleted = completedCount === totalCount;
              
              return (
                <Card key={group.id} className={`transition-all ${isGroupCompleted ? 'border-green-200 bg-green-50 dark:bg-green-900/10' : ''}`}>
                  <CardHeader 
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 pb-4"
                    onClick={() => toggleGroupExpansion(group.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          {group.isGroup ? (
                            <div className="text-blue-600 font-bold text-sm">
                              {group.totalFiles}
                            </div>
                          ) : (
                            getFileIcon(group.materials[0]?.fileType || 'other')
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="flex items-center space-x-2 mb-2">
                            <span className="truncate">{group.groupTitle || group.materials[0]?.title}</span>
                            {isGroupCompleted && (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                          </CardTitle>
                          
                          {/* Display description from the first material (they all have the same description) */}
                          {group.materials[0]?.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {group.materials[0].description}
                            </p>
                          )}
                          
                          <div className="flex items-center space-x-2 mb-2">
                            {group.isGroup && (
                              <Badge variant="secondary" className="text-xs">
                                {group.totalFiles} files
                              </Badge>
                            )}
                            {group.fileTypes.map((fileType: string) => (
                              <Badge key={fileType} variant="secondary" className="text-xs">
                                {fileType.toUpperCase()}
                              </Badge>
                            ))}
                            {group.isRequired && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                            {group.lessonName && (
                              <Badge variant="secondary" className="text-xs">
                                {group.lessonName}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {new Date(group.uploadedAt?.toDate ? group.uploadedAt.toDate() : group.uploadedAt).toLocaleDateString()}
                          </div>
                          
                          {/* Progress bar for groups */}
                          {group.isGroup && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                <span>Progress</span>
                                <span>{completedCount}/{totalCount}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    isGroupCompleted ? 'bg-green-600' : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
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
                  </CardHeader>
                  
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
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {student.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your learning progress and access your study materials
        </p>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Overall Progress
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(overallProgress)}%
                  </span>
                  <Badge className={getProgressColor(overallProgress)}>
                    {getProgressText(overallProgress)}
                  </Badge>
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-4 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Required Materials
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(requiredProgress)}%
                  </span>
                </div>
              </div>
              <Award className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-4 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${requiredProgress}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Enrolled Classes
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {classes.length}
                </p>
              </div>
              <BookOpen className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  New This Week
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {classes.reduce((sum, cls) => sum + cls.recentMaterials, 0)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your Classes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <Card key={classItem.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{classItem.name}</CardTitle>
                  {classItem.recentMaterials > 0 && (
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      {classItem.recentMaterials} new
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{classItem.subject}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Overall Progress</span>
                      <span>{Math.round(classItem.progress)}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${classItem.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Required Materials</span>
                      <span>{classItem.completedRequired}/{classItem.requiredMaterials}</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${classItem.requiredProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Total Materials</span>
                    <span>{classItem.completedMaterials}/{classItem.totalMaterials}</span>
                  </div>

                  <Button 
                    onClick={() => loadClassMaterials(classItem.id)}
                    className="w-full mt-4"
                  >
                    View Materials
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {classes.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Classes Enrolled
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't enrolled in any classes yet.
            </p>
            <Button onClick={() => router.push('/enroll')}>
              Browse Available Classes
            </Button>
          </CardContent>
        </Card>
      )}

      </div>
   
  );
}