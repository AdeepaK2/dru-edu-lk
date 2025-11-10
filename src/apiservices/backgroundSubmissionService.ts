// Background Submission Service
// Handles automatic submission of expired attempts when students are offline

import firebaseAdmin from '@/utils/firebase-server';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';
import { TestAttempt } from '@/models/attemptSchema';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';
import { RealtimeTestService } from './realtimeTestService';
import { SubmissionService } from './submissionService';

export class BackgroundSubmissionService {
  
  // 🛡️ Feature flags for safety
  private static ENABLE_EXTENSION_AWARENESS = process.env.ENABLE_EXTENSION_AWARENESS !== 'false'; // Default: enabled
  // REMOVED: ENABLE_ENHANCED_ACTIVITY_CHECK - no longer doing inactivity-based auto-submit
  
  /**
   * Find and auto-submit all expired attempts
   * This should be called periodically by a background service
   */
  static async processExpiredAttempts(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      console.log('🔍 Checking for expired attempts...');
      
      // Find all active attempts (in_progress, not_started) using admin SDK
      const attemptsQuery = await firebaseAdmin.db
        .collection('testAttempts')  // ✅ Use correct collection name
        .where('status', 'in', ['in_progress', 'not_started'])
        .orderBy('startedAt', 'desc')
        .limit(100) // Process in batches
        .get();

      const activeAttempts = attemptsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestAttempt[];

      console.log(`📊 Found ${activeAttempts.length} active attempts to check`);

      // Check each attempt for expiration
      for (const attempt of activeAttempts) {
        try {
          results.processed++;
          
          const isExpired = await this.checkIfAttemptExpired(attempt);
          
          if (isExpired) {
            console.log(`⏰ Found expired attempt: ${attempt.id}`);
            await this.autoSubmitExpiredAttempt(attempt);
            results.successful++;
            console.log(`✅ Successfully auto-submitted expired attempt: ${attempt.id}`);
          }
          
        } catch (error) {
          results.failed++;
          const errorMsg = `Failed to process attempt ${attempt.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`📈 Background submission complete: ${results.successful} successful, ${results.failed} failed`);
      return results;

    } catch (error) {
      console.error('❌ Error in background submission process:', error);
      results.errors.push(`Background process error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return results;
    }
  }

  /**
   * Check if a specific attempt has expired based on test type and timing
   * 
   * NEW APPROACH: Use SERVER-SIDE timeRemaining from Realtime DB
   * This is the authoritative source of truth that continues counting even when:
   * - Chromebook tabs are suspended
   * - Students switch tabs/apps
   * - Network drops temporarily
   * 
   * Students are auto-submitted when:
   * 1. Server-calculated timeRemaining <= 0 (duration expired)
   * 2. Test deadline has passed (flexible tests - availableTo)
   * 3. Test end time reached (live tests - actualEndTime)
   * 
   * NOT submitted based on inactivity (no lastActiveAt check)
   */
  private static async checkIfAttemptExpired(attempt: TestAttempt): Promise<boolean> {
    try {
      // 🚨 Check if test was recently extended - be cautious
      if (this.ENABLE_EXTENSION_AWARENESS && ((attempt as any).testExtendedAt || (attempt as any).requiresTestDataRefresh)) {
        const extensionTime = (attempt as any).testExtendedAt;
        if (extensionTime) {
          const extendedAtMs = extensionTime.toMillis ? extensionTime.toMillis() : extensionTime.seconds * 1000;
          const timeSinceExtension = Date.now() - extendedAtMs;
          const tenMinutesInMs = 10 * 60 * 1000; // Be extra cautious for 10 minutes after extension
          
          if (timeSinceExtension < tenMinutesInMs) {
            console.log(`🔄 Attempt ${attempt.id} was affected by recent test extension (${Math.round(timeSinceExtension/1000)}s ago), not auto-submitting`);
            return false;
          }
        }
      }

      // ✅ PRIMARY CHECK: Get server-side timeRemaining from Realtime DB
      // This is calculated by attemptManagementService.updateAttemptTime()
      // and continues counting even when tabs are suspended
      try {
        const { getDatabase } = await import('firebase-admin/database');
        const rtdb = getDatabase();
        // FIX: Use correct path 'activeAttempts' not 'testAttempts'
        const attemptRef = rtdb.ref(`activeAttempts/${attempt.id}`);
        const attemptSnapshot = await attemptRef.once('value');
        
        if (attemptSnapshot.exists()) {
          const realtimeState = attemptSnapshot.val();
          const timeRemaining = realtimeState.timeRemaining;
          
          // Check if time has expired based on SERVER calculation
          if (typeof timeRemaining === 'number' && timeRemaining <= 0) {
            console.log(`⏰ Attempt ${attempt.id} time expired (server-side timeRemaining: ${timeRemaining})`);
            return true;
          }
          
          // If time remaining > 0, student still has time - check other conditions
          if (typeof timeRemaining === 'number' && timeRemaining > 0) {
            console.log(`⏱️ Attempt ${attempt.id} still has time (${Math.round(timeRemaining)}s remaining)`);
            // Continue to check deadline/end time below
          }
        }
      } catch (rtError) {
        console.warn(`⚠️ Could not check Realtime DB timeRemaining for attempt ${attempt.id}:`, rtError);
        // Continue to test-level checks below
      }

      // Get the test data using admin SDK for deadline/end-time checks
      const testDoc = await firebaseAdmin.db.collection('tests').doc(attempt.testId).get();
      
      if (!testDoc.exists) {
        console.warn(`Test not found for attempt: ${attempt.id}`);
        return false;
      }

      const test = { id: testDoc.id, ...testDoc.data() } as Test;
      const now = Date.now();

      if (test.type === 'flexible') {
        return this.checkFlexibleTestExpiration(attempt, test as FlexibleTest, now);
      } else if (test.type === 'live') {
        return this.checkLiveTestExpiration(attempt, test as LiveTest, now);
      }

      return false;
    } catch (error) {
      console.error(`Error checking expiration for attempt ${attempt.id}:`, error);
      return false;
    }
  }

  /**
   * Check if flexible test attempt has expired
   * 
   * Checks deadline (availableTo) - test window expiration
   * Duration expiration is already checked via server-side timeRemaining above
   */
  private static checkFlexibleTestExpiration(
    attempt: TestAttempt, 
    test: FlexibleTest, 
    now: number
  ): boolean {
    // Check deadline expiration (availableTo) - test window closed
    if (test.availableTo) {
      const deadline = test.availableTo.toMillis ? test.availableTo.toMillis() : test.availableTo.seconds * 1000;
      
      if (now > deadline) {
        console.log(`⏰ Attempt ${attempt.id} expired - flexible test deadline passed`);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if live test attempt has expired
   */
  private static checkLiveTestExpiration(
    attempt: TestAttempt, 
    test: LiveTest, 
    now: number
  ): boolean {
    // Live tests expire based on actualEndTime
    if (test.actualEndTime) {
      const endTime = test.actualEndTime.toMillis ? test.actualEndTime.toMillis() : test.actualEndTime.seconds * 1000;
      
      if (now > endTime) {
        console.log(`⏰ Live test attempt ${attempt.id} expired`);
        return true;
      }
    }

    return false;
  }

  /**
   * Auto-submit an expired attempt (server-side using Admin SDK)
   */
  private static async autoSubmitExpiredAttempt(attempt: TestAttempt): Promise<void> {
    try {
      console.log(`🔄 Auto-submitting expired attempt: ${attempt.id}`);

      // Get admin Realtime Database instance
      const adminRtdb = getAdminDatabase(firebaseAdmin.admin.app());

      // 1. Mark attempt as expired in Firestore (use admin SDK directly)
      console.log(`📝 Marking attempt as expired in Firestore: ${attempt.id}`);
      await firebaseAdmin.db
        .collection('testAttempts')
        .doc(attempt.id)
        .update({
          timeRemaining: 0,
          updatedAt: new Date()
        });

      // 2. Update Realtime Database attempt state (using Admin SDK)
      console.log(`🔄 Updating activeAttempts in Realtime DB: ${attempt.id}`);
      try {
        await adminRtdb.ref(`activeAttempts/${attempt.id}`).update({
          timeRemaining: 0,
          isOnline: false,
          lastUpdate: Date.now()
        });
      } catch (rtdbError) {
        console.warn(`⚠️ Could not update activeAttempts for ${attempt.id}:`, rtdbError);
      }

      // 3. Mark test session as submitted in Realtime DB (using Admin SDK)
      console.log(`📤 Marking session as submitted: ${attempt.id}`);
      try {
        const sessionRef = adminRtdb.ref(`testSessions/${attempt.id}`);
        const sessionSnapshot = await sessionRef.get();
        
        if (sessionSnapshot.exists()) {
          await sessionRef.update({
            isSubmitted: true,
            submittedAt: Date.now(),
            isAutoSubmitted: true
          });
        } else {
          console.warn(`⚠️ No realtime session found for ${attempt.id}, will create minimal submission`);
        }
      } catch (sessionError) {
        console.warn(`⚠️ Could not update testSession for ${attempt.id}:`, sessionError);
      }

      // 4. Update attempt status to auto_submitted in Firestore
      console.log(`✅ Updating attempt status to auto_submitted: ${attempt.id}`);
      await firebaseAdmin.db
        .collection('testAttempts')
        .doc(attempt.id)
        .update({
          status: 'auto_submitted',
          submittedAt: new Date(),
          updatedAt: new Date()
        });

      // 5. Create submission record using server-side logic
      console.log(`📋 Creating submission record: ${attempt.id}`);
      try {
        // Get session data from Realtime DB
        const sessionSnapshot = await adminRtdb.ref(`testSessions/${attempt.id}`).get();
        const sessionData = sessionSnapshot.val();

        if (sessionData && sessionData.answers) {
          // Create full submission with answers
          await this.createFullSubmission(attempt, sessionData);
        } else {
          // Create minimal submission without session data
          await this.createMinimalSubmission(attempt);
        }
      } catch (submissionError) {
        console.error(`❌ Error creating submission for ${attempt.id}:`, submissionError);
        // Create fallback submission
        await this.createMinimalSubmission(attempt);
      }

      console.log(`✅ Successfully auto-submitted expired attempt: ${attempt.id}`);

    } catch (error) {
      console.error(`❌ Failed to auto-submit attempt ${attempt.id}:`, error);
      throw error;
    }
  }

  /**
   * Create a minimal submission when session data is missing
   */
  private static async createMinimalSubmission(attempt: TestAttempt): Promise<void> {
    console.log(`📝 Creating minimal submission for: ${attempt.id}`);
    
    try {
      const submissionData = {
        attemptId: attempt.id,
        testId: attempt.testId,
        studentId: attempt.studentId,
        status: 'auto_submitted' as const,
        isAutoSubmitted: true,
        submittedAt: new Date(),
        answers: {}, // No answers available
        score: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        unansweredQuestions: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await firebaseAdmin.db
        .collection('studentSubmissions')
        .doc(attempt.id)
        .set(submissionData);

      console.log(`✅ Created minimal submission for ${attempt.id}`);
    } catch (error) {
      console.error(`❌ Failed to create minimal submission for ${attempt.id}:`, error);
      throw error;
    }
  }

  /**
   * Create a full submission with answers from session data
   */
  private static async createFullSubmission(attempt: TestAttempt, sessionData: any): Promise<void> {
    console.log(`📝 Creating full submission with answers for: ${attempt.id}`);
    
    try {
      // Get test data to calculate score
      const testDoc = await firebaseAdmin.db.collection('tests').doc(attempt.testId).get();
      if (!testDoc.exists) {
        console.warn(`⚠️ Test not found for ${attempt.testId}, creating minimal submission`);
        await this.createMinimalSubmission(attempt);
        return;
      }

      const testData = testDoc.data() as any;
      const answers = sessionData.answers || {};
      
      // Calculate score
      let correctAnswers = 0;
      let incorrectAnswers = 0;
      let unansweredQuestions = 0;
      const totalQuestions = testData.questions?.length || 0;

      if (testData.questions) {
        for (const question of testData.questions) {
          const studentAnswer = answers[question.id];
          
          if (!studentAnswer || studentAnswer.selectedOption === undefined || studentAnswer.selectedOption === null) {
            unansweredQuestions++;
          } else if (studentAnswer.selectedOption === question.correctAnswer) {
            correctAnswers++;
          } else {
            incorrectAnswers++;
          }
        }
      }

      const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

      const submissionData = {
        attemptId: attempt.id,
        testId: attempt.testId,
        studentId: attempt.studentId,
        status: 'auto_submitted' as const,
        isAutoSubmitted: true,
        submittedAt: new Date(),
        answers: answers,
        score: Math.round(score * 100) / 100, // Round to 2 decimal places
        totalQuestions,
        correctAnswers,
        incorrectAnswers,
        unansweredQuestions,
        timePerQuestion: sessionData.timePerQuestion || {},
        questionsVisited: sessionData.questionsVisited || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await firebaseAdmin.db
        .collection('studentSubmissions')
        .doc(attempt.id)
        .set(submissionData);

      console.log(`✅ Created full submission for ${attempt.id} - Score: ${score}%, Correct: ${correctAnswers}/${totalQuestions}`);
    } catch (error) {
      console.error(`❌ Failed to create full submission for ${attempt.id}:`, error);
      // Fallback to minimal submission
      await this.createMinimalSubmission(attempt);
    }
  }

  /**
   * Check for and auto-submit expired attempts for a specific student
   * Useful when student logs back in
   */
  static async processExpiredAttemptsForStudent(studentId: string): Promise<void> {
    try {
      console.log(`🔍 Checking expired attempts for student: ${studentId}`);

      const attemptsQuery = await firebaseAdmin.db
        .collection('testAttempts')  // ✅ Use correct collection name
        .where('studentId', '==', studentId)
        .where('status', 'in', ['in_progress', 'not_started'])
        .orderBy('startedAt', 'desc')
        .get();

      const activeAttempts = attemptsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestAttempt[];

      for (const attempt of activeAttempts) {
        const isExpired = await this.checkIfAttemptExpired(attempt);
        
        if (isExpired) {
          console.log(`⏰ Auto-submitting expired attempt for returning student: ${attempt.id}`);
          await this.autoSubmitExpiredAttempt(attempt);
        }
      }

    } catch (error) {
      console.error(`Error processing expired attempts for student ${studentId}:`, error);
    }
  }

  /**
   * Get summary of expired but unsubmitted attempts (for monitoring)
   */
  static async getExpiredAttemptsReport(): Promise<{
    totalExpired: number;
    byTestType: { live: number; flexible: number };
    oldestExpired?: Date;
  }> {
    try {
      const attemptsQuery = await firebaseAdmin.db
        .collection('testAttempts')  // ✅ Use correct collection name
        .where('status', 'in', ['in_progress', 'not_started'])
        .orderBy('startedAt', 'asc')
        .get();

      const activeAttempts = attemptsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestAttempt[];

      let totalExpired = 0;
      const byTestType = { live: 0, flexible: 0 };
      let oldestExpired: Date | undefined;

      for (const attempt of activeAttempts) {
        const isExpired = await this.checkIfAttemptExpired(attempt);
        
        if (isExpired) {
          totalExpired++;
          
          // Get test type for categorization
          try {
            const testDoc = await firebaseAdmin.db.collection('tests').doc(attempt.testId).get();
            
            if (testDoc.exists) {
              const test = testDoc.data() as Test;
              if (test.type === 'live') byTestType.live++;
              else if (test.type === 'flexible') byTestType.flexible++;
            }
          } catch (error) {
            console.warn(`Could not get test type for attempt ${attempt.id}`);
          }

          // Track oldest expired attempt
          if (attempt.startedAt) {
            const startTime = attempt.startedAt.toDate ? attempt.startedAt.toDate() : new Date(attempt.startedAt.seconds * 1000);
            if (!oldestExpired || startTime < oldestExpired) {
              oldestExpired = startTime;
            }
          }
        }
      }

      return {
        totalExpired,
        byTestType,
        oldestExpired
      };

    } catch (error) {
      console.error('Error generating expired attempts report:', error);
      return {
        totalExpired: 0,
        byTestType: { live: 0, flexible: 0 }
      };
    }
  }
}