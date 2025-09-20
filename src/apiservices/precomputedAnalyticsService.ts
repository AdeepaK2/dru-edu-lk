import { firestore } from '@/utils/firebase-client';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { PrecomputedAnalytics, QuickStats, AnalyticsJob } from '@/models/precomputedAnalyticsSchema';
import { GradeAnalyticsService } from './gradeAnalyticsService';
import { createHash } from 'crypto';

export class PrecomputedAnalyticsService {
  private static readonly COLLECTIONS = {
    PRECOMPUTED_ANALYTICS: 'precomputedAnalytics',
    QUICK_STATS: 'quickStats', 
    ANALYTICS_JOBS: 'analyticsJobs'
  };

  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private static readonly STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  /**
   * Get quick stats for immediate display (fastest possible)
   */
  static async getQuickStats(classId: string): Promise<QuickStats | null> {
    try {
      console.log('📊 Fetching quick stats for class:', classId);
      
      const quickStatsDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.QUICK_STATS, classId)
      );

      if (quickStatsDoc.exists()) {
        const data = quickStatsDoc.data();
        const quickStats: QuickStats = {
          id: quickStatsDoc.id,
          classId: data.classId,
          totalStudents: data.totalStudents || 0,
          averagePerformance: data.averagePerformance || 0,
          passRate: data.passRate || 0,
          testsCompleted: data.testsCompleted || 0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          isStale: data.isStale || false
        };

        console.log('✅ Quick stats retrieved from cache');
        
        // If stale, trigger background refresh
        if (quickStats.isStale || this.isDataStale(quickStats.lastUpdated)) {
          console.log('🔄 Quick stats are stale, triggering background refresh');
          this.scheduleAnalyticsJob(classId, 'class', 'normal');
        }

        return quickStats;
      }

      console.log('❌ No quick stats found, computing...');
      
      // No cached data, compute and cache immediately
      await this.computeAndCacheQuickStats(classId);
      
      // Try to get the newly computed data
      const newQuickStatsDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.QUICK_STATS, classId)
      );

      if (newQuickStatsDoc.exists()) {
        const data = newQuickStatsDoc.data();
        return {
          id: newQuickStatsDoc.id,
          classId: data.classId,
          totalStudents: data.totalStudents || 0,
          averagePerformance: data.averagePerformance || 0,
          passRate: data.passRate || 0,
          testsCompleted: data.testsCompleted || 0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          isStale: false
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching quick stats:', error);
      return null;
    }
  }

  /**
   * Get full precomputed analytics with SWR pattern
   */
  static async getPrecomputedAnalytics(classId: string): Promise<PrecomputedAnalytics | null> {
    try {
      console.log('📊 Fetching precomputed analytics for class:', classId);
      
      const analyticsDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.PRECOMPUTED_ANALYTICS, classId)
      );

      if (analyticsDoc.exists()) {
        const data = analyticsDoc.data();
        
        // Convert Firestore data to our schema
        const analytics: PrecomputedAnalytics = {
          id: analyticsDoc.id,
          type: 'class',
          classId: data.classId,
          className: data.className,
          teacherId: data.teacherId,
          quickStats: data.quickStats || {},
          detailedStats: data.detailedStats || {},
          computedAt: data.computedAt?.toDate() || new Date(),
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          version: data.version || 1,
          isStale: data.isStale || false,
          dataHash: data.dataHash || '',
          computationMetrics: data.computationMetrics
        };

        console.log('✅ Precomputed analytics retrieved from cache');
        
        // SWR: Return stale data immediately, refresh in background
        if (analytics.isStale || this.isDataStale(analytics.lastUpdated)) {
          console.log('🔄 Analytics are stale, triggering background refresh');
          this.scheduleAnalyticsJob(classId, 'class', 'normal');
        }

        return analytics;
      }

      console.log('❌ No precomputed analytics found, computing...');
      
      // No cached data, schedule immediate computation
      await this.scheduleAnalyticsJob(classId, 'class', 'high');
      
      return null;
    } catch (error) {
      console.error('❌ Error fetching precomputed analytics:', error);
      return null;
    }
  }

  /**
   * Compute and cache quick stats (lightweight operation)
   */
  private static async computeAndCacheQuickStats(classId: string): Promise<void> {
    try {
      console.log('⚡ Computing quick stats for class:', classId);
      const startTime = Date.now();

      // Get basic analytics using optimized queries
      const analytics = await GradeAnalyticsService.getClassAnalytics(classId);
      
      const quickStats: QuickStats = {
        id: classId,
        classId,
        totalStudents: analytics.totalStudents,
        averagePerformance: analytics.averagePerformance,
        passRate: analytics.passRate,
        testsCompleted: analytics.testsCompleted,
        lastUpdated: new Date(),
        isStale: false
      };

      // Cache quick stats
      await setDoc(
        doc(firestore, this.COLLECTIONS.QUICK_STATS, classId),
        {
          ...quickStats,
          lastUpdated: serverTimestamp()
        }
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Quick stats computed and cached in ${duration}ms`);

    } catch (error) {
      console.error('❌ Error computing quick stats:', error);
    }
  }

  /**
   * Compute and cache full analytics (heavy operation)
   */
  static async computeAndCacheFullAnalytics(classId: string): Promise<PrecomputedAnalytics | null> {
    try {
      console.log('🔄 Computing full analytics for class:', classId);
      const startTime = Date.now();

      // Get full analytics data
      const [analytics, classData] = await Promise.all([
        GradeAnalyticsService.getClassAnalytics(classId),
        this.getClassData(classId)
      ]);

      if (!classData) {
        throw new Error('Class not found');
      }

      // Create data hash for change detection
      const dataHash = await this.createDataHash(classId);

      // Structure the precomputed analytics
      const precomputedAnalytics: PrecomputedAnalytics = {
        id: classId,
        type: 'class',
        classId,
        className: classData.name,
        teacherId: classData.teacherId,
        
        quickStats: {
          totalStudents: analytics.totalStudents,
          averagePerformance: analytics.averagePerformance,
          passRate: analytics.passRate,
          testsCompleted: analytics.testsCompleted,
          passedTests: 0, // Will be calculated
          totalTests: analytics.testsCompleted,
        },
        
        detailedStats: {
          performanceDistribution: this.calculatePerformanceDistribution(analytics),
          subjectPerformance: analytics.subjectPerformance || [],
          topicAnalysis: [], // Will be populated from topic analysis
          recentTests: (analytics.recentTests || []).map(test => ({
            testId: test.testId,
            testTitle: test.testTitle,
            averageScore: test.averageScore,
            completionRate: test.completionRate,
            passRate: 0, // Calculate if needed
            createdAt: test.createdAt
          })),
          studentPerformances: [], // Will be populated separately for performance
          performanceTrends: [], // Will be populated from trends
        },
        
        computedAt: new Date(),
        lastUpdated: new Date(),
        version: 1,
        isStale: false,
        dataHash,
        
        computationMetrics: {
          duration: Date.now() - startTime,
          dataPoints: analytics.totalStudents + analytics.testsCompleted,
          lastError: null,
        }
      };

      // Cache the analytics
      await setDoc(
        doc(firestore, this.COLLECTIONS.PRECOMPUTED_ANALYTICS, classId),
        {
          ...precomputedAnalytics,
          computedAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        }
      );

      // Also update quick stats
      await setDoc(
        doc(firestore, this.COLLECTIONS.QUICK_STATS, classId),
        {
          id: classId,
          classId,
          ...precomputedAnalytics.quickStats,
          lastUpdated: serverTimestamp(),
          isStale: false
        }
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Full analytics computed and cached in ${duration}ms`);

      return precomputedAnalytics;

    } catch (error) {
      console.error('❌ Error computing full analytics:', error);
      return null;
    }
  }

  /**
   * Schedule an analytics computation job
   */
  static async scheduleAnalyticsJob(
    classId: string, 
    type: 'class' | 'student' | 'global', 
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    try {
      const jobId = `${type}_${classId}_${Date.now()}`;
      
      const job: AnalyticsJob = {
        id: jobId,
        type,
        classId,
        priority,
        status: 'pending',
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        error: null,
        retryCount: 0,
        maxRetries: 3
      };

      await setDoc(
        doc(firestore, this.COLLECTIONS.ANALYTICS_JOBS, jobId),
        {
          ...job,
          createdAt: serverTimestamp()
        }
      );

      console.log(`📋 Analytics job scheduled: ${jobId}`);

      // For high priority jobs, process immediately
      if (priority === 'high') {
        await this.processAnalyticsJob(jobId);
      }

    } catch (error) {
      console.error('❌ Error scheduling analytics job:', error);
    }
  }

  /**
   * Process an analytics job
   */
  private static async processAnalyticsJob(jobId: string): Promise<void> {
    try {
      const jobDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.ANALYTICS_JOBS, jobId)
      );

      if (!jobDoc.exists()) {
        return;
      }

      const jobData = jobDoc.data();
      
      // Update job status to processing
      await setDoc(
        doc(firestore, this.COLLECTIONS.ANALYTICS_JOBS, jobId),
        {
          ...jobData,
          status: 'processing',
          startedAt: serverTimestamp()
        }
      );

      // Process based on job type
      if (jobData.type === 'class' && jobData.classId) {
        await this.computeAndCacheFullAnalytics(jobData.classId);
      }

      // Mark job as completed
      await setDoc(
        doc(firestore, this.COLLECTIONS.ANALYTICS_JOBS, jobId),
        {
          ...jobData,
          status: 'completed',
          completedAt: serverTimestamp()
        }
      );

    } catch (error) {
      console.error('❌ Error processing analytics job:', error);
      
      // Mark job as failed
      try {
        await setDoc(
          doc(firestore, this.COLLECTIONS.ANALYTICS_JOBS, jobId),
          {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            completedAt: serverTimestamp()
          }
        );
      } catch (updateError) {
        console.error('❌ Error updating failed job:', updateError);
      }
    }
  }

  /**
   * Invalidate analytics cache when data changes
   */
  static async invalidateAnalytics(classId: string): Promise<void> {
    try {
      console.log('🗑️ Invalidating analytics cache for class:', classId);
      
      const batch = writeBatch(firestore);
      
      // Mark quick stats as stale
      batch.update(
        doc(firestore, this.COLLECTIONS.QUICK_STATS, classId),
        {
          isStale: true,
          lastUpdated: serverTimestamp()
        }
      );
      
      // Mark full analytics as stale
      batch.update(
        doc(firestore, this.COLLECTIONS.PRECOMPUTED_ANALYTICS, classId),
        {
          isStale: true,
          lastUpdated: serverTimestamp()
        }
      );
      
      await batch.commit();
      
      // Schedule recomputation
      await this.scheduleAnalyticsJob(classId, 'class', 'normal');
      
      console.log('✅ Analytics cache invalidated');
    } catch (error) {
      console.error('❌ Error invalidating analytics:', error);
    }
  }

  /**
   * Utility methods
   */
  private static isDataStale(lastUpdated: Date): boolean {
    return Date.now() - lastUpdated.getTime() > this.STALE_THRESHOLD;
  }

  private static async createDataHash(classId: string): Promise<string> {
    // Create a hash based on recent submission and enrollment data
    // This is a simplified version - in production, you'd hash actual data
    const timestamp = Date.now();
    return createHash('md5').update(`${classId}_${timestamp}`).digest('hex');
  }

  private static async getClassData(classId: string): Promise<any> {
    try {
      const { ClassFirestoreService } = await import('./classFirestoreService');
      return await ClassFirestoreService.getClassById(classId);
    } catch (error) {
      console.error('Error getting class data:', error);
      return null;
    }
  }

  private static calculatePerformanceDistribution(analytics: any): Array<{
    range: string;
    count: number;
    percentage: number;
  }> {
    // This is a placeholder - you'd calculate actual distribution
    // based on student performance data
    return [
      { range: '0-20', count: 0, percentage: 0 },
      { range: '21-40', count: 0, percentage: 0 },
      { range: '41-60', count: 0, percentage: 0 },
      { range: '61-80', count: 0, percentage: 0 },
      { range: '81-100', count: 0, percentage: 0 },
    ];
  }
}