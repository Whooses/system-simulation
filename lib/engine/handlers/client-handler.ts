import { v4 as uuidv4 } from "uuid";
import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, Protocol, ClientConfig } from "../models";
import { SimContext } from "../sim-context";

/**
 * Simulates an external client that generates requests.
 *
 * On each REQUEST_ARRIVE (a self-targeted "tick"), the client:
 * 1. Picks a random request type from the weighted distribution
 * 2. Forwards a new transaction to the first outbound connection
 * 3. Schedules the next self-tick based on the configured request rate
 */
export class ClientHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as ClientConfig;
    const events: SimEvent[] = [];
    if (event.type !== EventType.REQUEST_ARRIVE) return events;

    // Pick a weighted-random request type (e.g., "GET /api/users")
    const requestType = this.pickRequestType(config.requestDistribution);
    const [method, path] = requestType.split(" ", 2);

    // Forward request to the first downstream node
    const connections = context.getConnections(node.id);
    if (connections.length > 0) {
      const conn = connections[0];
      const latency = context.sampleLatency(conn.latency);
      const txId = context.generateId();
      events.push({
        id: context.generateId(), timestamp: context.currentTime + latency,
        type: EventType.REQUEST_ARRIVE, sourceNodeId: node.id, targetNodeId: conn.targetNodeId,
        transaction: { id: txId, message: { method: method || "GET", path: path || "/" }, protocol: conn.protocol, result: null, metadata: {} },
      });
    }

    // Schedule the next self-tick to keep generating requests
    if (config.requestRate > 0) {
      const intervalMs = 1000 / config.requestRate;
      events.push({
        id: context.generateId(), timestamp: context.currentTime + intervalMs,
        type: EventType.REQUEST_ARRIVE, sourceNodeId: node.id, targetNodeId: node.id, transaction: null,
      });
    }

    node.state.requestCount++;
    return events;
  }

  /** Select a request type using weighted-random sampling. */
  private pickRequestType(distribution: { type: string; weight: number }[]): string {
    const totalWeight = distribution.reduce((sum, d) => sum + d.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const d of distribution) { rand -= d.weight; if (rand <= 0) return d.type; }
    return distribution[distribution.length - 1]?.type ?? "GET /";
  }
}
