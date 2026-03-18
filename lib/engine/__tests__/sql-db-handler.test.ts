import { describe, it, expect } from "vitest";
import { SQLDBHandler } from "../handlers/sql-db-handler";
import { SimulationNode, NodeType, HealthStatus, EventType, Protocol, SQLDBConfig } from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeDBNode(poolSize = 5): SimulationNode {
  return {
    id: "db1", type: NodeType.SQL_DB, label: "PostgreSQL",
    config: { concurrencyLimit: poolSize, maxQueueSize: 50, processingLatency: { type: "constant", value: 0 }, errorRate: 0, connectionPoolSize: poolSize, queryLatency: { type: "constant", value: 20 }, replicationLag: 0, maxIOPS: 10000 } as SQLDBConfig,
    state: { queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY, requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false },
    position: { x: 0, y: 0 }, connections: [],
  };
}
function makeContext(node: SimulationNode) { return new SimContextImpl(0, new Map([[node.id, node]]), new Map(), new EventQueue(), new MetricsCollector(60000)); }
function makeRequest() {
  return { id: "req1", timestamp: 0, type: EventType.REQUEST_ARRIVE as const, sourceNodeId: "server1", targetNodeId: "db1",
    transaction: { id: "tx1", message: { method: "QUERY", path: "SELECT * FROM users WHERE id=1" }, protocol: Protocol.TCP, result: null, metadata: {} } };
}

describe("SQLDBHandler", () => {
  it("processes query and returns PROCESS_COMPLETE with latency", () => {
    const handler = new SQLDBHandler();
    const node = makeDBNode();
    const events = handler.onEvent(node, makeRequest(), makeContext(node));
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete).toBeDefined();
    expect(complete!.timestamp).toBe(20);
    expect(node.state.activeConnections).toBe(1);
  });
  it("queues when connection pool is exhausted", () => {
    const handler = new SQLDBHandler();
    const node = makeDBNode(1);
    node.state.activeConnections = 1;
    const events = handler.onEvent(node, makeRequest(), makeContext(node));
    expect(events).toHaveLength(0);
    expect(node.state.queueDepth).toBe(1);
  });
});
