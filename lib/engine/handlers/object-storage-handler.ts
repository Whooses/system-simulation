import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, ObjectStorageConfig } from "../models";
import { SimContext } from "../sim-context";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isWriteRequest(event: SimEvent): boolean {
  const method = event.transaction?.message?.method?.toUpperCase();
  return method ? WRITE_METHODS.has(method) : false;
}

export class ObjectStorageHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as ObjectStorageConfig;
    switch (event.type) {
      case EventType.REQUEST_ARRIVE: return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE: return this.handleComplete(node, event, context, config);
      default: return [];
    }
  }

  private handleRequest(node: SimulationNode, event: SimEvent, context: SimContext, config: ObjectStorageConfig): SimEvent[] {
    node.state.requestCount++;
    const latency = isWriteRequest(event)
      ? context.sampleLatency(config.writeLatency)
      : context.sampleLatency(config.readLatency);
    return [{ id: context.generateId(), timestamp: context.currentTime + latency, type: EventType.PROCESS_COMPLETE,
      sourceNodeId: node.id, targetNodeId: node.id,
      transaction: event.transaction ? { ...event.transaction, metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId } } : null }];
  }

  private handleComplete(node: SimulationNode, event: SimEvent, context: SimContext, config: ObjectStorageConfig): SimEvent[] {
    const isError = Math.random() < config.errorRate;
    const replyTo = event.transaction?.metadata?.replyTo as string | undefined;
    if (!replyTo) return [];
    return [{ id: context.generateId(), timestamp: context.currentTime, type: EventType.RESPONSE,
      sourceNodeId: node.id, targetNodeId: replyTo,
      transaction: event.transaction ? { ...event.transaction, result: { status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS, statusCode: isError ? 500 : 200, latency: 0 } } : null }];
  }
}
