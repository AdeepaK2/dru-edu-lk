'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  User, 
  Lock, 
  Save, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  BookOpen,
  Edit2,
  Camera,
  Upload,
  X
} from 'lucide-react';
import { Button, Input, TextArea } from '@/components/ui';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { auth } from '@/utils/firebase-client';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import TeacherImageService from '@/apiservices/teacherImageService';

interface TeacherProfileData {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  subjects: string[];
  qualifications: string;
  bio: string;
  address: string;
  profileImageUrl?: string;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function TeacherSettings() {
  const { teacher, loading: authLoading, error: authError } = useTeacherAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Profile form state
  const [profileData, setProfileData] = useState<TeacherProfileData>({
    name: '',
    email: '',
    phone: '',
    countryCode: '+61',
    subjects: [],
    qualifications: '',
    bio: '',
    address: '',
    profileImageUrl: ''
  });

  // Profile image state
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  // Password form state
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Initialize profile data when teacher data is available
  useEffect(() => {
    if (teacher) {
      setProfileData({
        name: teacher.name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        countryCode: teacher.countryCode || '+61',
        subjects: teacher.subjects || [],
        qualifications: teacher.qualifications || '',
        bio: teacher.bio || '',
        address: teacher.address || '',
        profileImageUrl: teacher.profileImageUrl || ''
      });
    }
  }, [teacher]);

  const handleProfileInputChange = (field: keyof TeacherProfileData, value: string | string[]) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
    setMessage(null);
  };

  const handlePasswordInputChange = (field: keyof PasswordChangeData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
    setMessage(null);
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateProfileForm = (): string | null => {
    if (!profileData.name.trim()) {
      return 'Name is required';
    }
    if (!profileData.email.trim()) {
      return 'Email is required';
    }
    if (!profileData.email.includes('@')) {
      return 'Please enter a valid email address';
    }
    if (!profileData.phone.trim()) {
      return 'Phone number is required';
    }
    if (profileData.subjects.length === 0) {
      return 'At least one subject is required';
    }
    return null;
  };

  const validatePasswordForm = (): string | null => {
    if (!passwordData.currentPassword) {
      return 'Current password is required';
    }
    if (!passwordData.newPassword) {
      return 'New password is required';
    }
    if (passwordData.newPassword.length < 6) {
      return 'New password must be at least 6 characters long';
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return 'New passwords do not match';
    }
    if (passwordData.currentPassword === passwordData.newPassword) {
      return 'New password must be different from current password';
    }
    return null;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateProfileForm();
    if (validation) {
      setMessage({ type: 'error', text: validation });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let finalProfileData = { ...profileData };

      // Upload profile image if a new one is selected
      if (profileImageFile) {
        setImageUploading(true);
        setImageUploadProgress(0);
        
        try {
          // Delete old profile image if it exists
          if (profileData.profileImageUrl) {
            await TeacherImageService.deleteProfileImage(profileData.profileImageUrl);
          }
          
          // Upload new profile image
          const imageUrl = await TeacherImageService.uploadProfileImage(
            profileImageFile,
            teacher!.id,
            (progress) => setImageUploadProgress(progress)
          );
          
          finalProfileData.profileImageUrl = imageUrl;
          
          // Clear the file and preview after successful upload
          setProfileImageFile(null);
          if (profileImagePreview) {
            TeacherImageService.revokeImagePreview(profileImagePreview);
            setProfileImagePreview(null);
          }
        } catch (imageError: any) {
          setMessage({ type: 'error', text: `Image upload failed: ${imageError.message}` });
          return;
        } finally {
          setImageUploading(false);
          setImageUploadProgress(0);
        }
      }

      // Update teacher profile
      const response = await fetch(`/api/teacher?id=${teacher?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalProfileData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile');
      }

      // Update local profile data with the new image URL
      setProfileData(finalProfileData);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validatePasswordForm();
    if (validation) {
      setMessage({ type: 'error', text: validation });
      return;
    }

    if (!auth.currentUser) {
      setMessage({ type: 'error', text: 'No authenticated user found' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email!,
        passwordData.currentPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, passwordData.newPassword);
      
      // Clear password form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setMessage({ type: 'success', text: 'Password changed successfully!' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      let errorMessage = 'Failed to change password';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in before changing your password';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const subjects = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    handleProfileInputChange('subjects', subjects);
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate the image file
      const validationError = TeacherImageService.validateImageFile(file);
      if (validationError) {
        setMessage({ type: 'error', text: validationError });
        return;
      }

      // Check authentication before proceeding
      if (!auth.currentUser) {
        setMessage({ type: 'error', text: 'You must be logged in to upload a profile image' });
        return;
      }

      console.log('Current user UID:', auth.currentUser.uid);
      console.log('Teacher ID:', teacher?.id);

      // Clear any previous errors
      setMessage(null);
      
      // Set the file and create preview
      setProfileImageFile(file);
      const previewUrl = TeacherImageService.createImagePreview(file);
      setProfileImagePreview(previewUrl);
    }
  };

  const handleRemoveProfileImage = () => {
    // Revoke the preview URL to free memory
    if (profileImagePreview) {
      TeacherImageService.revokeImagePreview(profileImagePreview);
    }
    
    setProfileImageFile(null);
    setProfileImagePreview(null);
    
    // Also clear the profile image URL from form data
    handleProfileInputChange('profileImageUrl', '');
  };

  if (authLoading || !teacher) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">
              {authLoading ? 'Authenticating...' : 'Loading...'}
            </p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Account Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Manage your profile information and account security
              </p>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`rounded-md p-4 ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
              <div className="ml-3">
                <p className={`text-sm ${
                  message.type === 'success' 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {message.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Profile Information
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'password'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Lock className="w-4 h-4 inline mr-2" />
                Change Password
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' ? (
              /* Profile Tab */
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Profile Image Section */}
                <div className="flex flex-col items-center space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    {/* Current Profile Image or Preview */}
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg">
                      {profileImagePreview ? (
                        <img
                          src={profileImagePreview}
                          alt="Profile Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : profileData.profileImageUrl ? (
                        <img
                          src={profileData.profileImageUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">
                            {teacher?.avatar || teacher?.name?.charAt(0).toUpperCase() || 'T'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Upload Button Overlay */}
                    <label
                      htmlFor="profile-image-upload"
                      className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors"
                    >
                      <Camera className="w-5 h-5 text-white" />
                      <input
                        id="profile-image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        disabled={loading || imageUploading}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Image Upload Progress */}
                  {imageUploading && (
                    <div className="w-full max-w-md">
                      <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                        <Upload className="w-4 h-4 animate-pulse" />
                        <span>Uploading image... {imageUploadProgress}%</span>
                      </div>
                      <div className="mt-2 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${imageUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Remove Image Button */}
                  {(profileImagePreview || profileData.profileImageUrl) && !imageUploading && (
                    <button
                      type="button"
                      onClick={handleRemoveProfileImage}
                      className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                      <span>Remove Image</span>
                    </button>
                  )}

                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {teacher?.name || 'Teacher'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click the camera icon to upload a new profile photo
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      JPG, PNG, GIF up to 10MB
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        disabled={loading}
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Mail className="w-4 h-4 inline mr-2" />
                        Email Address *
                      </label>
                      <Input
                        type="email"
                        value={profileData.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('email', e.target.value)}
                        placeholder="Enter your email address"
                        disabled={loading}
                        required
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
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          disabled={loading}
                        >
                          <option value="+61">+61</option>
                          <option value="+1">+1</option>
                          <option value="+44">+44</option>
                          <option value="+91">+91</option>
                        </select>
                        <Input
                          type="tel"
                          value={profileData.phone}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('phone', e.target.value)}
                          placeholder="Enter your phone number"
                          disabled={loading}
                          className="flex-1"
                          required
                        />
                      </div>
                    </div>

                    {/* Subjects */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <BookOpen className="w-4 h-4 inline mr-2" />
                        Subjects *
                      </label>
                      <Input
                        type="text"
                        value={profileData.subjects.join(', ')}
                        onChange={handleSubjectChange}
                        placeholder="Enter subjects separated by commas"
                        disabled={loading}
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Separate multiple subjects with commas (e.g., Mathematics, Physics, Chemistry)
                      </p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Qualifications */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Edit2 className="w-4 h-4 inline mr-2" />
                        Qualifications
                      </label>
                      <TextArea
                        value={profileData.qualifications}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleProfileInputChange('qualifications', e.target.value)}
                        placeholder="Enter your qualifications and certifications"
                        rows={3}
                        disabled={loading}
                      />
                    </div>

                    {/* Bio */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Biography
                      </label>
                      <TextArea
                        value={profileData.bio}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleProfileInputChange('bio', e.target.value)}
                        placeholder="Tell us about yourself"
                        rows={3}
                        disabled={loading}
                      />
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <MapPin className="w-4 h-4 inline mr-2" />
                        Address
                      </label>
                      <TextArea
                        value={profileData.address}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleProfileInputChange('address', e.target.value)}
                        placeholder="Enter your address"
                        rows={2}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    type="submit"
                    disabled={loading || imageUploading}
                    className="flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {imageUploading 
                        ? `Uploading Image... ${imageUploadProgress}%` 
                        : loading 
                          ? 'Saving...' 
                          : 'Save Changes'
                      }
                    </span>
                  </Button>
                </div>
              </form>
            ) : (
              /* Password Tab */
              <form onSubmit={handleChangePassword} className="space-y-6 max-w-md">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('currentPassword', e.target.value)}
                      placeholder="Enter your current password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('newPassword', e.target.value)}
                      placeholder="Enter your new password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Password must be at least 6 characters long
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('confirmPassword', e.target.value)}
                      placeholder="Confirm your new password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    type="submit"
                    disabled={loading || imageUploading}
                    className="flex items-center space-x-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{loading ? 'Changing...' : 'Change Password'}</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
