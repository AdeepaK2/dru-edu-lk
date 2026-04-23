import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/utils/firebase-admin';
import { sendPasswordResetNotification } from '@/utils/emailService';

export async function POST(request: NextRequest) {
  try {
    const { email, type } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.drueducation.com';
    const isTeacher = type === 'teacher';
    const continueUrl = isTeacher
      ? `${appUrl}/teacher/login`
      : `${appUrl}/student/login`;

    let resetLink: string;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(email, { url: continueUrl });
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // Return success silently to prevent user enumeration
        return NextResponse.json({ success: true });
      }
      if (err.code === 'auth/invalid-email') {
        return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
      }
      throw err;
    }

    const result = await sendPasswordResetNotification(email, resetLink, isTeacher);

    if (!result.success) {
      console.error('Failed to send password reset email:', result.error);
      return NextResponse.json({ error: 'Failed to send reset email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Password reset route error:', error);
    return NextResponse.json({ error: 'Failed to process reset request.' }, { status: 500 });
  }
}
