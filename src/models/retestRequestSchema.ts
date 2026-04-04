// Retest Request models and types

import { Timestamp } from 'firebase/firestore';

// Retest request status
export type RetestRequestStatus = 'pending' | 'approved' | 'denied';

// Individual retest request from a student
export interface RetestRequest {
  id: string;
  testId: string;
  testTitle: string;
  testNumber?: number;
  displayNumber?: string;

  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;

  studentId: string;
  studentName: string;
  reason: string;

  teacherId: string;
  teacherName: string;

  status: RetestRequestStatus;

  // Review fields (set when teacher approves/denies)
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewNote?: string;
  retestTestId?: string; // ID of the new retest test created on approval

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Aggregated view for teacher page - groups requests by test
export interface RetestRequestSummary {
  testId: string;
  testTitle: string;
  testNumber?: number;
  displayNumber?: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;

  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  deniedRequests: number;
  requests: RetestRequest[];
}
