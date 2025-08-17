// Service for managing student selections and assignments for tests
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  DocumentSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { SelectableStudent, StudentSelectionCriteria } from '@/models/testAssignmentSchema';

export class StudentSelectionService {
  private static readonly COLLECTIONS = {
    STUDENTS: 'students',
    ENROLLMENTS: 'studentEnrollments',
    CLASSES: 'classes'
  };

  // Get students available for assignment by teacher
  static async getAssignableStudents(teacherId: string, criteria?: StudentSelectionCriteria): Promise<{
    students: SelectableStudent[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      console.log('🔍 Getting assignable students for teacher:', teacherId);
      
      // First get teacher's classes
      const teacherClassesQuery = query(
        collection(firestore, this.COLLECTIONS.CLASSES),
        where('teacherId', '==', teacherId)
      );
      
      const teacherClassesSnapshot = await getDocs(teacherClassesQuery);
      const teacherClassIds = teacherClassesSnapshot.docs.map(doc => doc.id);
      
      if (teacherClassIds.length === 0) {
        console.log('No classes found for teacher');
        return { students: [], totalCount: 0, hasMore: false };
      }
      
      console.log('🔍 Teacher classes:', teacherClassIds);
      
      // Build enrollment query with filters
      let enrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', 'in', teacherClassIds.slice(0, 10)) // Firestore 'in' limit
      );
      
      // Apply class filter if specified
      if (criteria?.selectedClassIds && criteria.selectedClassIds.length > 0) {
        const filteredClassIds = criteria.selectedClassIds.filter((id: string) => teacherClassIds.includes(id));
        if (filteredClassIds.length > 0) {
          enrollmentsQuery = query(
            collection(firestore, this.COLLECTIONS.ENROLLMENTS),
            where('classId', 'in', filteredClassIds.slice(0, 10))
          );
        }
      }
      
      // Apply enrollment status filter
      if (criteria?.enrollmentStatus && criteria.enrollmentStatus !== 'all') {
        enrollmentsQuery = query(enrollmentsQuery, where('status', '==', criteria.enrollmentStatus));
      }
      
      // Apply sorting
      const sortField = criteria?.sortBy === 'enrollment_date' ? 'createdAt' : 'studentName';
      const sortDirection = criteria?.sortOrder || 'asc';
      enrollmentsQuery = query(enrollmentsQuery, orderBy(sortField, sortDirection));
      
      // Apply pagination
      if (criteria?.pageSize) {
        enrollmentsQuery = query(enrollmentsQuery, limit(criteria.pageSize));
      }
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      console.log('🔍 Found enrollments:', enrollmentsSnapshot.size);
      
      // Process enrollments into selectable students
      const students: SelectableStudent[] = [];
      const classMap = new Map();
      
      // Cache class info
      for (const classDoc of teacherClassesSnapshot.docs) {
        const classData = classDoc.data();
        classMap.set(classDoc.id, {
          id: classDoc.id,
          name: classData.name,
          subject: classData.subject
        });
      }
      
      for (const enrollmentDoc of enrollmentsSnapshot.docs) {
        const enrollment = enrollmentDoc.data();
        const classInfo = classMap.get(enrollment.classId);
        
        if (!classInfo) continue;
        
        const student: SelectableStudent = {
          id: enrollment.studentId,
          name: enrollment.studentName,
          email: enrollment.studentEmail || '',
          enrollmentId: enrollmentDoc.id,
          classId: enrollment.classId,
          className: classInfo.name,
          classSubject: classInfo.subject,
          enrollmentStatus: enrollment.status || 'active',
          enrolledAt: enrollment.createdAt || Timestamp.now(),
          isSelected: false,
          isEligible: true
        };
        
        // Apply search filter
        if (criteria?.searchQuery) {
          const searchLower = criteria.searchQuery.toLowerCase();
          const matchesSearch = 
            student.name.toLowerCase().includes(searchLower) ||
            student.email.toLowerCase().includes(searchLower) ||
            student.className.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) {
            student.isEligible = false;
          }
        }
        
        students.push(student);
      }
      
      const eligibleStudents = students.filter(s => s.isEligible);
      
      console.log('✅ Processed students:', students.length, 'eligible:', eligibleStudents.length);
      
      return {
        students: eligibleStudents,
        totalCount: eligibleStudents.length,
        hasMore: false // TODO: Implement proper pagination
      };
      
    } catch (error) {
      console.error('Error getting assignable students:', error);
      throw new Error('Failed to load assignable students');
    }
  }
  
  // Get students by class for quick selection
  static async getStudentsByClass(classId: string): Promise<SelectableStudent[]> {
    try {
      const enrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', '==', classId),
        where('status', '==', 'active'),
        orderBy('studentName', 'asc')
      );
      
      const snapshot = await getDocs(enrollmentsQuery);
      
      // Get class info
      const classDoc = await getDocs(query(
        collection(firestore, this.COLLECTIONS.CLASSES),
        where('__name__', '==', classId)
      ));
      
      const classInfo = classDoc.docs[0]?.data();
      
      return snapshot.docs.map(doc => {
        const enrollment = doc.data();
        return {
          id: enrollment.studentId,
          name: enrollment.studentName,
          email: enrollment.studentEmail || '',
          enrollmentId: doc.id,
          classId: enrollment.classId,
          className: classInfo?.name || '',
          classSubject: classInfo?.subject || '',
          enrollmentStatus: enrollment.status || 'active',
          enrolledAt: enrollment.createdAt || Timestamp.now(),
          isSelected: false,
          isEligible: true
        };
      });
    } catch (error) {
      console.error('Error getting students by class:', error);
      throw new Error('Failed to load class students');
    }
  }
  
  // Validate student selections for test assignment
  static validateStudentSelection(
    selectedStudents: SelectableStudent[],
    existingTestId?: string
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
      totalStudents: number;
      classesInvolved: number;
      classDistribution: Record<string, number>;
    };
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (selectedStudents.length === 0) {
      errors.push('Please select at least one student');
    }
    
    // Check for duplicate selections
    const studentIds = selectedStudents.map(s => s.id);
    const uniqueIds = new Set(studentIds);
    if (studentIds.length !== uniqueIds.size) {
      errors.push('Duplicate students detected in selection');
    }
    
    // Check class distribution
    const classDistribution: Record<string, number> = {};
    const classesInvolved = new Set<string>();
    
    for (const student of selectedStudents) {
      classesInvolved.add(student.classId);
      classDistribution[student.className] = (classDistribution[student.className] || 0) + 1;
    }
    
    // Warnings for large selections
    if (selectedStudents.length > 100) {
      warnings.push(`Large selection: ${selectedStudents.length} students selected`);
    }
    
    if (classesInvolved.size > 10) {
      warnings.push(`Many classes involved: ${classesInvolved.size} classes`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalStudents: selectedStudents.length,
        classesInvolved: classesInvolved.size,
        classDistribution
      }
    };
  }
  
  // Get quick statistics for teacher's students
  static async getTeacherStudentStats(teacherId: string): Promise<{
    totalClasses: number;
    totalStudents: number;
    studentsByClass: Record<string, number>;
    activeEnrollments: number;
  }> {
    try {
      // Get teacher's classes
      const classesQuery = query(
        collection(firestore, this.COLLECTIONS.CLASSES),
        where('teacherId', '==', teacherId)
      );
      
      const classesSnapshot = await getDocs(classesQuery);
      const classIds = classesSnapshot.docs.map(doc => doc.id);
      
      if (classIds.length === 0) {
        return {
          totalClasses: 0,
          totalStudents: 0,
          studentsByClass: {},
          activeEnrollments: 0
        };
      }
      
      // Get enrollments for all classes (in batches if needed)
      const studentsByClass: Record<string, number> = {};
      let totalStudents = 0;
      let activeEnrollments = 0;
      
      for (const classId of classIds) {
        const enrollmentsQuery = query(
          collection(firestore, this.COLLECTIONS.ENROLLMENTS),
          where('classId', '==', classId)
        );
        
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        const classStudentCount = enrollmentsSnapshot.size;
        const activeCount = enrollmentsSnapshot.docs.filter(
          doc => doc.data().status === 'active'
        ).length;
        
        const className = classesSnapshot.docs.find(c => c.id === classId)?.data().name || classId;
        studentsByClass[className] = classStudentCount;
        totalStudents += classStudentCount;
        activeEnrollments += activeCount;
      }
      
      return {
        totalClasses: classIds.length,
        totalStudents,
        studentsByClass,
        activeEnrollments
      };
      
    } catch (error) {
      console.error('Error getting teacher student stats:', error);
      return {
        totalClasses: 0,
        totalStudents: 0,
        studentsByClass: {},
        activeEnrollments: 0
      };
    }
  }
}
