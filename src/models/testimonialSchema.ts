import { z } from 'zod';

// Schema for submitting a testimonial via invite link
export const testimonialSubmitSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['Student', 'Parent', 'Guardian'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  course: z.string().min(1, 'Please specify the course or program'),
  year: z
    .string()
    .min(4, 'Enter a valid year')
    .max(4, 'Enter a valid year')
    .regex(/^\d{4}$/, 'Enter a 4-digit year'),
  result: z.string().max(200).optional(),
  text: z
    .string()
    .min(20, 'Testimonial must be at least 20 characters')
    .max(1500, 'Testimonial must be under 1500 characters'),
  stars: z.number().int().min(1).max(5),
  token: z.string().min(1, 'Submission token is required'),
});

// Schema for admin updating a testimonial
export const testimonialUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  featured: z.boolean().optional(),
  adminNotes: z.string().optional(),
});

// Schema for admin creating a token
export const testimonialTokenCreateSchema = z.object({
  label: z.string().min(1, 'Label is required (e.g. "Sent to John Smith")'),
  expiresAt: z.string().optional(), // ISO date string, optional
});

export type TestimonialSubmitData = z.infer<typeof testimonialSubmitSchema>;
export type TestimonialUpdateData = z.infer<typeof testimonialUpdateSchema>;
export type TestimonialTokenCreateData = z.infer<typeof testimonialTokenCreateSchema>;

// Firestore document shape
export interface TestimonialDocument {
  id: string;
  name: string;
  email: string;
  role: 'Student' | 'Parent' | 'Guardian';
  course: string;
  year: string;
  result?: string;
  text: string;
  stars: number;
  tokenId: string;
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  emailVerified: boolean;
  emailVerificationToken: string;
  adminNotes?: string;
  submittedAt: { toDate: () => Date };
  verifiedAt?: { toDate: () => Date };
  approvedAt?: { toDate: () => Date };
}

export interface TestimonialTokenDocument {
  id: string;
  label: string;
  used: boolean;
  usedAt?: { toDate: () => Date };
  expiresAt?: { toDate: () => Date };
  createdAt: { toDate: () => Date };
  createdBy: string;
}

// Public-safe testimonial (no email)
export interface PublicTestimonial {
  id: string;
  name: string;
  role: 'Student' | 'Parent' | 'Guardian';
  course: string;
  year: string;
  result?: string;
  text: string;
  stars: number;
  featured: boolean;
  emailVerified: boolean;
  submittedAt: string; // ISO string for serialisation
}
