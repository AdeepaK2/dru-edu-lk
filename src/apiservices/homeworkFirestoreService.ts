import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  where, 
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

const COLLECTION_NAME = 'homework';

// Types
export interface HomeworkData {
  classId: string;
  title: string;
  description?: string;
  dueDate: Date;
  maxMarks?: number;
  createdBy: string;
}

export interface HomeworkDocument extends HomeworkData {
  id: string;
  createdAt: Date;
  status: 'active' | 'closed';
}

export interface HomeworkSubmissionData {
  studentId: string;
  studentName: string;
  status: 'submitted' | 'not_submitted' | 'late' | 'excused';
  submittedAt?: Date;
  markedAt?: Date;
  markedBy?: string;
  marks?: number;
  remarks?: string;
}

export interface HomeworkSubmissionDocument extends HomeworkSubmissionData {
  id: string;
}

export class HomeworkFirestoreService {
  private static collectionRef = collection(firestore, COLLECTION_NAME);

  /**
   * Create a new homework assignment
   */
  static async createHomework(data: HomeworkData): Promise<string> {
    try {
      const now = new Date();
      const documentData = {
        classId: data.classId,
        title: data.title,
        description: data.description || '',
        dueDate: Timestamp.fromDate(data.dueDate),
        maxMarks: data.maxMarks || null,
        createdBy: data.createdBy,
        createdAt: Timestamp.fromDate(now),
        status: 'active',
      };

      const docRef = await addDoc(this.collectionRef, documentData);
      console.log('✅ Homework created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating homework:', error);
      throw error;
    }
  }

  /**
   * Get all homework assignments for a class
   */
  static async getHomeworkByClassId(classId: string): Promise<HomeworkDocument[]> {
    try {
      const q = query(
        this.collectionRef,
        where('classId', '==', classId),
        orderBy('dueDate', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          classId: data.classId,
          title: data.title,
          description: data.description,
          dueDate: data.dueDate?.toDate() || new Date(),
          maxMarks: data.maxMarks,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          status: data.status || 'active',
        } as HomeworkDocument;
      });
    } catch (error) {
      console.error('❌ Error getting homework:', error);
      throw error;
    }
  }

  /**
   * Get a single homework assignment by ID
   */
  static async getHomeworkById(homeworkId: string): Promise<HomeworkDocument | null> {
    try {
      const docRef = doc(this.collectionRef, homeworkId);
      const snapshot = await getDoc(docRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();
      return {
        id: snapshot.id,
        classId: data.classId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate?.toDate() || new Date(),
        maxMarks: data.maxMarks,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        status: data.status || 'active',
      } as HomeworkDocument;
    } catch (error) {
      console.error('❌ Error getting homework by ID:', error);
      throw error;
    }
  }

  /**
   * Update a homework assignment
   */
  static async updateHomework(homeworkId: string, data: Partial<HomeworkData>): Promise<void> {
    try {
      const docRef = doc(this.collectionRef, homeworkId);
      const updateData: any = { ...data };
      
      if (data.dueDate) {
        updateData.dueDate = Timestamp.fromDate(data.dueDate);
      }

      await updateDoc(docRef, updateData);
      console.log('✅ Homework updated:', homeworkId);
    } catch (error) {
      console.error('❌ Error updating homework:', error);
      throw error;
    }
  }

  /**
   * Close a homework assignment
   */
  static async closeHomework(homeworkId: string): Promise<void> {
    try {
      const docRef = doc(this.collectionRef, homeworkId);
      await updateDoc(docRef, { status: 'closed' });
      console.log('✅ Homework closed:', homeworkId);
    } catch (error) {
      console.error('❌ Error closing homework:', error);
      throw error;
    }
  }

  /**
   * Delete a homework assignment
   */
  static async deleteHomework(homeworkId: string): Promise<void> {
    try {
      const docRef = doc(this.collectionRef, homeworkId);
      await deleteDoc(docRef);
      console.log('✅ Homework deleted:', homeworkId);
    } catch (error) {
      console.error('❌ Error deleting homework:', error);
      throw error;
    }
  }

  // ========== Submissions ==========

  /**
   * Get all submissions for a homework assignment
   */
  static async getSubmissions(homeworkId: string): Promise<HomeworkSubmissionDocument[]> {
    try {
      const submissionsRef = collection(firestore, COLLECTION_NAME, homeworkId, 'submissions');
      const snapshot = await getDocs(submissionsRef);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          studentId: data.studentId,
          studentName: data.studentName,
          status: data.status || 'not_submitted',
          submittedAt: data.submittedAt?.toDate(),
          markedAt: data.markedAt?.toDate(),
          markedBy: data.markedBy,
          marks: data.marks,
          remarks: data.remarks,
        } as HomeworkSubmissionDocument;
      });
    } catch (error) {
      console.error('❌ Error getting submissions:', error);
      throw error;
    }
  }

  /**
   * Mark a single student's submission
   */
  static async markSubmission(
    homeworkId: string, 
    studentId: string, 
    data: Omit<HomeworkSubmissionData, 'studentId'>
  ): Promise<void> {
    try {
      const submissionsRef = collection(firestore, COLLECTION_NAME, homeworkId, 'submissions');
      const submissionDoc = doc(submissionsRef, studentId);
      
      const now = new Date();
      const submissionData: any = {
        studentId,
        studentName: data.studentName,
        status: data.status,
        markedAt: Timestamp.fromDate(now),
        markedBy: data.markedBy,
      };

      if (data.marks !== undefined) {
        submissionData.marks = data.marks;
      }
      if (data.remarks) {
        submissionData.remarks = data.remarks;
      }
      if (data.status === 'submitted' || data.status === 'late') {
        submissionData.submittedAt = data.submittedAt 
          ? Timestamp.fromDate(data.submittedAt) 
          : Timestamp.fromDate(now);
      }

      await updateDoc(submissionDoc, submissionData).catch(async () => {
        // Document doesn't exist, create it
        const { addDoc } = await import('firebase/firestore');
        await addDoc(submissionsRef, submissionData);
      });

      console.log('✅ Submission marked:', studentId);
    } catch (error) {
      console.error('❌ Error marking submission:', error);
      throw error;
    }
  }

  /**
   * Bulk mark submissions for multiple students
   */
  static async bulkMarkSubmissions(
    homeworkId: string,
    submissions: HomeworkSubmissionData[],
    markedBy: string
  ): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      const now = new Date();
      const submissionsRef = collection(firestore, COLLECTION_NAME, homeworkId, 'submissions');

      for (const submission of submissions) {
        const submissionDoc = doc(submissionsRef, submission.studentId);
        
        const submissionData: any = {
          studentId: submission.studentId,
          studentName: submission.studentName,
          status: submission.status,
          markedAt: Timestamp.fromDate(now),
          markedBy,
        };

        if (submission.marks !== undefined) {
          submissionData.marks = submission.marks;
        }
        if (submission.remarks) {
          submissionData.remarks = submission.remarks;
        }
        if (submission.status === 'submitted' || submission.status === 'late') {
          submissionData.submittedAt = submission.submittedAt 
            ? Timestamp.fromDate(submission.submittedAt) 
            : Timestamp.fromDate(now);
        }

        batch.set(submissionDoc, submissionData, { merge: true });
      }

      await batch.commit();
      console.log('✅ Bulk submissions marked:', submissions.length);
    } catch (error) {
      console.error('❌ Error bulk marking submissions:', error);
      throw error;
    }
  }

  /**
   * Get submission statistics for a homework
   */
  static async getSubmissionStats(homeworkId: string): Promise<{
    total: number;
    submitted: number;
    notSubmitted: number;
    late: number;
    excused: number;
    averageMarks?: number;
  }> {
    try {
      const submissions = await this.getSubmissions(homeworkId);
      
      const stats = {
        total: submissions.length,
        submitted: 0,
        notSubmitted: 0,
        late: 0,
        excused: 0,
        averageMarks: undefined as number | undefined,
      };

      let totalMarks = 0;
      let markedCount = 0;

      for (const sub of submissions) {
        switch (sub.status) {
          case 'submitted':
            stats.submitted++;
            break;
          case 'not_submitted':
            stats.notSubmitted++;
            break;
          case 'late':
            stats.late++;
            break;
          case 'excused':
            stats.excused++;
            break;
        }

        if (sub.marks !== undefined) {
          totalMarks += sub.marks;
          markedCount++;
        }
      }

      if (markedCount > 0) {
        stats.averageMarks = Math.round(totalMarks / markedCount);
      }

      return stats;
    } catch (error) {
      console.error('❌ Error getting submission stats:', error);
      throw error;
    }
  }
}

export default HomeworkFirestoreService;
