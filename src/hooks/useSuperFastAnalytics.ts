import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSuperFastAnalyticsOptions {
  classId: string;
  teacherId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSuperFastAnalyticsReturn {
  // Data states
  quickStats: any | null;
  fullAnalytics: any | null;
  
  // Loading states
  loadingQuick: boolean;
  loadingFull: boolean;
  
  // Error states
  error: string | null;
  
  // Data freshness
  isStale: boolean;
  lastUpdated: Date | null;
  cached: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  forceRecompute: () => Promise<void>;
}

export function useSuperFastAnalytics({
  classId,
  teacherId,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: UseSuperFastAnalyticsOptions): UseSuperFastAnalyticsReturn {
  
  // Data states
  const [quickStats, setQuickStats] = useState<any | null>(null);
  const [fullAnalytics, setFullAnalytics] = useState<any | null>(null);
  
  // Loading states
  const [loadingQuick, setLoadingQuick] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Cache metadata
  const [cached, setCached] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Refs for cleanup and tracking
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  
  // Check if data is stale (older than 5 minutes)
  const isStale = lastUpdated ? Date.now() - lastUpdated.getTime() > 5 * 60 * 1000 : true;

  // Load quick stats (immediate) from pre-computed cache
  const loadQuickStats = useCallback(async () => {
    if (!classId || isUnmountedRef.current) return;
    
    try {
      setLoadingQuick(true);
      setError(null);
      
      console.log('🚀 Loading quick stats from cache...');
      
      const response = await fetch(`/api/analytics/precomputed?classId=${classId}&type=quick`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setQuickStats(result.data);
        setCached(result.cached);
        setLastUpdated(new Date(result.data.lastUpdated || result.lastUpdated));
        console.log('✅ Quick stats loaded:', result.cached ? 'from cache' : 'computed on demand');
      } else {
        throw new Error(result.error || 'Failed to load quick stats');
      }
      
    } catch (error) {
      console.error('❌ Failed to load quick stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load quick stats');
      
      // Fallback to empty state with retry option
      setQuickStats({
        totalStudents: 0,
        averagePerformance: 0,
        passRate: 0,
        testsCompleted: 0,
        lastUpdated: new Date()
      });
    } finally {
      setLoadingQuick(false);
    }
  }, [classId]);

  // Load full analytics from pre-computed cache (background)
  const loadFullAnalytics = useCallback(async () => {
    if (!classId || isUnmountedRef.current) return;
    
    try {
      setLoadingFull(true);
      setError(null);
      
      console.log('📊 Loading full analytics from cache...');
      
      const response = await fetch(`/api/analytics/precomputed?classId=${classId}&type=full`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setFullAnalytics(result.data);
        setCached(result.cached);
        setLastUpdated(new Date(result.data.lastUpdated || result.lastUpdated));
        console.log('✅ Full analytics loaded:', result.cached ? 'from cache' : 'computed on demand');
      } else {
        console.warn('⚠️ Full analytics not available, will use quick stats only');
      }
      
    } catch (error) {
      console.error('❌ Failed to load full analytics:', error);
      // Don't set error for full analytics - quick stats are sufficient
    } finally {
      setLoadingFull(false);
    }
  }, [classId]);

  // Force recomputation of analytics
  const forceRecompute = useCallback(async () => {
    if (!classId || isUnmountedRef.current) return;
    
    try {
      console.log('🔄 Force recomputing analytics...');
      
      const response = await fetch('/api/analytics/precomputed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId,
          force: true
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update with fresh data
        if (result.data.quickStats) {
          setQuickStats(result.data.quickStats);
        }
        if (result.data.fullAnalytics) {
          setFullAnalytics(result.data.fullAnalytics);
        }
        setCached(false);
        setLastUpdated(new Date());
        console.log('✅ Analytics recomputed successfully');
      } else {
        throw new Error(result.error || 'Failed to recompute analytics');
      }
      
    } catch (error) {
      console.error('❌ Failed to recompute analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to recompute analytics');
    }
  }, [classId]);

  // Refresh analytics (load from cache or compute if needed)
  const refresh = useCallback(async () => {
    await Promise.all([
      loadQuickStats(),
      loadFullAnalytics()
    ]);
  }, [loadQuickStats, loadFullAnalytics]);

  // Initial load
  useEffect(() => {
    if (classId) {
      // Load quick stats immediately
      loadQuickStats();
      
      // Load full analytics in background after a short delay
      const delay = setTimeout(() => {
        loadFullAnalytics();
      }, 500);
      
      return () => clearTimeout(delay);
    }
  }, [classId, loadQuickStats, loadFullAnalytics]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        if (!isUnmountedRef.current && isStale) {
          console.log('🔄 Auto-refreshing stale analytics...');
          refresh();
        }
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, refreshInterval, isStale, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    // Data
    quickStats,
    fullAnalytics,
    
    // Loading states
    loadingQuick,
    loadingFull,
    
    // Error handling
    error,
    
    // Metadata
    isStale,
    lastUpdated,
    cached,
    
    // Actions
    refresh,
    forceRecompute
  };
}