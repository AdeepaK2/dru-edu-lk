'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, KeyRound } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Input from '@/components/ui/form/Input';
import Button from '@/components/ui/Button';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore, auth } from '@/utils/firebase-client';

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
}

export default function StudentSettingsPage() {
  const { student, loading: authLoading, refreshStudent } = useStudentAuth();

  // Loading states
  const [loading, setLoading] = useState<LoadingState>({
    profile: false,
    password: false
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
      // Refresh student data
      await refreshStudent();
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

    setLoading(prev => ({ ...prev, password: true }));

    try {
      // Re-authenticate the user before changing password
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email!,
        passwordData.currentPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, passwordData.newPassword);
      
      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      alert('Password updated successfully!');
    } catch (error) {
      console.error('Error updating password:', error);
      
      // Handle specific errors
      if ((error as any).code === 'auth/wrong-password') {
        alert('Current password is incorrect. Please try again.');
      } else {
        alert('Failed to update password. Please try again.');
      }
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-t-2 border-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-red-600 dark:text-red-400">
          You need to be logged in to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Account Settings
        </h1>
      </div>

      {/* Profile Settings */}
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
            <div className="space-y-6">
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
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Password Requirements</h3>
              <ul className="space-y-2">
                <li className="flex items-center text-sm">
                  <span className={`w-5 h-5 mr-2 flex items-center justify-center rounded-full ${
                    passwordValidation.minLength ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}>
                    {passwordValidation.minLength ? '✓' : '·'}
                  </span>
                  At least 8 characters
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-5 h-5 mr-2 flex items-center justify-center rounded-full ${
                    passwordValidation.hasUppercase ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}>
                    {passwordValidation.hasUppercase ? '✓' : '·'}
                  </span>
                  At least 1 uppercase letter
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-5 h-5 mr-2 flex items-center justify-center rounded-full ${
                    passwordValidation.hasLowercase ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}>
                    {passwordValidation.hasLowercase ? '✓' : '·'}
                  </span>
                  At least 1 lowercase letter
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-5 h-5 mr-2 flex items-center justify-center rounded-full ${
                    passwordValidation.hasNumber ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}>
                    {passwordValidation.hasNumber ? '✓' : '·'}
                  </span>
                  At least 1 number
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-5 h-5 mr-2 flex items-center justify-center rounded-full ${
                    passwordValidation.hasSpecialChar ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}>
                    {passwordValidation.hasSpecialChar ? '✓' : '·'}
                  </span>
                  At least 1 special character
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-5 h-5 mr-2 flex items-center justify-center rounded-full ${
                    passwordValidation.match ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}>
                    {passwordValidation.match ? '✓' : '·'}
                  </span>
                  Passwords match
                </li>
              </ul>
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
    </div>
  );
}
