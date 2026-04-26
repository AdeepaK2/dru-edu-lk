import { z } from 'zod';

export const careerApplicationStatuses = [
  'New',
  'Shortlisted',
  'Contacted',
  'Rejected',
] as const;

export type CareerApplicationStatus = typeof careerApplicationStatuses[number];

export const careerPositionSchema = z.object({
  title: z.string().min(2, 'Title is required').max(120),
  type: z.string().min(2, 'Type is required').max(60),
  location: z.string().min(2, 'Location is required').max(120),
  summary: z.string().min(10, 'Summary is required').max(500),
  isActive: z.boolean().optional(),
});

export const careerPositionUpdateSchema = z.object({
  id: z.string().min(1, 'Position id is required'),
  title: z.string().min(2).max(120).optional(),
  type: z.string().min(2).max(60).optional(),
  location: z.string().min(2).max(120).optional(),
  summary: z.string().min(10).max(500).optional(),
  isActive: z.boolean().optional(),
});

export const careerApplicationSchema = z.object({
  positionId: z.string().min(1, 'Position is required').max(120),
  positionTitle: z.string().min(1, 'Position title is required'),
  fullName: z.string().min(2, 'Full name is required').max(100),
  email: z.string().email('A valid email is required'),
  phone: z.string().min(7, 'Phone number is required').max(30),
  location: z.string().min(2, 'Location is required').max(120),
  experience: z.string().min(10, 'Tell us a little about your experience').max(2000),
  availability: z.string().min(3, 'Availability is required').max(500),
  resumeUrl: z.string().url('Enter a valid resume link').optional().or(z.literal('')),
  coverLetterUrl: z.string().url('Enter a valid cover letter link').optional().or(z.literal('')),
  coverLetterText: z.string().max(3000, 'Cover letter is too long').optional(),
});

export const careerApplicationUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(careerApplicationStatuses).optional(),
  adminNotes: z.string().max(2000).optional(),
  email: z.object({
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(5000),
  }).optional(),
});

export type CareerApplicationData = z.infer<typeof careerApplicationSchema>;

export interface CareerApplicationDocument extends CareerApplicationData {
  id: string;
  status: CareerApplicationStatus;
  adminNotes?: string;
  emailHistory?: Array<{
    subject: string;
    message: string;
    sentAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type CareerPositionData = z.infer<typeof careerPositionSchema>;

export interface CareerPositionDocument extends CareerPositionData {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
