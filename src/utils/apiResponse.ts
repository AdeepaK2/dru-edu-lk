import { NextResponse } from 'next/server';

/**
 * Standard API response helpers.
 *
 * Use these for all new API routes to ensure consistent response shapes:
 *   Success: { success: true, ...data }
 *   Error:   { error: string, details?: unknown }
 *
 * Do not use in existing routes unless you are already touching that file,
 * to avoid accidental breaking changes to response shapes.
 */

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details !== undefined ? { details } : {}) },
    { status },
  );
}
