'use client';

import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { Test } from '@/models/testSchema';
import { RetestRequestService } from '@/apiservices/retestRequestService';
import { Button } from '@/components/ui';

interface RetestRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  onRequestSubmitted: () => void;
}

export default function RetestRequestModal({
  isOpen,
  onClose,
  test,
  classId,
  className,
  studentId,
  studentName,
  onRequestSubmitted
}: RetestRequestModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError('Please provide a reason with at least 10 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await RetestRequestService.createRetestRequest({
        testId: test.id,
        testTitle: test.title,
        testNumber: test.testNumber,
        displayNumber: test.displayNumber,
        classId,
        className,
        subjectId: test.subjectId,
        subjectName: test.subjectName,
        studentId,
        studentName,
        reason: reason.trim(),
        teacherId: test.teacherId,
        teacherName: test.teacherName
      });

      setSuccess(true);
      setTimeout(() => {
        onRequestSubmitted();
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error submitting retest request:', err);
      setError(err.message || 'Failed to submit retest request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Request Retest
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {test.title}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Request Submitted!
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Your retest request has been sent to your teacher. You'll be notified when they respond.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Test Info */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Test:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {test.displayNumber || test.title}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Subject:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {test.subjectName}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Class:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {className}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Teacher:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {test.teacherName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Why would you like to retake this test?
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Explain why you'd like another chance at this test (minimum 10 characters)..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                  maxLength={500}
                />
                <div className="flex justify-between mt-1">
                  <span className={`text-xs ${reason.trim().length < 10 ? 'text-gray-400' : 'text-green-500'}`}>
                    {reason.trim().length < 10
                      ? `${10 - reason.trim().length} more characters needed`
                      : 'Minimum length met'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {reason.length}/500
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Info Note */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Your teacher will review this request. If approved, a new test will be created
                  for the whole class to retake. Your original test results will be preserved
                  so you can compare your improvement.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <Button onClick={handleClose} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || reason.trim().length < 10}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
