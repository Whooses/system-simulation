import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, MessageQueueConfig } from "../models";
import { SimContext } from "../sim-context";

export class MessageQueueHandler implements NodeHandler {
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as MessageQueueConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleEnqueue(node, event, context, config);
      case EventType.QUEUE_DEQUEUE: return this.handleDequeue(node, event, context);
      default: return [];
    }
  }

  private handleEnqueue(node: SimulationNode, event: SimEvent, context: SimContext, config: MessageQueueConfig): SimEvent[] {
    const queue = this.getQueue(node.id);
    if (queue.length >= config.maxDepth) {
      node.state.errorCount++;
      return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
        sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.FAILURE, statusCode: 429, latency: 0, error: "Queue full" } } : null }];
    }
    queue.push(event);
    node.state.queueDepth = queue.length;
    node.state.requestCount++;
    // Schedule dequeue after processing latency
    const dequeueDelay = context.sampleLatency(node.config.processingLatency);
    const dequeueEvent: SimEvent = { id: context.generateId(), timestamp: context.currentTime + dequeueDelay,
      type: EventType.QUEUE_DEQUEUE, sourceNodeId: node.id, targetNodeId: node.id, transaction: event.transaction };
    context.scheduleEvent(dequeueEvent);
    return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.QUEUE_ENQUEUE,
      sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.SUCCESS, statusCode: 202, latency: 0 } } : null }];
  }

  private handleDequeue(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const queue = this.getQueue(node.id);
    if (queue.length === 0) return [];
    const queued = queue.shift()!;
    node.state.queueDepth = queue.length;
    const connections = context.getConnections(node.id);
    if (connections.length === 0) return [];
    const consumer = connections[0];
    const connLatency = context.sampleLatency(consumer.latency);
    return [{ id: context.generateId(), timestamp: context.currentTime + connLatency, type: EventType.REQUEST_ARRIVE,
      sourceNodeId: node.id, targetNodeId: consumer.targetNodeId,
      transaction: queued.transaction }];
  }

  private getQueue(nodeId: string): SimEvent[] {
    if (!this.queues.has(nodeId)) this.queues.set(nodeId, []);
    return this.queues.get(nodeId)!;
  }
}
