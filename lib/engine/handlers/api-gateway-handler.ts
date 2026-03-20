import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, APIGatewayConfig } from "../models";
import { SimContext } from "../sim-context";

/**
 * Simulates an API gateway with rate limiting and auth latency.
 *
 * Enforces a per-node request rate limit using a sliding 1-second window.
 * Requests that pass the rate limit incur auth latency before being
 * forwarded to the first downstream backend.
 */
export class APIGatewayHandler implements NodeHandler {
  // === Rate Limiting State (1-second sliding window per node) ===
  private windowStart = new Map<string, number>();
  private windowCount = new Map<string, number>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as APIGatewayConfig;

    // Rate limiting — sliding 1-second window
    const windowKey = node.id;
    const now = context.currentTime;
    const start = this.windowStart.get(windowKey) ?? now;
    let count = this.windowCount.get(windowKey) ?? 0;
    if (now - start >= 1000) {
      // Reset window
      this.windowStart.set(windowKey, now);
      count = 0;
    }
    if (config.rateLimit <= count) {
      node.state.errorCount++;
      return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
        sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 429, latency: 0, error: "Rate limit exceeded" } } : null }];
    }
    this.windowCount.set(windowKey, count + 1);

    node.state.requestCount++;
    const authLatency = context.sampleLatency(config.authLatency);
    const connections = context.getConnections(node.id);
    if (connections.length === 0) {
      return [{ id: context.generateId(), timestamp: context.currentTime + authLatency, type: EventType.RESPONSE,
        sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 503, latency: authLatency, error: "No backend service" } } : null }];
    }
    const backend = connections[0];
    const connLatency = context.sampleLatency(backend.latency);
    const totalLatency = authLatency + connLatency;
    return [{ id: context.generateId(), timestamp: context.currentTime + totalLatency, type: EventType.REQUEST_ARRIVE,
      sourceNodeId: node.id, targetNodeId: backend.targetNodeId,
      transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId, gatewayNodeId: node.id } } : null }];
  }
}
