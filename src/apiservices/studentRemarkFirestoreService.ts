import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  StudentRemark, 
  StudentRemarkDocument, 
  StudentRemarkData,
  StudentRemarkUpdateData,
  convertTimestampToDate,
  convertDateToTimestamp
} from '@/models/studentRemarkSchema';

export class StudentRemarkFirestoreService {
  private static collectionRef = collection(firestore, 'studentRemarks');

  /**
   * Create a new student remark
   */
  static async createRemark(remarkData: StudentRemarkData): Promise<string> {
    try {
      console.log('📝 Creating student remark:', remarkData);

      // Filter out undefined values for Firestore
      const cleanData = Object.fromEntries(
        Object.entries(remarkData).filter(([_, value]) => value !== undefined)
      );

      const docData = {
        ...cleanData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(this.collectionRef, docData);
      console.log('✅ Student remark created with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating student remark:', error);
      throw new Error(`Failed to create student remark: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing student remark
   */
  static async updateRemark(remarkId: string, updateData: StudentRemarkUpdateData): Promise<void> {
    try {
      console.log('📝 Updating student remark:', remarkId, updateData);

      // Filter out undefined values for Firestore
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );

      const docRef = doc(this.collectionRef, remarkId);
      const docData = {
        ...cleanData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(docRef, docData);
      console.log('✅ Student remark updated successfully');
    } catch (error) {
      console.error('❌ Error updating student remark:', error);
      throw new Error(`Failed to update student remark: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a student remark
   */
  static async deleteRemark(remarkId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting student remark:', remarkId);

      const docRef = doc(this.collectionRef, remarkId);
      await deleteDoc(docRef);
      
      console.log('✅ Student remark deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting student remark:', error);
      throw new Error(`Failed to delete student remark: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get remark for a specific student in a specific class
   */
  static async getStudentRemarkInClass(studentId: string, classId: string): Promise<StudentRemark | null> {
    try {
      console.log('🔍 Getting student remark for studentId:', studentId, 'classId:', classId);

      const q = query(
        this.collectionRef,
        where('studentId', '==', studentId),
        where('classId', '==', classId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      // Sort by updatedAt in JavaScript and get the most recent one
      const remarks = querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<StudentRemarkDocument, 'id'>;
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt as Timestamp),
          updatedAt: convertTimestampToDate(data.updatedAt as Timestamp),
        };
      });

      // Return the most recent remark
      const sortedRemarks = remarks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return sortedRemarks[0];
    } catch (error) {
      console.error('❌ Error getting student remark:', error);
      return null;
    }
  }

  /**
   * Get all remarks for a specific class
   */
  static async getRemarksByClass(classId: string): Promise<StudentRemark[]> {
    try {
      console.log('🔍 Getting all remarks for classId:', classId);

      const q = query(
        this.collectionRef,
        where('classId', '==', classId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      console.log('📋 Found remarks:', querySnapshot.size);

      return querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<StudentRemarkDocument, 'id'>;
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt as Timestamp),
          updatedAt: convertTimestampToDate(data.updatedAt as Timestamp),
        };
      });
    } catch (error) {
      console.error('❌ Error getting remarks by class:', error);
      throw new Error(`Failed to get remarks by class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all remarks for a specific student across all classes
   */
  static async getRemarksByStudent(studentId: string): Promise<StudentRemark[]> {
    try {
      console.log('🔍 Getting all remarks for studentId:', studentId);

      const q = query(
        this.collectionRef,
        where('studentId', '==', studentId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      console.log('📋 Found remarks for student:', querySnapshot.size);

      return querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<StudentRemarkDocument, 'id'>;
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt as Timestamp),
          updatedAt: convertTimestampToDate(data.updatedAt as Timestamp),
        };
      });
    } catch (error) {
      console.error('❌ Error getting remarks by student:', error);
      throw new Error(`Failed to get remarks by student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get visible remarks for a specific student (what the student can see)
   */
  static async getVisibleRemarksByStudent(studentId: string): Promise<StudentRemark[]> {
    try {
      console.log('🔍 Getting visible remarks for studentId:', studentId);

      const q = query(
        this.collectionRef,
        where('studentId', '==', studentId),
        where('isVisible', '==', true)
      );

      const querySnapshot = await getDocs(q);
      console.log('📋 Found visible remarks for student:', querySnapshot.size);

      const remarks = querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<StudentRemarkDocument, 'id'>;
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt as Timestamp),
          updatedAt: convertTimestampToDate(data.updatedAt as Timestamp),
        };
      });

      // Sort by updatedAt in JavaScript instead of Firestore to avoid index requirement
      return remarks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('❌ Error getting visible remarks by student:', error);
      throw new Error(`Failed to get visible remarks by student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get remarks created by a specific teacher
   */
  static async getRemarksByTeacher(teacherId: string): Promise<StudentRemark[]> {
    try {
      console.log('🔍 Getting all remarks by teacherId:', teacherId);

      const q = query(
        this.collectionRef,
        where('teacherId', '==', teacherId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      console.log('📋 Found remarks by teacher:', querySnapshot.size);

      return querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<StudentRemarkDocument, 'id'>;
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToDate(data.createdAt as Timestamp),
          updatedAt: convertTimestampToDate(data.updatedAt as Timestamp),
        };
      });
    } catch (error) {
      console.error('❌ Error getting remarks by teacher:', error);
      throw new Error(`Failed to get remarks by teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a remark exists for a student in a class
   */
  static async remarkExists(studentId: string, classId: string): Promise<boolean> {
    try {
      const remark = await this.getStudentRemarkInClass(studentId, classId);
      return remark !== null;
    } catch (error) {
      console.error('❌ Error checking if remark exists:', error);
      return false;
    }
  }
}