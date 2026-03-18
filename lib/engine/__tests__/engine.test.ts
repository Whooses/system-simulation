import { describe, it, expect, vi } from "vitest";
import { Engine } from "../engine";
import {
  SimulationNode, Connection, Scenario, NodeType, HealthStatus,
  Protocol, EventType, SimEvent,
} from "../models";
import { registerHandler } from "../handlers";

function makeClientNode(): SimulationNode {
  return {
    id: "client1", type: NodeType.CLIENT, label: "Client",
    config: {
      concurrencyLimit: 100, maxQueueSize: 1000,
      processingLatency: { type: "constant", value: 0 }, errorRate: 0,
      requestRate: 1, requestDistribution: [{ type: "GET /users", weight: 1 }],
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 }, connections: ["conn1"],
  };
}

function makeServerNode(): SimulationNode {
  return {
    id: "server1", type: NodeType.WEB_SERVER, label: "Server",
    config: {
      concurrencyLimit: 10, maxQueueSize: 100,
      processingLatency: { type: "constant", value: 10 }, errorRate: 0,
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 200, y: 0 }, connections: [],
  };
}

function makeConnection(): Connection {
  return {
    id: "conn1", sourceNodeId: "client1", targetNodeId: "server1",
    protocol: Protocol.HTTP, latency: { type: "constant", value: 5 }, timeout: 5000,
  };
}

function makeScenario(): Scenario {
  return {
    id: "test", name: "Test", description: "Test scenario", duration: 1,
    phases: [{ startTime: 0, duration: 1, requestRate: 1, requestDistribution: [{ type: "GET /users", weight: 1 }] }],
  };
}

describe("Engine", () => {
  it("initializes with nodes and connections", () => {
    const engine = new Engine([makeClientNode(), makeServerNode()], [makeConnection()], makeScenario());
    expect(engine).toBeDefined();
  });

  it("processes events and calls handlers", () => {
    const handlerSpy = vi.fn().mockReturnValue([]);
    registerHandler(NodeType.WEB_SERVER, { onEvent: handlerSpy });
    const engine = new Engine([makeClientNode(), makeServerNode()], [makeConnection()], makeScenario());
    engine.injectEvent({
      id: "test-event", timestamp: 0, type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "client1", targetNodeId: "server1",
      transaction: { id: "tx1", message: { method: "GET", path: "/users" }, protocol: Protocol.HTTP, result: null, metadata: {} },
    });
    const processed = engine.step();
    expect(processed).toBe(true);
    expect(handlerSpy).toHaveBeenCalledOnce();
  });

  it("returns false when no events remain", () => {
    registerHandler(NodeType.WEB_SERVER, { onEvent: () => [] });
    const engine = new Engine([makeServerNode()], [], makeScenario());
    expect(engine.step()).toBe(false);
  });

  it("collects transactions from processed events", () => {
    registerHandler(NodeType.WEB_SERVER, { onEvent: () => [] });
    const engine = new Engine([makeClientNode(), makeServerNode()], [makeConnection()], makeScenario());
    engine.injectEvent({
      id: "e1", timestamp: 0, type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "client1", targetNodeId: "server1",
      transaction: { id: "tx1", message: { method: "GET", path: "/users" }, protocol: Protocol.HTTP, result: null, metadata: {} },
    });
    engine.step();
    const txns = engine.flushTransactions();
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("tx1");
    expect(engine.flushTransactions()).toHaveLength(0);
  });

  it("advances simulated time", () => {
    registerHandler(NodeType.WEB_SERVER, { onEvent: () => [] });
    const engine = new Engine([makeClientNode(), makeServerNode()], [makeConnection()], makeScenario());
    engine.injectEvent({ id: "e1", timestamp: 500, type: EventType.REQUEST_ARRIVE, sourceNodeId: "client1", targetNodeId: "server1", transaction: null });
    engine.step();
    expect(engine.currentTime).toBe(500);
  });
});
