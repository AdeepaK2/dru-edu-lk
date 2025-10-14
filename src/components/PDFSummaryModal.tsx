'use client';

import React from 'react';
import { X, FileText, Clock, Hash, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PDFSummary } from '@/services/pdfSummarizationService';

interface PDFSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PDFSummary | null;
  loading: boolean;
  error: string | null;
  title: string;
}

export default function PDFSummaryModal({
  isOpen,
  onClose,
  summary,
  loading,
  error,
  title
}: PDFSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <span>✨ AI-Powered Summary</span>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Intelligent analysis of "{title}"
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Sparkles className="w-8 h-8 text-white animate-bounce" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">🤖 AI is analyzing your document...</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Extracting key insights and generating summary</p>
                <div className="mt-4 flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Summary Unavailable
                </h3>
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
                  Close
                </Button>
              </div>
            </div>
          )}

          {summary && !loading && !error && (
            <div className="space-y-6">
              {/* Document Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Hash className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Word Count</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {summary.wordCount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Reading Time</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {summary.estimatedReadingTime} min
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Summary
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {summary.summary}
                  </p>
                </div>
              </div>

              {/* Key Points */}
              {summary.keyPoints && summary.keyPoints.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Key Points
                  </h3>
                  <div className="space-y-2">
                    {summary.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start space-x-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-medium">{index + 1}</span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {point}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Note */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                      🚀 Powered by Gemini AI
                    </p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Advanced AI analysis extracts key insights, main concepts, and important details from your document for faster comprehension.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex justify-end">
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}