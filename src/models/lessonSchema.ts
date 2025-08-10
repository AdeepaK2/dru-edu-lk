import { z } from 'zod';

// Base Lesson Schema for form validation
export const lessonSchema = z.object({
  name: z.string().min(1, 'Lesson name is required').max(200, 'Lesson name must be less than 200 characters'),
  description: z.string().optional(),
  subjectId: z.string().min(1, 'Subject ID is required'),
  order: z.number().int().min(1, 'Order must be a positive integer'),
  isActive: z.boolean().default(true),
  duration: z.number().int().min(1, 'Duration must be at least 1 minute').optional(),
  objectives: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
});

// Data types
export type LessonData = z.infer<typeof lessonSchema>;

// Firestore document type (includes Firestore-specific fields)
export interface LessonDocument extends LessonData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Display data type (for UI components)
export interface LessonDisplayData extends LessonDocument {
  // Additional computed fields for display
  subjectName?: string;
  formattedDuration?: string;
}

// Utility function to convert Firestore document to display data
export const lessonDocumentToDisplay = (doc: LessonDocument): LessonDisplayData => {
  return {
    ...doc,
    formattedDuration: doc.duration ? `${doc.duration} min` : undefined,
  };
};

// Lesson set schema for managing collections of lessons
export const lessonSetSchema = z.object({
  name: z.string().min(1, 'Lesson set name is required').max(200, 'Lesson set name must be less than 200 characters'),
  description: z.string().optional(),
  subjectId: z.string().min(1, 'Subject ID is required'),
  isActive: z.boolean().default(true),
  order: z.number().int().min(1, 'Order must be a positive integer'),
});

export type LessonSetData = z.infer<typeof lessonSetSchema>;

export interface LessonSetDocument extends LessonSetData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  lessonCount?: number;
}

export interface LessonSetDisplayData extends LessonSetDocument {
  subjectName?: string;
  lessons?: LessonDisplayData[];
}

// Utility function to convert Firestore document to display data
export const lessonSetDocumentToDisplay = (doc: LessonSetDocument): LessonSetDisplayData => {
  return {
    ...doc,
  };
};

// Form validation helpers
export const validateLessonData = (data: unknown): LessonData => {
  return lessonSchema.parse(data);
};

export const validateLessonSetData = (data: unknown): LessonSetData => {
  return lessonSetSchema.parse(data);
};

// Default lesson data for forms
export const getDefaultLessonData = (): Partial<LessonData> => ({
  name: '',
  description: '',
  subjectId: '',
  order: 1,
  isActive: true,
  duration: 60,
  objectives: [],
  materials: [],
  prerequisites: [],
});

// Default lesson set data for forms
export const getDefaultLessonSetData = (): Partial<LessonSetData> => ({
  name: '',
  description: '',
  subjectId: '',
  isActive: true,
  order: 1,
});
