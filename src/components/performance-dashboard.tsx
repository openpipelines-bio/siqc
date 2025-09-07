import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { performanceMonitor, PerformanceMetrics } from '../lib/performance-monitor';

/**
 * Real-time Performance Dashboard
 * Shows live performance metrics in a collapsible panel
 */

export function PerformanceDashboard() {
  const [metrics, setMetrics] = createSignal<PerformanceMetrics>(performanceMonitor.getMetrics());
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [showDetails, setShowDetails] = createSignal(false);

  // Subscribe to performance updates
  createEffect(() => {
    const unsubscribe = performanceMonitor.subscribe(setMetrics);
    onCleanup(unsubscribe);
  });

  const formatTime = (time: number | null) => {
    if (time === null) return '—';
    return `${time.toFixed(1)}ms`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const getStatusColor = (time: number | null, threshold: number) => {
    if (time === null) return 'text-gray-400';
    if (time < threshold) return 'text-green-600';
    if (time < threshold * 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const currentMetrics = () => metrics();

  return (
    <div class="fixed bottom-4 right-4 z-50">
      {/* Compact View */}
      <Show when={!isExpanded()}>
        <div 
          class="bg-gray-900 text-white rounded-lg p-3 cursor-pointer shadow-lg border border-gray-700 hover:bg-gray-800 transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span class="text-sm font-medium">Performance</span>
            <Show when={currentMetrics().firstPaint}>
              <span class={`text-xs ${getStatusColor(currentMetrics().firstPaint, 1000)}`}>
                {formatTime(currentMetrics().firstPaint)}
              </span>
            </Show>
          </div>
        </div>
      </Show>

      {/* Expanded Dashboard */}
      <Show when={isExpanded()}>
        <div class="bg-gray-900 text-white rounded-lg p-4 shadow-lg border border-gray-700 w-80 max-h-96 overflow-y-auto">
          {/* Header */}
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-green-400">⚡ Performance Monitor</h3>
            <div class="flex space-x-2">
              <button
                class="text-xs text-gray-400 hover:text-white"
                onClick={() => setShowDetails(!showDetails())}
              >
                {showDetails() ? 'Simple' : 'Details'}
              </button>
              <button
                class="text-xs text-gray-400 hover:text-white"
                onClick={() => setIsExpanded(false)}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Core Metrics */}
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-xs">
              <span class="text-gray-300">First Paint:</span>
              <span class={getStatusColor(currentMetrics().firstPaint, 1000)}>
                {formatTime(currentMetrics().firstPaint)}
              </span>
            </div>
            
            <div class="flex justify-between text-xs">
              <span class="text-gray-300">DOM Ready:</span>
              <span class={getStatusColor(currentMetrics().domContentLoaded, 500)}>
                {formatTime(currentMetrics().domContentLoaded)}
              </span>
            </div>

            <Show when={currentMetrics().dataDecompressionStart && currentMetrics().dataDecompressionEnd}>
              <div class="flex justify-between text-xs">
                <span class="text-gray-300">Data Decompression:</span>
                <span class={getStatusColor(
                  currentMetrics().dataDecompressionEnd! - currentMetrics().dataDecompressionStart!, 
                  2000
                )}>
                  {formatTime(currentMetrics().dataDecompressionEnd! - currentMetrics().dataDecompressionStart!)}
                </span>
              </div>
            </Show>

            <Show when={currentMetrics().dataParsingStart && currentMetrics().dataParsingEnd}>
              <div class="flex justify-between text-xs">
                <span class="text-gray-300">Data Parsing:</span>
                <span class={getStatusColor(
                  currentMetrics().dataParsingEnd! - currentMetrics().dataParsingStart!, 
                  1000
                )}>
                  {formatTime(currentMetrics().dataParsingEnd! - currentMetrics().dataParsingStart!)}
                </span>
              </div>
            </Show>

            <Show when={currentMetrics().firstChartVisible && currentMetrics().firstChartRendered}>
              <div class="flex justify-between text-xs">
                <span class="text-gray-300">First Chart:</span>
                <span class={getStatusColor(
                  currentMetrics().firstChartRendered! - currentMetrics().firstChartVisible!, 
                  3000
                )}>
                  {formatTime(currentMetrics().firstChartRendered! - currentMetrics().firstChartVisible!)}
                </span>
              </div>
            </Show>
          </div>

          {/* Memory Usage */}
          <Show when={currentMetrics().memoryUsage.length > 0}>
            {(() => {
              const latest = currentMetrics().memoryUsage[currentMetrics().memoryUsage.length - 1];
              return (
                <div class="border-t border-gray-700 pt-3 mb-3">
                  <div class="text-xs text-gray-300 mb-2">Memory Usage</div>
                  <div class="flex justify-between text-xs">
                    <span class="text-gray-400">Used:</span>
                    <span class="text-blue-400">{formatMemory(latest.usedJSHeapSize)}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span class="text-gray-400">Total:</span>
                    <span class="text-gray-300">{formatMemory(latest.totalJSHeapSize)}</span>
                  </div>
                </div>
              );
            })()}
          </Show>

          {/* Chart Details */}
          <Show when={showDetails() && currentMetrics().chartMetrics.size > 0}>
            <div class="border-t border-gray-700 pt-3">
              <div class="text-xs text-gray-300 mb-2">Chart Performance</div>
              <div class="space-y-2 max-h-32 overflow-y-auto">
                <For each={Array.from(currentMetrics().chartMetrics.values())}>
                  {(chart) => {
                    const totalTime = chart.renderEnd ? chart.renderEnd - chart.visibilityStart : null;
                    const dataTime = chart.dataLoadEnd ? chart.dataLoadEnd - chart.dataLoadStart : null;
                    const renderTime = chart.renderEnd ? chart.renderEnd - chart.renderStart : null;
                    
                    return (
                      <div class="bg-gray-800 rounded p-2">
                        <div class="text-xs font-medium text-green-400 truncate">{chart.title}</div>
                        <div class="grid grid-cols-3 gap-1 text-xs mt-1">
                          <div>
                            <span class="text-gray-400">Total:</span>
                            <span class={`ml-1 ${getStatusColor(totalTime, 3000)}`}>
                              {formatTime(totalTime)}
                            </span>
                          </div>
                          <div>
                            <span class="text-gray-400">Data:</span>
                            <span class={`ml-1 ${getStatusColor(dataTime, 1000)}`}>
                              {formatTime(dataTime)}
                              {chart.cacheHit && <span class="text-green-400">*</span>}
                            </span>
                          </div>
                          <div>
                            <span class="text-gray-400">Render:</span>
                            <span class={`ml-1 ${getStatusColor(renderTime, 2000)}`}>
                              {formatTime(renderTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
              <div class="text-xs text-gray-500 mt-2">* = cached data</div>
            </div>
          </Show>

          {/* Action Buttons */}
          <div class="border-t border-gray-700 pt-3 mt-3">
            <div class="flex space-x-2">
              <button
                class="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                onClick={() => console.log(performanceMonitor.generateReport())}
              >
                Log Report
              </button>
              <button
                class="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded"
                onClick={() => {
                  const report = performanceMonitor.generateReport();
                  navigator.clipboard?.writeText(report);
                  console.log('Performance report copied to clipboard');
                }}
              >
                Copy Report
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
