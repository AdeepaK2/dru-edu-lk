import { NextRequest, NextResponse } from 'next/server';
import { getPublicInvoiceDetails } from '@/server/billing';

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
