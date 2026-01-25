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
  Tag,
  Trash2,
  Link,
  Settings
} from 'lucide-react';
import { 
  StudyMaterialDocument, 
  StudyMaterialData, 
  StudyMaterialUpdateData 
} from '@/models/studyMaterialSchema';
import { 
  createStudyMaterial, 
  updateStudyMaterial 
} from '@/apiservices/studyMaterialFirestoreService';
import { StudyMaterialStorageService } from '@/apiservices/studyMaterialStorageService';
import { ClassDocument } from '@/models/classSchema';
import { LessonDocument } from '@/models/lessonSchema';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import Button from '@/components/ui/Button';

// ... other imports

interface StudyMaterialUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classData?: ClassDocument;
  preSelectedLessonId?: string;
  initialMaterial?: StudyMaterialDocument; // For editing
}

interface FileUploadItem {
  id: string;
  file?: File;
  existingUrl?: string; // For editing existing files
  title: string;
  fileType: 'pdf' | 'video' | 'image' | 'link' | 'other';
  externalUrl?: string;
  isRequired: boolean;
  tags: string[];
  isHomework: boolean;
  dueDate: string;
  homeworkType: 'manual' | 'submission';
  manualInstruction: string;
  maxMarks: number;
  allowLateSubmission: boolean;
  lateSubmissionDays: number;
  error?: string;
}

interface GlobalSettings {
  title: string;
  description: string;
  lessonId: string;
  isVisible: boolean;
  order: number;
  dueDate: string;
}

export default function StudyMaterialUploadModal({
  isOpen,
  onClose,
  onSuccess,
  classData,
  preSelectedLessonId,
  initialMaterial
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

  const isEditing = !!initialMaterial;

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    title: '',
    description: '',
    lessonId: preSelectedLessonId || '',
    isVisible: true,
    order: 1,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (initialMaterial) {
        // Edit Mode: Populate with existing data
        setGlobalSettings({
          title: initialMaterial.groupTitle || initialMaterial.title, // Use group title if available, otherwise title
          description: initialMaterial.description || '',
          lessonId: initialMaterial.lessonId || '',
          isVisible: initialMaterial.isVisible,
          order: initialMaterial.order || 1,
          dueDate: (initialMaterial.dueDate && typeof initialMaterial.dueDate === 'object' && 'toDate' in initialMaterial.dueDate 
            ? (initialMaterial.dueDate as any).toDate()
            : (initialMaterial.dueDate as any) instanceof Date 
              ? initialMaterial.dueDate 
              : new Date(initialMaterial.dueDate || Date.now())).toISOString().split('T')[0]
        });

        // Populate file item
        setFiles([{
          id: initialMaterial.id,
          title: initialMaterial.title,
          fileType: initialMaterial.fileType as any,
          existingUrl: initialMaterial.fileUrl,
          externalUrl: initialMaterial.externalUrl,
          isRequired: initialMaterial.isRequired,
          tags: initialMaterial.tags || [],
          isHomework: initialMaterial.isHomework || false,
          dueDate: (initialMaterial.dueDate && typeof initialMaterial.dueDate === 'object' && 'toDate' in initialMaterial.dueDate 
            ? (initialMaterial.dueDate as any).toDate() 
            : (initialMaterial.dueDate as any) instanceof Date 
              ? initialMaterial.dueDate 
              : new Date(initialMaterial.dueDate || Date.now() + 7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          homeworkType: (initialMaterial.homeworkType as any) || 'manual',
          manualInstruction: initialMaterial.manualInstruction || '',
          maxMarks: initialMaterial.maxMarks || 0,
          allowLateSubmission: initialMaterial.allowLateSubmission ?? true,
          lateSubmissionDays: initialMaterial.lateSubmissionDays || 3,
        }]);

      } else {
        // Create Mode: Reset
        setGlobalSettings({
          title: '',
          description: '',
          lessonId: preSelectedLessonId || '',
          isVisible: true,
          order: 1,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        setFiles([]);
      }
      
      setError(null);
      setUploadProgress(0);
      setCurrentUpload(0);
      setTotalUploads(0);
    }
  }, [isOpen, preSelectedLessonId, initialMaterial]);

  // ... loadLessons useEffect ...

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addFileUploadItem = (filesToAdd?: FileList) => {
    if (filesToAdd) {
      const newItems: FileUploadItem[] = Array.from(filesToAdd).map(file => {
        // Determine file type based on extension
        let fileType: FileUploadItem['fileType'] = 'other';
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        
        if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) fileType = 'pdf';
        else if (['mp4', 'avi', 'mov', 'wmv'].includes(extension)) fileType = 'video';
        else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) fileType = 'image';
        
        return {
          id: generateId(),
          file,
          title: file.name.split('.').slice(0, -1).join('.'),
          fileType,
          isRequired: false,
          tags: [],
          isHomework: false,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          homeworkType: 'manual',
          manualInstruction: '',
          maxMarks: 100,
          allowLateSubmission: true,
          lateSubmissionDays: 3,
          error: undefined
        };
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
        tags: [],
        isHomework: false,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        homeworkType: 'manual',
        manualInstruction: '',
        maxMarks: 100,
        allowLateSubmission: true,
        lateSubmissionDays: 3,
        error: undefined
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

  const addTagToItem = (itemId: string, tag: string) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return;
    
    setFiles(prev => prev.map(item => {
      if (item.id === itemId && !item.tags.includes(trimmedTag)) {
        return { ...item, tags: [...item.tags, trimmedTag] };
      }
      return item;
    }));
  };

  const removeTagFromItem = (itemId: string, tagToRemove: string) => {
    setFiles(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, tags: item.tags.filter(t => t !== tagToRemove) };
      }
      return item;
    }));
  };

  // Validate file item
  const validateFileItem = (item: FileUploadItem): string | null => {
    if (!item.title.trim()) {
      return 'Title is required';
    }
    if (item.fileType === 'link' && !item.externalUrl?.trim()) {
      return 'URL is required for links';
    }
    // If not a link, and no new file selected, and no existing URL (from edit), then error
    if (item.fileType !== 'link' && !item.file && !item.existingUrl) {
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
    let isValid = true;
    const newFiles = [...files]; // Clone to not mutate state directly during validation loop, but we will update state with errors
    
    // Validate global settings if needed
    // ...

    if (newFiles.length === 0) {
      setError('Please add at least one file or link.');
      return false;
    }

    // Validate each file
    let hasFileErrors = false;
    const validatedFiles = newFiles.map(item => {
        const error = validateFileItem(item);
        if (error) {
            hasFileErrors = true;
            isValid = false;
        }
        return { ...item, error: error || undefined };
    });

    if (hasFileErrors) {
        setFiles(validatedFiles);
        setError('Please fix the errors in the file list.');
        return false;
    }

    return isValid;
  };



  const uploadFileToStorage = async (file: File, type: string): Promise<string> => {
    return await StudyMaterialStorageService.uploadStudyMaterial(
       file, 
       classData?.id || 'general', 
       type,
       (progress) => {
         // Optionally track individual file progress here if needed, 
         // but we have a global progress bar usually controlled by strict file by file.
         // Since we upload sequentially or parallel, we might want to update the main progress.
         // But the helper handles it.
       }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setUploading(true);
    setCurrentUpload(0);
    setTotalUploads(files.length);
    setUploadProgress(0);

    try {
      // If editing, handle update
      if (isEditing && initialMaterial) {
        const item = files[0];
        
        // Check if file is being replaced
        let fileUrl = item.existingUrl || '';
        let fileName = initialMaterial.fileName;
        let fileSize = initialMaterial.fileSize;
        let mimeType = initialMaterial.mimeType;

        if (item.fileType === 'link') {
            fileUrl = item.externalUrl || '';
            fileName = item.title;
        } else if (item.file) {
             // New file uploaded
            fileUrl = await uploadFileToStorage(item.file, item.fileType);
            fileName = item.file.name;
            fileSize = item.file.size;
            mimeType = item.file.type;
        }

        const selectedLesson = lessons.find(lesson => lesson.id === globalSettings.lessonId);
        const lessonName = selectedLesson ? selectedLesson.name : (globalSettings.lessonId ? 'Unknown Lesson' : '');

        const updateData: StudyMaterialUpdateData = {
          title: item.title, // Use item title
          description: globalSettings.description,
          lessonId: globalSettings.lessonId || undefined,
          lessonName: lessonName || undefined,
          isVisible: globalSettings.isVisible,
          order: globalSettings.order,
          tags: item.tags,
          dueDate: globalSettings.dueDate ? new Date(globalSettings.dueDate) : undefined,
          
          // File data
          fileUrl,
          fileName,
          fileSize,
          fileType: item.fileType,
          mimeType,
          externalUrl: item.fileType === 'link' ? item.externalUrl : undefined,

          // Homework data
          isHomework: item.isHomework,
          homeworkType: item.isHomework ? item.homeworkType : undefined,
          manualInstruction: (item.isHomework && item.homeworkType === 'manual') ? item.manualInstruction : undefined,
          maxMarks: (item.isHomework && item.maxMarks > 0) ? item.maxMarks : undefined,
          allowLateSubmission: item.isHomework ? item.allowLateSubmission : true,
          lateSubmissionDays: item.isHomework ? item.lateSubmissionDays : 3,
          
          isRequired: item.isRequired,
        };

        if (files.length === 1 && globalSettings.title.trim()) {
             // Optionally update group title if it was grouped? 
             // For simplicity, we just update the material.
        }

        await updateStudyMaterial(initialMaterial.id, updateData);
        console.log('✅ Material updated successfully');

      } else {
        // Create Mode (Original Logic)
        
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

          let materialTitle = item.title.trim();
          if (files.length === 1 && globalSettings.title.trim()) {
             materialTitle = globalSettings.title.trim() || item.title.trim();
          }

          // Create study material data with grouping
          const materialData: StudyMaterialData = {
            title: materialTitle,
            description: globalSettings.description.trim(),
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
            dueDate: globalSettings.dueDate ? new Date(globalSettings.dueDate) : undefined,
            externalUrl: item.fileType === 'link' && item.externalUrl ? item.externalUrl : undefined,
            uploadedAt: new Date(),
            viewCount: 0,
            isHomework: item.isHomework,
            homeworkType: item.isHomework ? item.homeworkType : undefined,
            manualInstruction: (item.isHomework && item.homeworkType === 'manual') ? item.manualInstruction : undefined,
            maxMarks: (item.isHomework && item.maxMarks > 0) ? item.maxMarks : undefined,
            allowLateSubmission: item.isHomework ? item.allowLateSubmission : true,
            lateSubmissionDays: item.isHomework ? item.lateSubmissionDays : 3
          };

          await createStudyMaterial(materialData);
        }
      }

      console.log('✅ All materials processed successfully');
      onSuccess();
      
    } catch (error) {
      console.error('❌ Operation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to process materials');
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



                  </div>

                {/* Homework Toggle Per Item */}
                <div className="flex flex-col mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
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

                    {/* Per-File Homework Configuration */}
                    {item.isHomework && (
                      <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <h6 className="text-sm font-semibold text-purple-800 dark:text-purple-300 flex items-center">
                            <Settings className="w-3 h-3 mr-2" />
                            Configuration
                          </h6>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Due Date
                              </label>
                              <input
                                type="date"
                                value={item.dueDate}
                                onChange={(e) => updateFileUploadItem(item.id, { dueDate: e.target.value })}
                                disabled={uploading}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                              />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Submission Type
                                </label>
                                <div className="flex rounded-md shadow-sm" role="group">
                                  <button
                                    type="button"
                                    onClick={() => updateFileUploadItem(item.id, { homeworkType: 'manual' })}
                                    className={`px-3 py-1.5 text-xs font-medium border rounded-l-lg flex-1 ${
                                      item.homeworkType === 'manual'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    Manual
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateFileUploadItem(item.id, { homeworkType: 'submission' })}
                                    className={`px-3 py-1.5 text-xs font-medium border border-l-0 rounded-r-lg flex-1 ${
                                      item.homeworkType === 'submission'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    File Upload
                                  </button>
                                </div>
                            </div>

                            {item.homeworkType === 'manual' ? (
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Instructions for Student
                                  </label>
                                  <input
                                    type="text"
                                    value={item.manualInstruction}
                                    onChange={(e) => updateFileUploadItem(item.id, { manualInstruction: e.target.value })}
                                    placeholder="e.g. Read chapter 5 and answer questions on page 120"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                  />
                                </div>
                            ) : (
                                <div className="md:col-span-2">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-1">
                                             <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                              Max Marks (Optional)
                                            </label>
                                            <input
                                              type="number"
                                              min="0"
                                              value={item.maxMarks || ''}
                                              onChange={(e) => updateFileUploadItem(item.id, { maxMarks: parseInt(e.target.value) || 0 })}
                                              placeholder="100"
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                            />
                                        </div>
                                         <div className="flex-1 pt-5">
                                             <label className="flex items-center space-x-2 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={item.allowLateSubmission}
                                                onChange={(e) => updateFileUploadItem(item.id, { allowLateSubmission: e.target.checked })}
                                                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                              />
                                              <span className="text-xs text-gray-700 dark:text-gray-300">Allow late submission</span>
                                            </label>
                                             {item.allowLateSubmission && (
                                                <div className="mt-1 flex items-center space-x-2">
                                                    <span className="text-xs text-gray-500">Days allowed:</span>
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        max="30"
                                                        value={item.lateSubmissionDays}
                                                        onChange={(e) => updateFileUploadItem(item.id, { lateSubmissionDays: parseInt(e.target.value) || 0 })}
                                                        className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
                                                    />
                                                </div>
                                             )}
                                         </div>
                                    </div>
                                </div>
                            )}
                          </div>
                      </div>
                    )}
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
