// Test assignment schema for selected students feature
import { Timestamp } from 'firebase/firestore';

// Assignment type for tests
export type TestAssignmentType = 'class-based' | 'student-based' | 'mixed';

// Individual student assignment
export interface StudentTestAssignment {
  studentId: string;
  studentName: string;
  studentEmail: string;
  classId: string; // Which class this student belongs to for context
  className: string;
  assignedAt: Timestamp;
  assignedBy: string; // teacherId
  status: 'assigned' | 'started' | 'completed' | 'expired';
  notificationSent?: boolean;
  notificationSentAt?: Timestamp;
}

// Extended test schema for student assignments
export interface TestAssignmentConfig {
  // Existing class-based assignment (preserved for backward compatibility)
  classIds: string[];
  classNames: string[];
  
  // New student-based assignment
  assignmentType: TestAssignmentType;
  individualAssignments?: StudentTestAssignment[];
  
  // Assignment metadata
  totalAssignedStudents: number;
  assignmentDate: Timestamp;
  assignmentNotes?: string;
}

// Student assignment summary for UI
export interface StudentAssignmentSummary {
  totalStudents: number;
  byClass: Record<string, {
    className: string;
    studentCount: number;
    students: Array<{
      id: string;
      name: string;
      email: string;
    }>;
  }>;
  assignmentType: TestAssignmentType;
}

// Student selection criteria (for UI)
export interface StudentSelectionCriteria {
  // Class filters
  selectedClassIds: string[];
  
  // Student filters
  searchQuery: string;
  enrollmentStatus: 'active' | 'inactive' | 'all';
  
  // Sorting
  sortBy: 'name' | 'class' | 'enrollment_date';
  sortOrder: 'asc' | 'desc';
  
  // Pagination
  page: number;
  pageSize: number;
}

// Student with enrollment info (for selection UI)
export interface SelectableStudent {
  id: string;
  name: string;
  email: string;
  
  // Enrollment info
  enrollmentId: string;
  classId: string;
  className: string;
  classSubject: string;
  enrollmentStatus: 'active' | 'inactive';
  enrolledAt: Timestamp;
  
  // UI state
  isSelected: boolean;
  isEligible: boolean; // based on criteria/filters
  
  // Additional metadata
  totalTests?: number;
  completedTests?: number;
  averageScore?: number;
}
