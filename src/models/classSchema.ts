import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Schedule time slot schema
export const timeSlotSchema = z.object({
  day: z.string().min(1, 'Day is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
});

// Class schema for validation
export const classSchema = z.object({
  name: z.string().min(2, 'Class name must be at least 2 characters'),
  centerId: z.enum(['1', '2'], { required_error: 'Please select a center' }),
  year: z.string().min(1, 'Year is required'),
  subject: z.string().min(1, 'Subject is required'), // Keep for backward compatibility
  subjectId: z.string().min(1, 'Subject ID is required'), // Reference to the subject document ID
  schedule: z.array(timeSlotSchema).min(1, 'At least one time slot is required'),
  sessionFee: z.number().min(0, 'Session fee must be positive'),
  teacherId: z.string().optional(), // Will be assigned later
  description: z.string().optional(),
});

// Class update schema (all fields optional except required ones for updates)
export const classUpdateSchema = classSchema.partial().extend({
  id: z.string().optional(), // For Firestore document ID
});

// Type for class data
export type ClassData = z.infer<typeof classSchema>;
export type ClassUpdateData = z.infer<typeof classUpdateSchema>;

// Class document in Firestore
export interface ClassDocument extends ClassData {
  id: string; // Firestore document ID (auto-generated)
  classId: string; // Auto-generated unique class ID (e.g., "CLS-2025-001")
  status: 'Active' | 'Inactive' | 'Suspended';
  enrolledStudents: number;
  waitingList: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string; // Admin ID who created the class
  lastModifiedBy?: string; // Admin ID who last modified the class
}

// Frontend display interface (for backward compatibility with existing UI)
export interface ClassDisplayData {
  id: string;
  classId: string;
  name: string;
  subject: string;
  subjectId: string; // Add subjectId for editing
  year: string;
  teacher: string;
  teacherId?: string; // Add teacherId for editing
  schedule: string;
  students: number;
  status: string;
  description: string;
  centerId: string;
  centerName: string;
  sessionFee: number;
  waitingList?: number;
}

// Helper function to convert ClassDocument to ClassDisplayData
export function classDocumentToDisplay(doc: ClassDocument, centerName?: string, teacherName?: string): ClassDisplayData {
  const scheduleText = doc.schedule.map(slot => 
    `${slot.day}: ${slot.startTime} - ${slot.endTime}`
  ).join(', ');

  return {
    id: doc.id,
    classId: doc.classId,
    name: doc.name,
    subject: doc.subject,
    subjectId: doc.subjectId,
    year: doc.year,
    teacher: teacherName || (doc.teacherId ? 'Assigned' : 'Not Assigned'),
    teacherId: doc.teacherId,
    schedule: scheduleText,
    students: doc.enrolledStudents,
    status: doc.status,
    description: doc.description || '',
    centerId: doc.centerId,
    centerName: centerName || `Center ${doc.centerId}`,
    sessionFee: doc.sessionFee,
    waitingList: doc.waitingList,
  };
}

// Helper function to convert form data to ClassData
export function formDataToClass(formData: any): ClassData {
  const classData: ClassData = {
    name: formData.name,
    centerId: formData.centerId as '1' | '2',
    year: formData.year,
    subject: formData.subject,
    subjectId: formData.subjectId,
    schedule: formData.schedule || [],
    sessionFee: parseFloat(formData.sessionFee),
  };

  // Only add optional fields if they have values
  if (formData.teacherId && formData.teacherId.trim()) {
    classData.teacherId = formData.teacherId;
  }

  if (formData.description && formData.description.trim()) {
    classData.description = formData.description;
  }

  return classData;
}
