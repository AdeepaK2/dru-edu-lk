'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '../ui';
import { ClassData, ClassDisplayData, timeSlotSchema } from '@/models/classSchema';
import { CenterDocument } from '@/apiservices/centerFirestoreService';
import { SubjectDocument } from '@/models/subjectSchema';
import { TeacherDocument } from '@/models/teacherSchema';

interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
}

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (classData: ClassData) => Promise<void>;
  title: string;
  submitButtonText?: string;
  loading?: boolean;
  initialData?: ClassDisplayData;
  centers?: CenterDocument[];
  subjects?: SubjectDocument[];
  teachers?: TeacherDocument[];
}

export default function ClassModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  submitButtonText = 'Save Class',
  loading = false,
  initialData,
  centers = [],
  subjects = [],
  teachers = []
}: ClassModalProps) {  const [formData, setFormData] = useState<Omit<ClassData, 'schedule'> & { schedule: TimeSlot[] }>({
    name: '',
    centerId: '1' as const,
    year: '',
    subject: '',
    subjectId: '',
    teacherId: '',
    schedule: [{ day: '', startTime: '', endTime: '' }],
    sessionFee: 0,
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Debug centers data
  useEffect(() => {
    console.log('Centers in ClassModal:', centers);
  }, [centers]);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Parse schedule from display format back to TimeSlot array
        const scheduleSlots: TimeSlot[] = [];
        if (initialData.schedule) {
          const scheduleText = initialData.schedule;
          const slots = scheduleText.split(', ');
          slots.forEach(slot => {
            const [dayPart, timePart] = slot.split(': ');
            if (dayPart && timePart) {
              const [startTime, endTime] = timePart.split(' - ');
              if (startTime && endTime) {
                scheduleSlots.push({
                  day: dayPart.trim(),
                  startTime: startTime.trim(),
                  endTime: endTime.trim()
                });
              }
            }
          });
        }        setFormData({
          name: initialData.name || '',
          centerId: (initialData.centerId as '1' | '2') || '1',
          year: initialData.year || '',
          subject: initialData.subject || '',
          subjectId: '', // Will need to be populated from existing data if available
          teacherId: initialData.teacherId || '', // Populate from existing data
          schedule: scheduleSlots.length > 0 ? scheduleSlots : [{ day: '', startTime: '', endTime: '' }],
          sessionFee: initialData.sessionFee || 0,
          description: initialData.description || ''
        });      } else {
        setFormData({
          name: '',
          centerId: '1',
          year: '',
          subject: '',
          subjectId: '',
          teacherId: '',
          schedule: [{ day: '', startTime: '', endTime: '' }],
          sessionFee: 0,
          description: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData]);
  const handleInputChange = (field: keyof Omit<ClassData, 'schedule'>, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubjectChange = (subjectId: string) => {
    const selectedSubject = subjects.find(s => s.id === subjectId);
    setFormData(prev => ({
      ...prev,
      subjectId: subjectId,
      subject: selectedSubject?.name || ''
    }));
    // Clear subject errors
    if (errors.subject || errors.subjectId) {
      setErrors(prev => ({ 
        ...prev, 
        subject: '', 
        subjectId: '' 
      }));
    }
  };

  const handleScheduleChange = (index: number, field: keyof TimeSlot, value: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
    // Clear schedule errors
    if (errors[`schedule.${index}.${field}`]) {
      setErrors(prev => ({ ...prev, [`schedule.${index}.${field}`]: '' }));
    }
  };

  const addTimeSlot = () => {
    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { day: '', startTime: '', endTime: '' }]
    }));
  };

  const removeTimeSlot = (index: number) => {
    if (formData.schedule.length > 1) {
      setFormData(prev => ({
        ...prev,
        schedule: prev.schedule.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate basic fields
    if (!formData.name.trim()) {
      newErrors.name = 'Class name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Class name must be at least 2 characters';
    }    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.subjectId.trim()) {
      newErrors.subjectId = 'Please select a subject';
    }

    if (!formData.year.trim()) {
      newErrors.year = 'Year is required';
    }

    if (formData.sessionFee < 0) {
      newErrors.sessionFee = 'Session fee must be positive';
    }

    // Validate schedule
    if (formData.schedule.length === 0) {
      newErrors.schedule = 'At least one time slot is required';
    } else {
      formData.schedule.forEach((slot, index) => {
        if (!slot.day.trim()) {
          newErrors[`schedule.${index}.day`] = 'Day is required';
        }
        if (!slot.startTime.trim()) {
          newErrors[`schedule.${index}.startTime`] = 'Start time is required';
        }
        if (!slot.endTime.trim()) {
          newErrors[`schedule.${index}.endTime`] = 'End time is required';
        }
        
        // Validate time format and logic
        if (slot.startTime && slot.endTime) {
          const start = new Date(`2000-01-01 ${slot.startTime}`);
          const end = new Date(`2000-01-01 ${slot.endTime}`);
          if (start >= end) {
            newErrors[`schedule.${index}.endTime`] = 'End time must be after start time';
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {      // Convert form data to ClassData format
      const classData: ClassData = {
        name: formData.name.trim(),
        centerId: formData.centerId,
        year: formData.year.trim(),
        subject: formData.subject.trim(),
        subjectId: formData.subjectId.trim(),
        schedule: formData.schedule.map(slot => ({
          day: slot.day.trim(),
          startTime: slot.startTime.trim(),
          endTime: slot.endTime.trim()
        })),
        sessionFee: Number(formData.sessionFee)
      };

      // Only add description if it has content
      if (formData.description && formData.description.trim()) {
        classData.description = formData.description.trim();
      }

      // Only add teacherId if it's selected
      if (formData.teacherId && formData.teacherId.trim()) {
        classData.teacherId = formData.teacherId.trim();
      }

      await onSubmit(classData);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };
  const handleCancel = () => {
    setFormData({
      name: '',
      centerId: '1',
      year: '',
      subject: '',
      subjectId: '',
      teacherId: '',
      schedule: [{ day: '', startTime: '', endTime: '' }],
      sessionFee: 0,
      description: ''
    });
    setErrors({});
    onClose();
  };
  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  const years = [
    '2025', '2026', '2027', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10'
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="lg"
      closeOnOverlayClick={!loading}
    >
      <form onSubmit={handleSubmit}>
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Class Name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter class name"
                  required
                  error={errors.name}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Center
                </label>
                <select
                  value={formData.centerId}
                  onChange={(e) => handleInputChange('centerId', e.target.value as '1' | '2')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {centers && centers.length > 0 ? (
                    centers.map(center => (
                      <option key={center.center} value={center.center.toString()}>
                        Center {center.center} - {center.location}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="1">Center 1 - Glen Waverley</option>
                      <option value="2">Center 2 - Cranbourne</option>
                    </>
                  )}
                </select>
                {errors.centerId && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.centerId}
                  </p>
                )}
              </div>
            </div>            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject *
                </label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Select a subject</option>
                  {subjects
                    .filter(subject => subject.isActive)
                    .map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} - Grade {subject.grade}
                      </option>
                    ))}
                </select>
                {(errors.subject || errors.subjectId) && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.subject || errors.subjectId}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year Level
                </label>
                <select
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Select Year</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                {errors.year && <p className="mt-1 text-sm text-red-600">{errors.year}</p>}
              </div>
            </div>

            {/* Teacher Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assigned Teacher
              </label>
              <select
                value={formData.teacherId || ''}
                onChange={(e) => handleInputChange('teacherId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">No teacher assigned</option>
                {teachers
                  .filter(teacher => teacher.status === 'Active')
                  .map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.subjects?.join(', ') || 'Various'}
                    </option>
                  ))}
              </select>
              {errors.teacherId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.teacherId}
                </p>
              )}
            </div>

            <div>
              <Input
                label="Session Fee (AUD)"
                type="number"
                value={formData.sessionFee}
                onChange={(e) => handleInputChange('sessionFee', parseFloat(e.target.value) || 0)}
                placeholder="Enter session fee"
                min="0"
                step="0.01"
                required
                error={errors.sessionFee}
              />
            </div>

            {/* Schedule Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Schedule
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTimeSlot}
                  className="flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Time Slot</span>
                </Button>
              </div>

              {errors.schedule && (
                <p className="mb-3 text-sm text-red-600">{errors.schedule}</p>
              )}

              <div className="space-y-3">
                {formData.schedule.map((slot, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                    <div className="flex-1">
                      <select
                        value={slot.day}
                        onChange={(e) => handleScheduleChange(index, 'day', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        required
                      >
                        <option value="">Select Day</option>
                        {daysOfWeek.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      {errors[`schedule.${index}.day`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`schedule.${index}.day`]}</p>
                      )}
                    </div>

                    <div className="flex-1">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => handleScheduleChange(index, 'startTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        required
                      />
                      {errors[`schedule.${index}.startTime`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`schedule.${index}.startTime`]}</p>
                      )}
                    </div>

                    <div className="flex-1">
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => handleScheduleChange(index, 'endTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        required
                      />
                      {errors[`schedule.${index}.endTime`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`schedule.${index}.endTime`]}</p>
                      )}
                    </div>

                    {formData.schedule.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTimeSlot(index)}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter class description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-700">
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            className="sm:ml-3 sm:w-auto"
          >
            {submitButtonText}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="mt-3 sm:mt-0 sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
