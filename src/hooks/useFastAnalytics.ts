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
  
  // Load quick stats (immediate)
  const loadQuickStats = useCallback(async () => {
    if (!classId || isUnmountedRef.current) return;
    
    try {
      setLoadingQuick(true);
      setError(null);
      
      console.log('🚀 Loading quick stats from cache...');
      const stats = await PrecomputedAnalyticsService.getQuickStats(classId);
      
      if (!isUnmountedRef.current) {
        setQuickStats(stats);
        console.log('✅ Quick stats loaded:', stats);
      }
      
    } catch (err: any) {
      console.error('❌ Error loading quick stats:', err);
      if (!isUnmountedRef.current) {
        setError(err.message || 'Failed to load quick stats');
      }
    } finally {
      if (!isUnmountedRef.current) {
        setLoadingQuick(false);
      }
    }
  }, [classId]);

  // Load full analytics (background)
  const loadFullAnalytics = useCallback(async () => {
    if (!classId || isUnmountedRef.current) return;
    
    try {
      setLoadingFull(true);
      
      console.log('🔄 Loading full analytics from cache...');
      const analytics = await PrecomputedAnalyticsService.getPrecomputedAnalytics(classId);
      
      if (!isUnmountedRef.current) {
        setFullAnalytics(analytics);
        console.log('✅ Full analytics loaded:', analytics ? 'Found' : 'Not found');
      }
      
    } catch (err: any) {
      console.error('❌ Error loading full analytics:', err);
      // Don't set error for full analytics failure - quick stats might still work
    } finally {
      if (!isUnmountedRef.current) {
        setLoadingFull(false);
      }
    }
  }, [classId]);

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

  // Setup auto-refresh
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return;
    
    refreshIntervalRef.current = setInterval(() => {
      if (!isUnmountedRef.current) {
        console.log('🔄 Auto-refreshing analytics...');
        refresh();
      }
    }, refreshInterval);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, refresh]);

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