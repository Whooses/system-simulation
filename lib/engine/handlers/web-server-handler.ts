import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, BaseNodeConfig } from "../models";
import { SimContext } from "../sim-context";

/**
 * Handles WEB_SERVER and MICROSERVICE nodes.
 *
 * Implements a bounded concurrency model: incoming requests are processed
 * immediately if under the concurrency limit, otherwise queued up to
 * maxQueueSize. Excess requests get a 503 response.
 *
 * Uses a self-targeted PROCESS_COMPLETE event to simulate processing time,
 * then replies to the original sender via the `replyTo` metadata field.
 */
export class WebServerHandler implements NodeHandler {
  /** Per-node overflow queues for requests that exceed the concurrency limit. */
  private queues = new Map<string, SimEvent[]>();

  // === Event Dispatch ===

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as BaseNodeConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE: return this.handleProcessComplete(node, event, context);
      default: return [];
    }
  }

  // === Request Handling ===

  /** Accept, queue, or reject a request based on concurrency/queue limits. */
  private handleRequest(node: SimulationNode, event: SimEvent, context: SimContext, config: BaseNodeConfig): SimEvent[] {
    if (node.state.activeConnections < config.concurrencyLimit) {
      return this.startProcessing(node, event, context, config);
    }
    const queue = this.getQueue(node.id);
    if (queue.length < config.maxQueueSize) {
      queue.push(event);
      node.state.queueDepth = queue.length;
      return [];
    }
    // Both concurrency slots and queue are full — shed load
    node.state.errorCount++;
    return [{
      id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
      sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 503, latency: 0, error: "Service unavailable: queue full" } } : null,
    }];
  }

  /** Claim a concurrency slot and schedule a PROCESS_COMPLETE after processing latency. */
  private startProcessing(node: SimulationNode, event: SimEvent, context: SimContext, config: BaseNodeConfig): SimEvent[] {
    node.state.activeConnections++;
    node.state.requestCount++;
    const processingTime = context.sampleLatency(config.processingLatency);
    const transaction = event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId } } : null;
    return [{
      id: context.generateId(), timestamp: context.currentTime + processingTime,
      type: EventType.PROCESS_COMPLETE, sourceNodeId: node.id, targetNodeId: node.id, transaction,
    }];
  }

  // === Completion ===

  /** Release the concurrency slot, reply to sender, and drain the next queued request. */
  private handleProcessComplete(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as BaseNodeConfig;
    node.state.activeConnections--;
    const events: SimEvent[] = [];
    const isError = Math.random() < config.errorRate;
    const replyTo = event.transaction?.metadata?.replyTo as string | undefined;
    if (replyTo) {
      events.push({
        id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
        sourceNodeId: node.id, targetNodeId: replyTo,
        transaction: event.transaction ? { ...event.transaction, result: { status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS, statusCode: isError ? 500 : 200, latency: context.currentTime - (event.transaction.metadata.arrivalTime as number || 0) } } : null,
      });
    }
    if (isError) node.state.errorCount++;
    // Drain next queued request if any
    const queue = this.getQueue(node.id);
    if (queue.length > 0) {
      const next = queue.shift()!;
      node.state.queueDepth = queue.length;
      events.push(...this.startProcessing(node, next, context, config));
    }
    return events;
  }

  private getQueue(nodeId: string): SimEvent[] {
    if (!this.queues.has(nodeId)) this.queues.set(nodeId, []);
    return this.queues.get(nodeId)!;
  }
}
