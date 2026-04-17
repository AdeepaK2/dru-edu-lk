'use client';

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputClassName =
    'appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm [-webkit-text-fill-color:#374151] dark:[-webkit-text-fill-color:#ffffff] caret-gray-700 dark:caret-white';
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log('Login attempt started');

    try {
      // Sign in with Firebase Authentication
      console.log('Attempting to sign in with Firebase');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Sign-in successful, user:', userCredential.user.email);
      
      // Get the ID token to check custom claims
      console.log('Getting ID token for admin check');
      const idToken = await userCredential.user.getIdTokenResult();
      console.log('ID token retrieved, admin claim:', idToken.claims.admin);
      
      // Verify this is an admin user
      if (!idToken.claims.admin) {
        console.log('User does not have admin privileges');
        await auth.signOut();
        setError('Access denied. You do not have admin privileges.');
        setLoading(false);
        return;
      }        // Redirect to admin dashboard on successful login
      console.log('Admin verified, redirecting to dashboard');
      try {
        // Use window.location for a hard redirect to break any circular redirects
        window.location.href = '/admin/';
        console.log('Navigation initiated');
      } catch (navError) {
        console.error('Navigation error:', navError);
        // Fall back to router if location change fails
        router.push('/admin/');
      }
    } catch (error: any) {
      // Handle errors
      console.error('Login error:', error);
      let errorMessage = 'Failed to log in';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else {
        // Log specific error for debugging
        errorMessage = `Error: ${error.message || error.code || 'Unknown error'}`;
      }
      setError(errorMessage);
    } finally {
      console.log('Login process completed');
      setLoading(false);
    }
  };  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 rounded-full bg-gradient-to-b from-blue-600 to-blue-700 flex items-center justify-center text-white mb-4">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
          </div>
          <h2 className="text-center text-3xl font-bold text-gray-800 dark:text-white">Admin Login</h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
            Sign in to access the admin dashboard
          </p>
        </div>
        
        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 rounded-md">
            <p className="font-medium">{error}</p>
          </div>
        )}
          <form className="space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="username email"
                required
                className={inputClassName}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`${inputClassName} pr-12`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors"
              />
              <label htmlFor="remember-me" className="ml-3 block text-sm font-medium text-gray-600 dark:text-gray-300">
                Remember me
              </label>
            </div>
            <div className="text-sm">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors">
                Need help?
              </a>
            </div>
          </div>          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
