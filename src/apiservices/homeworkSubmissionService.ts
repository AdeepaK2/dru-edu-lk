import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { firestore as db } from '@/utils/firebase-client';
import { HomeworkSubmission, HomeworkSubmissionDocument, HomeworkSubmissionStatus, TeacherMark } from '@/models/homeworkSubmissionSchema';
import { StudyMaterialDocument } from '@/models/studyMaterialSchema';

const COLLECTION_NAME = 'studyMaterials';
const SUBMISSIONS_COLLECTION = 'submissions';

export class HomeworkSubmissionService {

  /**
   * Submit homework for a student
   */
  static async submitHomework(
    studyMaterialId: string,
    studentId: string,
    data: {
      classId: string;
      studentName: string;
      files: { url: string; name: string; type?: string; size?: number }[];
      message?: string;
    }
  ): Promise<void> {
    try {
      // Check if material exists and get deadline
      const materialRef = doc(db, COLLECTION_NAME, studyMaterialId);
      const materialSnap = await getDoc(materialRef);
      
      if (!materialSnap.exists()) {
        throw new Error('Study material not found');
      }
      
      const materialData = materialSnap.data() as StudyMaterialDocument;
      
      // Determine status (Late or Submitted)
      const now = new Date();
      let status: HomeworkSubmissionStatus = 'submitted';
      
      if (materialData.dueDate) {
        const deadline = materialData.dueDate instanceof Timestamp 
          ? materialData.dueDate.toDate() 
          : new Date(materialData.dueDate as any); // Fallback
          
        if (now > deadline) {
          status = 'late';
        }
      }

      const submissionRef = doc(db, COLLECTION_NAME, studyMaterialId, SUBMISSIONS_COLLECTION, studentId);
      
      // Check for existing submission to increment attempt number and handle resubmission
      const existingSnap = await getDoc(submissionRef);
      let attemptNumber = 1;
      let isResubmission = false;
      let revisions: any[] = [];

      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        attemptNumber = (existingData.attemptNumber || 0) + 1;
        revisions = existingData.revisions || [];

        if (existingData.status === 'resubmit_needed' || existingData.teacherMark === 'Not Sufficient') {
          isResubmission = true;
          
          // Archive the current submission before overwriting
          revisions.push({
            files: existingData.files || [],
            message: existingData.message || null,
            submittedAt: existingData.submittedAt,
            // Grading info for history
            teacherMark: existingData.teacherMark || null,
            teacherRemarks: existingData.teacherRemarks || null,
            numericMark: existingData.numericMark || null,
            markedAt: existingData.markedAt || null,
            markedBy: existingData.markedBy || null
          });
        }
      }

      const submissionData: any = {
        id: studentId,
        studyMaterialId,
        classId: data.classId,
        studentId,
        studentName: data.studentName,
        status,
        files: data.files,
        message: data.message || '',
        submittedAt: Timestamp.fromDate(now),
        attemptNumber,
        createdAt: existingSnap.exists() ? existingSnap.data().createdAt : Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        revisions: revisions
      };

      if (isResubmission) {
        // Clear grading fields for the new attempt
        submissionData.teacherMark = null;
        submissionData.teacherRemarks = null;
        submissionData.numericMark = null;
        submissionData.markedAt = null;
        submissionData.markedBy = null;
        // Ensure status is submitted (or late), overriding 'resubmit_needed'
        submissionData.status = status; 
      }

      await setDoc(submissionRef, submissionData, { merge: true });
      
    } catch (error) {
      console.error('Error submitting homework:', error);
      throw error;
    }
  }

  /**
   * Get all submissions for a study material
   */
  static async getSubmissionsForMaterial(studyMaterialId: string): Promise<HomeworkSubmissionDocument[]> {
    try {
      const submissionsRef = collection(db, COLLECTION_NAME, studyMaterialId, SUBMISSIONS_COLLECTION);
      const q = query(submissionsRef, orderBy('submittedAt', 'desc'));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          // timestamps converted implicitly strictly speaking but let's be safe if using the Document type
        } as HomeworkSubmissionDocument;
      });
    } catch (error) {
      console.error('Error getting submissions:', error);
      throw error;
    }
  }

  /**
   * Get a specific student's submission
   */
  static async getStudentSubmission(studyMaterialId: string, studentId: string): Promise<HomeworkSubmissionDocument | null> {
    try {
      const submissionRef = doc(db, COLLECTION_NAME, studyMaterialId, SUBMISSIONS_COLLECTION, studentId);
      const snapshot = await getDoc(submissionRef);
      
      if (!snapshot.exists()) return null;
      
      return {
        ...snapshot.data(),
        id: snapshot.id
      } as HomeworkSubmissionDocument;
    } catch (error) {
      console.error('Error getting student submission:', error);
      throw error;
    }
  }

  /**
   * Mark a submission
   */
  static async markSubmission(
    studyMaterialId: string,
    studentId: string,
    data: {
      teacherMark: TeacherMark;
      teacherRemarks?: string;
      numericMark?: number;
      markedBy: string;
    }
  ): Promise<void> {
    try {
      const submissionRef = doc(db, COLLECTION_NAME, studyMaterialId, SUBMISSIONS_COLLECTION, studentId);
      
      const now = new Date();
      let status: HomeworkSubmissionStatus = 'approved';
      let resubmissionDeadline = null;

      if (data.teacherMark === 'Not Sufficient') {
        status = 'resubmit_needed';
        // Set resubmission deadline to 3 days from now
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + 3);
        resubmissionDeadline = Timestamp.fromDate(deadlineDate);
      }

      const updateData: any = {
        teacherMark: data.teacherMark,
        teacherRemarks: data.teacherRemarks || '',
        markedAt: Timestamp.fromDate(now),
        markedBy: data.markedBy,
        status,
        updatedAt: Timestamp.fromDate(now)
      };

      if (data.numericMark !== undefined) {
        updateData.numericMark = data.numericMark;
      }

      if (resubmissionDeadline) {
        updateData.resubmissionDeadline = resubmissionDeadline;
      }

      await updateDoc(submissionRef, updateData);
      
    } catch (error) {
      console.error('Error marking submission:', error);
      throw error;
    }
  }
}
