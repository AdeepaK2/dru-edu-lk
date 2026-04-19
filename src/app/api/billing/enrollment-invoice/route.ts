import { NextRequest, NextResponse } from 'next/server';
import {
  createEnrollmentApprovalInvoice,
  finalizeEnrollmentWithoutPayment,
} from '@/server/billing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enrollmentRequestId = String(body.enrollmentRequestId || '').trim();

    if (!enrollmentRequestId) {
      return NextResponse.json(
        { success: false, error: 'enrollmentRequestId is required' },
        { status: 400 },
      );
    }

    const result = await createEnrollmentApprovalInvoice(
      enrollmentRequestId,
      request.nextUrl.origin,
    );

    if (!result.requiresPayment) {
      const finalized = await finalizeEnrollmentWithoutPayment(enrollmentRequestId);
      return NextResponse.json({
        success: true,
        data: {
          requiresPayment: false,
          studentId: finalized.studentId,
        },
        message: 'Enrollment approved without payment requirement',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        requiresPayment: true,
        invoice: result.invoice,
      },
      message: 'Billing invoice created successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create billing invoice' },
      { status: 500 },
    );
  }
}
