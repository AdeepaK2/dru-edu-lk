import { NextRequest, NextResponse } from 'next/server';
import { sendParentEmailUpdateRequiredEmail } from '@/utils/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, studentName, parentEmail, parentName } = body;

    if (!studentId || !parentEmail) {
      return NextResponse.json({ error: 'Missing studentId or parentEmail' }, { status: 400 });
    }

    const result = await sendParentEmailUpdateRequiredEmail(
      parentEmail,
      studentId,
      studentName,
      parentName,
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin,
      process.env.NEXT_PUBLIC_ADMIN_WHATSAPP,
    );

    if (!result.success) {
      const isNotConfigured = typeof result.error === 'string' && result.error.includes('SMTP credentials not configured');
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: isNotConfigured ? 503 : 500 },
      );
    }

    return NextResponse.json({ success: true, message: `Email sent to ${parentEmail}` });
  } catch (error: any) {
    console.error('Error sending parent update email:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
