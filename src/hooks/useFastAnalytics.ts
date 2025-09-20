import { useState, useEffect, useCallback, useRef } from 'react';
import { PrecomputedAnalyticsService } from '@/apiservices/precomputedAnalyticsService';
import { PrecomputedAnalytics, QuickStats } from '@/models/precomputedAnalyticsSchema';

interface UseFastAnalyticsOptions {
  classId: string;
  teacherId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseFastAnalyticsReturn {
  // Data states
  quickStats: QuickStats | null;
  fullAnalytics: PrecomputedAnalytics | null;
  
  // Loading states
  loadingQuick: boolean;
  loadingFull: boolean;
  
  // Error states
  error: string | null;
  
  // Data freshness
  isStale: boolean;
  lastUpdated: Date | null;
  
  // Actions
  refresh: () => Promise<void>;
  forceRecompute: () => Promise<void>;
  
  // Cache management
  invalidateCache: () => Promise<void>;
}

export function useFastAnalytics({
  classId,
  teacherId,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: UseFastAnalyticsOptions): UseFastAnalyticsReturn {
  
  // Data states
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [fullAnalytics, setFullAnalytics] = useState<PrecomputedAnalytics | null>(null);
  
  // Loading states
  const [loadingQuick, setLoadingQuick] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup and tracking
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const lastFullAnalyticsLoad = useRef<number>(0);
  const lastBackgroundRefresh = useRef<number>(0);
  const retryCount = useRef<{ quickStats: number; fullAnalytics: number }>({ quickStats: 0, fullAnalytics: 0 });

  // Retry utility with exponential backoff
  const retryWithBackoff = useCallback(async (
    operation: () => Promise<void>, 
    operationType: 'quickStats' | 'fullAnalytics',
    maxRetries: number = 3
  ) => {
    const currentRetries = retryCount.current[operationType];
    
    try {
      await operation();
      // Reset retry count on success
      retryCount.current[operationType] = 0;
    } catch (error) {
      if (currentRetries < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, currentRetries), 10000); // Cap at 10 seconds
        console.log(`⏳ Retrying ${operationType} in ${delay}ms... (attempt ${currentRetries + 1}/${maxRetries})`);
        
        retryCount.current[operationType]++;
        
        setTimeout(() => {
          if (!isUnmountedRef.current) {
            retryWithBackoff(operation, operationType, maxRetries);
          }
        }, delay);
      } else {
        console.error(`❌ Max retries exceeded for ${operationType}`);
        retryCount.current[operationType] = 0;
        throw error;
      }
    }
  }, []);
  
  // Load quick stats (immediate) with retry logic
  const loadQuickStats = useCallback(async () => {
    if (!classId || isUnmountedRef.current) return;
    
    const operation = async () => {
      setLoadingQuick(true);
      setError(null);
      
      console.log('🚀 Loading quick stats from cache...');
      const stats = await PrecomputedAnalyticsService.getQuickStats(classId);
      
      if (!isUnmountedRef.current) {
        setQuickStats(stats);
        console.log('✅ Quick stats loaded:', stats);
      }
    };
    
    try {
      await retryWithBackoff(operation, 'quickStats');
    } catch (err: any) {
      console.error('❌ Error loading quick stats after retries:', err);
      if (!isUnmountedRef.current) {
        setError(err.message || 'Failed to load quick stats');
      }
    } finally {
      if (!isUnmountedRef.current) {
        setLoadingQuick(false);
      }
    }
  }, [classId, retryWithBackoff]);

  // Load full analytics (background)
  const loadFullAnalytics = useCallback(async () => {
    if (!classId || isUnmountedRef.current) return;
    
    const operation = async () => {
      setLoadingFull(true);
      
      console.log('🔄 Loading full analytics from cache...');
      const analytics = await PrecomputedAnalyticsService.getPrecomputedAnalytics(classId);
      
      if (!isUnmountedRef.current) {
        setFullAnalytics(analytics);
        console.log('✅ Full analytics loaded:', analytics ? 'Found' : 'Not found');
      }
    };
    
    try {
      await retryWithBackoff(operation, 'fullAnalytics');
    } catch (err: any) {
      console.error('❌ Error loading full analytics after retries:', err);
      // Don't set error for full analytics failure - quick stats might still work
    } finally {
      if (!isUnmountedRef.current) {
        setLoadingFull(false);
      }
    }
  }, [classId, retryWithBackoff]);

  // Refresh all data
  const refresh = useCallback(async () => {
    console.log('🔄 Refreshing analytics data...');
    await Promise.all([
      loadQuickStats(),
      loadFullAnalytics()
    ]);
  }, [loadQuickStats, loadFullAnalytics]);

  // Force recomputation of analytics
  const forceRecompute = useCallback(async () => {
    if (!classId) return;
    
    try {
      console.log('⚡ Forcing analytics recomputation...');
      
      // Invalidate cache first
      await PrecomputedAnalyticsService.invalidateAnalytics(classId);
      
      // Wait a moment for invalidation to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload data
      await refresh();
      
    } catch (err: any) {
      console.error('❌ Error forcing recomputation:', err);
      setError(err.message || 'Failed to recompute analytics');
    }
  }, [classId, refresh]);

  // Invalidate cache
  const invalidateCache = useCallback(async () => {
    if (!classId) return;
    
    try {
      await PrecomputedAnalyticsService.invalidateAnalytics(classId);
      console.log('✅ Cache invalidated');
    } catch (err: any) {
      console.error('❌ Error invalidating cache:', err);
    }
  }, [classId]);

  // Setup auto-refresh with intelligent intervals
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return;
    
    refreshIntervalRef.current = setInterval(() => {
      if (!isUnmountedRef.current) {
        console.log('🔄 Auto-refreshing analytics...');
        
        // Always refresh quick stats
        loadQuickStats();
        
        // Refresh full analytics less frequently to reduce load
        if (Date.now() - lastFullAnalyticsLoad.current > refreshInterval * 3) {
          loadFullAnalytics();
          lastFullAnalyticsLoad.current = Date.now();
        }
      }
    }, refreshInterval);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, loadQuickStats, loadFullAnalytics]);

  // Initial load
  useEffect(() => {
    if (!classId || !teacherId) return;
    
    console.log('🚀 Initializing fast analytics for class:', classId);
    
    // Load quick stats immediately
    loadQuickStats();
    
    // Load full analytics after a short delay
    setTimeout(() => {
      if (!isUnmountedRef.current) {
        loadFullAnalytics();
      }
    }, 100);
    
  }, [classId, teacherId, loadQuickStats, loadFullAnalytics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Calculate derived states
  const isStale = quickStats?.isStale || fullAnalytics?.isStale || false;
  const lastUpdated = quickStats?.lastUpdated || fullAnalytics?.lastUpdated || null;

  // Intelligent prefetching - trigger background computation when data is stale
  useEffect(() => {
    if (!quickStats || !isStale || !classId || !teacherId) return;
    
    const now = Date.now();
    const cooldownPeriod = 2 * 60 * 1000; // 2 minutes
    
    if (now - lastBackgroundRefresh.current > cooldownPeriod) {
      console.log('🔄 Triggering background computation for stale data...');
      lastBackgroundRefresh.current = now;
      
      // Trigger background computation without blocking UI
      PrecomputedAnalyticsService.computeAndCacheFullAnalytics(classId)
        .then(() => {
          console.log('✅ Background computation completed');
          // Reload quick stats after a delay to get fresh data
          setTimeout(() => {
            if (!isUnmountedRef.current) {
              loadQuickStats();
            }
          }, 3000);
        })
        .catch(err => {
          console.warn('⚠️ Background computation failed:', err);
        });
    }
  }, [quickStats, isStale, classId, teacherId, loadQuickStats]);

  return {
    // Data
    quickStats,
    fullAnalytics,
    
    // Loading
    loadingQuick,
    loadingFull,
    
    // Error
    error,
    
    // Freshness
    isStale,
    lastUpdated,
    
    // Actions
    refresh,
    forceRecompute,
    invalidateCache
  };
}