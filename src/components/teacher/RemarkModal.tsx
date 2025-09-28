'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { 
  REMARK_LEVELS, 
  RemarkLevel, 
  StudentRemark,
  getRemarkColor,
  getRemarkDescription
} from '@/models/studentRemarkSchema';

interface RemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  subject: string;
  teacherId: string;
  existingRemark?: StudentRemark | null;
  onSave: (remarkData: {
    remarkLevel: RemarkLevel;
    customRemark?: string;
    additionalNotes?: string;
    isVisible: boolean;
  }) => Promise<void>;
  isSaving?: boolean;
}

export default function RemarkModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  classId,
  className,
  subject,
  teacherId,
  existingRemark,
  onSave,
  isSaving = false
}: RemarkModalProps) {
  const [remarkLevel, setRemarkLevel] = useState<RemarkLevel>(REMARK_LEVELS.GOOD);
  const [customRemark, setCustomRemark] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  // Initialize form with existing remark data
  useEffect(() => {
    if (existingRemark) {
      setRemarkLevel(existingRemark.remarkLevel);
      setCustomRemark(existingRemark.customRemark || '');
      setAdditionalNotes(existingRemark.additionalNotes || '');
      setIsVisible(existingRemark.isVisible);
    } else {
      // Reset to defaults for new remark
      setRemarkLevel(REMARK_LEVELS.GOOD);
      setCustomRemark('');
      setAdditionalNotes('');
      setIsVisible(true);
    }
  }, [existingRemark, isOpen]);

  const handleSave = async () => {
    try {
      await onSave({
        remarkLevel,
        customRemark: remarkLevel === REMARK_LEVELS.CUSTOM ? customRemark : undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        isVisible,
      });
      onClose();
    } catch (error) {
      console.error('Error saving remark:', error);
      // Error handling is done in parent component
    }
  };

  const remarkLevelOptions = Object.values(REMARK_LEVELS);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {existingRemark ? 'Edit Remark' : 'Add Remark'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {studentName} - {className} ({subject})
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Remark Level Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Remark Level *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {remarkLevelOptions.map((level) => (
                <div
                  key={level}
                  className={`
                    relative cursor-pointer border-2 rounded-lg p-3 transition-all
                    ${remarkLevel === level 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                  onClick={() => setRemarkLevel(level)}
                >
                  <input
                    type="radio"
                    name="remarkLevel"
                    value={level}
                    checked={remarkLevel === level}
                    onChange={() => setRemarkLevel(level)}
                    className="absolute top-3 right-3"
                  />
                  <div className="pr-8">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2 ${getRemarkColor(level)}`}>
                      {level}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {getRemarkDescription(level)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Remark Input (only show when Custom is selected) */}
          {remarkLevel === REMARK_LEVELS.CUSTOM && (
            <div>
              <label htmlFor="customRemark" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Remark *
              </label>
              <Input
                id="customRemark"
                type="text"
                value={customRemark}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomRemark(e.target.value)}
                placeholder="Enter custom remark..."
                className="w-full"
                required
              />
            </div>
          )}

          {/* Additional Notes */}
          <div>
            <label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              id="additionalNotes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any additional notes about the student's performance in this class..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsVisible(!isVisible)}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all
                ${isVisible 
                  ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-600 dark:text-green-400'
                  : 'border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                }
              `}
            >
              {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {isVisible ? 'Visible to Student' : 'Hidden from Student'}
              </span>
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isVisible 
                ? 'Student can see this remark in their dashboard'
                : 'This remark will only be visible to teachers'
              }
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</h4>
            <div className="flex items-start space-x-3">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRemarkColor(remarkLevel)}`}>
                {remarkLevel}
              </div>
              {remarkLevel === REMARK_LEVELS.CUSTOM && customRemark && (
                <span className="text-sm text-gray-700 dark:text-gray-300">{customRemark}</span>
              )}
              {!isVisible && (
                <EyeOff className="w-4 h-4 text-gray-400" />
              )}
            </div>
            {additionalNotes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{additionalNotes}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (remarkLevel === REMARK_LEVELS.CUSTOM && !customRemark.trim())}
            className="flex items-center space-x-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save Remark'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}