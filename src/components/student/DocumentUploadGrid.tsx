'use client';

import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  Image, 
  FileType, 
  Check, 
  X, 
  AlertCircle, 
  Download,
  Trash2,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { DocumentInfo, DocumentType } from '@/models/studentSchema';
import Button from '@/components/ui/Button';
import DocumentPreviewModal from './DocumentPreviewModal';

interface DocumentUploadGridProps {
  documents: DocumentInfo[];
  onUpload: (files: { [key in DocumentType]?: File }) => Promise<void>;
  onReupload: (documentType: DocumentType, file: File) => Promise<void>;
  onDownload: (document: DocumentInfo) => void;
  loading?: boolean;
  disabled?: boolean;
}

interface UploadState {
  [DocumentType.CLASS_POLICY]?: File | null;
  [DocumentType.PARENT_NOTICE]?: File | null;
  [DocumentType.PHOTO_CONSENT]?: File | null;
}

const DOCUMENT_CONFIGS = {
  [DocumentType.CLASS_POLICY]: {
    title: 'Class Policy Agreement',
    description: 'Required policy agreement document',
    icon: FileText,
    color: 'blue'
  },
  [DocumentType.PARENT_NOTICE]: {
    title: 'Parent/Guardian Notice',
    description: 'Parent or guardian consent form',
    icon: FileText,
    color: 'purple'
  },
  [DocumentType.PHOTO_CONSENT]: {
    title: 'Photo Consent Form',
    description: 'Photo and media consent document',
    icon: Image,
    color: 'green'
  }
};

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
    return Image;
  }
  return FileText;
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'Verified':
      return {
        icon: CheckCircle2,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800'
      };
    case 'Rejected':
      return {
        icon: XCircle,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800'
      };
    case 'Pending':
      return {
        icon: Clock,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800'
      };
    default:
      return {
        icon: Upload,
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-50 dark:bg-gray-800',
        borderColor: 'border-gray-200 dark:border-gray-600'
      };
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DocumentUploadGrid({
  documents,
  onUpload,
  onReupload,
  onDownload,
  loading = false,
  disabled = false
}: DocumentUploadGridProps) {
  const [uploadState, setUploadState] = useState<UploadState>({});
  const [dragOver, setDragOver] = useState<DocumentType | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentInfo | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRefs = useRef<{ [key in DocumentType]?: HTMLInputElement }>({});

  // Get document by type
  const getDocumentByType = (type: DocumentType): DocumentInfo | null => {
    return documents.find(doc => doc.type === type) || null;
  };

  // Handle file selection
  const handleFileSelect = (type: DocumentType, file: File) => {
    setUploadState(prev => ({ ...prev, [type]: file }));
  };

  // Handle file input change
  const handleFileInputChange = (type: DocumentType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(type, file);
    }
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback((type: DocumentType) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(type);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((type: DocumentType) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(type, files[0]);
    }
  }, []);

  // Upload all selected files
  const handleUploadAll = async () => {
    if (Object.values(uploadState).every(file => !file)) return;
    
    const filesToUpload: { [key in DocumentType]?: File } = {};
    Object.entries(uploadState).forEach(([type, file]) => {
      if (file) {
        filesToUpload[type as DocumentType] = file;
      }
    });

    await onUpload(filesToUpload);
    setUploadState({}); // Clear selected files after upload
  };

  // Handle individual reupload
  const handleIndividualReupload = async (type: DocumentType, file: File) => {
    await onReupload(type, file);
    setUploadState(prev => ({ ...prev, [type]: null }));
  };

  // Handle document preview
  const handlePreview = (document: DocumentInfo) => {
    setPreviewDocument(document);
    setShowPreview(true);
  };

  // Check if can upload all
  const canUploadAll = Object.values(uploadState).some(file => file !== null && file !== undefined) && !loading && !disabled;

  return (
    <div className="space-y-6">
      {/* Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(DocumentType).map((docType) => {
          const config = DOCUMENT_CONFIGS[docType];
          const existingDoc = getDocumentByType(docType);
          const selectedFile = uploadState[docType];
          const statusConfig = getStatusConfig(existingDoc?.status || 'Not Submitted');
          const IconComponent = config.icon;
          const StatusIcon = statusConfig.icon;
          const FileIcon = existingDoc ? getFileIcon(existingDoc.filename) : Upload;

          return (
            <div
              key={docType}
              className={`relative rounded-xl border-2 transition-all duration-200 ${
                dragOver === docType 
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                  : statusConfig.borderColor
              } ${statusConfig.bgColor} overflow-hidden`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter(docType)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(docType)}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className={`w-5 h-5 ${statusConfig.color}`} />
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {config.title}
                    </h3>
                  </div>
                  <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {config.description}
                </p>
              </div>

              {/* Content */}
              <div className="p-4">
                {existingDoc ? (
                  // Existing document display
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <FileIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {existingDoc.filename}
                      </span>
                    </div>
                    
                    <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusConfig.color} ${statusConfig.bgColor}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {existingDoc.status}
                    </div>

                    {existingDoc.submittedAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Uploaded: {new Date(existingDoc.submittedAt).toLocaleDateString()}
                      </p>
                    )}

                    {existingDoc.notes && existingDoc.status === 'Rejected' && (
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded text-xs text-red-700 dark:text-red-300">
                        <strong>Reason:</strong> {existingDoc.notes}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      {existingDoc.status === 'Verified' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDownload(existingDoc)}
                          className="flex items-center space-x-1 text-xs"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </Button>
                      )}
                      
                      {existingDoc.status === 'Rejected' && (
                        <>
                          <input
                            ref={el => {
                              if (el) fileInputRefs.current[docType] = el;
                            }}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleIndividualReupload(docType, file);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => fileInputRefs.current[docType]?.click()}
                            disabled={loading}
                            className="flex items-center space-x-1 text-xs bg-red-600 hover:bg-red-700"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Re-upload</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  // Upload area
                  <div className="space-y-3">
                    {selectedFile ? (
                      // File selected
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-700 rounded border">
                          <FileIcon className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {selectedFile.name}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(selectedFile.size)}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUploadState(prev => ({ ...prev, [docType]: null }))}
                          className="w-full text-xs"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      // Upload prompt
                      <div className="text-center">
                        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                          dragOver === docType ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <Upload className={`w-6 h-6 ${
                            dragOver === docType ? 'text-blue-600' : 'text-gray-400'
                          }`} />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          Drag & drop or click to select
                        </p>
                        <input
                          type="file"
                          id={`file-input-${docType}`}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileInputChange(docType, e)}
                          disabled={loading || disabled}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            document.getElementById(`file-input-${docType}`)?.click();
                          }}
                          disabled={loading || disabled}
                          className="text-xs"
                        >
                          Choose File
                        </Button>
                        <p className="text-xs text-gray-400 mt-1">
                          PDF, DOC, JPG, PNG (Max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload All Button */}
      {canUploadAll && (
        <div className="flex justify-center">
          <Button
            onClick={handleUploadAll}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium flex items-center space-x-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload Selected Documents</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Upload Progress */}
      {loading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Uploading Documents...
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Please wait while we process your files.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
