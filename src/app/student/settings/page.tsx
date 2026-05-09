'use client';

import { useEffect, useState } from 'react';
import { Mail, Phone, User, KeyRound } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from '@/utils/firebase-client';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Input from '@/components/ui/form/Input';
import Button from '@/components/ui/Button';

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

interface LoadingState {
  profile: boolean;
  password: boolean;
}

export default function StudentSettingsPage() {
  const { student, loading: authLoading, refreshStudent } = useStudentAuth();
  const [loading, setLoading] = useState<LoadingState>({ profile: false, password: false });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileData, setProfileData] = useState<StudentProfileData>({
    name: '',
    email: '',
    phone: '',
    countryCode: '+61'
  });
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    match: false
  });

  useEffect(() => {
    if (message) {
      const timer = window.setTimeout(() => setMessage(null), 5000);
      return () => window.clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (!student) return;

    setProfileData({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      countryCode: '+61'
    });
  }, [student]);

  const handleProfileInputChange = (field: keyof StudentProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordInputChange = (field: keyof PasswordData, value: string) => {
    setPasswordData(prev => {
      const next = { ...prev, [field]: value };

      if (field === 'newPassword' || field === 'confirmPassword') {
        const newPassword = field === 'newPassword' ? value : prev.newPassword;
        const confirmPassword = field === 'confirmPassword' ? value : prev.confirmPassword;

        setPasswordValidation({
          minLength: newPassword.length >= 8,
          hasUppercase: /[A-Z]/.test(newPassword),
          hasLowercase: /[a-z]/.test(newPassword),
          hasNumber: /\d/.test(newPassword),
          hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
          match: newPassword === confirmPassword && newPassword.length > 0
        });
      }

      return next;
    });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const studentRef = doc(firestore, 'students', student.id);
      await updateDoc(studentRef, {
        name: profileData.name,
        phone: `${profileData.countryCode}${profileData.phone}`
      });

      await refreshStudent();
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update your profile. Please try again.' });
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setLoading(prev => ({ ...prev, password: true }));
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email!,
        passwordData.currentPassword
      );

      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordData.newPassword);

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password changed successfully.' });
    } catch (error) {
      console.error('Error updating password:', error);
      const code = (error as any)?.code;
      setMessage({
        type: 'error',
        text: code === 'auth/wrong-password'
          ? 'Your current password is incorrect.'
          : 'Failed to update your password. Please try again.'
      });
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="rounded-2xl border-2 border-black bg-white p-8 shadow-lg">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-gray-700 mx-auto" />
          <p className="mt-4 text-center text-sm font-medium text-gray-700">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <p className="text-red-600">You need to be logged in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border-2 border-black bg-white p-6 shadow-md">
          <h1 className="text-3xl font-black text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Update your profile details and password.</p>
        </div>

        {message && (
          <div className={`rounded-xl border-2 border-black p-4 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="rounded-2xl border-2 border-black bg-white p-6 shadow-md space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <User className="h-5 w-5" /> Profile
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Name</label>
              <Input
                type="text"
                value={profileData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
              <Input type="email" value={profileData.email} readOnly disabled className="bg-gray-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Country Code</label>
              <select
                value={profileData.countryCode}
                onChange={(e) => handleProfileInputChange('countryCode', e.target.value)}
                className="w-full rounded-lg border-2 border-black bg-white px-3 py-2"
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
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Phone</label>
              <Input
                type="tel"
                value={profileData.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('phone', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading.profile} className="rounded-full px-6 py-3 font-bold">
              {loading.profile ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>

        <form onSubmit={handlePasswordSubmit} className="rounded-2xl border-2 border-black bg-white p-6 shadow-md space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <KeyRound className="h-5 w-5" /> Password
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Current Password</label>
              <Input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('currentPassword', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">New Password</label>
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('newPassword', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Confirm Password</label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('confirmPassword', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            Password rules: at least 8 characters, uppercase, lowercase, number, and special character. Match required: {passwordValidation.match ? 'Yes' : 'No'}.
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading.password} className="rounded-full px-6 py-3 font-bold">
              {loading.password ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
