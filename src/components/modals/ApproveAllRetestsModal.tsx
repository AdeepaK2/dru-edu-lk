'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, Users, Clock, MessageSquare } from 'lucide-react';
import { RetestRequest } from '@/models/retestRequestSchema';
import { Button } from '@/components/ui';

interface ApproveAllRetestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  pendingRequests: RetestRequest[];
  testTitle: string;
  className: string;
  submitting: boolean;
}

const MELBOURNE_TZ = 'Australia/Melbourne';

const formatDateTime = (date: Date) =>
  date.toLocaleString('en-AU', {
    timeZone: MELBOURNE_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function ApproveAllRetestsModal({
  isOpen,
  onClose,
  onConfirm,
  pendingRequests,
  testTitle,
  className,
  submitting
}: ApproveAllRetestsModalProps) {
  const [windowFrom, setWindowFrom] = useState<Date>(new Date());
  const [windowTo, setWindowTo] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    setWindowFrom(now);
    setWindowTo(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Accept All Pending</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {testTitle} · {className}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-160px)] space-y-5">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-300">
            <span className="font-medium">
              {pendingRequests.length} student{pendingRequests.length !== 1 ? 's' : ''} will be approved.
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Common Details</h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold">Retake Type:</span> Flexible
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold">Window:</span> {formatDateTime(windowFrom)} → {formatDateTime(windowTo)}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold">Note:</span> Auto accepted by teacher
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Time zone: Melbourne (AEST/AEDT)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Dynamic Details</h3>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {pendingRequests.map((request) => (
                <div key={request.id} className="p-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{request.studentName}</p>
                  <div className="flex items-start space-x-1.5 mt-1">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600 dark:text-gray-400 italic">"{request.reason}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <Button onClick={onClose} variant="outline" disabled={submitting}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={submitting || pendingRequests.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {submitting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Accept All
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

