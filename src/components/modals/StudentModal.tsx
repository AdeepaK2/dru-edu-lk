'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, PhoneInput } from '../ui';
import { Student, StudentDocument } from '@/models/studentSchema';
import { validatePhoneNumber, toInternationalFormat } from '@/utils/phoneValidation';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentData: Omit<Student, 'id'>) => void;
  title: string;
  submitButtonText?: string;
  loading?: boolean;
  initialData?: StudentDocument;
}

export default function StudentModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  submitButtonText = 'Save Student',
  loading = false,
  initialData
}: StudentModalProps) {
  const [formData, setFormData] = useState<Omit<Student, 'id'>>({
    name: '',
    email: '',
    phone: '',
    status: 'Active',
    coursesEnrolled: 0,
    enrollmentDate: new Date().toISOString().split('T')[0],
    avatar: '',
    parent: {
      name: '',
      email: '',
      phone: ''
    },
    payment: {
      status: 'Pending',
      method: '',
      lastPayment: 'N/A'
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [studentCountryCode, setStudentCountryCode] = useState('+61');
  const [parentCountryCode, setParentCountryCode] = useState('+61');

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setErrors({}); // Clear errors when modal opens
      if (initialData) {
        setFormData({
          name: initialData.name,
          email: initialData.email,
          phone: initialData.phone,
          status: initialData.status,
          coursesEnrolled: initialData.coursesEnrolled,
          enrollmentDate: initialData.enrollmentDate,
          avatar: initialData.avatar,
          parent: initialData.parent,
          payment: initialData.payment
        });
      } else {
        setFormData({
          name: '',
          email: '',
          phone: '',
          status: 'Active',
          coursesEnrolled: 0,
          enrollmentDate: new Date().toISOString().split('T')[0],
          avatar: '',
          parent: {
            name: '',
            email: '',
            phone: ''
          },
          payment: {
            status: 'Pending',
            method: '',
            lastPayment: 'N/A'
          }
        });
      }
    }
  }, [isOpen, initialData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleParentChange = (field: keyof typeof formData.parent, value: string) => {
    setFormData(prev => ({
      ...prev,
      parent: {
        ...prev.parent,
        [field]: value
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone numbers with more lenient validation
    const newErrors: Record<string, string> = {};
    
    // Basic phone validation - just check if it's not empty and has reasonable length
    if (!formData.phone.trim()) {
      newErrors.studentPhone = 'Student phone number is required';
    } else if (formData.phone.replace(/\D/g, '').length < 9) {
      newErrors.studentPhone = 'Student phone number must have at least 9 digits';
    }
    
    if (!formData.parent.phone.trim()) {
      newErrors.parentPhone = 'Parent phone number is required';
    } else if (formData.parent.phone.replace(/\D/g, '').length < 9) {
      newErrors.parentPhone = 'Parent phone number must have at least 9 digits';
    }
    
    // Basic email validation
    if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.parent.email.includes('@')) {
      newErrors.parentEmail = 'Please enter a valid parent email address';
    }
    
    // Basic name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Student name is required';
    }
    
    if (!formData.parent.name.trim()) {
      newErrors.parentName = 'Parent name is required';
    }
    
    setErrors(newErrors);
    
    // If there are validation errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Normalize phone numbers before submitting
    const submissionData = {
      ...formData,
      phone: toInternationalFormat(formData.phone, studentCountryCode),
      parent: {
        ...formData.parent,
        phone: toInternationalFormat(formData.parent.phone, parentCountryCode)
      }
    };
    
    onSubmit(submissionData);
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: 'Active',
      coursesEnrolled: 0,
      enrollmentDate: new Date().toISOString().split('T')[0],
      avatar: '',
      parent: {
        name: '',
        email: '',
        phone: ''
      },
      payment: {
        status: 'Pending',
        method: '',
        lastPayment: 'N/A'
      }
    });
    setErrors({}); // Clear errors when closing
    onClose();
  };

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
          {/* Error Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Please fix the following errors:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc list-inside space-y-1">
                      {Object.entries(errors).map(([field, message]) => (
                        <li key={field}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Student Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Student Information
              </h4>
              
              <Input
                label="Full Name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter student's full name"
                required
                error={errors.name}
              />

              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter student's email address"
                required
                error={errors.email}
              />

              <Input
                label="Phone Number"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter student's phone number (e.g., +61412345678 or 0412345678)"
                required
                error={errors.studentPhone}
              />

              <Input
                label="Enrollment Date"
                type="date"
                value={formData.enrollmentDate}
                onChange={(e) => handleInputChange('enrollmentDate', e.target.value)}
                required
              />
            </div>

            {/* Parent Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Parent/Guardian Information
              </h4>
              
              <Input
                label="Parent/Guardian Name"
                type="text"
                value={formData.parent.name}
                onChange={(e) => handleParentChange('name', e.target.value)}
                placeholder="Enter parent's full name"
                required
                error={errors.parentName}
              />

              <Input
                label="Parent/Guardian Email"
                type="email"
                value={formData.parent.email}
                onChange={(e) => handleParentChange('email', e.target.value)}
                placeholder="Enter parent's email address"
                required
                error={errors.parentEmail}
              />

              <Input
                label="Parent/Guardian Phone"
                type="tel"
                value={formData.parent.phone}
                onChange={(e) => handleParentChange('phone', e.target.value)}
                placeholder="Enter parent's phone number (e.g., +61412345678 or 0412345678)"
                required
                error={errors.parentPhone}
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
