import { NextRequest, NextResponse } from 'next/server';
import {
  getBillingManagementOverview,
  markFeePaidOffline,
  sendBillingPaymentLink,
} from '@/server/billing';

export async function GET() {
  try {
    const overview = await getBillingManagementOverview();
    return NextResponse.json({ success: true, data: overview });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load billing management data' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '').trim();
    const parentEmail = String(body.parentEmail || '').trim();
    if (!parentEmail) {
      return NextResponse.json(
        { success: false, error: 'parentEmail is required' },
        { status: 400 },
      );
    }
    const feeCode = body.feeCode === 'admission_fee' ? 'admission_fee' : body.feeCode === 'parent_portal_yearly' ? 'parent_portal_yearly' : null;
    if (!feeCode) {
      return NextResponse.json(
        { success: false, error: 'feeCode is required' },
        { status: 400 },
      );
    }

    if (action === 'mark_paid_offline') {
      const result = await markFeePaidOffline({
        feeCode,
        parentEmail,
        studentId: typeof body.studentId === 'string' ? body.studentId : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        processedBy: typeof body.processedBy === 'string' ? body.processedBy : 'admin',
      });

      return NextResponse.json({
        success: true,
        data: result,
        message:
          feeCode === 'admission_fee'
            ? 'Admission fee marked as paid offline'
            : 'Parent portal fee marked as paid offline',
      });
    }

    if (action === 'send_payment_link') {
      const result = await sendBillingPaymentLink({
        feeCode,
        parentEmail,
        studentId: typeof body.studentId === 'string' ? body.studentId : undefined,
        origin: request.nextUrl.origin,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `${result.feeLabel} payment link sent to ${parentEmail}`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported billing management action' },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update billing status' },
      { status: 500 },
    );
  }
}
