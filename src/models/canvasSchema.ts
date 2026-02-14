import { z } from 'zod'; // Using zod for runtime validation if needed later, consistent with other models
import { Timestamp } from 'firebase/firestore';

// Page annotation data
// Key: Page number (1-based to match PDF)
// Value: Data URL of the annotation layer (image/png)
export type PageAnnotations = Record<number, string>;

export interface StudentPdfSubmission {
  id: string; // concise ID or auto-generated
  
  // Student Context
  studentId: string;
  studentName: string;
  studentEmail?: string;
  
  // Class/Course Context
  classId: string;
  className: string;
  
  // PDF Content
  originalPdfUrl: string; // The blank worksheet
  finalPdfUrl?: string; // Optional: Flattened PDF with annotations burnt in
  
  // Annotations
  // structured storage of drawings per page, allowing re-editing
  pageAnnotations: PageAnnotations; 
  
  // Submission Metadata
  submissionType: 'homework' | 'classwork' | 'assessment' | 'practice';
  title: string; // e.g. "Algebra Worksheet 1"
  description?: string;
  
  // Status Tracking
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  
  // Grading & Feedback
  score?: number;
  maxScore?: number;
  teacherFeedback?: string;
  gradedBy?: string;
  gradedAt?: Timestamp;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;
}

// Zod schema for validation (optional but good practice)
export const studentPdfSubmissionSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  classId: z.string(),
  originalPdfUrl: z.string().url(),
  status: z.enum(['draft', 'submitted', 'graded', 'returned']),
  title: z.string(),
});
