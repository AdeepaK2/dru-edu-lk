'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Users, FileText, Check, AlertCircle } from 'lucide-react';
import { TestTemplate, TestType } from '@/models/testSchema';
import { TestService } from '@/apiservices/testService';
import { TestTemplateService } from '@/apiservices/testTemplateService';
import { TestNumberingService } from '@/apiservices/testNumberingService';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { Timestamp } from 'firebase/firestore';
import { ClassAllocator } from '../teacher/ClassAllocator';

interface UseTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TestTemplate;
  onTestCreated: (test: any) => void;
  availableClasses: Array<{
    id: string;
    name: string;
    subject: string;
    year: string;
  }>;
}

// ── Melbourne timezone helpers ──────────────────────────────────────────────
const MELBOURNE_TZ = 'Australia/Melbourne';
function toMelbourneInputValue(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ }).slice(0, 16).replace(' ', 'T');
}
function fromMelbourneInputValue(localString: string): Date {
  const asUTC = new Date(localString + ':00Z');
  const melbStr = asUTC.toLocaleString('sv-SE', { timeZone: MELBOURNE_TZ });
  const melbAsUTC = new Date(melbStr.replace(' ', 'T') + 'Z');
  return new Date(2 * asUTC.getTime() - melbAsUTC.getTime());
}
// ───────────────────────────────────────────────────────────────────────────

export default function UseTemplateModal({
  isOpen,
  onClose,
  template,
  onTestCreated,
  availableClasses
}: UseTemplateModalProps) {
  const { teacher } = useTeacherAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    testNumber: '', // Will be auto-generated
    description: '',
    instructions: '',
    targetClassIds: [] as string[],
    type: 'flexible' as TestType,
    availableFrom: '',
    availableTo: '',
    duration: 60,
    attemptsAllowed: 1,
    isUntimed: false,
    scheduledStartTime: '',
    bufferTime: 5,
  });

  const [testNumberLoading, setTestNumberLoading] = useState(false);

  // Initialize form with template data
  useEffect(() => {
    if (isOpen && template) {
      // Default dates in Melbourne time
      const now = new Date();
      const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      setFormData({
        title: template.title,
        testNumber: '',
        description: template.description || '',
        instructions: template.instructions || '',
        targetClassIds: [],
        type: 'flexible', // Default to flexible
        availableFrom: toMelbourneInputValue(now),
        availableTo: toMelbourneInputValue(oneWeekLater),
        duration: template.config.totalQuestions * 2, // Rough estimate default if missing
        attemptsAllowed: 1,
        isUntimed: false,
        scheduledStartTime: toMelbourneInputValue(now),
        bufferTime: 5,
      });
    }
  }, [isOpen, template]);

  // Handle test numbering when class is selected
  useEffect(() => {
    const fetchTestNumber = async () => {
      if (formData.targetClassIds.length === 1) {
        setTestNumberLoading(true);
        try {
          // Assuming subjectId is available in template
          if (template.subjectId) {
            const nextNum = await TestNumberingService.getNextTestNumber(
              formData.targetClassIds[0],
              template.subjectId
            );
            setFormData(prev => ({ ...prev, testNumber: nextNum.toString() }));
          }
        } catch (error) {
          console.error('Error fetching test number:', error);
        } finally {
          setTestNumberLoading(false);
        }
      }
    };

    fetchTestNumber();
  }, [formData.targetClassIds, template.subjectId]);

  const handleSubmit = async () => {
    if (!formData.title || formData.targetClassIds.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare base test data using template's content
      const baseTestData = {
        ...TestTemplateService.templateToTestData(template), // Gets config, questions, totalMarks, etc.
        title: formData.testNumber ? `${formData.title} (Test ${formData.testNumber})` : formData.title,
        description: formData.description, // Use user-edited description
        instructions: formData.instructions, // Use user-edited instructions
        teacherId: teacher?.id || '',
        teacherName: teacher?.name || '',
        subjectId: template.subjectId,
        subjectName: template.subjectName,
        classIds: formData.targetClassIds,
        classNames: availableClasses
          .filter(c => formData.targetClassIds.includes(c.id))
          .map(c => c.name),
        status: 'draft' as const,
      };

      let finalTestData;

      // Add scheduling details (parse inputs as Melbourne time)
      if (formData.type === 'flexible') {
        const fromDate = fromMelbourneInputValue(formData.availableFrom);
        const toDate = fromMelbourneInputValue(formData.availableTo);
        if (toDate <= fromDate) {
          alert('Due date must be after available from date');
          setIsSubmitting(false);
          return;
        }

        finalTestData = {
          ...baseTestData,
          type: 'flexible' as const,
          availableFrom: Timestamp.fromDate(fromDate),
          availableTo: Timestamp.fromDate(toDate),
          duration: formData.duration,
          attemptsAllowed: formData.attemptsAllowed,
          isUntimed: formData.isUntimed,
        };
      } else {
        const startTime = fromMelbourneInputValue(formData.scheduledStartTime);
        const endTime = new Date(startTime.getTime() + (formData.duration + formData.bufferTime) * 60 * 1000);
        
        finalTestData = {
          ...baseTestData,
          type: 'live' as const,
          scheduledStartTime: Timestamp.fromDate(startTime),
          duration: formData.duration,
          bufferTime: formData.bufferTime,
          studentJoinTime: Timestamp.fromDate(startTime),
          actualEndTime: Timestamp.fromDate(endTime),
          isLive: false,
          studentsOnline: 0,
          studentsCompleted: 0,
        };
      }

      console.log('🚀 Creating test from template:', finalTestData);
      const testId = await TestService.createTest(finalTestData as any);
      
      // Increment usage count
      await TestTemplateService.incrementUsageCount(template.id);

      onTestCreated({ ...finalTestData, id: testId });
      onClose();

    } catch (error) {
      console.error('Error creating test from template:', error);
      alert('Failed to create test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600" />
              Use Template: {template.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Quickly create a test from this template
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* 1. Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Test Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Test description..."
                />
              </div>
              <div>
                 <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Instructions (Optional)
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Instructions for students..."
                />
              </div>
            </div>
          </div>

          {/* 2. Class Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Assign to Class
            </h3>
            <ClassAllocator
              availableClasses={availableClasses}
              selectedClassIds={formData.targetClassIds}
              onSelectionChange={(ids) => setFormData({ ...formData, targetClassIds: ids })}
              singleSelection={true}
            />
            {testNumberLoading && <p className="text-xs text-gray-500 mt-1">Generating test number...</p>}
            {formData.testNumber && (
              <p className="text-xs text-green-600 mt-1 flex items-center">
                <Check className="w-3 h-3 mr-1" />
                Will be created as Test #{formData.testNumber}
              </p>
            )}
          </div>

          {/* 3. Schedule */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
             <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </h3>
            
            <div className="flex space-x-4 mb-4">
              <button
                onClick={() => setFormData({ ...formData, type: 'flexible' })}
                className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                  formData.type === 'flexible'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                Flexible Access
              </button>
              <button
                onClick={() => setFormData({ ...formData, type: 'live' })}
                className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                  formData.type === 'live'
                    ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                Live Exam
              </button>
            </div>

            {formData.type === 'flexible' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">All times are in Melbourne time (AEST/AEDT)</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Available From</label>
                  <input
                    type="datetime-local"
                    value={formData.availableFrom}
                    min={toMelbourneInputValue(new Date())}
                    onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={formData.availableTo}
                    min={formData.availableFrom || toMelbourneInputValue(new Date())}
                    onChange={(e) => setFormData({ ...formData, availableTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                   <label className="block text-xs text-gray-500 mb-1">Duration (minutes)</label>
                   <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                   />
                </div>
              </div>
            ) : (
               <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">All times are in Melbourne time (AEST/AEDT)</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledStartTime}
                    min={toMelbourneInputValue(new Date())}
                    onChange={(e) => setFormData({ ...formData, scheduledStartTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                 <div>
                   <label className="block text-xs text-gray-500 mb-1">Duration (minutes)</label>
                   <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                   />
                </div>
              </div>
            )}
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              This will create a new test with <strong>{template.questions?.length || 0} questions</strong> from the template.
              <br />
              Settings like passing score ({template.config.passingScore}%) are preserved.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || formData.targetClassIds.length === 0}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSubmitting ? 'Creating...' : 'Create Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
