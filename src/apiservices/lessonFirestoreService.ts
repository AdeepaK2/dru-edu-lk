import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { firestore as db } from '@/utils/firebase-client';
import {
  LessonData,
  LessonDocument,
  LessonSetData,
  LessonSetDocument,
  validateLessonData,
  validateLessonSetData,
} from '@/models/lessonSchema';

// Utility function to safely convert timestamps to Date objects
const convertTimestampToDate = (timestamp: any): Date => {
  if (!timestamp) {
    return new Date();
  }
  
  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // If it's a Firestore Timestamp with toDate method
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // If it's a timestamp-like object with seconds
  if (timestamp && typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000);
  }
  
  // If it's a number (Unix timestamp)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  // If it's a string, try to parse it
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  
  // Fallback to current date
  return new Date();
};

const LESSONS_COLLECTION = 'lessons';
const LESSON_SETS_COLLECTION = 'lessonSets';

export class LessonFirestoreService {
  // Lesson CRUD operations
  static async createLesson(lessonData: LessonData): Promise<string> {
    try {
      const validatedData = validateLessonData(lessonData);
      
      const docRef = await addDoc(collection(db, LESSONS_COLLECTION), {
        ...validatedData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating lesson:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create lesson');
    }
  }

  static async updateLesson(lessonId: string, lessonData: Partial<LessonData>): Promise<void> {
    try {
      const docRef = doc(db, LESSONS_COLLECTION, lessonId);
      
      await updateDoc(docRef, {
        ...lessonData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating lesson:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update lesson');
    }
  }

  static async deleteLesson(lessonId: string): Promise<void> {
    try {
      const docRef = doc(db, LESSONS_COLLECTION, lessonId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting lesson:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete lesson');
    }
  }
  static async getLesson(lessonId: string): Promise<LessonDocument | null> {
    try {
      const docRef = doc(db, LESSONS_COLLECTION, lessonId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt),
          updatedAt: convertTimestampToDate(data.updatedAt),
        } as LessonDocument;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting lesson:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get lesson');
    }
  }

  static async getLessonsBySubject(subjectId: string): Promise<LessonDocument[]> {
    try {
      const q = query(
        collection(db, LESSONS_COLLECTION),
        where('subjectId', '==', subjectId),
        orderBy('order', 'asc')
      );
        const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt),
          updatedAt: convertTimestampToDate(data.updatedAt),
        } as LessonDocument;
      });
    } catch (error) {
      console.error('Error getting lessons by subject:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get lessons');
    }
  }

  static subscribeToLessonsBySubject(
    subjectId: string,
    onSuccess: (lessons: LessonDocument[]) => void,
    onError: (error: Error) => void
  ): () => void {
    const q = query(
      collection(db, LESSONS_COLLECTION),
      where('subjectId', '==', subjectId),
      orderBy('order', 'asc')
    );

    return onSnapshot(
      q,
      (querySnapshot) => {        const lessons = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: convertTimestampToDate(data.createdAt),
            updatedAt: convertTimestampToDate(data.updatedAt),
          } as LessonDocument;
        });
        onSuccess(lessons);
      },
      (error) => {
        console.error('Error in lessons subscription:', error);
        onError(new Error(error.message || 'Failed to subscribe to lessons'));
      }
    );
  }

  // Lesson Set CRUD operations
  static async createLessonSet(lessonSetData: LessonSetData): Promise<string> {
    try {
      const validatedData = validateLessonSetData(lessonSetData);
      
      const docRef = await addDoc(collection(db, LESSON_SETS_COLLECTION), {
        ...validatedData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lessonCount: 0,
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating lesson set:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create lesson set');
    }
  }

  static async updateLessonSet(lessonSetId: string, lessonSetData: Partial<LessonSetData>): Promise<void> {
    try {
      const docRef = doc(db, LESSON_SETS_COLLECTION, lessonSetId);
      
      await updateDoc(docRef, {
        ...lessonSetData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating lesson set:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update lesson set');
    }
  }

  static async deleteLessonSet(lessonSetId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Delete the lesson set
      const lessonSetRef = doc(db, LESSON_SETS_COLLECTION, lessonSetId);
      batch.delete(lessonSetRef);
      
      // Note: You might want to also delete associated lessons or handle them differently
      // For now, we'll just delete the lesson set document
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting lesson set:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete lesson set');
    }
  }
  static async getLessonSet(lessonSetId: string): Promise<LessonSetDocument | null> {
    try {
      const docRef = doc(db, LESSON_SETS_COLLECTION, lessonSetId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt),
          updatedAt: convertTimestampToDate(data.updatedAt),
        } as LessonSetDocument;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting lesson set:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get lesson set');
    }
  }

  static async getLessonSetsBySubject(subjectId: string): Promise<LessonSetDocument[]> {
    try {
      const q = query(
        collection(db, LESSON_SETS_COLLECTION),
        where('subjectId', '==', subjectId),
        orderBy('order', 'asc')
      );
        const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt),
          updatedAt: convertTimestampToDate(data.updatedAt),
        } as LessonSetDocument;
      });
    } catch (error) {
      console.error('Error getting lesson sets by subject:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get lesson sets');
    }
  }

  static subscribeToLessonSetsBySubject(
    subjectId: string,
    onSuccess: (lessonSets: LessonSetDocument[]) => void,
    onError: (error: Error) => void
  ): () => void {
    const q = query(
      collection(db, LESSON_SETS_COLLECTION),
      where('subjectId', '==', subjectId),
      orderBy('order', 'asc')
    );

    return onSnapshot(
      q,
      (querySnapshot) => {        const lessonSets = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: convertTimestampToDate(data.createdAt),
            updatedAt: convertTimestampToDate(data.updatedAt),
          } as LessonSetDocument;
        });
        onSuccess(lessonSets);
      },
      (error) => {
        console.error('Error in lesson sets subscription:', error);
        onError(new Error(error.message || 'Failed to subscribe to lesson sets'));
      }
    );
  }

  // Utility functions
  static async updateLessonSetCount(lessonSetId: string): Promise<void> {
    try {
      // Count lessons in this set and update the lesson set document
      const lessonsQuery = query(
        collection(db, LESSONS_COLLECTION),
        where('lessonSetId', '==', lessonSetId)
      );
      
      const querySnapshot = await getDocs(lessonsQuery);
      const lessonCount = querySnapshot.size;
      
      const lessonSetRef = doc(db, LESSON_SETS_COLLECTION, lessonSetId);
      await updateDoc(lessonSetRef, {
        lessonCount,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating lesson set count:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update lesson set count');
    }
  }
}
