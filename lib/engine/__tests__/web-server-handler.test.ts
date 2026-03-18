import { describe, it, expect } from "vitest";
import { WebServerHandler } from "../handlers/web-server-handler";
import { SimulationNode, NodeType, HealthStatus, EventType, Protocol, WebServerConfig } from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeServerNode(overrides?: Partial<WebServerConfig>): SimulationNode {
  return {
    id: "server1", type: NodeType.WEB_SERVER, label: "Server",
    config: { concurrencyLimit: 2, maxQueueSize: 5, processingLatency: { type: "constant", value: 10 }, errorRate: 0, ...overrides },
    state: { queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
    position: { x: 0, y: 0 }, connections: [],
  };
}

function makeContext(currentTime: number, node: SimulationNode) {
  return new SimContextImpl(currentTime, new Map([[node.id, node]]), new Map(), new EventQueue(), new MetricsCollector(60000));
}

function makeRequestEvent(targetNodeId: string, timestamp = 0) {
  return {
    id: "req1", timestamp, type: EventType.REQUEST_ARRIVE as const,
    sourceNodeId: "client1", targetNodeId,
    transaction: { id: "tx1", message: { method: "GET", path: "/users" }, protocol: Protocol.HTTP, result: null, metadata: {} },
  };
}

describe("WebServerHandler", () => {
  const handler = new WebServerHandler();

  it("processes request and enqueues PROCESS_COMPLETE", () => {
    const node = makeServerNode();
    const ctx = makeContext(0, node);
    const events = handler.onEvent(node, makeRequestEvent("server1"), ctx);
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete).toBeDefined();
    expect(complete!.timestamp).toBe(10);
    expect(node.state.activeConnections).toBe(1);
  });

  it("returns RESPONSE on PROCESS_COMPLETE", () => {
    const node = makeServerNode();
    node.state.activeConnections = 1;
    const ctx = makeContext(10, node);
    const completeEvent = {
      id: "pc1", timestamp: 10, type: EventType.PROCESS_COMPLETE,
      sourceNodeId: "server1", targetNodeId: "server1",
      transaction: { id: "tx1", message: { method: "GET", path: "/users" }, protocol: Protocol.HTTP, result: null, metadata: { replyTo: "client1" } },
    };
    const events = handler.onEvent(node, completeEvent, ctx);
    const response = events.find((e) => e.type === EventType.RESPONSE);
    expect(response).toBeDefined();
    expect(response!.transaction!.result!.status).toBe("SUCCESS");
    expect(node.state.activeConnections).toBe(0);
  });

  it("rejects with 503 when queue is full and concurrency maxed", () => {
    const node = makeServerNode({ concurrencyLimit: 1, maxQueueSize: 0 });
    node.state.activeConnections = 1;
    const ctx = makeContext(0, node);
    const events = handler.onEvent(node, makeRequestEvent("server1"), ctx);
    const response = events.find((e) => e.type === EventType.RESPONSE);
    expect(response).toBeDefined();
    expect(response!.transaction!.result!.statusCode).toBe(503);
  });
});
