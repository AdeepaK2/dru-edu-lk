// Student remark data model for class-specific feedback
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Predefined remark levels
export const REMARK_LEVELS = {
  EXCELLENT: 'Excellent',
  VERY_GOOD: 'Very Good',
  GOOD: 'Good',
  SATISFACTORY: 'Satisfactory',
  NEEDS_IMPROVEMENT: 'Needs Improvement',
  POOR: 'Poor',
  CUSTOM: 'Custom'
} as const;

export type RemarkLevel = typeof REMARK_LEVELS[keyof typeof REMARK_LEVELS];

// Student remark validation schema
export const studentRemarkSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  teacherId: z.string().min(1, 'Teacher ID is required'),
  studentName: z.string().min(1, 'Student name is required'),
  className: z.string().min(1, 'Class name is required'),
  subject: z.string().min(1, 'Subject is required'),
  remarkLevel: z.enum([
    REMARK_LEVELS.EXCELLENT,
    REMARK_LEVELS.VERY_GOOD,
    REMARK_LEVELS.GOOD,
    REMARK_LEVELS.SATISFACTORY,
    REMARK_LEVELS.NEEDS_IMPROVEMENT,
    REMARK_LEVELS.POOR,
    REMARK_LEVELS.CUSTOM
  ]),
  customRemark: z.string().optional(),
  additionalNotes: z.string().optional(),
  isVisible: z.boolean().default(true), // Whether student can see this remark
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Student remark update schema (all fields optional except IDs)
export const studentRemarkUpdateSchema = studentRemarkSchema.partial().extend({
  studentId: z.string().min(1, 'Student ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  teacherId: z.string().min(1, 'Teacher ID is required'),
  updatedAt: z.date().default(() => new Date()),
});

// Student remark interface
export interface StudentRemark {
  id: string;
  studentId: string;
  classId: string;
  teacherId: string;
  studentName: string;
  className: string;
  subject: string;
  remarkLevel: RemarkLevel;
  customRemark?: string;
  additionalNotes?: string;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Student remark document in Firestore
export interface StudentRemarkDocument {
  id: string;
  studentId: string;
  classId: string;
  teacherId: string;
  studentName: string;
  className: string;
  subject: string;
  remarkLevel: RemarkLevel;
  customRemark?: string;
  additionalNotes?: string;
  isVisible: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Type inference from schemas
export type StudentRemarkData = z.infer<typeof studentRemarkSchema>;
export type StudentRemarkUpdateData = z.infer<typeof studentRemarkUpdateSchema>;

// Helper function to get remark color based on level
export const getRemarkColor = (level: RemarkLevel): string => {
  switch (level) {
    case REMARK_LEVELS.EXCELLENT:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case REMARK_LEVELS.VERY_GOOD:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case REMARK_LEVELS.GOOD:
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
    case REMARK_LEVELS.SATISFACTORY:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case REMARK_LEVELS.NEEDS_IMPROVEMENT:
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case REMARK_LEVELS.POOR:
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case REMARK_LEVELS.CUSTOM:
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

// Helper function to get remark description
export const getRemarkDescription = (level: RemarkLevel): string => {
  switch (level) {
    case REMARK_LEVELS.EXCELLENT:
      return 'Outstanding performance and understanding';
    case REMARK_LEVELS.VERY_GOOD:
      return 'Very good performance with minor areas for improvement';
    case REMARK_LEVELS.GOOD:
      return 'Good performance meeting expected standards';
    case REMARK_LEVELS.SATISFACTORY:
      return 'Satisfactory performance with room for improvement';
    case REMARK_LEVELS.NEEDS_IMPROVEMENT:
      return 'Performance needs significant improvement';
    case REMARK_LEVELS.POOR:
      return 'Performance below expected standards';
    case REMARK_LEVELS.CUSTOM:
      return 'Custom remark';
    default:
      return '';
  }
};

// Helper function to convert Firestore timestamp to Date
export const convertTimestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

// Helper function to convert Date to Firestore timestamp
export const convertDateToTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};