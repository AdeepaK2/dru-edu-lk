import { useState, useEffect, useCallback, useMemo } from 'react';
import { GradeAnalyticsService, ClassAnalytics, StudentPerformanceData } from '@/apiservices/gradeAnalyticsService';
import { ClassDocument } from '@/models/classSchema';
import { TeacherNavigationCache } from '@/utils/teacher-performance';

interface UseOptimizedAnalyticsOptions {
  enablePreloading?: boolean;
  enableCaching?: boolean;
  batchSize?: number;
}

interface AnalyticsState {
  analytics: ClassAnalytics | null;
  studentPerformances: StudentPerformanceData[];
  loading: boolean;
  error: string | null;
  loadingStudents: boolean;
}

export const useOptimizedGradeAnalytics = (
  classId: string,
  teacherId?: string,
  options: UseOptimizedAnalyticsOptions = {}
) => {
  const {
    enablePreloading = true,
    enableCaching = true,
    batchSize = 5
  } = options;

  const cache = useMemo(() => TeacherNavigationCache.getInstance(), []);
  
  const [state, setState] = useState<AnalyticsState>({
    analytics: null,
    studentPerformances: [],
    loading: true,
    error: null,
    loadingStudents: false
  });

  // Cache keys
  const analyticsCacheKey = `analytics_${classId}`;
  const studentsCacheKey = `students_${classId}`;

  // Load analytics with caching
  const loadAnalytics = useCallback(async () => {
    if (!classId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Check cache first
      if (enableCaching) {
        const cached = cache.getFirestoreCache('analytics', analyticsCacheKey);
        if (cached) {
          setState(prev => ({
            ...prev,
            analytics: cached,
            loading: false
          }));
          return cached;
        }
      }

      // Load analytics
      const analytics = await GradeAnalyticsService.getClassAnalytics(classId);
      
      // Cache the result
      if (enableCaching) {
        cache.setFirestoreCache('analytics', analyticsCacheKey, analytics, 300000); // 5 minutes
      }

      setState(prev => ({
        ...prev,
        analytics,
        loading: false
      }));

      return analytics;
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to load analytics',
        loading: false
      }));
      return null;
    }
  }, [classId, enableCaching, cache, analyticsCacheKey]);

  // Load student performances with optimized batching
  const loadStudentPerformances = useCallback(async () => {
    if (!classId) return;

    setState(prev => ({ ...prev, loadingStudents: true }));

    try {
      // Check cache first
      if (enableCaching) {
        const cached = cache.getFirestoreCache('students', studentsCacheKey);
        if (cached) {
          setState(prev => ({
            ...prev,
            studentPerformances: cached,
            loadingStudents: false
          }));
          return cached;
        }
      }

      // Get all enrolled students
      const { StudentFirestoreService } = await import('@/apiservices/studentFirestoreService');
      const studentsInClass = await StudentFirestoreService.getStudentsByClass(classId);

      // Batch process student performances
      const performances: StudentPerformanceData[] = [];
      
      for (let i = 0; i < studentsInClass.length; i += batchSize) {
        const batch = studentsInClass.slice(i, i + batchSize);
        const batchPromises = batch.map((student: any) => 
          GradeAnalyticsService.getStudentPerformanceData(student.id, classId)
        );
        
        const batchResults = await Promise.all(batchPromises);
        performances.push(...batchResults);

        // Update UI incrementally for better perceived performance
        setState(prev => ({
          ...prev,
          studentPerformances: [...prev.studentPerformances, ...batchResults]
        }));
      }

      // Cache the complete result
      if (enableCaching) {
        cache.setFirestoreCache('students', studentsCacheKey, performances, 180000); // 3 minutes
      }

      setState(prev => ({
        ...prev,
        studentPerformances: performances,
        loadingStudents: false
      }));

      return performances;
    } catch (error: any) {
      console.error('Error loading student performances:', error);
      setState(prev => ({
        ...prev,
        loadingStudents: false
      }));
      return [];
    }
  }, [classId, batchSize, enableCaching, cache, studentsCacheKey]);

  // Preload related data
  const preloadRelatedData = useCallback(async () => {
    if (!enablePreloading || !teacherId) return;

    try {
      // Preload teacher's other classes for faster navigation
      const { ClassFirestoreService } = await import('@/apiservices/classFirestoreService');
      const classes = await ClassFirestoreService.getClassesByTeacher(teacherId);
      
      // Cache other class analytics in background
      classes.slice(0, 3).forEach(async (classDoc) => {
        if (classDoc.id !== classId) {
          try {
            const analytics = await GradeAnalyticsService.getClassAnalytics(classDoc.id);
            cache.setFirestoreCache('analytics', `analytics_${classDoc.id}`, analytics, 300000);
          } catch (error) {
            // Ignore errors for preloading
          }
        }
      });
    } catch (error) {
      // Ignore preloading errors
    }
  }, [enablePreloading, teacherId, classId, cache]);

  // Initial load
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Preload related data
  useEffect(() => {
    preloadRelatedData();
  }, [preloadRelatedData]);

  // Refresh data
  const refresh = useCallback(async () => {
    // Clear cache
    if (enableCaching) {
      cache.clearCollectionCache('analytics');
      cache.clearCollectionCache('students');
    }
    
    setState({
      analytics: null,
      studentPerformances: [],
      loading: true,
      error: null,
      loadingStudents: false
    });
    
    await loadAnalytics();
  }, [loadAnalytics, enableCaching, cache]);

  return {
    ...state,
    loadStudentPerformances,
    refresh,
    clearCache: () => {
      cache.clearCollectionCache('analytics');
      cache.clearCollectionCache('students');
    }
  };
};

// Hook for the grades overview page
export const useOptimizedClassList = (teacherId?: string) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const cache = useMemo(() => TeacherNavigationCache.getInstance(), []);

  const loadClassesWithOptimizedAnalytics = useCallback(async () => {
    if (!teacherId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cacheKey = `classes_overview_${teacherId}`;
      const cached = cache.getFirestoreCache('classes', cacheKey);
      if (cached) {
        setClasses(cached);
        setLoading(false);
        // Still load fresh data in background
        setTimeout(() => loadClassesWithOptimizedAnalytics(), 100);
        return;
      }

      // Load classes
      const { ClassFirestoreService } = await import('@/apiservices/classFirestoreService');
      const teacherClasses = await ClassFirestoreService.getClassesByTeacher(teacherId);
      
      // Show classes immediately with basic info
      const classesWithBasicInfo = teacherClasses.map(classDoc => ({
        ...classDoc,
        studentCount: classDoc.enrolledStudents || 0,
        recentActivity: 'Loading...',
        analytics: null
      }));
      
      setClasses(classesWithBasicInfo);
      setLoading(false);

      // Load analytics in batches (non-blocking)
      const analyticsPromises = teacherClasses.map(async (classDoc, index) => {
        try {
          // Stagger requests to avoid overwhelming Firestore
          await new Promise(resolve => setTimeout(resolve, index * 200));
          
          const analytics = await GradeAnalyticsService.getClassAnalytics(classDoc.id);
          
          // Update individual class
          setClasses(prev => prev.map(c => 
            c.id === classDoc.id 
              ? { ...c, analytics, recentActivity: `${analytics.totalStudents} students enrolled` }
              : c
          ));
          
          return { classId: classDoc.id, analytics };
        } catch (error) {
          console.error(`Error loading analytics for ${classDoc.id}:`, error);
          return null;
        }
      });

      // Wait for all analytics to load, then cache
      const results = await Promise.all(analyticsPromises);
      const finalClasses = teacherClasses.map(classDoc => {
        const result = results.find(r => r?.classId === classDoc.id);
        return {
          ...classDoc,
          analytics: result?.analytics || null,
          studentCount: result?.analytics?.totalStudents || classDoc.enrolledStudents || 0,
          recentActivity: result?.analytics 
            ? `${result.analytics.totalStudents} students enrolled`
            : 'No recent activity'
        };
      });

      // Cache the complete result
      cache.setFirestoreCache('classes', cacheKey, finalClasses, 240000); // 4 minutes
      
    } catch (err: any) {
      console.error('Error loading classes:', err);
      setError(err.message || 'Failed to load classes');
      setLoading(false);
    }
  }, [teacherId, cache]);

  useEffect(() => {
    loadClassesWithOptimizedAnalytics();
  }, [loadClassesWithOptimizedAnalytics]);

  return {
    classes,
    loading,
    error,
    refresh: loadClassesWithOptimizedAnalytics
  };
};
