'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/form/Input';
import Select from '@/components/ui/form/Select';
import PhoneInput from '@/components/ui/form/PhoneInput';
import Textarea from '@/components/ui/form/TextArea';
import { CalendarDays, Clock, MapPin, DollarSign, Users, BookOpen, CheckCircle, ArrowLeft } from 'lucide-react';
import { ClassDocument } from '@/models/classSchema';
import { EnrollmentRequestData, enrollmentRequestSchema } from '@/models/enrollmentRequestSchema';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { firestore, auth } from '@/utils/firebase-client';
import { collection, addDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { validatePhoneNumber, toInternationalFormat } from '@/utils/phoneValidation';
import { useGuestAuth } from '@/hooks/useGuestAuth';

interface EnrollmentFormData {
  // Student Information
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  dateOfBirth: string;
  school: string;
  
  // Parent Information
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  relationship: 'Mother' | 'Father' | 'Guardian' | 'Other';
  
  // Enrollment Details
  selectedClassIds: string[];
  agreedToTerms: boolean;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'Mother', label: 'Mother' },
  { value: 'Father', label: 'Father' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Other', label: 'Other' },
];

export default function EnrollmentPage() {
  const router = useRouter();
  const { authLoading, isGuestSession, cleanupGuestSession } = useGuestAuth();
  
  const [classes, setClasses] = useState<ClassDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'subject' | 'year' | 'fee'>('name');
  const [submittedClassCount, setSubmittedClassCount] = useState(0);
  const [studentCountryCode, setStudentCountryCode] = useState('+61');
  const [parentCountryCode, setParentCountryCode] = useState('+61');
  
  const [formData, setFormData] = useState<EnrollmentFormData>({
    studentName: '',
    studentEmail: '',
    studentPhone: '',
    dateOfBirth: '',
    school: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    relationship: 'Mother',
    selectedClassIds: [],
    agreedToTerms: false,
  });

  // Fetch available classes (after authentication)
  useEffect(() => {
    const fetchClasses = async () => {
      // Wait for authentication to complete
      if (authLoading) return;
      
      try {
        console.log('Fetching classes...');
        const classesQuery = query(collection(firestore, 'classes'));
        const querySnapshot = await getDocs(classesQuery);
        const classesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ClassDocument[];
        
        console.log('Found classes:', classesData.length);
        
        // Filter only active classes
        const activeClasses = classesData.filter((cls: ClassDocument) => cls.status === 'Active');
        console.log('Active classes:', activeClasses.length);
        setClasses(activeClasses);
        
      } catch (error) {
        console.error('Error fetching classes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, [authLoading]); // Depend on authLoading to run after authentication

  const handleInputChange = (field: keyof EnrollmentFormData, value: string | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClassSelection = (classId: string, isSelected: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedClassIds: isSelected 
        ? [...prev.selectedClassIds, classId]
        : prev.selectedClassIds.filter(id => id !== classId)
    }));
  };

  const sortedClasses = [...classes].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'subject':
        return a.subject.localeCompare(b.subject);
      case 'year':
        return a.year.localeCompare(b.year);
      case 'fee':
        return a.monthlyFee - b.monthlyFee;
      default:
        return 0;
    }
  });

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.studentName.trim()) errors.push('Student name is required');
    if (!formData.studentEmail.trim()) errors.push('Student email is required');
    if (!formData.studentPhone.trim()) errors.push('Student phone is required');
    if (!formData.dateOfBirth) errors.push('Date of birth is required');
    if (!formData.school.trim()) errors.push('School name is required');
    
    if (!formData.parentName.trim()) errors.push('Parent name is required');
    if (!formData.parentEmail.trim()) errors.push('Parent email is required');
    if (!formData.parentPhone.trim()) errors.push('Parent phone is required');
    
    if (formData.selectedClassIds.length === 0) errors.push('Please select at least one class');
    if (!formData.agreedToTerms) errors.push('You must agree to terms and conditions');
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.studentEmail && !emailRegex.test(formData.studentEmail)) {
      errors.push('Student email format is invalid');
    }
    if (formData.parentEmail && !emailRegex.test(formData.parentEmail)) {
      errors.push('Parent email format is invalid');
    }
    
    // Phone validation
    const studentPhoneValidation = validatePhoneNumber(formData.studentPhone, studentCountryCode);
    if (!studentPhoneValidation.isValid) {
      errors.push(`Student phone: ${studentPhoneValidation.message}`);
    }
    
    const parentPhoneValidation = validatePhoneNumber(formData.parentPhone, parentCountryCode);
    if (!parentPhoneValidation.isValid) {
      errors.push(`Parent phone: ${parentPhoneValidation.message}`);
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      alert('Please fix the following errors:\n' + errors.join('\n'));
      return;
    }
    
    const selectedClasses = classes.filter(cls => formData.selectedClassIds.includes(cls.id));
    if (selectedClasses.length === 0) {
      alert('Selected classes not found');
      return;
    }
    
    setSubmitting(true);
    
    try {
        // Check for existing enrollment requests for this email and classes
        const existingRequestsQuery = query(
          collection(firestore, 'enrollmentRequests'),
          where('student.email', '==', formData.studentEmail),
          where('status', 'in', ['Pending', 'Approved'])
        );
        const existingRequestsSnapshot = await getDocs(existingRequestsQuery);
        
        // Get the class IDs that already have pending/approved requests
        const existingClassIds = existingRequestsSnapshot.docs.map(doc => doc.data().classId);
        
        // Filter out classes that already have enrollment requests
        const newClassesToEnroll = selectedClasses.filter(cls => !existingClassIds.includes(cls.id));
        const duplicateClasses = selectedClasses.filter(cls => existingClassIds.includes(cls.id));
        
        // Warn about duplicate requests
        if (duplicateClasses.length > 0) {
          const duplicateNames = duplicateClasses.map(cls => cls.name).join(', ');
          alert(`Note: You already have pending/approved enrollment requests for: ${duplicateNames}. Only new class requests will be submitted.`);
        }
        
        // If no new classes to enroll, stop here
        if (newClassesToEnroll.length === 0) {
          alert('All selected classes already have pending or approved enrollment requests for this email.');
          return;
        }
        
        // Create enrollment requests for each new selected class
        const enrollmentPromises = newClassesToEnroll.map(async (selectedClass) => {
          const enrollmentData: EnrollmentRequestData = {
            student: {
              name: formData.studentName,
              email: formData.studentEmail,
              phone: toInternationalFormat(formData.studentPhone, studentCountryCode),
              dateOfBirth: formData.dateOfBirth,
              year: selectedClass.year, // Use the class's year level
              school: formData.school,
            },
            parent: {
              name: formData.parentName,
              email: formData.parentEmail,
              phone: toInternationalFormat(formData.parentPhone, parentCountryCode),
              relationship: formData.relationship,
            },
            classId: selectedClass.id,
            className: selectedClass.name,
            subject: selectedClass.subject,
            centerName: `Center ${selectedClass.centerId}`,
            monthlyFee: selectedClass.monthlyFee,
            preferredStartDate: new Date().toISOString().split('T')[0], // Use current date
            additionalNotes: '', // Remove additional notes
            agreedToTerms: formData.agreedToTerms,
          };        // Validate data with Zod schema
        const validatedData = enrollmentRequestSchema.parse(enrollmentData);
        
        // Create enrollment request document
        const enrollmentRequestDoc = {
          ...validatedData,
          status: 'Pending' as const,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        // Add to Firestore
        return addDoc(collection(firestore, 'enrollmentRequests'), enrollmentRequestDoc);
      });
      
      // Wait for all enrollment requests to be submitted
      await Promise.all(enrollmentPromises);
      
      // Store the count before resetting form
      setSubmittedClassCount(newClassesToEnroll.length);
      setSuccess(true);
      
      // Reset form
      setFormData({
        studentName: '',
        studentEmail: '',
        studentPhone: '',
        dateOfBirth: '',
        school: '',
        parentName: '',
        parentEmail: '',
        parentPhone: '',
        relationship: 'Mother',
        selectedClassIds: [],
        agreedToTerms: false,
      });
    } catch (error) {
      console.error('Error submitting enrollment:', error);
      if (error instanceof Error) {
        alert('Failed to submit enrollment request: ' + error.message);
      } else {
        alert('Failed to submit enrollment request. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatSchedule = (schedule: any[]) => {
    if (!schedule || schedule.length === 0) return 'Schedule TBA';
    return schedule.map(slot => `${slot.day}: ${slot.startTime} - ${slot.endTime}`).join(', ');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-[#0088e0] border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">
            {authLoading ? 'Preparing enrollment form...' : 'Loading enrollment form...'}
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Enrollment Request{submittedClassCount > 1 ? 's' : ''} Submitted!
            </h2>
            <p className="text-gray-600 mb-6">
              Thank you for your interest in Dr. U Education. We'll review your application{submittedClassCount > 1 ? 's' : ''} 
              and contact you within 2-3 business days.
            </p>
            <div className="space-y-3">
              <Link href="/">
                <Button className="w-full bg-[#0088e0] hover:bg-[#0066b3] text-white">
                  Return to Home
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSuccess(false)}
              >
                Submit Another Request
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0] text-white py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center text-blue-100 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold mb-2">Student Enrollment</h1>
          <p className="text-lg text-blue-100">
            Join Dr. U Education and start your journey to academic excellence
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-[#01143d]">Enrollment Application</CardTitle>
            <p className="text-gray-600">
              Please fill out all required information to submit your enrollment request.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Student Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Student Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Student Name"
                    value={formData.studentName}
                    onChange={(e) => handleInputChange('studentName', e.target.value)}
                    required
                  />
                  <Input
                    label="Student Email"
                    type="email"
                    value={formData.studentEmail}
                    onChange={(e) => handleInputChange('studentEmail', e.target.value)}
                    required
                  />
                  <PhoneInput
                    label="Student Phone"
                    value={formData.studentPhone}
                    countryCode={studentCountryCode}
                    onPhoneChange={(value) => handleInputChange('studentPhone', value)}
                    onCountryCodeChange={setStudentCountryCode}
                    required
                  />
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    required
                  />
                  <Input
                    label="Current School"
                    value={formData.school}
                    onChange={(e) => handleInputChange('school', e.target.value)}
                    required
                    className="md:col-span-2"
                  />
                </div>
              </div>

              {/* Parent Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Parent/Guardian Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Parent/Guardian Name"
                    value={formData.parentName}
                    onChange={(e) => handleInputChange('parentName', e.target.value)}
                    required
                  />
                  <Input
                    label="Parent/Guardian Email"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                    required
                  />
                  <PhoneInput
                    label="Parent/Guardian Phone"
                    value={formData.parentPhone}
                    countryCode={parentCountryCode}
                    onPhoneChange={(value) => handleInputChange('parentPhone', value)}
                    onCountryCodeChange={setParentCountryCode}
                    required
                  />
                  <Select
                    label="Relationship to Student"
                    value={formData.relationship}
                    onChange={(e) => handleInputChange('relationship', e.target.value as any)}
                    options={RELATIONSHIP_OPTIONS}
                    required
                  />
                </div>
              </div>

              {/* Class Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Selection</h3>
                
                {/* Sort Options */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort classes by:</label>
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'subject' | 'year' | 'fee')}
                    options={[
                      { value: 'name', label: 'Class Name' },
                      { value: 'subject', label: 'Subject' },
                      { value: 'year', label: 'Year Level' },
                      { value: 'fee', label: 'Monthly Fee' },
                    ]}
                  />
                </div>

                {/* Available Classes */}
                <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {sortedClasses.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No classes available</p>
                  ) : (
                    sortedClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          formData.selectedClassIds.includes(cls.id)
                            ? 'border-[#0088e0] bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleClassSelection(cls.id, !formData.selectedClassIds.includes(cls.id))}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <input
                                type="checkbox"
                                checked={formData.selectedClassIds.includes(cls.id)}
                                onChange={(e) => handleClassSelection(cls.id, e.target.checked)}
                                className="mr-3 w-4 h-4 text-[#0088e0] border-gray-300 rounded focus:ring-[#0088e0]"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <h4 className="font-semibold text-[#01143d]">{cls.name}</h4>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-600 ml-7">
                              <div className="flex items-center">
                                <BookOpen className="w-4 h-4 mr-2" />
                                {cls.subject} - {cls.year}
                              </div>
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-2" />
                                Center {cls.centerId}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                {formatSchedule(cls.schedule)}
                              </div>
                              <div className="flex items-center">
                                <DollarSign className="w-4 h-4 mr-2" />
                                ${cls.monthlyFee}/month
                              </div>
                            </div>
                            {cls.description && (
                              <p className="mt-2 text-sm text-gray-600 ml-7">{cls.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Selected Classes Summary */}
                {formData.selectedClassIds.length > 0 && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">
                      Selected Classes ({formData.selectedClassIds.length})
                    </h4>
                    <div className="space-y-2">
                      {formData.selectedClassIds.map(classId => {
                        const cls = classes.find(c => c.id === classId);
                        return cls ? (
                          <div key={classId} className="flex items-center justify-between text-sm">
                            <span className="text-green-700">
                              {cls.name} - {cls.subject} ({cls.year})
                            </span>
                            <span className="text-green-800 font-medium">
                              ${cls.monthlyFee}/month
                            </span>
                          </div>
                        ) : null;
                      })}
                      <div className="border-t border-green-300 pt-2 mt-2">
                        <div className="flex items-center justify-between font-semibold text-green-800">
                          <span>Total Monthly Fee:</span>
                          <span>
                            ${formData.selectedClassIds.reduce((total, classId) => {
                              const cls = classes.find(c => c.id === classId);
                              return total + (cls?.monthlyFee || 0);
                            }, 0)}/month
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Terms and Conditions */}
              <div className="border-t pt-6">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.agreedToTerms}
                    onChange={(e) => handleInputChange('agreedToTerms', e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#0088e0] border-gray-300 rounded focus:ring-[#0088e0]"
                    required
                  />
                  <label htmlFor="terms" className="text-sm text-gray-600">
                    I agree to the <span className="text-[#0088e0] underline cursor-pointer">terms and conditions</span>, 
                    <span className="text-[#0088e0] underline cursor-pointer ml-1">privacy policy</span>, and enrollment policies of Dr. U Education.
                    I understand that enrollment is subject to approval and available spaces.
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-6 border-t">
                <Button
                  type="submit"
                  disabled={submitting || formData.selectedClassIds.length === 0}
                  className="px-8 py-3 bg-[#0088e0] hover:bg-[#0066b3] text-white disabled:opacity-50"
                >
                  {submitting 
                    ? 'Submitting...' 
                    : `Submit Enrollment Request${formData.selectedClassIds.length > 1 ? 's' : ''} (${formData.selectedClassIds.length} class${formData.selectedClassIds.length !== 1 ? 'es' : ''})`
                  }
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
