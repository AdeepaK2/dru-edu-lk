// Student Test Assignment Service - Manages individual test assignments
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  writeBatch,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

// Individual assignment document interface
export interface StudentTestAssignmentDocument {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  classId: string;
  className: string;
  assignedAt: Timestamp;
  assignedBy: string; // teacherId
  assignedByName: string; // teacher name
  status: 'assigned' | 'started' | 'completed' | 'expired';
  notificationSent?: boolean;
  notificationSentAt?: Timestamp;
}

export class StudentTestAssignmentService {
  private static readonly COLLECTION_NAME = 'student_test_assignments';

  // Create individual assignments for multiple students
  static async createAssignments(
    testId: string,
    students: Array<{
      id: string;
      name: string;
      email: string;
      classId: string;
      className: string;
    }>,
    assignedBy: string,
    assignedByName: string
  ): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      const assignmentsCollection = collection(firestore, this.COLLECTION_NAME);

      console.log(`📝 Creating ${students.length} individual test assignments for test: ${testId}`);

      students.forEach((student) => {
        const assignmentData: Omit<StudentTestAssignmentDocument, 'id'> = {
          testId,
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          classId: student.classId,
          className: student.className,
          assignedAt: Timestamp.now(),
          assignedBy,
          assignedByName,
          status: 'assigned',
          notificationSent: false
        };

        const docRef = doc(assignmentsCollection);
        batch.set(docRef, assignmentData);
      });

      await batch.commit();
      console.log(`✅ Successfully created ${students.length} test assignments`);
    } catch (error) {
      console.error('Error creating test assignments:', error);
      throw new Error('Failed to create test assignments');
    }
  }

  // Get all assignments for a specific student
  static async getStudentAssignments(studentId: string): Promise<StudentTestAssignmentDocument[]> {
    try {
      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('studentId', '==', studentId),
        orderBy('assignedAt', 'desc')
      );

      const snapshot = await getDocs(assignmentsQuery);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as StudentTestAssignmentDocument[];
    } catch (error) {
      console.error('Error getting student assignments:', error);
      throw new Error('Failed to get student assignments');
    }
  }

  // Get all assignments for a specific test
  static async getTestAssignments(testId: string): Promise<StudentTestAssignmentDocument[]> {
    try {
      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('testId', '==', testId),
        orderBy('assignedAt', 'desc')
      );

      const snapshot = await getDocs(assignmentsQuery);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as StudentTestAssignmentDocument[];
    } catch (error) {
      console.error('Error getting test assignments:', error);
      throw new Error('Failed to get test assignments');
    }
  }

  // Update assignment status (when student starts or completes test)
  static async updateAssignmentStatus(
    testId: string, 
    studentId: string, 
    status: 'started' | 'completed' | 'expired'
  ): Promise<void> {
    try {
      // Find the assignment document
      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('testId', '==', testId),
        where('studentId', '==', studentId)
      );

      const snapshot = await getDocs(assignmentsQuery);
      if (snapshot.empty) {
        console.warn(`No assignment found for test ${testId} and student ${studentId}`);
        return;
      }

      const assignmentDoc = snapshot.docs[0];
      await updateDoc(assignmentDoc.ref, {
        status,
        updatedAt: Timestamp.now()
      });

      console.log(`✅ Updated assignment status to ${status} for student ${studentId} and test ${testId}`);
    } catch (error) {
      console.error('Error updating assignment status:', error);
      throw new Error('Failed to update assignment status');
    }
  }

  // Check if student is assigned to a specific test
  static async isStudentAssignedToTest(testId: string, studentId: string): Promise<boolean> {
    try {
      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('testId', '==', testId),
        where('studentId', '==', studentId)
      );

      const snapshot = await getDocs(assignmentsQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking student assignment:', error);
      return false;
    }
  }

  // Get assignments for multiple tests (for bulk operations)
  static async getAssignmentsForTests(testIds: string[]): Promise<Record<string, StudentTestAssignmentDocument[]>> {
    try {
      if (testIds.length === 0) return {};

      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('testId', 'in', testIds),
        orderBy('assignedAt', 'desc')
      );

      const snapshot = await getDocs(assignmentsQuery);
      const assignments: Record<string, StudentTestAssignmentDocument[]> = {};

      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const assignment = { id: doc.id, ...doc.data() } as StudentTestAssignmentDocument;
        if (!assignments[assignment.testId]) {
          assignments[assignment.testId] = [];
        }
        assignments[assignment.testId].push(assignment);
      });

      return assignments;
    } catch (error) {
      console.error('Error getting assignments for tests:', error);
      throw new Error('Failed to get assignments for tests');
    }
  }

  // Delete all assignments for a test (when test is deleted)
  static async deleteTestAssignments(testId: string): Promise<void> {
    try {
      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('testId', '==', testId)
      );

      const snapshot = await getDocs(assignmentsQuery);
      const batch = writeBatch(firestore);

      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Deleted ${snapshot.size} assignments for test ${testId}`);
    } catch (error) {
      console.error('Error deleting test assignments:', error);
      throw new Error('Failed to delete test assignments');
    }
  }

  // Update notification status
  static async markNotificationSent(testId: string, studentIds: string[]): Promise<void> {
    try {
      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('testId', '==', testId),
        where('studentId', 'in', studentIds)
      );

      const snapshot = await getDocs(assignmentsQuery);
      const batch = writeBatch(firestore);

      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        batch.update(doc.ref, {
          notificationSent: true,
          notificationSentAt: Timestamp.now()
        });
      });

      await batch.commit();
      console.log(`✅ Marked notifications as sent for ${snapshot.size} assignments`);
    } catch (error) {
      console.error('Error marking notifications as sent:', error);
      throw new Error('Failed to mark notifications as sent');
    }
  }

  // Get assignment statistics for a test
  static async getTestAssignmentStats(testId: string): Promise<{
    total: number;
    assigned: number;
    started: number;
    completed: number;
    expired: number;
  }> {
    try {
      const assignments = await this.getTestAssignments(testId);
      
      const stats = {
        total: assignments.length,
        assigned: assignments.filter(a => a.status === 'assigned').length,
        started: assignments.filter(a => a.status === 'started').length,
        completed: assignments.filter(a => a.status === 'completed').length,
        expired: assignments.filter(a => a.status === 'expired').length,
      };

      return stats;
    } catch (error) {
      console.error('Error getting test assignment stats:', error);
      throw new Error('Failed to get test assignment stats');
    }
  }

  // Get teacher's assigned tests with student counts
  static async getTeacherAssignmentSummary(teacherId: string): Promise<Array<{
    testId: string;
    totalAssigned: number;
    completedAssignments: number;
    pendingAssignments: number;
  }>> {
    try {
      const assignmentsQuery = query(
        collection(firestore, this.COLLECTION_NAME),
        where('assignedBy', '==', teacherId)
      );

      const snapshot = await getDocs(assignmentsQuery);
      const summary: Record<string, {
        testId: string;
        totalAssigned: number;
        completedAssignments: number;
        pendingAssignments: number;
      }> = {};

      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const assignment = doc.data() as StudentTestAssignmentDocument;
        
        if (!summary[assignment.testId]) {
          summary[assignment.testId] = {
            testId: assignment.testId,
            totalAssigned: 0,
            completedAssignments: 0,
            pendingAssignments: 0
          };
        }

        summary[assignment.testId].totalAssigned++;
        
        if (assignment.status === 'completed') {
          summary[assignment.testId].completedAssignments++;
        } else {
          summary[assignment.testId].pendingAssignments++;
        }
      });

      return Object.values(summary);
    } catch (error) {
      console.error('Error getting teacher assignment summary:', error);
      throw new Error('Failed to get teacher assignment summary');
    }
  }
}
