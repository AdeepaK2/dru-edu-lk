import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  Timestamp,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { ClassData, ClassDocument, ClassUpdateData, classSchema } from '@/models/classSchema';

const COLLECTION_NAME = 'classes';

export class ClassFirestoreService {
  private static collectionRef = collection(firestore, COLLECTION_NAME);

  /**
   * Generate a unique class ID
   */
  private static async generateClassId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CLS-${year}-`;
    
    // Query existing classes to find the highest number for this year
    const q = query(
      this.collectionRef,
      where('classId', '>=', prefix),
      where('classId', '<', `CLS-${year + 1}-`),
      orderBy('classId', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    let nextNumber = 1;
    if (!snapshot.empty) {
      const lastClassId = snapshot.docs[0].data().classId;
      const lastNumber = parseInt(lastClassId.split('-')[2]);
      nextNumber = lastNumber + 1;
    }
    
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Create a new class
   */
  static async createClass(classData: ClassData): Promise<string> {
    try {
      // Validate the data
      const validatedData = classSchema.parse(classData);
      
      // Generate auto class ID
      const classId = await this.generateClassId();
      
      // Prepare the document data, filtering out undefined values
      const documentData: any = {
        name: validatedData.name,
        centerId: validatedData.centerId,
        year: validatedData.year,
        subject: validatedData.subject,
        subjectId: validatedData.subjectId,
        schedule: validatedData.schedule,
        sessionFee: validatedData.sessionFee,
        classId,
        status: 'Active' as const,
        enrolledStudents: 0,
        waitingList: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        // createdBy: currentUserId, // You can add this when you have auth context
        // lastModifiedBy: currentUserId,
      };

      // Only add optional fields if they have values
      if (validatedData.description && validatedData.description.trim()) {
        documentData.description = validatedData.description;
      }
      
      if (validatedData.teacherId && validatedData.teacherId.trim()) {
        documentData.teacherId = validatedData.teacherId;
      }

      const docRef = await addDoc(this.collectionRef, documentData);
      console.log('Class created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating class:', error);
      throw new Error(`Failed to create class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * Get all classes
   */
  static async getAllClasses(): Promise<ClassDocument[]> {
    try {
      const q = query(this.collectionRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassDocument));
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw new Error(`Failed to fetch classes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * Get a specific class by ID
   */
  static async getClassById(classId: string): Promise<ClassDocument | null> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, classId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as ClassDocument;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching class:', error);
      throw new Error(`Failed to fetch class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a class
   */
  static async updateClass(classId: string, updateData: Partial<ClassData>): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, classId);
      
      // Filter out undefined values from updateData
      const cleanUpdateData: any = {
        updatedAt: Timestamp.now(),
        // lastModifiedBy: currentUserId, // You can add this when you have auth context
      };

      // Only add fields that have defined values
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // For string fields, also check if they're not empty
          if (typeof value === 'string' && value.trim() === '') {
            return; // Skip empty strings
          }
          cleanUpdateData[key] = value;
        }
      });

      await updateDoc(docRef, cleanUpdateData);
      console.log('Class updated successfully');
    } catch (error) {
      console.error('Error updating class:', error);
      throw new Error(`Failed to update class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a class
   */
  static async deleteClass(classId: string): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, classId);
      await deleteDoc(docRef);
      console.log('Class deleted successfully');
    } catch (error) {
      console.error('Error deleting class:', error);
      throw new Error(`Failed to delete class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to real-time updates for all classes
   */
  static subscribeToClasses(
    onSuccess: (classes: ClassDocument[]) => void,
    onError: (error: Error) => void
  ): () => void {
    try {
      const q = query(this.collectionRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {          const classes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as ClassDocument));
          
          onSuccess(classes);
        },
        (error) => {
          console.error('Real-time subscription error:', error);
          onError(new Error(`Real-time subscription failed: ${error.message}`));
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
      onError(new Error(`Failed to setup subscription: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return () => {}; // Return empty unsubscribe function
    }
  }
  /**
   * Get classes by center ID
   */
  static async getClassesByCenter(centerId: '1' | '2'): Promise<ClassDocument[]> {
    try {
      const q = query(
        this.collectionRef, 
        where('centerId', '==', centerId),
        orderBy('createdAt', 'desc')
      );      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassDocument));
    } catch (error) {
      console.error('Error fetching classes by center:', error);
      throw new Error(`Failed to fetch classes by center: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get classes by subject
   */
  static async getClassesBySubject(subject: string): Promise<ClassDocument[]> {
    try {
      const q = query(
        this.collectionRef, 
        where('subject', '==', subject),
        orderBy('createdAt', 'desc')
      );      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassDocument));
    } catch (error) {
      console.error('Error fetching classes by subject:', error);
      throw new Error(`Failed to fetch classes by subject: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get classes by year
   */
  static async getClassesByYear(year: string): Promise<ClassDocument[]> {
    try {
      const q = query(
        this.collectionRef, 
        where('year', '==', year),
        orderBy('createdAt', 'desc')
      );      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassDocument));
    } catch (error) {
      console.error('Error fetching classes by year:', error);
      throw new Error(`Failed to fetch classes by year: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update student count for a class
   */
  static async updateStudentCount(classId: string, enrolledStudents: number, waitingList: number = 0): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, classId);
      await updateDoc(docRef, {
        enrolledStudents,
        waitingList,
        updatedAt: Timestamp.now(),
      });
      console.log('Student count updated successfully');
    } catch (error) {
      console.error('Error updating student count:', error);
      throw new Error(`Failed to update student count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * Update class status
   */
  static async updateClassStatus(classId: string, status: 'Active' | 'Inactive' | 'Suspended'): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, classId);
      await updateDoc(docRef, {
        status,
        updatedAt: Timestamp.now(),
      });
      console.log('Class status updated successfully');
    } catch (error) {
      console.error('Error updating class status:', error);
      throw new Error(`Failed to update class status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assign teacher to class
   */
  static async assignTeacher(classId: string, teacherId: string): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, classId);
      await updateDoc(docRef, {
        teacherId,
        updatedAt: Timestamp.now(),
      });
      console.log('Teacher assigned successfully');
    } catch (error) {
      console.error('Error assigning teacher:', error);
      throw new Error(`Failed to assign teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove teacher from class
   */
  static async removeTeacher(classId: string): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, classId);
      await updateDoc(docRef, {
        teacherId: null,
        updatedAt: Timestamp.now(),
      });
      console.log('Teacher removed successfully');
    } catch (error) {
      console.error('Error removing teacher:', error);
      throw new Error(`Failed to remove teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get classes by teacher ID
   */
  static async getClassesByTeacher(teacherId: string): Promise<ClassDocument[]> {
    try {
      console.log('🔍 Searching for classes with teacherId:', teacherId);
      
      // Use only the where clause to avoid composite index requirement
      const q = query(
        this.collectionRef,
        where('teacherId', '==', teacherId)
      );
      
      const snapshot = await getDocs(q);
      console.log('🔍 Raw query returned', snapshot.docs.length, 'documents');
      
      // Log all documents to see what's actually in the database
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`🔍 Class ${index + 1}:`, {
          id: doc.id,
          name: data.name,
          teacherId: data.teacherId,
          status: data.status
        });
      });
      
      const classes = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as ClassDocument;
      })
      // Filter for active classes in JavaScript instead of in the query
      .filter(cls => cls.status === 'Active')
      // Sort by name in JavaScript
      .sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('✅ After filtering, returning', classes.length, 'active classes');
      return classes;
    } catch (error) {
      console.error('Error fetching classes by teacher:', error);
      throw new Error(`Failed to fetch classes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Debug method: Get all classes to inspect teacherId values
   */
  static async getAllClassesForDebug(): Promise<ClassDocument[]> {
    try {
      const snapshot = await getDocs(this.collectionRef);
      console.log('🔍 Total classes in database:', snapshot.docs.length);
      
      const classes = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log('🔍 Class debug:', {
          id: doc.id,
          name: data.name,
          teacherId: data.teacherId,
          status: data.status,
          subject: data.subject
        });
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as ClassDocument;
      });
      
      return classes;
    } catch (error) {
      console.error('Error fetching all classes:', error);
      throw error;
    }
  }

  /**
   * Get classes by student ID (classes that student is enrolled in)
   */
  static async getClassesByStudent(studentId: string): Promise<ClassDocument[]> {
    try {
      // Note: This assumes there's a field in the class document that tracks enrolled students
      // You might need to adjust this based on your actual data structure
      const q = query(
        this.collectionRef,
        where('enrolledStudentIds', 'array-contains', studentId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      const classes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassDocument));
      
      return classes;
    } catch (error) {
      console.error('Error fetching classes by student:', error);
      // If the above query fails (e.g., due to missing index), try a different approach
      // You might need to implement this differently based on your enrollment system
      return [];
    }
  }

  /**
   * Update Zoom link for a class
   */
  static async updateZoomLink(classId: string, zoomLink: string): Promise<void> {
    try {
      const docRef = doc(this.collectionRef, classId);
      await updateDoc(docRef, {
        zoomLink: zoomLink.trim() || null,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating class Zoom link:', error);
      throw new Error(`Failed to update Zoom link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}
