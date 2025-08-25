// Teacher Access Bank schema - manages which teachers have access to which question banks

import { Timestamp } from 'firebase/firestore';

// Teacher access to question bank
export interface TeacherAccessBank {
  id: string;
  // Teacher information
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  // Question bank information
  questionBankId: string;
  questionBankName: string;
  // Subject information for easier filtering
  subjectId: string;
  subjectName: string;
  // Access permissions
  accessType: 'read' | 'read_add' | 'write' | 'admin'; // read: can use in tests, read_add: can view and add questions, write: can edit questions, admin: full control
  // Who granted access
  grantedBy: string; // admin or other teacher ID
  grantedByName: string;
  // When access was granted
  grantedAt: Timestamp;
  // Optional expiry date
  expiresAt?: Timestamp;
  // Status
  isActive: boolean;
  // Notes about the access
  notes?: string;
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Request for access to a question bank
export interface TeacherAccessBankRequest {
  id: string;
  // Teacher requesting access
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  // Question bank being requested
  questionBankId: string;
  questionBankName: string;
  subjectId: string;
  subjectName: string;
  // Request details
  requestedAccessType: 'read' | 'read_add' | 'write';
  reason?: string;
  // Request status
  status: 'pending' | 'approved' | 'rejected';
  // Who will review/reviewed the request
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
  // Timestamps
  requestedAt: Timestamp;
  updatedAt: Timestamp;
}

// Bulk access assignment (for assigning multiple teachers to a question bank)
export interface BulkTeacherAccessAssignment {
  id: string;
  // Question bank being assigned
  questionBankId: string;
  questionBankName: string;
  subjectId: string;
  subjectName: string;
  // Teachers being assigned
  teacherIds: string[];
  // Access details
  accessType: 'read' | 'read_add' | 'write';
  // Assignment metadata
  assignedBy: string;
  assignedByName: string;
  assignedAt: Timestamp;
  notes?: string;
  // Status
  status: 'completed' | 'in-progress' | 'failed';
  // Results tracking
  successfulAssignments: number;
  failedAssignments: number;
  errors?: string[];
}
