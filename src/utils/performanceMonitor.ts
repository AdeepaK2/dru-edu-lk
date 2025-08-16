// Performance monitoring utilities for grade analytics

export class PerformanceMonitor {
  private static measurements = new Map<string, number>();
  private static enabled = process.env.NODE_ENV === 'development';

  // Start measuring a performance metric
  static startMeasurement(key: string): void {
    if (!this.enabled) return;
    this.measurements.set(key, performance.now());
  }

  // End measurement and log the result
  static endMeasurement(key: string, label?: string): number {
    if (!this.enabled) return 0;
    
    const start = this.measurements.get(key);
    if (!start) return 0;

    const duration = performance.now() - start;
    this.measurements.delete(key);
    
    console.log(`🕐 Performance [${label || key}]: ${duration.toFixed(2)}ms`);
    return duration;
  }

  // Measure async function execution time
  static async measureAsync<T>(
    fn: () => Promise<T>,
    label: string
  ): Promise<{ result: T; duration: number }> {
    if (!this.enabled) {
      const result = await fn();
      return { result, duration: 0 };
    }

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      console.log(`🕐 Performance [${label}]: ${duration.toFixed(2)}ms`);
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ Performance [${label}] failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  // Log cache hit/miss statistics
  static logCacheStats(operation: string, hit: boolean, size?: number): void {
    if (!this.enabled) return;
    
    const status = hit ? '✅ Cache HIT' : '❌ Cache MISS';
    const sizeInfo = size ? ` (${size} items)` : '';
    console.log(`${status} [${operation}]${sizeInfo}`);
  }

  // Monitor Firestore query performance
  static logFirestoreQuery(
    collection: string, 
    queryType: string, 
    resultCount: number, 
    duration: number
  ): void {
    if (!this.enabled) return;
    
    console.log(
      `🔥 Firestore [${collection}] ${queryType}: ${resultCount} docs in ${duration.toFixed(2)}ms`
    );
  }

  // Log component render performance
  static logRenderTime(component: string, duration: number): void {
    if (!this.enabled) return;
    
    if (duration > 100) {
      console.warn(`⚠️ Slow render [${component}]: ${duration.toFixed(2)}ms`);
    } else {
      console.log(`🎨 Render [${component}]: ${duration.toFixed(2)}ms`);
    }
  }
}

// React hook for measuring component performance
export const usePerformanceMonitor = (componentName: string) => {
  const startRender = () => {
    PerformanceMonitor.startMeasurement(`render_${componentName}`);
  };

  const endRender = () => {
    const duration = PerformanceMonitor.endMeasurement(`render_${componentName}`, `${componentName} render`);
    PerformanceMonitor.logRenderTime(componentName, duration);
  };

  return { startRender, endRender };
};

// Utility for measuring data loading performance
export const measureDataLoading = async <T>(
  loadFn: () => Promise<T>,
  operation: string
): Promise<T> => {
  return PerformanceMonitor.measureAsync(loadFn, `Data Loading: ${operation}`)
    .then(({ result }) => result);
};

// Web Vitals monitoring
export const monitorWebVitals = () => {
  if (typeof window === 'undefined') return;

  // Monitor Core Web Vitals
  import('web-vitals').then((vitals) => {
    if (vitals.onCLS) vitals.onCLS(console.log);
    if (vitals.onFID) vitals.onFID(console.log);
    if (vitals.onFCP) vitals.onFCP(console.log);
    if (vitals.onLCP) vitals.onLCP(console.log);
    if (vitals.onTTFB) vitals.onTTFB(console.log);
  }).catch(() => {
    // web-vitals not available, ignore
  });
};

// Batch operation performance monitor
export class BatchPerformanceMonitor {
  private operations: Array<{ name: string; start: number; end?: number }> = [];
  private batchStart: number;

  constructor(private batchName: string) {
    this.batchStart = performance.now();
    PerformanceMonitor.startMeasurement(`batch_${batchName}`);
  }

  startOperation(name: string): void {
    this.operations.push({
      name,
      start: performance.now()
    });
  }

  endOperation(name: string): void {
    const operation = this.operations.find(op => op.name === name && !op.end);
    if (operation) {
      operation.end = performance.now();
      
      if (PerformanceMonitor['enabled']) {
        const duration = operation.end - operation.start;
        console.log(`  ⏱️ ${name}: ${duration.toFixed(2)}ms`);
      }
    }
  }

  endBatch(): void {
    const totalDuration = PerformanceMonitor.endMeasurement(`batch_${this.batchName}`, `Batch: ${this.batchName}`);
    
    if (PerformanceMonitor['enabled']) {
      const completedOps = this.operations.filter(op => op.end);
      const totalOpTime = completedOps.reduce((sum, op) => sum + (op.end! - op.start), 0);
      const parallelEfficiency = totalOpTime > 0 ? (totalDuration / totalOpTime) * 100 : 100;
      
      console.log(`📊 Batch Summary [${this.batchName}]:`);
      console.log(`  Total time: ${totalDuration.toFixed(2)}ms`);
      console.log(`  Operations: ${completedOps.length}`);
      console.log(`  Parallel efficiency: ${parallelEfficiency.toFixed(1)}%`);
    }
  }
}
