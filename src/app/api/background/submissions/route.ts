// API endpoint for background submission processing
// This can be called by a cron job or monitoring system

import { NextRequest, NextResponse } from 'next/server';
import { BackgroundSubmissionService } from '@/apiservices/backgroundSubmissionService';

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authorization check here
    const authHeader = request.headers.get('authorization');
    
    // For security, you might want to check for a secret key
    // const expectedKey = process.env.BACKGROUND_JOB_SECRET;
    // if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    console.log('🔄 Starting background submission process...');
    
    // Process expired attempts
    const results = await BackgroundSubmissionService.processExpiredAttempts();
    
    // Get summary report
    const report = await BackgroundSubmissionService.getExpiredAttemptsReport();
    
    return NextResponse.json({
      success: true,
      message: 'Background submission process completed',
      results: {
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      },
      report: {
        totalExpired: report.totalExpired,
        byTestType: report.byTestType,
        oldestExpired: report.oldestExpired
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Background submission process failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get report without processing submissions
    const report = await BackgroundSubmissionService.getExpiredAttemptsReport();
    
    return NextResponse.json({
      success: true,
      message: 'Expired attempts report',
      report: {
        totalExpired: report.totalExpired,
        byTestType: report.byTestType,
        oldestExpired: report.oldestExpired
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to generate report:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}