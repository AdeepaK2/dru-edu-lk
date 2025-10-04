import React, { useState } from 'react';
import { FileText, Download, Eye, AlertCircle, Settings, Image, Maximize } from 'lucide-react';
import { ExamPDFService } from '@/services/examPDFService';
import { EssayQuestion } from '@/models/questionBankSchema';

interface ImageDisplayOptions {
  mode: 'standard' | 'large' | 'extraLarge' | 'fullPage' | 'custom';
  maxHeight?: number;
}

interface EnhancedPDFGeneratorProps {
  questions: EssayQuestion[];
  testTitle: string;
  testNumber: string;
  className: string; // Test class name (required)
  onPDFGenerated?: (pdfBlob: Blob, pdfUrl: string) => void;
  componentClassName?: string; // Component styling className (optional)
}

export const EnhancedPDFGenerator: React.FC<EnhancedPDFGeneratorProps> = ({
  questions,
  testTitle,
  testNumber,
  className: testClassName,
  onPDFGenerated,
  componentClassName = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [imageOptions, setImageOptions] = useState<ImageDisplayOptions>({ mode: 'standard' });

  const handleGeneratePDF = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setPdfUrl(null);

      console.log('📄 Generating PDF with options:', imageOptions);

      let pdfBlob: Blob;

      // Generate PDF based on selected image options
      switch (imageOptions.mode) {
        case 'large':
          pdfBlob = await ExamPDFService.generateExamPDFWithLargeImages({
            title: testTitle,
            testNumber,
            className: testClassName,
            date: new Date().toLocaleDateString(),
            questions
          });
          break;

        case 'extraLarge':
          pdfBlob = await ExamPDFService.generateExamPDFWithExtraLargeImages({
            title: testTitle,
            testNumber,
            className: testClassName,
            date: new Date().toLocaleDateString(),
            questions
          });
          break;

        case 'fullPage':
          pdfBlob = await ExamPDFService.generateExamPDFWithFullPageImages({
            title: testTitle,
            testNumber,
            className: testClassName,
            date: new Date().toLocaleDateString(),
            questions
          });
          break;

        case 'custom':
          pdfBlob = await ExamPDFService.generateExamPDFWithCustomImageSettings(
            {
              title: testTitle,
              testNumber,
              className: testClassName,
              date: new Date().toLocaleDateString(),
              questions
            },
            imageOptions.maxHeight || 120,
            false
          );
          break;

        default: // standard
          pdfBlob = await ExamPDFService.generateExamPDF({
            title: testTitle,
            testNumber,
            className: testClassName,
            date: new Date().toLocaleDateString(),
            questions
          });
          break;
      }

      // Create download URL
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      // Notify parent component if callback provided
      if (onPDFGenerated) {
        onPDFGenerated(pdfBlob, url);
      }

      console.log('✅ PDF generated successfully!');
      
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
      link.download = `exam-${testNumber}-${imageOptions.mode}-images.pdf`;
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

  const getImageModeDescription = () => {
    switch (imageOptions.mode) {
      case 'standard':
        return 'Images up to 150mm height (enhanced default)';
      case 'large':
        return 'Large images up to 280mm height';
      case 'extraLarge':
        return 'Extra large images up to 350mm height';
      case 'fullPage':
        return 'Full page display for each image';
      case 'custom':
        return `Custom height: ${imageOptions.maxHeight || 120}mm`;
      default:
        return 'Standard image size';
    }
  };

  const hasImages = questions.some(q => q.imageUrl);

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${componentClassName}`}>
      <div className="flex items-start space-x-3">
        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-blue-800 dark:text-blue-200">
              📄 Generate Exam Paper PDF
            </h3>
            {hasImages && (
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 rounded-md transition-colors duration-200"
              >
                <Settings className="w-3 h-3 mr-1" />
                Image Options
              </button>
            )}
          </div>

          <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
            Generate a printable PDF exam paper with all questions
            {hasImages && ` (${questions.filter(q => q.imageUrl).length} questions have images)`}
          </p>

          {/* Image Options Panel */}
          {hasImages && showOptions && (
            <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center">
                <Image className="w-4 h-4 mr-2" />
                Question Image Display Options
              </h4>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMode"
                    value="standard"
                    checked={imageOptions.mode === 'standard'}
                    onChange={(e) => setImageOptions({ mode: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Standard Size (150mm max height) - Enhanced default
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMode"
                    value="large"
                    checked={imageOptions.mode === 'large'}
                    onChange={(e) => setImageOptions({ mode: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Large Images (280mm max height) - Much better visibility
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMode"
                    value="extraLarge"
                    checked={imageOptions.mode === 'extraLarge'}
                    onChange={(e) => setImageOptions({ mode: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Extra Large Images (350mm max height) - Maximum size
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMode"
                    value="fullPage"
                    checked={imageOptions.mode === 'fullPage'}
                    onChange={(e) => setImageOptions({ mode: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-blue-700 dark:text-blue-300 inline-flex items-center">
                    <Maximize className="w-3 h-3 mr-1" />
                    Full Page per Image - Maximum clarity
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMode"
                    value="custom"
                    checked={imageOptions.mode === 'custom'}
                    onChange={(e) => setImageOptions({ mode: e.target.value as any, maxHeight: 120 })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-blue-700 dark:text-blue-300">Custom height:</span>
                  {imageOptions.mode === 'custom' && (
                    <input
                      type="number"
                      min="50"
                      max="250"
                      step="10"
                      value={imageOptions.maxHeight || 120}
                      onChange={(e) => setImageOptions({ ...imageOptions, maxHeight: parseInt(e.target.value) })}
                      className="w-16 px-1 py-0.5 text-xs border border-blue-300 rounded dark:bg-blue-800 dark:border-blue-600"
                    />
                  )}
                  <span className="text-xs text-blue-600 dark:text-blue-400">mm</span>
                </label>
              </div>

              <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                Current setting: {getImageModeDescription()}
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-600 rounded-md transition-colors duration-200"
            >
              {isGenerating ? (
                <div className="animate-spin w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full"></div>
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? 'Generating...' : 'Generate PDF'}
            </button>

            {pdfUrl && (
              <>
                <button
                  onClick={handleView}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 rounded-md transition-colors duration-200"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 rounded-md transition-colors duration-200"
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
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
              ✅ PDF generated successfully with {getImageModeDescription().toLowerCase()}!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedPDFGenerator;