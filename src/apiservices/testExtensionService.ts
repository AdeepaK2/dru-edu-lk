// Test Extension Service
// Handles deadline extensions for flexible tests

import { firestore } from '@/utils/firebase-client';
import { doc, updateDoc, Timestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Test, FlexibleTest, TestExtension } from '@/models/testSchema';
import { MailService } from './mailService';
import { v4 as uuidv4 } from 'uuid';

export class TestExtensionService {
  
  // 🛡️ Feature flag for safety - can be disabled via environment variable
  private static ENABLE_ATTEMPT_STATE_INVALIDATION = process.env.ENABLE_ATTEMPT_STATE_INVALIDATION !== 'false'; // Default: enabled
  
  /**
   * Safely convert timestamp to Date object
   */
  private static convertTimestampToDate(timestamp: any): Date {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp);
    } else {
      console.error('Unknown timestamp format:', timestamp);
      return new Date(); // Fallback to current date
    }
  }

  /**
   * Extend the deadline of a flexible test
   */
  static async extendTestDeadline(
    testId: string,
    newDeadline: Date,
    teacherId: string,
    teacherName: string,
    reason?: string
  ): Promise<TestExtension> {
    try {
      console.log('🔄 Extending test deadline:', { testId, newDeadline, teacherId, reason });
      
      // Get the current test data
      const testDoc = await getDoc(doc(firestore, 'tests', testId));
      if (!testDoc.exists()) {
        throw new Error('Test not found');
      }
      
      const test = { id: testDoc.id, ...testDoc.data() } as Test;
      
      // Verify it's a flexible test
      if (test.type !== 'flexible') {
        throw new Error('Can only extend deadlines for flexible tests');
      }
      
      const flexTest = test as FlexibleTest;
      const currentDeadline = flexTest.availableTo;
      const newTimestamp = Timestamp.fromDate(newDeadline);
      
      // Validate the new deadline is after the current deadline
      if (newTimestamp.seconds <= currentDeadline.seconds) {
        throw new Error('New deadline must be after the current deadline');
      }
      
      // Create extension record
      const extension: TestExtension = {
        id: uuidv4(),
        extendedBy: teacherId,
        extendedByName: teacherName,
        previousDeadline: currentDeadline,
        newDeadline: newTimestamp,
        reason: reason || '',
        createdAt: Timestamp.now(),
        notificationsSent: false
      };
      
      // Prepare update data
      const updateData: Partial<FlexibleTest> = {
        availableTo: newTimestamp,
        isExtended: true,
        extensionHistory: [...(flexTest.extensionHistory || []), extension],
        updatedAt: Timestamp.now()
      };
      
      // Store original deadline if this is the first extension
      if (!flexTest.originalAvailableTo) {
        updateData.originalAvailableTo = currentDeadline;
      }
      
      // Update the test
      await updateDoc(doc(firestore, 'tests', testId), updateData);
      
      console.log('✅ Test deadline extended successfully');
      
      // 🚨 CRITICAL: Invalidate any active attempt states that might be affected
      if (this.ENABLE_ATTEMPT_STATE_INVALIDATION) {
        await this.invalidateActiveAttemptStates(testId, newTimestamp);
      } else {
        console.log('⚠️ Attempt state invalidation is disabled via feature flag');
      }
      
      // Send email notifications to students and parents
      try {
        console.log('📧 Sending extension notification emails...');
        await this.sendExtensionNotifications(testId, test, extension);
        
        // Mark notifications as sent
        await updateDoc(doc(firestore, 'tests', testId), {
          'extensionHistory': [...(flexTest.extensionHistory || []), {
            ...extension,
            notificationsSent: true
          }]
        });
        
        console.log('✅ Extension notification emails sent successfully');
      } catch (emailError) {
        console.warn('⚠️ Extension emails failed but test was extended:', emailError);
        // Don't fail the extension if emails fail
      }
      
      return extension;
    } catch (error) {
      console.error('❌ Error extending test deadline:', error);
      throw error;
    }
  }
  
  /**
   * Get extension history for a test
   */
  static async getExtensionHistory(testId: string): Promise<TestExtension[]> {
    try {
      const testDoc = await getDoc(doc(firestore, 'tests', testId));
      if (!testDoc.exists()) {
        return [];
      }
      
      const test = testDoc.data() as FlexibleTest;
      return test.extensionHistory || [];
    } catch (error) {
      console.error('Error getting extension history:', error);
      return [];
    }
  }
  
  /**
   * Check if a test can be extended
   */
  static async canExtendTest(testId: string): Promise<{
    canExtend: boolean;
    reason: string;
    currentDeadline?: Date;
    isFlexible?: boolean;
  }> {
    try {
      const testDoc = await getDoc(doc(firestore, 'tests', testId));
      if (!testDoc.exists()) {
        return { canExtend: false, reason: 'Test not found' };
      }
      
      const test = { id: testDoc.id, ...testDoc.data() } as Test;
      
      // Must be flexible test
      if (test.type !== 'flexible') {
        return { 
          canExtend: false, 
          reason: 'Only flexible tests can have deadline extensions',
          isFlexible: false
        };
      }
      
      const flexTest = test as FlexibleTest;
      const now = Timestamp.now();
      const currentDeadline = flexTest.availableTo;
      
      // Check if test has already ended
      if (now.seconds > currentDeadline.seconds) {
        return {
          canExtend: false,
          reason: 'Cannot extend deadline for a test that has already ended',
          currentDeadline: this.convertTimestampToDate(currentDeadline),
          isFlexible: true
        };
      }
      
      return {
        canExtend: true,
        reason: 'Test can be extended',
        currentDeadline: this.convertTimestampToDate(currentDeadline),
        isFlexible: true
      };
    } catch (error) {
      console.error('Error checking if test can be extended:', error);
      return { canExtend: false, reason: 'Error checking test status' };
    }
  }
  
  /**
   * Get tests that have been extended (for teacher dashboard)
   */
  static async getExtendedTests(teacherId: string): Promise<FlexibleTest[]> {
    try {
      const testsRef = collection(firestore, 'tests');
      const q = query(
        testsRef,
        where('teacherId', '==', teacherId),
        where('type', '==', 'flexible'),
        where('isExtended', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const extendedTests: FlexibleTest[] = [];
      
      snapshot.forEach((doc) => {
        extendedTests.push({ id: doc.id, ...doc.data() } as FlexibleTest);
      });
      
      return extendedTests;
    } catch (error) {
      console.error('Error getting extended tests:', error);
      return [];
    }
  }
  
  /**
   * Format extension information for display
   */
  static formatExtensionInfo(test: FlexibleTest): string | null {
    if (!test.isExtended || !test.extensionHistory || test.extensionHistory.length === 0) {
      return null;
    }
    
    const latestExtension = test.extensionHistory[test.extensionHistory.length - 1];
    const originalDeadline = test.originalAvailableTo || latestExtension.previousDeadline;
    
    const originalDate = this.convertTimestampToDate(originalDeadline);
    const currentDate = this.convertTimestampToDate(test.availableTo);
    
    return `Extended from ${originalDate.toLocaleDateString()} to ${currentDate.toLocaleDateString()}`;
  }
  
  /**
   * Invalidate active attempt states when test deadline is extended
   * This prevents timing conflicts between cached attempt data and new deadline
   */
  private static async invalidateActiveAttemptStates(testId: string, newDeadline: Timestamp): Promise<void> {
    try {
      console.log('🔄 Invalidating active attempt states for extended test:', testId);
      
      // Update all active attempts for this test with new deadline awareness
      const attemptsQuery = query(
        collection(firestore, 'testAttempts'),
        where('testId', '==', testId),
        where('status', 'in', ['in_progress', 'not_started', 'paused'])
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const updatePromises: Promise<void>[] = [];
      
      attemptsSnapshot.forEach((attemptDoc) => {
        const attemptData = attemptDoc.data();
        
        // Add extension flag to attempt so student UI can refresh test data
        const updatePromise = updateDoc(doc(firestore, 'testAttempts', attemptDoc.id), {
          testExtendedAt: Timestamp.now(),
          newTestDeadline: newDeadline,
          requiresTestDataRefresh: true, // Flag for client to refresh test info
          lastUpdated: Timestamp.now()
        });
        
        updatePromises.push(updatePromise);
      });
      
      await Promise.all(updatePromises);
      console.log(`✅ Updated ${updatePromises.length} active attempts with extension info`);
      
    } catch (error) {
      console.error('❌ Error invalidating active attempt states:', error);
      // Don't throw - extension should still succeed even if this fails
    }
  }

  /**
   * Clear extension refresh flags after client has refreshed test data
   * Should be called by client after detecting and handling test extension
   */
  static async clearExtensionRefreshFlags(testId: string): Promise<void> {
    try {
      console.log('🧹 Clearing extension refresh flags for test:', testId);
      
      const attemptsQuery = query(
        collection(firestore, 'testAttempts'),
        where('testId', '==', testId),
        where('requiresTestDataRefresh', '==', true)
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const clearPromises: Promise<void>[] = [];
      
      attemptsSnapshot.forEach((attemptDoc) => {
        const clearPromise = updateDoc(doc(firestore, 'testAttempts', attemptDoc.id), {
          requiresTestDataRefresh: false,
          extensionHandledAt: Timestamp.now()
        });
        
        clearPromises.push(clearPromise);
      });
      
      await Promise.all(clearPromises);
      console.log(`✅ Cleared extension flags for ${clearPromises.length} attempts`);
      
    } catch (error) {
      console.error('❌ Error clearing extension refresh flags:', error);
    }
  }

  /**
   * Get students who might be affected by deadline extension
   */
  static async getAffectedStudents(testId: string): Promise<{
    totalEnrolled: number;
    activeAttempts: number;
    completedAttempts: number;
    notAttempted: number;
  }> {
    try {
      // This would need to be implemented based on your enrollment and attempt tracking
      // For now, return placeholder data
      return {
        totalEnrolled: 0,
        activeAttempts: 0,
        completedAttempts: 0,
        notAttempted: 0
      };
    } catch (error) {
      console.error('Error getting affected students:', error);
      return {
        totalEnrolled: 0,
        activeAttempts: 0,
        completedAttempts: 0,
        notAttempted: 0
      };
    }
  }

  /**
   * Send extension notification emails to students and parents
   */
  private static async sendExtensionNotifications(
    testId: string, 
    test: Test, 
    extension: TestExtension
  ): Promise<void> {
    try {
      // Get enrolled students for this test
      const { StudentEnrollmentFirestoreService } = await import('./studentEnrollmentFirestoreService');
      const { StudentFirestoreService } = await import('./studentFirestoreService');
      
      const enrolledStudents = await Promise.all(
        test.classIds.map(async (classId: string) => {
          const enrollments = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(classId);
          return enrollments.map((enrollment: any) => ({
            id: enrollment.studentId,
            name: enrollment.studentName,
            email: enrollment.studentEmail,
            parent: enrollment.parent,
            enrollment
          }));
        })
      );
      
      // Flatten the array
      const allStudents = enrolledStudents.flat();
      
      // Remove duplicates (in case student is in multiple classes for the same test)
      const uniqueStudents = allStudents.filter((student: any, index: number, self: any[]) => 
        index === self.findIndex((s: any) => s.id === student.id)
      );
      
      console.log(`📧 Sending extension notifications to ${uniqueStudents.length} students`);
      
      // Format dates for email
      const originalDeadline = this.convertTimestampToDate(extension.previousDeadline);
      const newDeadline = this.convertTimestampToDate(extension.newDeadline);
      const extensionDays = Math.ceil((newDeadline.getTime() - originalDeadline.getTime()) / (1000 * 60 * 60 * 24));
      
      const originalDeadlineStr = originalDeadline.toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const newDeadlineStr = newDeadline.toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Get class name (use first class if multiple)
      let className = 'Unknown Class';
      if (test.classNames && test.classNames.length > 0) {
        className = test.classNames[0];
      }
      
      // Get subject name
      const subjectName = test.subjectName || test.subjectId || 'Unknown Subject';
      
      // Send emails to all students and their parents
      const emailPromises = uniqueStudents.map(async (student: any) => {
        try {
          if (student.email && student.parent?.email) {
            await MailService.sendTestExtensionNotificationEmails(
              student.name,
              student.email,
              student.parent.name || 'Parent',
              student.parent.email,
              test.title,
              extension.extendedByName,
              subjectName,
              className,
              originalDeadlineStr,
              newDeadlineStr,
              extensionDays,
              extension.reason
            );
            
            console.log(`✅ Extension email sent to ${student.name} and parent`);
          } else {
            console.warn(`⚠️ Missing email addresses for student ${student.name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to send extension email to ${student.name}:`, error);
        }
      });
      
      // Send all emails in parallel
      await Promise.all(emailPromises);
      
      console.log('✅ All extension notification emails sent');
    } catch (error) {
      console.error('❌ Error sending extension notifications:', error);
      throw error;
    }
  }
}
