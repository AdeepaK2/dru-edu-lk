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
        color: 'text-green-600',
        bgColor: 'bg-gradient-to-r from-green-400 to-emerald-500',
        borderColor: 'border-black',
        textColor: 'text-white'
      };
    case 'Rejected':
      return {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-gradient-to-r from-red-400 to-pink-500',
        borderColor: 'border-black',
        textColor: 'text-white'
      };
    case 'Pending':
      return {
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-gradient-to-r from-yellow-400 to-orange-500',
        borderColor: 'border-black',
        textColor: 'text-black'
      };
    default:
      return {
        icon: Upload,
        color: 'text-gray-600',
        bgColor: 'bg-gradient-to-r from-gray-400 to-gray-500',
        borderColor: 'border-black',
        textColor: 'text-white'
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
    <div className="space-y-8">
      {/* Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
              className={`relative rounded-3xl border-4 transition-all duration-300 hover:scale-105 shadow-2xl ${
                dragOver === docType 
                  ? 'border-blue-400 bg-gradient-to-r from-blue-400 to-purple-500' 
                  : statusConfig.borderColor + ' ' + statusConfig.bgColor
              } overflow-hidden`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter(docType)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(docType)}
            >
              {/* Header */}
              <div className="p-6 border-b-4 border-black">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center border-2 border-black">
                      <IconComponent className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <h3 className="font-black text-black text-lg">
                        {config.title}
                      </h3>
                      <p className="text-black font-bold text-sm">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <StatusIcon className="w-8 h-8 text-black" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 bg-white">
                {existingDoc ? (
                  // Existing document display
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-300">
                      <FileIcon className="w-6 h-6 text-gray-600" />
                      <span className="text-sm font-black text-black truncate">
                        {existingDoc.filename}
                      </span>
                    </div>
                    
                    <div className={`inline-flex items-center px-4 py-2 text-sm font-black rounded-full border-2 border-black ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                      <StatusIcon className="w-4 h-4 mr-2" />
                      {existingDoc.status}
                    </div>

                    {existingDoc.submittedAt && (
                      <p className="text-sm text-gray-600 font-bold">
                        📅 Uploaded: {new Date(existingDoc.submittedAt).toLocaleDateString()}
                      </p>
                    )}

                    {existingDoc.notes && existingDoc.status === 'Rejected' && (
                      <div className="bg-gradient-to-r from-red-400 to-pink-500 p-3 rounded-2xl text-sm text-white font-bold border-2 border-black">
                        <strong>💬 Reason:</strong> {existingDoc.notes}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      {existingDoc.status === 'Verified' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDownload(existingDoc)}
                          className="flex items-center space-x-2 text-sm bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f] text-white font-black border-2 border-black rounded-full px-4 py-2 transform hover:scale-105 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          <span>📥 Download</span>
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
                            className="flex items-center space-x-2 text-sm bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-black border-2 border-black rounded-full px-4 py-2 transform hover:scale-105 transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>🔄 Re-upload</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  // Upload area
                  <div className="space-y-4">
                    {selectedFile ? (
                      // File selected
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-300">
                          <FileIcon className="w-6 h-6 text-blue-600" />
                          <span className="text-sm font-black text-black truncate">
                            {selectedFile.name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 font-bold">
                          📏 Size: {formatFileSize(selectedFile.size)}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUploadState(prev => ({ ...prev, [docType]: null }))}
                          className="w-full bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-black border-2 border-black rounded-full py-2 transform hover:scale-105 transition-all"
                        >
                          <X className="w-4 h-4 mr-2" />
                          ❌ Remove File
                        </Button>
                      </div>
                    ) : (
                      // Upload prompt
                      <div className="text-center space-y-4">
                        <div className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center border-4 border-black shadow-lg ${
                          dragOver === docType ? 'bg-gradient-to-r from-blue-400 to-purple-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'
                        }`}>
                          <Upload className={`w-8 h-8 ${
                            dragOver === docType ? 'text-white' : 'text-white'
                          }`} />
                        </div>
                        <div>
                          <p className="text-lg text-black font-black mb-2">
                            {dragOver === docType ? 'Drop your magical document here!' : ' Drag & drop or click to select'}
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
                            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-black border-2 border-black rounded-full px-6 py-3 transform hover:scale-105 transition-all"
                          >
                            📂 Choose File
                          </Button>
                          <p className="text-sm text-gray-600 font-bold mt-3">
                            PDF, DOC, JPG, PNG (Max 10MB) 📊
                          </p>
                        </div>
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
            className="bg-gradient-to-r from-[#64cc4f] to-[#b2e05b] hover:from-[#b2e05b] hover:to-[#64cc4f] text-white px-8 py-4 rounded-full font-black text-lg flex items-center space-x-3 transform hover:scale-105 transition-all border-4 border-black shadow-2xl"
          >
            {loading ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span>🔄 Uploading Magical Documents...</span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                <span>🚀 Upload Selected Documents</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Upload Progress */}
      {loading && (
        <div className="bg-gradient-to-r from-blue-400 to-purple-500 border-4 border-black rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center space-x-4">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
            <div>
              <p className="text-xl font-black text-white mb-1">
                📤 Uploading Documents...
              </p>
              <p className="text-blue-100 font-bold text-lg">
                Please wait while we process your magical files! ✨
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
