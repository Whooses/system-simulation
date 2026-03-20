import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, SearchIndexConfig } from "../models";
import { SimContext } from "../sim-context";

/**
 * Simulates a search index (e.g., Elasticsearch).
 * Processes queries with configurable latency and error rate.
 */
export class SearchIndexHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as SearchIndexConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE: return this.handleComplete(node, event, context, config);
      default: return [];
    }
  }

  private handleRequest(node: SimulationNode, event: SimEvent, context: SimContext, config: SearchIndexConfig): SimEvent[] {
    node.state.requestCount++;
    const latency = context.sampleLatency(config.queryLatency);
    return [{ id: context.generateId(), timestamp: context.currentTime + latency, type: EventType.PROCESS_COMPLETE,
      sourceNodeId: node.id, targetNodeId: node.id,
      transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId } } : null }];
  }

  private handleComplete(node: SimulationNode, event: SimEvent, context: SimContext, config: SearchIndexConfig): SimEvent[] {
    const isError = Math.random() < config.errorRate;
    const replyTo = event.transaction?.metadata?.replyTo as string | undefined;
    if (!replyTo) return [];
    return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
      sourceNodeId: node.id, targetNodeId: replyTo,
      transaction: event.transaction ? { ...event.transaction, result: { status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS, statusCode: isError ? 500 : 200, latency: 0 } } : null }];
  }
}
