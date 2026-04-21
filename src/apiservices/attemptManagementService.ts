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

export interface AuthoritativeAttemptState extends TimeCalculation {
  authoritativeNowMs: number;
  clientNowMs: number;
  clockSkewMs: number;
  firestoreEndTimeMs?: number;
  rtdbTimeRemaining?: number | null;
  expirySource: 'resume' | 'reconnect' | 'timer' | 'background' | 'load' | 'submitted';
}

export class AttemptManagementService {
  private static COLLECTIONS = {
    ATTEMPTS: 'testAttempts',
    TESTS: 'tests'
  };

  private static REALTIME_PATHS = {
    ATTEMPTS: 'activeAttempts',
    HEARTBEATS: 'heartbeats'
  };

  private static AUTHORITATIVE_TIME_CACHE_MS = 60000;
  private static authoritativeTimeCache:
    | { fetchedAtMs: number; offsetMs: number }
    | null = null;

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

  private static timestampToMs(timestamp: any): number | null {
    if (!timestamp) return null;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === 'number') {
      const nanos = typeof timestamp.nanoseconds === 'number' ? timestamp.nanoseconds : 0;
      return (timestamp.seconds * 1000) + Math.floor(nanos / 1000000);
    }
    if (timestamp instanceof Date) return timestamp.getTime();
    if (typeof timestamp === 'number') return timestamp;
    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private static async getAuthoritativeTimeDetails(): Promise<{
    authoritativeNowMs: number;
    clientNowMs: number;
    clockSkewMs: number;
  }> {
    const clientNowMs = Date.now();

    if (typeof window === 'undefined') {
      return {
        authoritativeNowMs: clientNowMs,
        clientNowMs,
        clockSkewMs: 0
      };
    }

    const cached = this.authoritativeTimeCache;
    if (cached && (clientNowMs - cached.fetchedAtMs) < this.AUTHORITATIVE_TIME_CACHE_MS) {
      return {
        authoritativeNowMs: clientNowMs + cached.offsetMs,
        clientNowMs,
        clockSkewMs: cached.offsetMs
      };
    }

    try {
      const response = await fetch('/api/server-time', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Server time request failed: ${response.status}`);
      }

      const payload = await response.json() as { nowMs?: number };
      if (typeof payload.nowMs !== 'number') {
        throw new Error('Server time response missing nowMs');
      }

      const offsetMs = payload.nowMs - clientNowMs;
      this.authoritativeTimeCache = {
        fetchedAtMs: clientNowMs,
        offsetMs
      };

      return {
        authoritativeNowMs: clientNowMs + offsetMs,
        clientNowMs,
        clockSkewMs: offsetMs
      };
    } catch (error) {
      console.warn('⚠️ Falling back to client clock for authoritative time:', error);
      return {
        authoritativeNowMs: clientNowMs,
        clientNowMs,
        clockSkewMs: 0
      };
    }
  }

  private static async getEffectiveAttemptDeadlineMs(
    attempt: Partial<TestAttempt> & { lateSubmissionApprovalId?: string },
    test: Test
  ): Promise<number | null> {
    const attemptEndTimeMs = attempt.endTime ? this.timestampToMs(attempt.endTime) : null;

    if (test.type === 'flexible') {
      const flexTest = test as FlexibleTest;
      const testDeadlineMs = this.timestampToMs(flexTest.availableTo);
      if (attemptEndTimeMs !== null && testDeadlineMs !== null) {
        return Math.min(attemptEndTimeMs, testDeadlineMs);
      }
      return attemptEndTimeMs ?? testDeadlineMs;
    }

    if (test.type === 'live') {
      const liveTest = test as LiveTest;
      const liveEndTimeMs = this.timestampToMs(liveTest.actualEndTime);
      if (attemptEndTimeMs !== null && liveEndTimeMs !== null) {
        return Math.min(attemptEndTimeMs, liveEndTimeMs);
      }
      return attemptEndTimeMs ?? liveEndTimeMs;
    }

    return attemptEndTimeMs;
  }

  private static async repairRealtimeAttemptState(
    attemptId: string,
    attempt: TestAttemptWithShuffling,
    authoritativeState: AuthoritativeAttemptState
  ): Promise<void> {
    try {
      const db = getDatabase();
      const stateRef = ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`);
      const snapshot = await get(stateRef);
      const existingState = snapshot.exists() ? snapshot.val() as Partial<RealtimeAttemptState> : null;
      const isSubmitted = attempt.status === 'submitted' || attempt.status === 'auto_submitted';
      const shouldPreserveOfflineState = !isSubmitted && (
        existingState?.isOnline === false ||
        existingState?.status === 'paused' ||
        existingState?.disconnectedAt !== undefined
      );
      const expectedStatus = isSubmitted
        ? attempt.status
        : authoritativeState.isExpired
          ? 'expired'
          : (shouldPreserveOfflineState || attempt.status === 'paused' ? 'paused' : 'in_progress');

      const shouldRepair = !existingState ||
        typeof existingState.timeRemaining !== 'number' ||
        Math.abs((existingState.timeRemaining ?? 0) - authoritativeState.timeRemaining) > 5 ||
        (existingState.timeRemaining ?? 0) <= 0 && authoritativeState.timeRemaining > 0 ||
        existingState.status !== expectedStatus;

      if (!shouldRepair) {
        return;
      }

      const repairedState: Partial<RealtimeAttemptState> = {
        attemptId,
        testId: attempt.testId,
        studentId: attempt.studentId,
        status: expectedStatus,
        isActive: !authoritativeState.isExpired && !isSubmitted && !shouldPreserveOfflineState,
        lastHeartbeat: authoritativeState.authoritativeNowMs,
        sessionStartTime: existingState?.sessionStartTime || authoritativeState.authoritativeNowMs,
        totalTimeSpent: existingState?.totalTimeSpent ?? attempt.timeSpent ?? 0,
        timeRemaining: authoritativeState.timeRemaining,
        currentQuestionIndex: existingState?.currentQuestionIndex ?? attempt.currentQuestionIndex ?? 0,
        questionsVisited: existingState?.questionsVisited ?? [],
        isOnline: existingState?.isOnline ?? true,
        disconnectedAt: isSubmitted
          ? undefined
          : shouldPreserveOfflineState
            ? existingState?.disconnectedAt
            : authoritativeState.isExpired
            ? existingState?.disconnectedAt
            : undefined,
        connectionId: existingState?.connectionId || this.generateConnectionId(),
        userAgent: existingState?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
        tabId: existingState?.tabId || this.generateTabId(),
        windowId: existingState?.windowId || this.generateWindowId()
      };

      await update(stateRef, repairedState);
      console.log('🔧 Repaired realtime attempt state:', {
        attemptId,
        timeRemaining: authoritativeState.timeRemaining,
        expectedStatus,
        previousTimeRemaining: existingState?.timeRemaining ?? null
      });
    } catch (error) {
      console.warn('⚠️ Failed to repair realtime attempt state:', { attemptId, error });
    }
  }

  static async getAuthoritativeAttemptState(
    attemptId: string,
    source: AuthoritativeAttemptState['expirySource'] = 'load'
  ): Promise<AuthoritativeAttemptState> {
    const timeDetails = await this.getAuthoritativeTimeDetails();
    const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));

    if (!attemptDoc.exists()) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptDoc.data() as TestAttemptWithShuffling;
    const test = await this.getTest(attempt.testId);
    if (!test) {
      throw new Error('Test not found');
    }

    const stateSnapshot = await get(ref(getDatabase(), `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`));
    const realtimeState = stateSnapshot.exists() ? stateSnapshot.val() as Partial<RealtimeAttemptState> : null;
    const rtdbTimeRemaining = typeof realtimeState?.timeRemaining === 'number'
      ? realtimeState.timeRemaining
      : null;

    const firestoreEndTimeMs = await this.getEffectiveAttemptDeadlineMs(attempt, test);
    const isSubmitted = attempt.status === 'submitted' || attempt.status === 'auto_submitted';

    let timeRemaining = 0;
    let expirySource: AuthoritativeAttemptState['expirySource'] = source;

    if (!isSubmitted && firestoreEndTimeMs !== null) {
      timeRemaining = Math.max(0, Math.floor((firestoreEndTimeMs - timeDetails.authoritativeNowMs) / 1000));
    } else if (isSubmitted) {
      expirySource = 'submitted';
    }

    if (!isSubmitted && test.type === 'flexible' && (test as FlexibleTest).isUntimed) {
      expirySource = timeRemaining <= 0 ? source : source;
    }

    const authoritativeState: AuthoritativeAttemptState = {
      totalTimeAllowed: attempt.totalTimeAllowed || 0,
      timeSpent: attempt.timeSpent || 0,
      timeRemaining,
      offlineTime: 0,
      isExpired: isSubmitted ? true : timeRemaining <= 0,
      canContinue: !isSubmitted && timeRemaining > 0,
      timeUntilExpiry: timeRemaining,
      authoritativeNowMs: timeDetails.authoritativeNowMs,
      clientNowMs: timeDetails.clientNowMs,
      clockSkewMs: timeDetails.clockSkewMs,
      firestoreEndTimeMs: firestoreEndTimeMs ?? undefined,
      rtdbTimeRemaining,
      expirySource
    };

    await this.repairRealtimeAttemptState(attemptId, attempt, authoritativeState);

    console.log('🧭 Authoritative attempt state:', {
      attemptId,
      source,
      authoritativeNowMs: authoritativeState.authoritativeNowMs,
      clientNowMs: authoritativeState.clientNowMs,
      clockSkewMs: authoritativeState.clockSkewMs,
      firestoreEndTimeMs: authoritativeState.firestoreEndTimeMs,
      rtdbTimeRemaining: authoritativeState.rtdbTimeRemaining,
      timeRemaining: authoritativeState.timeRemaining,
      isExpired: authoritativeState.isExpired
    });

    return authoritativeState;
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

      if (!this.canStudentAccessTest(test, studentId)) {
        throw new Error('You do not have access to this retake');
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
      
      // NEW: Check if this is an untimed test
      const isUntimed = test.type === 'flexible' && (test as any).isUntimed === true;
      
      // Calculate time allowed
      let timeAllowed = isUntimed 
        ? Number.MAX_SAFE_INTEGER // Essentially infinite time per session for untimed tests
        : this.getTestDuration(test) * 60; // Convert to seconds for timed tests
      
      const timeDetails = await this.getAuthoritativeTimeDetails();
      const startTime = Timestamp.fromMillis(timeDetails.authoritativeNowMs);
      
      // 🆕 FLEXIBLE TEST FIX: For timed flexible tests, cap duration by deadline
      // If student starts at 11:55 with 30-min test, but deadline is 12:00,
      // they should only get 5 minutes, not 30!
      // 🆕 LATE SUBMISSION FIX: Check for late submission approval and use new deadline
      let lateSubmissionApprovalId: string | undefined;
      
      let effectiveDeadline = test.type === 'flexible' ? (test as any).availableTo : undefined;
      if (test.type === 'flexible' && (test as any).availableTo) {
        
        // Check for late submission approval with extended deadline
        try {
          const { LateSubmissionService } = await import('./lateSubmissionService');
          const lateApproval = await LateSubmissionService.checkLateSubmissionApproval(testId, studentId);
          
          if (lateApproval && lateApproval.status === 'approved') {
            // Use the late submission's new deadline instead
            effectiveDeadline = lateApproval.newDeadline;
            lateSubmissionApprovalId = lateApproval.id; // Store the approval ID
            console.log('🕒 Using late submission deadline:', {
              originalDeadline: (test as any).availableTo.seconds,
              newDeadline: lateApproval.newDeadline.seconds,
              approvalId: lateApproval.id
            });
          }
        } catch (error) {
          console.warn('⚠️ Could not check late submission approval:', error);
        }
        
        const deadlineSeconds = effectiveDeadline.seconds || (effectiveDeadline.toMillis ? effectiveDeadline.toMillis() / 1000 : 0);
        const nowSeconds = startTime.seconds;
        const timeUntilDeadline = Math.max(0, deadlineSeconds - nowSeconds);
        
        // Use whichever is LESS: test duration OR time until deadline
        if (timeUntilDeadline < timeAllowed) {
          console.log(`⏰ Capping test duration: ${timeAllowed}s requested, but only ${timeUntilDeadline}s until deadline`);
          
          // ⚠️ WARNING: Check if there's enough time to reasonably take the test
          const MIN_TIME_REQUIRED = 60; // At least 1 minute
          if (timeUntilDeadline < MIN_TIME_REQUIRED) {
            console.warn(`⚠️ Student attempting to start test with only ${timeUntilDeadline}s remaining (< 1 minute)`);
            // Allow but log warning - teacher may want to extend deadline
          }
          
          timeAllowed = timeUntilDeadline;
        }
      }
      
      // For untimed tests, endTime is the test deadline, not duration-based
      const endTime = isUntimed && test.type === 'flexible'
        ? effectiveDeadline
        : new Timestamp(startTime.seconds + timeAllowed, startTime.nanoseconds);

      console.log(`⏱️ Test type: ${isUntimed ? 'UNTIMED' : 'TIMED'}, timeAllowed: ${timeAllowed}`);

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
        
        // Late submission tracking
        lateSubmissionApprovalId,
        
        // NEW: Untimed test tracking
        isUntimedTest: isUntimed,
        totalTimeSpentAcrossSessions: isUntimed ? 0 : undefined,
        sessionHistory: isUntimed ? [] : undefined,
        
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
        createdAt: Timestamp.fromMillis(timeDetails.authoritativeNowMs),
        updatedAt: Timestamp.fromMillis(timeDetails.authoritativeNowMs)
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
      const timeDetails = await this.getAuthoritativeTimeDetails();
      const now = timeDetails.authoritativeNowMs;

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
        lastActiveAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now)
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
      const timeDetails = await this.getAuthoritativeTimeDetails();
      const now = timeDetails.authoritativeNowMs;

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
          console.log('⚠️ Attempt already completed, returning expired state');
          return {
            totalTimeAllowed: attempt.totalTimeAllowed || 0,
            timeSpent: attempt.timeSpent || 0,
            timeRemaining: 0,
            offlineTime: 0,
            isExpired: true,
            canContinue: false,
            timeUntilExpiry: 0
          };
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
      
      // Get attempt from Firestore to check if untimed
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
      if (!attemptDoc.exists()) {
        throw new Error('Attempt not found in Firestore');
      }
      const attempt = attemptDoc.data() as any;
      
      const authoritativeState = await this.getAuthoritativeAttemptState(attemptId, 'timer');

      // NEW: Handle untimed tests differently
      if (attempt.isUntimedTest === true) {
        // Calculate session time for tracking purposes only
        let sessionTime = 0;
        if (state.isOnline && state.sessionStartTime) {
          sessionTime = Math.floor((timeDetails.authoritativeNowMs - state.sessionStartTime) / 1000);
        }
        
        // Update cumulative time spent
        const currentTotalTimeSpent = attempt.totalTimeSpentAcrossSessions || 0;
        const newTotalTimeSpent = currentTotalTimeSpent + sessionTime;
        
        // Update states
        const updates: any = {
          totalTimeSpent: newTotalTimeSpent,
          timeRemaining: authoritativeState.timeRemaining,
          lastHeartbeat: timeDetails.authoritativeNowMs
        };
        
        if (state.isOnline) {
          updates.sessionStartTime = timeDetails.authoritativeNowMs; // Reset for next calculation
        }
        
        await update(stateRef, updates);
        
        // Periodic Firestore update (improved reliability)
        const lastFirestoreUpdate = (state as any).lastFirestoreUpdate || 0;
        const timeSinceLastFirestoreUpdate = timeDetails.authoritativeNowMs - lastFirestoreUpdate;
        const FIRESTORE_UPDATE_INTERVAL = 30000; // 30 seconds
        
        if (timeSinceLastFirestoreUpdate >= FIRESTORE_UPDATE_INTERVAL) {
          await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
            totalTimeSpentAcrossSessions: newTotalTimeSpent,
            timeSpent: newTotalTimeSpent,
            lastActiveAt: Timestamp.fromMillis(timeDetails.authoritativeNowMs),
            updatedAt: Timestamp.fromMillis(timeDetails.authoritativeNowMs)
          });
          
          // Track when we updated Firestore
          await update(stateRef, { lastFirestoreUpdate: timeDetails.authoritativeNowMs });
        }
        
        const timeCalc: TimeCalculation = {
          totalTimeAllowed: Number.MAX_SAFE_INTEGER,
          timeSpent: newTotalTimeSpent,
          timeRemaining: authoritativeState.timeRemaining,
          offlineTime: 0,
          isExpired: authoritativeState.isExpired,
          canContinue: authoritativeState.canContinue,
          timeUntilExpiry: authoritativeState.timeUntilExpiry
        };
        
        // ⚠️ IMPORTANT: Only mark as expired if student is OFFLINE
        // If online, return isExpired = true and let CLIENT handle auto-submit
        if (authoritativeState.isExpired && !state.isOnline) {
          console.log('⏰ Untimed test deadline expired (student offline) - marking for background auto-submit');
          await this.markAttemptAsExpired(attemptId);
        } else if (authoritativeState.isExpired && state.isOnline) {
          console.log('⏰ Untimed test deadline expired (student online) - letting client handle auto-submit');
        }
        
        return timeCalc;
      }
      
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
      const newTimeRemaining = authoritativeState.timeRemaining;
      const isExpired = authoritativeState.isExpired;
      
      // Only mark as expired, DON'T auto-submit here
      // Let the client-side timer or background job handle actual submission
      if (isExpired && !state.isOnline) {
        console.log('⏰ Test expired while student was offline, marking for background processing');
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

      // Update Firestore periodically (improved reliability)
      // Use lastHeartbeat to track when we last updated Firestore
      const lastFirestoreUpdate = (state as any).lastFirestoreUpdate || 0;
      const timeSinceLastFirestoreUpdate = now - lastFirestoreUpdate;
      const FIRESTORE_UPDATE_INTERVAL = 30000; // 30 seconds
      
      if (timeSinceLastFirestoreUpdate >= FIRESTORE_UPDATE_INTERVAL) {
        await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
          timeSpent: newTotalTimeSpent,
          timeRemaining: newTimeRemaining,
          lastActiveAt: Timestamp.fromMillis(timeDetails.authoritativeNowMs),
          updatedAt: Timestamp.fromMillis(timeDetails.authoritativeNowMs)
        });
        
        // Track when we updated Firestore
        await update(stateRef, { lastFirestoreUpdate: now });
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

      console.log('⏱️ Authoritative timed update:', {
        attemptId,
        authoritativeNowMs: timeDetails.authoritativeNowMs,
        clientNowMs: timeDetails.clientNowMs,
        clockSkewMs: timeDetails.clockSkewMs,
        firestoreEndTimeMs: authoritativeState.firestoreEndTimeMs,
        rtdbTimeRemaining: authoritativeState.rtdbTimeRemaining,
        timeSpent: newTotalTimeSpent,
        timeRemaining: newTimeRemaining,
        isExpired
      });

      return timeCalc;
    } catch (error) {
      console.error('Error updating attempt time:', error);
      throw error;
    }
  }

  // Mark attempt as expired and trigger auto-submission
  // NOTE: This should ONLY be called when student is OFFLINE or by background job
  // Do NOT call this when student is actively online - let client-side timer handle it
  static async markAttemptAsExpired(attemptId: string): Promise<void> {
    try {
      const db = getDatabase();
      const { authoritativeNowMs } = await this.getAuthoritativeTimeDetails();
      
      // Update real-time state to mark as expired
      await update(ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`), {
        status: 'expired',
        timeRemaining: 0,
        isExpired: true,
        expiredAt: authoritativeNowMs
      });
      
      // ⚠️ IMPORTANT: Do NOT change Firestore status here!
      // Only mark timeRemaining = 0 so background job can detect and auto-submit
      // The actual status change to 'auto_submitted' happens in:
      // - BackgroundSubmissionService.autoSubmitExpiredAttempt() for offline students
      // - Client-side handleAutoSubmit() for online students
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        timeRemaining: 0,
        updatedAt: Timestamp.fromMillis(authoritativeNowMs)
      });
      
      console.log('⏰ Attempt marked as expired (timeRemaining = 0)');
    } catch (error) {
      console.error('Error marking attempt as expired:', error);
    }
  }

  // Handle offline/online scenarios
  static async handleDisconnection(attemptId: string): Promise<void> {
    try {
      const db = getDatabase();
      const { authoritativeNowMs } = await this.getAuthoritativeTimeDetails();
      const now = authoritativeNowMs;

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
      const authoritativeState = await this.getAuthoritativeAttemptState(attemptId, 'reconnect');
      const now = authoritativeState.authoritativeNowMs;

      // Get current state
      const stateRef = ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`);
      const snapshot = await get(stateRef);
      
      if (!snapshot.exists()) {
        throw new Error('Attempt state not found');
      }

      const state = snapshot.val() as RealtimeAttemptState;
      
      // Calculate offline time (time student was disconnected)
      const offlineTime = state.disconnectedAt ? Math.floor((now - state.disconnectedAt) / 1000) : 0;
      
      // Get attempt and test data to check actual deadline
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
      if (!attemptDoc.exists()) {
        throw new Error('Attempt not found in Firestore');
      }
      
      const attemptData = attemptDoc.data() as TestAttempt;
      
      // Check if already submitted
      if (attemptData.status === 'submitted' || attemptData.status === 'auto_submitted') {
        console.log('✅ Test already submitted - cannot continue');
        return {
          totalTimeAllowed: attemptData.totalTimeAllowed || 0,
          timeSpent: attemptData.timeSpent || 0,
          timeRemaining: 0,
          offlineTime: offlineTime,
          isExpired: true,
          canContinue: false,
          timeUntilExpiry: 0
        };
      }
      
      const actualTimeRemaining = authoritativeState.timeRemaining;
      const isExpired = authoritativeState.isExpired;
      
      if (isExpired) {
        console.log('⏰ Test expired (authoritative timing) during disconnection', {
          attemptId,
          authoritativeNowMs: authoritativeState.authoritativeNowMs,
          clientNowMs: authoritativeState.clientNowMs,
          clockSkewMs: authoritativeState.clockSkewMs,
          firestoreEndTimeMs: authoritativeState.firestoreEndTimeMs,
          rtdbTimeRemaining: authoritativeState.rtdbTimeRemaining
        });
        console.log('🔄 Returning isExpired=true - client will handle auto-submit');
        
        // DON'T auto-submit here - return expired state and let client handle it
        // This prevents auto-submit on reconnection and allows proper client-side handling
        return {
          totalTimeAllowed: attemptData.totalTimeAllowed || 0,
          timeSpent: state.totalTimeSpent ?? 0,
          timeRemaining: 0,
          offlineTime: offlineTime,
          isExpired: true,
          canContinue: false,
          timeUntilExpiry: 0
        };
      }
      
      // Update state for reconnection with corrected time
      await update(stateRef, {
        isOnline: true,
        disconnectedAt: null,
        status: 'in_progress',
        sessionStartTime: now,
        lastHeartbeat: now,
        timeRemaining: actualTimeRemaining  // Update with deadline-aware time
      });

      // Log reconnect event
      await this.logConnectionEvent(attemptId, 'connect', offlineTime, {
        reason: 'Reconnected',
        offlineTime: offlineTime,
        timeRemainingRestored: actualTimeRemaining
      });

      console.log('🔌 Reconnected successfully. Offline time:', offlineTime, 'seconds');
      console.log('🔌 Time remaining (authoritative):', actualTimeRemaining, 'seconds', {
        attemptId,
        authoritativeNowMs: authoritativeState.authoritativeNowMs,
        clientNowMs: authoritativeState.clientNowMs,
        clockSkewMs: authoritativeState.clockSkewMs,
        firestoreEndTimeMs: authoritativeState.firestoreEndTimeMs,
        rtdbTimeRemaining: authoritativeState.rtdbTimeRemaining
      });
      
      return {
        totalTimeAllowed: attemptData.totalTimeAllowed || 0,
        timeSpent: state.totalTimeSpent ?? 0,
        timeRemaining: actualTimeRemaining,
        offlineTime: offlineTime,
        isExpired: false,
        canContinue: true,
        timeUntilExpiry: actualTimeRemaining
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
      const { authoritativeNowMs } = await this.getAuthoritativeTimeDetails();
      const now = authoritativeNowMs;

      // ✅ CRITICAL: Check if already submitted to prevent duplicates
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
      if (attemptDoc.exists()) {
        const attemptData = attemptDoc.data() as TestAttempt;
        if (attemptData.status === 'submitted' || attemptData.status === 'auto_submitted') {
          console.log('⚠️ Attempt already submitted, skipping duplicate submission');
          return; // Already submitted, don't submit again
        }
      }

      // Update final time (only if not already expired)
      try {
        await this.updateAttemptTime(attemptId);
      } catch (timeError) {
        console.warn('⚠️ Could not update final time:', timeError);
        // Continue with submission anyway
      }

      // Update Firestore
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        status: isAutoSubmitted ? 'auto_submitted' : 'submitted',
        submittedAt: Timestamp.fromMillis(now),
        lastActiveAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now)
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

  // NEW: Pause untimed test session (when student closes browser/navigates away)
  static async pauseUntimedSession(attemptId: string): Promise<void> {
    try {
      console.log('⏸️ Pausing untimed test session:', attemptId);
      
      const db = getDatabase();
      const { authoritativeNowMs } = await this.getAuthoritativeTimeDetails();
      const now = authoritativeNowMs;
      
      // Get current state
      const stateRef = ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`);
      const snapshot = await get(stateRef);
      
      if (!snapshot.exists()) {
        console.warn('⚠️ Attempt state not found, skipping pause');
        return;
      }
      
      const state = snapshot.val() as RealtimeAttemptState;
      
      // Calculate time spent in this session
      const sessionStart = state.sessionStartTime || now;
      const sessionTime = Math.floor((now - sessionStart) / 1000);
      
      // Get attempt from Firestore
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId));
      if (!attemptDoc.exists()) {
        console.warn('⚠️ Attempt not found in Firestore');
        return;
      }
      
      const attempt = attemptDoc.data() as any;
      
      // Create session record
      const newSession = {
        sessionId: `session_${Date.now()}`,
        startTime: Timestamp.fromMillis(sessionStart),
        endTime: Timestamp.fromMillis(now),
        timeSpent: sessionTime,
        isPaused: true
      };
      
      // Update Firestore with session info
      const sessionHistory = attempt.sessionHistory || [];
      const totalTimeSpent = (attempt.totalTimeSpentAcrossSessions || 0) + sessionTime;
      
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        status: 'paused',
        totalTimeSpentAcrossSessions: totalTimeSpent,
        sessionHistory: [...sessionHistory, newSession],
        lastActiveAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now)
      });
      
      // Update realtime state
      await update(stateRef, {
        status: 'paused',
        isOnline: false,
        disconnectedAt: now
      });
      
      console.log('✅ Untimed session paused. Time spent in session:', sessionTime, 'seconds');
    } catch (error) {
      console.error('Error pausing untimed session:', error);
    }
  }

  // NEW: Resume untimed test session
  static async resumeUntimedSession(attemptId: string): Promise<void> {
    try {
      console.log('▶️ Resuming untimed test session:', attemptId);
      
      const db = getDatabase();
      const { authoritativeNowMs } = await this.getAuthoritativeTimeDetails();
      const now = authoritativeNowMs;
      
      // Update realtime state
      const stateRef = ref(db, `${this.REALTIME_PATHS.ATTEMPTS}/${attemptId}`);
      await update(stateRef, {
        status: 'in_progress',
        sessionStartTime: now,
        isOnline: true,
        disconnectedAt: null,
        lastHeartbeat: now
      });
      
      // Update Firestore
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        status: 'in_progress',
        lastActiveAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now)
      });
      
      console.log('✅ Untimed session resumed');
    } catch (error) {
      console.error('Error resuming untimed session:', error);
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
      // For late submissions: exclude attempts that were marked as expired but NOT yet submitted
      // (timeRemaining=0 with status still 'in_progress'). These are zombie attempts that should
      // be ignored when checking if student can create a new attempt.
      const now = Timestamp.now();
      
      // Also check test deadline for flexible tests
      let testDeadlineSeconds = 0;
      if (test.type === 'flexible' && (test as any).availableTo) {
        const availableTo = (test as any).availableTo;
        if (typeof availableTo.seconds === 'number') {
          testDeadlineSeconds = availableTo.seconds;
        } else if (availableTo.toMillis) {
          testDeadlineSeconds = availableTo.toMillis() / 1000;
        } else if ((availableTo as any)._seconds) {
          testDeadlineSeconds = (availableTo as any)._seconds;
        }
        console.log('🗓️ Test deadline check:', { testDeadlineSeconds, nowSeconds: now.seconds, isPastDeadline: now.seconds > testDeadlineSeconds });
      }
      
      const validAttempts = attempts.filter(attempt => {
        // Always include fully submitted attempts (these count as real attempts)
        if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
          return true;
        }
        
        // For in-progress/paused/not_started attempts:
        // Exclude if expired (based on multiple criteria)
        if (attempt.status === 'in_progress' || attempt.status === 'paused' || attempt.status === 'not_started') {
          console.log('🔍 Checking if attempt is expired:', {
            id: attempt.id,
            status: attempt.status,
            timeRemaining: attempt.timeRemaining,
            endTime: attempt.endTime,
            startedAt: attempt.startedAt,
            totalTimeAllowed: attempt.totalTimeAllowed,
            nowSeconds: now.seconds
          });
          
          // Check 0: TEST DEADLINE has passed (most important for flexible tests!)
          // If the test deadline has passed, any incomplete attempt is expired
          if (testDeadlineSeconds > 0 && now.seconds > testDeadlineSeconds) {
            console.log('🔍 Excluding expired attempt (TEST DEADLINE passed):', attempt.id, 'testDeadline:', testDeadlineSeconds, 'now:', now.seconds);
            return false;
          }
          
          // Check 1: timeRemaining explicitly set to 0 or less
          if (attempt.timeRemaining !== undefined && attempt.timeRemaining <= 0) {
            console.log('🔍 Excluding expired attempt (timeRemaining<=0):', attempt.id);
            return false;
          }
          
          // Check 2: endTime has passed
          if (attempt.endTime) {
            // Handle both Timestamp objects and plain objects with seconds
            let endTimeSeconds = 0;
            if (typeof attempt.endTime.seconds === 'number') {
              endTimeSeconds = attempt.endTime.seconds;
            } else if (attempt.endTime.toMillis) {
              endTimeSeconds = attempt.endTime.toMillis() / 1000;
            } else if ((attempt.endTime as any)._seconds) {
              // Firestore serialized timestamp format
              endTimeSeconds = (attempt.endTime as any)._seconds;
            }
            
            if (endTimeSeconds > 0 && now.seconds > endTimeSeconds) {
              console.log('🔍 Excluding expired attempt (endTime passed):', attempt.id, 'endTime:', endTimeSeconds, 'now:', now.seconds);
              return false;
            }
          }
          
          // Check 3: startedAt + totalTimeAllowed has passed
          if (attempt.startedAt && attempt.totalTimeAllowed) {
            let startSeconds = 0;
            if (typeof attempt.startedAt.seconds === 'number') {
              startSeconds = attempt.startedAt.seconds;
            } else if (attempt.startedAt.toMillis) {
              startSeconds = attempt.startedAt.toMillis() / 1000;
            } else if ((attempt.startedAt as any)._seconds) {
              // Firestore serialized timestamp format
              startSeconds = (attempt.startedAt as any)._seconds;
            }
            
            if (startSeconds > 0) {
              const calculatedEndTime = startSeconds + attempt.totalTimeAllowed;
              if (now.seconds > calculatedEndTime) {
                console.log('🔍 Excluding expired attempt (calculated end time passed):', attempt.id, 'calculatedEnd:', calculatedEndTime, 'now:', now.seconds);
                return false;
              }
            }
          }
          
          // Attempt is still valid (not expired)
          console.log('✅ Attempt is still valid:', attempt.id);
          return true;
        }
        
        // Include all other statuses
        return true;
      });
      
      const totalAttempts = validAttempts.length;
      const canCreateNewAttempt = totalAttempts < attemptsAllowed && await this.isTestAvailable(test, studentId);
      const bestScore = validAttempts.reduce((max, attempt) => 
        Math.max(max, attempt.percentage || 0), 0
      );

      const summary: AttemptSummary = {
        testId,
        studentId,
        totalAttempts,
        attemptsAllowed,
        canCreateNewAttempt,
        bestScore: bestScore > 0 ? bestScore : undefined,
        lastAttemptStatus: validAttempts[0]?.status,
        lastAttemptDate: validAttempts[0]?.submittedAt || validAttempts[0]?.createdAt,
        attempts: validAttempts.map(attempt => ({
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
        attempts = snapshot.docs
          .map(doc => doc.data() as TestAttempt)
          // Skip attempts marked as expired (timeRemaining = 0)
          .filter(attempt => attempt.timeRemaining === undefined || attempt.timeRemaining > 0);
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
          .filter(attempt => 
            ['not_started', 'in_progress', 'paused'].includes(attempt.status) &&
            // Skip attempts marked as expired (timeRemaining = 0)
            (attempt.timeRemaining === undefined || attempt.timeRemaining > 0)
          )
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

  private static canStudentAccessTest(test: Test, studentId?: string): boolean {
    if (test.isRetest !== true) {
      return true;
    }

    return !!studentId && Array.isArray(test.allowedStudentIds) && test.allowedStudentIds.includes(studentId);
  }

  private static async isTestAvailable(test: Test, studentId?: string): Promise<boolean> {
    const now = Timestamp.now();
    
    console.log('🔍 Checking test availability:', {
      testId: test.id,
      testType: test.type,
      studentId,
      currentTime: now.seconds
    });

    if (!this.canStudentAccessTest(test, studentId)) {
      console.log('❌ Student is not allowed to access this retake');
      return false;
    }
    
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
