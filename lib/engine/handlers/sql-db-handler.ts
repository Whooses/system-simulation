import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, SQLDBConfig } from "../models";
import { SimContext } from "../sim-context";

export class SQLDBHandler implements NodeHandler {
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as SQLDBConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE: return this.handleComplete(node, event, context, config);
      default: return [];
    }
  }

  private handleRequest(node: SimulationNode, event: SimEvent, context: SimContext, config: SQLDBConfig): SimEvent[] {
    if (node.state.activeConnections < config.connectionPoolSize) return this.startQuery(node, event, context, config);
    const queue = this.getQueue(node.id);
    if (queue.length < config.maxQueueSize) { queue.push(event); node.state.queueDepth = queue.length; return []; }
    node.state.errorCount++;
    return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE, sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 503, latency: 0, error: "Connection pool exhausted" } } : null }];
  }

  private startQuery(node: SimulationNode, event: SimEvent, context: SimContext, config: SQLDBConfig): SimEvent[] {
    node.state.activeConnections++; node.state.requestCount++;
    const queryTime = context.sampleLatency(config.queryLatency);
    return [{ id: context.generateId(), timestamp: context.currentTime + queryTime, type: EventType.PROCESS_COMPLETE, sourceNodeId: node.id, targetNodeId: node.id,
      transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId } } : null }];
  }

  private handleComplete(node: SimulationNode, event: SimEvent, context: SimContext, config: SQLDBConfig): SimEvent[] {
    node.state.activeConnections--;
    const events: SimEvent[] = [];
    const isError = Math.random() < config.errorRate;
    const replyTo = event.transaction?.metadata?.replyTo as string | undefined;
    if (replyTo) {
      events.push({ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE, sourceNodeId: node.id, targetNodeId: replyTo,
        transaction: event.transaction ? { ...event.transaction, result: { status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS, statusCode: isError ? 500 : 200, latency: context.sampleLatency(config.queryLatency) } } : null });
    }
    const queue = this.getQueue(node.id);
    if (queue.length > 0) { const next = queue.shift()!; node.state.queueDepth = queue.length; events.push(...this.startQuery(node, next, context, config)); }
    return events;
  }

  private getQueue(nodeId: string): SimEvent[] { if (!this.queues.has(nodeId)) this.queues.set(nodeId, []); return this.queues.get(nodeId)!; }
}
