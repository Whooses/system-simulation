import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, DNSConfig } from "../models";
import { SimContext } from "../sim-context";

/**
 * Simulates DNS resolution with configurable latency and failure rate.
 * Returns a success or failure RESPONSE after resolution latency.
 */
export class DNSHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as DNSConfig;
    node.state.requestCount++;
    const latency = context.sampleLatency(config.resolutionLatency);
    const isFail = Math.random() < config.failureRate;
    if (isFail) {
      node.state.errorCount++;
      return [{ id: context.generateId(), timestamp: context.currentTime + latency, type: EventType.RESPONSE,
        sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 503, latency, error: "DNS resolution failed" } } : null }];
    }
    return [{ id: context.generateId(), timestamp: context.currentTime + latency, type: EventType.RESPONSE,
      sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.SUCCESS, statusCode: 200, latency } } : null }];
  }
}
