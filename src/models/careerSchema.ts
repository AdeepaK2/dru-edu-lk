import { z } from 'zod';

export const CAREER_POSITIONS = [
  {
    id: 'vce-maths-tutor',
    title: 'VCE Maths Tutor',
    type: 'Part-time',
    location: 'Glen Waverley / Online',
    summary: 'Support senior students with clear explanations, feedback, and exam-focused practice.',
  },
  {
    id: 'english-tutor',
    title: 'English Tutor',
    type: 'Part-time',
    location: 'Cranbourne / Online',
    summary: 'Help students build stronger essay structure, language analysis, and confidence.',
  },
  {
    id: 'admin-support',
    title: 'Education Admin Support',
    type: 'Casual',
    location: 'Hybrid',
    summary: 'Assist with student communication, scheduling, and day-to-day learning operations.',
  },
] as const;

export const careerApplicationStatuses = [
  'New',
  'Shortlisted',
  'Contacted',
  'Rejected',
] as const;

export type CareerApplicationStatus = typeof careerApplicationStatuses[number];

const positionIds = CAREER_POSITIONS.map((position) => position.id) as [
  string,
  ...string[]
];

export const careerApplicationSchema = z.object({
  positionId: z.enum(positionIds),
  positionTitle: z.string().min(1, 'Position title is required'),
  fullName: z.string().min(2, 'Full name is required').max(100),
  email: z.string().email('A valid email is required'),
  phone: z.string().min(7, 'Phone number is required').max(30),
  location: z.string().min(2, 'Location is required').max(120),
  experience: z.string().min(10, 'Tell us a little about your experience').max(2000),
  availability: z.string().min(3, 'Availability is required').max(500),
  resumeUrl: z.string().url('Enter a valid resume link').optional().or(z.literal('')),
  coverLetterUrl: z.string().url('Enter a valid cover letter link').optional().or(z.literal('')),
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
