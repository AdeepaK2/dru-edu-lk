'use client';

import React, { useState } from 'react';
import { X, RefreshCw, Calendar, Clock, AlertCircle, CheckCircle, MessageSquare } from 'lucide-react';
import { RetestRequest } from '@/models/retestRequestSchema';
import { RetestRequestService } from '@/apiservices/retestRequestService';
import { Button } from '@/components/ui';

interface ApproveRetestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RetestRequest;
  teacherId: string;
  teacherName: string;
  onApproved: () => void;
}

const MELBOURNE_TZ = 'Australia/Melbourne';

function toMelbourneInputValue(date: Date): string {
  return date
    .toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ })
    .slice(0, 16)
    .replace(' ', 'T');
}

function fromMelbourneInputValue(localString: string): Date {
  const asUTC = new Date(localString + ':00Z');
  const melbStr = asUTC.toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ });
  const melbAsUTC = new Date(melbStr.replace(' ', 'T') + 'Z');
  return new Date(2 * asUTC.getTime() - melbAsUTC.getTime());
}

export default function ApproveRetestModal({
  isOpen,
  onClose,
  request,
  teacherId,
  teacherName,
  onApproved
}: ApproveRetestModalProps) {
  const [testType, setTestType] = useState<'live' | 'flexible'>('flexible');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [bufferTime, setBufferTime] = useState(5);
  const [isUntimed, setIsUntimed] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const setDefaultTimes = () => {
    const tomorrowUTC = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowMelbStr = tomorrowUTC
      .toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ })
      .slice(0, 10);
    setStartTime(`${tomorrowMelbStr}T09:00`);

    const nextWeekUTC = new Date(tomorrowUTC.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekMelbStr = nextWeekUTC
      .toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ })
      .slice(0, 10);
    setEndTime(`${nextWeekMelbStr}T23:59`);
  };

  React.useEffect(() => {
    if (isOpen) {
      setDefaultTimes();
      setError(null);
      setSuccess(false);
      setReviewNote('');
    }
  }, [isOpen]);

  const handleApprove = async () => {
    if (!startTime) { setError('Please set a start time.'); return; }

    const startDate = fromMelbourneInputValue(startTime);
    if (startDate <= new Date()) { setError('Start time must be in the future (Melbourne time).'); return; }

    if (testType === 'flexible') {
      if (!endTime) { setError('Please set an end time.'); return; }
      const endDate = fromMelbourneInputValue(endTime);
      if (endDate <= startDate) { setError('End time must be after start time.'); return; }
    }

    try {
      setSubmitting(true);
      setError(null);

      const schedulingData: any = { type: testType };
      if (testType === 'live') {
        schedulingData.scheduledStartTime = startDate;
        schedulingData.duration = duration;
        schedulingData.bufferTime = bufferTime;
      } else {
        schedulingData.availableFrom = startDate;
        schedulingData.availableTo = fromMelbourneInputValue(endTime);
        schedulingData.duration = isUntimed ? 0 : duration;
        schedulingData.isUntimed = isUntimed;
      }

      await RetestRequestService.approveRetestForStudent({
        requestId: request.id,
        teacherId,
        teacherName,
        reviewNote: reviewNote.trim() || undefined,
        schedulingData
      });

      setSuccess(true);
      setTimeout(() => {
        onApproved();
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create retake. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setReviewNote('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 text-green-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Approve Retake</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{request.testTitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-160px)]">
          {success ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">Retake Created!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {request.studentName} will see it in their Retakes tab.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Student info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {request.studentName}
                </p>
                <div className="flex items-start space-x-2">
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{request.reason}"</p>
                </div>
              </div>

              {/* Test type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retake Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTestType('flexible')}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      testType === 'flexible'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-white">Flexible</div>
                    <div className="text-xs text-gray-500">Take anytime within window</div>
                  </button>
                  <button
                    onClick={() => setTestType('live')}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      testType === 'live'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-white">Live</div>
                    <div className="text-xs text-gray-500">Scheduled at a fixed time</div>
                  </button>
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-3">
                <div className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-3 py-1.5">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>All times in Melbourne time (AEST/AEDT)</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {testType === 'live' ? 'Start Time' : 'Available From'}
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    min={toMelbourneInputValue(new Date())}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>

                {testType === 'flexible' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Available Until
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      min={startTime || toMelbourneInputValue(new Date())}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                      min={1} max={300}
                      disabled={isUntimed}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50"
                    />
                  </div>

                  {testType === 'live' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Buffer (min)
                      </label>
                      <input
                        type="number"
                        value={bufferTime}
                        onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)}
                        min={0} max={30}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex items-end pb-1">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isUntimed}
                          onChange={(e) => setIsUntimed(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Untimed</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Note to student (optional)
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Any instructions for this retake..."
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end space-x-3 p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <Button onClick={handleClose} variant="outline">Cancel</Button>
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Create Retake
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
