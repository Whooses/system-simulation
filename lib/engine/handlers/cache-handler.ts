import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, CacheConfig } from "../models";
import { SimContext } from "../sim-context";

export class CacheHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as CacheConfig;
    node.state.requestCount++;
    const processingTime = context.sampleLatency(config.processingLatency);
    const isHit = Math.random() < config.hitRate;
    if (isHit) {
      return [{ id: context.generateId(), timestamp: context.currentTime + processingTime, type: EventType.CACHE_HIT, sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.SUCCESS, statusCode: 200, latency: processingTime } } : null }];
    }
    return [{ id: context.generateId(), timestamp: context.currentTime + processingTime, type: EventType.CACHE_MISS, sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 404, latency: processingTime, error: "Cache miss" } } : null }];
  }
}
