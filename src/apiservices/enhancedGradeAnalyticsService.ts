import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { ClassDocument } from '@/models/classSchema';
import { Test } from '@/models/testSchema';
import { StudentSubmission } from '@/models/studentSubmissionSchema';
import { 
  ClassAnalyticsFirestoreService, 
  CachedClassAnalytics 
} from './classAnalyticsFirestoreService';
import { GradeAnalyticsService } from './teacherGradeAnalyticsService';

// Re-export interfaces from the original service
export type { 
  ClassSummary, 
  TestSummary, 
  StudentPerformanceSummary,
  QuestionAnalysis,
  DetailedStudentReport 
} from './teacherGradeAnalyticsService';

export class EnhancedGradeAnalyticsService {
  /**
   * Utility method to safely convert Firestore timestamp to Date
   */
  private static safeTimestampToDate(timestamp: any): Date {
    try {
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      if (timestamp instanceof Date) {
        return timestamp;
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      return new Date();
    } catch (error) {
      console.warn('Error converting timestamp:', error);
      return new Date();
    }
  }

  /**
   * Get teacher classes summary with caching
   */
  static async getTeacherClassesSummary(teacherId: string): Promise<import('./teacherGradeAnalyticsService').ClassSummary[]> {
    try {
      console.log(`🔄 [ENHANCED ANALYTICS] Getting classes summary for teacher: ${teacherId}`);
      
      // TEMPORARILY: Always calculate fresh data to ensure class averages are correct
      // TODO: Re-enable caching once we verify it's working properly
      console.log(`� [ENHANCED ANALYTICS] Calculating fresh data (cache temporarily disabled)`);
      const freshData = await GradeAnalyticsService.getTeacherClassesSummary(teacherId);
      
      // Cache the fresh data for future requests
      this.cacheTeacherClassesSummary(teacherId, freshData);
      
      return freshData;
      
    } catch (error) {
      console.error('Error in enhanced getTeacherClassesSummary:', error);
      // Fall back to original service
      return await GradeAnalyticsService.getTeacherClassesSummary(teacherId);
    }
  }
  
  /**
   * Get class test analytics with caching
   */
  static async getClassTestAnalytics(classId: string, teacherId?: string): Promise<import('./teacherGradeAnalyticsService').TestSummary[]> {
    try {
      console.log(`🔄 [ENHANCED ANALYTICS] Getting test analytics for class: ${classId}`);
      
      if (!teacherId) {
        // If no teacherId provided, fall back to original service
        return await GradeAnalyticsService.getClassTestAnalytics(classId);
      }
      
      // Try to get cached data first (any age)
      const cachedData = await ClassAnalyticsFirestoreService.getCachedAnalytics(classId, teacherId);
      
      if (cachedData && !cachedData.isCalculating && cachedData.testAnalytics.length > 0) {
        console.log(`✅ [ENHANCED ANALYTICS] Using cached test analytics for class ${classId}`);
        
        // Check if data is stale and trigger background recalculation
        const isStale = ClassAnalyticsFirestoreService.isCacheStale(cachedData, 30);
        if (isStale) {
          console.log(`🔄 [ENHANCED ANALYTICS] Cached data is stale, triggering background recalculation`);
          this.triggerBackgroundTestRecalculation(classId, teacherId);
        }
        
        return cachedData.testAnalytics;
      }
      
      // If no cached data or it's being calculated, check if we should show "calculating" state
      if (cachedData?.isCalculating) {
        console.log(`⏳ [ENHANCED ANALYTICS] Test analytics for class ${classId} is being calculated`);
        // Return cached data if available, even if old
        if (cachedData.testAnalytics.length > 0) {
          return cachedData.testAnalytics;
        }
      }
      
      // Calculate fresh data and cache it
      console.log(`🔄 [ENHANCED ANALYTICS] Calculating fresh test analytics for class ${classId}`);
      await ClassAnalyticsFirestoreService.markAsCalculating(classId, teacherId);
      
      const freshData = await GradeAnalyticsService.getClassTestAnalytics(classId);
      
      // Cache the result
      await this.cacheTestAnalytics(classId, teacherId, freshData);
      
      return freshData;
      
    } catch (error) {
      console.error('Error in enhanced getClassTestAnalytics:', error);
      // Fall back to original service
      return await GradeAnalyticsService.getClassTestAnalytics(classId);
    }
  }
  
  /**
   * Get class student analytics with caching
   */
  static async getClassStudentAnalytics(classId: string, teacherId?: string): Promise<import('./teacherGradeAnalyticsService').StudentPerformanceSummary[]> {
    try {
      console.log(`🔄 [ENHANCED ANALYTICS] Getting student analytics for class: ${classId}`);
      
      if (!teacherId) {
        // If no teacherId provided, fall back to original service
        return await GradeAnalyticsService.getClassStudentAnalytics(classId);
      }
      
      // Try to get cached data first (any age)
      const cachedData = await ClassAnalyticsFirestoreService.getCachedAnalytics(classId, teacherId);
      
      if (cachedData && !cachedData.isCalculating && cachedData.studentPerformance.length > 0) {
        console.log(`✅ [ENHANCED ANALYTICS] Using cached student analytics for class ${classId}`);
        
        // Check if data is stale and trigger background recalculation
        const isStale = ClassAnalyticsFirestoreService.isCacheStale(cachedData, 30);
        if (isStale) {
          console.log(`🔄 [ENHANCED ANALYTICS] Cached data is stale, triggering background recalculation`);
          this.triggerBackgroundStudentRecalculation(classId, teacherId);
        }
        
        // Convert cached data back to expected format
        const convertedStudentPerformance = cachedData.studentPerformance.map(student => ({
          ...student,
          lastActivityDate: student.lastActivityDate || undefined // Convert null back to undefined
        }));
        
        return convertedStudentPerformance;
      }
      
      // If no cached data or it's being calculated, check if we should show "calculating" state
      if (cachedData?.isCalculating) {
        console.log(`⏳ [ENHANCED ANALYTICS] Student analytics for class ${classId} is being calculated`);
        // Return cached data if available, even if old
        if (cachedData.studentPerformance.length > 0) {
          // Convert cached data back to expected format
          const convertedStudentPerformance = cachedData.studentPerformance.map(student => ({
            ...student,
            lastActivityDate: student.lastActivityDate || undefined // Convert null back to undefined
          }));
          
          return convertedStudentPerformance;
        }
      }
      
      // Calculate fresh data and cache it
      console.log(`🔄 [ENHANCED ANALYTICS] Calculating fresh student analytics for class ${classId}`);
      await ClassAnalyticsFirestoreService.markAsCalculating(classId, teacherId);
      
      const freshData = await GradeAnalyticsService.getClassStudentAnalytics(classId);
      
      // Cache the result
      await this.cacheStudentAnalytics(classId, teacherId, freshData);
      
      return freshData;
      
    } catch (error) {
      console.error('Error in enhanced getClassStudentAnalytics:', error);
      // Fall back to original service
      return await GradeAnalyticsService.getClassStudentAnalytics(classId);
    }
  }
  
  /**
   * Force refresh analytics for a class
   */
  static async forceRefreshClassAnalytics(classId: string, teacherId: string): Promise<void> {
    try {
      if (!classId || !teacherId) {
        throw new Error('ClassId and teacherId are required for force refresh');
      }
      
      console.log(`🔄 [ENHANCED ANALYTICS] Force refreshing analytics for class: ${classId}`);
      
      // Mark cache as stale
      await ClassAnalyticsFirestoreService.forceRefresh(classId, teacherId);
      
      // Trigger immediate recalculation
      await this.recalculateFullClassAnalytics(classId, teacherId);
      
    } catch (error) {
      console.error('Error in forceRefreshClassAnalytics:', error);
      throw error;
    }
  }
  
  /**
   * Get detailed student report (no caching for now as it's very specific)
   */
  static async getDetailedStudentReport(studentId: string, classId: string): Promise<import('./teacherGradeAnalyticsService').DetailedStudentReport> {
    return await GradeAnalyticsService.getDetailedStudentReport(studentId, classId);
  }
  
  // Private helper methods
  
  private static async cacheTeacherClassesSummary(teacherId: string, classSummaries: import('./teacherGradeAnalyticsService').ClassSummary[]): Promise<void> {
    // Cache each class summary individually
    for (const classData of classSummaries) {
      try {
        // Clean the class summary to remove undefined values
        const cleanedClassSummary = {
          ...classData,
          lastActivityDate: classData.lastActivityDate || null // Convert undefined to null
        };
        
        await ClassAnalyticsFirestoreService.saveAnalytics(classData.id, teacherId, {
          classId: classData.id,
          teacherId,
          classSummary: cleanedClassSummary,
          testAnalytics: [], // Will be populated when requested
          studentPerformance: [] // Will be populated when requested
        });
      } catch (error) {
        console.error(`Error caching class ${classData.id}:`, error);
      }
    }
  }
  
  private static async triggerBackgroundRecalculation(teacherId: string, cachedAnalytics: CachedClassAnalytics[]): Promise<void> {
    // Run in background without awaiting
    setTimeout(async () => {
      try {
        const now = new Date();
        
        for (const cache of cachedAnalytics) {
          // Always recalculate to ensure fresh data (especially for class averages)
          // Skip only if currently calculating
          if (!cache.isCalculating) {
            console.log(`🔄 [BACKGROUND] Recalculating analytics for class ${cache.classId}`);
            try {
              await this.recalculateFullClassAnalytics(cache.classId, teacherId);
              console.log(`✅ [BACKGROUND] Successfully recalculated analytics for class ${cache.classId}`);
            } catch (classError) {
              console.error(`❌ [BACKGROUND] Failed to recalculate analytics for class ${cache.classId}:`, classError);
            }
          }
        }
      } catch (error) {
        console.error('Error in background recalculation:', error);
      }
    }, 1000); // Start after 1 second
  }
  
  private static async triggerBackgroundTestRecalculation(classId: string, teacherId: string): Promise<void> {
    // Run in background without awaiting
    setTimeout(async () => {
      try {
        console.log(`🔄 [BACKGROUND] Recalculating test analytics for class ${classId}`);
        await ClassAnalyticsFirestoreService.markAsCalculating(classId, teacherId);
        
        const freshData = await GradeAnalyticsService.getClassTestAnalytics(classId);
        await this.cacheTestAnalytics(classId, teacherId, freshData);
        
      } catch (error) {
        console.error('Error in background test recalculation:', error);
      }
    }, 2000); // Start after 2 seconds
  }
  
  private static async triggerBackgroundStudentRecalculation(classId: string, teacherId: string): Promise<void> {
    // Run in background without awaiting
    setTimeout(async () => {
      try {
        console.log(`🔄 [BACKGROUND] Recalculating student analytics for class ${classId}`);
        await ClassAnalyticsFirestoreService.markAsCalculating(classId, teacherId);
        
        const freshData = await GradeAnalyticsService.getClassStudentAnalytics(classId);
        await this.cacheStudentAnalytics(classId, teacherId, freshData);
        
      } catch (error) {
        console.error('Error in background student recalculation:', error);
      }
    }, 3000); // Start after 3 seconds
  }
  
  private static async recalculateFullClassAnalytics(classId: string, teacherId: string): Promise<void> {
    try {
      await ClassAnalyticsFirestoreService.markAsCalculating(classId, teacherId);
      
      // Calculate all analytics in parallel
      const [classSummary, testAnalytics, studentPerformance] = await Promise.all([
        // Get class summary (we need to get teacher classes and find this one)
        this.getClassSummaryForClass(classId, teacherId),
        GradeAnalyticsService.getClassTestAnalytics(classId),
        GradeAnalyticsService.getClassStudentAnalytics(classId)
      ]);
      
      // Clean the data to remove undefined values
      const cleanedClassSummary = {
        ...classSummary,
        lastActivityDate: classSummary.lastActivityDate || null
      };
      
      // Save all data to cache
      await ClassAnalyticsFirestoreService.saveAnalytics(classId, teacherId, {
        classId,
        teacherId,
        classSummary: cleanedClassSummary,
        testAnalytics,
        studentPerformance
      });
      
      console.log(`✅ [ENHANCED ANALYTICS] Cached full analytics for class ${classId}`);
      
    } catch (error) {
      console.error('Error recalculating full class analytics:', error);
      throw error;
    }
  }
  
  private static async cacheTestAnalytics(classId: string, teacherId: string, testAnalytics: import('./teacherGradeAnalyticsService').TestSummary[]): Promise<void> {
    try {
      // Get existing cache or create new one
      const existingCache = await ClassAnalyticsFirestoreService.getCachedAnalytics(classId, teacherId);
      
      const rawClassSummary = existingCache?.classSummary || await this.getClassSummaryForClass(classId, teacherId);
      const studentPerformance = existingCache?.studentPerformance || [];
      
      // Clean the class summary to remove undefined values
      const classSummary = {
        ...rawClassSummary,
        lastActivityDate: rawClassSummary.lastActivityDate || null
      };
      
      await ClassAnalyticsFirestoreService.saveAnalytics(classId, teacherId, {
        classId,
        teacherId,
        classSummary,
        testAnalytics,
        studentPerformance
      });
      
    } catch (error) {
      console.error('Error caching test analytics:', error);
    }
  }
  
  private static async cacheStudentAnalytics(classId: string, teacherId: string, studentPerformance: import('./teacherGradeAnalyticsService').StudentPerformanceSummary[]): Promise<void> {
    try {
      // Get existing cache or create new one
      const existingCache = await ClassAnalyticsFirestoreService.getCachedAnalytics(classId, teacherId);
      
      const rawClassSummary = existingCache?.classSummary || await this.getClassSummaryForClass(classId, teacherId);
      const testAnalytics = existingCache?.testAnalytics || [];
      
      // Clean the class summary to remove undefined values
      const classSummary = {
        ...rawClassSummary,
        lastActivityDate: rawClassSummary.lastActivityDate || null
      };
      
      await ClassAnalyticsFirestoreService.saveAnalytics(classId, teacherId, {
        classId,
        teacherId,
        classSummary,
        testAnalytics,
        studentPerformance
      });
      
    } catch (error) {
      console.error('Error caching student analytics:', error);
    }
  }
  
  private static async getClassSummaryForClass(classId: string, teacherId: string): Promise<import('./teacherGradeAnalyticsService').ClassSummary> {
    // Get all teacher classes and find the specific one
    const allClasses = await GradeAnalyticsService.getTeacherClassesSummary(teacherId);
    const classSummary = allClasses.find(c => c.id === classId);
    
    if (!classSummary) {
      throw new Error(`Class ${classId} not found for teacher ${teacherId}`);
    }
    
    return classSummary;
  }
}