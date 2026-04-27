import { NextRequest, NextResponse } from 'next/server';
import { applyCouponCodeToBillingInvoice, getPublicInvoiceDetails } from '@/server/billing';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || '';
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Invoice token is required' },
        { status: 400 },
      );
    }

    const invoice = await getPublicInvoiceDetails(token);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load invoice' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '').trim();

    if (action !== 'apply_coupon') {
      return NextResponse.json(
        { success: false, error: 'Unsupported invoice action' },
        { status: 400 },
      );
    }

    const invoiceToken = String(body.invoiceToken || '').trim();
    const couponCode = String(body.couponCode || '').trim();

    if (!invoiceToken || !couponCode) {
      return NextResponse.json(
        { success: false, error: 'Invoice token and coupon code are required' },
        { status: 400 },
      );
    }

    await applyCouponCodeToBillingInvoice({ invoiceToken, couponCode });
    const invoice = await getPublicInvoiceDetails(invoiceToken);

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Coupon applied successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to apply coupon' },
      { status: 500 },
    );
  }
}
