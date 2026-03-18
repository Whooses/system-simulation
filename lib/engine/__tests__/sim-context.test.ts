import { describe, it, expect } from "vitest";
import { SimContextImpl } from "../sim-context";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import {
  SimulationNode, Connection, NodeType, HealthStatus, Protocol, EventType,
} from "../models";

function makeNode(id: string): SimulationNode {
  return {
    id, type: NodeType.WEB_SERVER, label: id,
    config: {
      concurrencyLimit: 10, maxQueueSize: 100,
      processingLatency: { type: "constant", value: 10 }, errorRate: 0,
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 }, connections: ["conn1"],
  };
}

function makeConnection(id: string, source: string, target: string): Connection {
  return {
    id, sourceNodeId: source, targetNodeId: target,
    protocol: Protocol.HTTP, latency: { type: "constant", value: 5 }, timeout: 5000,
  };
}

describe("SimContextImpl", () => {
  it("looks up nodes by ID", () => {
    const nodes = new Map([["n1", makeNode("n1")]]);
    const connections = new Map([["conn1", makeConnection("conn1", "n1", "n2")]]);
    const ctx = new SimContextImpl(0, nodes, connections, new EventQueue(), new MetricsCollector(60000));
    expect(ctx.getNode("n1").id).toBe("n1");
  });

  it("throws for unknown node", () => {
    const ctx = new SimContextImpl(0, new Map(), new Map(), new EventQueue(), new MetricsCollector(60000));
    expect(() => ctx.getNode("missing")).toThrow();
  });

  it("returns outbound connections for a node", () => {
    const nodes = new Map([["n1", makeNode("n1")]]);
    const conn = makeConnection("conn1", "n1", "n2");
    const connections = new Map([["conn1", conn]]);
    const ctx = new SimContextImpl(0, nodes, connections, new EventQueue(), new MetricsCollector(60000));
    expect(ctx.getConnections("n1")).toEqual([conn]);
  });

  it("schedules and cancels events", () => {
    const queue = new EventQueue();
    const ctx = new SimContextImpl(0, new Map(), new Map(), queue, new MetricsCollector(60000));
    const event = {
      id: "e1", timestamp: 100, type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "a", targetNodeId: "b", transaction: null,
    };
    ctx.scheduleEvent(event);
    expect(queue.size).toBe(1);
    ctx.cancelEvent("e1");
    expect(queue.dequeue()).toBeUndefined();
  });

  it("samples latency from a distribution", () => {
    const ctx = new SimContextImpl(0, new Map(), new Map(), new EventQueue(), new MetricsCollector(60000));
    expect(ctx.sampleLatency({ type: "constant", value: 42 })).toBe(42);
  });

  it("generates unique IDs", () => {
    const ctx = new SimContextImpl(0, new Map(), new Map(), new EventQueue(), new MetricsCollector(60000));
    const id1 = ctx.generateId();
    const id2 = ctx.generateId();
    expect(id1).not.toBe(id2);
  });
});
