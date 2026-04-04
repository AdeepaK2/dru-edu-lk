'use client';

import React, { useState } from 'react';
import { X, RefreshCw, Calendar, Clock, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { RetestRequestSummary } from '@/models/retestRequestSchema';
import { RetestRequestService } from '@/apiservices/retestRequestService';
import { Button } from '@/components/ui';

interface ApproveRetestModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: RetestRequestSummary;
  teacherId: string;
  teacherName: string;
  onRetestApproved: () => void;
}

const MELBOURNE_TZ = 'Australia/Melbourne';

/**
 * Format a Date as a datetime-local input value in Melbourne time.
 * e.g.  April 5 2026, 9 AM Melbourne → "2026-04-05T09:00"
 */
function toMelbourneInputValue(date: Date): string {
  // sv-SE locale gives ISO-like "YYYY-MM-DD HH:MM:SS" in the given timezone
  return date
    .toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ })
    .slice(0, 16)
    .replace(' ', 'T');
}

/**
 * Parse a datetime-local string entered by the user as Melbourne local time
 * and return the correct UTC Date.
 * e.g. "2026-04-05T09:00" (Melbourne) → Date representing April 4 22:00 UTC (UTC+11)
 */
function fromMelbourneInputValue(localString: string): Date {
  // Step 1: treat the string as UTC temporarily
  const asUTC = new Date(localString + ':00Z');
  // Step 2: find what Melbourne shows at that UTC instant
  const melbStr = asUTC.toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ });
  const melbAsUTC = new Date(melbStr.replace(' ', 'T') + 'Z');
  // Step 3: offset = how many ms Melbourne is ahead of UTC (positive = ahead)
  // actual UTC for the Melbourne local time = asUTC - (melbAsUTC - asUTC)
  return new Date(2 * asUTC.getTime() - melbAsUTC.getTime());
}

export default function ApproveRetestModal({
  isOpen,
  onClose,
  summary,
  teacherId,
  teacherName,
  onRetestApproved
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
    // Default: start tomorrow 9 AM Melbourne, end 1 week later 11:59 PM Melbourne
    const tomorrowUTC = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // Get "tomorrow 09:00 Melbourne" by finding Melbourne's date+1 and setting 09:00
    const tomorrowMelbStr = tomorrowUTC
      .toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ })
      .slice(0, 10); // "YYYY-MM-DD" in Melbourne
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
    }
  }, [isOpen]);

  const handleApprove = async () => {
    // Validation
    if (!startTime) {
      setError('Please set a start time.');
      return;
    }

    // Parse input values as Melbourne local time → correct UTC Dates
    const startDate = fromMelbourneInputValue(startTime);
    if (startDate <= new Date()) {
      setError('Start time must be in the future (Melbourne time).');
      return;
    }

    if (testType === 'flexible' && !endTime) {
      setError('Please set an end time for the flexible test.');
      return;
    }

    if (testType === 'flexible') {
      const endDate = fromMelbourneInputValue(endTime);
      if (endDate <= startDate) {
        setError('End time must be after start time.');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const schedulingData: any = {
        type: testType,
      };

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

      const result = await RetestRequestService.approveRetestForClass({
        testId: summary.testId,
        classId: summary.classId,
        teacherId,
        teacherName,
        reviewNote: reviewNote.trim() || undefined,
        schedulingData
      });

      setSuccess(true);
      setTimeout(() => {
        onRetestApproved();
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error approving retest:', err);
      setError(err.message || 'Failed to create retest. Please try again.');
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

  const pendingRequests = summary.requests.filter(r => r.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Approve Retest
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {summary.testTitle} - {summary.className}
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {success ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Retest Created!
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                A new retest has been created and all {pendingRequests.length} pending requests have been approved.
                Students will see it in their Retakes tab.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Request Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {pendingRequests.length} student{pendingRequests.length !== 1 ? 's' : ''} requested this retest
                  </span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-start space-x-2 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[120px]">
                        {request.studentName}:
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 italic">
                        "{request.reason}"
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retest Type
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
                    <div className="font-medium text-gray-900 dark:text-white">Flexible</div>
                    <div className="text-xs text-gray-500">Students can take anytime within window</div>
                  </button>
                  <button
                    onClick={() => setTestType('live')}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      testType === 'live'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">Live/Scheduled</div>
                    <div className="text-xs text-gray-500">All students take at same time</div>
                  </button>
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-4">
                {/* Melbourne timezone notice */}
                <div className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-3 py-1.5">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>All times are in Melbourne time (AEST/AEDT)</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {testType === 'live' ? 'Start Time (Melbourne)' : 'Available From (Melbourne)'}
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min={toMelbourneInputValue(new Date())}
                  />
                </div>

                {testType === 'flexible' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Available Until (Melbourne)
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      min={startTime || toMelbourneInputValue(new Date())}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      min={1}
                      max={300}
                      disabled={isUntimed}
                    />
                  </div>

                  {testType === 'live' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Buffer Time (minutes)
                      </label>
                      <input
                        type="number"
                        value={bufferTime}
                        onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        min={0}
                        max={30}
                      />
                    </div>
                  )}

                  {testType === 'flexible' && (
                    <div className="flex items-end">
                      <label className="flex items-center space-x-2 cursor-pointer pb-2">
                        <input
                          type="checkbox"
                          checked={isUntimed}
                          onChange={(e) => setIsUntimed(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Untimed</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Teacher Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Note to Students (optional)
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Add a note about this retest..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                  maxLength={300}
                />
              </div>

              {/* Info */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  This will create a new test with the same questions as the original.
                  It will get the next sequential test number. Original test records will not be affected.
                  All {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''} will be marked as approved.
                </p>
              </div>

              {/* Error */}
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
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <Button onClick={handleClose} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Creating Retest...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Create Retest
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
