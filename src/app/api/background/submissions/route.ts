// API endpoint for background submission processing
// This can be called by a cron job or monitoring system

import { NextRequest, NextResponse } from 'next/server';
import { BackgroundSubmissionService } from '@/apiservices/backgroundSubmissionService';

export async function POST(request: NextRequest) {
  try {
    // Check authorization - allow both cron jobs and admin access
    const authHeader = request.headers.get('authorization');
    const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    // For manual admin access, you could add additional auth logic here
    // For now, allow POST without auth for admin interface
    // In production, you might want to add admin authentication
    
    if (authHeader && !isCronJob) {
      return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
    }

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
    // Check if this is a cron job request
    const authHeader = request.headers.get('authorization');
    const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (isCronJob) {
      // This is a cron job - process expired submissions
      console.log('🔄 Starting background submission process via cron...');
      
      // Process expired attempts
      const results = await BackgroundSubmissionService.processExpiredAttempts();
      
      // Get summary report
      const report = await BackgroundSubmissionService.getExpiredAttemptsReport();
      
      return NextResponse.json({
        success: true,
        message: 'Background submission process completed via cron',
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
    } else {
      // This is a regular request - just return the report
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
    }

  } catch (error) {
    console.error('❌ Failed to generate report:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}