import { NextRequest, NextResponse } from 'next/server';
import { reconcileBillingCheckoutSession } from '@/server/billing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = String(body.sessionId || '').trim();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 },
      );
    }

    const result = await reconcileBillingCheckoutSession(sessionId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reconcile Stripe checkout session' },
      { status: 500 },
    );
  }
}
