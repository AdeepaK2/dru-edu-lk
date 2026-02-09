import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';

// GET - Check mail collection status (for debugging)
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Checking mail collection status...');
    
    // Get recent mail documents
    const mailSnapshot = await firebaseAdmin.db.collection('mail')
      .limit(20)
      .get();
    
    if (mailSnapshot.empty) {
      return NextResponse.json({
        status: 'empty',
        message: 'No documents found in mail collection',
        possibleIssues: [
          'No emails have been queued yet',
          'Mail collection name might be different',
          'Connected to wrong database'
        ]
      });
    }
    
    const emails = mailSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        to: data.to,
        subject: data.message?.subject || 'N/A',
        delivery: data.delivery ? {
          state: data.delivery.state || 'unknown',
          attempts: data.delivery.attempts || 0,
          error: data.delivery.error || null,
          startTime: data.delivery.startTime?.toDate?.()?.toISOString() || null,
          endTime: data.delivery.endTime?.toDate?.()?.toISOString() || null,
        } : {
          state: 'NOT_PROCESSED',
          message: 'No delivery info - Firebase Trigger Email extension may not be configured'
        }
      };
    });
    
    // Count by status
    const summary = {
      total: emails.length,
      success: emails.filter(e => e.delivery?.state === 'SUCCESS').length,
      error: emails.filter(e => e.delivery?.state === 'ERROR').length,
      pending: emails.filter(e => e.delivery?.state === 'PENDING' || e.delivery?.state === 'PROCESSING').length,
      notProcessed: emails.filter(e => e.delivery?.state === 'NOT_PROCESSED').length,
    };
    
    let diagnosis = '';
    if (summary.notProcessed === summary.total) {
      diagnosis = 'Firebase Trigger Email extension is NOT installed or not configured to listen to the "mail" collection';
    } else if (summary.error > 0) {
      diagnosis = 'Some emails failed - check SMTP configuration and credentials';
    } else if (summary.success === summary.total) {
      diagnosis = 'All emails sent successfully - check spam folder if not received';
    }
    
    return NextResponse.json({
      status: 'ok',
      summary,
      diagnosis,
      emails,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error checking mail collection:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message,
      details: error.code
    }, { status: 500 });
  }
}
