import { useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';

const GUEST_EMAIL = 'code47412@gmail.com';
const GUEST_PASSWORD = 'Renu$121';

export const useGuestAuth = () => {
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuestSession, setIsGuestSession] = useState(false);

  // Authenticate with guest account
  const authenticateGuest = useCallback(async () => {
    try {
      console.log('Attempting to authenticate with guest account...');
      
      // Check if user is already authenticated
      if (auth.currentUser) {
        console.log('User already authenticated:', auth.currentUser.email);
        
        // Check if it's the guest account
        if (auth.currentUser.email === GUEST_EMAIL) {
          setIsGuestSession(true);
        }
        
        setAuthLoading(false);
        return;
      }

      // Sign in with the guest account
      await signInWithEmailAndPassword(auth, GUEST_EMAIL, GUEST_PASSWORD);
      console.log('Successfully authenticated with guest account');
      setIsGuestSession(true);
      
    } catch (error) {
      console.error('Error authenticating with guest account:', error);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Clean up guest session
  const cleanupGuestSession = useCallback(async () => {
    if (isGuestSession && auth.currentUser?.email === GUEST_EMAIL) {
      try {
        await signOut(auth);
        console.log('Guest session cleaned up');
        setIsGuestSession(false);
      } catch (error) {
        console.error('Error cleaning up guest session:', error);
      }
    }
  }, [isGuestSession]);

  // Initialize guest authentication
  useEffect(() => {
    authenticateGuest();
  }, [authenticateGuest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isGuestSession && auth.currentUser?.email === GUEST_EMAIL) {
        signOut(auth).catch(console.error);
      }
    };
  }, [isGuestSession]);

  // Listen for route changes and cleanup if navigating to protected routes
  useEffect(() => {
    const handlePopState = () => {
      // Check if we're navigating away from enrollment pages
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/enroll') && isGuestSession) {
        cleanupGuestSession();
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isGuestSession, cleanupGuestSession]);

  return {
    authLoading,
    isGuestSession,
    cleanupGuestSession
  };
};
