import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { VideoPurchaseServerService } from '@/apiservices/videoPurchaseServerService';
import { firebaseAdmin } from '@/utils/firebase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Security: IP allowlist for Stripe webhooks (optional but recommended)
const STRIPE_WEBHOOK_IPS = [
  '3.18.12.63',
  '3.130.192.231',
  '13.235.14.237',
  '13.235.122.149',
  '18.211.135.69',
  '35.154.171.200',
  '52.15.183.38',
  '54.88.130.119',
  '54.88.130.237',
  '54.187.174.169',
  '54.187.205.235',
  '54.187.216.72'
];

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify request comes from Stripe IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const clientIP = forwardedFor?.split(',')[0] || realIP || 'unknown';
    
    // Uncomment to enforce IP allowlist
    // if (!STRIPE_WEBHOOK_IPS.includes(clientIP)) {
    //   console.warn(`Webhook request from unauthorized IP: ${clientIP}`);
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    if (!webhookSecret) {
      console.error('Missing webhook secret configuration');
      return NextResponse.json(
        { error: 'Webhook configuration error' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Log webhook events for audit trail
    console.log(`Received webhook event: ${event.type} (${event.id})`);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(failedPayment);
        break;
      
      case 'payment_intent.canceled':
        const canceledPayment = event.data.object as Stripe.PaymentIntent;
        await handlePaymentCanceled(canceledPayment);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    
    // Log security-relevant webhook errors
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      headers: Object.fromEntries(request.headers.entries())
    };
    console.error('Webhook security error:', JSON.stringify(errorLog));
    
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { purchaseId, videoId, studentId, studentEmail } = paymentIntent.metadata;
    
    if (!purchaseId) {
      console.error('Missing purchaseId in payment intent metadata:', paymentIntent.id);
      return;
    }

    // Use purchaseId for direct lookup (more secure than searching)
    try {
      await VideoPurchaseServerService.updatePurchaseStatus(
        purchaseId,
        'completed',
        {
          metadata: {
            originalPrice: paymentIntent.amount_received ? paymentIntent.amount_received / 100 : undefined
          }
        }
      );

      console.log(`✅ Payment completed for purchase: ${purchaseId}`);
      
      // Log successful transaction for audit
      await logTransaction({
        type: 'payment_success',
        purchaseId,
        videoId,
        studentId,
        amount: paymentIntent.amount_received ? paymentIntent.amount_received / 100 : 0,
        stripePaymentIntentId: paymentIntent.id
      });

    } catch (updateError) {
      console.error(`❌ Failed to update purchase status for: ${purchaseId}`, updateError);
    }

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { purchaseId, videoId, studentId } = paymentIntent.metadata;
    
    if (!purchaseId) {
      console.error('Missing purchaseId in failed payment intent:', paymentIntent.id);
      return;
    }

    try {
      await VideoPurchaseServerService.updatePurchaseStatus(
        purchaseId,
        'failed'
      );

      console.log(`❌ Payment failed for purchase: ${purchaseId}`);
      
      // Log failed transaction for audit
      await logTransaction({
        type: 'payment_failed',
        purchaseId,
        videoId,
        studentId,
        stripePaymentIntentId: paymentIntent.id,
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
      });

    } catch (updateError) {
      console.error(`❌ Failed to update failed purchase status for: ${purchaseId}`, updateError);
    }

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { purchaseId, videoId, studentId } = paymentIntent.metadata;
    
    if (!purchaseId) {
      console.error('Missing purchaseId in canceled payment intent:', paymentIntent.id);
      return;
    }

    try {
      await VideoPurchaseServerService.updatePurchaseStatus(
        purchaseId,
        'failed' // Use 'failed' as there's no 'canceled' status
      );

      console.log(`⚠️ Payment canceled for purchase: ${purchaseId}`);
      
      // Log canceled transaction for audit
      await logTransaction({
        type: 'payment_canceled',
        purchaseId,
        videoId,
        studentId,
        stripePaymentIntentId: paymentIntent.id
      });

    } catch (updateError) {
      console.error(`❌ Failed to update canceled purchase status for: ${purchaseId}`, updateError);
    }

  } catch (error) {
    console.error('Error handling payment cancellation:', error);
  }
}

// Audit logging function
async function logTransaction(data: any) {
  try {
    await firebaseAdmin.firestore.addDoc('transaction_logs', {
      ...data,
      timestamp: new Date().toISOString(),
      source: 'stripe_webhook'
    });
  } catch (error) {
    console.error('Failed to log transaction:', error);
  }
}
