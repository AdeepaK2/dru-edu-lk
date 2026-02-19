'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, Clock, Upload, FileText, Check, AlertCircle, Info, Trash2 } from 'lucide-react';
import { TestService } from '@/apiservices/testService';
import { ExamPDFService } from '@/services/examPDFService';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { Timestamp } from 'firebase/firestore';

interface CreateInClassTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  onTestCreated: (test: any) => void;
}

export default function CreateInClassTestModal({
  isOpen,
  onClose,
  classId,
  className,
  subjectId,
  subjectName,
  onTestCreated
}: CreateInClassTestModalProps) {
  const { teacher } = useTeacherAuth();
  const [formData, setFormData] = useState({
    title: '',
    scheduledStartTime: '',
    duration: 60,
    submissionMethod: 'offline_collection' as 'online_upload' | 'offline_collection',
    examPdfFile: null as File | null
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [melbourneNow, setMelbourneNow] = useState<string>('');

  // Fetch server Melbourne time when modal opens to prefill the datetime picker
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/server-time')
      .then(r => r.json())
      .then(data => {
        const d = new Date(data.nowMs);
        // sv-SE locale gives ISO-like YYYY-MM-DD HH:mm format
        const melbStr = d.toLocaleString('sv-SE', {
          timeZone: 'Australia/Melbourne',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }).replace(' ', 'T');
        setMelbourneNow(melbStr);
        // Pre-fill only if empty
        setFormData(prev => prev.scheduledStartTime ? prev : { ...prev, scheduledStartTime: melbStr });
      })
      .catch(() => {});
  }, [isOpen]);

  /**
   * Convert a datetime-local string ("YYYY-MM-DDTHH:mm") that the teacher
   * entered as Melbourne time into a correct UTC Date object.
   * `new Date(str)` would interpret it in the browser's local timezone which
   * is wrong if the teacher is not in Melbourne.
   */
  const parseMelbourneDateTime = (datetimeStr: string): Date => {
    const [datePart, timePart] = datetimeStr.split('T');
    const [y, mo, d] = datePart.split('-').map(Number);
    const [h, mi] = timePart.split(':').map(Number);

    // Try AEDT (+11) and AEST (+10) and pick the one that round-trips
    for (const offset of [11, 10]) {
      const candidate = new Date(Date.UTC(y, mo - 1, d, h - offset, mi));
      const check = candidate.toLocaleString('sv-SE', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }).replace(' ', 'T');
      if (check === datetimeStr) return candidate;
    }
    // Fallback to AEDT
    return new Date(Date.UTC(y, mo - 1, d, h - 11, mi));
  };

  // Calculate end time (in Melbourne)
  const calculatedEndTime = useMemo(() => {
    if (!formData.scheduledStartTime) return '';
    const start = parseMelbourneDateTime(formData.scheduledStartTime);
    const end = new Date(start.getTime() + formData.duration * 60 * 1000);
    return end.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Melbourne' });
  }, [formData.scheduledStartTime, formData.duration]);

  // Calculate access time (1 hour before, in Melbourne)
  const accessTime = useMemo(() => {
    if (!formData.scheduledStartTime) return '';
    const start = parseMelbourneDateTime(formData.scheduledStartTime);
    const access = new Date(start.getTime() - 60 * 60 * 1000);
    return access.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [formData.scheduledStartTime]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Test title is required';
    }
    
    if (!formData.scheduledStartTime) {
      newErrors.scheduledStartTime = 'Date and time are required';
    } else {
      const startTime = parseMelbourneDateTime(formData.scheduledStartTime);
      // Compare against server-calibrated now (or fallback to client)
      const nowMs = Date.now();
      if (startTime.getTime() < nowMs) {
        newErrors.scheduledStartTime = 'Start time must be in the future (Melbourne time)';
      }
    }
    
    if (!formData.duration || formData.duration < 1) {
      newErrors.duration = 'Duration must be at least 1 minute';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      let examPdfUrl = '';

      if (formData.examPdfFile) {
        setUploadProgress(10);
        examPdfUrl = await ExamPDFService.uploadExamPDF(formData.examPdfFile, `in-class_${classId}_${Date.now()}`);
        setUploadProgress(100);
      }

      const startTime = parseMelbourneDateTime(formData.scheduledStartTime);
      const endTime = new Date(startTime.getTime() + formData.duration * 60 * 1000);

      const testData = {
        title: formData.title,
        teacherId: teacher?.id || '',
        teacherName: teacher?.name || '',
        subjectId,
        subjectName: subjectName || 'General',
        classIds: [classId],
        classNames: [className],
        type: 'in-class' as const,
        status: 'scheduled' as const,
        scheduledStartTime: Timestamp.fromDate(startTime),
        duration: formData.duration,
        bufferTime: 0,
        submissionMethod: formData.submissionMethod,
        examPdfUrl,
        
        config: {
          questionSelectionMethod: 'manual',
          totalQuestions: 0,
          shuffleQuestions: false,
          allowReviewBeforeSubmit: false,
          showResultsImmediately: false
        },
        questions: [],
        totalMarks: 0,
        
        studentJoinTime: Timestamp.fromDate(startTime),
        actualEndTime: Timestamp.fromDate(endTime),
        assignmentType: 'class-based',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      console.log('🚀 Creating In-Class Test:', testData);
      const testId = await TestService.createTest(testData as any);
      
      onTestCreated({ ...testData, id: testId });
      onClose();

    } catch (error) {
      console.error('Error creating in-class test:', error);
      alert('Failed to create test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.title.trim() && formData.scheduledStartTime && formData.duration > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-600" />
              Create In-Class Test
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Schedule a test for {className}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Test Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Test Details
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  if (errors.title) setErrors({ ...errors, title: '' });
                }}
                className={`w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Mid-term Physics Paper"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.title}
                </p>
              )}
            </div>
          </div>

          {/* Schedule Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Schedule
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date &amp; Time <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">🕐 Melbourne time</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledStartTime}
                  onChange={(e) => {
                    setFormData({ ...formData, scheduledStartTime: e.target.value });
                    if (errors.scheduledStartTime) setErrors({ ...errors, scheduledStartTime: '' });
                  }}
                  className={`w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.scheduledStartTime ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {melbourneNow && (
                  <p className="mt-1 text-xs text-gray-400">Current Melbourne time: {melbourneNow.replace('T', ' ')}</p>
                )}
                {errors.scheduledStartTime && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.scheduledStartTime}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={(e) => {
                    setFormData({ ...formData, duration: parseInt(e.target.value) || 0 });
                    if (errors.duration) setErrors({ ...errors, duration: '' });
                  }}
                  className={`w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.duration ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="60"
                />
                {errors.duration && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.duration}
                  </p>
                )}
              </div>
            </div>

            {calculatedEndTime && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <Info className="w-4 h-4 inline mr-1" />
                  Test will end at <strong>{calculatedEndTime}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Submission Method Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Submission Method
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                formData.submissionMethod === 'offline_collection'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.submissionMethod === 'offline_collection'}
                      onChange={() => setFormData({ ...formData, submissionMethod: 'offline_collection' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 font-medium text-gray-900 dark:text-white">
                      Offline Collection
                    </span>
                  </div>
                  {formData.submissionMethod === 'offline_collection' && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 ml-7">
                  Students submit physical answer sheets to you
                </p>
              </label>

              <label className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                formData.submissionMethod === 'online_upload'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.submissionMethod === 'online_upload'}
                      onChange={() => setFormData({ ...formData, submissionMethod: 'online_upload' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 font-medium text-gray-900 dark:text-white">
                      Online Upload
                    </span>
                  </div>
                  {formData.submissionMethod === 'online_upload' && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 ml-7">
                  Students upload PDF answers or write digitally
                </p>
              </label>
            </div>
          </div>

          {/* Question Paper Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Question Paper (Optional)
              </h3>
              {formData.examPdfFile && (
                <button
                  onClick={() => setFormData({ ...formData, examPdfFile: null })}
                  className="text-sm text-red-600 hover:text-red-700 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </button>
              )}
            </div>
            
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              formData.examPdfFile
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFormData({ ...formData, examPdfFile: e.target.files?.[0] || null })}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer block">
                {formData.examPdfFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center text-green-600">
                      <Check className="w-8 h-8 mr-2" />
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formData.examPdfFile.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {(formData.examPdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 mx-auto text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        Click to upload PDF
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Students will be able to view this question paper
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Important Notice */}
          {accessTime && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Student Access Information</p>
                  <p>
                    Students will see this test from <strong>{accessTime}</strong> (1 hour before start time).
                    They can only begin the test at the scheduled start time.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end space-x-3">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center"
          >
            {isSubmitting ? (
              <>
                {uploadProgress > 0 && uploadProgress < 100 ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Uploading {uploadProgress}%...
                  </>
                ) : (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                )}
              </>
            ) : (
              'Create In-Class Test'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
