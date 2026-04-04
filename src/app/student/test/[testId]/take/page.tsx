'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  AlertCircle, Clock, Flag, CheckCircle, ChevronLeft, ChevronRight,
  Save, Send, List, EyeOff, Eye, AlertTriangle, ArrowLeft, Maximize,
  X, Plus, Minus, ZoomIn, Calendar
} from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button, Input, TextArea } from '@/components/ui';
import { Test, LiveTest, FlexibleTest, TestQuestion } from '@/models/testSchema';
import { RealtimeAnswer, PdfAttachment } from '@/models/studentSubmissionSchema';
import { PdfUploadComponent } from '@/components/student/PdfUploadComponent';
import { v4 as uuidv4 } from 'uuid';

// Import student layout from other components or use a local version for now
const StudentLayout = ({ children }: { children: React.ReactNode }) => children;

export default function TestTakePage() {
  const router = useRouter();
  const params = useParams();
  const testId = params?.testId as string;
  
  const { student, loading: authLoading } = useStudentAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Test data
  const [test, setTest] = useState<Test | null>(null);
  const [attemptId, setAttemptId] = useState<string>('');
  
  // Question shuffling support
  const [originalQuestions, setOriginalQuestions] = useState<any[]>([]);
  const [displayQuestions, setDisplayQuestions] = useState<any[]>([]);
  const [questionOrderMapping, setQuestionOrderMapping] = useState<any[] | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  
  // Question navigation
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  
  // Student answers
  const [answers, setAnswers] = useState<Record<string, RealtimeAnswer>>({});
  const [savedState, setSavedState] = useState<'saving' | 'saved' | 'error' | null>(null);
  
  // Timer state
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [isResumingAttempt, setIsResumingAttempt] = useState(false);

  // Grace period state - 2 minutes for student to submit after time expires
  const [graceMode, setGraceMode] = useState(false);
  const [graceTimeRemaining, setGraceTimeRemaining] = useState(120); // 2 minutes in seconds
  
  // Connection state
  const [isOnline, setIsOnline] = useState(true); // Default to true for SSR
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineTime, setOfflineTime] = useState(0);
  
  // Navigation panel state
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [showPreSubmitReview, setShowPreSubmitReview] = useState(false); // New pre-submit review
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-click
  
  // PDF upload state
  const [pdfFiles, setPdfFiles] = useState<Record<string, PdfAttachment[]>>({});
  
  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string>('');
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // References for tracking time spent on questions
  const questionStartTimeRef = useRef<number>(Date.now());
  const timeSpentRef = useRef<Record<string, number>>({});
  
  // Confirmation dialog state for submission
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  
  // Get current question - use displayQuestions instead of test.questions
  const currentQuestion = displayQuestions[currentIndex] || null;
  
  // Image viewer functions
  const openImageViewer = (imageUrl: string) => {
    setViewerImageUrl(imageUrl);
    setShowImageViewer(true);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };
  
  const closeImageViewer = () => {
    setShowImageViewer(false);
    setViewerImageUrl('');
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };
  
  const handleImageZoom = (delta: number) => {
    setImageScale(prev => {
      const newScale = Math.max(0.5, Math.min(3, prev + delta));
      return newScale;
    });
  };
  
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (imageScale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y
      });
    }
  };
  
  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageScale > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };
  
  const handleImageMouseUp = () => {
    setIsDragging(false);
  };
  
  const resetImageView = () => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };
  
  // Fullscreen request handler
  const requestFullscreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch((err) => {
        console.log('Fullscreen request failed:', err);
      });
    }
  };
  
  // Track tab visibility for integrity - DO NOT auto-submit on visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!attemptId) return;
      
      try {
        const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
        
        if (document.visibilityState === 'hidden') {
          console.log('👁️ Tab/screen hidden - tracking for integrity monitoring');
          // Record tab switch and pause tracking (for integrity monitoring only)
          await RealtimeTestService.handleVisibilityChange(attemptId, false);
        } else {
          console.log('👁️ Tab/screen visible - resuming normal operation');
          // Resume tracking when tab becomes visible
          await RealtimeTestService.handleVisibilityChange(attemptId, true);
          
          // IMPORTANT: Do NOT check for expiration here
          // The timer will handle auto-submit when time truly runs out
          // This allows students to return after power outages, screen locks, etc.
          // as long as they still have time remaining
          console.log('✅ Visibility restored - timer will continue from where it left off');
        }
      } catch (error) {
        console.error('Error handling visibility change:', error);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [attemptId]);

  // Image viewer keyboard and mouse events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showImageViewer) return;
      
      switch (e.key) {
        case 'Escape':
          closeImageViewer();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleImageZoom(0.2);
          break;
        case '-':
          e.preventDefault();
          handleImageZoom(-0.2);
          break;
        case '0':
          e.preventDefault();
          resetImageView();
          break;
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      if (!showImageViewer) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleImageZoom(delta);
    };
    
    if (showImageViewer) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = ''; // Restore scrolling
    };
  }, [showImageViewer, imageScale]);

  // Track online/offline status for time management and answer sync
  useEffect(() => {
    let offlineTimestamp: number | null = null;
    
    const handleOnline = async () => {
      const offlineDuration = offlineTimestamp ? Date.now() - offlineTimestamp : 0;
      console.log('🌐 Connection restored after', Math.floor(offlineDuration / 1000), 'seconds offline');
      setIsOnline(true);
      
      if (!attemptId) return;
      
      try {
        // Handle reconnection - this will recalculate time based on server state
        const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
        const timeCalc = await AttemptManagementService.handleReconnection(attemptId);
        
        if (timeCalc) {
          console.log('🔌 Reconnection successful:');
          console.log('  - Time remaining:', timeCalc.timeRemaining, 'seconds');
          console.log('  - Offline time:', timeCalc.offlineTime, 'seconds');
          console.log('  - Is expired:', timeCalc.isExpired);
          
          setRemainingTime(timeCalc.timeRemaining);
          setOfflineTime(timeCalc.offlineTime);
          setWasOffline(timeCalc.offlineTime > 0);
          
          // DON'T auto-submit on reconnection even if isExpired is true
          // The timer will naturally hit 0 and trigger auto-submit if truly expired
          // This allows students to reconnect and continue if they still have time
          if (timeCalc.isExpired && timeCalc.timeRemaining <= 0) {
            console.log('⏰ Test time has expired (0 seconds remaining)');
            if (!graceMode) {
              setGraceMode(true);
              setGraceTimeRemaining(120);
            }
          } else if (timeCalc.timeRemaining > 0) {
            // Test still has time - allow student to continue!
            console.log('✅ Test still active - student can continue with', timeCalc.timeRemaining, 'seconds remaining');
            // Restart the timer with the remaining time
            setTimeExpired(false);
          }
        }
        
        // Sync offline answers and reload from realtime database
        if (test) {
          console.log('📤 Syncing offline answers...');
          await syncOfflineAnswers();
          
          console.log('🔄 Reloading answers after reconnection...');
          await loadExistingAnswersAndFiles(attemptId, test);
        }
        
        console.log('✅ Successfully synced after reconnection');
        offlineTimestamp = null; // Reset offline timestamp
      } catch (error) {
        console.error('❌ Error handling online reconnection:', error);
        // Don't auto-submit on errors - let the timer handle it
        offlineTimestamp = null;
      }
    };

    const handleOffline = async () => {
      console.log('📴 Connection lost - entering offline mode...');
      setIsOnline(false);
      setWasOffline(true);
      offlineTimestamp = Date.now(); // Track when we went offline
      
      if (!attemptId) return;
      
      try {
        const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
        await AttemptManagementService.handleDisconnection(attemptId);
        console.log('📴 Offline mode activated - time tracking paused');
      } catch (error) {
        console.error('Error handling offline:', error);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [attemptId, test]);
  
  // Tab switch tracking
  const updateTabSwitchCount = async () => {
    try {
      // Import service
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Record tab switch as suspicious activity
      await RealtimeTestService.trackSuspiciousActivity(attemptId, 'tab_switch');
    } catch (error) {
      console.error('Error tracking tab switch:', error);
    }
  };

  // Timer effect with attempt management integration and auto-submit
  useEffect(() => {
    if (!test || !attemptId) return;
    
    // NEW: Skip timer for untimed tests
    if ((test as any).isUntimed) {
      console.log('⏱️ Untimed test detected - no countdown timer, only deadline check');
      
      // For untimed tests, just check deadline periodically
      const checkDeadline = setInterval(async () => {
        try {
          const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
          const timeCalc = await AttemptManagementService.updateAttemptTime(attemptId);
          
          if (timeCalc.isExpired) {
            clearInterval(checkDeadline);
            if (!graceMode) {
              console.log('⏰ Untimed test deadline expired, entering grace period...');
              setGraceMode(true);
              setGraceTimeRemaining(120);
            }
          }
        } catch (error) {
          console.error('Error checking deadline:', error);
        }
      }, 60000); // Check every minute for untimed tests
      
      return () => clearInterval(checkDeadline);
    }
    
    // EXISTING: Timer logic for timed tests
    if (remainingTime <= 0) return;
    
    let serverSyncCounter = 0;
    let lastServerSync = Date.now();
    let lastServerTime = remainingTime;
    
    console.log('⏰ Timer useEffect starting with remaining time:', remainingTime, 'seconds');
    
    const interval = setInterval(async () => {
      try {
        serverSyncCounter++;
        const now = Date.now();
        
        // Calculate current estimated time for sync frequency decisions
        const elapsedSinceLastSync = Math.floor((now - lastServerSync) / 1000);
        const currentEstimatedTime = Math.max(0, lastServerTime - elapsedSinceLastSync);
        
        // Determine sync frequency based on remaining time
        let syncInterval = 10; // Default: sync every 10 seconds
        if (currentEstimatedTime <= 300) { // Last 5 minutes
          syncInterval = 5; // Sync every 5 seconds
        }
        if (currentEstimatedTime <= 60) { // Last minute
          syncInterval = 2; // Sync every 2 seconds
        }
        
        // For the first few ticks or when resuming, don't sync with server to avoid overriding resumed time
        // This gives time for the UI to show the correct resumed time
        const shouldSyncWithServer = serverSyncCounter % syncInterval === 0 && 
                                   serverSyncCounter > 3 && 
                                   !isResumingAttempt;
        
        if (shouldSyncWithServer) {
          console.log('🔄 Syncing time with server... (tick:', serverSyncCounter, ', isResuming:', isResumingAttempt, ')');
          const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
          const timeCalc = await AttemptManagementService.updateAttemptTime(attemptId);
          
          if (timeCalc) {
            // Update with accurate server time
            setRemainingTime(timeCalc.timeRemaining);
            lastServerSync = now;
            lastServerTime = timeCalc.timeRemaining;
            
            console.log('✅ Server sync - remaining time:', timeCalc.timeRemaining);
            
            if (timeCalc.isExpired) {
              clearInterval(interval);
              if (!graceMode) {
                console.log('⏰ Time expired, entering grace period...');
                setGraceMode(true);
                setGraceTimeRemaining(120);
              }
              return;
            }
          } else {
            // Server failed, use local countdown
            const elapsedSinceLastSync = Math.floor((now - lastServerSync) / 1000);
            const estimatedTime = Math.max(0, lastServerTime - elapsedSinceLastSync);
            setRemainingTime(estimatedTime);
            
            if (estimatedTime <= 0) {
              clearInterval(interval);
              if (!graceMode) {
                console.log('⏰ Time expired (server unavailable), entering grace period...');
                setGraceMode(true);
                setGraceTimeRemaining(120);
              }
              return;
            }
          }
        } else {
          // Between server syncs, use precise local countdown
          const elapsedSinceLastSync = Math.floor((now - lastServerSync) / 1000);
          const estimatedTime = Math.max(0, lastServerTime - elapsedSinceLastSync);
          setRemainingTime(estimatedTime);
          
          if (estimatedTime <= 0) {
            clearInterval(interval);
            if (!graceMode) {
              console.log('⏰ Time expired (local countdown), entering grace period...');
              setGraceMode(true);
              setGraceTimeRemaining(120);
            }
            return;
          }
        }
      } catch (error) {
        console.error('Error updating timer:', error);
        // Fallback: use local countdown based on last known server time
        const now = Date.now();
        const elapsedSinceLastSync = Math.floor((now - lastServerSync) / 1000);
        const estimatedTime = Math.max(0, lastServerTime - elapsedSinceLastSync);
        setRemainingTime(estimatedTime);
        
        if (estimatedTime <= 0) {
          clearInterval(interval);
          if (!graceMode) {
            console.log('⏰ Time expired (error fallback), entering grace period...');
            setGraceMode(true);
            setGraceTimeRemaining(120);
          }
          return;
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [test, attemptId, remainingTime]);

  // Grace period countdown - 2 minutes for student to submit after time expires
  useEffect(() => {
    if (!graceMode) return;

    const graceInterval = setInterval(() => {
      setGraceTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(graceInterval);
          // Grace period over - force auto-submit
          setTimeExpired(true);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(graceInterval);
  }, [graceMode]);

  // Check for expired attempts on page load/reconnection
  const checkAttemptStatus = async (attemptId: string) => {
    try {
      const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
      const timeCalc = await AttemptManagementService.updateAttemptTime(attemptId);
      
      if (timeCalc.isExpired) {
        console.log('⏰ Test has expired during disconnection, entering grace period...');
        if (!graceMode) {
          setGraceMode(true);
          setGraceTimeRemaining(120);
        }
        return false; // Test expired
      }
      
      // Update remaining time
      setRemainingTime(timeCalc.timeRemaining);
      return true; // Test still active
    } catch (error) {
      console.error('Error checking attempt status:', error);
      
      // If the error is "Attempt state not found", this might be a resumption issue
      if (error instanceof Error && error.message.includes('Attempt state not found')) {
        console.warn('⚠️ Attempt state not found - this might be a resumption after disconnect');
        // Return true to allow the test to continue, as the realtime state will be reinitialized
        return true;
      }
      
      // For other errors, return false to prevent test access
      return false;
    }
  };

  // Helper function to safely get timestamp in milliseconds
  const getTimestamp = (timestamp: any): number => {
    try {
      // Handle Firestore Timestamp object
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().getTime();
      }
      
      // Handle serialized Firestore timestamp with seconds and nanoseconds
      if (timestamp && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
        return (timestamp.seconds * 1000) + Math.floor(timestamp.nanoseconds / 1000000);
      }
      
      // Handle legacy serialized Firestore timestamp
      if (timestamp && timestamp._seconds && timestamp._nanoseconds !== undefined) {
        return (timestamp._seconds * 1000) + Math.floor(timestamp._nanoseconds / 1000000);
      }
      
      // Handle Date object
      if (timestamp instanceof Date) {
        return timestamp.getTime();
      }
      
      // Handle string timestamp
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
      }
      
      // Handle number timestamp
      if (typeof timestamp === 'number') {
        return timestamp > 1000000000000 ? timestamp : timestamp * 1000; // Convert seconds to milliseconds if needed
      }
      
      console.warn('⚠️ Unknown timestamp format:', timestamp);
      return Date.now(); // Fallback to current time
    } catch (error) {
      console.error('❌ Error parsing timestamp:', error, timestamp);
      return Date.now(); // Fallback to current time
    }
  };

  // Format remaining time for display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sync offline answers when coming back online
  const syncOfflineAnswers = async () => {
    if (!attemptId) return;
    
    try {
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Get all backup keys for this attempt
      const backupKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`backup_${attemptId}_`)
      );
      
      if (backupKeys.length === 0) {
        console.log('📤 No offline answers to sync');
        return;
      }
      
      console.log(`📤 Syncing ${backupKeys.length} offline answers...`);
      
      for (const backupKey of backupKeys) {
        try {
          const backupData = localStorage.getItem(backupKey);
          if (!backupData) continue;
          
          const answerData = JSON.parse(backupData) as RealtimeAnswer;
          const questionId = answerData.questionId;
          
          // Determine answer value and type
          let answerValue: any;
          let questionType: 'mcq' | 'essay';
          let pdfFiles: PdfAttachment[] = [];
          
          if (answerData.selectedOption !== undefined) {
            answerValue = answerData.selectedOption;
            questionType = 'mcq';
          } else {
            answerValue = answerData.textContent || '';
            questionType = 'essay';
            pdfFiles = answerData.pdfFiles || [];
          }
          
          // Sync to realtime database
          await RealtimeTestService.saveAnswer(
            attemptId,
            questionId,
            answerValue,
            questionType,
            answerData.timeSpent || 0,
            pdfFiles
          );
          
          // Remove backup after successful sync
          localStorage.removeItem(backupKey);
          console.log(`✅ Synced offline answer for question: ${questionId}`);
        } catch (error) {
          console.error(`❌ Failed to sync answer for key ${backupKey}:`, error);
        }
      }
      
      console.log('✅ Offline answer sync completed');
    } catch (error) {
      console.error('❌ Error syncing offline answers:', error);
    }
  };

  // Load existing answers and PDF files for all questions
  const loadExistingAnswersAndFiles = async (testAttemptId: string, testData: Test) => {
    try {
      if (!student?.id) return;

      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Get the test session which includes answers
      const session = await RealtimeTestService.getSession(testAttemptId);
      
      if (!session?.answers) {
        console.log('📁 No existing answers found');
        return;
      }
      
      console.log('🔄 Loading existing answers from session:', Object.keys(session.answers));
      
      // Extract both answers and PDF files from all questions
      const pdfMap: Record<string, PdfAttachment[]> = {};
      const answersToLoad: Record<string, RealtimeAnswer> = {};
      
      for (const question of testData.questions) {
        const questionId = question.id;
        const existingAnswer = session.answers[questionId];
        
        if (existingAnswer) {
          // Always load the answer regardless of question type
          answersToLoad[questionId] = existingAnswer;
          
          // For essay questions, also extract PDF files
          if (question.type === 'essay' && existingAnswer.pdfFiles) {
            pdfMap[questionId] = existingAnswer.pdfFiles;
          }
          
          console.log(`📝 Loaded answer for question ${questionId}:`, {
            type: question.type,
            hasAnswer: !!existingAnswer,
            answerType: question.type === 'mcq' ? 'selectedOption' : 'textContent',
            answerValue: question.type === 'mcq' ? existingAnswer.selectedOption : (existingAnswer.textContent?.substring(0, 50) + '...'),
            hasPdfs: question.type === 'essay' ? (existingAnswer.pdfFiles?.length || 0) : 'N/A'
          });
        }
      }
      
      // Update both states
      if (Object.keys(answersToLoad).length > 0) {
        setAnswers(answersToLoad);
        console.log('✅ Loaded', Object.keys(answersToLoad).length, 'existing answers');
      }
      
      if (Object.keys(pdfMap).length > 0) {
        setPdfFiles(pdfMap);
        console.log('📁 Loaded existing PDF files for', Object.keys(pdfMap).length, 'questions');
      }
      
      // Also restore question navigation state from session
      if (session.currentQuestionIndex !== undefined && session.currentQuestionIndex >= 0) {
        setCurrentIndex(session.currentQuestionIndex);
        console.log('🧭 Restored current question index:', session.currentQuestionIndex);
      }
      
      // Restore review mode if it was active
      if (session.isReviewMode !== undefined) {
        setReviewMode(session.isReviewMode);
        console.log('👁️ Restored review mode:', session.isReviewMode);
      }
      
    } catch (error) {
      console.error('Error loading existing answers and files:', error);
    }
  };

  // Load test data
  useEffect(() => {
    const loadTest = async () => {
      if (!testId) {
        console.error('❌ No test ID provided');
        setError('Invalid test ID. Please check the URL and try again.');
        setLoading(false);
        return;
      }
      
      if (!student) {
        console.log('⏳ Waiting for student authentication...');
        return;
      }
      
      if (!student.id) {
        console.error('❌ Student ID is missing');
        setError('Authentication error. Please log in again.');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Loading test with ID:', testId, 'for student:', student.id);
        
        // Import Firestore functions
        const { doc, getDoc } = await import('firebase/firestore');
        const { firestore } = await import('@/utils/firebase-client');
        
        if (!firestore) {
          throw new Error('Firestore is not initialized. Please check Firebase configuration.');
        }
        
        console.log('🔗 Firebase connection established');
        
        // Get the test document
        const testDoc = await getDoc(doc(firestore, 'tests', testId));
        
        if (!testDoc.exists()) {
          console.error('❌ Test document not found:', testId);
          setError('Test not found. It may have been deleted.');
          setLoading(false);
          return;
        }
        
        const testData = { id: testDoc.id, ...testDoc.data() } as Test;
        console.log('✅ Test data loaded:', testData.title);
        console.log('🔍 Test assignment type:', testData.assignmentType);
        console.log('🔍 Test class IDs:', testData.classIds);
        console.log('🔍 Full test data for debugging:', {
          id: testData.id,
          title: testData.title,
          assignmentType: testData.assignmentType,
          classIds: testData.classIds,
          type: testData.type
        });
        
        // Check if student is enrolled in any of the test's classes

        // Only check enrollment for class-based or mixed tests
  let enrollments: any[] = [];
        let isEnrolled = true;
        
        console.log('🔍 Checking if enrollment check is needed...');
        console.log('🔍 assignmentType !== "student-based":', testData.assignmentType !== 'student-based');
        
        // Check if this is a custom/student-based test
        // Handle both new tests with explicit assignmentType and legacy tests
        const isCustomTest = testData.assignmentType === 'student-based' || 
                            (!testData.assignmentType && (!testData.classIds || testData.classIds.length === 0)) ||
                            !testData.classIds || 
                            testData.classIds.length === 0;
        
        console.log('🔍 Is custom test check result:', isCustomTest);
        console.log('🔍 Detailed check:', {
          assignmentType: testData.assignmentType,
          classIds: testData.classIds,
          classIdsLength: testData.classIds?.length || 0,
          isStudentBased: testData.assignmentType === 'student-based',
          hasNoClassIds: !testData.classIds || testData.classIds.length === 0,
          isLegacyWithNoClasses: !testData.assignmentType && (!testData.classIds || testData.classIds.length === 0)
        });
        
        console.log('🎯 About to check enrollment logic with isCustomTest =', isCustomTest);
        console.log('🎯 Test ID being processed:', testData.id);
        console.log('🎯 Test title being processed:', testData.title);
        
        if (!isCustomTest) {
          console.log('🔍 ✅ ENTERING enrollment check for class-based test...');
          const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
          try {
            enrollments = await getEnrollmentsByStudent(student.id);
            console.log('📋 Student enrollments loaded successfully:', enrollments.length, 'classes');
          } catch (enrollmentError) {
            console.error('❌ Error fetching enrollments:', enrollmentError);
            throw new Error(`Failed to fetch enrollments: ${enrollmentError}`);
          }
          console.log('📋 Student enrollment details:', enrollments.map(e => ({ 
            id: e.id,
            classId: e.classId, 
            className: e.className,
            status: e.status 
          })));
          console.log('🎯 Test class IDs:', testData.classIds);
          
          isEnrolled = enrollments.some(enrollment => 
            testData.classIds.includes(enrollment.classId) && 
            enrollment.status === 'Active'
          );
          
          console.log('✅ Enrollment check result:', isEnrolled);
          if (!isEnrolled) {
            console.error('❌ Student not enrolled in test classes');
            console.error('❌ Available enrollments:', enrollments.map(e => ({ classId: e.classId, status: e.status })));
            console.error('❌ Required class IDs:', testData.classIds);
            setError('You are not enrolled in the class for this test.');
            setLoading(false);
            return;
          }
          console.log('✅ Student is enrolled in test classes');
        } else {
          // For student-based (custom) tests, skip enrollment check
          console.log('🟢 ✅ SKIPPING enrollment check for custom test.');
          console.log('🟢 ✅ Custom test details: ID =', testData.id, ', title =', testData.title);
          console.log('🟢 ✅ Reason: assignmentType =', testData.assignmentType, ', classIds =', testData.classIds);
        }
        
        // Check test availability
        const now = new Date().getTime();
        let testAvailable = false;
        let testDuration = 0;
        let classId = '';
        
        console.log('⏰ Checking test availability at:', new Date(now).toISOString());
        
        // Handle classId and className based on test assignment type
        let className = 'Unknown Class';
        
        if (isCustomTest) {
          // For custom/student-based tests, use a default classId and className
          classId = 'custom-test';
          className = 'Custom Test';
          console.log('🎯 Using custom classId for student-based test:', classId);
          console.log('🎯 Using custom className for student-based test:', className);
        } else {
          // For class-based tests, find first matching class ID for this student
          const enrollment = enrollments.find(e => testData.classIds.includes(e.classId) && e.status === 'Active');
          if (enrollment) {
            classId = enrollment.classId;
            className = enrollment.className || 'Unknown Class';
          } else {
            // Fallback: use the first class ID from the test if no enrollment found
            classId = testData.classIds[0] || 'unknown-class';
            console.warn('⚠️ No matching enrollment found, using fallback classId:', classId);
            
            // Try to find class name from test data
            const testClassIndex = testData.classIds.indexOf(classId);
            if (testClassIndex >= 0 && testData.classNames && testData.classNames[testClassIndex]) {
              className = testData.classNames[testClassIndex];
            }
          }
          console.log('🎯 Selected classId for class-based test:', classId);
          console.log('🎯 Selected className for class-based test:', className);
        }
        
        // Debug timestamp data
        console.log('🔍 Test data type:', testData.type);
        if (testData.type === 'flexible') {
          const flexTest = testData as FlexibleTest;
          console.log('🔍 FlexTest availableFrom:', flexTest.availableFrom);
          console.log('🔍 FlexTest availableTo:', flexTest.availableTo);
          console.log('🔍 FlexTest availableFrom type:', typeof flexTest.availableFrom);
          console.log('🔍 FlexTest availableTo type:', typeof flexTest.availableTo);
        } else {
          const liveTest = testData as LiveTest;
          console.log('🔍 LiveTest studentJoinTime:', liveTest.studentJoinTime);
          console.log('🔍 LiveTest actualEndTime:', liveTest.actualEndTime);
        }
        
        if (testData.type === 'live') {
          const liveTest = testData as LiveTest;
          const startTime = getTimestamp(liveTest.studentJoinTime);
          const endTime = getTimestamp(liveTest.actualEndTime);
          
          console.log('🔍 Live test times:');
          console.log('🔍 Start time (ms):', startTime, 'Date:', new Date(startTime).toISOString());
          console.log('🔍 End time (ms):', endTime, 'Date:', new Date(endTime).toISOString());
          console.log('🔍 Current time (ms):', now, 'Date:', new Date(now).toISOString());
          
          testAvailable = now >= startTime && now <= endTime;
          testDuration = liveTest.duration * 60; // convert to seconds
          
          // 🔥 DON'T set remaining time here - it will be calculated properly from the attempt
          // const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
          // setRemainingTime(timeRemaining);
        } else {
          const flexTest = testData as FlexibleTest;
          const startTime = getTimestamp(flexTest.availableFrom);
          const endTime = getTimestamp(flexTest.availableTo);
          
          console.log('🔍 Flexible test times:');
          console.log('🔍 Start time (ms):', startTime, 'Date:', new Date(startTime).toISOString());
          console.log('🔍 End time (ms):', endTime, 'Date:', new Date(endTime).toISOString());
          console.log('🔍 Current time (ms):', now, 'Date:', new Date(now).toISOString());
          
          testAvailable = now >= startTime && now <= endTime;
          testDuration = flexTest.duration * 60; // convert to seconds
          
          console.log('🔍 Test available check:', {
            now,
            startTime,
            endTime,
            nowGreaterThanStart: now >= startTime,
            nowLessThanEnd: now <= endTime,
            testAvailable
          });
          
          // 🔥 DON'T set remaining time here - it will be set when we load the attempt
          // setRemainingTime(flexTest.duration * 60); // convert to seconds
        }
        
        // If test is not normally available, check for late submission approval
        if (!testAvailable && student?.id) {
          console.log('🔍 Test not normally available, checking for late submission approval...');
          try {
            const { LateSubmissionService } = await import('@/apiservices/lateSubmissionService');
            const lateSubmissionApproval = await LateSubmissionService.checkLateSubmissionApproval(testData.id, student.id);
            
            if (lateSubmissionApproval && lateSubmissionApproval.status === 'approved') {
              const lateDeadlineTime = getTimestamp(lateSubmissionApproval.newDeadline);
              const isWithinLateDeadline = now <= lateDeadlineTime;
              
              console.log('🕐 Late submission approval found:', {
                approvalId: lateSubmissionApproval.id,
                status: lateSubmissionApproval.status,
                newDeadline: new Date(lateDeadlineTime).toISOString(),
                currentTime: new Date(now).toISOString(),
                isWithinLateDeadline
              });
              
              if (isWithinLateDeadline) {
                console.log('✅ Late submission approved and within deadline - allowing test access');
                testAvailable = true;
              } else {
                console.log('❌ Late submission deadline has passed');
              }
            } else {
              console.log('❌ No valid late submission approval found');
            }
          } catch (error) {
            console.error('Error checking late submission approval:', error);
          }
        }
        
        if (!testAvailable) {
          console.error('❌ Test not available. Debugging info:');
          console.error('❌ Test type:', testData.type);
          console.error('❌ Current timestamp:', now);
          console.error('❌ Test available:', testAvailable);
          
          // For development: Check if this is a future date issue
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          
          if (testData.type === 'flexible') {
            const flexTest = testData as FlexibleTest;
            const startTime = getTimestamp(flexTest.availableFrom);
            const endTime = getTimestamp(flexTest.availableTo);
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            
            console.warn('⚠️ DEVELOPMENT MODE: Checking if test has future dates');
            console.warn('⚠️ Start date:', startDate.toISOString());
            console.warn('⚠️ End date:', endDate.toISOString());
            
            // If the test dates are in the future (beyond current year + 1), it's likely test data
            if (startDate.getFullYear() > currentYear + 1) {
              console.warn('⚠️ DEVELOPMENT OVERRIDE: Test appears to have far future dates, allowing access for testing');
              testAvailable = true;
              // 🔥 DON'T set remaining time here either - let it be handled by attempt management
              // setRemainingTime(flexTest.duration * 60);
            }
          }
          
          if (!testAvailable) {
            setError('This test is not currently available.');
            setLoading(false);
            return;
          }
        }
        
        // Set the test data
        setTest(testData);
        
        // Check for existing active attempt or create new one
        const { AttemptManagementService } = await import('@/apiservices/attemptManagementService');
        
        // Check if student has an active attempt
        let activeAttempt = await AttemptManagementService.getActiveAttempt(testId, student.id);
        
        let newAttemptId: string;
        
        if (activeAttempt) {
          // Resume existing attempt
          console.log('🔄 Resuming existing attempt:', activeAttempt.id);
          setIsResumingAttempt(true);
          newAttemptId = activeAttempt.id;
          
          setAttemptId(newAttemptId);
          
          // Load questions for this attempt (shuffled or original)
          console.log('📋 Loading questions for resumed attempt...');
          const questionsData = await AttemptManagementService.getQuestionsForAttempt(newAttemptId);
          setDisplayQuestions(questionsData.questions);
          setOriginalQuestions(testData.questions);
          setIsShuffled(questionsData.isShuffled);
          setQuestionOrderMapping(questionsData.questionOrderMapping || null);
          console.log('✅ Questions loaded:', {
            total: questionsData.questions.length,
            isShuffled: questionsData.isShuffled
          });
          
          // Store student info in localStorage for fallback in submission service (even for resumed attempts)
          try {
            localStorage.setItem('studentId', student.id);
            localStorage.setItem('studentName', student.name || 'Anonymous Student');
            console.log('✅ Stored student info in localStorage for fallback (resumed attempt)');
          } catch (storageError) {
            console.warn('⚠️ Could not store student info in localStorage:', storageError);
          }
          
          // 🔥 CRITICAL: Calculate remaining time based on Firestore data for resumed attempts
          // This avoids potential issues with real-time database state corruption
          console.log('⏰ Calculating remaining time from Firestore attempt data...');
          let calculatedRemainingTime = 0;
          
          if (activeAttempt.endTime) {
            const endTime = activeAttempt.endTime.toDate ? activeAttempt.endTime.toDate() : new Date(activeAttempt.endTime.seconds * 1000);
            calculatedRemainingTime = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000));
          } else if (activeAttempt.startedAt && activeAttempt.totalTimeAllowed) {
            const startTime = activeAttempt.startedAt.toDate ? activeAttempt.startedAt.toDate() : new Date(activeAttempt.startedAt.seconds * 1000);
            const endTime = new Date(startTime.getTime() + (activeAttempt.totalTimeAllowed * 1000));
            calculatedRemainingTime = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000));
          } else if (activeAttempt.timeRemaining) {
            calculatedRemainingTime = activeAttempt.timeRemaining;
          }
          
          console.log('⏰ Calculated remaining time from Firestore:', calculatedRemainingTime, 'seconds');
          
          // Set the calculated remaining time directly instead of using AttemptManagementService
          setRemainingTime(calculatedRemainingTime);
          console.log('✅ Set remaining time for resumed attempt:', calculatedRemainingTime, 'seconds');
          
          // Check if already expired
          if (calculatedRemainingTime <= 0) {
            console.log('⏰ Attempt has already expired based on Firestore data, entering grace period...');
            if (!graceMode) {
              setGraceMode(true);
              setGraceTimeRemaining(120);
            }
            setLoading(false);
            return;
          }
          
          // Clear the resuming flag after a short delay to allow timer to stabilize
          setTimeout(() => setIsResumingAttempt(false), 2000);
          
          // 🔥 CRITICAL: For resumed attempts, do NOT restart the session
          // This prevents clearing existing answers and resetting time
          console.log('✅ Resumed attempt - skipping session restart to preserve data');
          
          // Attempt is still active, continue with current time from attempt management
          console.log('✅ Attempt is still active, continuing...');
        } else {
          // Check if student can create a new attempt
          const attemptSummary = await AttemptManagementService.getAttemptSummary(testId, student.id);
          
          if (!attemptSummary.canCreateNewAttempt) {
            setError(`Cannot start test: You have used all ${attemptSummary.attemptsAllowed} attempts for this test.`);
            setLoading(false);
            return;
          }
          
          // Create new attempt
          console.log('🆕 Creating new attempt...');
          newAttemptId = await AttemptManagementService.createAttempt(
            testId,
            student.id,
            student.name || 'Anonymous Student',
            classId,
            className
          );
          
          console.log('✅ New attempt created:', newAttemptId);
          
          setAttemptId(newAttemptId);
          
          // Load questions for this attempt (shuffled or original)
          console.log('📋 Loading questions for new attempt...');
          const questionsData = await AttemptManagementService.getQuestionsForAttempt(newAttemptId);
          setDisplayQuestions(questionsData.questions);
          setOriginalQuestions(testData.questions);
          setIsShuffled(questionsData.isShuffled);
          setQuestionOrderMapping(questionsData.questionOrderMapping || null);
          console.log('✅ Questions loaded:', {
            total: questionsData.questions.length,
            isShuffled: questionsData.isShuffled
          });
          
          // 🔥 CRITICAL: For new attempts, set the correct initial remaining time
          setRemainingTime(testDuration); // This should be the full test duration for new attempts
          console.log('✅ New attempt created with initial time:', testDuration, 'seconds');
          
          // Start test session in Realtime DB for new attempt
          const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
          
          // Store student info in localStorage for fallback in submission service
          try {
            localStorage.setItem('studentId', student.id);
            localStorage.setItem('studentName', student.name || 'Anonymous Student');
            console.log('✅ Stored student info in localStorage for fallback');
          } catch (storageError) {
            console.warn('⚠️ Could not store student info in localStorage:', storageError);
          }
          
          await RealtimeTestService.startTestSession(
            newAttemptId,
            testId,
            student.id,
            student.name || 'Anonymous Student',
            classId,
            testDuration / 60 // convert back to minutes
          );
        }
        
        console.log('✅ Test session started successfully');
        
        // 🔥 CRITICAL: For BOTH new and resumed attempts, load existing answers
        await loadExistingAnswersAndFiles(newAttemptId, testData);
        
        // 🔥 CRITICAL: Only get final time calculation for NEW attempts
        // For resumed attempts, we already have the correct time
        if (!activeAttempt) {
          // This is a NEW attempt - get the initial time calculation
          console.log('⏰ Getting initial time calculation for new attempt...');
          const finalTimeCalc = await AttemptManagementService.updateAttemptTime(newAttemptId);
          
          if (finalTimeCalc.isExpired) {
            console.log('⏰ Attempt expired during setup, entering grace period...');
            if (!graceMode) {
              setGraceMode(true);
              setGraceTimeRemaining(120);
            }
            setLoading(false);
            return;
          }
          
          // Set the time for new attempts
          setRemainingTime(finalTimeCalc.timeRemaining);
          console.log('✅ Initial time set for new attempt:', finalTimeCalc.timeRemaining, 'seconds');
        } else {
          // This is a RESUMED attempt - we already have the correct time, don't override it
          console.log('✅ Resumed attempt - keeping existing time:', remainingTime, 'seconds');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading test:', error);
        
        // More specific error handling
        let errorMessage = 'Failed to load test data. Please try again.';
        
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          
          if (error.message.includes('firestore') || error.message.includes('firebase')) {
            errorMessage = 'Database connection error. Please check your internet connection and try again.';
          } else if (error.message.includes('permission') || error.message.includes('denied')) {
            errorMessage = 'Access denied. You may not have permission to view this test.';
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          } else if (error.message.includes('not found') || error.message.includes('does not exist')) {
            errorMessage = 'Test not found. Please check the test ID and try again.';
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };
    
    loadTest();
    
    // Clean up function
    return () => {
      // Handle cleanup when component unmounts
      const cleanupSession = async () => {
        if (attemptId) {
          try {
            const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
            await RealtimeTestService.cleanupSession(attemptId);
          } catch (error) {
            console.error('Error cleaning up session:', error);
          }
        }
      };
      
      cleanupSession();
    };
  }, [testId, student]);

  // Track time spent on current question
  useEffect(() => {
    if (!currentQuestion) return;
    
    // Reset start time when question changes
    questionStartTimeRef.current = Date.now();
    
    // Track when leaving the question
    return () => {
      if (currentQuestion) {
        const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
        const questionId = currentQuestion.id;
        
        // Add to accumulated time
        timeSpentRef.current[questionId] = (timeSpentRef.current[questionId] || 0) + timeSpent;
      }
    };
  }, [currentIndex, currentQuestion]);

  // Handle saving answer with offline backup
  const saveAnswer = useCallback(async (answer: any) => {
    console.log('🔵 saveAnswer called:', { answer, currentQuestion: currentQuestion?.id, attemptId, isOnline });
    
    if (!currentQuestion || !attemptId) {
      console.warn('⚠️ saveAnswer aborted: missing currentQuestion or attemptId', { currentQuestion, attemptId });
      return;
    }
    
    try {
      setSavedState('saving');
      
      const questionId = currentQuestion.id;
      console.log('🔵 Saving answer for question:', questionId, 'Type:', currentQuestion.type);
      const timeSpent = timeSpentRef.current[questionId] || 0;
      
      // Handle different answer types
      let cleanAnswer = answer;
      let pdfFiles: PdfAttachment[] = [];
      
      if (answer === undefined || answer === null) {
        cleanAnswer = currentQuestion.type === 'essay' ? '' : 0;
      } else if (typeof answer === 'object' && answer.textContent !== undefined) {
        // Essay answer with PDF files
        cleanAnswer = answer.textContent || '';
        pdfFiles = answer.pdfFiles || [];
      }
      
      // Update local state immediately (optimistic update)
      const now = Date.now();
      const currentAnswer = answers[questionId];
      
      const updatedAnswer: RealtimeAnswer = {
        questionId,
        lastModified: now,
        timeSpent: timeSpent,
        isMarkedForReview: currentAnswer?.isMarkedForReview || false,
        changeHistory: [
          ...(currentAnswer?.changeHistory || []),
          {
            timestamp: now,
            type: currentQuestion.type === 'mcq' ? 'select' : 'text_change',
            previousValue: currentAnswer?.selectedOption || currentAnswer?.textContent,
            newValue: cleanAnswer,
            timeOnQuestion: timeSpent
          }
        ]
      };

      // Add type-specific properties
      if (currentQuestion.type === 'mcq') {
        updatedAnswer.selectedOption = cleanAnswer;
      } else if (currentQuestion.type === 'essay') {
        updatedAnswer.textContent = cleanAnswer;
        updatedAnswer.pdfFiles = pdfFiles;
      }
      
      setAnswers(prev => ({
        ...prev,
        [questionId]: updatedAnswer
      }));
      
      // Save to localStorage as backup
      const backupKey = `backup_${attemptId}_${questionId}`;
      localStorage.setItem(backupKey, JSON.stringify(updatedAnswer));
      console.log('🔵 Saved to localStorage backup:', backupKey);
      
      if (isOnline) {
        console.log('🔵 Online - attempting to save to Realtime DB...');
        try {
          // Import service
          const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
          
          console.log('🔵 Calling RealtimeTestService.saveAnswer with:', {
            attemptId,
            questionId,
            cleanAnswer,
            type: currentQuestion.type,
            timeSpent
          });
          
          // Save to Realtime DB - extend to support PDF files
          await RealtimeTestService.saveAnswer(
            attemptId,
            questionId,
            cleanAnswer,
            currentQuestion.type,
            timeSpent,
            pdfFiles // Pass PDF files as additional parameter
          );
          
          // Clear backup on successful save
          localStorage.removeItem(backupKey);
          setSavedState('saved');
          
          // Clear saved state after a delay
          setTimeout(() => {
            setSavedState(null);
          }, 2000);
        } catch (error) {
          console.error('Error saving answer to realtime DB:', error);
          setSavedState('error');
          // Keep the localStorage backup
          setTimeout(() => setSavedState(null), 3000);
        }
      } else {
        console.log('💾 Saved answer offline for question:', questionId);
        setSavedState('saved');
        setTimeout(() => setSavedState(null), 2000);
      }
    } catch (error) {
      console.error('❌ Error saving answer:', error);
      setSavedState('error');
      setTimeout(() => setSavedState(null), 3000);
    }
  }, [attemptId, currentQuestion, answers, isOnline]);

  // Handle option selection for MCQ
  const handleOptionSelect = (optionIndex: number) => {
    console.log('🟢 handleOptionSelect called with optionIndex:', optionIndex);
    console.log('🟢 currentQuestion:', currentQuestion?.id, 'type:', currentQuestion?.type);
    
    if (!currentQuestion || currentQuestion.type !== 'mcq') {
      console.warn('⚠️ handleOptionSelect aborted: invalid question');
      return;
    }
    
    console.log('🟢 Calling saveAnswer with optionIndex:', optionIndex);
    saveAnswer(optionIndex);
  };

  // Handle essay answer change
  const handleEssayChange = (content: string) => {
    if (!currentQuestion || currentQuestion.type !== 'essay') return;
    
    // Debounce the save operation
    const timeoutId = setTimeout(() => {
      saveAnswer(content);
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  };

  // Navigate to next question
  const goToNextQuestion = async () => {
    if (!displayQuestions || currentIndex >= displayQuestions.length - 1) return;
    
    try {
      // Import service
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Update in Realtime DB
      const nextIndex = currentIndex + 1;
      const nextQuestionId = displayQuestions[nextIndex].id;
      
      await RealtimeTestService.navigateToQuestion(
        attemptId,
        nextIndex,
        nextQuestionId
      );
      
      setCurrentIndex(nextIndex);
    } catch (error) {
      console.error('Error navigating to next question:', error);
    }
  };

  // Navigate to previous question
  const goToPrevQuestion = async () => {
    if (currentIndex <= 0) return;
    
    try {
      // Import service
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Update in Realtime DB
      const prevIndex = currentIndex - 1;
      const prevQuestionId = displayQuestions[prevIndex]?.id || '';
      
      await RealtimeTestService.navigateToQuestion(
        attemptId,
        prevIndex,
        prevQuestionId
      );
      
      setCurrentIndex(prevIndex);
    } catch (error) {
      console.error('Error navigating to previous question:', error);
    }
  };

  // Jump to specific question
  const jumpToQuestion = async (index: number) => {
    if (!displayQuestions || index < 0 || index >= displayQuestions.length) return;
    
    try {
      // Import service
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Update in Realtime DB
      const questionId = displayQuestions[index].id;
      
      await RealtimeTestService.navigateToQuestion(
        attemptId,
        index,
        questionId
      );
      
      setCurrentIndex(index);
      setShowNavPanel(false);
    } catch (error) {
      console.error('Error jumping to question:', error);
    }
  };

  // Toggle review mark for current question
  const toggleReviewMark = async () => {
    if (!currentQuestion || !attemptId) return;
    
    try {
      const questionId = currentQuestion.id;
      const isCurrentlyMarked = answers[questionId]?.isMarkedForReview || false;
      
      // Import service
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      
      // Update in Realtime DB
      await RealtimeTestService.toggleReviewMark(
        attemptId,
        questionId,
        !isCurrentlyMarked
      );
      
      // Update local state
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          isMarkedForReview: !isCurrentlyMarked
        }
      }));
    } catch (error) {
      console.error('Error toggling review mark:', error);
    }
  };

  // Handle PDF upload for essay questions - called by PdfUploadComponent
  const handlePdfUpload = async (attachment: PdfAttachment) => {
    try {
      if (!currentQuestion) return;
      
      const questionId = currentQuestion.id;

      // Update local PDF files state
      setPdfFiles(prev => {
        const existingFiles = prev[questionId] || [];
        return {
          ...prev,
          [questionId]: [...existingFiles, attachment]
        };
      });

      // Update the answer with the new PDF file
      const currentAnswerText = answers[questionId]?.textContent || '';
      const updatedPdfFiles = [
        ...(answers[questionId]?.pdfFiles || []),
        attachment
      ];

      // Save the updated answer with PDF files
      await saveAnswer({
        textContent: currentAnswerText,
        pdfFiles: updatedPdfFiles
      });

      console.log('PDF uploaded successfully:', attachment);
    } catch (error) {
      console.error('Error handling PDF upload:', error);
    }
  };

  // Handle PDF removal for essay questions - called by PdfUploadComponent
  const handlePdfRemove = async (fileUrl: string) => {
    try {
      if (!currentQuestion) return;
      
      const questionId = currentQuestion.id;

      // Import the PDF service and delete the file
      const { StudentPdfService } = await import('@/apiservices/studentPdfService');
      await StudentPdfService.deletePdf(fileUrl);

      // Update local PDF files state
      setPdfFiles(prev => ({
        ...prev,
        [questionId]: (prev[questionId] || []).filter(file => file.fileUrl !== fileUrl)
      }));

      // Update the answer with the removed PDF file
      const currentAnswerText = answers[questionId]?.textContent || '';
      const updatedPdfFiles = (answers[questionId]?.pdfFiles || []).filter(
        file => file.fileUrl !== fileUrl
      );

      // Save the updated answer with remaining PDF files
      await saveAnswer({
        textContent: currentAnswerText,
        pdfFiles: updatedPdfFiles
      });

      console.log('PDF removed successfully:', fileUrl);
    } catch (error) {
      console.error('Error removing PDF:', error);
    }
  };

  // Submit test
  const handleSubmitTest = async () => {
    if (!attemptId || isSubmitting) return; // Prevent double submission
    
    try {
      setIsSubmitting(true); // Lock submission
      setLoading(true);
      
      // Import services
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      const { SubmissionService } = await import('@/apiservices/submissionService');
      
      // Save all current answers before submission (network resilience)
      console.log('💾 Final save before submission - preserving answer state...');
      const savePromises = Object.entries(answers).map(async ([questionId, answer]) => {
        try {
          const question = displayQuestions.find(q => q.id === questionId);
          if (question) {
            const timeSpent = timeSpentRef.current[questionId] || 0;
            await RealtimeTestService.saveAnswer(
              attemptId,
              questionId,
              answer.selectedOption ?? answer.textContent ?? null,
              question.type,
              timeSpent,
              answer.pdfFiles
            );
          }
        } catch (err) {
          console.warn(`Failed to save answer for ${questionId}:`, err);
          // Continue even if one save fails
        }
      });
      
      await Promise.allSettled(savePromises);
      console.log('✅ All answers saved before submission');
      
      // Submit test session in Realtime DB and attempt management
      await RealtimeTestService.submitTestSession(attemptId, false);
      
      // Process submission
      await SubmissionService.processSubmission(attemptId, false);
      
      // Navigate to results page
      router.push(`/student/test/${testId}/result?submissionId=${attemptId}`);
    } catch (error) {
      console.error('Error submitting test:', error);
      setError('Failed to submit test. Please try again.');
      setIsSubmitting(false); // Release lock on error
      setLoading(false);
    }
  };

  // Auto-submit when time expires - enhanced with proper error handling
  const handleAutoSubmit = async () => {
    if (!attemptId) {
      console.error('❌ Cannot auto-submit: No attempt ID');
      return;
    }
    
    try {
      setLoading(true);
      console.log('⏰ Auto-submitting test due to time expiry...');
      
      // Import services
      const { RealtimeTestService } = await import('@/apiservices/realtimeTestService');
      const { SubmissionService } = await import('@/apiservices/submissionService');
      
      // Submit test session in Realtime DB and attempt management (auto-submit)
      await RealtimeTestService.submitTestSession(attemptId, true);
      
      // Process submission
      await SubmissionService.processSubmission(attemptId, true);
      
      console.log('✅ Test auto-submitted successfully');
      
      // Navigate to results page
      router.push(`/student/test/${testId}/result?submissionId=${attemptId}&autoSubmitted=true`);
    } catch (error) {
      console.error('❌ Error auto-submitting test:', error);
      
      // Show error but still try to navigate to results
      setError('Test time expired. There was an issue submitting your answers, but we\'ll try to save what we have.');
      
      // Wait a moment then navigate anyway
      setTimeout(() => {
        router.push(`/student/test/${testId}/result?submissionId=${attemptId}&autoSubmitted=true&error=true`);
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-36 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <button 
              onClick={() => router.push('/student/test')}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Tests
            </button>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Test Error
            </h1>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              Error
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-6">
              {error}
            </p>
            <Button 
              onClick={() => router.push('/student/test')}
            >
              Return to Tests
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Time expired - auto-submitted after grace period
  if (timeExpired) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Time Expired
            </h1>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
            <h2 className="text-xl font-semibold text-orange-800 dark:text-orange-200 mb-2">
              Test Time Has Expired
            </h2>
            <p className="text-orange-700 dark:text-orange-300 mb-6">
              Your answers have been automatically submitted. Please wait while we process your submission...
            </p>
            <div className="animate-pulse">
              <div className="h-4 bg-orange-200 dark:bg-orange-700 rounded w-full max-w-md mx-auto"></div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }
  
  // Pre-submission review page (like Moodle)
  if (showPreSubmitReview) {
    const answeredQuestions = displayQuestions.filter(q => {
      const answer = answers[q.id];
      if (q.type === 'mcq') {
        return answer?.selectedOption !== undefined && answer?.selectedOption !== null;
      } else {
        return answer?.textContent && answer.textContent.trim().length > 0;
      }
    });
    
    const unansweredQuestions = displayQuestions.filter(q => !answeredQuestions.includes(q));
    const markedForReview = displayQuestions.filter(q => answers[q.id]?.isMarkedForReview);
    
    return (
      <StudentLayout>
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Review Your Answers
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Please review your answers before final submission
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={() => setShowPreSubmitReview(false)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Test
              </Button>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Answered</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{answeredQuestions.length}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">Unanswered</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{unansweredQuestions.length}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">Marked for Review</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{markedForReview.length}</p>
                </div>
                <Flag className="h-10 w-10 text-yellow-500" />
              </div>
            </div>
          </div>
          
          {/* Warning for unanswered questions */}
          {unansweredQuestions.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                    Warning: {unansweredQuestions.length} Question{unansweredQuestions.length !== 1 ? 's' : ''} Not Answered
                  </h3>
                  <p className="text-red-700 dark:text-red-300 mb-3">
                    The following questions have not been answered. They will be marked as "Not answered" and will receive 0 marks.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unansweredQuestions.map((q, idx) => (
                      <button
                        key={q.id}
                        onClick={() => {
                          setShowPreSubmitReview(false);
                          setCurrentIndex(displayQuestions.findIndex(dq => dq.id === q.id));
                        }}
                        className="px-3 py-1 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-600 rounded text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        Question {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Question List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Questions ({displayQuestions.length})
              </h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {displayQuestions.map((q, idx) => {
                  const answer = answers[q.id];
                  const isAnswered = q.type === 'mcq' 
                    ? (answer?.selectedOption !== undefined && answer?.selectedOption !== null)
                    : (answer?.textContent && answer.textContent.trim().length > 0);
                  const isMarked = answer?.isMarkedForReview;
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setShowPreSubmitReview(false);
                        setCurrentIndex(idx);
                      }}
                      className={`h-12 rounded-lg border-2 font-semibold transition-all ${
                        isAnswered
                          ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-500 dark:text-green-300'
                          : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:border-red-500 dark:text-red-300'
                      } ${isMarked ? 'ring-2 ring-yellow-400' : ''} hover:scale-105`}
                    >
                      {idx + 1}
                      {isMarked && <Flag className="h-3 w-3 mx-auto mt-0.5 text-yellow-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Final Submission Button */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Ready to Submit?
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {unansweredQuestions.length === 0 
                    ? 'All questions have been answered. You can now submit your test.'
                    : `${unansweredQuestions.length} question${unansweredQuestions.length !== 1 ? 's are' : ' is'} unanswered and will receive 0 marks.`
                  }
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPreSubmitReview(false)}
                >
                  Review More
                </Button>
                <Button
                  onClick={() => {
                    setShowPreSubmitReview(false);
                    setShowConfirmSubmit(true);
                  }}
                  disabled={isSubmitting}
                  className={unansweredQuestions.length > 0 ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {unansweredQuestions.length > 0 ? 'Submit Anyway' : 'Submit Test'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }
  
  // Submit confirmation dialog (final step after review)
  if (showConfirmSubmit) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Final Confirmation
            </h1>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-blue-500 mb-4" />
            <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Submit Your Test?
            </h2>
            <p className="text-blue-700 dark:text-blue-300 mb-6">
              Once submitted, you cannot make any changes. Are you sure you want to submit your test now?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="outline"
                onClick={() => {
                  setShowConfirmSubmit(false);
                  setShowPreSubmitReview(true); // Go back to review
                }}
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Review
              </Button>
              <Button 
                onClick={handleSubmitTest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Yes, Submit Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // No test data
  if (!test) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <button 
              onClick={() => router.push('/student/test')}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Tests
            </button>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Test Not Found
            </h1>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              Test Data Not Available
            </h2>
            <p className="text-yellow-700 dark:text-yellow-300 mb-6">
              Unable to load test data. Please return to the tests list and try again.
            </p>
            <Button 
              onClick={() => router.push('/student/test')}
            >
              Return to Tests
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Navigation panel
  const renderNavigationPanel = () => {
    if (!displayQuestions || displayQuestions.length === 0) return null;
    
    return (
      <div className={`fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity duration-200 
                      ${showNavPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-xl 
                        transition-transform duration-300 transform
                        ${showNavPanel ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Questions Navigator
              {isShuffled && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                  Shuffled
                </span>
              )}
            </h3>
            <button 
              onClick={() => setShowNavPanel(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <span className="sr-only">Close panel</span>
              <EyeOff className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4">
            <div className="mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Test progress:
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ 
                    width: `${Math.floor(
                      (Object.keys(answers).length / displayQuestions.length) * 100
                    )}%` 
                  }}
                ></div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {Object.keys(answers).length} of {displayQuestions.length} questions answered
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {displayQuestions.map((question, index) => {
                const isAnswered = !!answers[question.id];
                const isReviewed = answers[question.id]?.isMarkedForReview || false;
                const isCurrent = index === currentIndex;
                
                let bgColor = 'bg-gray-100 dark:bg-gray-700';
                
                if (isCurrent) {
                  bgColor = 'bg-blue-500 text-white';
                } else if (isReviewed) {
                  bgColor = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
                } else if (isAnswered) {
                  bgColor = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
                }
                
                return (
                  <button
                    key={question.id}
                    onClick={() => jumpToQuestion(index)}
                    className={`h-10 w-full flex items-center justify-center rounded-md
                              ${bgColor} font-medium text-sm transition-colors duration-150`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-6 space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Not answered</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Answered</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/30 rounded"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Marked for review</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Current question</span>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <Button 
              onClick={() => {
                setShowNavPanel(false);
                setShowConfirmSubmit(true);
              }}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Test
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Render current question (MCQ)
  const renderMCQ = (question: TestQuestion) => {
    const currentAnswer = answers[question.id];
    const selectedOption = currentAnswer?.selectedOption as number;
    
    return (
      <div className="space-y-6">
        {question.imageUrl && (
          <div className="mb-4">
            <div className="relative group">
              <img 
                src={question.imageUrl} 
                alt="Question" 
                className="max-w-full h-auto rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer hover:border-blue-400 transition-all duration-200" 
                onClick={() => openImageViewer(question.imageUrl!)}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                <div className="bg-white bg-opacity-90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                  <ZoomIn className="h-4 w-4" />
                  Click to enlarge
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="prose prose-blue dark:prose-invert max-w-none">
          <h2 className="text-xl font-semibold mb-6">{question.questionText}</h2>
          {question.content && <div dangerouslySetInnerHTML={{ __html: question.content }} />}
        </div>
        
        <div className="space-y-3 mt-6">
          {question.options?.map((option, index) => {
            // Handle both string options and object options
            const optionText = typeof option === 'string' ? option : (option as any)?.text || `Option ${index + 1}`;
            
            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(index)}
                className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                  selectedOption === index
                    ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500 shadow-sm'
                    : 'bg-white border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 h-5 w-5 rounded-full border-2 mt-0.5 ${
                    selectedOption === index 
                      ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400' 
                      : 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-700'
                  }`}>
                    {selectedOption === index && (
                      <CheckCircle className="text-white h-5 w-5" />
                    )}
                  </div>
                  <span className={`text-base leading-relaxed ${
                    selectedOption === index
                      ? 'text-blue-900 dark:text-blue-100 font-medium'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    <span className="font-semibold text-gray-700 dark:text-gray-300 mr-2">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {optionText}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render current question (Essay)
  const renderEssay = (question: TestQuestion) => {
    const currentAnswer = answers[question.id];
    const textContent = currentAnswer?.textContent || '';
    const pdfFiles = currentAnswer?.pdfFiles || [];
    
    // Handle PDF file upload
    const handlePdfUpload = (attachment: PdfAttachment) => {
      if (!student?.id) return;
      
      setAnswers(prev => ({
        ...prev,
        [question.id]: {
          ...prev[question.id],
          questionId: question.id,
          pdfFiles: [...(prev[question.id]?.pdfFiles || []), attachment],
          lastModified: Date.now(),
          timeSpent: prev[question.id]?.timeSpent || 0,
          isMarkedForReview: prev[question.id]?.isMarkedForReview || false,
          changeHistory: [
            ...(prev[question.id]?.changeHistory || []),
            {
              timestamp: Date.now(),
              type: 'pdf_upload',
              newValue: attachment.fileName,
              timeOnQuestion: 0, // TODO: Track time properly
              pdfInfo: {
                fileName: attachment.fileName,
                fileSize: attachment.fileSize
              }
            }
          ]
        }
      }));
      
      // Auto-save the answer with PDF
      saveAnswer({ textContent, pdfFiles: [...pdfFiles, attachment] });
    };
    
    // Handle PDF file removal
    const handlePdfRemove = (fileUrl: string) => {
      const updatedFiles = pdfFiles.filter(file => file.fileUrl !== fileUrl);
      
      setAnswers(prev => ({
        ...prev,
        [question.id]: {
          ...prev[question.id],
          questionId: question.id,
          pdfFiles: updatedFiles,
          lastModified: Date.now(),
          timeSpent: prev[question.id]?.timeSpent || 0,
          isMarkedForReview: prev[question.id]?.isMarkedForReview || false,
          changeHistory: [
            ...(prev[question.id]?.changeHistory || []),
            {
              timestamp: Date.now(),
              type: 'pdf_remove',
              previousValue: fileUrl,
              timeOnQuestion: 0, // TODO: Track time properly
            }
          ]
        }
      }));
      
      // Auto-save the answer without the removed PDF
      saveAnswer({ textContent, pdfFiles: updatedFiles });
    };
    
    return (
      <div className="space-y-6">
        {question.imageUrl && (
          <div className="mb-4">
            <div className="relative group">
              <img 
                src={question.imageUrl} 
                alt="Question" 
                className="max-w-full h-auto rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer hover:border-blue-400 transition-all duration-200" 
                onClick={() => openImageViewer(question.imageUrl!)}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                <div className="bg-white bg-opacity-90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                  <ZoomIn className="h-4 w-4" />
                  Click to enlarge
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="prose prose-blue dark:prose-invert max-w-none">
          <h2 className="text-xl font-semibold mb-6">{question.questionText}</h2>
          {question.content && <div dangerouslySetInnerHTML={{ __html: question.content }} />}
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Answer:
          </label>
          <TextArea
            value={textContent}
            onChange={(e) => {
              const newValue = e.target.value;
              setAnswers(prev => ({
                ...prev,
                [question.id]: {
                  ...prev[question.id],
                  textContent: newValue,
                  questionId: question.id,
                  lastModified: Date.now(),
                  timeSpent: prev[question.id]?.timeSpent || 0,
                  isMarkedForReview: prev[question.id]?.isMarkedForReview || false,
                  changeHistory: prev[question.id]?.changeHistory || []
                }
              }));
              handleEssayChange(newValue);
            }}
            placeholder="Type your answer here..."
            className="min-h-[250px]"
          />
        </div>
        
        {/* PDF Upload Section */}
        <div className="mt-6">
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Upload Supporting Documents (Optional)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You can upload PDF documents to support your written answer. This is useful for 
              diagrams, calculations, or handwritten work.
            </p>
            
            {student?.id && currentQuestion && (() => {
              // Get PDF files from both sources to ensure we have the most up-to-date list
              const pdfFilesFromState: PdfAttachment[] = (pdfFiles as any)[currentQuestion.id] || [];
              const pdfFilesFromAnswers: PdfAttachment[] = answers[currentQuestion.id]?.pdfFiles || [];
              
              // Merge and deduplicate based on fileUrl
              const allPdfFiles = [...pdfFilesFromState, ...pdfFilesFromAnswers];
              const uniquePdfFiles = allPdfFiles.filter((pdf, index, array) => 
                index === array.findIndex(p => p.fileUrl === pdf.fileUrl)
              );
              
              console.log('🔍 PDF Upload Component Debug:', {
                questionId: currentQuestion.id,
                pdfFilesFromState,
                pdfFilesFromAnswers,
                uniquePdfFiles,
                pdfFilesState: pdfFiles,
                answersForQuestion: answers[currentQuestion.id]
              });
              
              return (
                <PdfUploadComponent
                  questionId={currentQuestion.id}
                  attemptId={attemptId}
                  studentId={student.id}
                  existingFiles={uniquePdfFiles}
                  onFileUpload={handlePdfUpload}
                  onFileRemove={handlePdfRemove}
                  disabled={timeExpired}
                  maxFiles={3}
                />
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  // Main test taking interface
  return (
    <StudentLayout>
      {/* Grace period overlay - blocks test interaction, shows submit button */}
      {graceMode && !timeExpired && (
        <div className="fixed inset-0 z-[90] bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center border-4 border-red-500">
            <AlertTriangle className="mx-auto h-16 w-16 text-red-600 mb-4" />
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">
              Time Exceeded
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your test time has ended. Please submit your current work now.
            </p>
            <div className="bg-red-100 dark:bg-red-900/40 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600 dark:text-red-400 mb-1">Auto-submit in</p>
              <p className="text-4xl font-bold font-mono text-red-700 dark:text-red-300">
                {Math.floor(graceTimeRemaining / 60)}:{(graceTimeRemaining % 60).toString().padStart(2, '0')}
              </p>
            </div>
            <Button
              onClick={() => {
                setTimeExpired(true);
                handleAutoSubmit();
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-lg py-3"
            >
              Submit Test Now
            </Button>
          </div>
        </div>
      )}

      {/* Navigation panel overlay */}
      {renderNavigationPanel()}
      
      {/* Image Viewer Modal */}
      {showImageViewer && (
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex items-center justify-center">
          {/* Header with controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium">Question Image</h3>
              <div className="text-sm opacity-75">
                Zoom: {Math.round(imageScale * 100)}%
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImageZoom(-0.2)}
                disabled={imageScale <= 0.5}
                className="text-white border-white/30 hover:bg-white/10"
              >
                <Minus className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={resetImageView}
                className="text-white border-white/30 hover:bg-white/10 px-3"
              >
                Reset
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImageZoom(0.2)}
                disabled={imageScale >= 3}
                className="text-white border-white/30 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
              </Button>
              
              {/* Close button */}
              <Button
                variant="outline"
                size="sm"
                onClick={closeImageViewer}
                className="text-white border-white/30 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Instructions */}
          <div className="absolute bottom-4 left-4 right-4 text-center text-white/75 text-sm">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <span>Mouse wheel or +/- keys to zoom</span>
              <span>•</span>
              <span>Click and drag to pan when zoomed</span>
              <span>•</span>
              <span>Press 0 to reset view</span>
              <span>•</span>
              <span>ESC to close</span>
            </div>
          </div>
          
          {/* Image container */}
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleImageMouseDown}
            onMouseMove={handleImageMouseMove}
            onMouseUp={handleImageMouseUp}
            onMouseLeave={handleImageMouseUp}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeImageViewer();
              }
            }}
          >
            <img
              src={viewerImageUrl}
              alt="Question Image - Enlarged View"
              className="max-w-none pointer-events-none select-none"
              style={{
                transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Header with timer */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sticky top-0 z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {test.title}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Question {currentIndex + 1} of {displayQuestions.length || test?.questions.length || 0}
                {isShuffled && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                    Shuffled Order
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex items-center mt-4 md:mt-0">
              {/* NEW: Show deadline for untimed tests, timer for timed tests */}
              {(test as any).isUntimed ? (
                <div className="flex items-center p-2 rounded-md bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                  <Calendar className="h-5 w-5 mr-2" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">Due by:</span>
                    <span className="font-mono text-sm font-medium">
                      {new Date((test as any).availableTo?.seconds * 1000).toLocaleString('en-AU', {
                        timeZone: 'Australia/Melbourne',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ) : graceMode ? (
                <div className="flex items-center p-2 rounded-md bg-red-600 text-white animate-pulse">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  <span className="font-mono font-bold">TIME EXCEEDED</span>
                </div>
              ) : (
                <div className={`flex items-center p-2 rounded-md ${
                  remainingTime < 300
                    ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  <Clock className="h-5 w-5 mr-2" />
                  <span className="font-mono font-medium">{formatTime(remainingTime)}</span>
                </div>
              )}
              
              <button 
                onClick={() => setShowNavPanel(true)}
                className="ml-4 flex items-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                aria-label="Show navigation panel"
              >
                <List className="h-5 w-5" />
                <span className="ml-1 hidden sm:inline">Questions</span>
              </button>
              
              <button 
                onClick={requestFullscreen}
                className="ml-2 flex items-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                aria-label="Enter fullscreen"
                title="Enter fullscreen mode"
              >
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-4">
            <div 
              className="bg-blue-600 h-1 rounded-full transition-all duration-300" 
              style={{ width: `${((currentIndex + 1) / (displayQuestions.length || test?.questions.length || 1)) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* Question content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {/* Save status indicator */}
          {savedState && (
            <div className={`text-sm mb-4 flex items-center ${
              savedState === 'saving' 
                ? 'text-gray-500 dark:text-gray-400' 
                : savedState === 'saved'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
            }`}>
              {savedState === 'saving' && (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-gray-500 dark:border-gray-400 border-t-transparent rounded-full mr-2"></div>
                  <span>Saving your answer...</span>
                </>
              )}
              {savedState === 'saved' && (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  <span>Answer saved</span>
                </>
              )}
              {savedState === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span>Error saving answer</span>
                </>
              )}
            </div>
          )}
          
          {/* Current question */}
          {currentQuestion?.type === 'mcq' && renderMCQ(currentQuestion)}
          {currentQuestion?.type === 'essay' && renderEssay(currentQuestion)}
          
          {/* Review mark flag */}
          <div className="flex items-center justify-end mt-6 text-sm">
            <button
              onClick={toggleReviewMark}
              className={`flex items-center ${
                answers[currentQuestion?.id || '']?.isMarkedForReview
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Flag className="h-4 w-4 mr-1" />
              {answers[currentQuestion?.id || '']?.isMarkedForReview
                ? 'Remove review flag'
                : 'Mark for review'
              }
            </button>
          </div>
        </div>
        
        {/* Navigation buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
            <div className="flex space-x-4">
              <Button
                variant="outline"
                onClick={goToPrevQuestion}
                disabled={currentIndex === 0}
                className={currentIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              
              {/* Only show Next button if not on the last question */}
              {currentIndex < (displayQuestions.length || test?.questions.length || 1) - 1 && (
                <Button
                  variant="outline"
                  onClick={goToNextQuestion}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
            
            {/* Only show Submit button on the last question */}
            {currentIndex === (displayQuestions.length || test?.questions.length || 1) - 1 && (
              <Button
                onClick={() => setShowPreSubmitReview(true)}
                disabled={isSubmitting}
              >
                <Send className="w-4 h-4 mr-2" />
                Review & Submit
              </Button>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
