// Late Submission Service
// Handles late submissions for tests that have exceeded their deadline

import { firestore } from '@/utils/firebase-client';
import { 
  doc, 
  updateDoc, 
  Timestamp, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  setDoc,
  addDoc 
} from 'firebase/firestore';
import { Test, FlexibleTest } from '@/models/testSchema';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeTestService } from './realtimeTestService';
import { SubmissionService } from './submissionService';
import { StudentSubmission } from '@/models/studentSubmissionSchema';

export interface LateSubmissionApproval {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  originalDeadline: Timestamp;
  newDeadline: Timestamp;
  approvedBy: string; // Teacher ID
  approvedByName: string; // Teacher name
  reason?: string;
  status: 'approved' | 'pending' | 'submitted' | 'expired';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class LateSubmissionService {
  private static COLLECTIONS = {
    TESTS: 'tests',
    LATE_SUBMISSIONS: 'lateSubmissionApprovals',
    STUDENT_SUBMISSIONS: 'studentSubmissions',
    TEST_ATTEMPTS: 'testAttempts'
  };

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
   * Approve late submission for a student
   * This creates an approval record and allows the student to submit after the deadline
   */
  static async approveLateSubmission(
    testId: string,
    studentId: string,
    studentName: string,
    classId: string,
    className: string,
    newDeadline: Date,
    teacherId: string,
    teacherName: string,
    reason?: string
  ): Promise<LateSubmissionApproval> {
    try {
      console.log('🔄 Approving late submission:', { 
        testId, 
        studentId, 
        newDeadline, 
        teacherId 
      });
      
      // Get the current test data
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, testId));
      if (!testDoc.exists()) {
        throw new Error('Test not found');
      }
      
      const test = { id: testDoc.id, ...testDoc.data() } as Test;
      let originalDeadline: Timestamp;
      
      // Extract the appropriate deadline based on test type
      if (test.type === 'flexible') {
        const flexTest = test as FlexibleTest;
        originalDeadline = flexTest.availableTo;
      } else {
        // For live tests, use the actual end time
        originalDeadline = (test as any).actualEndTime || Timestamp.now();
      }
      
      // Validate the new deadline is after the current time
      const now = Timestamp.now();
      const newTimestamp = Timestamp.fromDate(newDeadline);
      
      if (newTimestamp.seconds <= now.seconds) {
        throw new Error('New deadline must be in the future');
      }
      
      // Create approval record
      const approvalId = uuidv4();
      const approval: LateSubmissionApproval = {
        id: approvalId,
        testId: test.id,
        testTitle: test.title,
        studentId,
        studentName,
        classId,
        className,
        originalDeadline,
        newDeadline: newTimestamp,
        approvedBy: teacherId,
        approvedByName: teacherName,
        reason: reason || '',
        status: 'approved',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // Save approval to Firestore
      await setDoc(
        doc(firestore, this.COLLECTIONS.LATE_SUBMISSIONS, approvalId), 
        approval
      );
      
      console.log('✅ Late submission approved successfully');
      return approval;
    } catch (error) {
      console.error('❌ Error approving late submission:', error);
      throw error;
    }
  }

  /**
   * Check if a student has late submission approval for a test
   */
  static async checkLateSubmissionApproval(
    testId: string,
    studentId: string
  ): Promise<LateSubmissionApproval | null> {
    try {
      // Query for approved late submission that hasn't expired
      const now = Timestamp.now();
      const approvalsRef = collection(firestore, this.COLLECTIONS.LATE_SUBMISSIONS);
      const q = query(
        approvalsRef,
        where('testId', '==', testId),
        where('studentId', '==', studentId),
        where('status', '==', 'approved')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      // Find the most recent approval
      let mostRecent: LateSubmissionApproval | null = null;
      snapshot.forEach((doc) => {
        const approval = doc.data() as LateSubmissionApproval;
        
        // Skip expired approvals
        if (approval.newDeadline.seconds < now.seconds) {
          return;
        }
        
        if (!mostRecent || approval.createdAt.seconds > mostRecent.createdAt.seconds) {
          mostRecent = { ...approval, id: doc.id };
        }
      });
      
      return mostRecent;
    } catch (error) {
      console.error('Error checking late submission approval:', error);
      return null;
    }
  }

  /**
   * Process a late submission
   */
  static async processLateSubmission(
    approvalId: string,
    attemptId: string,
    isAutoSubmitted: boolean = false
  ): Promise<StudentSubmission> {
    try {
      console.log('🔄 Processing late submission for attempt:', attemptId);
      
      // Get the approval
      const approvalDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.LATE_SUBMISSIONS, approvalId)
      );
      
      if (!approvalDoc.exists()) {
        throw new Error('Late submission approval not found');
      }
      
      const approval = approvalDoc.data() as LateSubmissionApproval;
      
      // Process the submission using the regular submission service
      const submission = await SubmissionService.processSubmission(attemptId, isAutoSubmitted);
      
      // Mark as late submission
      const lateSubmissionData = {
        isLateSubmission: true,
        status: 'late_submission',
        lateSubmissionInfo: {
          approvedBy: approval.approvedBy,
          approvedByName: approval.approvedByName,
          originalDeadline: approval.originalDeadline,
          approvedAt: approval.createdAt,
          reason: approval.reason
        },
        updatedAt: Timestamp.now()
      };
      
      // Update the submission
      await updateDoc(
        doc(firestore, this.COLLECTIONS.STUDENT_SUBMISSIONS, submission.id),
        lateSubmissionData
      );
      
      // Update the approval status
      await updateDoc(
        doc(firestore, this.COLLECTIONS.LATE_SUBMISSIONS, approvalId),
        {
          status: 'submitted',
          updatedAt: Timestamp.now()
        }
      );
      
      // Get the updated submission
      const updatedSubmissionDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.STUDENT_SUBMISSIONS, submission.id)
      );
      
      return { 
        id: updatedSubmissionDoc.id, 
        ...updatedSubmissionDoc.data() 
      } as StudentSubmission;
    } catch (error) {
      console.error('Error processing late submission:', error);
      throw error;
    }
  }

  /**
   * Get all late submission approvals for a test
   */
  static async getTestLateSubmissionApprovals(
    testId: string
  ): Promise<LateSubmissionApproval[]> {
    try {
      const approvalsRef = collection(firestore, this.COLLECTIONS.LATE_SUBMISSIONS);
      const q = query(
        approvalsRef,
        where('testId', '==', testId)
      );
      
      const snapshot = await getDocs(q);
      const approvals: LateSubmissionApproval[] = [];
      
      snapshot.forEach((doc) => {
        approvals.push({ id: doc.id, ...doc.data() } as LateSubmissionApproval);
      });
      
      return approvals;
    } catch (error) {
      console.error('Error getting test late submission approvals:', error);
      return [];
    }
  }

  /**
   * Get all late submission approvals for a teacher
   */
  static async getTeacherLateSubmissionApprovals(
    teacherId: string
  ): Promise<LateSubmissionApproval[]> {
    try {
      const approvalsRef = collection(firestore, this.COLLECTIONS.LATE_SUBMISSIONS);
      const q = query(
        approvalsRef,
        where('approvedBy', '==', teacherId)
      );
      
      const snapshot = await getDocs(q);
      const approvals: LateSubmissionApproval[] = [];
      
      snapshot.forEach((doc) => {
        approvals.push({ id: doc.id, ...doc.data() } as LateSubmissionApproval);
      });
      
      return approvals;
    } catch (error) {
      console.error('Error getting teacher late submission approvals:', error);
      return [];
    }
  }

  /**
   * Cancel a late submission approval
   */
  static async cancelLateSubmissionApproval(
    approvalId: string
  ): Promise<void> {
    try {
      await updateDoc(
        doc(firestore, this.COLLECTIONS.LATE_SUBMISSIONS, approvalId),
        {
          status: 'expired',
          updatedAt: Timestamp.now()
        }
      );
      
      console.log('✅ Late submission approval cancelled successfully');
    } catch (error) {
      console.error('Error cancelling late submission approval:', error);
      throw error;
    }
  }

  /**
   * Get all late submission approvals for a specific student
   */
  static async getStudentLateSubmissions(
    studentId: string
  ): Promise<LateSubmissionApproval[]> {
    try {
      const approvalsQuery = query(
        collection(firestore, this.COLLECTIONS.LATE_SUBMISSIONS),
        where('studentId', '==', studentId)
      );
      
      const snapshot = await getDocs(approvalsQuery);
      const approvals: LateSubmissionApproval[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        approvals.push({
          id: doc.id,
          ...data,
          originalDeadline: data.originalDeadline,
          newDeadline: data.newDeadline,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        } as LateSubmissionApproval);
      });
      
      console.log(`✅ Retrieved ${approvals.length} late submission approvals for student ${studentId}`);
      return approvals;
    } catch (error) {
      console.error('Error getting student late submissions:', error);
      throw error;
    }
  }
}
