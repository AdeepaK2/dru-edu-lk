'use client';

import React from 'react';
import { X, Download, FileText, Image, AlertCircle } from 'lucide-react';
import { DocumentInfo } from '@/models/studentSchema';
import Button from '@/components/ui/Button';

interface DocumentPreviewModalProps {
  document: DocumentInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (document: DocumentInfo) => void;
}

const getFileType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
    return 'image';
  } else if (ext === 'pdf') {
    return 'pdf';
  } else {
    return 'document';
  }
};

const getFileIcon = (filename: string) => {
  const fileType = getFileType(filename);
  if (fileType === 'image') {
    return <Image className="w-6 h-6" />;
  } else {
    return <FileText className="w-6 h-6" />;
  }
};

export default function DocumentPreviewModal({
  document,
  isOpen,
  onClose,
  onDownload
}: DocumentPreviewModalProps) {
  if (!isOpen || !document) return null;

  const fileType = getFileType(document.filename);
  const canPreview = fileType === 'image' || fileType === 'pdf';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getFileIcon(document.filename)}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {document.filename}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {document.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => onDownload(document)}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </Button>
                <button
                  onClick={onClose}
                  className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md p-2 inline-flex items-center justify-center text-gray-400 dark:text-gray-300 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6">
            {canPreview ? (
              <div className="w-full">
                {fileType === 'image' ? (
                  <div className="flex justify-center">
                    <img
                      src={document.url}
                      alt={document.filename}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const errorDiv = e.currentTarget.nextElementSibling as HTMLDivElement;
                        if (errorDiv) errorDiv.style.display = 'flex';
                      }}
                    />
                    <div 
                      className="hidden flex-col items-center justify-center p-8 text-center"
                      style={{ display: 'none' }}
                    >
                      <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">
                        Unable to preview this image. You can download it using the button above.
                      </p>
                    </div>
                  </div>
                ) : fileType === 'pdf' ? (
                  <div className="w-full h-[70vh]">
                    <iframe
                      src={`${document.url}#toolbar=0`}
                      className="w-full h-full border rounded-lg"
                      title={document.filename}
                      onError={() => {
                        // Handle PDF loading error
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                {getFileIcon(document.filename)}
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  Preview not available
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                  This file type cannot be previewed in the browser. <br />
                  Click the download button to view the file.
                </p>
                <Button
                  onClick={() => onDownload(document)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download {document.filename}
                </Button>
              </div>
            )}

            {/* Document metadata */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-900 dark:text-white">Status</dt>
                  <dd className={`mt-1 ${
                    document.status === 'Verified' ? 'text-green-600' :
                    document.status === 'Rejected' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {document.status}
                  </dd>
                </div>
                {document.submittedAt && (
                  <div>
                    <dt className="font-medium text-gray-900 dark:text-white">Submitted</dt>
                    <dd className="mt-1 text-gray-600 dark:text-gray-400">
                      {new Date(document.submittedAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                {document.verifiedAt && (
                  <div>
                    <dt className="font-medium text-gray-900 dark:text-white">Verified</dt>
                    <dd className="mt-1 text-gray-600 dark:text-gray-400">
                      {new Date(document.verifiedAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
              {document.notes && (
                <div className="mt-4">
                  <dt className="font-medium text-gray-900 dark:text-white">Notes</dt>
                  <dd className="mt-1 text-gray-600 dark:text-gray-400">
                    {document.notes}
                  </dd>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
