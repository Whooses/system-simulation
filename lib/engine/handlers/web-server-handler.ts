import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, BaseNodeConfig } from "../models";
import { SimContext } from "../sim-context";

export class WebServerHandler implements NodeHandler {
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as BaseNodeConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE: return this.handleProcessComplete(node, event, context);
      default: return [];
    }
  }

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
    node.state.errorCount++;
    return [{
      id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
      sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 503, latency: 0, error: "Service unavailable: queue full" } } : null,
    }];
  }

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
