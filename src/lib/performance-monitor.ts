/**
 * Performance Monitoring System
 * =============================
 * 
 * Tracks and displays real-time performance metrics for the QC report generator.
 * Monitors first paint, data loading, chart rendering, and user interaction timing.
 */

export interface PerformanceMetrics {
  // Core timing metrics
  firstPaint: number | null;
  domContentLoaded: number | null;
  dataDecompressionStart: number | null;
  dataDecompressionEnd: number | null;
  dataParsingStart: number | null;
  dataParsingEnd: number | null;
  firstChartVisible: number | null;
  firstChartRendered: number | null;
  
  // Chart-specific metrics
  chartMetrics: Map<string, ChartMetric>;
  
  // Memory metrics
  memoryUsage: MemoryMetric[];
  
  // User interaction metrics
  interactionMetrics: InteractionMetric[];
}

export interface ChartMetric {
  id: string;
  title: string;
  visibilityStart: number;
  dataLoadStart: number;
  dataLoadEnd: number;
  renderStart: number;
  renderEnd: number;
  memoryFootprint: number;
  cacheHit: boolean;
}

export interface MemoryMetric {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface InteractionMetric {
  type: 'scroll' | 'filter' | 'resize';
  timestamp: number;
  responseTime: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private observers: Set<(metrics: PerformanceMetrics) => void> = new Set();
  private memoryInterval: number | null = null;

  constructor() {
    this.startTime = performance.now();
    this.metrics = {
      firstPaint: null,
      domContentLoaded: null,
      dataDecompressionStart: null,
      dataDecompressionEnd: null,
      dataParsingStart: null,
      dataParsingEnd: null,
      firstChartVisible: null,
      firstChartRendered: null,
      chartMetrics: new Map(),
      memoryUsage: [],
      interactionMetrics: []
    };

    this.setupBrowserMetrics();
    this.startMemoryMonitoring();
  }

  private setupBrowserMetrics() {
    // First paint detection
    if ('PerformancePaintTiming' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-paint' && !this.metrics.firstPaint) {
            this.metrics.firstPaint = entry.startTime;
            this.notifyObservers();
          }
          if (entry.name === 'first-contentful-paint' && !this.metrics.firstPaint) {
            this.metrics.firstPaint = entry.startTime;
            this.notifyObservers();
          }
        }
      });
      observer.observe({ entryTypes: ['paint'] });
    }

    // DOM content loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.metrics.domContentLoaded = performance.now() - this.startTime;
        this.notifyObservers();
      });
    } else {
      this.metrics.domContentLoaded = 0;
    }
  }

  private startMemoryMonitoring() {
    if ('memory' in performance) {
      this.memoryInterval = window.setInterval(() => {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage.push({
          timestamp: performance.now() - this.startTime,
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        });

        // Keep only last 100 entries
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }
      }, 1000);
    }
  }

  // Data loading timing
  markDataDecompressionStart() {
    this.metrics.dataDecompressionStart = performance.now() - this.startTime;
    console.log(`🔄 Data decompression started at ${this.metrics.dataDecompressionStart.toFixed(2)}ms`);
    this.notifyObservers();
  }

  markDataDecompressionEnd() {
    this.metrics.dataDecompressionEnd = performance.now() - this.startTime;
    const duration = this.metrics.dataDecompressionEnd - (this.metrics.dataDecompressionStart || 0);
    console.log(`✅ Data decompression completed in ${duration.toFixed(2)}ms`);
    this.notifyObservers();
  }

  markDataParsingStart() {
    this.metrics.dataParsingStart = performance.now() - this.startTime;
    console.log(`🔍 Data parsing started at ${this.metrics.dataParsingStart.toFixed(2)}ms`);
    this.notifyObservers();
  }

  markDataParsingEnd() {
    this.metrics.dataParsingEnd = performance.now() - this.startTime;
    const duration = this.metrics.dataParsingEnd - (this.metrics.dataParsingStart || 0);
    console.log(`📊 Data parsing completed in ${duration.toFixed(2)}ms`);
    this.notifyObservers();
  }

  // Chart-specific timing
  startChartMetric(id: string, title: string): ChartMetric {
    const metric: ChartMetric = {
      id,
      title,
      visibilityStart: performance.now() - this.startTime,
      dataLoadStart: 0,
      dataLoadEnd: 0,
      renderStart: 0,
      renderEnd: 0,
      memoryFootprint: 0,
      cacheHit: false
    };

    this.metrics.chartMetrics.set(id, metric);
    console.log(`👁️ Chart "${title}" became visible at ${metric.visibilityStart.toFixed(2)}ms`);
    
    // Track first chart visibility
    if (!this.metrics.firstChartVisible) {
      this.metrics.firstChartVisible = metric.visibilityStart;
    }

    this.notifyObservers();
    return metric;
  }

  markChartDataLoadStart(id: string) {
    const metric = this.metrics.chartMetrics.get(id);
    if (metric) {
      metric.dataLoadStart = performance.now() - this.startTime;
      console.log(`📥 Chart "${metric.title}" data loading started at ${metric.dataLoadStart.toFixed(2)}ms`);
      this.notifyObservers();
    }
  }

  markChartDataLoadEnd(id: string, cacheHit: boolean = false) {
    const metric = this.metrics.chartMetrics.get(id);
    if (metric) {
      metric.dataLoadEnd = performance.now() - this.startTime;
      metric.cacheHit = cacheHit;
      const duration = metric.dataLoadEnd - metric.dataLoadStart;
      console.log(`📊 Chart "${metric.title}" data loaded in ${duration.toFixed(2)}ms ${cacheHit ? '(cached)' : ''}`);
      this.notifyObservers();
    }
  }

  markChartRenderStart(id: string) {
    const metric = this.metrics.chartMetrics.get(id);
    if (metric) {
      metric.renderStart = performance.now() - this.startTime;
      console.log(`🎨 Chart "${metric.title}" rendering started at ${metric.renderStart.toFixed(2)}ms`);
      this.notifyObservers();
    }
  }

  markChartRenderEnd(id: string, memoryFootprint: number = 0) {
    const metric = this.metrics.chartMetrics.get(id);
    if (metric) {
      metric.renderEnd = performance.now() - this.startTime;
      metric.memoryFootprint = memoryFootprint;
      const totalDuration = metric.renderEnd - metric.visibilityStart;
      const renderDuration = metric.renderEnd - metric.renderStart;
      console.log(`✅ Chart "${metric.title}" rendered in ${renderDuration.toFixed(2)}ms (total: ${totalDuration.toFixed(2)}ms)`);
      
      // Track first chart completion
      if (!this.metrics.firstChartRendered) {
        this.metrics.firstChartRendered = metric.renderEnd;
      }

      this.notifyObservers();
    }
  }

  // Interaction timing
  trackInteraction(type: InteractionMetric['type'], responseTime: number) {
    this.metrics.interactionMetrics.push({
      type,
      timestamp: performance.now() - this.startTime,
      responseTime
    });

    // Keep only last 50 interactions
    if (this.metrics.interactionMetrics.length > 50) {
      this.metrics.interactionMetrics = this.metrics.interactionMetrics.slice(-50);
    }

    this.notifyObservers();
  }

  // Observer pattern for real-time updates
  subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.observers.add(callback);
    callback(this.metrics); // Send current state immediately
    return () => this.observers.delete(callback);
  }

  unsubscribe(callback: (metrics: PerformanceMetrics) => void) {
    this.observers.delete(callback);
  }

  private notifyObservers() {
    this.observers.forEach(callback => callback(this.metrics));
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Generate performance report
  generateReport(): string {
    const metrics = this.metrics;
    const report = [];

    report.push('🚀 PERFORMANCE REPORT');
    report.push('===================');

    // Core timing
    if (metrics.firstPaint) {
      report.push(`First Paint: ${metrics.firstPaint.toFixed(2)}ms`);
    }
    if (metrics.domContentLoaded) {
      report.push(`DOM Ready: ${metrics.domContentLoaded.toFixed(2)}ms`);
    }

    // Data loading
    if (metrics.dataDecompressionStart && metrics.dataDecompressionEnd) {
      const decompressionTime = metrics.dataDecompressionEnd - metrics.dataDecompressionStart;
      report.push(`Data Decompression: ${decompressionTime.toFixed(2)}ms`);
    }
    if (metrics.dataParsingStart && metrics.dataParsingEnd) {
      const parsingTime = metrics.dataParsingEnd - metrics.dataParsingStart;
      report.push(`Data Parsing: ${parsingTime.toFixed(2)}ms`);
    }

    // Chart metrics
    if (metrics.firstChartVisible && metrics.firstChartRendered) {
      const firstChartTime = metrics.firstChartRendered - metrics.firstChartVisible;
      report.push(`First Chart: ${firstChartTime.toFixed(2)}ms`);
    }

    report.push('');
    report.push('📊 CHART DETAILS');
    report.push('================');
    
    for (const [id, metric] of metrics.chartMetrics) {
      const totalTime = metric.renderEnd ? metric.renderEnd - metric.visibilityStart : 0;
      const dataTime = metric.dataLoadEnd ? metric.dataLoadEnd - metric.dataLoadStart : 0;
      const renderTime = metric.renderEnd ? metric.renderEnd - metric.renderStart : 0;
      
      report.push(`${metric.title}:`);
      report.push(`  Total: ${totalTime.toFixed(2)}ms`);
      report.push(`  Data: ${dataTime.toFixed(2)}ms ${metric.cacheHit ? '(cached)' : ''}`);
      report.push(`  Render: ${renderTime.toFixed(2)}ms`);
      if (metric.memoryFootprint) {
        report.push(`  Memory: ${(metric.memoryFootprint / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    // Memory summary
    if (metrics.memoryUsage.length > 0) {
      const current = metrics.memoryUsage[metrics.memoryUsage.length - 1];
      report.push('');
      report.push('💾 MEMORY USAGE');
      report.push('===============');
      report.push(`Current: ${(current.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      report.push(`Total: ${(current.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    }

    return report.join('\n');
  }

  // Cleanup
  destroy() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    this.observers.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions for common usage
export const markDataDecompressionStart = () => performanceMonitor.markDataDecompressionStart();
export const markDataDecompressionEnd = () => performanceMonitor.markDataDecompressionEnd();
export const markDataParsingStart = () => performanceMonitor.markDataParsingStart();
export const markDataParsingEnd = () => performanceMonitor.markDataParsingEnd();

export const startChartMetric = (id: string, title: string) => performanceMonitor.startChartMetric(id, title);
export const markChartDataLoadStart = (id: string) => performanceMonitor.markChartDataLoadStart(id);
export const markChartDataLoadEnd = (id: string, cacheHit?: boolean) => performanceMonitor.markChartDataLoadEnd(id, cacheHit);
export const markChartRenderStart = (id: string) => performanceMonitor.markChartRenderStart(id);
export const markChartRenderEnd = (id: string, memoryFootprint?: number) => performanceMonitor.markChartRenderEnd(id, memoryFootprint);

export const trackInteraction = (type: InteractionMetric['type'], responseTime: number) => 
  performanceMonitor.trackInteraction(type, responseTime);

export const generatePerformanceReport = () => performanceMonitor.generateReport();
