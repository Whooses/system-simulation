import { describe, it, expect } from "vitest";
import { CacheHandler } from "../handlers/cache-handler";
import { SimulationNode, NodeType, HealthStatus, EventType, Protocol, CacheConfig } from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeCacheNode(hitRate = 0.8): SimulationNode {
  return {
    id: "cache1", type: NodeType.DISTRIBUTED_CACHE, label: "Cache",
    config: { concurrencyLimit: 1000, maxQueueSize: 5000, processingLatency: { type: "constant", value: 1 }, errorRate: 0, capacity: 10000, hitRate, evictionPolicy: "LRU", ttl: 300000, replicationLag: 0 } as CacheConfig,
    state: { queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
    position: { x: 0, y: 0 }, connections: [],
  };
}
function makeContext(node: SimulationNode) { return new SimContextImpl(0, new Map([[node.id, node]]), new Map(), new EventQueue(), new MetricsCollector(60000)); }
function makeRequest() {
  return { id: "req1", timestamp: 0, type: EventType.REQUEST_ARRIVE as const, sourceNodeId: "server1", targetNodeId: "cache1",
    transaction: { id: "tx1", message: { method: "GET", path: "user:123" }, protocol: Protocol.TCP, result: null, metadata: {} } };
}

describe("CacheHandler", () => {
  it("returns CACHE_HIT with 100% hit rate", () => {
    const handler = new CacheHandler();
    const events = handler.onEvent(makeCacheNode(1.0), makeRequest(), makeContext(makeCacheNode(1.0)));
    expect(events.find((e) => e.type === EventType.CACHE_HIT)).toBeDefined();
    expect(events.find((e) => e.type === EventType.CACHE_HIT)!.transaction!.result!.status).toBe("SUCCESS");
  });
  it("returns CACHE_MISS with 0% hit rate", () => {
    const handler = new CacheHandler();
    const events = handler.onEvent(makeCacheNode(0.0), makeRequest(), makeContext(makeCacheNode(0.0)));
    expect(events.find((e) => e.type === EventType.CACHE_MISS)).toBeDefined();
  });
});
