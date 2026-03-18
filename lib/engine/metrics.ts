export interface MetricsSnapshot {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
}

interface MetricEntry {
  timestamp: number;
  latency: number;
  isError: boolean;
}

export class MetricsCollector {
  private data = new Map<string, MetricEntry[]>();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  recordRequest(nodeId: string, timestamp: number, latency: number, isError: boolean): void {
    if (!this.data.has(nodeId)) {
      this.data.set(nodeId, []);
    }
    this.data.get(nodeId)!.push({ timestamp, latency, isError });
  }

  getSnapshot(nodeId: string): MetricsSnapshot {
    const entries = this.data.get(nodeId);
    if (!entries || entries.length === 0) {
      return { requestCount: 0, errorCount: 0, errorRate: 0, avgLatency: 0, p50: 0, p95: 0, p99: 0 };
    }

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

  clear(nodeId: string): void {
    this.data.delete(nodeId);
  }

  clearAll(): void {
    this.data.clear();
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
