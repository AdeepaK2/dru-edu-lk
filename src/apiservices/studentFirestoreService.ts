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
  limit
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { studentSchema, studentUpdateSchema } from '@/models/studentSchema';

const COLLECTION_NAME = 'students';

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Suspended' | 'Inactive';
}

export interface EnhancedStudentListItem extends StudentListItem {
  enrolledClasses: Array<{
    classId: string;
    className: string;
    subject: string;
    status: 'Active' | 'Inactive' | 'Completed' | 'Dropped';
  }>;
}

export class StudentFirestoreService {
  private static collectionRef = collection(firestore, COLLECTION_NAME);

  /**
   * Get all students with their enrollment information
   */
  static async getAllStudentsWithEnrollments(): Promise<EnhancedStudentListItem[]> {
    try {
      const q = query(this.collectionRef, orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const students = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email,
        status: doc.data().status,
      }));

      // Get enrollments for all students
      const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
      
      const studentsWithEnrollments = await Promise.all(
        students.map(async (student) => {
          try {
            const enrollments = await getEnrollmentsByStudent(student.id);
            const enrolledClasses = enrollments.map(enrollment => ({
              classId: enrollment.classId,
              className: enrollment.className,
              subject: enrollment.subject,
              status: enrollment.status
            }));
            
            return {
              ...student,
              enrolledClasses
            } as EnhancedStudentListItem;
          } catch (error) {
            console.error(`Error fetching enrollments for student ${student.id}:`, error);
            return {
              ...student,
              enrolledClasses: []
            } as EnhancedStudentListItem;
          }
        })
      );
      
      return studentsWithEnrollments;
    } catch (error) {
      console.error('Error fetching students with enrollments:', error);
      throw new Error(`Failed to fetch students with enrollments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all students
   */  static async getAllStudents(): Promise<StudentListItem[]> {
    try {
      const q = query(this.collectionRef, orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email,
        status: doc.data().status,
      }));
    } catch (error) {
      console.error('Error fetching students:', error);
      throw new Error(`Failed to fetch students: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get students by class ID using enrollment system
   */
  static async getStudentsByClass(classId: string): Promise<StudentListItem[]> {
    console.log(`🔍 Querying students for class: ${classId}`);
    
    try {
      // Use the enrollment system to get students for the class
      const { getEnrollmentsByClass } = await import('@/services/studentEnrollmentService');
      console.log(`📊 Getting enrollments for class: ${classId}`);
      
      const enrollments = await getEnrollmentsByClass(classId);
      console.log(`✅ Found ${enrollments.length} enrollments`);
      
      // Convert enrollments to student list items
      const students = enrollments
        .filter(enrollment => enrollment.status === 'Active') // Only active enrollments
        .map(enrollment => ({
          id: enrollment.studentId,
          name: enrollment.studentName,
          email: enrollment.studentEmail,
          status: 'Active' as const, // Set status based on enrollment
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
      
      console.log(`📋 Active students:`, students);
      return students;
    } catch (error) {
      console.error(`❌ Error fetching students for class ${classId}:`, error);
      
      // Fallback: Return empty array instead of throwing
      console.warn(`🔄 Returning empty student list for class ${classId}`);
      return [];
    }
  }

  /**
   * Get student by ID
   */
  static async getStudentById(studentId: string): Promise<any> {
    try {
      const docRef = doc(this.collectionRef, studentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching student:', error);
      throw new Error(`Failed to fetch student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get students by ID list
   */
  static async getStudentsByIds(studentIds: string[]): Promise<Record<string, string>> {
    if (!studentIds.length) return {};
    
    try {
      const studentNames: Record<string, string> = {};
      
      // Firebase doesn't support 'in' queries with more than 10 items
      // Processing in chunks if needed
      const chunkSize = 10;
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize);
        
        const q = query(
          this.collectionRef,
          where('__name__', 'in', chunk)
        );
        
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          studentNames[doc.id] = doc.data().name;
        });
      }
      
      return studentNames;
    } catch (error) {
      console.error('Error fetching student names:', error);
      return {};
    }
  }
}
