import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, EventStreamConfig } from "../models";
import { SimContext } from "../sim-context";

/**
 * Simulates a partitioned event stream (e.g., Kafka).
 *
 * Similar to MessageQueueHandler but adds partition assignment
 * and consumer group lag to the dequeue delay.
 */
export class EventStreamHandler implements NodeHandler {
  /** Internal event buffer per stream node. */
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as EventStreamConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleProduce(node, event, context, config);
      case EventType.QUEUE_DEQUEUE: return this.handleConsume(node, event, context, config);
      default: return [];
    }
  }

  private handleProduce(node: SimulationNode, event: SimEvent, context: SimContext, config: EventStreamConfig): SimEvent[] {
    const queue = this.getQueue(node.id);
    node.state.requestCount++;
    // Assign to a partition
    const partition = node.state.requestCount % config.partitionCount;
    queue.push(event);
    node.state.queueDepth = queue.length;
    // Schedule consumer dequeue with optional lag
    const dequeueDelay = context.sampleLatency(node.config.processingLatency) + config.consumerGroupLag;
    const dequeueEvent: SimEvent = { id: context.generateId(), timestamp: context.currentTime + dequeueDelay,
      type: EventType.QUEUE_DEQUEUE, sourceNodeId: node.id, targetNodeId: node.id,
      transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, partition } } : null };
    context.scheduleEvent(dequeueEvent);
    return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.QUEUE_ENQUEUE,
      sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? { ...event.transaction, result: { status: ResultStatus.SUCCESS, statusCode: 202, latency: 0 } } : null }];
  }

  private handleConsume(node: SimulationNode, event: SimEvent, context: SimContext, config: EventStreamConfig): SimEvent[] {
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
