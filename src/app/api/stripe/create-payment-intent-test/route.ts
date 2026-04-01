import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Payment intent creation started');

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured: missing STRIPE_SECRET_KEY' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-07-30.basil',
    });
    
    const body = await request.json();
    console.log('📦 Request body:', body);
    
    const { videoId } = body;
    
    if (!videoId) {
      console.error('❌ Missing videoId in request');
      return NextResponse.json(
        { error: 'Missing videoId' },
        { status: 400 }
      );
    }

    // For testing: create a simple payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10.00 in cents
      currency: 'usd',
      metadata: {
        videoId: videoId,
        purchaseId: `test_${Date.now()}`,
        studentId: 'test_student',
        studentEmail: 'test@example.com',
        videoTitle: 'Test Video'
      },
      description: `Test purchase for video: ${videoId}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      purchaseId: `test_${Date.now()}`,
      amount: 10,
      currency: 'USD',
      videoTitle: 'Test Video'
    });

  } catch (error) {
    console.error('❌ Payment intent creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
