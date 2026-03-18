import { describe, it, expect } from "vitest";
import { DNSHandler } from "../handlers/dns-handler";
import { CDNHandler } from "../handlers/cdn-handler";
import { MessageQueueHandler } from "../handlers/message-queue-handler";
import { APIGatewayHandler } from "../handlers/api-gateway-handler";
import { NoSQLDBHandler } from "../handlers/nosql-db-handler";
import { ObjectStorageHandler } from "../handlers/object-storage-handler";
import { SearchIndexHandler } from "../handlers/search-index-handler";
import { EventStreamHandler } from "../handlers/event-stream-handler";
import { SimulationNode, NodeType, HealthStatus, EventType, Protocol } from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeNode(id: string, type: NodeType, config: any): SimulationNode {
  return { id, type, label: id, config,
    state: { queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
    position: { x: 0, y: 0 }, connections: [] };
}
function makeCtx(node: SimulationNode, connections: any[] = []) {
  return new SimContextImpl(0, new Map([[node.id, node]]), new Map(connections.map((c: any) => [c.id, c])), new EventQueue(), new MetricsCollector(60000));
}
function makeReq(targetId: string) {
  return { id: "req1", timestamp: 0, type: EventType.REQUEST_ARRIVE as const, sourceNodeId: "caller", targetNodeId: targetId,
    transaction: { id: "tx1", message: { method: "GET", path: "/data" }, protocol: Protocol.HTTP, result: null, metadata: {} } };
}
const base = { concurrencyLimit: 100, maxQueueSize: 1000, processingLatency: { type: "constant" as const, value: 1 }, errorRate: 0 };

describe("DNSHandler", () => {
  it("returns RESPONSE with resolution latency", () => {
    const handler = new DNSHandler();
    const node = makeNode("dns1", NodeType.DNS, { ...base, resolutionLatency: { type: "constant", value: 5 }, ttl: 300000, failureRate: 0 });
    const events = handler.onEvent(node, makeReq("dns1"), makeCtx(node));
    const resp = events.find((e) => e.type === EventType.RESPONSE);
    expect(resp).toBeDefined();
    expect(resp!.timestamp).toBe(5);
    expect(resp!.transaction!.result!.status).toBe("SUCCESS");
  });
});

describe("CDNHandler", () => {
  it("returns CACHE_HIT on hit", () => {
    const handler = new CDNHandler();
    const node = makeNode("cdn1", NodeType.CDN, { ...base, cacheHitRate: 1.0, originFallbackLatency: { type: "constant", value: 50 }, ttl: 86400000 });
    const events = handler.onEvent(node, makeReq("cdn1"), makeCtx(node));
    expect(events.find((e) => e.type === EventType.CACHE_HIT)).toBeDefined();
  });
  it("forwards to origin on miss", () => {
    const handler = new CDNHandler();
    const conn = { id: "c1", sourceNodeId: "cdn1", targetNodeId: "origin1", protocol: Protocol.HTTP, latency: { type: "constant" as const, value: 10 }, timeout: 5000 };
    const node = makeNode("cdn1", NodeType.CDN, { ...base, cacheHitRate: 0.0, originFallbackLatency: { type: "constant", value: 50 }, ttl: 86400000 });
    node.connections = ["c1"];
    const events = handler.onEvent(node, makeReq("cdn1"), makeCtx(node, [conn]));
    expect(events.find((e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "origin1")).toBeDefined();
  });
});

describe("MessageQueueHandler", () => {
  it("enqueues message and returns QUEUE_ENQUEUE", () => {
    const handler = new MessageQueueHandler();
    const node = makeNode("mq1", NodeType.MESSAGE_QUEUE, { ...base, maxDepth: 1000, consumerThroughput: 100, deliveryGuarantee: "at-least-once" });
    const events = handler.onEvent(node, makeReq("mq1"), makeCtx(node));
    expect(events.find((e) => e.type === EventType.QUEUE_ENQUEUE)).toBeDefined();
  });
});

describe("APIGatewayHandler", () => {
  it("forwards request after auth latency", () => {
    const handler = new APIGatewayHandler();
    const conn = { id: "c1", sourceNodeId: "gw1", targetNodeId: "svc1", protocol: Protocol.HTTP, latency: { type: "constant" as const, value: 2 }, timeout: 5000 };
    const node = makeNode("gw1", NodeType.API_GATEWAY, { ...base, rateLimit: 1000, authLatency: { type: "constant", value: 3 } });
    node.connections = ["c1"];
    const events = handler.onEvent(node, makeReq("gw1"), makeCtx(node, [conn]));
    const forward = events.find((e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "svc1");
    expect(forward).toBeDefined();
    expect(forward!.timestamp).toBe(5);
  });
  it("returns 429 when rate limited", () => {
    const handler = new APIGatewayHandler();
    const node = makeNode("gw1", NodeType.API_GATEWAY, { ...base, rateLimit: 0, authLatency: { type: "constant", value: 3 } });
    const events = handler.onEvent(node, makeReq("gw1"), makeCtx(node));
    const resp = events.find((e) => e.type === EventType.RESPONSE);
    expect(resp!.transaction!.result!.statusCode).toBe(429);
  });
});

describe("NoSQLDBHandler", () => {
  it("uses readLatency for GET requests", () => {
    const handler = new NoSQLDBHandler();
    const node = makeNode("nosql1", NodeType.NOSQL_DB, { ...base, partitionCount: 8, readLatency: { type: "constant", value: 5 }, writeLatency: { type: "constant", value: 15 }, consistencyModel: "eventual" });
    const events = handler.onEvent(node, makeReq("nosql1"), makeCtx(node));
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete).toBeDefined();
    expect(complete!.timestamp).toBe(5);
  });
});

describe("ObjectStorageHandler", () => {
  it("responds with read latency", () => {
    const handler = new ObjectStorageHandler();
    const node = makeNode("s3", NodeType.OBJECT_STORAGE, { ...base, readLatency: { type: "constant", value: 20 }, writeLatency: { type: "constant", value: 50 }, throughputLimit: 5000 });
    const events = handler.onEvent(node, makeReq("s3"), makeCtx(node));
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete!.timestamp).toBe(20);
  });
});

describe("SearchIndexHandler", () => {
  it("responds with query latency", () => {
    const handler = new SearchIndexHandler();
    const node = makeNode("es1", NodeType.SEARCH_INDEX, { ...base, queryLatency: { type: "constant", value: 12 }, indexingLag: 1000 });
    const events = handler.onEvent(node, makeReq("es1"), makeCtx(node));
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete!.timestamp).toBe(12);
  });
});

describe("EventStreamHandler", () => {
  it("enqueues to partition and returns QUEUE_ENQUEUE", () => {
    const handler = new EventStreamHandler();
    const node = makeNode("kafka1", NodeType.EVENT_STREAM, { ...base, partitionCount: 12, consumerGroupLag: 0, retention: 86400000 });
    const events = handler.onEvent(node, makeReq("kafka1"), makeCtx(node));
    expect(events.find((e) => e.type === EventType.QUEUE_ENQUEUE)).toBeDefined();
  });
});
