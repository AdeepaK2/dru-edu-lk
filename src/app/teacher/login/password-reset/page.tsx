'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';
import { GraduationCap, Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';

export default function TeacherPasswordReset() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (error: any) {
      console.error('Password reset error:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many reset attempts. Please try again later.');
          break;
        default:
          setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Check Your Email</h1>
            <p className="text-gray-600 dark:text-gray-300">We've sent password reset instructions to your email address.</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="text-center space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-2 text-blue-700 dark:text-blue-300">
                  <Mail className="w-5 h-5" />
                  <span className="font-medium">Reset email sent successfully!</span>
                </div>
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                  Please check your inbox and follow the instructions to reset your password.
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Email sent to:</strong> {email}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Don't see the email? Check your spam folder or wait a few minutes.
              </p>
              <div className="space-y-3 pt-4">
                <Button onClick={() => router.push('/teacher/login')} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
                <Button onClick={() => { setSuccess(false); setEmail(''); }} variant="outline" className="w-full">
                  Send Another Reset Email
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reset Password</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Enter your email address and we'll send you instructions to reset your password.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handlePasswordReset} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  disabled={loading}
                  className="w-full pl-10"
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <Button type="submit" disabled={loading || !email} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Reset Email...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Reset Email
                </>
              )}
            </Button>

            <Button type="button" onClick={() => router.push('/teacher/login')} variant="outline" className="w-full" disabled={loading}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Still having trouble?</p>
            <p className="text-sm text-blue-600 dark:text-blue-400">Contact administration for assistance</p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Dr U Education Teacher Portal - Password Reset</p>
        </div>
      </div>
    </div>
  );
}
