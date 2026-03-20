import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, NoSQLDBConfig } from "../models";
import { SimContext } from "../sim-context";

// === Helpers ===

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Determine if the event's transaction carries a write operation. */
function isWriteRequest(event: SimEvent): boolean {
  const method = event.transaction?.message?.method?.toUpperCase();
  return method ? WRITE_METHODS.has(method) : false;
}

// === Handler ===

/**
 * Simulates a NoSQL database with partitioned concurrency.
 *
 * Concurrency limit scales with partition count (10 ops per partition).
 * Uses separate read/write latency distributions and supports
 * eventual or strong consistency models.
 */
export class NoSQLDBHandler implements NodeHandler {
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as NoSQLDBConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE: return this.handleComplete(node, event, context, config);
      default: return [];
    }
  }

  private handleRequest(node: SimulationNode, event: SimEvent, context: SimContext, config: NoSQLDBConfig): SimEvent[] {
    const concurrencyLimit = config.partitionCount * 10; // Each partition handles 10 concurrent ops
    if (node.state.activeConnections < concurrencyLimit) return this.startOp(node, event, context, config);
    const queue = this.getQueue(node.id);
    if (queue.length < config.maxQueueSize) { queue.push(event); node.state.queueDepth = queue.length; return []; }
    node.state.errorCount++;
    return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
      sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 503, latency: 0, error: "Capacity exceeded" } } : null }];
  }

  private startOp(node: SimulationNode, event: SimEvent, context: SimContext, config: NoSQLDBConfig): SimEvent[] {
    node.state.activeConnections++;
    node.state.requestCount++;
    const latency = isWriteRequest(event)
      ? context.sampleLatency(config.writeLatency)
      : context.sampleLatency(config.readLatency);
    return [{ id: context.generateId(), timestamp: context.currentTime + latency, type: EventType.PROCESS_COMPLETE,
      sourceNodeId: node.id, targetNodeId: node.id,
      transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId } } : null }];
  }

  private handleComplete(node: SimulationNode, event: SimEvent, context: SimContext, config: NoSQLDBConfig): SimEvent[] {
    node.state.activeConnections--;
    const events: SimEvent[] = [];
    const isError = Math.random() < config.errorRate;
    const replyTo = event.transaction?.metadata?.replyTo as string | undefined;
    if (replyTo) {
      events.push({ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
        sourceNodeId: node.id, targetNodeId: replyTo,
        transaction: event.transaction ? { ...event.transaction, result: { status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS, statusCode: isError ? 500 : 200, latency: 0 } } : null });
    }
    const queue = this.getQueue(node.id);
    if (queue.length > 0) { const next = queue.shift()!; node.state.queueDepth = queue.length; events.push(...this.startOp(node, next, context, config)); }
    return events;
  }

  private getQueue(nodeId: string): SimEvent[] {
    if (!this.queues.has(nodeId)) this.queues.set(nodeId, []);
    return this.queues.get(nodeId)!;
  }
}
