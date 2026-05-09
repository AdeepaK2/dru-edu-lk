/**
 * API-specific shared types.
 *
 * Types that describe request/response shapes or server-internal structures
 * that don't belong in schema files. Inline interfaces in route files
 * should move here when those files are touched.
 */

import type { Timestamp } from 'firebase-admin/firestore';

/** Firebase Mail Extension document shape (Firestore "mail" collection) */
export interface ServerMailDocument {
  to: string;
  message: {
    subject: string;
    html: string;
  };
  createdAt?: Timestamp;
  processed?: boolean;
  processedAt?: Timestamp;
  error?: string;
}

/** Standard success response shape produced by apiSuccess() */
export interface ApiSuccessResponse<T = Record<string, unknown>> {
  success: true;
  [key: string]: unknown;
}

/** Standard error response shape produced by apiError() */
export interface ApiErrorResponse {
  error: string;
  details?: unknown;
}
