import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Individual email status in a batch
export interface EmailRecipient {
  recipientEmail: string;
  recipientName: string;
  recipientType: 'student' | 'parent';
  studentName?: string;
  status: 'pending' | 'sent' | 'failed';
  mailId?: string;
  error?: string;
  sentAt?: Timestamp;
  attemptCount?: number;
}

// Email batch document
export interface MailBatchDocument {
  batchName: string; // e.g., "Test Assignment - Math Quiz 01 - 2024-10-24"
  subject: string; // Email subject line
  batchType: 'test_notification' | 'class_cancellation' | 'class_schedule' | 'document_reminder' | 'test_extension' | 'absence_notification' | 'meeting_confirmation' | 'other';
  createdAt: Timestamp;
  createdBy: string; // Teacher/Admin ID
  createdByName: string; // Teacher/Admin name
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  status: 'processing' | 'completed' | 'partially_failed' | 'failed';
  recipients: EmailRecipient[];
  metadata?: {
    testId?: string;
    testTitle?: string;
    classId?: string;
    className?: string;
    [key: string]: any;
  };
  completedAt?: Timestamp;
  lastUpdatedAt?: Timestamp;
}

// Firestore document with ID
export interface MailBatchDocumentFirestore extends MailBatchDocument {
  id: string;
}

// Zod validation schema
export const mailBatchSchema = z.object({
  batchName: z.string().min(1, 'Batch name is required'),
  subject: z.string().min(1, 'Subject is required'),
  batchType: z.enum([
    'test_notification',
    'class_cancellation',
    'class_schedule',
    'document_reminder',
    'test_extension',
    'absence_notification',
    'meeting_confirmation',
    'other'
  ]),
  createdAt: z.instanceof(Timestamp),
  createdBy: z.string().min(1),
  createdByName: z.string().min(1),
  totalRecipients: z.number().min(0),
  successCount: z.number().min(0),
  failedCount: z.number().min(0),
  pendingCount: z.number().min(0),
  status: z.enum(['processing', 'completed', 'partially_failed', 'failed']),
  recipients: z.array(z.object({
    recipientEmail: z.string().email(),
    recipientName: z.string(),
    recipientType: z.enum(['student', 'parent']),
    studentName: z.string().optional(),
    status: z.enum(['pending', 'sent', 'failed']),
    mailId: z.string().optional(),
    error: z.string().optional(),
    sentAt: z.instanceof(Timestamp).optional(),
    attemptCount: z.number().optional()
  })),
  metadata: z.record(z.any()).optional(),
  completedAt: z.instanceof(Timestamp).optional(),
  lastUpdatedAt: z.instanceof(Timestamp).optional()
});

export type MailBatchData = z.infer<typeof mailBatchSchema>;

// Helper types for creating batches
export interface CreateMailBatchInput {
  batchName: string;
  subject: string;
  batchType: MailBatchDocument['batchType'];
  createdBy: string;
  createdByName: string;
  recipients: Array<{
    recipientEmail: string;
    recipientName: string;
    recipientType: 'student' | 'parent';
    studentName?: string;
  }>;
  metadata?: MailBatchDocument['metadata'];
}

// Batch statistics summary
export interface BatchStatistics {
  totalBatches: number;
  totalEmailsSent: number;
  totalEmailsFailed: number;
  averageSuccessRate: number;
  recentBatches: MailBatchDocumentFirestore[];
}
