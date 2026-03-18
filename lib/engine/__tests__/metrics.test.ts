import { describe, it, expect } from "vitest";
import { MetricsCollector } from "../metrics";

describe("MetricsCollector", () => {
  it("records and retrieves request count", () => {
    const m = new MetricsCollector(60000);
    m.recordRequest("node1", 100, 50, false);
    m.recordRequest("node1", 200, 30, false);
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.requestCount).toBe(2);
    expect(snapshot.errorCount).toBe(0);
  });

  it("tracks error count", () => {
    const m = new MetricsCollector(60000);
    m.recordRequest("node1", 100, 50, true);
    m.recordRequest("node1", 200, 30, false);
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.errorCount).toBe(1);
    expect(snapshot.errorRate).toBeCloseTo(0.5);
  });

  it("computes latency percentiles", () => {
    const m = new MetricsCollector(60000);
    for (let i = 1; i <= 100; i++) {
      m.recordRequest("node1", i * 10, i, false);
    }
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.p50).toBeCloseTo(50, 0);
    expect(snapshot.p95).toBeCloseTo(95, 0);
    expect(snapshot.p99).toBeCloseTo(99, 0);
  });

  it("evicts entries outside the window", () => {
    const m = new MetricsCollector(1000);
    m.recordRequest("node1", 100, 50, false);
    m.recordRequest("node1", 1200, 30, false);
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.requestCount).toBe(1);
  });

  it("returns zero snapshot for unknown node", () => {
    const m = new MetricsCollector(60000);
    const snapshot = m.getSnapshot("unknown");
    expect(snapshot.requestCount).toBe(0);
    expect(snapshot.errorRate).toBe(0);
  });

  it("clears metrics for a node", () => {
    const m = new MetricsCollector(60000);
    m.recordRequest("node1", 100, 50, false);
    m.clear("node1");
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.requestCount).toBe(0);
  });
});
