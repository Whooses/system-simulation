import { describe, it, expect } from "vitest";
import { ClientHandler } from "../handlers/client-handler";
import { SimulationNode, NodeType, HealthStatus, EventType, Protocol, ClientConfig } from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeClientNode(overrides?: Partial<ClientConfig>): SimulationNode {
  return {
    id: "client1", type: NodeType.CLIENT, label: "Client",
    config: {
      concurrencyLimit: 100, maxQueueSize: 1000,
      processingLatency: { type: "constant", value: 0 }, errorRate: 0,
      requestRate: 10, requestDistribution: [{ type: "GET /users", weight: 1 }],
      ...overrides,
    },
    state: { queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
    position: { x: 0, y: 0 }, connections: ["conn1"],
  };
}

function makeContext(currentTime: number, nodes: Map<string, SimulationNode>) {
  const conn = { id: "conn1", sourceNodeId: "client1", targetNodeId: "server1", protocol: Protocol.HTTP as const, latency: { type: "constant" as const, value: 5 }, timeout: 5000 };
  return new SimContextImpl(currentTime, nodes, new Map([["conn1", conn]]), new EventQueue(), new MetricsCollector(60000));
}

describe("ClientHandler", () => {
  const handler = new ClientHandler();

  it("generates a REQUEST_ARRIVE event on the first connection target", () => {
    const node = makeClientNode();
    const ctx = makeContext(0, new Map([["client1", node]]));
    const triggerEvent = { id: "trigger", timestamp: 0, type: EventType.REQUEST_ARRIVE, sourceNodeId: "client1", targetNodeId: "client1", transaction: null };
    const events = handler.onEvent(node, triggerEvent, ctx);
    const requestEvent = events.find((e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "server1");
    expect(requestEvent).toBeDefined();
    expect(requestEvent!.timestamp).toBe(5);
    expect(requestEvent!.transaction).not.toBeNull();
    expect(requestEvent!.transaction!.protocol).toBe(Protocol.HTTP);
  });

  it("schedules the next self-trigger based on request rate", () => {
    const node = makeClientNode({ requestRate: 10 });
    const ctx = makeContext(0, new Map([["client1", node]]));
    const triggerEvent = { id: "trigger", timestamp: 0, type: EventType.REQUEST_ARRIVE, sourceNodeId: "client1", targetNodeId: "client1", transaction: null };
    const events = handler.onEvent(node, triggerEvent, ctx);
    const selfTrigger = events.find((e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "client1");
    expect(selfTrigger).toBeDefined();
    expect(selfTrigger!.timestamp).toBe(100);
  });
});
