
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { firestore as db } from '@/utils/firebase-client';
import { ClassCompletionDocument } from '@/models/classCompletionSchema';

const COLLECTION_NAME = 'classCompletions';

export class ClassCompletionService {

  /**
   * Mark a class as finished for a specific date
   */
  static async markClassFinished(
    classId: string, 
    teacherId: string,
    scheduledDate: string, // YYYY-MM-DD
    startTime: string,
    endTime: string
  ): Promise<void> {
    try {
      const completionId = `${classId}_${scheduledDate}`;
      const docRef = doc(db, COLLECTION_NAME, completionId);
      
      const now = Timestamp.now();
      
      // Check if already exists to distinguish create vs update if needed (here we upsert)
      const data: ClassCompletionDocument = {
        id: completionId,
        classId,
        teacherId,
        date: scheduledDate,
        finishedAt: now,
        classStartTime: startTime,
        classEndTime: endTime,
        status: 'finished',
        createdAt: now, // Ideally check existence effectively, but overwrite is fine for this logic
        updatedAt: now
      };

      // Use setDoc with merge to preserve createdAt if we were careful, 
      // but for "finishing" strict overwrite or merge is fine. 
      // Let's Read first to preserve createdAt if exists
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
          data.createdAt = existingSnap.data().createdAt;
      }
      
      await setDoc(docRef, data);
      
    } catch (error) {
      console.error('Error marking class as finished:', error);
      throw error;
    }
  }

  /**
   * Get completion status for a specific class on a specific date
   */
  static async getClassCompletion(classId: string, date: string): Promise<ClassCompletionDocument | null> {
    try {
      const completionId = `${classId}_${date}`;
      const docRef = doc(db, COLLECTION_NAME, completionId);
      const snapshot = await getDoc(docRef);
      
      if (!snapshot.exists()) return null;
      
      return snapshot.data() as ClassCompletionDocument;
    } catch (error) {
      console.error('Error getting class completion:', error);
      throw error;
    }
  }
}
