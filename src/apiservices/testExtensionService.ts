// Test Extension Service
// Handles deadline extensions for flexible tests

import { firestore } from '@/utils/firebase-client';
import { doc, updateDoc, Timestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Test, FlexibleTest, TestExtension } from '@/models/testSchema';
import { v4 as uuidv4 } from 'uuid';

export class TestExtensionService {
  
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
}
