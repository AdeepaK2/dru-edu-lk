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
  const [isDownloading, setIsDownloading] = React.useState(false);
  
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

  const handleDownload = async () => {
    if (isDownloading) return;
    
    setIsDownloading(true);
    console.log('🔽 Downloading PDF via API...', examPdfUrl);
    
    try {
      const filename = `${testTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${testNumber}.pdf`;
      const downloadUrl = `/api/download-pdf?url=${encodeURIComponent(examPdfUrl)}&filename=${encodeURIComponent(filename)}`;
      
      // Create direct download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ PDF download initiated via API!');
      
      // Reset downloading state after a delay
      setTimeout(() => setIsDownloading(false), 2000);
    } catch (error) {
      console.error('❌ Failed to download PDF via API:', error);
      setIsDownloading(false);
      
      // Fallback: direct link
      const link = document.createElement('a');
      link.href = examPdfUrl;
      link.download = `${testTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${testNumber}.pdf`;
      link.target = '_blank';
      link.click();
    }
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
                disabled={isDownloading}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 ${
                  isDownloading 
                    ? 'text-green-600 bg-green-50 cursor-not-allowed dark:bg-green-900/10 dark:text-green-400'
                    : 'text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:text-green-200 dark:hover:bg-green-700'
                }`}
              >
                {isDownloading ? (
                  <>
                    <div className="w-3 h-3 mr-1 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3 mr-1" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPDFViewer;