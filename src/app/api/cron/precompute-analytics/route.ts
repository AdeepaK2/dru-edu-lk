import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';
import { GradeAnalyticsService } from '@/apiservices/gradeAnalyticsService';
import { PrecomputedAnalyticsService } from '@/apiservices/precomputedAnalyticsService';

// Use admin firestore instance
const db = adminFirestore;

interface ClassProcessResult {
  classId: string;
  success: boolean;
  error?: string;
  processingTime: number;
  studentsProcessed: number;
}

interface CronResult {
  totalClasses: number;
  successful: number;
  failed: number;
  totalTime: number;
  results: ClassProcessResult[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('🔄 Starting nightly analytics pre-computation...');

  try {
    // Verify this is a cron request (security check for Vercel)
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent?.includes('vercel') || request.headers.get('x-vercel-cron');
    
    // Allow Vercel cron jobs or authorized requests
    if (process.env.NODE_ENV === 'production' && !isVercelCron && !authHeader?.includes('Bearer cron-')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔐 Cron request authorized:', { isVercelCron, hasAuth: !!authHeader });

    const cronResult: CronResult = {
      totalClasses: 0,
      successful: 0,
      failed: 0,
      totalTime: 0,
      results: []
    };

    // Get all active classes
    const classesSnapshot = await db.collection('classes')
      .where('archived', '!=', true)
      .get();

    cronResult.totalClasses = classesSnapshot.size;
    console.log(`📊 Found ${cronResult.totalClasses} active classes to process`);

    // Process classes in batches to avoid memory issues
    const batchSize = 5;
    const classBatches = [];
    const classes = classesSnapshot.docs;

    for (let i = 0; i < classes.length; i += batchSize) {
      classBatches.push(classes.slice(i, i + batchSize));
    }

    for (const batch of classBatches) {
      // Process batch in parallel
      const batchPromises = batch.map(async (classDoc) => {
        const classData = classDoc.data();
        const classId = classDoc.id;
        const teacherId = classData.teacherId;

        return processClassAnalytics(classId, teacherId);
      });

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach((result, index) => {
        const classId = batch[index].id;
        
        if (result.status === 'fulfilled') {
          cronResult.successful++;
          cronResult.results.push(result.value);
        } else {
          cronResult.failed++;
          cronResult.results.push({
            classId,
            success: false,
            error: result.reason?.message || 'Unknown error',
            processingTime: 0,
            studentsProcessed: 0
          });
        }
      });

      // Small delay between batches to prevent overwhelming the system
      if (classBatches.indexOf(batch) < classBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    cronResult.totalTime = Date.now() - startTime;

    console.log(`✅ Analytics pre-computation completed:
      - Total classes: ${cronResult.totalClasses}
      - Successful: ${cronResult.successful}
      - Failed: ${cronResult.failed}
      - Total time: ${cronResult.totalTime}ms`);

    // Log summary to Firestore for monitoring
    await db.collection('cron_logs').add({
      type: 'precompute-analytics',
      timestamp: new Date(),
      result: cronResult,
      environment: process.env.NODE_ENV
    });

    return NextResponse.json({
      success: true,
      message: 'Analytics pre-computation completed',
      ...cronResult
    });

  } catch (error) {
    console.error('❌ Cron job failed:', error);
    
    // Log error
    await db.collection('cron_logs').add({
      type: 'precompute-analytics',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV
    });

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

async function processClassAnalytics(classId: string, teacherId: string): Promise<ClassProcessResult> {
  const classStartTime = Date.now();
  let studentsProcessed = 0;

  try {
    console.log(`🔄 Processing analytics for class ${classId}...`);

    // Get all students in this class
    const enrollmentsSnapshot = await db.collection('studentEnrollments')
      .where('classId', '==', classId)
      .where('status', '==', 'active')
      .get();

    const students = enrollmentsSnapshot.docs.map(doc => ({
      studentId: doc.data().studentId,
      enrollmentId: doc.id
    }));

    console.log(`👥 Found ${students.length} students in class ${classId}`);

    // Get class analytics with all student performance data
    await PrecomputedAnalyticsService.batchStoreAnalytics(classId);

    studentsProcessed = students.length;

    const processingTime = Date.now() - classStartTime;
    console.log(`✅ Class ${classId} processed in ${processingTime}ms (${studentsProcessed} students)`);

    return {
      classId,
      success: true,
      processingTime,
      studentsProcessed
    };

  } catch (error) {
    const processingTime = Date.now() - classStartTime;
    console.error(`❌ Failed to process class ${classId}:`, error);

    return {
      classId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      studentsProcessed
    };
  }
}

function generateQuickStats(analyticsData: any, totalStudents: number): any {
  // Calculate quick statistics from full analytics
  const stats = {
    totalStudents,
    averageScore: 0,
    testsCompleted: 0,
    topPerformers: 0,
    needsAttention: 0,
    lastUpdated: new Date()
  };

  if (analyticsData && analyticsData.students) {
    const studentScores = analyticsData.students
      .map((s: any) => s.averageScore || 0)
      .filter((score: number) => score > 0);

    if (studentScores.length > 0) {
      stats.averageScore = studentScores.reduce((a: number, b: number) => a + b, 0) / studentScores.length;
      stats.topPerformers = studentScores.filter((score: number) => score >= 80).length;
      stats.needsAttention = studentScores.filter((score: number) => score < 50).length;
    }

    stats.testsCompleted = analyticsData.totalTests || 0;
  }

  return stats;
}