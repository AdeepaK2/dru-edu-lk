import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a valid cron job request (Vercel sets specific headers)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Running enrollment requests migration...');

    // Get all enrollment requests
    const allRequestsQuery = await firebaseAdmin.db
      .collection('enrollmentRequests')
      .get();

    if (allRequestsQuery.empty) {
      console.log('✅ No enrollment requests found');
      return NextResponse.json({ 
        message: 'No enrollment requests found',
        count: 0 
      });
    }

    // Find requests that don't have the notificationSent field
    const requestsToUpdate = allRequestsQuery.docs.filter(doc => {
      const data = doc.data();
      return data.notificationSent === undefined;
    });

    console.log(`📝 Found ${requestsToUpdate.length} enrollment requests to migrate`);

    if (requestsToUpdate.length === 0) {
      return NextResponse.json({
        message: 'All enrollment requests already have notificationSent field',
        count: 0
      });
    }

    // Update each document to add notificationSent: false
    const updatePromises = requestsToUpdate.map(async (doc) => {
      try {
        await firebaseAdmin.db
          .collection('enrollmentRequests')
          .doc(doc.id)
          .update({
            notificationSent: false
          });

        console.log(`✅ Updated enrollment request: ${doc.id}`);
        return { success: true, requestId: doc.id };

      } catch (error) {
        console.error(`❌ Error updating enrollment request ${doc.id}:`, error);
        return { 
          success: false, 
          requestId: doc.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Wait for all updates to complete
    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`🎉 Migration completed: ${successCount} updated, ${failureCount} failed`);

    return NextResponse.json({
      message: 'Enrollment requests migration completed',
      totalRequests: requestsToUpdate.length,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error('❌ Error in enrollment requests migration:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
