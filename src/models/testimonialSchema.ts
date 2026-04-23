import { z } from 'zod';

export const TESTIMONIAL_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const TESTIMONIAL_PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
export const TESTIMONIAL_MAX_WORDS = 3000;
export const TESTIMONIAL_STUDENT_NAME_MAX_LENGTH = 120;
export const TESTIMONIAL_RESULT_MAX_LENGTH = 200;

function emptyStringToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

// Schema for submitting a testimonial via invite link
export const testimonialSubmitSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  role: z.enum(['Student', 'Parent', 'Guardian'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  studentName: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(2, 'Student name must be at least 2 characters').max(TESTIMONIAL_STUDENT_NAME_MAX_LENGTH).optional()
  ),
  course: z.string().trim().min(1, 'Please specify the course or program'),
  year: z
    .string()
    .min(4, 'Enter a valid year')
    .max(4, 'Enter a valid year')
    .regex(/^\d{4}$/, 'Enter a 4-digit year'),
  result: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(TESTIMONIAL_RESULT_MAX_LENGTH, `Result must be ${TESTIMONIAL_RESULT_MAX_LENGTH} characters or fewer`).optional()
  ),
  text: z
    .string()
    .trim()
    .min(20, 'Testimonial must be at least 20 characters')
    .refine(
      (value) => countWords(value) <= TESTIMONIAL_MAX_WORDS,
      `Testimonial must be ${TESTIMONIAL_MAX_WORDS} words or fewer`
    ),
  stars: z.preprocess((value) => {
    if (typeof value === 'string') return Number(value);
    return value;
  }, z.number().int().min(1).max(5)),
  socialUrl: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().url('Enter a valid URL').refine(
      (value) => value.startsWith('https://'),
      'Social link must start with https://'
    ).optional()
  ),
  token: z.string().trim().min(1, 'Submission token is required'),
});

// Schema for admin updating a testimonial
export const testimonialUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  featured: z.boolean().optional(),
  adminNotes: z.string().optional(),
  displayPhoto: z.boolean().optional(),
  displaySocialLink: z.boolean().optional(),
});

// Schema for admin creating a token
export const testimonialTokenCreateSchema = z.object({
  label: z.string().trim().min(1, 'Label is required (e.g. "Sent to John Smith")'),
  recipientEmail: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().email('Enter a valid recipient email').optional()
  ),
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
  studentName?: string;
  course: string;
  year: string;
  result?: string;
  text: string;
  stars: number;
  tokenId: string;
  photoUrl?: string | null;
  photoStoragePath?: string | null;
  socialUrl?: string | null;
  displayPhoto: boolean;
  displaySocialLink: boolean;
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  adminNotes?: string;
  submittedAt: { toDate: () => Date };
  approvedAt?: { toDate: () => Date };
}

export interface TestimonialTokenDocument {
  id: string;
  label: string;
  recipientEmail?: string;
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
  studentName?: string;
  course: string;
  year: string;
  result?: string;
  text: string;
  stars: number;
  featured: boolean;
  photoUrl?: string;
  socialUrl?: string;
  submittedAt: string; // ISO string for serialisation
}

export function validateTestimonialPhoto(
  file?: { size: number; type: string } | null
): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: true };
  }

  if (!TESTIMONIAL_PHOTO_ALLOWED_TYPES.includes(file.type as typeof TESTIMONIAL_PHOTO_ALLOWED_TYPES[number])) {
    return { isValid: false, error: 'Photo must be a JPG, PNG, or WebP image' };
  }

  if (file.size > TESTIMONIAL_PHOTO_MAX_BYTES) {
    return { isValid: false, error: 'Photo must be smaller than 5MB' };
  }

  return { isValid: true };
}
