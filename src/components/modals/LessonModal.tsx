'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Clock, Target, Package, CheckCircle } from 'lucide-react';
import { Button, Input, TextArea } from '@/components/ui';
import { LessonData, getDefaultLessonData, validateLessonData } from '@/models/lessonSchema';
import { LessonDisplayData } from '@/models/lessonSchema';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LessonData) => Promise<void>;
  loading?: boolean;
  title: string;
  submitButtonText: string;
  initialData?: LessonDisplayData;
  subjectId: string;
  subjectName: string;
}

export default function LessonModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  title,
  submitButtonText,
  initialData,
  subjectId,
  subjectName,
}: LessonModalProps) {
  const [formData, setFormData] = useState<Partial<LessonData>>(() => ({
    ...getDefaultLessonData(),
    duration: 60, // Ensure duration defaults to 60
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newObjective, setNewObjective] = useState('');
  const [newMaterial, setNewMaterial] = useState('');
  const [newPrerequisite, setNewPrerequisite] = useState('');

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || '',
        subjectId: initialData.subjectId,
        order: initialData.order,
        isActive: initialData.isActive,
        duration: initialData.duration,
        objectives: initialData.objectives || [],
        materials: initialData.materials || [],
        prerequisites: initialData.prerequisites || [],
      });
    } else {
      setFormData({
        ...getDefaultLessonData(),
        subjectId,
        duration: 60, // Default to 60 minutes for new lessons
      });
    }
    setErrors({});
  }, [initialData, subjectId, isOpen]);

  const handleInputChange = (field: keyof LessonData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleArrayAdd = (field: 'objectives' | 'materials' | 'prerequisites', value: string) => {
    if (!value.trim()) return;
    
    const currentArray = formData[field] || [];
    setFormData(prev => ({
      ...prev,
      [field]: [...currentArray, value.trim()],
    }));
    
    // Clear the input
    if (field === 'objectives') setNewObjective('');
    if (field === 'materials') setNewMaterial('');
    if (field === 'prerequisites') setNewPrerequisite('');
  };

  const handleArrayRemove = (field: 'objectives' | 'materials' | 'prerequisites', index: number) => {
    const currentArray = formData[field] || [];
    setFormData(prev => ({
      ...prev,
      [field]: currentArray.filter((_, i) => i !== index),
    }));
  };

  const validateForm = (): boolean => {
    try {
      validateLessonData(formData);
      setErrors({});
      return true;
    } catch (error: any) {
      const newErrors: Record<string, string> = {};
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path && err.path.length > 0) {
            newErrors[err.path[0]] = err.message;
          }
        });
      }
      setErrors(newErrors);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData as LessonData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Subject: {subjectName}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lesson Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter lesson name"
                  className={errors.name ? 'border-red-500' : ''}
                  disabled={loading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Order <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.order || 1}
                  onChange={(e) => handleInputChange('order', parseInt(e.target.value) || 1)}
                  placeholder="Display order"
                  className={errors.order ? 'border-red-500' : ''}
                  disabled={loading}
                />
                {errors.order && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.order}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Duration (minutes)
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="number"
                    min="1"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Duration"
                    className={`pl-10 ${errors.duration ? 'border-red-500' : ''}`}
                    disabled={loading}
                  />
                </div>
                {errors.duration && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.duration}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <TextArea
                value={formData.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('description', e.target.value)}
                placeholder="Enter lesson description (optional)"
                rows={3}
                className={errors.description ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
              )}
            </div>

            {/* Learning Objectives */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Target className="inline w-4 h-4 mr-1" />
                Learning Objectives
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newObjective}
                    onChange={(e) => setNewObjective(e.target.value)}
                    placeholder="Add learning objective"
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleArrayAdd('objectives', newObjective);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleArrayAdd('objectives', newObjective)}
                    disabled={loading || !newObjective.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.objectives && formData.objectives.length > 0 && (
                  <div className="space-y-1">
                    {formData.objectives.map((objective, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span className="text-sm">{objective}</span>
                        <button
                          type="button"
                          onClick={() => handleArrayRemove('objectives', index)}
                          disabled={loading}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Materials */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Package className="inline w-4 h-4 mr-1" />
                Materials & Resources
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    placeholder="Add material or resource"
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleArrayAdd('materials', newMaterial);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleArrayAdd('materials', newMaterial)}
                    disabled={loading || !newMaterial.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.materials && formData.materials.length > 0 && (
                  <div className="space-y-1">
                    {formData.materials.map((material, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span className="text-sm">{material}</span>
                        <button
                          type="button"
                          onClick={() => handleArrayRemove('materials', index)}
                          disabled={loading}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Prerequisites */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <CheckCircle className="inline w-4 h-4 mr-1" />
                Prerequisites
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newPrerequisite}
                    onChange={(e) => setNewPrerequisite(e.target.value)}
                    placeholder="Add prerequisite"
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleArrayAdd('prerequisites', newPrerequisite);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleArrayAdd('prerequisites', newPrerequisite)}
                    disabled={loading || !newPrerequisite.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.prerequisites && formData.prerequisites.length > 0 && (
                  <div className="space-y-1">
                    {formData.prerequisites.map((prerequisite, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span className="text-sm">{prerequisite}</span>
                        <button
                          type="button"
                          onClick={() => handleArrayRemove('prerequisites', index)}
                          disabled={loading}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive || false}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Active lesson
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{submitButtonText}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
