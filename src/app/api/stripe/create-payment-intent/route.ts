import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { withAuth, validateRequestBody, checkRateLimit, AuthenticatedRequest } from '@/utils/auth-middleware';
import { VideoPurchaseData } from '@/models/videoPurchaseSchema';
import { firebaseAdmin } from '@/utils/firebase-server';

interface CreatePaymentIntentRequest {
  videoId: string;
  returnUrl?: string;
}

async function createPaymentIntentHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
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

    console.log('🔄 Payment intent creation started for user:', request.user.uid);
    console.log('👤 User details:', {
      uid: request.user.uid,
      email: request.user.email,
      role: request.user.role,
      profileId: request.user.profileId
    });
    
    // Check if user has a valid profile ID
    if (!request.user.profileId) {
      console.log('❌ User profile ID is missing');
      return NextResponse.json(
        { error: 'User profile not found. Please contact support.' },
        { status: 400 }
      );
    }
    
    // Rate limiting
    const rateLimitResult = checkRateLimit(request.user.uid, 5, 60000); // 5 requests per minute
    if (!rateLimitResult.allowed) {
      console.log('❌ Rate limit exceeded for user:', request.user.uid);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Only students can purchase videos
    if (request.user.role !== 'student') {
      console.log('❌ Non-student user attempted purchase:', request.user.role);
      return NextResponse.json(
        { error: 'Only students can purchase videos' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log('📦 Request body:', body);
    
    // Validate request body
    const validation = validateRequestBody<CreatePaymentIntentRequest>(body, ['videoId']);
    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return NextResponse.json(
        { error: 'Invalid request', details: validation.errors },
        { status: 400 }
      );
    }

    const { videoId, returnUrl } = body;
    console.log('📹 Processing payment for video:', videoId);

    // Verify video exists and is purchasable
    console.log('🔍 Looking up video:', videoId);
    const video = await firebaseAdmin.firestore.getDoc('videos', videoId);
    if (!video) {
      console.log('❌ Video not found:', videoId);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    console.log('✅ Video found:', video.title || 'Unknown title', 'Price:', video.price);

    // Check if video is free
    if (!video.price || video.price <= 0) {
      console.log('❌ Video is free:', video.price);
      return NextResponse.json(
        { error: 'This video is free to watch' },
        { status: 400 }
      );
    }

    // Check if video price meets Stripe minimum ($0.50 USD)
    if (video.price < 0.50) {
      console.log('❌ Video price below Stripe minimum:', video.price);
      return NextResponse.json(
        { error: `Video price ($${video.price.toFixed(2)}) is below the minimum payment amount of $0.50. Please contact support.` },
        { status: 400 }
      );
    }

    // Check if student already purchased this video
    console.log('🔍 Checking existing purchase for student:', request.user.profileId);
    try {
      const existingPurchases = await firebaseAdmin.firestore.query(
        'videoPurchases',
        'studentId',
        '==',
        request.user.profileId!
      );
      
      const existingPurchase = existingPurchases.find(
        (purchase: any) => purchase.videoId === videoId && purchase.status === 'completed'
      );
      
      if (existingPurchase) {
        console.log('❌ Student already purchased this video');
        return NextResponse.json(
          { error: 'You have already purchased this video' },
          { status: 400 }
        );
      }
      console.log('✅ No existing purchase found');
    } catch (error) {
      console.error('❌ Error checking existing purchases:', error);
      // Continue with payment creation - better to allow duplicate than block valid purchase
      console.log('⚠️ Continuing with payment creation despite purchase check error');
    }

    // Create pending purchase record
    console.log('📝 Creating purchase record...');
    
    // Look up teacher information for proper sales tracking
    let teacherName = '';
    if (video.teacherId) {
      try {
        console.log('👨‍🏫 Looking up teacher information for:', video.teacherId);
        const teacher = await firebaseAdmin.firestore.getDoc('teachers', video.teacherId);
        if (teacher) {
          teacherName = teacher.name || 'Unknown Teacher';
          console.log('✅ Teacher found:', teacherName);
        } else {
          console.log('⚠️ Teacher not found for ID:', video.teacherId);
        }
      } catch (teacherError) {
        console.error('❌ Error looking up teacher:', teacherError);
        // Continue with purchase creation even if teacher lookup fails
      }
    }
    
    const purchaseData: VideoPurchaseData = {
      studentId: request.user.profileId!,
      studentName: request.user.profile?.name || 'Unknown Student',
      videoId: videoId,
      videoTitle: video.title || 'Unknown Video',
      teacherId: video.teacherId || '',
      teacherName: teacherName, // Now properly populated for sales tracking
      subjectId: video.subjectId || '',
      subjectName: video.subjectName || 'Unknown Subject',
      amount: video.price,
      currency: 'USD',
      paymentStatus: 'pending',
      paymentMethod: 'stripe',
      purchaseType: 'individual',
      downloadAllowed: false,
      metadata: {
        videoDuration: video.duration || 0,
        videoDescription: video.description || '',
        originalPrice: video.price,
        discountApplied: 0
        // Teacher earning info will be calculated in webhook handler
      } as any
    };

    const purchaseId = await firebaseAdmin.firestore.addDoc('videoPurchases', {
      ...purchaseData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Purchase record created:', purchaseId);

    // Create Stripe PaymentIntent
    console.log('💳 Creating Stripe payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(video.price * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        videoId: video.id || videoId,
        purchaseId: purchaseId,
        studentId: request.user.profileId!,
        studentEmail: request.user.email,
        videoTitle: video.title || 'Unknown Video'
      },
      description: `Purchase of video: ${video.title || 'Unknown Video'}`,
      receipt_email: request.user.email,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    console.log('✅ Stripe payment intent created:', paymentIntent.id);

    // Store the Stripe payment intent ID in the purchase record
    console.log('📝 Updating purchase record with payment intent ID...');
    await firebaseAdmin.firestore.updateDoc('videoPurchases', purchaseId, {
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date()
    });
    console.log('✅ Purchase record updated');

    console.log('🎉 Payment intent creation completed successfully');
    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      purchaseId: purchaseId,
      amount: video.price,
      currency: 'USD',
      videoTitle: video.title || 'Unknown Video'
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    
    // Log security-relevant errors
    if (error instanceof Error) {
      console.error(`Payment intent creation failed for user ${request.user.uid}: ${error.message}`);
    }

    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

// Export the authenticated handler
export const POST = withAuth(createPaymentIntentHandler, ['student']);
