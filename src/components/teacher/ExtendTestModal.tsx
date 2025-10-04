// Test Extension Modal Component
// Allows teachers to extend flexible test deadlines

'use client';

import { useState } from 'react';
import { FlexibleTest, TestExtension } from '@/models/testSchema';
import { TestExtensionService } from '@/apiservices/testExtensionService';
import { Calendar, Clock, AlertCircle, CheckCircle, X, Users } from 'lucide-react';

interface ExtendTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: FlexibleTest;
  teacherId: string;
  teacherName: string;
  onExtensionCreated: (extension: TestExtension) => void;
}

export default function ExtendTestModal({
  isOpen,
  onClose,
  test,
  teacherId,
  teacherName,
  onExtensionCreated
}: ExtendTestModalProps) {
  const [newDeadline, setNewDeadline] = useState('');
  const [newTime, setNewTime] = useState('23:59');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // Safely convert timestamp to Date
  const convertTimestampToDate = (timestamp: any): Date => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp);
    } else {
      console.error('Unknown timestamp format:', timestamp);
      return new Date(); // Fallback to current date
    }
  };

  const currentDeadline = convertTimestampToDate(test.availableTo);
  const minDate = new Date();
  minDate.setDate(currentDeadline.getDate() + 1); // Must be at least 1 day after current deadline

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newDeadline || !newTime) {
      setError('Please select both date and time');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      // Combine date and time
      const extensionDate = new Date(`${newDeadline}T${newTime}:00`);
      
      // Validate the date is in the future
      if (extensionDate <= currentDeadline) {
        setError('New deadline must be after the current deadline');
        return;
      }

      // Create the extension
      setSuccessMessage('Extending test deadline...');
      const extension = await TestExtensionService.extendTestDeadline(
        test.id,
        extensionDate,
        teacherId,
        teacherName,
        reason.trim()
      );

      setSuccessMessage('Test extended successfully! Sending email notifications to students and parents...');
      
      // Small delay to show the message
      setTimeout(() => {
        onExtensionCreated(extension);
        onClose();
        
        // Reset form
        setNewDeadline('');
        setNewTime('23:59');
        setReason('');
        setSuccessMessage('');
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Failed to extend deadline');
      setSuccessMessage('');
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateExtensionDays = () => {
    if (!newDeadline || !newTime) return null;
    
    const extensionDate = new Date(`${newDeadline}T${newTime}:00`);
    const diffTime = extensionDate.getTime() - currentDeadline.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Extend Test Deadline
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {test.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Current Deadline Info */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Current Deadline
            </span>
          </div>
          <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            {formatDateTime(currentDeadline)}
          </p>
          {test.isExtended && test.originalAvailableTo && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Originally: {formatDateTime(convertTimestampToDate(test.originalAvailableTo))}
            </p>
          )}
        </div>

        {/* Extension Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Deadline Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="newDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Date *
              </label>
              <input
                id="newDate"
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                min={minDate.toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label htmlFor="newTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Time *
              </label>
              <input
                id="newTime"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Extension Preview */}
          {newDeadline && newTime && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  Extension Preview
                </span>
              </div>
              <p className="text-green-900 dark:text-green-100 mt-1">
                New deadline: {formatDateTime(new Date(`${newDeadline}T${newTime}:00`))}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Extension: {calculateExtensionDays()} day(s)
              </p>
            </div>
          )}

          {/* Reason (Optional) */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Extension (Optional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g., Technical issues during test period, Additional preparation time needed..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Student Impact Info */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Student Impact & Notifications
              </span>
            </div>
            <div className="text-yellow-900 dark:text-yellow-100 text-sm mt-1">
              <p className="mb-2">All students will be able to access the test until the new deadline. Students who have already completed the test will not be affected.</p>
              <p className="font-medium">📧 Automatic Email Notifications:</p>
              <ul className="list-disc list-inside ml-2 mt-1">
                <li>Students will receive an email about the deadline extension</li>
                <li>Parents will also be notified of the changes</li>
                <li>Emails include the reason and new deadline details</li>
              </ul>
            </div>
          </div>

          {/* Success Message Display */}
          {successMessage && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  Success
                </span>
              </div>
              <p className="text-green-900 dark:text-green-100 text-sm mt-1">
                {successMessage}
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800 dark:text-red-300">
                  Error
                </span>
              </div>
              <p className="text-red-900 dark:text-red-100 text-sm mt-1">
                {error}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newDeadline || !newTime}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Extending...' : 'Extend Deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
