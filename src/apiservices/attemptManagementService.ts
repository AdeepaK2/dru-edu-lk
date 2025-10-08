// Comprehensive attempt management service
// Handles attempt creation, tracking, time management, and offline/online scenarios

import { 
  collection, 
  doc, 
  setDoc,
  getDoc, 
  getDocs,
  updateDoc,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { 
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  onDisconnect,
  serverTimestamp
} from 'firebase/database';
import { firestore } from '@/utils/firebase-client';
import { 
  TestAttempt, 
  TestAttemptStatus, 
  AttemptSummary, 
  RealtimeAttemptState,
  ConnectionEvent,
  TimeCalculation,
  TestAttemptWithShuffling,
  QuestionOrderMapping
} from '@/models/attemptSchema';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';
import { QuestionShuffleService } from './questionShuffleService';

export class AttemptManagementService {
  private static COLLECTIONS = {
    ATTEMPTS: 'testAttempts',
    TESTS: 'tests'
  };

  private static REALTIME_PATHS = {
    ATTEMPTS: 'activeAttempts',
    HEARTBEATS: 'heartbeats'
  };

  // Helper function to remove undefined values recursively
  private static removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    // Preserve Firestore Timestamp objects
    if (obj && typeof obj.toDate === 'function') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  // Create a new test attempt
  static async createAttempt(
    testId: string, 
    studentId: string, 
    studentName: string, 
    classId: string,
    className?: string
  ): Promise<string> {
    try {
      console.log('🆕 Creating new attempt for test:', testId, 'student:', studentId);

      // Validate required fields
      if (!testId || !studentId || !studentName) {
        throw new Error('Missing required fields for attempt creation');
      }
      
      // Ensure classId is not undefined or empty
      const validClassId = classId && classId.trim() !== '' ? classId : 'unknown-class';
      const validClassName = className && className.trim() !== '' ? className : 'Unknown Class';
      
      if (validClassId === 'unknown-class') {
        console.warn('⚠️ Using fallback classId for attempt creation');
      }

      // Get test data
      const test = await this.getTest(testId);
      if (!test) {
        throw new Error('Test not found');
      }

      // Get attempt summary to check limits and get next attempt number
      const summary = await this.getAttemptSummary(testId, studentId);
      
      console.log('🔍 Attempt summary:', {
        canCreateNewAttempt: summary.canCreateNewAttempt,
        totalAttempts: summary.totalAttempts,
        attemptsAllowed: summary.attemptsAllowed,
        testId,
        studentId
      });
      
      if (!summary.canCreateNewAttempt) {
        throw new Error('Cannot create new attempt - limit reached or test not available');
      }

      // Generate attempt ID
      const attemptId = this.generateAttemptId();
      
      // Calculate time allowed
      const timeAllowed = this.getTestDuration(test) * 60; // Convert to seconds
      const startTime = Timestamp.now();
      const endTime = new Timestamp(startTime.seconds + timeAllowed, startTime.nanoseconds);

      // Handle question shuffling if enabled
      let questionOrderMapping: QuestionOrderMapping[] | undefined;
      let isShuffled = false;
      let shuffledQuestionIds: string[] | undefined;
      
      if (QuestionShuffleService.shouldShuffleQuestions(test)) {
        console.log('🔀 Generating shuffled question order for attempt:', attemptId);
        
        const shuffleResult = QuestionShuffleService.generateShuffledOrder(
          test.questions,
          attemptId
        );
        
        questionOrderMapping = shuffleResult.questionOrderMapping;
        shuffledQuestionIds = shuffleResult.shuffledQuestionIds;
        isShuffled = true;
        
        console.log('✅ Question shuffling completed:', {
          totalQuestions: test.questions.length,
          isShuffled,
          mappingCount: questionOrderMapping.length
        });
      } else {
        console.log('📝 No question shuffling for attempt:', attemptId);
      }

      // Create attempt record with validated data and shuffling support
      const attempt: TestAttemptWithShuffling = {
        id: attemptId,
        testId: testId,
        testTitle: test.title || 'Untitled Test',
        studentId: studentId,
        studentName: studentName || 'Anonymous Student',
        classId: validClassId,
        className: validClassName,
        attemptNumber: summary.totalAttempts + 1,
        status: 'not_started',
        
        // Timing
        startedAt: startTime,
        endTime: endTime,
        lastActiveAt: startTime,
        
        // Time management
        totalTimeAllowed: timeAllowed,
        timeSpent: 0,
        timeRemaining: timeAllowed,
        
        // Session tracking
        sessionStartTime: 0, // Will be set when actually started
        lastHeartbeat: 0,
        offlineTime: 0,
        
        // Question shuffling (new fields)
        questionOrderMapping,
        isShuffled,
        shuffledQuestionIds,
        
        // Progress
        questionsAttempted: 0,
        questionsCompleted: 0,
        currentQuestionIndex: 0,
        
        // Tracking
        connectionEvents: [],
        suspiciousActivityCount: 0,
        
        // Results
        maxScore: test.totalMarks,
        
        // Metadata
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Clean the attempt object to remove any undefined values
      const cleanAttempt = this.removeUndefinedValues(attempt);

      // Save to Firestore
      await setDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), cleanAttempt);
      
      console.log('✅ Attempt created successfully:', attemptId);
      return attemptId;
    } catch (error) {
      console.error('Error creating attempt:', error);
      throw error;
    }
  }

  // Start an attempt (begin the actual test)
  static async startAttempt(attemptId: string): Promise<void> {
    try {
      console.log('▶️ Starting attempt:', attemptId);

      const db = getDatabase();
      const now = Date.now();

      // Get attempt from Firestore
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
      if (!attemptDoc.exists()) {
        throw new Error('Attempt not found');
      }

      const attempt = attemptDoc.data() as TestAttempt;

      // Update attempt status in Firestore
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        status: 'in_progress',
        sessionStartTime: now,
        lastActiveAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Create real-time state
      const realtimeState: RealtimeAttemptState = {
        attemptId,
        testId: attempt.testId,
        studentId: attempt.studentId,
        status: 'in_progress',
        isActive: true,
        lastHeartbeat: now,
        sessionStartTime: now,
        totalTimeSpent: 0,
        timeRemaining: attempt.totalTimeAllowed,
        currentQuestionIndex: 0,
        questionsVisited: [],
        isOnline: true,
        connectionId: this.generateConnectionId(),
        userAgent: navigator.userAgent,
        tabId: this.generateTabId(),
        windowId: this.generateWindowId()
      };

      // Save to Realtime DB
      await set(ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`), realtimeState);

      // Set up disconnect handler
      const disconnectRef = ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}/isOnline`);
      onDisconnect(disconnectRef).set(false);

      // Log connection event
      await this.logConnectionEvent(attemptId, 'connect', 0, {
        userAgent: navigator.userAgent,
        location: window.location.href
      });

      console.log('✅ Attempt started successfully');
    } catch (error) {
      console.error('Error starting attempt:', error);
      throw error;
    }
  }

  // Update attempt time (called periodically) - Enhanced for disconnection handling
  static async updateAttemptTime(attemptId: string): Promise<TimeCalculation> {
    try {
      const db = getDatabase();
      const now = Date.now();

      // Get current real-time state
      const stateRef = ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`);
      const snapshot = await get(stateRef);
      
      if (!snapshot.exists()) {
        // If realtime state doesn't exist, try to reinitialize from Firestore attempt
        console.warn(`⚠️ Realtime state not found for attempt ${attemptId}, attempting to reinitialize...`);
        
        // Get attempt from Firestore
        const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
        if (!attemptDoc.exists()) {
          throw new Error('Attempt not found in Firestore');
        }
        
        const attempt = attemptDoc.data() as TestAttempt;
        
        // Check if attempt is still valid (not expired)
        if (attempt.status === 'submitted' || attempt.status === 'auto_submitted' || 
            attempt.status === 'abandoned' || attempt.status === 'terminated') {
          throw new Error('Attempt has already been completed or terminated');
        }
        
        // Try to restart the attempt in realtime DB
        await this.startAttempt(attemptId);
        
        // Retry getting the state
        const retrySnapshot = await get(stateRef);
        if (!retrySnapshot.exists()) {
          throw new Error('Failed to reinitialize attempt state');
        }
        
        console.log('✅ Successfully reinitialized realtime state for attempt:', attemptId);
      }

      // Get the state (either from original snapshot or retry snapshot)
      const finalSnapshot = snapshot.exists() ? snapshot : await get(stateRef);
      const state = finalSnapshot.val() as RealtimeAttemptState;
      
      // Calculate time spent in current session (only if online)
      let sessionTime = 0;
      if (state.isOnline && state.sessionStartTime) {
        sessionTime = Math.floor((now - state.sessionStartTime) / 1000);
      }
      
      // If the student was offline, don't count that time
      let offlineTime = 0;
      if (state.disconnectedAt && !state.isOnline) {
        offlineTime = Math.floor((now - state.disconnectedAt) / 1000);
        console.log('📴 Student has been offline for:', offlineTime, 'seconds');
      }
      
      // Calculate new totals (only count online time)
      // Ensure totalTimeSpent is never null or undefined
      const currentTotalTimeSpent = state.totalTimeSpent ?? 0;
      const newTotalTimeSpent = currentTotalTimeSpent + sessionTime;
      const newTimeRemaining = Math.max(0, (state.timeRemaining ?? 0) - sessionTime);
      
      // Check if attempt should be marked as expired
      const isExpired = newTimeRemaining <= 0;
      
      // If expired and student is offline, auto-submit
      if (isExpired && !state.isOnline) {
        console.log('⏰ Test expired while student was offline, marking for auto-submit');
        await this.markAttemptAsExpired(attemptId);
      }

      // Update real-time state
      const updates: any = {
        totalTimeSpent: newTotalTimeSpent,
        timeRemaining: newTimeRemaining,
        lastHeartbeat: now
      };
      
      // Only update session start time if online
      if (state.isOnline) {
        updates.sessionStartTime = now; // Reset session start for next calculation
      }
      
      await update(stateRef, updates);

      // Update Firestore periodically (every 30 seconds)
      if (now % 30000 < 1000) { // Rough check for 30-second intervals
        await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
          timeSpent: newTotalTimeSpent,
          timeRemaining: newTimeRemaining,
          lastActiveAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      const timeCalc: TimeCalculation = {
        totalTimeAllowed: (state.timeRemaining ?? 0) + newTotalTimeSpent,
        timeSpent: newTotalTimeSpent,
        timeRemaining: newTimeRemaining,
        offlineTime: offlineTime,
        isExpired: isExpired,
        canContinue: !isExpired,
        timeUntilExpiry: newTimeRemaining
      };

      return timeCalc;
    } catch (error) {
      console.error('Error updating attempt time:', error);
      throw error;
    }
  }

  // Mark attempt as expired and trigger auto-submission
  static async markAttemptAsExpired(attemptId: string): Promise<void> {
    try {
      const db = getDatabase();
      
      // Update real-time state to mark as expired
      await update(ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`), {
        status: 'expired',
        timeRemaining: 0,
        isExpired: true,
        expiredAt: Date.now()
      });
      
      // Update Firestore attempt record
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        status: 'auto_submitted',
        timeRemaining: 0,
        submittedAt: Timestamp.now(),
        isAutoSubmitted: true
      });
      
      console.log('⏰ Attempt marked as expired:', attemptId);
    } catch (error) {
      console.error('Error marking attempt as expired:', error);
    }
  }

  // Handle offline/online scenarios
  static async handleDisconnection(attemptId: string): Promise<void> {
    try {
      const db = getDatabase();
      const now = Date.now();

      // Update real-time state
      await update(ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`), {
        isOnline: false,
        disconnectedAt: now,
        status: 'paused'
      });

      // Log disconnect event
      await this.logConnectionEvent(attemptId, 'disconnect', 0, {
        reason: 'Connection lost',
        location: window.location.href
      });

      console.log('📴 Attempt marked as disconnected:', attemptId);
    } catch (error) {
      console.error('Error handling disconnection:', error);
    }
  }

  static async handleReconnection(attemptId: string): Promise<TimeCalculation> {
    try {
      const db = getDatabase();
      const now = Date.now();

      // Get current state
      const stateRef = ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`);
      const snapshot = await get(stateRef);
      
      if (!snapshot.exists()) {
        throw new Error('Attempt state not found');
      }

      const state = snapshot.val() as RealtimeAttemptState;
      
      // Calculate offline time (time student was disconnected)
      const offlineTime = state.disconnectedAt ? Math.floor((now - state.disconnectedAt) / 1000) : 0;
      
      // The time remaining should be the same as when they disconnected
      // (we don't subtract offline time from remaining time)
      const currentTimeRemaining = state.timeRemaining ?? 0;
      const currentTotalTimeSpent = state.totalTimeSpent ?? 0;
      
      // Check if test has expired based on absolute time
      const isExpired = currentTimeRemaining <= 0;
      
      if (isExpired) {
        console.log('⏰ Test expired while student was offline');
        await this.markAttemptAsExpired(attemptId);
        
        return {
          totalTimeAllowed: currentTotalTimeSpent + currentTimeRemaining,
          timeSpent: currentTotalTimeSpent,
          timeRemaining: 0,
          offlineTime: offlineTime,
          isExpired: true,
          canContinue: false,
          timeUntilExpiry: 0
        };
      }
      
      // Update state for reconnection
      await update(stateRef, {
        isOnline: true,
        disconnectedAt: null,
        status: 'in_progress',
        sessionStartTime: now,
        lastHeartbeat: now
      });

      // Log reconnect event
      await this.logConnectionEvent(attemptId, 'connect', offlineTime, {
        reason: 'Reconnected',
        offlineTime: offlineTime
      });

      console.log('🔌 Reconnected successfully. Offline time:', offlineTime, 'seconds');
      console.log('🔌 Time remaining:', currentTimeRemaining, 'seconds');
      
      return {
        totalTimeAllowed: currentTotalTimeSpent + currentTimeRemaining,
        timeSpent: currentTotalTimeSpent,
        timeRemaining: currentTimeRemaining,
        offlineTime: offlineTime,
        isExpired: false,
        canContinue: true,
        timeUntilExpiry: currentTimeRemaining
      };
    } catch (error) {
      console.error('Error handling reconnection:', error);
      throw error;
    }
  }

  // Submit attempt
  static async submitAttempt(
    attemptId: string,
    isAutoSubmitted: boolean = false
  ): Promise<void> {
    try {
      console.log('📤 Submitting attempt:', attemptId);

      const db = getDatabase();
      const now = Date.now();

      // Update final time
      await this.updateAttemptTime(attemptId);

      // Update Firestore
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        status: isAutoSubmitted ? 'auto_submitted' : 'submitted',
        submittedAt: Timestamp.now(),
        lastActiveAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Update real-time state
      await update(ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`), {
        status: isAutoSubmitted ? 'auto_submitted' : 'submitted',
        isActive: false,
        lastHeartbeat: now
      });

      console.log('✅ Attempt submitted successfully');
    } catch (error) {
      console.error('Error submitting attempt:', error);
      throw error;
    }
  }

  // Get shuffled questions for an attempt
  static async getQuestionsForAttempt(attemptId: string): Promise<{
    questions: any[];
    isShuffled: boolean;
    questionOrderMapping?: QuestionOrderMapping[];
  }> {
    try {
      console.log('📋 Getting questions for attempt:', attemptId);

      // Get attempt record
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
      if (!attemptDoc.exists()) {
        throw new Error('Attempt not found');
      }

      const attempt = attemptDoc.data() as TestAttemptWithShuffling;
      
      // Get test data
      const test = await this.getTest(attempt.testId);
      if (!test) {
        throw new Error('Test not found');
      }

      // Check if this attempt has shuffled questions
      if (attempt.isShuffled && attempt.questionOrderMapping) {
        console.log('🔀 Returning shuffled questions for attempt');
        
        // Return questions in shuffled order
        const shuffledQuestions = QuestionShuffleService.getShuffledQuestions(
          test.questions,
          attempt.questionOrderMapping
        );
        
        return {
          questions: shuffledQuestions,
          isShuffled: true,
          questionOrderMapping: attempt.questionOrderMapping
        };
      } else {
        console.log('📝 Returning original question order');
        
        // Return original questions
        return {
          questions: test.questions,
          isShuffled: false
        };
      }
    } catch (error) {
      console.error('Error getting questions for attempt:', error);
      throw error;
    }
  }

  // Get questions in original order for results display
  static async getOriginalOrderQuestionsForAttempt(attemptId: string): Promise<any[]> {
    try {
      // Get attempt record
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
      if (!attemptDoc.exists()) {
        throw new Error('Attempt not found');
      }

      const attempt = attemptDoc.data() as TestAttemptWithShuffling;
      
      // Get test data
      const test = await this.getTest(attempt.testId);
      if (!test) {
        throw new Error('Test not found');
      }

      // If shuffled, return in original order
      if (attempt.isShuffled && attempt.questionOrderMapping) {
        return QuestionShuffleService.getOriginalOrderQuestions(
          test.questions,
          attempt.questionOrderMapping
        );
      }
      
      // Otherwise return as-is
      return test.questions;
    } catch (error) {
      console.error('Error getting original order questions:', error);
      throw error;
    }
  }

  // Get attempt summary for a student and test
  static async getAttemptSummary(testId: string, studentId: string): Promise<AttemptSummary> {
    try {
      // Get test to check attempt limits
      const test = await this.getTest(testId);
      if (!test) {
        throw new Error('Test not found');
      }

      const attemptsAllowed = this.getAttemptsAllowed(test);

      let attempts: TestAttempt[] = [];
      
      try {
        // Try to get all attempts for this student and test with compound index
        const attemptsQuery = query(
          collection(firestore, this.COLLECTIONS.ATTEMPTS),
          where('testId', '==', testId),
          where('studentId', '==', studentId),
          orderBy('attemptNumber', 'desc')
        );

        const snapshot = await getDocs(attemptsQuery);
        attempts = snapshot.docs.map(doc => doc.data() as TestAttempt);
      } catch (indexError) {
        console.warn('Compound index not available, falling back to simple query:', indexError);
        
        // Fallback: Query by testId and studentId without orderBy
        const fallbackQuery = query(
          collection(firestore, this.COLLECTIONS.ATTEMPTS),
          where('testId', '==', testId),
          where('studentId', '==', studentId)
        );
        
        const fallbackSnapshot = await getDocs(fallbackQuery);
        attempts = fallbackSnapshot.docs
          .map(doc => doc.data() as TestAttempt)
          .sort((a, b) => b.attemptNumber - a.attemptNumber); // Sort in memory
      }

      // Calculate summary
      const totalAttempts = attempts.length;
      const canCreateNewAttempt = totalAttempts < attemptsAllowed && await this.isTestAvailable(test, studentId);
      const bestScore = attempts.reduce((max, attempt) => 
        Math.max(max, attempt.percentage || 0), 0
      );

      const summary: AttemptSummary = {
        testId,
        studentId,
        totalAttempts,
        attemptsAllowed,
        canCreateNewAttempt,
        bestScore: bestScore > 0 ? bestScore : undefined,
        lastAttemptStatus: attempts[0]?.status,
        lastAttemptDate: attempts[0]?.submittedAt || attempts[0]?.createdAt,
        attempts: attempts.map(attempt => ({
          attemptNumber: attempt.attemptNumber,
          attemptId: attempt.id,
          status: attempt.status,
          score: attempt.score,
          percentage: attempt.percentage,
          submittedAt: attempt.submittedAt
        }))
      };

      return summary;
    } catch (error) {
      console.error('Error getting attempt summary:', error);
      throw error;
    }
  }

  // Get current active attempt for a student
  static async getActiveAttempt(testId: string, studentId: string): Promise<TestAttempt | null> {
    try {
      let attempts: TestAttempt[] = [];
      
      try {
        // Try compound query first
        const attemptsQuery = query(
          collection(firestore, this.COLLECTIONS.ATTEMPTS),
          where('testId', '==', testId),
          where('studentId', '==', studentId),
          where('status', 'in', ['not_started', 'in_progress', 'paused']),
          orderBy('createdAt', 'desc'),
          limit(1)
        );

        const snapshot = await getDocs(attemptsQuery);
        attempts = snapshot.docs.map(doc => doc.data() as TestAttempt);
      } catch (indexError) {
        console.warn('Compound index not available for active attempt query, using fallback');
        
        // Fallback: Get all attempts and filter in memory
        const fallbackQuery = query(
          collection(firestore, this.COLLECTIONS.ATTEMPTS),
          where('testId', '==', testId),
          where('studentId', '==', studentId)
        );
        
        const fallbackSnapshot = await getDocs(fallbackQuery);
        attempts = fallbackSnapshot.docs
          .map(doc => doc.data() as TestAttempt)
          .filter(attempt => ['not_started', 'in_progress', 'paused'].includes(attempt.status))
          .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
          .slice(0, 1);
      }
      
      return attempts.length > 0 ? attempts[0] : null;
    } catch (error) {
      console.error('Error getting active attempt:', error);
      return null;
    }
  }

  // Utility methods
  private static async getTest(testId: string): Promise<Test | null> {
    try {
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, testId));
      return testDoc.exists() ? { id: testDoc.id, ...testDoc.data() } as Test : null;
    } catch (error) {
      console.error('Error getting test:', error);
      return null;
    }
  }

  private static getAttemptsAllowed(test: Test): number {
    return test.type === 'flexible' ? (test as FlexibleTest).attemptsAllowed || 1 : 1;
  }

  private static getTestDuration(test: Test): number {
    return test.type === 'live' 
      ? (test as LiveTest).duration 
      : (test as FlexibleTest).duration || 90;
  }

  private static async isTestAvailable(test: Test, studentId?: string): Promise<boolean> {
    const now = Timestamp.now();
    
    console.log('🔍 Checking test availability:', {
      testId: test.id,
      testType: test.type,
      studentId,
      currentTime: now.seconds
    });
    
    // Check normal test availability first
    let normallyAvailable = false;
    if (test.type === 'live') {
      const liveTest = test as LiveTest;
      normallyAvailable = now.seconds >= liveTest.studentJoinTime.seconds && 
                         now.seconds <= liveTest.actualEndTime.seconds;
      console.log('🔍 Live test availability check:', {
        joinTime: liveTest.studentJoinTime.seconds,
        endTime: liveTest.actualEndTime.seconds,
        normallyAvailable
      });
    } else {
      const flexTest = test as FlexibleTest;
      normallyAvailable = now.seconds >= flexTest.availableFrom.seconds && 
                         now.seconds <= flexTest.availableTo.seconds;
      console.log('🔍 Flexible test availability check:', {
        fromTime: flexTest.availableFrom.seconds,
        toTime: flexTest.availableTo.seconds,
        normallyAvailable
      });
    }
    
    // If normally available, return true
    if (normallyAvailable) {
      console.log('✅ Test is normally available');
      return true;
    }
    
    // If not normally available but studentId is provided, check for late submission approval
    if (studentId) {
      console.log('🔍 Test not normally available, checking late submission approval...');
      try {
        const { LateSubmissionService } = await import('./lateSubmissionService');
        const lateSubmissionApproval = await LateSubmissionService.checkLateSubmissionApproval(test.id, studentId);
        
        if (lateSubmissionApproval && lateSubmissionApproval.status === 'approved') {
          // Check if we're within the late submission deadline
          const lateDeadlineAvailable = now.seconds <= lateSubmissionApproval.newDeadline.seconds;
          console.log('🕐 Late submission check:', {
            hasApproval: !!lateSubmissionApproval,
            approvalStatus: lateSubmissionApproval.status,
            currentTime: now.seconds,
            lateDeadline: lateSubmissionApproval.newDeadline.seconds,
            isWithinLateDeadline: lateDeadlineAvailable
          });
          return lateDeadlineAvailable;
        } else {
          console.log('❌ No valid late submission approval found');
        }
      } catch (error) {
        console.error('Error checking late submission approval:', error);
      }
    } else {
      console.log('⚠️ No studentId provided for late submission check');
    }
    
    console.log('❌ Test is not available');
    return false;
  }

  private static async logConnectionEvent(
    attemptId: string, 
    type: 'connect' | 'disconnect' | 'heartbeat',
    duration: number = 0,
    metadata?: any
  ): Promise<void> {
    try {
      const event: ConnectionEvent = {
        timestamp: Date.now(),
        type,
        duration,
        metadata
      };

      // Add to Firestore attempt record
      const attemptRef = doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (attemptDoc.exists()) {
        const attempt = attemptDoc.data() as TestAttempt;
        const updatedEvents = [...(attempt.connectionEvents || []), event];
        
        await updateDoc(attemptRef, {
          connectionEvents: updatedEvents,
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error logging connection event:', error);
    }
  }

  private static generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private static generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private static generateWindowId(): string {
    return `win_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}
