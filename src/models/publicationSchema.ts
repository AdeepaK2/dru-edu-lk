import { z } from 'zod';

// Publication types
export const PUBLICATION_TYPES = ['Book', 'Practice Paper', 'Study Guide', 'Workbook', 'Test Paper', 'Solution Manual'] as const;
export const PUBLICATION_CATEGORIES = [
  'Hard Copy',
  'Soft Copy', 
  'Both (Hard + Soft)',
  'Digital Only',
  'Print Only',
  'Bundle'
] as const;

// Base Publication Schema
export const publicationSchema = z.object({
  publicationId: z.string(),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
  author: z.string().min(1, 'Author is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().min(0, 'Price must be non-negative'),
  currency: z.string().default('AUD'),
  shipping: z.number().min(0, 'Shipping must be non-negative').default(0),
  type: z.enum(PUBLICATION_TYPES),
  pages: z.number().min(1, 'Pages must be at least 1'),
  category: z.enum(PUBLICATION_CATEGORIES),
  subject: z.string().optional(),
  grade: z.string().optional(),
  coverImage: z.string().optional(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  language: z.string().default('English'),
  sales: z.number().min(0).default(0),
  views: z.number().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().min(0).default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Type inference
export type Publication = z.infer<typeof publicationSchema>;

// Display data interface (includes computed fields)
export interface PublicationDisplayData extends Omit<Publication, 'createdAt' | 'updatedAt'> {
  id: string; // Firestore document ID
  formattedPrice: string;
  formattedShipping: string;
  createdAt: string; // ISO string for display
  updatedAt: string; // ISO string for display
}

// Utility functions
export const createPublicationId = (): string => {
  return `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const validatePublication = (data: unknown): Publication => {
  return publicationSchema.parse(data);
};

export const formatPrice = (price: number, currency: string = 'AUD'): string => {
  return `$${price.toFixed(2)}`;
};

export const calculateTotalPrice = (price: number, shipping: number = 0): number => {
  return price + shipping;
};

// Publication form data (for creating/editing)
export interface PublicationForm {
  title: string;
  subtitle?: string;
  author: string;
  description: string;
  price: number;
  shipping?: number;
  type: typeof PUBLICATION_TYPES[number];
  pages: number;
  category: typeof PUBLICATION_CATEGORIES[number];
  subject?: string;
  grade?: string;
  coverImage?: string;
  images?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  features?: string[];
  language?: string;
}

// Example publications for testing/fallback
export const EXAMPLE_PUBLICATIONS: Omit<Publication, 'publicationId' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'VCE Mathematics Methods Practice Tests',
    subtitle: 'Complete collection of practice papers',
    author: 'Education Experts',
    description: 'Comprehensive practice tests designed to help students excel in VCE Mathematics Methods. Includes detailed solutions and marking guides.',
    price: 29.99,
    currency: 'AUD',
    shipping: 5.00,
    type: 'Practice Paper',
    pages: 120,
    category: 'Both (Hard + Soft)',
    subject: 'Mathematics Methods',
    grade: 'Year 12',
    coverImage: '/images/placeholder-thumbnail.svg',
    images: [],
    isActive: true,
    isFeatured: true,
    tags: ['VCE', 'Mathematics', 'Practice Tests', 'Year 12'],
    features: ['Detailed Solutions', 'Marking Guides', 'Multiple Tests', 'Exam Preparation'],
    language: 'English',
    sales: 0,
    views: 0,
    rating: 0,
    ratingCount: 0
  },
  {
    title: 'English Language Analysis Guide',
    subtitle: 'Master the art of language analysis',
    author: 'Literature Masters',
    description: 'A comprehensive guide to English language analysis with examples, techniques, and practice exercises.',
    price: 24.99,
    currency: 'AUD',
    shipping: 5.00,
    type: 'Study Guide',
    pages: 85,
    category: 'Hard Copy',
    subject: 'English Language',
    grade: 'Year 11-12',
    coverImage: '/images/placeholder-thumbnail.svg',
    images: [],
    isActive: true,
    isFeatured: false,
    tags: ['English', 'Language Analysis', 'VCE', 'Study Guide'],
    features: ['Practice Exercises', 'Detailed Examples', 'Analysis Techniques', 'Sample Essays'],
    language: 'English',
    sales: 0,
    views: 0,
    rating: 0,
    ratingCount: 0
  },
  {
    title: 'Chemistry Unit 3 & 4 Workbook',
    subtitle: 'Complete solutions and practice problems',
    author: 'Science Academy',
    description: 'Comprehensive chemistry workbook covering all topics in VCE Chemistry Units 3 & 4 with detailed explanations and practice problems.',
    price: 34.99,
    currency: 'AUD',
    shipping: 5.00,
    type: 'Workbook',
    pages: 200,
    category: 'Soft Copy',
    subject: 'Chemistry',
    grade: 'Year 12',
    coverImage: '/images/placeholder-thumbnail.svg',
    images: [],
    isActive: true,
    isFeatured: true,
    tags: ['Chemistry', 'VCE', 'Units 3 & 4', 'Practice Problems'],
    features: ['Complete Solutions', 'Practice Problems', 'Detailed Explanations', 'Formula Sheet'],
    language: 'English',
    sales: 0,
    views: 0,
    rating: 0,
    ratingCount: 0
  }
];
