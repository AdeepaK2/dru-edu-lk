'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  PlayCircle, 
  ExternalLink, 
  FileIcon, 
  Image as ImageIcon,
  AlertCircle, 
  Loader2,
  Plus,
  Tag,
  Trash2,
  Link,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui';
import { createStudyMaterial } from '@/apiservices/studyMaterialFirestoreService';
import { StudyMaterialStorageService } from '@/apiservices/studyMaterialStorageService';
import { StudyMaterialData } from '@/models/studyMaterialSchema';
import { ClassDocument } from '@/models/classSchema';
import { LessonDocument } from '@/models/lessonSchema';
import { LessonFirestoreService } from '@/apiservices/lessonFirestoreService';
import { useTeacherAuth } from '@/hooks/useOptimizedTeacherAuth';

interface StudyMaterialUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classData?: ClassDocument;
  preSelectedLessonId?: string;
}

interface FileUploadItem {
  id: string;
  file?: File;
  title: string;
  fileType: 'pdf' | 'video' | 'image' | 'link' | 'other';
  externalUrl?: string;
  isRequired: boolean;
  tags: string[];
  error?: string;
}

interface GlobalSettings {
  title: string;
  description: string;
  lessonId: string;
  year: number;
  isVisible: boolean;
  order: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  dueDate: string;
  groupingPreference: 'single' | 'group' | 'auto'; // New field for grouping preference
  customGroupId: string; // Custom group ID when user wants to specify
}

export default function StudyMaterialUploadModal({
  isOpen,
  onClose,
  onSuccess,
  classData,
  preSelectedLessonId
}: StudyMaterialUploadModalProps) {
  const { teacher } = useTeacherAuth();
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonDocument[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [totalUploads, setTotalUploads] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    title: '',
    description: '',
    lessonId: preSelectedLessonId || '',
    year: new Date().getFullYear(),
    isVisible: true,
    order: 1,
    difficulty: 'Beginner',
    dueDate: '',
    groupingPreference: 'auto',
    customGroupId: ''
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setGlobalSettings({
        title: '',
        description: '',
        lessonId: preSelectedLessonId || '',
        year: new Date().getFullYear(),
        isVisible: true,
        order: 1,
        difficulty: 'Beginner',
        dueDate: '',
        groupingPreference: 'auto',
        customGroupId: ''
      });
      setFiles([]);
      setError(null);
      setUploadProgress(0);
      setCurrentUpload(0);
      setTotalUploads(0);
    }
  }, [isOpen, preSelectedLessonId]);

  // Load lessons when modal opens and class data is available
  useEffect(() => {
    const loadLessons = async () => {
      if (!isOpen || !classData?.subjectId) return;
      
      try {
        setLoadingLessons(true);
        const lessonsData = await LessonFirestoreService.getLessonsBySubject(classData.subjectId);
        setLessons(lessonsData);
      } catch (err) {
        console.error('Error loading lessons:', err);
        setError('Failed to load lessons');
      } finally {
        setLoadingLessons(false);
      }
    };

    loadLessons();
  }, [isOpen, classData?.subjectId]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addFileUploadItem = (files?: FileList) => {
    if (files && files.length > 0) {
      // Add multiple files
      const newItems: FileUploadItem[] = [];
      Array.from(files).forEach((file) => {
        // Auto-detect file type
        let fileType: FileUploadItem['fileType'] = 'other';
        if (file.type.includes('pdf')) {
          fileType = 'pdf';
        } else if (file.type.startsWith('video/')) {
          fileType = 'video';
        } else if (file.type.startsWith('image/')) {
          fileType = 'image';
        }

        newItems.push({
          id: generateId(),
          file,
          title: file.name.split('.')[0],
          fileType,
          isRequired: false,
          tags: []
        });
      });

      setFiles(prev => [...prev, ...newItems]);
    } else {
      // Add empty link item
      setFiles(prev => [...prev, {
        id: generateId(),
        title: '',
        fileType: 'link',
        externalUrl: '',
        isRequired: false,
        tags: []
      }]);
    }
  };

  const removeFileUploadItem = (id: string) => {
    setFiles(prev => prev.filter(item => item.id !== id));
  };

  const updateFileUploadItem = (id: string, updates: Partial<FileUploadItem>) => {
    setFiles(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const addTagToItem = (id: string, tag: string) => {
    if (tag.trim()) {
      updateFileUploadItem(id, {
        tags: files.find(f => f.id === id)?.tags.includes(tag.trim()) 
          ? files.find(f => f.id === id)?.tags || []
          : [...(files.find(f => f.id === id)?.tags || []), tag.trim()]
      });
    }
  };

  const removeTagFromItem = (id: string, tagToRemove: string) => {
    updateFileUploadItem(id, {
      tags: files.find(f => f.id === id)?.tags.filter(tag => tag !== tagToRemove) || []
    });
  };

  const validateFileItem = (item: FileUploadItem): string | null => {
    if (!item.title.trim()) {
      return 'Title is required';
    }
    if (item.fileType === 'link' && !item.externalUrl?.trim()) {
      return 'URL is required for links';
    }
    if (item.fileType !== 'link' && !item.file) {
      return 'File is required';
    }
    if (item.file) {
      // Validate file type
      const allowedTypes = StudyMaterialStorageService.getAllowedFileTypes(item.fileType);
      if (allowedTypes.length > 0 && !StudyMaterialStorageService.validateFileType(item.file, allowedTypes)) {
        return `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`;
      }
      // Validate file size
      const maxSize = StudyMaterialStorageService.getMaxFileSize(item.fileType);
      if (!StudyMaterialStorageService.validateFileSize(item.file, maxSize)) {
        return `File size too large. Maximum size: ${StudyMaterialStorageService.formatFileSize(maxSize)}`;
      }
    }
    return null;
  };

  const validateForm = (): boolean => {
    if (files.length === 0) {
      setError('Please add at least one material to upload');
      return false;
    }

    if (!classData) {
      setError('Class information is missing');
      return false;
    }

    if (!teacher) {
      setError('Teacher authentication required');
      return false;
    }

    // Validate each file item
    const updatedFiles = files.map(item => {
      const error = validateFileItem(item);
      return { ...item, error: error || undefined };
    });

    setFiles(updatedFiles);

    const hasErrors = updatedFiles.some(item => item.error);
    if (hasErrors) {
      setError('Please fix the errors in the file items above');
      return false;
    }

    setError(null);
    return true;
  };

  const uploadFileToStorage = async (file: File, fileType: string): Promise<string> => {
    if (!classData) {
      throw new Error('Class data is required for file upload');
    }

    try {
      const downloadUrl = await StudyMaterialStorageService.uploadStudyMaterial(
        file,
        classData.id,
        fileType as any,
        (progress) => {
          setUploadProgress(progress);
        }
      );
      return downloadUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setUploading(true);
    setCurrentUpload(0);
    setTotalUploads(files.length);
    setUploadProgress(0);

    try {
      // Determine grouping based on user preference
      let groupId: string | undefined;
      let groupTitle: string | undefined;
      
      if (globalSettings.groupingPreference === 'single') {
        // No grouping - each file is independent
        groupId = undefined;
        groupTitle = undefined;
      } else if (globalSettings.groupingPreference === 'group') {
        // Use custom group ID or generate one
        groupId = globalSettings.customGroupId.trim() || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        groupTitle = globalSettings.title.trim() || `Study Materials - ${new Date().toLocaleDateString()}`;
      } else {
        // Auto mode - group only if multiple files
        if (files.length > 1) {
          groupId = globalSettings.customGroupId.trim() || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          groupTitle = globalSettings.title.trim() || `Study Materials - ${new Date().toLocaleDateString()}`;
        } else {
          groupId = undefined;
          groupTitle = undefined;
        }
      }
      
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        setCurrentUpload(i + 1);

        let fileUrl = '';
        let fileName = '';
        let fileSize = 0;
        let mimeType = '';

        if (item.fileType === 'link') {
          fileUrl = item.externalUrl || '';
          fileName = item.title;
          fileSize = 0;
          mimeType = 'text/html';
        } else if (item.file) {
          fileUrl = await uploadFileToStorage(item.file, item.fileType);
          fileName = item.file.name;
          fileSize = item.file.size;
          mimeType = item.file.type;
        }

        // Find the selected lesson name
        const selectedLesson = lessons.find(lesson => lesson.id === globalSettings.lessonId);
        const lessonName = selectedLesson ? selectedLesson.name : (globalSettings.lessonId ? 'Unknown Lesson' : '');

        // Determine the title based on grouping preference
        let materialTitle = item.title.trim();
        if (globalSettings.groupingPreference === 'single' && globalSettings.title.trim()) {
          // Add prefix to individual titles
          materialTitle = `${globalSettings.title.trim()} - ${item.title.trim()}`;
        }

        // Create study material data with grouping
        const materialData: StudyMaterialData = {
          title: materialTitle,
          description: globalSettings.description.trim(), // Use global description
          classId: classData!.id,
          subjectId: classData!.subjectId,
          teacherId: teacher!.id,
          week: 1,
          weekTitle: 'By Lesson',
          year: globalSettings.year,
          fileUrl,
          fileName,
          fileSize,
          fileType: item.fileType,
          mimeType,
          lessonId: globalSettings.lessonId || undefined,
          lessonName: lessonName || undefined,
          groupId: groupId,
          groupTitle: groupTitle,
          isRequired: item.isRequired,
          isVisible: globalSettings.isVisible,
          order: globalSettings.order + i,
          tags: item.tags,
          difficulty: globalSettings.difficulty,
          dueDate: globalSettings.dueDate ? new Date(globalSettings.dueDate) : undefined,
          externalUrl: item.fileType === 'link' && item.externalUrl ? item.externalUrl : undefined,
          uploadedAt: new Date(),
          viewCount: 0
        };

        // Save to Firestore
        await createStudyMaterial(materialData);
      }

      console.log('✅ All materials uploaded successfully');
      onSuccess();
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload materials');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentUpload(0);
      setTotalUploads(0);
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'video': return <PlayCircle className="w-5 h-5 text-purple-500" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-green-500" />;
      case 'link': return <ExternalLink className="w-5 h-5 text-blue-500" />;
      default: return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload Study Materials
          </h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          {/* Global Settings */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Global Settings</h4>
            
            {/* Grouping Preference Section */}
            {files.length > 0 && (
              <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-300 dark:border-blue-700">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Material Organization
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose how you want to organize your {files.length} material{files.length !== 1 ? 's' : ''}:
                </p>
                
                <div className="space-y-3">
                  {/* Single Components */}
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="groupingPreference"
                      value="single"
                      checked={globalSettings.groupingPreference === 'single'}
                      onChange={(e) => setGlobalSettings(prev => ({ ...prev, groupingPreference: e.target.value as any }))}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        📄 Individual Components
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Each file will be treated as a separate material with its own title and description.
                        {files.length > 1 && " Students will see them as separate items."}
                      </div>
                    </div>
                  </label>
                  
                  {/* Auto Group (default) */}
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="groupingPreference"
                      value="auto"
                      checked={globalSettings.groupingPreference === 'auto'}
                      onChange={(e) => setGlobalSettings(prev => ({ ...prev, groupingPreference: e.target.value as any }))}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        🤖 Smart Organization (Recommended)
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {files.length === 1 
                          ? "Single file will be treated as individual component." 
                          : `Multiple files (${files.length}) will be automatically grouped together as one assignment.`}
                      </div>
                    </div>
                  </label>
                  
                  {/* Custom Group */}
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="groupingPreference"
                      value="group"
                      checked={globalSettings.groupingPreference === 'group'}
                      onChange={(e) => setGlobalSettings(prev => ({ ...prev, groupingPreference: e.target.value as any }))}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        📁 Custom Group
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Group all files together with a custom identifier. Students will see them as one assignment with multiple files.
                      </div>
                      
                      {globalSettings.groupingPreference === 'group' && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Custom Group ID (Optional)
                          </label>
                          <input
                            type="text"
                            value={globalSettings.customGroupId}
                            onChange={(e) => setGlobalSettings(prev => ({ ...prev, customGroupId: e.target.value }))}
                            disabled={uploading}
                            placeholder="e.g., MATH_CH5, WEEK3_MATERIALS, ASSIGNMENT_1"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Leave empty to auto-generate a unique group ID. Use alphanumeric characters and underscores only.
                          </p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
                
                {/* Preview of what will happen */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <h6 className="text-sm font-medium text-gray-900 dark:text-white mb-2">📋 Preview:</h6>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {globalSettings.groupingPreference === 'single' && (
                      <>
                        Students will see <strong>{files.length}</strong> separate material{files.length !== 1 ? 's' : ''} in their list.
                      </>
                    )}
                    {globalSettings.groupingPreference === 'auto' && files.length === 1 && (
                      <>
                        Students will see <strong>1</strong> individual material.
                      </>
                    )}
                    {globalSettings.groupingPreference === 'auto' && files.length > 1 && (
                      <>
                        Students will see <strong>1</strong> grouped assignment containing <strong>{files.length}</strong> files.
                      </>
                    )}
                    {globalSettings.groupingPreference === 'group' && (
                      <>
                        Students will see <strong>1</strong> grouped assignment 
                        {globalSettings.customGroupId.trim() && (
                          <> with ID "<strong>{globalSettings.customGroupId.trim()}</strong>"</>
                        )} containing <strong>{files.length}</strong> file{files.length !== 1 ? 's' : ''}.
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Title field - full width */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {globalSettings.groupingPreference === 'single' 
                  ? 'Default Title Prefix' 
                  : 'Group Title'
                } 
                {((globalSettings.groupingPreference === 'group') || 
                  (globalSettings.groupingPreference === 'auto' && files.length > 1)) && 
                  <span className="text-xs text-blue-600"> (For grouping multiple files)</span>
                }
              </label>
              <input
                type="text"
                value={globalSettings.title}
                onChange={(e) => setGlobalSettings(prev => ({ ...prev, title: e.target.value }))}
                disabled={uploading}
                placeholder={
                  globalSettings.groupingPreference === 'single' 
                    ? "e.g., Math Chapter 5 - (will prefix individual titles)" 
                    : "e.g., Math Chapter 5 Materials, Week 3 Resources..."
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              {globalSettings.groupingPreference === 'single' && globalSettings.title.trim() && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Individual titles will be: "{globalSettings.title.trim()} - [File Name]"
                </p>
              )}
            </div>

            {/* Global Description field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {globalSettings.groupingPreference === 'single' 
                  ? 'Common Description' 
                  : 'Description'
                }
                {((globalSettings.groupingPreference === 'group') || 
                  (globalSettings.groupingPreference === 'auto' && files.length > 1)) && 
                  <span className="text-xs text-blue-600"> (Applied to all files in the group)</span>
                }
                {globalSettings.groupingPreference === 'single' && files.length > 1 && 
                  <span className="text-xs text-blue-600"> (Applied to all individual files)</span>
                }
              </label>
              <textarea
                value={globalSettings.description}
                onChange={(e) => setGlobalSettings(prev => ({ ...prev, description: e.target.value }))}
                disabled={uploading}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                placeholder={
                  globalSettings.groupingPreference === 'single'
                    ? "This description will be applied to all individual materials..."
                    : "Describe what this assignment/material is about..."
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lesson (Optional)
                </label>
                <select
                  value={globalSettings.lessonId}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, lessonId: e.target.value }))}
                  disabled={uploading || loadingLessons}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">No Lesson (General)</option>
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Difficulty Level
                </label>
                <select
                  value={globalSettings.difficulty}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, difficulty: e.target.value as any }))}
                  disabled={uploading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={globalSettings.dueDate}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, dueDate: e.target.value }))}
                  disabled={uploading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year
                </label>
                <input
                  type="number"
                  value={globalSettings.year}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  disabled={uploading}
                  min="2020"
                  max="2030"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Upload Actions */}
          <div className="mb-6 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Add Files</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => addFileUploadItem()}
              disabled={uploading}
              className="flex items-center space-x-2"
            >
              <Link className="w-4 h-4" />
              <span>Add Link</span>
            </Button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.jpg,.jpeg,.png,.gif,.bmp,.svg,.webp,.zip,.rar,.7z"
            onChange={(e) => addFileUploadItem(e.target.files || undefined)}
            className="hidden"
          />

          {/* File Upload Items */}
          <div className="space-y-4">
            {files.map((item, index) => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {/* Item Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      {getFileTypeIcon(item.fileType)}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        Material {index + 1}
                      </h5>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.fileType.toUpperCase()} {item.file && `• ${(item.file.size / 1024 / 1024).toFixed(1)}MB`}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeFileUploadItem(item.id)}
                    disabled={uploading}
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Error for this item */}
                {item.error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-red-700 dark:text-red-300">{item.error}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateFileUploadItem(item.id, { title: e.target.value })}
                      disabled={uploading}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Enter material title"
                    />
                  </div>

                  {/* File Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type
                    </label>
                    <select
                      value={item.fileType}
                      onChange={(e) => updateFileUploadItem(item.id, { fileType: e.target.value as any })}
                      disabled={uploading || item.file !== undefined}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="pdf">PDF Document</option>
                      <option value="video">Video</option>
                      <option value="image">Image</option>
                      <option value="link">External Link</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Description */}
                  {/* URL for links */}
                  {item.fileType === 'link' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        URL *
                      </label>
                      <input
                        type="url"
                        value={item.externalUrl || ''}
                        onChange={(e) => updateFileUploadItem(item.id, { externalUrl: e.target.value })}
                        disabled={uploading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="https://example.com"
                      />
                    </div>
                  )}

                  {/* Tags and Required */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {item.tags.map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-full"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTagFromItem(item.id, tag)}
                            disabled={uploading}
                            className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex">
                      <input
                        type="text"
                        placeholder="Add tag..."
                        disabled={uploading}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTagToItem(item.id, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          const input = e.currentTarget.parentElement?.querySelector('input');
                          if (input) {
                            addTagToItem(item.id, input.value);
                            input.value = '';
                          }
                        }}
                        disabled={uploading}
                        className="rounded-l-none"
                      >
                        <Tag className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`required-${item.id}`}
                      checked={item.isRequired}
                      onChange={(e) => updateFileUploadItem(item.id, { isRequired: e.target.checked })}
                      disabled={uploading}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`required-${item.id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Mark as required
                    </label>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty state */}
            {files.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No materials added yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Add files or links to get started
                </p>
                <div className="flex justify-center space-x-3">
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Add Files</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addFileUploadItem()}
                    className="flex items-center space-x-2"
                  >
                    <Link className="w-4 h-4" />
                    <span>Add Link</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {files.length} material{files.length !== 1 ? 's' : ''} ready to upload
            {uploading && (
              <span className="ml-4">
                Uploading {currentUpload} of {totalUploads}... ({uploadProgress}%)
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <Button 
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={uploading || files.length === 0}
              className="flex items-center space-x-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload All Materials</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
