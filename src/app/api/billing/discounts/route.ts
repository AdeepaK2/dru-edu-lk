import { NextRequest, NextResponse } from 'next/server';
import {
  createBillingDiscount,
  getBillingDiscounts,
  updateBillingDiscountStatus,
} from '@/server/billing';

export async function GET() {
  try {
    const discounts = await getBillingDiscounts();
    return NextResponse.json({ success: true, data: discounts });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load billing discounts' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '').trim();

    if (action === 'toggle_active') {
      const discountId = String(body.discountId || '').trim();
      const isActive = Boolean(body.isActive);
      const updated = await updateBillingDiscountStatus(discountId, isActive);
      return NextResponse.json({
        success: true,
        data: updated,
        message: `Discount ${isActive ? 'activated' : 'disabled'} successfully.`,
      });
    }

    const scope =
      body.scope === 'coupon_code'
        ? 'coupon_code'
        : body.scope === 'additional_student'
        ? 'additional_student'
        : body.scope === 'student'
          ? 'student'
          : 'parent';

    const created = await createBillingDiscount({
      name: String(body.name || ''),
      scope,
      type: 'percentage',
      value: Number(body.value || 0),
      couponCode: typeof body.couponCode === 'string' ? body.couponCode : undefined,
      parentEmail: String(body.parentEmail || ''),
      parentName: typeof body.parentName === 'string' ? body.parentName : undefined,
      studentId: typeof body.studentId === 'string' ? body.studentId : undefined,
      studentName: typeof body.studentName === 'string' ? body.studentName : undefined,
      feeCodes: Array.isArray(body.feeCodes)
        ? body.feeCodes.filter(
            (feeCode: unknown): feeCode is 'admission_fee' | 'parent_portal_yearly' =>
              feeCode === 'admission_fee' || feeCode === 'parent_portal_yearly',
          )
        : [],
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      isActive: body.isActive !== false,
      createdBy: 'admin-portal',
    });

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Discount created successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save billing discount' },
      { status: 500 },
    );
  }
}
