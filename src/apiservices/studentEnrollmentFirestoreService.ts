import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  Firestore 
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { StudentEnrollmentDocument } from '@/models/studentEnrollmentSchema';

// Enhanced enrollment data with parent info
export interface EnrollmentWithParent extends StudentEnrollmentDocument {
  parent?: {
    name: string;
    email: string;
    phone: string;
  };
}

export class StudentEnrollmentFirestoreService {
  private static collectionRef = collection(firestore, 'studentEnrollments');

  /**
   * Get all enrolled students for a specific class with parent information
   */
  static async getEnrolledStudentsByClassId(classId: string): Promise<EnrollmentWithParent[]> {
    try {
      console.log('🔍 Loading enrolled students for classId:', classId);
      
      const q = query(
        this.collectionRef,
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      
      const querySnapshot = await getDocs(q);
      console.log('📋 Found enrolled students:', querySnapshot.size);
      
      const students: EnrollmentWithParent[] = [];
      
      // Get enrollment data and fetch parent info from student documents
      const studentPromises = querySnapshot.docs.map(async (enrollmentDoc) => {
        const enrollmentData = enrollmentDoc.data() as StudentEnrollmentDocument;
        
        try {
          // Fetch the actual student document to get parent information
          const studentDocRef = doc(firestore, 'students', enrollmentData.studentId);
          const studentDoc = await getDoc(studentDocRef);
          
          let parentInfo = undefined;
          if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            if (studentData.parent) {
              parentInfo = {
                name: studentData.parent.name,
                email: studentData.parent.email,
                phone: studentData.parent.phone
              };
            }
          }
          
          return {
            ...enrollmentData,
            id: enrollmentDoc.id,
            parent: parentInfo
          } as EnrollmentWithParent;
          
        } catch (studentError) {
          console.warn(`⚠️ Could not fetch parent info for student ${enrollmentData.studentId}:`, studentError);
          // Return enrollment without parent info
          return {
            ...enrollmentData,
            id: enrollmentDoc.id
          } as EnrollmentWithParent;
        }
      });
      
      const studentsWithParent = await Promise.all(studentPromises);
      students.push(...studentsWithParent);
      
      console.log('✅ Processed enrolled students with parent info:', students.length);
      return students;
      
    } catch (error) {
      console.error('❌ Error loading enrolled students:', error);
      throw new Error(`Failed to load enrolled students: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific student enrollment by student ID and class ID
   */
  static async getStudentEnrollment(studentId: string, classId: string): Promise<StudentEnrollmentDocument | null> {
    try {
      const q = query(
        this.collectionRef,
        where('studentId', '==', studentId),
        where('classId', '==', classId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as StudentEnrollmentDocument;
      
    } catch (error) {
      console.error('❌ Error loading student enrollment:', error);
      return null;
    }
  }

  /**
   * Get enrolled students count for a class
   */
  static async getEnrolledStudentsCount(classId: string): Promise<number> {
    try {
      const students = await this.getEnrolledStudentsByClassId(classId);
      return students.length;
    } catch (error) {
      console.error('❌ Error getting enrolled students count:', error);
      return 0;
    }
  }

  /**
   * Get all enrollments for a specific student
   */
  static async getEnrollmentsByStudentId(studentId: string): Promise<StudentEnrollmentDocument[]> {
    try {
      const q = query(
        this.collectionRef,
        where('studentId', '==', studentId)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentEnrollmentDocument[];
      
    } catch (error) {
      console.error('❌ Error loading student enrollments:', error);
      throw new Error(`Failed to load student enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
