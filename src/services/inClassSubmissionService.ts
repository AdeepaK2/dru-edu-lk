import { firestore } from '@/utils/firebase-client';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { InClassSubmission } from '@/models/inClassSubmissionSchema';

export class InClassSubmissionService {
  private static COLLECTION = 'inClassSubmissions';

  // Create or update a submission
  static async saveSubmission(submission: InClassSubmission): Promise<string> {
    try {
      const submissionData = {
        ...submission,
        updatedAt: Timestamp.now(),
      };

      if (submission.id) {
        // Update existing
        const docRef = doc(firestore, this.COLLECTION, submission.id);
        await updateDoc(docRef, submissionData);
        return submission.id;
      } else {
        // Create new
        const docRef = doc(collection(firestore, this.COLLECTION));
        await setDoc(docRef, {
          ...submissionData,
          createdAt: Timestamp.now(),
        });
        return docRef.id;
      }
    } catch (error) {
      console.error('Error saving submission:', error);
      throw error;
    }
  }

  // Get submissions for a specific test
  static async getSubmissionsByTest(testId: string): Promise<InClassSubmission[]> {
    try {
      const q = query(
        collection(firestore, this.COLLECTION),
        where('testId', '==', testId),
        orderBy('studentName', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InClassSubmission));
    } catch (error) {
      console.error('Error getting submissions:', error);
      throw error;
    }
  }

  // Get submission for a specific student and test
  static async getStudentSubmission(
    testId: string,
    studentId: string
  ): Promise<InClassSubmission | null> {
    try {
      const q = query(
        collection(firestore, this.COLLECTION),
        where('testId', '==', testId),
        where('studentId', '==', studentId)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as InClassSubmission;
    } catch (error) {
      console.error('Error getting student submission:', error);
      throw error;
    }
  }

  // Upload a teacher-marked PDF to Firebase Storage and return the download URL
  static async uploadMarkedPdf(file: Blob | File, testId: string, studentId: string): Promise<string> {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('@/utils/firebase-client');
      const storageRef = ref(storage, `markedPdfs/${testId}/${studentId}_${Date.now()}.pdf`);
      const result = await uploadBytes(storageRef, file);
      return getDownloadURL(result.ref);
    } catch (error) {
      console.error('Error uploading marked PDF:', error);
      throw error;
    }
  }

  // Save the marked PDF URL back to the submission document
  static async saveMarkedPdf(submissionId: string, markedPdfUrl: string): Promise<void> {
    try {
      const docRef = doc(firestore, this.COLLECTION, submissionId);
      await updateDoc(docRef, { markedPdfUrl, updatedAt: Timestamp.now() });
    } catch (error) {
      console.error('Error saving marked PDF URL:', error);
      throw error;
    }
  }

  // Update grade for a submission
  static async gradeSubmission(
    submissionId: string,
    marks: number,
    feedback: string,
    teacherId: string,
    totalMarks: number
  ): Promise<void> {
    try {
      const docRef = doc(firestore, this.COLLECTION, submissionId);
      await updateDoc(docRef, {
        marks,
        totalMarks,
        feedback,
        gradedBy: teacherId,
        gradedAt: Timestamp.now(),
        status: 'graded',
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error grading submission:', error);
      throw error;
    }
  }
}
