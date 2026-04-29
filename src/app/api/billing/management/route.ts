import { NextRequest, NextResponse } from 'next/server';
import {
  getBillingManagementOverview,
  markFeePaidOffline,
  sendBulkBillingPaymentLinks,
  sendBillingPaymentCartLink,
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
    if (action === 'send_bulk_payment_links') {
      const items: Array<{
        parentEmail: string;
        studentId?: string;
        feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
      }> = [];

      if (Array.isArray(body.items)) {
        for (const rawItem of body.items as unknown[]) {
          const candidate = rawItem as {
            parentEmail?: unknown;
            studentId?: unknown;
            feeCodes?: unknown;
          };

          const parentEmail =
            typeof candidate.parentEmail === 'string' ? candidate.parentEmail.trim() : '';
          const studentId =
            typeof candidate.studentId === 'string' ? candidate.studentId : undefined;
          const feeCodes = Array.isArray(candidate.feeCodes)
            ? candidate.feeCodes.filter(
                (feeCode: unknown): feeCode is 'admission_fee' | 'parent_portal_yearly' =>
                  feeCode === 'admission_fee' || feeCode === 'parent_portal_yearly',
              )
            : [];

          if (parentEmail && feeCodes.length > 0) {
            items.push({ parentEmail, studentId, feeCodes });
          }
        }
      }

      if (items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one bulk billing item is required' },
          { status: 400 },
        );
      }

      const result = await sendBulkBillingPaymentLinks({
        items,
        origin: request.nextUrl.origin,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `Sent ${result.sent} payment links${result.failed ? `, ${result.failed} failed` : ''}.`,
      });
    }

    if (action === 'send_cart_payment_link') {
      const parentEmail = String(body.parentEmail || '').trim();
      if (!parentEmail) {
        return NextResponse.json(
          { success: false, error: 'parentEmail is required' },
          { status: 400 },
        );
      }

      const items: Array<{
        studentId?: string;
        feeCodes: Array<'admission_fee' | 'parent_portal_yearly'>;
      }> = [];

      if (Array.isArray(body.items)) {
        for (const rawItem of body.items as unknown[]) {
          const candidate = rawItem as {
            studentId?: unknown;
            feeCodes?: unknown;
          };
          const studentId =
            typeof candidate.studentId === 'string' ? candidate.studentId : undefined;
          const feeCodes = Array.isArray(candidate.feeCodes)
            ? candidate.feeCodes.filter(
                (feeCode: unknown): feeCode is 'admission_fee' | 'parent_portal_yearly' =>
                  feeCode === 'admission_fee' || feeCode === 'parent_portal_yearly',
              )
            : [];

          if (feeCodes.length > 0) {
            items.push({ studentId, feeCodes });
          }
        }
      }

      if (items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one cart item is required' },
          { status: 400 },
        );
      }

      const result = await sendBillingPaymentCartLink({
        parentEmail,
        items,
        discountIds: Array.isArray(body.discountIds)
          ? body.discountIds.filter((discountId: unknown): discountId is string => typeof discountId === 'string')
          : undefined,
        couponCode: typeof body.couponCode === 'string' ? body.couponCode : undefined,
        origin: request.nextUrl.origin,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `${result.itemCount} selected payment${result.itemCount === 1 ? '' : 's'} invoice sent to ${parentEmail}`,
      });
    }

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
        discountIds: Array.isArray(body.discountIds)
          ? body.discountIds.filter((discountId: unknown): discountId is string => typeof discountId === 'string')
          : undefined,
        couponCode: typeof body.couponCode === 'string' ? body.couponCode : undefined,
        origin: request.nextUrl.origin,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `${result.feeLabel} payment link sent to ${parentEmail}`,
      });
    }

    if (action === 'send_combined_payment_link') {
      const studentId = typeof body.studentId === 'string' ? body.studentId : undefined;
      const result = await sendBillingPaymentLink({
        feeCodes: ['admission_fee', 'parent_portal_yearly'],
        parentEmail,
        studentId,
        discountIds: Array.isArray(body.discountIds)
          ? body.discountIds.filter((discountId: unknown): discountId is string => typeof discountId === 'string')
          : undefined,
        couponCode: typeof body.couponCode === 'string' ? body.couponCode : undefined,
        origin: request.nextUrl.origin,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `${result.feeLabel} combined payment link sent to ${parentEmail}`,
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
