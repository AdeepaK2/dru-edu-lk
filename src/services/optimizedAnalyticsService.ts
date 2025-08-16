import { 
  GradeAnalyticsService, 
  ClassAnalytics, 
  StudentPerformanceData 
} from '@/apiservices/gradeAnalyticsService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { TeacherNavigationCache } from '@/utils/teacher-performance';

// Optimized analytics service with caching and batching
export class OptimizedGradeAnalyticsService {
  private static cache = TeacherNavigationCache.getInstance();
  private static pendingRequests = new Map<string, Promise<any>>();

  // Deduplicated class analytics loading
  static async getClassAnalytics(classId: string): Promise<ClassAnalytics> {
    const cacheKey = `analytics_${classId}`;
    
    // Check cache first
    const cached = this.cache.getFirestoreCache('analytics', cacheKey);
    if (cached) {
      return cached;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Create new request
    const request = GradeAnalyticsService.getClassAnalytics(classId)
      .then(analytics => {
        // Cache for 5 minutes
        this.cache.setFirestoreCache('analytics', cacheKey, analytics, 300000);
        this.pendingRequests.delete(cacheKey);
        return analytics;
      })
      .catch(error => {
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    this.pendingRequests.set(cacheKey, request);
    return request;
  }

  // Batched student performance loading
  static async getStudentPerformancesBatch(
    studentIds: string[], 
    classId: string,
    batchSize: number = 5
  ): Promise<StudentPerformanceData[]> {
    const cacheKey = `student_performances_${classId}`;
    
    // Check cache first
    const cached = this.cache.getFirestoreCache('students', cacheKey);
    if (cached) {
      return cached;
    }

    const results: StudentPerformanceData[] = [];
    
    // Process in batches to avoid overwhelming Firestore
    for (let i = 0; i < studentIds.length; i += batchSize) {
      const batch = studentIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(studentId => 
        this.getStudentPerformanceWithCache(studentId, classId)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches to prevent rate limiting
      if (i + batchSize < studentIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Cache the complete result
    this.cache.setFirestoreCache('students', cacheKey, results, 180000); // 3 minutes
    return results;
  }

  // Individual student performance with caching
  private static async getStudentPerformanceWithCache(
    studentId: string, 
    classId: string
  ): Promise<StudentPerformanceData> {
    const cacheKey = `student_${studentId}_${classId}`;
    
    // Check cache
    const cached = this.cache.getFirestoreCache('student_perf', cacheKey);
    if (cached) {
      return cached;
    }

    // Check pending requests
    const pendingKey = `${studentId}_${classId}`;
    if (this.pendingRequests.has(pendingKey)) {
      return this.pendingRequests.get(pendingKey);
    }

    // Create request
    const request = GradeAnalyticsService.getStudentPerformanceData(studentId, classId)
      .then(performance => {
        this.cache.setFirestoreCache('student_perf', cacheKey, performance, 240000); // 4 minutes
        this.pendingRequests.delete(pendingKey);
        return performance;
      })
      .catch(error => {
        this.pendingRequests.delete(pendingKey);
        throw error;
      });

    this.pendingRequests.set(pendingKey, request);
    return request;
  }

  // Optimized class list loading for overview page
  static async getTeacherClassesWithAnalytics(teacherId: string): Promise<any[]> {
    const cacheKey = `teacher_classes_analytics_${teacherId}`;
    
    // Check cache first
    const cached = this.cache.getFirestoreCache('teacher_data', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Load basic class data first
      const classes = await ClassFirestoreService.getClassesByTeacher(teacherId);
      
      // Create basic response immediately
      const classesWithBasicInfo = classes.map(classDoc => ({
        ...classDoc,
        studentCount: classDoc.enrolledStudents || 0,
        recentActivity: 'Loading...',
        analytics: null,
        loading: true
      }));

      // Cache partial result for immediate response
      this.cache.setFirestoreCache('teacher_data', `${cacheKey}_partial`, classesWithBasicInfo, 60000); // 1 minute

      // Load analytics in background
      const analyticsPromises = classes.map(async (classDoc, index) => {
        // Stagger requests to prevent overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, index * 150));
        
        try {
          const analytics = await this.getClassAnalytics(classDoc.id);
          return {
            classId: classDoc.id,
            analytics,
            studentCount: analytics.totalStudents,
            recentActivity: `${analytics.totalStudents} students enrolled`
          };
        } catch (error) {
          console.warn(`Failed to load analytics for class ${classDoc.id}:`, error);
          return {
            classId: classDoc.id,
            analytics: null,
            studentCount: classDoc.enrolledStudents || 0,
            recentActivity: 'No recent activity'
          };
        }
      });

      const analyticsResults = await Promise.all(analyticsPromises);
      
      // Merge analytics with class data
      const finalClasses = classes.map(classDoc => {
        const analyticsResult = analyticsResults.find(r => r.classId === classDoc.id);
        return {
          ...classDoc,
          ...analyticsResult,
          loading: false
        };
      });

      // Cache complete result
      this.cache.setFirestoreCache('teacher_data', cacheKey, finalClasses, 300000); // 5 minutes
      
      return finalClasses;
    } catch (error) {
      console.error('Error loading teacher classes with analytics:', error);
      throw error;
    }
  }

  // Preload analytics for faster navigation
  static async preloadClassAnalytics(classIds: string[]): Promise<void> {
    // Preload in background, don't wait for results
    const preloadPromises = classIds.slice(0, 3).map(async classId => {
      try {
        await this.getClassAnalytics(classId);
      } catch (error) {
        // Ignore errors in preloading
      }
    });

    // Don't await - this is background preloading
    Promise.all(preloadPromises);
  }

  // Clear specific caches when data is updated
  static invalidateClassCache(classId: string): void {
    this.cache.clearCollectionCache('analytics');
    this.cache.clearCollectionCache('students');
    this.cache.clearCollectionCache('student_perf');
    
    // Clear specific class caches
    const keysToDelete = [
      `analytics_${classId}`,
      `student_performances_${classId}`
    ];
    
    keysToDelete.forEach(key => {
      this.cache.getFirestoreCache('analytics', key); // This will clear expired cache
    });
  }

  // Clear all analytics caches
  static clearAllCaches(): void {
    this.cache.clearCollectionCache('analytics');
    this.cache.clearCollectionCache('students');
    this.cache.clearCollectionCache('student_perf');
    this.cache.clearCollectionCache('teacher_data');
  }
}
