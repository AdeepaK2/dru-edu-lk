import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Message validation schema
export const messageSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1, 'Class ID is required'),
  teacherId: z.string().min(1, 'Teacher ID is required'),
  teacherName: z.string().min(1, 'Teacher name is required'),
  message: z.string().min(1, 'Message content is required').max(500, 'Message cannot exceed 500 characters'),
  recipientType: z.enum(['students', 'parents', 'both']),
  selectedStudentIds: z.array(z.string()).default([]), // Empty array means all students
  recipientsList: z.array(z.string()).default([]), // Display names like "All Students", "5 Selected Students"
  deliveredCount: z.number().default(0),
  readCount: z.number().default(0),
  sentAt: z.date().default(() => new Date()),
  status: z.enum(['draft', 'sent', 'delivered', 'failed']).default('sent'),
  messageType: z.enum(['announcement', 'reminder', 'general']).default('general'),
  sentViaWhatsApp: z.boolean().optional(),
  attachmentName: z.string().optional(),
});

// Message update schema (all fields optional except id)
export const messageUpdateSchema = messageSchema.partial().extend({
  id: z.string().min(1, 'Message ID is required'),
});

// Message interface
export interface Message {
  id: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  message: string;
  recipientType: 'students' | 'parents' | 'both';
  selectedStudentIds: string[];
  recipientsList: string[];
  deliveredCount: number;
  readCount: number;
  sentAt: Date;
  status: 'draft' | 'sent' | 'delivered' | 'failed';
  messageType: 'announcement' | 'reminder' | 'general';
  sentViaWhatsApp?: boolean;
  attachmentName?: string;
}

// Message document in Firestore
export interface MessageDocument {
  id: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  message: string;
  recipientType: 'students' | 'parents' | 'both';
  selectedStudentIds: string[];
  recipientsList: string[];
  deliveredCount: number;
  readCount: number;
  sentAt: Timestamp;
  status: 'draft' | 'sent' | 'delivered' | 'failed';
  messageType: 'announcement' | 'reminder' | 'general';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Type inference from schemas
export type MessageData = z.infer<typeof messageSchema>;
export type MessageUpdateData = z.infer<typeof messageUpdateSchema>;

// Helper function to convert Firestore timestamp to Date
export const convertMessageTimestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

// Helper function to convert Date to Firestore timestamp
export const convertDateToMessageTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

// Message recipient tracking interface
export interface MessageRecipient {
  id: string;
  messageId: string;
  recipientId: string; // student or parent ID
  recipientType: 'student' | 'parent';
  recipientName: string;
  recipientEmail: string;
  deliveryStatus: 'pending' | 'delivered' | 'read' | 'failed';
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  failureReason?: string;
}

// Message recipient document schema
export const messageRecipientSchema = z.object({
  id: z.string().optional(),
  messageId: z.string().min(1, 'Message ID is required'),
  recipientId: z.string().min(1, 'Recipient ID is required'),
  recipientType: z.enum(['student', 'parent']),
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientEmail: z.string().email('Valid email is required'),
  deliveryStatus: z.enum(['pending', 'delivered', 'read', 'failed']).default('pending'),
  deliveredAt: z.date().optional(),
  readAt: z.date().optional(),
  failureReason: z.string().optional(),
});

export type MessageRecipientData = z.infer<typeof messageRecipientSchema>;
