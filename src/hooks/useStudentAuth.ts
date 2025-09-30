import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { auth, firestore } from '@/utils/firebase-client';
import { StudentDocument } from '@/models/studentSchema';
import { getStudentFromCache, setStudentCache, clearStudentCache } from './useStudentAuthContext';

interface AuthState {
  user: User | null;
  student: StudentDocument | null;
  loading: boolean;
  error: string | null;
}

export const useStudentAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    student: null,
    loading: true,
    error: null,
  });

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setAuthState(prev => ({ ...prev, loading: true, error: null }));

        if (user) {
          // Check custom claims for student role
          const idTokenResult = await user.getIdTokenResult();
          const isStudent = idTokenResult.claims.student || idTokenResult.claims.role === 'student';
          
          if (!isStudent) {
            // User exists but not a valid student
            await signOut(auth);
            setAuthState({
              user: null,
              student: null,
              loading: false,
              error: 'Access denied. User is not a student.',
            });
            return;
          }

          // Try to get student data from cache first
          const cachedStudent = getStudentFromCache();
          if (cachedStudent && cachedStudent.uid === user.uid) {
            setAuthState({
              user,
              student: cachedStudent,
              loading: false,
              error: null,
            });
            
            // Store token in localStorage
            const idToken = await user.getIdToken();
            localStorage.setItem('authToken', idToken);
            return;
          }

          // Fetch student data from Firestore if not cached
          try {
            const studentsQuery = query(
              collection(firestore, 'students'),
              where('uid', '==', user.uid)
            );
            
            const studentsSnapshot = await getDocs(studentsQuery);
            
            if (studentsSnapshot.empty) {
              setAuthState({
                user: null,
                student: null,
                loading: false,
                error: 'Student record not found',
              });
              return;
            }

            const studentDoc = studentsSnapshot.docs[0];
            const studentData = {
              id: studentDoc.id,
              ...studentDoc.data(),
              uid: user.uid
            } as StudentDocument;

            // Cache the student data
            setStudentCache(studentData);

            setAuthState({
              user,
              student: studentData,
              loading: false,
              error: null,
            });
            
            // Store token in localStorage for API calls (if needed for other services)
            const idToken = await user.getIdToken();
            localStorage.setItem('authToken', idToken);

            // Check for expired attempts when student logs in
            try {
              const response = await fetch('/api/background/student-submissions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ studentId: studentData.id })
              });

              if (response.ok) {
                console.log('✅ Checked for expired attempts on login');
              } else {
                console.warn('⚠️ Background submission check returned error:', response.status);
              }
            } catch (bgError) {
              console.warn('⚠️ Background submission check failed:', bgError);
              // Don't fail the login process if background check fails
            }
          } catch (firestoreError) {
            console.error('Error fetching student data:', firestoreError);
            setAuthState({
              user: null,
              student: null,
              loading: false,
              error: 'Failed to load student data',
            });
          }
        } else {
          // No user logged in
          clearStudentCache();
          setAuthState({
            user: null,
            student: null,
            loading: false,
            error: null,
          });
          // Clear token from localStorage
          localStorage.removeItem('authToken');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setAuthState({
          user: null,
          student: null,
          loading: false,
          error: 'Authentication error occurred',
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      // Use Firebase Auth directly for authentication
      await signInWithEmailAndPassword(auth, email, password);
      
      // Auth state will be updated by the onAuthStateChanged listener
      // which will verify the student status
      return { success: true, message: 'Login successful' };
      
    } catch (error: any) {
      let errorMessage = 'Login failed';
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Account has been disabled';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      // Auth state will be cleared by the onAuthStateChanged listener
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Refresh student data function
  const refreshStudent = useCallback(async () => {
    if (!authState.user) return;

    try {
      const studentsQuery = query(
        collection(firestore, 'students'),
        where('uid', '==', authState.user.uid)
      );
      
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const studentDoc = studentsSnapshot.docs[0];
        const studentData = {
          id: studentDoc.id,
          ...studentDoc.data(),
          uid: authState.user.uid
        } as StudentDocument;

        // Update cache
        setStudentCache(studentData);

        setAuthState(prev => ({
          ...prev,
          student: studentData,
        }));
      }
    } catch (error) {
      console.error('Error refreshing student data:', error);
    }
  }, [authState.user]);

  // Check if user is authenticated student
  const isAuthenticated = !!authState.user && !!authState.student;

  return {
    ...authState,
    isAuthenticated,
    refreshStudent,
    login,
    logout,
  };
};
