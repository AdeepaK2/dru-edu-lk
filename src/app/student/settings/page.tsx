'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, KeyRound, Shield, FileCheck, Upload, Check, X, AlertCircle } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Input from '@/components/ui/form/Input';
import Button from '@/components/ui/Button';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore, auth } from '@/utils/firebase-client';
import { DocumentInfo, DocumentType } from '@/models/studentSchema';
import { StudentDocumentService } from '@/apiservices/studentDocumentService';

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

export default function StudentSettingsPage() {
  const { student, loading: authLoading } = useStudentAuth();

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
  const [documentUpload, setDocumentUpload] = useState<DocumentUploadState>({});
  
  // File input refs
  const fileInputRefs = {
    [DocumentType.CLASS_POLICY]: useRef<HTMLInputElement>(null),
    [DocumentType.PARENT_NOTICE]: useRef<HTMLInputElement>(null),
    [DocumentType.PHOTO_CONSENT]: useRef<HTMLInputElement>(null),
  };

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
    }
  }, [student]);

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

  // Trigger file input click
  const triggerFileInput = (documentType: DocumentType) => {
    fileInputRefs[documentType]?.current?.click();
  };

  // Handle document upload
  const handleDocumentUpload = async (documentType: DocumentType) => {
    if (!student || !documentUpload[documentType]) return;
    
    setLoading(prev => ({ ...prev, document: true }));
    
    try {
      const uploadedDocument = await StudentDocumentService.uploadDocument(
        student.id,
        documentUpload[documentType]!,
        documentType
      );
      
      // Clear the selected file
      setDocumentUpload(prev => ({
        ...prev,
        [documentType]: null
      }));
      
      // Update local student state to show the uploaded document immediately
      if (student.documents) {
        const existingDocIndex = student.documents.findIndex(doc => doc.type === documentType);
        if (existingDocIndex >= 0) {
          // Update existing document
          student.documents[existingDocIndex] = uploadedDocument;
        } else {
          // Add new document
          student.documents.push(uploadedDocument);
        }
      } else {
        // Create documents array
        student.documents = [uploadedDocument];
      }
      
      alert(`${documentType} uploaded successfully! Status: Pending verification.`);
    } catch (error) {
      console.error(`Error uploading ${documentType}:`, error);
      alert(`Failed to upload ${documentType}. Please try again.`);
    } finally {
      setLoading(prev => ({ ...prev, document: false }));
    }
  };

  // Get document status
  const getDocumentStatus = (documentType: DocumentType): { status: string; icon: React.ReactNode } => {
    if (!student || !student.documents) {
      return { 
        status: 'Not Submitted', 
        icon: <X className="w-5 h-5 text-red-500" />
      };
    }
    
    const document = student.documents.find(doc => doc.type === documentType);
    
    if (!document) {
      return { 
        status: 'Not Submitted', 
        icon: <X className="w-5 h-5 text-red-500" />
      };
    }
    
    switch (document.status) {
      case 'Verified':
        return { 
          status: 'Verified', 
          icon: <Check className="w-5 h-5 text-green-500" />
        };
      case 'Rejected':
        return { 
          status: 'Rejected', 
          icon: <AlertCircle className="w-5 h-5 text-red-500" />
        };
      default:
        return { 
          status: 'Pending Verification', 
          icon: <AlertCircle className="w-5 h-5 text-yellow-500" />
        };
    }
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
            Please upload the following required documents. Once submitted, they will be reviewed by our admin team.
          </p>
          
          <div className="grid md:grid-cols-1 gap-6">
            {/* Documents Status Overview */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4">Document Status</h3>
              
              <div className="space-y-4">
                {/* Class Policy Agreement Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{DocumentType.CLASS_POLICY}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {getDocumentStatus(DocumentType.CLASS_POLICY).status}
                    </span>
                    {getDocumentStatus(DocumentType.CLASS_POLICY).icon}
                  </div>
                </div>
                
                {/* Parent/Guardian Notice Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{DocumentType.PARENT_NOTICE}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {getDocumentStatus(DocumentType.PARENT_NOTICE).status}
                    </span>
                    {getDocumentStatus(DocumentType.PARENT_NOTICE).icon}
                  </div>
                </div>
                
                {/* Photo Consent Form Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{DocumentType.PHOTO_CONSENT}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {getDocumentStatus(DocumentType.PHOTO_CONSENT).status}
                    </span>
                    {getDocumentStatus(DocumentType.PHOTO_CONSENT).icon}
                  </div>
                </div>
              </div>
              
              {/* Unified Upload Section */}
              {(getDocumentStatus(DocumentType.CLASS_POLICY).status !== 'Verified' ||
                getDocumentStatus(DocumentType.PARENT_NOTICE).status !== 'Verified' ||
                getDocumentStatus(DocumentType.PHOTO_CONSENT).status !== 'Verified') && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Upload Document</h4>
                  
                  <div className="space-y-4">
                    {/* Document Type Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Document Type *
                      </label>
                      <select
                        value={Object.keys(documentUpload)[0] || ''}
                        onChange={(e) => {
                          const selectedType = e.target.value as DocumentType;
                          if (selectedType) {
                            setDocumentUpload({
                              [selectedType]: null
                            });
                          } else {
                            setDocumentUpload({});
                          }
                        }}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        disabled={loading.document}
                      >
                        <option value="">Select a document type</option>
                        {getDocumentStatus(DocumentType.CLASS_POLICY).status !== 'Verified' && (
                          <option value={DocumentType.CLASS_POLICY}>{DocumentType.CLASS_POLICY}</option>
                        )}
                        {getDocumentStatus(DocumentType.PARENT_NOTICE).status !== 'Verified' && (
                          <option value={DocumentType.PARENT_NOTICE}>{DocumentType.PARENT_NOTICE}</option>
                        )}
                        {getDocumentStatus(DocumentType.PHOTO_CONSENT).status !== 'Verified' && (
                          <option value={DocumentType.PHOTO_CONSENT}>{DocumentType.PHOTO_CONSENT}</option>
                        )}
                      </select>
                    </div>
                    
                    {/* File Upload */}
                    {Object.keys(documentUpload)[0] && (
                      <>
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            id="document-file-input"
                            onChange={(e) => {
                              const docType = Object.keys(documentUpload)[0] as DocumentType;
                              if (e.target.files && e.target.files[0]) {
                                setDocumentUpload({
                                  [docType]: e.target.files[0]
                                });
                              }
                            }}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            disabled={loading.document}
                          />
                          
                          <div className="flex w-full">
                            <label
                              htmlFor="document-file-input"
                              className="cursor-pointer bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-l-lg px-4 py-2 flex items-center justify-center flex-1"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {Object.values(documentUpload)[0] ? 'Change File' : 'Select File'}
                            </label>
                            
                            <Button
                              type="button"
                              onClick={() => {
                                const docType = Object.keys(documentUpload)[0] as DocumentType;
                                const file = Object.values(documentUpload)[0];
                                if (docType && file) {
                                  handleDocumentUpload(docType);
                                }
                              }}
                              disabled={!Object.values(documentUpload)[0] || loading.document}
                              className="bg-green-600 hover:bg-green-700 text-white rounded-r-lg px-4 py-2 flex items-center justify-center"
                            >
                              {loading.document ? 'Uploading...' : 'Upload Document'}
                            </Button>
                          </div>
                        </div>
                        
                        {Object.values(documentUpload)[0] && (
                          <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 flex items-center">
                            <FileCheck className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                              {Object.values(documentUpload)[0]?.name}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
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
