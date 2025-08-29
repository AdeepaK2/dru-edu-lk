'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, KeyRound, Shield, FileCheck, Upload, Check, X, AlertCircle, Download } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Input from '@/components/ui/form/Input';
import Button from '@/components/ui/Button';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore, auth } from '@/utils/firebase-client';
import { DocumentInfo, DocumentType } from '@/models/studentSchema';
import { StudentDocumentService } from '@/apiservices/studentDocumentService';
import DocumentUploadGrid from '@/components/student/DocumentUploadGrid';

interface StudentProfileData {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  match: boolean;
}

interface LoadingState {
  profile: boolean;
  password: boolean;
  document: boolean;
}

interface DocumentUploadState {
  [DocumentType.CLASS_POLICY]?: File | null;
  [DocumentType.PARENT_NOTICE]?: File | null;
  [DocumentType.PHOTO_CONSENT]?: File | null;
}

interface DocumentStates {
  classPolicy: { status: string; document?: DocumentInfo };
  parentNotice: { status: string; document?: DocumentInfo };
  photoConsent: { status: string; document?: DocumentInfo };
}

export default function StudentSettingsPage() {
  const { student, loading: authLoading, refreshStudent } = useStudentAuth();

  // Loading states
  const [loading, setLoading] = useState<LoadingState>({
    profile: false,
    password: false,
    document: false
  });

  // Profile form state
  const [profileData, setProfileData] = useState<StudentProfileData>({
    name: '',
    email: '',
    phone: '',
    countryCode: '+61'
  });

  // Password form state
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Document upload state
  const [documentUpload, setDocumentUpload] = useState<DocumentUploadState>({
    [DocumentType.CLASS_POLICY]: null,
    [DocumentType.PARENT_NOTICE]: null,
    [DocumentType.PHOTO_CONSENT]: null,
  });

  // Document states (from Firestore)
  const [documentStates, setDocumentStates] = useState<DocumentStates>({
    classPolicy: { status: 'Not Submitted' },
    parentNotice: { status: 'Not Submitted' },
    photoConsent: { status: 'Not Submitted' },
  });
  
  // File input refs - not needed for unified upload
  // const fileInputRefs = {
  //   [DocumentType.CLASS_POLICY]: useRef<HTMLInputElement>(null),
  //   [DocumentType.PARENT_NOTICE]: useRef<HTMLInputElement>(null),
  //   [DocumentType.PHOTO_CONSENT]: useRef<HTMLInputElement>(null),
  // };

  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    match: false
  });

  // Initialize profile data when student data is available
  useEffect(() => {
    if (student) {
      setProfileData({
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        countryCode: '+61' // Default to Australia
      });

      // Load document states
      loadDocumentStates();
    }
  }, [student]);

  // Load document states from student data
  const loadDocumentStates = () => {
    if (!student || !student.documents) {
      setDocumentStates({
        classPolicy: { status: 'Not Submitted' },
        parentNotice: { status: 'Not Submitted' },
        photoConsent: { status: 'Not Submitted' },
      });
      return;
    }

    const classPolicyDoc = student.documents.find(doc => doc.type === DocumentType.CLASS_POLICY);
    const parentNoticeDoc = student.documents.find(doc => doc.type === DocumentType.PARENT_NOTICE);
    const photoConsentDoc = student.documents.find(doc => doc.type === DocumentType.PHOTO_CONSENT);

    setDocumentStates({
      classPolicy: {
        status: classPolicyDoc?.status || 'Not Submitted',
        document: classPolicyDoc
      },
      parentNotice: {
        status: parentNoticeDoc?.status || 'Not Submitted',
        document: parentNoticeDoc
      },
      photoConsent: {
        status: photoConsentDoc?.status || 'Not Submitted',
        document: photoConsentDoc
      }
    });
  };

  const handleProfileInputChange = (field: keyof StudentProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordInputChange = (field: keyof PasswordData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate password in real-time
    if (field === 'newPassword' || field === 'confirmPassword') {
      const newPassword = field === 'newPassword' ? value : passwordData.newPassword;
      const confirmPassword = field === 'confirmPassword' ? value : passwordData.confirmPassword;
      
      setPasswordValidation({
        minLength: newPassword.length >= 8,
        hasUppercase: /[A-Z]/.test(newPassword),
        hasLowercase: /[a-z]/.test(newPassword),
        hasNumber: /\d/.test(newPassword),
        hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
        match: newPassword === confirmPassword && newPassword.length > 0
      });
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setLoading(prev => ({ ...prev, profile: true }));

    try {
      // Update student profile in Firestore (excluding email)
      const studentRef = doc(firestore, 'students', student.id);
      await updateDoc(studentRef, {
        name: profileData.name,
        phone: `${profileData.countryCode}${profileData.phone}`
      });
      
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // Validate all password requirements
    const isValid = Object.entries(passwordValidation).every(([key, value]) => value);
    if (!isValid) {
      alert('Please ensure all password requirements are met.');
      return;
    }

    setLoading(prev => ({ ...prev, password: true }));

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email!,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update password
      await updatePassword(auth.currentUser, passwordData.newPassword);

      // Reset form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordValidation({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecialChar: false,
        match: false
      });

      alert('Password updated successfully!');
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        alert('Current password is incorrect.');
      } else {
        alert('Failed to update password. Please try again.');
      }
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  // Handle document file selection
  const handleFileChange = (documentType: DocumentType, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentUpload(prev => ({
        ...prev,
        [documentType]: e.target.files![0]
      }));
    }
  };

  // Handle unified document upload (all 3 documents at once)
  const handleUnifiedDocumentUpload = async () => {
    if (!student) return;
    
    // Check if all 3 documents are selected
    const hasAllFiles = documentUpload[DocumentType.CLASS_POLICY] && 
                       documentUpload[DocumentType.PARENT_NOTICE] && 
                       documentUpload[DocumentType.PHOTO_CONSENT];
    
    if (!hasAllFiles) {
      alert('Please select all 3 required documents before uploading.');
      return;
    }

    setLoading(prev => ({ ...prev, document: true }));
    
    try {
      // Upload all documents
      const uploadPromises = [
        StudentDocumentService.uploadDocument(student.id, documentUpload[DocumentType.CLASS_POLICY]!, DocumentType.CLASS_POLICY),
        StudentDocumentService.uploadDocument(student.id, documentUpload[DocumentType.PARENT_NOTICE]!, DocumentType.PARENT_NOTICE),
        StudentDocumentService.uploadDocument(student.id, documentUpload[DocumentType.PHOTO_CONSENT]!, DocumentType.PHOTO_CONSENT),
      ];
      
      const uploadedDocuments = await Promise.all(uploadPromises);
      
      // Clear the selected files
      setDocumentUpload({
        [DocumentType.CLASS_POLICY]: null,
        [DocumentType.PARENT_NOTICE]: null,
        [DocumentType.PHOTO_CONSENT]: null,
      });
      
      // Update local document states
      setDocumentStates({
        classPolicy: { status: 'Pending', document: uploadedDocuments[0] },
        parentNotice: { status: 'Pending', document: uploadedDocuments[1] },
        photoConsent: { status: 'Pending', document: uploadedDocuments[2] }
      });
      
      // Update student object if it exists
      if (student.documents) {
        uploadedDocuments.forEach(uploadedDoc => {
          const existingIndex = student.documents!.findIndex(doc => doc.type === uploadedDoc.type);
          if (existingIndex >= 0) {
            student.documents![existingIndex] = uploadedDoc;
          } else {
            student.documents!.push(uploadedDoc);
          }
        });
      } else {
        student.documents = uploadedDocuments;
      }

      // Refresh student data from database to ensure sync
      await refreshStudent();
      
      // Reload document states to reflect the updated data
      setTimeout(() => loadDocumentStates(), 500); // Small delay to ensure data is updated
      
      alert('All documents uploaded successfully! Status: Pending verification.');
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Failed to upload documents. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, document: false }));
    }
  };

  // Handle individual document re-upload (for rejected documents)
  const handleIndividualDocumentUpload = async (documentType: DocumentType, file: File) => {
    if (!student) return;
    
    setLoading(prev => ({ ...prev, document: true }));
    
    try {
      const uploadedDocument = await StudentDocumentService.uploadDocument(student.id, file, documentType);
      
      // Update local document state
      const stateKey = documentType === DocumentType.CLASS_POLICY ? 'classPolicy' :
                      documentType === DocumentType.PARENT_NOTICE ? 'parentNotice' : 'photoConsent';
      
      setDocumentStates(prev => ({
        ...prev,
        [stateKey]: { status: 'Pending', document: uploadedDocument }
      }));
      
      // Update student object
      if (student.documents) {
        const existingIndex = student.documents.findIndex(doc => doc.type === documentType);
        if (existingIndex >= 0) {
          student.documents[existingIndex] = uploadedDocument;
        } else {
          student.documents.push(uploadedDocument);
        }
      } else {
        student.documents = [uploadedDocument];
      }

      // Refresh student data from database to ensure sync
      await refreshStudent();
      
      // Reload document states to reflect the updated data
      setTimeout(() => loadDocumentStates(), 500); // Small delay to ensure data is updated
      
      alert(`${documentType} re-uploaded successfully! Status: Pending verification.`);
    } catch (error) {
      console.error(`Error re-uploading ${documentType}:`, error);
      alert(`Failed to re-upload ${documentType}. Please try again.`);
    } finally {
      setLoading(prev => ({ ...prev, document: false }));
    }
  };

  // Download document
  const handleDownloadDocument = (documentInfo: DocumentInfo) => {
    if (documentInfo.url) {
      window.open(documentInfo.url, '_blank');
    }
  };

  // Get document status with proper color and icon
  const getDocumentStatusDisplay = (docState: { status: string; document?: DocumentInfo }) => {
    switch (docState.status) {
      case 'Verified':
        return { 
          status: 'Verified', 
          icon: <Check className="w-5 h-5 text-green-500" />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20'
        };
      case 'Rejected':
        return { 
          status: 'Rejected', 
          icon: <X className="w-5 h-5 text-red-500" />,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20'
        };
      case 'Pending':
        return { 
          status: 'Pending Verification', 
          icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
        };
      default:
        return { 
          status: 'Not Submitted', 
          icon: <X className="w-5 h-5 text-gray-500" />,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20'
        };
    }
  };

  // Check if all documents are verified
  const allDocumentsVerified = () => {
    return documentStates.classPolicy.status === 'Verified' &&
           documentStates.parentNotice.status === 'Verified' &&
           documentStates.photoConsent.status === 'Verified';
  };

  // Check if any documents can be re-uploaded (rejected status)
  const hasRejectedDocuments = () => {
    return documentStates.classPolicy.status === 'Rejected' ||
           documentStates.parentNotice.status === 'Rejected' ||
           documentStates.photoConsent.status === 'Rejected';
  };

  // Check if no documents have been submitted yet
  const noDocumentsSubmitted = () => {
    return documentStates.classPolicy.status === 'Not Submitted' &&
           documentStates.parentNotice.status === 'Not Submitted' &&
           documentStates.photoConsent.status === 'Not Submitted';
  };

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-green-600 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
            <p className="text-gray-600 dark:text-gray-300">Manage your profile and security settings</p>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <User className="w-5 h-5 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile Information</h2>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Full Name *
                </label>
                <Input
                  type="text"
                  value={profileData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  disabled={loading.profile}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address (Read Only)
                </label>
                <Input
                  type="email"
                  value={profileData.email}
                  placeholder="Email address cannot be changed"
                  disabled={true}
                  readOnly={true}
                  className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number *
                </label>
                <div className="flex space-x-2">
                  <select
                    value={profileData.countryCode}
                    onChange={(e) => handleProfileInputChange('countryCode', e.target.value)}
                    disabled={loading.profile}
                    className="border rounded-lg px-3 py-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+81">🇯🇵 +81</option>
                    <option value="+86">🇨🇳 +86</option>
                  </select>
                  <Input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                    disabled={loading.profile}
                    className="flex-1"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Account Info Display */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Account Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Status:</span>
                    <span className={`font-medium ${
                      student.status === 'Active' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {student.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Enrolled Since:</span>
                    <span className="text-gray-900 dark:text-white">
                      {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading.profile}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {loading.profile ? 'Updating...' : 'Update Profile'}
            </Button>
          </div>
        </form>
      </div>

      {/* Password Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <KeyRound className="w-5 h-5 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Change Password</h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - Password Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('currentPassword', e.target.value)}
                  placeholder="Enter your current password"
                  disabled={loading.password}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('newPassword', e.target.value)}
                  placeholder="Enter your new password"
                  disabled={loading.password}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your new password"
                  disabled={loading.password}
                  required
                />
              </div>
            </div>

            {/* Right Column - Password Requirements */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Password Requirements</h4>
              <div className="space-y-2 text-sm">
                <div className={`flex items-center space-x-2 ${passwordValidation.minLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${passwordValidation.minLength ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${passwordValidation.hasUppercase ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>One uppercase letter</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${passwordValidation.hasLowercase ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>One lowercase letter</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${passwordValidation.hasNumber ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>One number</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${passwordValidation.hasSpecialChar ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>One special character</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.match ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${passwordValidation.match ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>Passwords match</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading.password || !Object.values(passwordValidation).every(v => v)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {loading.password ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>
      
      {/* Required Documents */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <FileCheck className="w-5 h-5 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Required Documents</h2>
        </div>
        
        <div className="space-y-6">
          <p className="text-gray-600 dark:text-gray-300">
            All 3 documents are required for enrollment. Once verified by admin, you will be able to download them.
          </p>

          {/* Document Upload Grid */}
          <DocumentUploadGrid
            documents={student?.documents || []}
            onUpload={async (files) => {
              const validFiles = Object.entries(files).filter(([_, file]) => file !== null && file !== undefined) as [DocumentType, File][];
              if (validFiles.length === 0) {
                alert('Please select at least one document to upload.');
                return;
              }

              setLoading(prev => ({ ...prev, document: true }));
              try {
                const uploadedDocuments = await Promise.all(
                  validFiles.map(([type, file]) => 
                    StudentDocumentService.uploadDocument(student!.id, file, type)
                  )
                );

                // Update student documents
                if (student!.documents) {
                  uploadedDocuments.forEach(uploadedDoc => {
                    const existingIndex = student!.documents!.findIndex(doc => doc.type === uploadedDoc.type);
                    if (existingIndex >= 0) {
                      student!.documents![existingIndex] = uploadedDoc;
                    } else {
                      student!.documents!.push(uploadedDoc);
                    }
                  });
                } else {
                  student!.documents = uploadedDocuments;
                }

                await refreshStudent();
                setTimeout(() => loadDocumentStates(), 500);
                
                alert(`${validFiles.length} document(s) uploaded successfully! Status: Pending verification.`);
              } catch (error) {
                console.error('Error uploading documents:', error);
                alert('Failed to upload documents. Please try again.');
                throw error;
              } finally {
                setLoading(prev => ({ ...prev, document: false }));
              }
            }}
            onReupload={async (documentType, file) => {
              await handleIndividualDocumentUpload(documentType, file);
            }}
            onDownload={(document) => {
              handleDownloadDocument(document);
            }}
            loading={loading.document}
            disabled={loading.document}
          />

          {/* Success Message */}
          {allDocumentsVerified() && (
            <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-100 dark:border-green-800">
              <div className="flex items-start">
                <Check className="w-5 h-5 text-green-500 dark:text-green-400 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">Documents Verified</h4>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    All your required documents have been verified and approved by our admin team. You can download them using the download buttons above.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Important Information */}
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400 mr-3 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Important Information</h4>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  These documents are required for your enrollment. Please upload clear, legible copies in PDF, DOC, or image format. 
                  Our admin team will verify your documents within 1-2 business days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
