import React, { useState } from 'react';
import { FileText, Download, Eye, AlertCircle } from 'lucide-react';
import { ExamPDFService } from '@/services/examPDFService';
import { EssayQuestion } from '@/models/questionBankSchema';
import { Timestamp } from 'firebase/firestore';

interface PDFTestButtonProps {
  className?: string;
}

export const PDFTestButton: React.FC<PDFTestButtonProps> = ({ className = '' }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<'standard' | 'large' | 'extraLarge' | 'fullPage'>('standard');

  const sampleQuestions: EssayQuestion[] = [
    {
      id: 'test1',
      title: 'Education in Modern Society',
      content: 'Explain the importance of education in modern society. Discuss how technology has changed the way we learn and provide examples of both positive and negative impacts.',
      imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w800', // Sample education image
      type: 'essay',
      points: 25,
      difficultyLevel: 'medium',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    },
    {
      id: 'test2',
      title: 'Renewable Energy Analysis',
      content: 'Analyze the role of renewable energy in combating climate change. What are the main challenges and opportunities in transitioning to clean energy?',
      imageUrl: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w800', // Sample renewable energy image
      type: 'essay',
      points: 30,
      difficultyLevel: 'hard',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    },
    {
      id: 'test3',
      title: 'Science Without Images',
      content: 'Discuss the scientific method and its importance in research. How has scientific methodology evolved over time?',
      type: 'essay',
      points: 20,
      difficultyLevel: 'medium',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }
  ];

  const handleGeneratePDF = async (mode: 'standard' | 'large' | 'extraLarge' | 'fullPage' = imageMode) => {
    try {
      setIsGenerating(true);
      setError(null);
      setPdfUrl(null);

      console.log(`🧪 Starting test PDF generation with ${mode} images...`);

      let pdfBlob: Blob;
      const options = {
        title: 'Dru Education',
        testNumber: 'TEST-001',
        className: 'Grade 10 - Test Class',
        date: new Date().toLocaleDateString(),
        questions: sampleQuestions
      };

      // Generate PDF based on selected mode
      switch (mode) {
        case 'large':
          pdfBlob = await ExamPDFService.generateExamPDFWithLargeImages(options);
          break;
        case 'extraLarge':
          pdfBlob = await ExamPDFService.generateExamPDFWithExtraLargeImages(options);
          break;
        case 'fullPage':
          pdfBlob = await ExamPDFService.generateExamPDFWithFullPageImages(options);
          break;
        default:
          pdfBlob = await ExamPDFService.generateExamPDF(options);
          break;
      }

      // Create download URL
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      console.log(`✅ Test PDF generated successfully with ${mode} images!`);
      
    } catch (err) {
      console.error('❌ PDF generation failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `test-exam-paper-${imageMode}-images.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleView = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            PDF Generation Test - Enhanced Image Support
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
            Test the PDF generation system with sample essay questions (includes image questions)
          </p>
          
          {/* Image Mode Selection */}
          <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              Image Display Mode
            </h4>
            <div className="space-y-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="imageMode"
                  value="standard"
                  checked={imageMode === 'standard'}
                  onChange={(e) => setImageMode(e.target.value as any)}
                  className="text-yellow-600"
                />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  Standard (150mm height)
                </span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="imageMode"
                  value="large"
                  checked={imageMode === 'large'}
                  onChange={(e) => setImageMode(e.target.value as any)}
                  className="text-yellow-600"
                />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  Large Images (280mm height)
                </span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="imageMode"
                  value="extraLarge"
                  checked={imageMode === 'extraLarge'}
                  onChange={(e) => setImageMode(e.target.value as any)}
                  className="text-yellow-600"
                />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  Extra Large (350mm height)
                </span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="imageMode"
                  value="fullPage"
                  checked={imageMode === 'fullPage'}
                  onChange={(e) => setImageMode(e.target.value as any)}
                  className="text-yellow-600"
                />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  Full Page per Image
                </span>
              </label>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleGeneratePDF()}
              disabled={isGenerating}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700 rounded-md transition-colors duration-200"
            >
              {isGenerating ? (
                <div className="animate-spin w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full"></div>
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? 'Generating...' : `Generate (${imageMode})`}
            </button>
            
            {/* Quick test buttons */}
            {!isGenerating && (
              <div className="flex space-x-1">
                <button
                  onClick={() => handleGeneratePDF('standard')}
                  className="text-xs px-2 py-1 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 rounded border border-yellow-200 dark:border-yellow-700"
                >
                  Test Standard
                </button>
                <button
                  onClick={() => handleGeneratePDF('large')}
                  className="text-xs px-2 py-1 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 rounded border border-yellow-200 dark:border-yellow-700"
                >
                  Test Large
                </button>
                <button
                  onClick={() => handleGeneratePDF('extraLarge')}
                  className="text-xs px-2 py-1 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 rounded border border-yellow-200 dark:border-yellow-700"
                >
                  Test XL
                </button>
                <button
                  onClick={() => handleGeneratePDF('fullPage')}
                  className="text-xs px-2 py-1 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 rounded border border-yellow-200 dark:border-yellow-700"
                >
                  Test Full Page
                </button>
              </div>
            )}

            {pdfUrl && (
              <>
                <button
                  onClick={handleView}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700 rounded-md transition-colors duration-200"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700 rounded-md transition-colors duration-200"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">
                Error: {error}
              </p>
            </div>
          )}

          {pdfUrl && (
            <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
              ✅ PDF generated successfully with {imageMode} image mode! Use the buttons above to view or download.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFTestButton;