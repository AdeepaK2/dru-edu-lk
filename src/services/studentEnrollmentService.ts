import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  StudentEnrollment, 
  StudentEnrollmentDocument, 
  StudentEnrollmentData,
  StudentEnrollmentUpdateData,
  convertTimestampToDate,
  convertDateToTimestamp
} from '@/models/studentEnrollmentSchema';

const COLLECTION_NAME = 'studentEnrollments';

// Get reference to the enrollments collection
const getEnrollmentsCollection = () => collection(firestore, COLLECTION_NAME);

// Convert Firestore document to StudentEnrollment
const convertDocumentToEnrollment = (doc: any): StudentEnrollment => {
  const data = doc.data();
  return {
    id: doc.id,
    studentId: data.studentId,
    classId: data.classId,
    studentName: data.studentName,
    studentEmail: data.studentEmail,
    className: data.className,
    subject: data.subject,
    enrolledAt: convertTimestampToDate(data.enrolledAt),
    status: data.status,
    grade: data.grade,
    attendance: data.attendance || 0,
    notes: data.notes,
  };
};

// Convert StudentEnrollmentData to Firestore document data
const convertEnrollmentToDocument = (enrollment: StudentEnrollmentData) => {
  const docData: any = {
    studentId: enrollment.studentId,
    classId: enrollment.classId,
    studentName: enrollment.studentName,
    studentEmail: enrollment.studentEmail,
    className: enrollment.className,
    subject: enrollment.subject,
    enrolledAt: convertDateToTimestamp(enrollment.enrolledAt),
    status: enrollment.status,
    attendance: enrollment.attendance,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Only add optional fields if they are defined
  if (enrollment.grade !== undefined) {
    docData.grade = enrollment.grade;
  }
  
  if (enrollment.notes !== undefined) {
    docData.notes = enrollment.notes;
  }

  return docData;
};

/**
 * Create a new student enrollment
 */
export const createStudentEnrollment = async (enrollmentData: StudentEnrollmentData): Promise<StudentEnrollment> => {
  try {
    // Check if enrollment already exists
    const existingEnrollment = await getEnrollmentByStudentAndClass(
      enrollmentData.studentId, 
      enrollmentData.classId
    );

    if (existingEnrollment) {
      throw new Error('Student is already enrolled in this class');
    }

    // Create the document
    const docData = convertEnrollmentToDocument(enrollmentData);
    const docRef = await addDoc(getEnrollmentsCollection(), docData);
    
    // Get the created document
    const createdDoc = await getDoc(docRef);
    if (!createdDoc.exists()) {
      throw new Error('Failed to create enrollment');
    }

    return convertDocumentToEnrollment(createdDoc);
  } catch (error) {
    console.error('Error creating student enrollment:', error);
    throw error;
  }
};

/**
 * Get enrollment by student ID and class ID
 */
export const getEnrollmentByStudentAndClass = async (
  studentId: string, 
  classId: string
): Promise<StudentEnrollment | null> => {
  try {
    const q = query(
      getEnrollmentsCollection(),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return convertDocumentToEnrollment(doc);
  } catch (error) {
    console.error('Error getting enrollment by student and class:', error);
    throw error;
  }
};

/**
 * Get all enrollments for a student
 */
export const getEnrollmentsByStudent = async (studentId: string): Promise<StudentEnrollment[]> => {
  try {
    const q = query(
      getEnrollmentsCollection(),
      where('studentId', '==', studentId)
    );

    const querySnapshot = await getDocs(q);
    const enrollments = querySnapshot.docs.map(convertDocumentToEnrollment);
    
    // Sort in JavaScript instead of Firestore to avoid index requirements
    return enrollments.sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
  } catch (error) {
    console.error('Error getting enrollments by student:', error);
    throw error;
  }
};

/**
 * Get all enrollments for a class
 */
export const getEnrollmentsByClass = async (classId: string): Promise<StudentEnrollment[]> => {
  try {
    const q = query(
      getEnrollmentsCollection(),
      where('classId', '==', classId)
    );

    const querySnapshot = await getDocs(q);
    const enrollments = querySnapshot.docs.map(convertDocumentToEnrollment);
    
    // Sort in JavaScript instead of Firestore to avoid index requirements
    return enrollments.sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
  } catch (error) {
    console.error('Error getting enrollments by class:', error);
    throw error;
  }
};

/**
 * Update a student enrollment
 */
export const updateStudentEnrollment = async (
  enrollmentId: string, 
  updateData: Partial<StudentEnrollmentUpdateData>
): Promise<StudentEnrollment> => {
  try {
    const docRef = doc(getEnrollmentsCollection(), enrollmentId);
    
    // Prepare update data
    const updatePayload: any = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    // Convert enrolledAt to Timestamp if provided
    if (updateData.enrolledAt) {
      updatePayload.enrolledAt = convertDateToTimestamp(updateData.enrolledAt);
    }

    await updateDoc(docRef, updatePayload);
    
    // Get the updated document
    const updatedDocSnapshot = await getDoc(docRef);
    if (!updatedDocSnapshot.exists()) {
      throw new Error('Enrollment not found');
    }

    return convertDocumentToEnrollment(updatedDocSnapshot);
  } catch (error) {
    console.error('Error updating student enrollment:', error);
    throw error;
  }
};

/**
 * Delete a student enrollment
 */
export const deleteStudentEnrollment = async (enrollmentId: string): Promise<void> => {
  try {
    const docRef = doc(getEnrollmentsCollection(), enrollmentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting student enrollment:', error);
    throw error;
  }
};

/**
 * Remove student from a specific class
 */
export const removeStudentFromClass = async (studentId: string, classId: string): Promise<void> => {
  try {
    const enrollment = await getEnrollmentByStudentAndClass(studentId, classId);
    
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    await deleteStudentEnrollment(enrollment.id);
  } catch (error) {
    console.error('Error removing student from class:', error);
    throw error;
  }
};

/**
 * Get all enrollments with pagination
 */
export const getAllEnrollments = async (limitCount: number = 50): Promise<StudentEnrollment[]> => {
  try {
    const q = query(
      getEnrollmentsCollection(),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertDocumentToEnrollment);
  } catch (error) {
    console.error('Error getting all enrollments:', error);
    throw error;
  }
};

/**
 * Delete all enrollments for a specific student
 * Used when deleting a student account
 */
export const deleteAllEnrollmentsByStudent = async (studentId: string): Promise<number> => {
  try {
    // Get all enrollments for the student
    const enrollments = await getEnrollmentsByStudent(studentId);
    
    if (enrollments.length === 0) {
      return 0;
    }
    
    // Delete all enrollments
    const deletePromises = enrollments.map(enrollment => 
      deleteStudentEnrollment(enrollment.id)
    );
    
    await Promise.all(deletePromises);
    
    console.log(`Deleted ${enrollments.length} enrollments for student ${studentId}`);
    return enrollments.length;
  } catch (error) {
    console.error('Error deleting all enrollments for student:', error);
    throw error;
  }
};

/**
 * Get enrollment statistics for a student
 */
export const getStudentEnrollmentStats = async (studentId: string) => {
  try {
    const enrollments = await getEnrollmentsByStudent(studentId);
    
    const stats = {
      totalEnrollments: enrollments.length,
      activeEnrollments: enrollments.filter(e => e.status === 'Active').length,
      completedEnrollments: enrollments.filter(e => e.status === 'Completed').length,
      droppedEnrollments: enrollments.filter(e => e.status === 'Dropped').length,
      averageGrade: 0,
      averageAttendance: 0,
    };

    // Calculate averages
    const enrollmentsWithGrades = enrollments.filter(e => e.grade !== undefined);
    if (enrollmentsWithGrades.length > 0) {
      stats.averageGrade = enrollmentsWithGrades.reduce((sum, e) => sum + (e.grade || 0), 0) / enrollmentsWithGrades.length;
    }

    if (enrollments.length > 0) {
      stats.averageAttendance = enrollments.reduce((sum, e) => sum + e.attendance, 0) / enrollments.length;
    }

    return stats;
  } catch (error) {
    console.error('Error getting student enrollment stats:', error);
    throw error;
  }
};

/**
 * Update class name and subject for all enrollments of a specific class
 * This is used to sync denormalized data when class details are updated
 */
export const updateClassDetailsInEnrollments = async (
  classId: string,
  className?: string,
  subject?: string
): Promise<number> => {
  try {
    const enrollments = await getEnrollmentsByClass(classId);
    
    if (enrollments.length === 0) {
      console.log('No enrollments to update for class:', classId);
      return 0;
    }

    const updateData: any = {
      updatedAt: Timestamp.now()
    };

    if (className !== undefined) {
      updateData.className = className;
    }

    if (subject !== undefined) {
      updateData.subject = subject;
    }

    // Update all enrollments
    const updatePromises = enrollments.map(enrollment => {
      const docRef = doc(getEnrollmentsCollection(), enrollment.id);
      return updateDoc(docRef, updateData);
    });

    await Promise.all(updatePromises);

    console.log(`✅ Updated ${enrollments.length} enrollment records for class ${classId}`);
    return enrollments.length;
  } catch (error) {
    console.error('Error updating class details in enrollments:', error);
    throw error;
  }
};
