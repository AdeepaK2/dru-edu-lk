import { Timestamp } from 'firebase/firestore';

export interface InClassSubmission {
  id?: string;
  testId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  classId: string;
  
  // Submission details
  submissionType: 'online_upload' | 'offline_collection';
  answerFileUrl?: string; // For online uploads
  submittedAt?: Timestamp;
  
  // Grading
  marks?: number;
  totalMarks?: number;
  feedback?: string;
  gradedAt?: Timestamp;
  gradedBy?: string; // teacher ID
  
  status: 'pending' | 'submitted' | 'graded' | 'absent';
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const inClassSubmissionSchema = {
  testId: { type: 'string', required: true },
  studentId: { type: 'string', required: true },
  studentName: { type: 'string', required: true },
  classId: { type: 'string', required: true },
  submissionType: { type: 'string', required: true },
  status: { type: 'string', required: true },
};
