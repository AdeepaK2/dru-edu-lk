// Late Submission Attempt Management Service
// Handles attempt creation specifically for teacher-approved late submissions
// Bypasses normal time restrictions and attempt limits

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
  TimeCalculation
} from '@/models/attemptSchema';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';
import { AttemptManagementService } from './attemptManagementService';

// Define late submission attempt interface
export interface LateSubmissionAttempt extends TestAttempt {
  isLateSubmission: true;
  lateSubmissionId: string;
  approvedBy: string;
  approvedAt: Timestamp;
  originalTestEndTime: Timestamp;
  lateSubmissionDeadline: Timestamp;
}

export class LateSubmissionAttemptService {
  private static COLLECTIONS = {
    LATE_ATTEMPTS: 'lateSubmissionAttempts',
    ATTEMPTS: 'testAttempts',
    TESTS: 'tests',
    LATE_SUBMISSIONS: 'lateSubmissionApprovals'
  };

  private static REALTIME_PATHS = {
    LATE_ATTEMPTS: 'activeLateAttempts',
    HEARTBEATS: 'heartbeats'
  };

  // Create a new late submission attempt
  static async createLateSubmissionAttempt(
    testId: string, 
    studentId: string, 
    studentName: string, 
    classId: string,
    lateSubmissionId: string,
    className?: string
  ): Promise<string> {
    try {
      console.log('🆕 Creating late submission attempt for test:', testId, 'student:', studentId);

      // Validate required fields
      if (!testId || !studentId || !studentName || !lateSubmissionId) {
        throw new Error('Missing required fields for late submission attempt creation');
      }
      
      // Verify late submission approval exists and is approved
      const lateSubmissionDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.LATE_SUBMISSIONS, lateSubmissionId)
      );
      
      if (!lateSubmissionDoc.exists()) {
        throw new Error('Late submission approval not found');
      }
      
      const lateSubmission = lateSubmissionDoc.data();
      if (lateSubmission.status !== 'approved') {
        throw new Error('Late submission not approved');
      }
      
      // Check if deadline has passed
      const now = Timestamp.now();
      if (now.seconds > lateSubmission.newDeadline.seconds) {
        throw new Error('Late submission deadline has passed');
      }
      
      // Ensure classId is not undefined or empty
      const validClassId = classId && classId.trim() !== '' ? classId : 'unknown-class';
      const validClassName = className && className.trim() !== '' ? className : 'Unknown Class';
      
      if (validClassId === 'unknown-class') {
        console.warn('⚠️ Using fallback classId for late submission attempt creation');
      }

      // Get test data
      const test = await this.getTest(testId);
      if (!test) {
        throw new Error('Test not found');
      }

      // Get existing attempts count for this student (including regular attempts)
      const existingAttempts = await this.getStudentAttempts(testId, studentId);
      const totalAttempts = existingAttempts.length;
      
      // Generate attempt ID
      const attemptId = this.generateAttemptId();
      
      // Calculate time allowed (use original test duration)
      const timeAllowed = this.getTestDuration(test) * 60; // Convert to seconds
      const startTime = Timestamp.now();
      const endTime = new Timestamp(startTime.seconds + timeAllowed, startTime.nanoseconds);

      // Create late submission attempt record
      const attempt: LateSubmissionAttempt = {
        id: attemptId,
        testId: testId,
        testTitle: test.title || 'Untitled Test',
        studentId: studentId,
        studentName: studentName || 'Anonymous Student',
        classId: validClassId,
        className: validClassName,
        attemptNumber: totalAttempts + 1,
        status: 'not_started',
        
        // Timing
        startedAt: startTime,
        endTime: endTime,
        lastActiveAt: startTime,
        createdAt: startTime,
        updatedAt: startTime,
        
        // Time management
        totalTimeAllowed: timeAllowed,
        timeSpent: 0,
        timeRemaining: timeAllowed,
        
        // Session tracking
        sessionStartTime: 0, // Will be set when actually started
        lastHeartbeat: 0,
        offlineTime: 0,
        
        // Progress
        questionsAttempted: 0,
        questionsCompleted: 0,
        currentQuestionIndex: 0,
        
        // Connection tracking
        connectionEvents: [],
        suspiciousActivityCount: 0,
        
        // Late submission specific fields
        isLateSubmission: true,
        lateSubmissionId: lateSubmissionId,
        approvedBy: lateSubmission.approvedBy,
        approvedAt: lateSubmission.approvedAt,
        originalTestEndTime: test.type === 'flexible' 
          ? (test as FlexibleTest).availableTo 
          : (test as LiveTest).actualEndTime,
        lateSubmissionDeadline: lateSubmission.newDeadline
      };

      // Remove undefined values
      const cleanedAttempt = this.removeUndefinedValues(attempt);

      // Save to both regular attempts collection (for compatibility) and late submissions collection
      await setDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), cleanedAttempt);
      await setDoc(doc(firestore, this.COLLECTIONS.LATE_ATTEMPTS, attemptId), cleanedAttempt);

      console.log('✅ Late submission attempt created successfully:', attemptId);
      return attemptId;
    } catch (error) {
      console.error('❌ Error creating late submission attempt:', error);
      throw error;
    }
  }

  // Start a late submission attempt (similar to regular attempts but in realtime DB)
  static async startLateSubmissionAttempt(attemptId: string): Promise<void> {
    try {
      console.log('🚀 Starting late submission attempt:', attemptId);

      // Get attempt record
      const attemptDoc = await getDoc(doc(firestore, this.COLLECTIONS.LATE_ATTEMPTS, attemptId));
      if (!attemptDoc.exists()) {
        throw new Error('Late submission attempt not found');
      }

      const attempt = attemptDoc.data() as LateSubmissionAttempt;
      
      // Verify it's still within the late submission deadline
      const now = Timestamp.now();
      if (now.seconds > attempt.lateSubmissionDeadline.seconds) {
        throw new Error('Late submission deadline has passed');
      }

      if (attempt.status !== 'not_started') {
        throw new Error('Attempt has already been started');
      }

      const db = getDatabase();
      const startTime = Date.now();

      // Update Firestore record
      await updateDoc(doc(firestore, this.COLLECTIONS.LATE_ATTEMPTS, attemptId), {
        status: 'in_progress',
        sessionStartTime: startTime,
        lastActiveAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Also update the regular attempts collection for compatibility
      await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
        status: 'in_progress',
        sessionStartTime: startTime,
        lastActiveAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Create real-time state (use separate path for late submissions)
      const realtimeState: RealtimeAttemptState = {
        attemptId,
        testId: attempt.testId,
        studentId: attempt.studentId,
        status: 'in_progress',
        isActive: true,
        lastHeartbeat: startTime,
        sessionStartTime: startTime,
        totalTimeSpent: 0,
        timeRemaining: attempt.totalTimeAllowed,
        currentQuestionIndex: 0,
        questionsVisited: [],
        isOnline: true,
        connectionId: this.generateConnectionId(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        tabId: this.generateTabId(),
        windowId: this.generateWindowId()
      };

      // Save to Realtime DB under late attempts path
      await set(ref(db, `${this.REALTIME_PATHS.LATE_ATTEMPTS}/${attemptId}`), realtimeState);

      // Set up disconnect handler
      const disconnectRef = ref(db, `${this.REALTIME_PATHS.LATE_ATTEMPTS}/${attemptId}/isOnline`);
      onDisconnect(disconnectRef).set(false);

      // Log connection event
      await this.logConnectionEvent(attemptId, 'connect', 0, {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        location: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        isLateSubmission: true
      });

      console.log('✅ Late submission attempt started successfully');
    } catch (error) {
      console.error('❌ Error starting late submission attempt:', error);
      throw error;
    }
  }

  // Check if student can create a late submission attempt
  static async canCreateLateSubmissionAttempt(
    testId: string, 
    studentId: string, 
    lateSubmissionId: string
  ): Promise<{ canCreate: boolean; reason?: string }> {
    try {
      // Check if late submission approval exists and is approved
      const lateSubmissionDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.LATE_SUBMISSIONS, lateSubmissionId)
      );
      
      if (!lateSubmissionDoc.exists()) {
        return { canCreate: false, reason: 'Late submission approval not found' };
      }
      
      const lateSubmission = lateSubmissionDoc.data();
      if (lateSubmission.status !== 'approved') {
        return { canCreate: false, reason: 'Late submission not approved' };
      }
      
      // Check if deadline has passed
      const now = Timestamp.now();
      if (now.seconds > lateSubmission.newDeadline.seconds) {
        return { canCreate: false, reason: 'Late submission deadline has passed' };
      }
      
      // Check if student already has a late submission attempt for this test
      const existingLateAttemptQuery = query(
        collection(firestore, this.COLLECTIONS.LATE_ATTEMPTS),
        where('testId', '==', testId),
        where('studentId', '==', studentId),
        where('lateSubmissionId', '==', lateSubmissionId)
      );
      
      const existingLateAttempts = await getDocs(existingLateAttemptQuery);
      if (!existingLateAttempts.empty) {
        return { canCreate: false, reason: 'Late submission attempt already exists' };
      }
      
      return { canCreate: true };
    } catch (error) {
      console.error('Error checking late submission attempt eligibility:', error);
      return { canCreate: false, reason: 'Error checking eligibility' };
    }
  }

  // Get all attempts for a student (including late submissions)
  private static async getStudentAttempts(testId: string, studentId: string): Promise<TestAttempt[]> {
    try {
      const attemptsQuery = query(
        collection(firestore, this.COLLECTIONS.ATTEMPTS),
        where('testId', '==', testId),
        where('studentId', '==', studentId)
      );
      
      const snapshot = await getDocs(attemptsQuery);
      return snapshot.docs.map(doc => doc.data() as TestAttempt);
    } catch (error) {
      console.error('Error getting student attempts:', error);
      return [];
    }
  }

  // Helper methods (reuse from AttemptManagementService)
  private static async getTest(testId: string): Promise<Test | null> {
    try {
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, testId));
      return testDoc.exists() ? testDoc.data() as Test : null;
    } catch (error) {
      console.error('Error getting test:', error);
      return null;
    }
  }

  private static getTestDuration(test: Test): number {
    return test.duration || 60; // Default 60 minutes
  }

  private static generateAttemptId(): string {
    return `late_attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private static generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private static generateWindowId(): string {
    return `win_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

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

      // Add to Firestore attempt record (both collections)
      const attemptRef = doc(firestore, this.COLLECTIONS.LATE_ATTEMPTS, attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (attemptDoc.exists()) {
        const attempt = attemptDoc.data() as LateSubmissionAttempt;
        const updatedEvents = [...(attempt.connectionEvents || []), event];
        
        await updateDoc(attemptRef, {
          connectionEvents: updatedEvents,
          updatedAt: Timestamp.now()
        });

        // Also update regular attempts collection
        await updateDoc(doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId), {
          connectionEvents: updatedEvents,
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error logging connection event for late submission:', error);
    }
  }
}
