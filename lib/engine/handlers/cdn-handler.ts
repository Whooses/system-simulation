import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, CDNConfig } from "../models";
import { SimContext } from "../sim-context";

export class CDNHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as CDNConfig;
    node.state.requestCount++;
    const isHit = Math.random() < config.cacheHitRate;
    if (isHit) {
      const latency = context.sampleLatency(config.processingLatency);
      return [{ id: context.generateId(), timestamp: context.currentTime + latency, type: EventType.CACHE_HIT,
        sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.SUCCESS, statusCode: 200, latency } } : null }];
    }
    // Cache miss — forward to origin (first outbound connection)
    const connections = context.getConnections(node.id);
    if (connections.length > 0) {
      const origin = connections[0];
      const connLatency = context.sampleLatency(origin.latency);
      return [{ id: context.generateId(), timestamp: context.currentTime + connLatency, type: EventType.REQUEST_ARRIVE,
        sourceNodeId: node.id, targetNodeId: origin.targetNodeId,
        transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId, cdnNodeId: node.id } } : null }];
    }
    // No origin connection — return CACHE_MISS
    const fallbackLatency = context.sampleLatency(config.originFallbackLatency);
    return [{ id: context.generateId(), timestamp: context.currentTime + fallbackLatency, type: EventType.CACHE_MISS,
      sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 404, latency: fallbackLatency, error: "Cache miss, no origin" } } : null }];
  }
}
