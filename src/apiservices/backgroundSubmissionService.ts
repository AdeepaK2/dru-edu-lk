// Background Submission Service
// Handles automatic submission of expired attempts when students are offline

import firebaseAdmin from '@/utils/firebase-server';
import { TestAttempt } from '@/models/attemptSchema';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';
import { AttemptManagementService } from './attemptManagementService';
import { RealtimeTestService } from './realtimeTestService';
import { SubmissionService } from './submissionService';

export class BackgroundSubmissionService {
  
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
   * Enhanced with recent activity check to prevent auto-submitting active sessions
   */
  private static async checkIfAttemptExpired(attempt: TestAttempt): Promise<boolean> {
    try {
      // ✅ First, check if student was recently active (within last 5 minutes)
      // This prevents auto-submitting attempts where student is actively working
      if (attempt.lastActiveAt) {
        const lastActiveTime = attempt.lastActiveAt.toMillis ? 
          attempt.lastActiveAt.toMillis() : 
          attempt.lastActiveAt.seconds * 1000;
        const timeSinceActivity = Date.now() - lastActiveTime;
        const fiveMinutesInMs = 5 * 60 * 1000;
        
        if (timeSinceActivity < fiveMinutesInMs) {
          console.log(`⚡ Attempt ${attempt.id} has recent activity (${Math.round(timeSinceActivity/1000)}s ago), not auto-submitting`);
          return false;
        }
      }

      // Get the test data using admin SDK
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
   */
  private static checkFlexibleTestExpiration(
    attempt: TestAttempt, 
    test: FlexibleTest, 
    now: number
  ): boolean {
    // Two expiration conditions for flexible tests:
    // 1. Test duration exceeded (from start time + duration)
    // 2. Test deadline passed (availableTo)

    // Check duration expiration
    if (attempt.startedAt && test.duration) {
      const startTime = attempt.startedAt.toMillis ? attempt.startedAt.toMillis() : attempt.startedAt.seconds * 1000;
      const durationMs = test.duration * 60 * 1000; // Convert minutes to ms
      const durationExpiry = startTime + durationMs;
      
      if (now > durationExpiry) {
        console.log(`⏰ Attempt ${attempt.id} expired due to duration (${test.duration} min)`);
        return true;
      }
    }

    // Check deadline expiration
    if (test.availableTo) {
      const deadline = test.availableTo.toMillis ? test.availableTo.toMillis() : test.availableTo.seconds * 1000;
      
      if (now > deadline) {
        console.log(`⏰ Attempt ${attempt.id} expired due to deadline`);
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
   * Auto-submit an expired attempt
   */
  private static async autoSubmitExpiredAttempt(attempt: TestAttempt): Promise<void> {
    try {
      console.log(`🔄 Auto-submitting expired attempt: ${attempt.id}`);

      // Mark attempt as expired first
      await AttemptManagementService.markAttemptAsExpired(attempt.id);

      // Try to submit test session (may fail if no realtime data exists)
      try {
        await RealtimeTestService.submitTestSession(attempt.id, true);
      } catch (realtimeError) {
        console.warn(`⚠️ Realtime submission failed for ${attempt.id}, continuing with backup submission`);
      }

      // Process submission (this will handle missing realtime data gracefully)
      await SubmissionService.processSubmission(attempt.id, true);

      console.log(`✅ Successfully auto-submitted expired attempt: ${attempt.id}`);

    } catch (error) {
      console.error(`❌ Failed to auto-submit attempt ${attempt.id}:`, error);
      throw error;
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