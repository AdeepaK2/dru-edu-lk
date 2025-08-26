import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Communication email validation schema (for class communication history)
export const comMailSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1, 'Class ID is required'),
  teacherId: z.string().min(1, 'Teacher ID is required'),
  teacherName: z.string().min(1, 'Teacher name is required'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject cannot exceed 200 characters'),
  body: z.string().min(1, 'Email body is required').max(2000, 'Email body cannot exceed 2000 characters'),
  recipientType: z.enum(['students', 'parents', 'both']),
  selectedStudentIds: z.array(z.string()).default([]), // Empty array means all students
  recipientsList: z.array(z.string()).default([]), // Display names like "All Students", "5 Selected Students"
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  attachmentNames: z.array(z.string()).default([]),
  attachmentUrls: z.array(z.string()).default([]),
  deliveredCount: z.number().default(0),
  readCount: z.number().default(0),
  sentAt: z.date().default(() => new Date()),
  status: z.enum(['draft', 'sent', 'delivered', 'failed']).default('sent'),
  emailType: z.enum(['announcement', 'reminder', 'assignment', 'general']).default('general'),
  isScheduled: z.boolean().default(false),
  scheduledFor: z.date().optional(),
});

// Communication email update schema (all fields optional except id)
export const comMailUpdateSchema = comMailSchema.partial().extend({
  id: z.string().min(1, 'Email ID is required'),
});

// Communication email interface
export interface ComMail {
  id: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  body: string;
  recipientType: 'students' | 'parents' | 'both';
  selectedStudentIds: string[];
  recipientsList: string[];
  priority: 'low' | 'normal' | 'high';
  attachmentNames: string[];
  attachmentUrls: string[];
  deliveredCount: number;
  readCount: number;
  sentAt: Date;
  status: 'draft' | 'sent' | 'delivered' | 'failed';
  emailType: 'announcement' | 'reminder' | 'assignment' | 'general';
  isScheduled: boolean;
  scheduledFor?: Date;
}

// Communication email document in Firestore
export interface ComMailDocument {
  id: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  body: string;
  recipientType: 'students' | 'parents' | 'both';
  selectedStudentIds: string[];
  recipientsList: string[];
  priority: 'low' | 'normal' | 'high';
  attachmentNames: string[];
  attachmentUrls: string[];
  deliveredCount: number;
  readCount: number;
  sentAt: Timestamp;
  status: 'draft' | 'sent' | 'delivered' | 'failed';
  emailType: 'announcement' | 'reminder' | 'assignment' | 'general';
  isScheduled: boolean;
  scheduledFor?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Type inference from schemas
export type ComMailData = z.infer<typeof comMailSchema>;
export type ComMailUpdateData = z.infer<typeof comMailUpdateSchema>;

// Helper function to convert Firestore timestamp to Date
export const convertComMailTimestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

// Helper function to convert Date to Firestore timestamp
export const convertDateToComMailTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

// Email recipient tracking interface (for detailed delivery tracking)
export interface ComMailRecipient {
  id: string;
  emailId: string;
  recipientId: string; // student or parent ID
  recipientType: 'student' | 'parent';
  recipientName: string;
  recipientEmail: string;
  deliveryStatus: 'pending' | 'delivered' | 'read' | 'failed' | 'bounced';
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  failureReason?: string;
  bounceReason?: string;
  openedCount: number;
  lastOpenedAt?: Timestamp;
}

// Email recipient document schema
export const comMailRecipientSchema = z.object({
  id: z.string().optional(),
  emailId: z.string().min(1, 'Email ID is required'),
  recipientId: z.string().min(1, 'Recipient ID is required'),
  recipientType: z.enum(['student', 'parent']),
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientEmail: z.string().email('Valid email is required'),
  deliveryStatus: z.enum(['pending', 'delivered', 'read', 'failed', 'bounced']).default('pending'),
  deliveredAt: z.date().optional(),
  readAt: z.date().optional(),
  failureReason: z.string().optional(),
  bounceReason: z.string().optional(),
  openedCount: z.number().default(0),
  lastOpenedAt: z.date().optional(),
});

export type ComMailRecipientData = z.infer<typeof comMailRecipientSchema>;

// Email template interface (for reusable email templates)
export interface EmailTemplate {
  id: string;
  teacherId: string;
  name: string;
  subject: string;
  body: string;
  templateType: 'announcement' | 'reminder' | 'assignment' | 'general';
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Email template document schema
export const emailTemplateSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().min(1, 'Teacher ID is required'),
  name: z.string().min(1, 'Template name is required').max(100, 'Template name cannot exceed 100 characters'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject cannot exceed 200 characters'),
  body: z.string().min(1, 'Body is required').max(2000, 'Body cannot exceed 2000 characters'),
  templateType: z.enum(['announcement', 'reminder', 'assignment', 'general']).default('general'),
  isPublic: z.boolean().default(false),
  usageCount: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type EmailTemplateData = z.infer<typeof emailTemplateSchema>;
