'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import PDFSummaryModal from '@/components/PDFSummaryModal';
import { PDFSummarizationService, PDFSummary } from '@/services/pdfSummarizationService';

// Import react-pdf CSS
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker - use local copy to ensure version compatibility
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

interface PDFViewerProps {
  url: string;
  title: string;
  onClose: () => void;
  inline?: boolean;
  maxHeight?: string; // e.g., '500px', '60vh'
}

export default function PDFViewer({ url, title, onClose, inline = false, maxHeight }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summary, setSummary] = useState<PDFSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Fetch PDF as blob to avoid CORS issues
  useEffect(() => {
    const fetchPdfBlob = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Fetching PDF from:', url);

        // Use our API route to fetch the PDF
        const apiUrl = `/api/pdf?url=${encodeURIComponent(url)}`;
        console.log('API URL:', apiUrl);

        const response = await fetch(apiUrl);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API response error:', response.status, errorText);
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('PDF blob received, size:', blob.size);

        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }

        setPdfBlob(blob);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching PDF blob:', err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}. Please try downloading instead.`);
        setLoading(false);
      }
    };

    if (url) {
      fetchPdfBlob();
    }
  }, [url]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadSuccessWithRef = (pdf: any) => {
    console.log('PDF loaded successfully, pages:', pdf.numPages);
    setPdfDocument(pdf);
    onDocumentLoadSuccess(pdf);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setError(`Failed to load PDF: ${error.message}. Please try downloading instead.`);
    setLoading(false);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleSummarize = async () => {
    if (!pdfDocument) {
      setSummaryError('PDF document not loaded yet. Please wait for the document to load completely.');
      setSummaryModalOpen(true);
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryModalOpen(true);

    try {
      const pdfSummary = await PDFSummarizationService.summarizePDF(pdfDocument, title);
      setSummary(pdfSummary);
    } catch (error: any) {
      console.error('Error generating summary:', error);
      setSummaryError(error.message || 'Failed to generate summary. Please try again.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const closeSummaryModal = () => {
    setSummaryModalOpen(false);
    setSummary(null);
    setSummaryError(null);
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  };

  const inlineStyle = maxHeight ? { maxHeight, height: maxHeight } : {};

  return (
    <div
      className={inline ? "w-full h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200" : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"}
      style={inline ? inlineStyle : undefined}
    >
      <div className={inline ? "h-full w-full flex flex-col overflow-hidden" : "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h2>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="flex items-center space-x-1"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </Button>
            {!inline && (
              <Button
                onClick={onClose}
                variant="outline"
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center space-x-2">
            {!inline && (
              <>
                <Button
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {pageNumber} of {numPages || '?'}
                </span>
                <Button
                  onClick={goToNextPage}
                  disabled={pageNumber >= (numPages || 1)}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </>
            )}
            {inline && numPages && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {numPages} pages - Scroll to view all
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={handleZoomOut}
              variant="outline"
              size="sm"
              disabled={scale <= 0.5}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              onClick={handleZoomIn}
              variant="outline"
              size="sm"
              disabled={scale >= 3.0}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleRotate}
              variant="outline"
              size="sm"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSummarize}
              variant="outline"
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-purple-600 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              disabled={loading}
              title="Generate AI-powered summary of this PDF"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
                  Download PDF Instead
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && pdfBlob && (
            <div className="flex justify-center">
              <Document
                file={pdfBlob}
                onLoadSuccess={onDocumentLoadSuccessWithRef}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-t-2 border-blue-600 border-solid rounded-full animate-spin"></div>
                  </div>
                }
                error={
                  <div className="text-center py-8">
                    <p className="text-red-600 dark:text-red-400">Failed to load PDF page</p>
                  </div>
                }
              >
                {inline ? (
                  // Render all pages for continuous scrolling
                  <div className="space-y-4">
                    {Array.from(new Array(numPages), (el, index) => (
                      <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        scale={scale}
                        rotate={rotation}
                        loading={
                          <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-t-2 border-blue-600 border-solid rounded-full animate-spin"></div>
                          </div>
                        }
                        error={
                          <div className="text-center py-8">
                            <p className="text-red-600 dark:text-red-400">Failed to load page {index + 1}</p>
                          </div>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  // Single page view for modal
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    rotate={rotation}
                    loading={
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-t-2 border-blue-600 border-solid rounded-full animate-spin"></div>
                      </div>
                    }
                    error={
                      <div className="text-center py-8">
                        <p className="text-red-600 dark:text-red-400">Failed to load page {pageNumber}</p>
                      </div>
                    }
                  />
                )}
              </Document>
            </div>
          )}
        </div>
      </div>

      {/* PDF Summary Modal */}
      <PDFSummaryModal
        isOpen={summaryModalOpen}
        onClose={closeSummaryModal}
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        title={title}
      />
    </div>
  );
}