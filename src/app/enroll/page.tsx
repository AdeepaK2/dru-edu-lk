'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/form/Input';
import Select from '@/components/ui/form/Select';
import Textarea from '@/components/ui/form/TextArea';
import { CalendarDays, Clock, MapPin, DollarSign, Users, BookOpen, CheckCircle, ArrowLeft } from 'lucide-react';
import { ClassDocument } from '@/models/classSchema';
import { EnrollmentRequestData, enrollmentRequestSchema } from '@/models/enrollmentRequestSchema';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { firestore, auth } from '@/utils/firebase-client';
import { collection, addDoc, getDocs, query, Timestamp, where, updateDoc, doc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useGuestAuth } from '@/hooks/useGuestAuth';

interface EnrollmentFormData {
  // Student Information
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  confirmStudentEmail: string;
  studentPhone: string;
  dateOfBirth: string;
  school: string;
  
  // Parent Information
  parentName: string;
  parentEmail: string;
  confirmParentEmail: string;
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

// Center location mapping
const CENTER_LOCATIONS = {
  '1': 'Glen Waverley',
  '2': 'Cranbourne',
  // Add more centers as needed
} as const;

export default function EnrollmentPage() {
  const router = useRouter();
  const { authLoading, isGuestSession, cleanupGuestSession } = useGuestAuth();
  
  const [classes, setClasses] = useState<ClassDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'subject' | 'year' | 'fee' | 'location'>('name');
  const [submittedClassCount, setSubmittedClassCount] = useState(0);
  
  // Phone validation errors for real-time feedback
  const [phoneErrors, setPhoneErrors] = useState<{
    studentPhone: string;
    parentPhone: string;
  }>({ studentPhone: '', parentPhone: '' });
  
  // Name validation errors for real-time feedback
  const [nameErrors, setNameErrors] = useState<{
    studentFirstName: string;
    studentLastName: string;
    parentName: string;
  }>({ studentFirstName: '', studentLastName: '', parentName: '' });
  
  const [formData, setFormData] = useState<EnrollmentFormData>({
    studentFirstName: '',
    studentLastName: '',
    studentEmail: '',
    confirmStudentEmail: '',
    studentPhone: '',
    dateOfBirth: '',
    school: '',
    parentName: '',
    parentEmail: '',
    confirmParentEmail: '',
    parentPhone: '',
    relationship: 'Mother',
    selectedClassIds: [],
    agreedToTerms: false,
  });

  // Map of teacherId -> teacherName
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});

  // Fetch available classes with real-time updates (after authentication)
  useEffect(() => {
    // Wait for authentication to complete
    if (authLoading) return;
    
    console.log('Setting up real-time class subscription for enrollment...');
    
    // Subscribe to real-time class updates
    const unsubscribe = ClassFirestoreService.subscribeToClasses(
      (classesData: ClassDocument[]) => {
        console.log('Received class updates:', classesData.length);
        
        // Filter only active classes
        const activeClasses = classesData.filter((cls: ClassDocument) => cls.status === 'Active');
        console.log('Active classes:', activeClasses.length);
        setClasses(activeClasses);
        setLoading(false);
      },
      (error: Error) => {
        console.error('Error in class subscription:', error);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up enrollment class subscription');
      unsubscribe();
    };
  }, [authLoading]); // Depend on authLoading to run after authentication

  // Load teacher names whenever classes change
  useEffect(() => {
    const loadTeacherNames = async () => {
      try {
        const uniqueTeacherIds = Array.from(new Set(classes.map(c => (c as any).teacherId).filter(Boolean)));
        if (uniqueTeacherIds.length === 0) {
          setTeacherNames({});
          return;
        }

        const nameMap: Record<string, string> = {};
        await Promise.all(uniqueTeacherIds.map(async (tid) => {
          try {
            const teacher = await TeacherFirestoreService.getTeacherById(tid);
            nameMap[tid] = teacher?.name ?? 'Unknown Teacher';
          } catch (err) {
            console.warn(`Failed to load teacher ${tid}`, err);
            nameMap[tid] = 'Unknown Teacher';
          }
        }));

        setTeacherNames(nameMap);
      } catch (err) {
        console.error('Error loading teacher names', err);
        setTeacherNames({});
      }
    };

    loadTeacherNames();
  }, [classes]);

  // Helper function to validate name (no emojis, special characters, or numbers)
  const validateName = (name: string): { isValid: boolean; message: string } => {
    if (!name.trim()) {
      return { isValid: true, message: '' }; // Let required validation handle empty
    }
    
    // Check for emojis - emoji regex pattern
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]/u;
    
    if (emojiRegex.test(name)) {
      return { 
        isValid: false, 
        message: 'Name cannot contain emojis. Please use only letters.' 
      };
    }
    
    // Check for numbers
    if (/\d/.test(name)) {
      return { 
        isValid: false, 
        message: 'Name cannot contain numbers. Please use only letters.' 
      };
    }
    
    // Check for special characters (allow letters, spaces, hyphens, apostrophes, and periods)
    // This covers names like "O'Connor", "Mary-Jane", "Dr. Smith", and international characters
    const validNameRegex = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'\-\.]+$/;
    if (!validNameRegex.test(name)) {
      return { 
        isValid: false, 
        message: 'Name can only contain letters, spaces, hyphens, and apostrophes.' 
      };
    }
    
    // Check minimum length (at least 2 characters for a valid name)
    if (name.trim().length < 2) {
      return { 
        isValid: false, 
        message: 'Name must be at least 2 characters long.' 
      };
    }
    
    return { isValid: true, message: '' };
  };
  
  // Helper function to sanitize name (remove invalid characters)
  const sanitizeName = (name: string): string => {
    // Remove emojis and other unwanted characters, keep letters, spaces, hyphens, apostrophes, periods
    return name
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]/gu, '')
      .replace(/[0-9]/g, '')
      .replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'\-\.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper function to format Australian phone number
  const formatAustralianPhone = (phone: string): string => {
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');
    
    // If it starts with 61 (country code already present), remove it first
    if (digits.startsWith('61') && digits.length >= 11) {
      digits = digits.substring(2);
    }
    
    // If it starts with 04, convert to international format
    if (digits.startsWith('04') && digits.length === 10) {
      return `+61${digits.substring(1)}`;
    }
    
    // If it starts with 4 (without 0), add +61
    if (digits.startsWith('4') && digits.length === 9) {
      return `+61${digits}`;
    }
    
    // If it's 10 digits starting with 04, convert
    if (digits.length === 10 && digits.startsWith('04')) {
      return `+61${digits.substring(1)}`;
    }
    
    // Default: assume it's a 9-digit mobile starting with 4
    if (digits.length === 9 && digits.startsWith('4')) {
      return `+61${digits}`;
    }
    
    // For numbers that don't match Australian mobile format, return as-is with +61 prefix
    // but only if it doesn't already have it
    if (digits.length > 0) {
      return `+61${digits}`;
    }
    
    return phone; // Return original if empty
  };

  // Helper function to validate Australian mobile number
  const validateAustralianMobile = (phone: string): { isValid: boolean; message: string } => {
    // If empty, let required validation handle it
    if (!phone.trim()) {
      return { isValid: true, message: '' };
    }
    
    let digits = phone.replace(/\D/g, '');
    
    // If it starts with 61 (country code), remove it for validation
    if (digits.startsWith('61') && digits.length >= 11) {
      digits = digits.substring(2);
    }
    
    // Check if it's a valid Australian mobile format
    // 10 digits starting with 04 (e.g., 0412345678)
    if (digits.length === 10 && digits.startsWith('04')) {
      return { isValid: true, message: '' };
    }
    
    // 9 digits starting with 4 (e.g., 412345678)
    if (digits.length === 9 && digits.startsWith('4')) {
      return { isValid: true, message: '' };
    }
    
    // Provide specific error messages based on the issue
    if (digits.length === 0) {
      return { 
        isValid: false, 
        message: 'Please enter a phone number' 
      };
    }
    
    if (!digits.startsWith('04') && !digits.startsWith('4') && !digits.startsWith('61')) {
      return { 
        isValid: false, 
        message: 'Australian mobile numbers start with 04 (e.g., 0412 345 678)' 
      };
    }
    
    if (digits.length < 9) {
      return { 
        isValid: false, 
        message: `Phone number is too short. Enter ${10 - digits.length} more digit${10 - digits.length > 1 ? 's' : ''}` 
      };
    }
    
    if (digits.length > 10 && !digits.startsWith('61')) {
      return { 
        isValid: false, 
        message: 'Phone number is too long. Australian mobiles are 10 digits (e.g., 0412 345 678)' 
      };
    }
    
    return { 
      isValid: false, 
      message: 'Enter a valid Australian mobile (e.g., 0412 345 678 or +61 412 345 678)' 
    };
  };

  const handleInputChange = (field: keyof EnrollmentFormData, value: string | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Real-time phone validation
    if (field === 'studentPhone' && typeof value === 'string') {
      const validation = validateAustralianMobile(value);
      setPhoneErrors(prev => ({
        ...prev,
        studentPhone: value.trim() ? (validation.isValid ? '' : validation.message) : ''
      }));
    }
    
    if (field === 'parentPhone' && typeof value === 'string') {
      const validation = validateAustralianMobile(value);
      setPhoneErrors(prev => ({
        ...prev,
        parentPhone: value.trim() ? (validation.isValid ? '' : validation.message) : ''
      }));
    }
    
    // Real-time name validation
    if (field === 'studentFirstName' && typeof value === 'string') {
      const validation = validateName(value);
      setNameErrors(prev => ({
        ...prev,
        studentFirstName: value.trim() ? (validation.isValid ? '' : validation.message) : ''
      }));
    }
    
    if (field === 'studentLastName' && typeof value === 'string') {
      const validation = validateName(value);
      setNameErrors(prev => ({
        ...prev,
        studentLastName: value.trim() ? (validation.isValid ? '' : validation.message) : ''
      }));
    }
    
    if (field === 'parentName' && typeof value === 'string') {
      const validation = validateName(value);
      setNameErrors(prev => ({
        ...prev,
        parentName: value.trim() ? (validation.isValid ? '' : validation.message) : ''
      }));
    }
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
        return a.sessionFee - b.sessionFee;
      case 'location':
        return getCenterLocation(a.centerId).localeCompare(getCenterLocation(b.centerId));
      default:
        return 0;
    }
  });

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.studentFirstName.trim()) {
      errors.push('Student first name is required');
    } else {
      const firstNameValidation = validateName(formData.studentFirstName);
      if (!firstNameValidation.isValid) {
        setNameErrors(prev => ({ ...prev, studentFirstName: firstNameValidation.message }));
        errors.push(`First name: ${firstNameValidation.message}`);
      }
    }
    
    if (!formData.studentLastName.trim()) {
      errors.push('Student last name is required');
    } else {
      const lastNameValidation = validateName(formData.studentLastName);
      if (!lastNameValidation.isValid) {
        setNameErrors(prev => ({ ...prev, studentLastName: lastNameValidation.message }));
        errors.push(`Last name: ${lastNameValidation.message}`);
      }
    }
    if (!formData.studentEmail.trim()) errors.push('Student email is required');
    if (!formData.studentPhone.trim()) errors.push('Student phone number is required');
    if (!formData.dateOfBirth) errors.push('Date of birth is required');
    if (!formData.school.trim()) errors.push('School name is required');
    
    if (!formData.parentName.trim()) {
      errors.push('Parent/Guardian name is required');
    } else {
      const parentNameValidation = validateName(formData.parentName);
      if (!parentNameValidation.isValid) {
        setNameErrors(prev => ({ ...prev, parentName: parentNameValidation.message }));
        errors.push(`Parent name: ${parentNameValidation.message}`);
      }
    }
    if (!formData.parentEmail.trim()) errors.push('Parent/Guardian email is required');
    if (!formData.parentPhone.trim()) errors.push('Parent/Guardian phone number is required');
    
    if (formData.studentEmail !== formData.confirmStudentEmail) {
      errors.push('Student emails do not match');
    }
    
    if (formData.parentEmail !== formData.confirmParentEmail) {
      errors.push('Parent/Guardian emails do not match');
    }
    
    if (formData.selectedClassIds.length === 0) errors.push('Please select at least one class to enroll in');
    if (!formData.agreedToTerms) errors.push('You must agree to the terms and conditions');
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.studentEmail && !emailRegex.test(formData.studentEmail)) {
      errors.push('Student email format is invalid (e.g., student@example.com)');
    }
    if (formData.parentEmail && !emailRegex.test(formData.parentEmail)) {
      errors.push('Parent email format is invalid (e.g., parent@example.com)');
    }
    
    // Phone validation - only add error if phone is provided but invalid
    if (formData.studentPhone.trim()) {
      const studentPhoneValidation = validateAustralianMobile(formData.studentPhone);
      if (!studentPhoneValidation.isValid) {
        // Update inline error state
        setPhoneErrors(prev => ({ ...prev, studentPhone: studentPhoneValidation.message }));
        errors.push(`Student phone: ${studentPhoneValidation.message}`);
      }
    }
    
    if (formData.parentPhone.trim()) {
      const parentPhoneValidation = validateAustralianMobile(formData.parentPhone);
      if (!parentPhoneValidation.isValid) {
        // Update inline error state
        setPhoneErrors(prev => ({ ...prev, parentPhone: parentPhoneValidation.message }));
        errors.push(`Parent phone: ${parentPhoneValidation.message}`);
      }
    }
    
    return errors;
  };

  // Helper function to get center display name
  const getCenterDisplayName = (centerId: string | number): string => {
    const id = centerId.toString();
    const location = CENTER_LOCATIONS[id as keyof typeof CENTER_LOCATIONS];
    return location ? `Center ${id} - ${location}` : `Center ${id}`;
  };

  // Helper function to get just the location name
  const getCenterLocation = (centerId: string | number): string => {
    const id = centerId.toString();
    return CENTER_LOCATIONS[id as keyof typeof CENTER_LOCATIONS] || `Center ${id}`;
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
        // 1. Check if student already exists in the system
        const existingStudentQuery = query(
          collection(firestore, 'students'),
          where('email', '==', formData.studentEmail)
        );
        const existingStudentSnapshot = await getDocs(existingStudentQuery);
        
        if (!existingStudentSnapshot.empty) {
          const existingStudent = existingStudentSnapshot.docs[0].data();
          alert(`A student with email ${formData.studentEmail} is already enrolled in the system. If you are an existing student, please contact the administration to enroll in additional classes.`);
          return;
        }

        // 2. Check for existing enrollment requests for this email and classes
        const existingRequestsQuery = query(
          collection(firestore, 'enrollmentRequests'),
          where('student.email', '==', formData.studentEmail),
          where('status', 'in', ['Pending', 'Approved'])
        );
        const existingRequestsSnapshot = await getDocs(existingRequestsQuery);
        
        // Filter out orphaned "Approved" requests (where student was deleted but requests remain)
        const validExistingRequests = [];
        const orphanedApprovedRequests = [];
        
        for (const requestDoc of existingRequestsSnapshot.docs) {
          const requestData = requestDoc.data();
          
          if (requestData.status === 'Pending') {
            // Pending requests are always valid
            validExistingRequests.push(requestDoc);
          } else if (requestData.status === 'Approved') {
            // For approved requests, verify the student still exists
            const approvedStudentQuery = query(
              collection(firestore, 'students'),
              where('email', '==', requestData.student.email)
            );
            const approvedStudentSnapshot = await getDocs(approvedStudentQuery);
            
            if (!approvedStudentSnapshot.empty) {
              // Student exists - this should have been caught by the first check
              // This is a fallback safety check
              validExistingRequests.push(requestDoc);
            } else {
              // Student was deleted but enrollment request remains - orphaned data
              orphanedApprovedRequests.push(requestDoc);
            }
          }
        }
        
        // Clean up orphaned approved requests automatically
        if (orphanedApprovedRequests.length > 0) {
          console.log(`Found ${orphanedApprovedRequests.length} orphaned approved enrollment requests for ${formData.studentEmail}. Cleaning up...`);
          
          const cleanupPromises = orphanedApprovedRequests.map(async (requestDoc) => {
            try {
              await updateDoc(doc(firestore, 'enrollmentRequests', requestDoc.id), {
                status: 'Cancelled',
                adminNotes: 'Automatically cancelled - student record was deleted',
                updatedAt: Timestamp.now(),
              });
            } catch (error) {
              console.error(`Failed to cleanup orphaned request ${requestDoc.id}:`, error);
            }
          });
          
          await Promise.all(cleanupPromises);
          
          const orphanedClassNames = orphanedApprovedRequests.map(doc => doc.data().className).join(', ');
          console.log(`Cleaned up orphaned enrollment requests for classes: ${orphanedClassNames}`);
        }
        
        // Get the class IDs that have valid existing requests
        const existingClassIds = validExistingRequests.map(doc => doc.data().classId);
        
        // Filter out classes that already have valid enrollment requests
        const newClassesToEnroll = selectedClasses.filter(cls => !existingClassIds.includes(cls.id));
        const duplicateClasses = selectedClasses.filter(cls => existingClassIds.includes(cls.id));
        
        // Warn about duplicate requests (only for valid existing requests)
        if (duplicateClasses.length > 0) {
          const duplicateNames = duplicateClasses.map(cls => cls.name).join(', ');
          alert(`Note: You already have pending/approved enrollment requests for: ${duplicateNames}. Only new class requests will be submitted.`);
        }
        
        // Show info about cleaned up orphaned requests
        if (orphanedApprovedRequests.length > 0) {
          const orphanedClassNames = orphanedApprovedRequests.map(doc => doc.data().className).join(', ');
          alert(`Info: Found and cleaned up previous enrollment data for: ${orphanedClassNames}. You can now apply for these classes again.`);
        }
        
        // If no new classes to enroll, stop here
        if (newClassesToEnroll.length === 0) {
          alert('All selected classes already have pending or approved enrollment requests for this email.');
          return;
        }
        
        // Create enrollment requests for each new selected class
        const enrollmentPromises = newClassesToEnroll.map(async (selectedClass) => {
          // Sanitize names before submission to ensure clean data
          const sanitizedFirstName = sanitizeName(formData.studentFirstName);
          const sanitizedLastName = sanitizeName(formData.studentLastName);
          const sanitizedParentName = sanitizeName(formData.parentName);
          
          const enrollmentData: EnrollmentRequestData = {
            student: {
              name: `${sanitizedFirstName} ${sanitizedLastName}`,
              email: formData.studentEmail,
              phone: formatAustralianPhone(formData.studentPhone),
              dateOfBirth: formData.dateOfBirth,
              year: selectedClass.year, // Use the class's year level
              school: formData.school,
            },
            parent: {
              name: sanitizedParentName,
              email: formData.parentEmail,
              phone: formatAustralianPhone(formData.parentPhone),
              relationship: formData.relationship,
            },
            classId: selectedClass.id,
            className: selectedClass.name,
            subject: selectedClass.subject,
            centerName: getCenterDisplayName(selectedClass.centerId),
            sessionFee: selectedClass.sessionFee,
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
        studentFirstName: '',
        studentLastName: '',
        studentEmail: '',
        confirmStudentEmail: '',
        studentPhone: '',
        dateOfBirth: '',
        school: '',
        parentName: '',
        parentEmail: '',
        confirmParentEmail: '',
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
                    label="First Name"
                    value={formData.studentFirstName}
                    onChange={(e) => handleInputChange('studentFirstName', e.target.value)}
                    placeholder="e.g., John"
                    helperText="Letters only (no emojis or special characters)"
                    error={nameErrors.studentFirstName}
                    required
                  />
                  <Input
                    label="Last Name"
                    value={formData.studentLastName}
                    onChange={(e) => handleInputChange('studentLastName', e.target.value)}
                    placeholder="e.g., Smith"
                    helperText="Letters only (no emojis or special characters)"
                    error={nameErrors.studentLastName}
                    required
                  />
                  <Input
                    label="Student Email"
                    type="email"
                    value={formData.studentEmail}
                    onChange={(e) => handleInputChange('studentEmail', e.target.value)}
                    required
                  />
                  <Input
                    label="Confirm Student Email"
                    type="email"
                    value={formData.confirmStudentEmail}
                    onChange={(e) => handleInputChange('confirmStudentEmail', e.target.value)}
                    required
                  />
                  <Input
                    label="Mobile Phone"
                    value={formData.studentPhone}
                    onChange={(e) => handleInputChange('studentPhone', e.target.value)}
                    placeholder="e.g., 0412 345 678"
                    helperText="Australian mobile number (10 digits starting with 04)"
                    error={phoneErrors.studentPhone}
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
                    placeholder="e.g., Sarah Smith"
                    helperText="Full name - letters only (no emojis or special characters)"
                    error={nameErrors.parentName}
                    required
                    className="md:col-span-2"
                  />
                  <Input
                    label="Parent/Guardian Email"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                    required
                  />
                  <Input
                    label="Confirm Parent/Guardian Email"
                    type="email"
                    value={formData.confirmParentEmail}
                    onChange={(e) => handleInputChange('confirmParentEmail', e.target.value)}
                    required
                  />
                  <Input
                    label="Mobile Phone"
                    value={formData.parentPhone}
                    onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                    placeholder="e.g., 0412 345 678"
                    helperText="Australian mobile number (10 digits starting with 04)"
                    error={phoneErrors.parentPhone}
                    required
                  />
                  <Select
                    label="Relationship to Student"
                    value={formData.relationship}
                    onChange={(e) => handleInputChange('relationship', e.target.value as any)}
                    options={RELATIONSHIP_OPTIONS}
                    required
                    className="md:col-span-2"
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
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'subject' | 'year' | 'fee' | 'location')}
                    options={[
                      { value: 'name', label: 'Class Name' },
                      { value: 'subject', label: 'Subject' },
                      { value: 'year', label: 'Year Level' },
                      { value: 'fee', label: 'Session Fee' },
                      { value: 'location', label: 'Location' },
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
                                {getCenterDisplayName(cls.centerId)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                {formatSchedule(cls.schedule)}
                              </div>
                              <div className="flex items-center">
                                <Users className="w-4 h-4 mr-2" />
                                {teacherNames[(cls as any).teacherId] ?? (cls as any).teacherId ?? 'Teacher'}
                                <span className="ml-3 text-gray-700 font-medium">${cls.sessionFee}/session</span>
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
                              ${cls.sessionFee}/session
                            </span>
                          </div>
                        ) : null;
                      })}
                      <div className="border-t border-green-300 pt-2 mt-2">
                        <div className="flex items-center justify-between font-semibold text-green-800">
                          <span>Total Session Fee:</span>
                          <span>
                            ${formData.selectedClassIds.reduce((total, classId) => {
                              const cls = classes.find(c => c.id === classId);
                              return total + (cls?.sessionFee || 0);
                            }, 0)}/session
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
