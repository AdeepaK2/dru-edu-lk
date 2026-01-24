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
  Users,
  Settings,
  MoreVertical,
  Check
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
  isHomework: boolean;
  error?: string;
}

interface GlobalSettings {
  title: string;
  description: string;
  lessonId: string;
  isVisible: boolean;
  order: number;
  dueDate: string;
  homeworkType: 'manual' | 'submission';
  manualInstruction: string;
  maxMarks: number;
  allowLateSubmission: boolean;
  lateSubmissionDays: number;
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
  const [showHomeworkConfig, setShowHomeworkConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    title: '',
    description: '',
    lessonId: preSelectedLessonId || '',
    isVisible: true,
    order: 1,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 1 week from now
    homeworkType: 'manual',
    manualInstruction: '',
    maxMarks: 0,
    allowLateSubmission: true,
    lateSubmissionDays: 3
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setGlobalSettings({
        title: '',
        description: '',
        lessonId: preSelectedLessonId || '',
        isVisible: true,
        order: 1,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        homeworkType: 'manual',
        manualInstruction: '',
        maxMarks: 0,
        allowLateSubmission: true,
        lateSubmissionDays: 3
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
          isHomework: false,
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
        isHomework: false,
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
      // Determine grouping automatically
      let groupId: string | undefined;
      let groupTitle: string | undefined;
      
      // Auto mode - group only if multiple files
      if (files.length > 1) {
        groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        groupTitle = globalSettings.title.trim() || `Study Materials - ${new Date().toLocaleDateString()}`;
      } else {
        groupId = undefined;
        groupTitle = undefined;
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
        // If grouped, we might want to use the group title as main title? 
        // Current logic: item title is always the material title.
        // If single file upload with global title set, prepend it?
        // Let's stick to simple: item title is material title.
        if (files.length === 1 && globalSettings.title.trim()) {
           // If single file and global title is set, use global title or prepend it? 
           // Generally for single file, the global 'Title' input acts as the main title if present.
           // But we treat 'Title' input as 'Group Title'.
           // If 1 file, 'Title' input is clearer as THE title.
           materialTitle = globalSettings.title.trim() || item.title.trim();
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
          year: new Date().getFullYear(),
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
          // difficulty removed
          dueDate: globalSettings.dueDate ? new Date(globalSettings.dueDate) : undefined,
          externalUrl: item.fileType === 'link' && item.externalUrl ? item.externalUrl : undefined,
          uploadedAt: new Date(),
          viewCount: 0,
          // Homework data
          isHomework: item.isHomework,
          homeworkType: item.isHomework ? globalSettings.homeworkType : undefined,
          manualInstruction: (item.isHomework && globalSettings.homeworkType === 'manual') ? globalSettings.manualInstruction : undefined,
          maxMarks: (item.isHomework && globalSettings.maxMarks > 0) ? globalSettings.maxMarks : undefined,
          allowLateSubmission: item.isHomework ? globalSettings.allowLateSubmission : true,
          lateSubmissionDays: item.isHomework ? globalSettings.lateSubmissionDays : 3
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
            
            {/* Material Organization (Removed as per user request to stick to auto-grouping) */}
            
            {/* Title field - shown if > 1 file (Group Title) OR if user wants to override single file title */}
                 <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {files.length > 1 ? 'Group Title' : 'Title (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={globalSettings.title}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, title: e.target.value }))}
                    disabled={uploading}
                    placeholder={
                      files.length > 1
                        ? "e.g., Math Chapter 5 Materials"
                        : "Override file name (optional)"
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

            {/* Global Description field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
                <span className="text-xs text-blue-600 ml-2">(Applied to all files)</span>
              </label>
              <textarea
                value={globalSettings.description}
                onChange={(e) => setGlobalSettings(prev => ({ ...prev, description: e.target.value }))}
                disabled={uploading}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Brief description..."
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
            </div>
            
            {/* Homework Configuration Button - Visible if any file is marked as homework */}
            {files.some(f => f.isHomework) && (
              <div className="mt-4 border-t border-blue-200 dark:border-blue-700 pt-4 flex items-center justify-between">
                 <div>
                   <h5 className="font-medium text-gray-900 dark:text-white flex items-center">
                     <Settings className="w-4 h-4 mr-2 text-purple-600" />
                     Homework Settings
                   </h5>
                   <p className="text-sm text-gray-500 dark:text-gray-400">
                     Configure deadlines and type for marked files.
                   </p>
                 </div>
                 <Button
                   type="button"
                   variant="outline"
                   onClick={() => setShowHomeworkConfig(true)}
                   className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20"
                 >
                   Configure
                 </Button>
              </div>
            )}
            
            {!files.some(f => f.isHomework) && files.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                    <p>💡 Tip: Toggle "Homework" on individual files to enable homework settings.</p>
                </div>
            )}
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

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-500">
                      {item.isHomework ? 'Marked as Homework' : 'Standard Material'}
                    </div>
                    <div className="flex items-center space-x-3">
                         <span className={`text-sm font-medium ${item.isHomework ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                           Homework
                         </span>
                         <button
                           type="button"
                           onClick={() => updateFileUploadItem(item.id, { isHomework: !item.isHomework })}
                           className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                             item.isHomework ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                           }`}
                         >
                           <span className="sr-only">Toggle homework</span>
                           <span
                             aria-hidden="true"
                             className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                               item.isHomework ? 'translate-x-5' : 'translate-x-0'
                             }`}
                           />
                         </button>
                    </div>
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

      {/* Homework Configuration Modal */}
      {showHomeworkConfig && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Settings className="w-5 h-5 mr-2 text-purple-600" />
                Homework Settings
              </h3>
              <button
                onClick={() => setShowHomeworkConfig(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Homework Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center transition-all ${globalSettings.homeworkType === 'submission' ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:border-purple-500' : 'border-gray-200 hover:border-purple-200 dark:border-gray-700'}`}>
                        <input
                          type="radio"
                          className="sr-only"
                          value="submission"
                          checked={globalSettings.homeworkType === 'submission'}
                          onChange={() => setGlobalSettings(prev => ({ ...prev, homeworkType: 'submission' }))}
                        />
                        <Upload className={`w-6 h-6 mb-2 ${globalSettings.homeworkType === 'submission' ? 'text-purple-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">File Submission</span>
                      </label>
                      <label className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center transition-all ${globalSettings.homeworkType === 'manual' ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:border-purple-500' : 'border-gray-200 hover:border-purple-200 dark:border-gray-700'}`}>
                        <input
                          type="radio"
                          className="sr-only"
                          value="manual"
                          checked={globalSettings.homeworkType === 'manual'}
                          onChange={() => setGlobalSettings(prev => ({ ...prev, homeworkType: 'manual' }))}
                        />
                        <Check className={`w-6 h-6 mb-2 ${globalSettings.homeworkType === 'manual' ? 'text-purple-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">Manual Task</span>
                      </label>
                    </div>
                </div>

                {globalSettings.homeworkType === 'manual' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Instructions *
                      </label>
                      <textarea
                        value={globalSettings.manualInstruction}
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, manualInstruction: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Instructions for students (e.g. 'Read chapter 5')"
                        rows={3}
                      />
                    </div>
                ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Max Marks (Optional)
                        </label>
                        <input
                          type="number"
                          value={globalSettings.maxMarks}
                          onChange={(e) => setGlobalSettings(prev => ({ ...prev, maxMarks: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          min="0"
                        />
                      </div>
                      
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Allow late submission after deadline
                          </label>
                          <button
                           type="button"
                           onClick={() => setGlobalSettings(prev => ({ ...prev, allowLateSubmission: !prev.allowLateSubmission }))}
                           className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                             globalSettings.allowLateSubmission ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-600'
                           }`}
                         >
                           <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                             globalSettings.allowLateSubmission ? 'translate-x-5' : 'translate-x-0'
                           }`} />
                         </button>
                        </div>
                        
                        {globalSettings.allowLateSubmission && (
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                            <label className="text-sm text-gray-600 dark:text-gray-400">
                              Days allowed after deadline:
                            </label>
                            <input
                              type="number"
                              value={globalSettings.lateSubmissionDays}
                              onChange={(e) => setGlobalSettings(prev => ({ ...prev, lateSubmissionDays: parseInt(e.target.value) || 0 }))}
                              className="w-20 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                              min="0"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                )}
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <Button onClick={() => setShowHomeworkConfig(false)}>
                    Done
                </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
