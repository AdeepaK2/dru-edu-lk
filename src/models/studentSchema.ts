// Student data model with parent and payment information
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Phone number validation regex for international formats - more lenient
const phoneRegex = /^[\+]?[\d\s\-\(\)]{9,17}$/;

// Parent information validation schema
export const parentInfoSchema = z.object({
  name: z.string().min(2, 'Parent name must be at least 2 characters'),
  email: z.string().email('Invalid parent email format'),
  phone: z.string()
    .min(9, 'Phone number must be at least 9 characters')
    .max(17, 'Phone number must be no more than 17 characters')
    .regex(phoneRegex, 'Invalid phone number format. Example: +61412345678 or 0412345678'),
});

// Payment information validation schema
export const paymentInfoSchema = z.object({
  status: z.enum(['Paid', 'Pending', 'Overdue']),
  method: z.string().default(''),
  lastPayment: z.string().default('N/A'),
});

// Student validation schema for creation
export const studentSchema = z.object({
  name: z.string().min(2, 'Student name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string()
    .min(9, 'Phone number must be at least 9 characters')
    .max(17, 'Phone number must be no more than 17 characters')
    .regex(phoneRegex, 'Invalid phone number format. Example: +61412345678 or 0412345678'),
  status: z.enum(['Active', 'Suspended', 'Inactive']).default('Active'),
  coursesEnrolled: z.number().default(0),
  enrollmentDate: z.string().optional(),
  parent: parentInfoSchema,
  payment: paymentInfoSchema.optional(),
});

// Student update schema (all fields optional except id)
export const studentUpdateSchema = studentSchema.partial().extend({
  parent: parentInfoSchema.partial().optional(),
  payment: paymentInfoSchema.partial().optional(),
});

// Parent information type
export interface ParentInfo {
  name: string;
  email: string;
  phone: string;
}

// Payment information type
export interface PaymentInfo {
  status: 'Paid' | 'Pending' | 'Overdue';
  method: string;
  lastPayment: string;
}

// Student model
export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  enrollmentDate: string;
  status: 'Active' | 'Suspended' | 'Inactive';
  coursesEnrolled: number;
  avatar: string;
  parent: ParentInfo;
  payment: PaymentInfo;
}

// Student document in Firestore
export interface StudentDocument {
  id: string;
  name: string;
  email: string;
  phone: string;
  enrollmentDate: string;
  status: 'Active' | 'Suspended' | 'Inactive';
  coursesEnrolled: number;
  avatar: string;
  parent: ParentInfo;
  payment: PaymentInfo;  uid: string; // Firebase Auth UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Type inference from schemas
export type StudentData = z.infer<typeof studentSchema>;
export type StudentUpdateData = z.infer<typeof studentUpdateSchema>;

// Function to save student data (deprecated - use API route instead)
export const saveStudent = async (student: Partial<Student>): Promise<Student> => {
  try {
    console.warn('saveStudent function is deprecated. Use /api/student endpoint instead.');
    
    // For backward compatibility, return a mock student with ID
    return {
      ...student,
      id: Math.floor(Math.random() * 1000) + 6 + '', // Convert to string
      enrollmentDate: student.enrollmentDate || new Date().toISOString().split('T')[0],
      avatar: student.avatar || 'ST',
      status: student.status || 'Active',
      coursesEnrolled: student.coursesEnrolled || 0,
      parent: student.parent || { name: '', email: '', phone: '' },
      payment: student.payment || { status: 'Pending', method: '', lastPayment: 'N/A' }
    } as Student;
  } catch (error) {
    console.error('Error saving student:', error);
    throw error;
  }
};

// Function to fetch all students (deprecated - use API route instead)
export const getStudents = async (): Promise<Student[]> => {
  try {
    console.warn('getStudents function is deprecated. Use /api/student endpoint instead.');
    return [];
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};
