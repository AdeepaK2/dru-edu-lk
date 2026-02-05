import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

export const homeworkSubmissionSchema = z.object({
  id: z.string(),
  studyMaterialId: z.string(),
  classId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  
  status: z.enum(['submitted', 'late', 'resubmit_needed', 'approved', 'rejected']),
  
  // Submission content
  files: z.array(z.object({
    url: z.string(),
    name: z.string(),
    type: z.string().optional(),
    size: z.number().optional()
  })).default([]),
  message: z.string().optional(), // Student message
  
  submittedAt: z.date(),
  
  // Grading
  teacherMark: z.enum([
    'Excellent', 
    'Good', 
    'Satisfied', 
    'Satisfactory', 
    'Needs Improvement', 
    'Not Sufficient', 
    'Unsatisfactory', 
    'Incorrect or Incomplete', 
    'Completed but need to resubmit'
  ]).optional(),
  teacherRemarks: z.string().optional(),
  numericMark: z.number().optional(),
  markedAt: z.date().optional(),
  markedBy: z.string().optional(),
  
  // Resubmission logic
  resubmissionDeadline: z.date().optional(),
  attemptNumber: z.number().default(1),
  
  createdAt: z.date(),
  updatedAt: z.date()
});

export type HomeworkSubmissionStatus = 'submitted' | 'late' | 'resubmit_needed' | 'approved' | 'rejected';
export type TeacherMark = 
  | 'Excellent'
  | 'Good' 
  | 'Satisfied' 
  | 'Satisfactory'
  | 'Needs Improvement'
  | 'Not Sufficient' 
  | 'Unsatisfactory'
  | 'Incorrect or Incomplete' 
  | 'Completed but need to resubmit';

export interface HomeworkSubmission {
  id: string;
  studyMaterialId: string;
  classId: string;
  studentId: string;
  studentName: string;
  
  status: HomeworkSubmissionStatus;
  
  files: {
    url: string;
    name: string;
    type?: string;
    size?: number;
  }[];
  fileUrl?: string; // Legacy
  message?: string;
  
  submittedAt: Date;
  
  teacherMark?: TeacherMark;
  teacherRemarks?: string;
  numericMark?: number;
  marks?: number; // Legacy alias
  markedAt?: Date;
  markedBy?: string;
  
  resubmissionDeadline?: Date;
  attemptNumber: number;
  
  revisions?: {
    files: { url: string; name: string; type?: string; size?: number }[];
    message?: string;
    submittedAt: Date;
    teacherMark?: TeacherMark;
    teacherRemarks?: string;
    numericMark?: number;
    marks?: number;
    markedAt?: Date;
    markedBy?: string;
  }[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface HomeworkSubmissionDocument {
  id: string;
  studyMaterialId: string;
  classId: string;
  studentId: string;
  studentName: string;
  
  status: string;
  
  files: {
    url: string;
    name: string;
    type?: string;
    size?: number;
  }[];
  fileUrl?: string; // Legacy
  message?: string;
  
  submittedAt: Timestamp;
  
  teacherMark?: string;
  teacherRemarks?: string;
  numericMark?: number;
  marks?: number; // Legacy alias
  markedAt?: Timestamp;
  markedBy?: string;
  
  resubmissionDeadline?: Timestamp;
  attemptNumber: number;

  revisions?: {
    files: { url: string; name: string; type?: string; size?: number }[];
    message?: string;
    submittedAt: Timestamp;
    teacherMark?: string;
    teacherRemarks?: string;
    numericMark?: number;
    marks?: number;
    markedAt?: Timestamp;
    markedBy?: string;
  }[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
