import { NextRequest, NextResponse } from 'next/server';
import { PrecomputedAnalyticsService } from '@/apiservices/precomputedAnalyticsService';
import { GradeAnalyticsService } from '@/apiservices/gradeAnalyticsService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const type = searchParams.get('type') || 'full'; // 'quick' or 'full'

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID is required' },
        { status: 400 }
      );
    }

    console.log(`🚀 Fetching ${type} analytics for class:`, classId);

    if (type === 'quick') {
      // Get quick stats (immediate response)
      const quickStats = await PrecomputedAnalyticsService.getQuickStats(classId);
      
      if (quickStats) {
        return NextResponse.json({
          success: true,
          data: quickStats,
          cached: true,
          lastUpdated: quickStats.lastUpdated
        });
      } else {
        // Fallback: compute quick stats on demand
        console.log('⚡ No cached quick stats found, computing on demand...');
        
        await PrecomputedAnalyticsService.batchStoreAnalytics(classId);
        const freshQuickStats = await PrecomputedAnalyticsService.getQuickStats(classId);
        
        return NextResponse.json({
          success: true,
          data: freshQuickStats,
          cached: false,
          computed: true
        });
      }
    } else {
      // Get full analytics
      const fullAnalytics = await PrecomputedAnalyticsService.getPrecomputedAnalytics(classId);
      
      if (fullAnalytics) {
        return NextResponse.json({
          success: true,
          data: fullAnalytics,
          cached: true,
          lastUpdated: fullAnalytics.lastUpdated
        });
      } else {
        // Fallback: compute full analytics on demand (this might take time)
        console.log('⚡ No cached full analytics found, computing on demand...');
        
        const freshAnalytics = await PrecomputedAnalyticsService.computeAndCacheFullAnalytics(classId);
        
        return NextResponse.json({
          success: true,
          data: freshAnalytics,
          cached: false,
          computed: true
        });
      }
    }

  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: true
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual refresh/recomputation
export async function POST(request: NextRequest) {
  try {
    const { classId, force = false } = await request.json();

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔄 Manual recomputation for class: ${classId} (force: ${force})`);

    if (force) {
      // Invalidate existing cache first
      await PrecomputedAnalyticsService.invalidateAnalytics(classId);
    }

    // Recompute analytics
    await PrecomputedAnalyticsService.batchStoreAnalytics(classId);

    // Get fresh data
    const [quickStats, fullAnalytics] = await Promise.all([
      PrecomputedAnalyticsService.getQuickStats(classId),
      PrecomputedAnalyticsService.getPrecomputedAnalytics(classId)
    ]);

    return NextResponse.json({
      success: true,
      message: 'Analytics recomputed successfully',
      data: {
        quickStats,
        fullAnalytics
      },
      recomputed: true
    });

  } catch (error) {
    console.error('❌ Error recomputing analytics:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}