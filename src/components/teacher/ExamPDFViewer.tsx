import React from 'react';
import { Download, Eye, FileText } from 'lucide-react';

interface ExamPDFViewerProps {
  examPdfUrl?: string;
  testTitle: string;
  testNumber: string;
  className?: string;
}

export const ExamPDFViewer: React.FC<ExamPDFViewerProps> = ({
  examPdfUrl,
  testTitle,
  testNumber,
  className = ''
}) => {
  console.log('📄 ExamPDFViewer rendered with:', {
    examPdfUrl,
    testTitle,
    testNumber,
    hasUrl: !!examPdfUrl
  });

  if (!examPdfUrl) {
    console.log('❌ ExamPDFViewer: No PDF URL provided');
    return null;
  }

  const handleDownload = () => {
    console.log('🔽 Opening PDF in new tab...', examPdfUrl);
    window.open(examPdfUrl, '_blank');
  };  const handleView = () => {
    window.open(examPdfUrl, '_blank');
  };

  return (
    <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <FileText className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800 dark:text-green-200 flex items-center">
                📄 Exam Paper PDF Ready
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
                  ✅ Generated
                </span>
              </p>
              <p className="text-sm text-green-600 dark:text-green-300">
                Printable exam paper with answer sheets for essay questions
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleView}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:text-green-200 dark:hover:bg-green-700 rounded-md transition-colors duration-200"
              >
                <Eye className="w-3 h-3 mr-1" />
                View PDF
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:text-green-200 dark:hover:bg-green-700 rounded-md transition-colors duration-200"
              >
                <Download className="w-3 h-3 mr-1" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPDFViewer;