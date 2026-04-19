import { NextRequest, NextResponse } from 'next/server';
import {
  createBillingCheckoutSession,
  getBillingInvoiceById,
  getBillingInvoiceByToken,
} from '@/server/billing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const invoiceId = String(body.invoiceId || '').trim();
    const invoiceToken = String(body.invoiceToken || '').trim();

    const invoice = invoiceId
      ? await getBillingInvoiceById(invoiceId)
      : await getBillingInvoiceByToken(invoiceToken);

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Billing invoice not found' },
        { status: 404 },
      );
    }

    const session = await createBillingCheckoutSession(invoice, request.nextUrl.origin);
    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
