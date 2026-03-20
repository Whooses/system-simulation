import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, LoadBalancerConfig, Connection } from "../models";
import { SimContext } from "../sim-context";

/**
 * Distributes incoming requests across healthy backend nodes.
 *
 * Filters out unhealthy/crashed backends, picks one using the configured
 * strategy (round-robin, least-connections, or ip-hash), and forwards
 * the request with connection latency applied.
 */
export class LoadBalancerHandler implements NodeHandler {
  /** Persistent round-robin counters per LB node. */
  private roundRobinIndex = new Map<string, number>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as LoadBalancerConfig;

    // Filter to only healthy, non-crashed backends
    const connections = context.getConnections(node.id);
    const healthy = connections.filter((conn) => {
      try { const backend = context.getNode(conn.targetNodeId); return backend.state.health !== "UNHEALTHY" && !backend.state.crashed; } catch { return false; }
    });
    if (healthy.length === 0) {
      node.state.errorCount++;
      return [{
        id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
        sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 503, latency: 0, error: "No healthy backends available" } } : null,
      }];
    }

    const chosen = this.pickBackend(node.id, config.strategy, healthy, context);
    const latency = context.sampleLatency(chosen.latency);
    node.state.requestCount++;
    return [{
      id: context.generateId(), timestamp: context.currentTime + latency,
      type: EventType.REQUEST_ARRIVE, sourceNodeId: node.id, targetNodeId: chosen.targetNodeId,
      transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId, lbNodeId: node.id } } : null,
    }];
  }

  // === Backend Selection Strategies ===

  /** Select a backend connection using the configured load-balancing strategy. */
  private pickBackend(nodeId: string, strategy: LoadBalancerConfig["strategy"], connections: Connection[], context: SimContext): Connection {
    switch (strategy) {
      case "round-robin": {
        const idx = this.roundRobinIndex.get(nodeId) ?? 0;
        const chosen = connections[idx % connections.length];
        this.roundRobinIndex.set(nodeId, idx + 1);
        return chosen;
      }
      case "least-connections": {
        let minConn = connections[0]; let minCount = Infinity;
        for (const conn of connections) {
          try { const backend = context.getNode(conn.targetNodeId); if (backend.state.activeConnections < minCount) { minCount = backend.state.activeConnections; minConn = conn; } } catch { continue; }
        }
        return minConn;
      }
      case "ip-hash": {
        // Simple char-code hash for deterministic routing
        const hash = nodeId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        return connections[hash % connections.length];
      }
      default: return connections[0];
    }
  }
}
