// === Types ===

/** Point-in-time summary of a node's request metrics within a rolling window. */
export interface MetricsSnapshot {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
}

/** Internal entry tracking a single request's timing and outcome. */
interface MetricEntry {
  timestamp: number;
  latency: number;
  isError: boolean;
}

// === Collector ===

/**
 * Per-node rolling-window metrics collector.
 *
 * Stores raw request entries keyed by node ID and computes aggregate
 * statistics (count, error rate, percentiles) over a configurable
 * time window. Old entries are pruned lazily on each snapshot read.
 */
export class MetricsCollector {
  /** Raw entries per node ID. */
  private data = new Map<string, MetricEntry[]>();
  /** Rolling window duration in simulation-time milliseconds. */
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  /** Append a request metric entry for a node. */
  recordRequest(nodeId: string, timestamp: number, latency: number, isError: boolean): void {
    if (!this.data.has(nodeId)) {
      this.data.set(nodeId, []);
    }
    this.data.get(nodeId)!.push({ timestamp, latency, isError });
  }

  /**
   * Compute an aggregate snapshot for a node within the rolling window.
   * Lazily prunes entries older than `windowMs` from the latest timestamp.
   */
  getSnapshot(nodeId: string): MetricsSnapshot {
    const entries = this.data.get(nodeId);
    if (!entries || entries.length === 0) {
      return { requestCount: 0, errorCount: 0, errorRate: 0, avgLatency: 0, p50: 0, p95: 0, p99: 0 };
    }

    // Prune entries outside the rolling window
    const latestTime = entries[entries.length - 1].timestamp;
    const cutoff = latestTime - this.windowMs;
    const inWindow = entries.filter((e) => e.timestamp >= cutoff);
    this.data.set(nodeId, inWindow);

    if (inWindow.length === 0) {
      return { requestCount: 0, errorCount: 0, errorRate: 0, avgLatency: 0, p50: 0, p95: 0, p99: 0 };
    }

    const requestCount = inWindow.length;
    const errorCount = inWindow.filter((e) => e.isError).length;
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
    const latencies = inWindow.map((e) => e.latency).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      requestCount, errorCount, errorRate, avgLatency,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    };
  }

  /** Clear metrics for a single node. */
  clear(nodeId: string): void {
    this.data.delete(nodeId);
  }

  /** Clear all metrics across every node. */
  clearAll(): void {
    this.data.clear();
  }
}

// === Helpers ===

/** Compute the p-th percentile from a pre-sorted array using the ceiling method. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
