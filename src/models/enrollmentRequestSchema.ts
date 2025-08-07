// Enrollment request data model
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Phone number validation regex for international formats
const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;

// Student basic info for enrollment request
export const enrollmentStudentInfoSchema = z.object({
  name: z.string().min(2, 'Student name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string()
    .min(9, 'Phone number must be at least 9 characters')
    .max(17, 'Phone number must be no more than 17 characters')
    .regex(phoneRegex, 'Invalid phone number format. Use format: +61412345678'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  year: z.string().min(1, 'Year level is required'),
  school: z.string().min(1, 'School name is required'),
});

// Parent info for enrollment request
export const enrollmentParentInfoSchema = z.object({
  name: z.string().min(2, 'Parent name must be at least 2 characters'),
  email: z.string().email('Invalid parent email format'),
  phone: z.string()
    .min(9, 'Parent phone number must be at least 9 characters')
    .max(17, 'Parent phone number must be no more than 17 characters')
    .regex(phoneRegex, 'Invalid parent phone number format. Use format: +61412345678'),
  relationship: z.enum(['Mother', 'Father', 'Guardian', 'Other']),
});

// Enrollment request validation schema
export const enrollmentRequestSchema = z.object({
  student: enrollmentStudentInfoSchema,
  parent: enrollmentParentInfoSchema,
  classId: z.string().min(1, 'Class selection is required'),
  className: z.string().min(1, 'Class name is required'),
  subject: z.string().min(1, 'Subject is required'),
  centerName: z.string().min(1, 'Center name is required'),
  monthlyFee: z.number().min(0, 'Monthly fee is required'),
  additionalNotes: z.string().optional(),
  preferredStartDate: z.string().min(1, 'Preferred start date is required'),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to terms and conditions'
  }),
});

// Enrollment request update schema for admin actions
export const enrollmentRequestUpdateSchema = z.object({
  status: z.enum(['Pending', 'Approved', 'Rejected']),
  adminNotes: z.string().optional(),
  processedBy: z.string().optional(),
  processedAt: z.date().optional(),
});

// Enrollment request interface
export interface EnrollmentRequest {
  id: string;
  student: {
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    year: string;
    school: string;
  };
  parent: {
    name: string;
    email: string;
    phone: string;
    relationship: 'Mother' | 'Father' | 'Guardian' | 'Other';
  };
  classId: string;
  className: string;
  subject: string;
  centerName: string;
  monthlyFee: number;
  additionalNotes?: string;
  preferredStartDate: string;
  agreedToTerms: boolean;
  status: 'Pending' | 'Approved' | 'Rejected';
  adminNotes?: string;
  processedBy?: string;
  processedAt?: Date;
  notificationSent?: boolean;
  notificationSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Enrollment request document in Firestore
export interface EnrollmentRequestDocument {
  id: string;
  student: {
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    year: string;
    school: string;
  };
  parent: {
    name: string;
    email: string;
    phone: string;
    relationship: 'Mother' | 'Father' | 'Guardian' | 'Other';
  };
  classId: string;
  className: string;
  subject: string;
  centerName: string;
  monthlyFee: number;
  additionalNotes?: string;
  preferredStartDate: string;
  agreedToTerms: boolean;
  status: 'Pending' | 'Approved' | 'Rejected';
  adminNotes?: string;
  processedBy?: string;
  processedAt?: Timestamp;
  notificationSent?: boolean;
  notificationSentAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Type inference from schemas
export type EnrollmentRequestData = z.infer<typeof enrollmentRequestSchema>;
export type EnrollmentRequestUpdateData = z.infer<typeof enrollmentRequestUpdateSchema>;

// Helper function to convert EnrollmentRequestDocument to EnrollmentRequest
export const convertEnrollmentRequestDocument = (doc: EnrollmentRequestDocument): EnrollmentRequest => {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
    processedAt: doc.processedAt?.toDate(),
    notificationSentAt: doc.notificationSentAt?.toDate(),
  };
};

// Helper function to validate enrollment request data
export const validateEnrollmentRequest = (data: any): EnrollmentRequestData => {
  return enrollmentRequestSchema.parse(data);
};
