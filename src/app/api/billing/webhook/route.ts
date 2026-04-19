import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { processStripeBillingEvent } from '@/server/billing';

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret =
      process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      return NextResponse.json(
        { error: 'Stripe billing webhook is not configured' },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-07-30.basil',
    });

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 });
    }

    const body = await request.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Invalid webhook signature' },
        { status: 400 },
      );
    }

    await processStripeBillingEvent(event.id, event.type, event.data.object);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Billing webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process billing webhook' },
      { status: 500 },
    );
  }
}
