import { describe, it, expect } from "vitest";
import { LoadBalancerHandler } from "../handlers/load-balancer-handler";
import { SimulationNode, Connection, NodeType, HealthStatus, EventType, Protocol, LoadBalancerConfig } from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeLBNode(strategy: LoadBalancerConfig["strategy"] = "round-robin"): SimulationNode {
  return {
    id: "lb1", type: NodeType.LOAD_BALANCER, label: "LB",
    config: {
      concurrencyLimit: 1000, maxQueueSize: 5000, processingLatency: { type: "constant", value: 1 }, errorRate: 0,
      strategy, maxConnections: 1000, healthCheckInterval: 5000, healthCheckFailureThreshold: 3,
    },
    state: { queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
    position: { x: 0, y: 0 }, connections: ["conn1", "conn2"],
  };
}

function makeBackendNode(id: string, health = HealthStatus.HEALTHY): SimulationNode {
  return {
    id, type: NodeType.WEB_SERVER, label: id,
    config: { concurrencyLimit: 10, maxQueueSize: 100, processingLatency: { type: "constant", value: 10 }, errorRate: 0 },
    state: { queueDepth: 0, activeConnections: 0, health, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
    position: { x: 200, y: 0 }, connections: [],
  };
}

function makeContext(lbNode: SimulationNode, backends: SimulationNode[], connections: Connection[]) {
  const allNodes = new Map<string, SimulationNode>();
  allNodes.set(lbNode.id, lbNode);
  for (const b of backends) allNodes.set(b.id, b);
  return new SimContextImpl(0, allNodes, new Map(connections.map((c) => [c.id, c])), new EventQueue(), new MetricsCollector(60000));
}

function makeConnections(): Connection[] {
  return [
    { id: "conn1", sourceNodeId: "lb1", targetNodeId: "srv1", protocol: Protocol.HTTP, latency: { type: "constant", value: 2 }, timeout: 5000 },
    { id: "conn2", sourceNodeId: "lb1", targetNodeId: "srv2", protocol: Protocol.HTTP, latency: { type: "constant", value: 2 }, timeout: 5000 },
  ];
}

function makeRequest() {
  return {
    id: "req1", timestamp: 0, type: EventType.REQUEST_ARRIVE as const,
    sourceNodeId: "client1", targetNodeId: "lb1",
    transaction: { id: "tx1", message: { method: "GET", path: "/users" }, protocol: Protocol.HTTP, result: null, metadata: {} },
  };
}

describe("LoadBalancerHandler", () => {
  it("round-robin distributes across backends", () => {
    const handler = new LoadBalancerHandler();
    const lb = makeLBNode("round-robin");
    const srv1 = makeBackendNode("srv1");
    const srv2 = makeBackendNode("srv2");
    const conns = makeConnections();
    const ctx1 = makeContext(lb, [srv1, srv2], conns);
    const events1 = handler.onEvent(lb, makeRequest(), ctx1);
    const target1 = events1.find((e) => e.type === EventType.REQUEST_ARRIVE)?.targetNodeId;
    const ctx2 = makeContext(lb, [srv1, srv2], conns);
    const events2 = handler.onEvent(lb, { ...makeRequest(), id: "req2" }, ctx2);
    const target2 = events2.find((e) => e.type === EventType.REQUEST_ARRIVE)?.targetNodeId;
    expect(target1).not.toBe(target2);
  });

  it("returns 503 when all backends are unhealthy", () => {
    const handler = new LoadBalancerHandler();
    const lb = makeLBNode();
    const srv1 = makeBackendNode("srv1", HealthStatus.UNHEALTHY);
    const srv2 = makeBackendNode("srv2", HealthStatus.UNHEALTHY);
    const conns = makeConnections();
    const ctx = makeContext(lb, [srv1, srv2], conns);
    const events = handler.onEvent(lb, makeRequest(), ctx);
    const response = events.find((e) => e.type === EventType.RESPONSE);
    expect(response).toBeDefined();
    expect(response!.transaction!.result!.statusCode).toBe(503);
  });
});
