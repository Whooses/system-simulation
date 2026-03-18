import { v4 as uuidv4 } from "uuid";
import {
  SimulationNode, Connection, SimEvent, LatencyDistribution,
} from "./models";
import { EventQueue } from "./event-queue";
import { MetricsCollector } from "./metrics";
import { sampleLatency } from "./distributions";

export interface SimContext {
  currentTime: number;
  getNode(nodeId: string): SimulationNode;
  getConnections(nodeId: string): Connection[];
  scheduleEvent(event: SimEvent): void;
  cancelEvent(eventId: string): void;
  sampleLatency(dist: LatencyDistribution): number;
  recordMetric(nodeId: string, timestamp: number, latency: number, isError: boolean): void;
  generateId(): string;
}

export class SimContextImpl implements SimContext {
  currentTime: number;
  private nodes: Map<string, SimulationNode>;
  private connections: Map<string, Connection>;
  private queue: EventQueue;
  private metrics: MetricsCollector;

  constructor(
    currentTime: number,
    nodes: Map<string, SimulationNode>,
    connections: Map<string, Connection>,
    queue: EventQueue,
    metrics: MetricsCollector,
  ) {
    this.currentTime = currentTime;
    this.nodes = nodes;
    this.connections = connections;
    this.queue = queue;
    this.metrics = metrics;
  }

  getNode(nodeId: string): SimulationNode {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);
    return node;
  }

  getConnections(nodeId: string): Connection[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.connections
      .map((cid) => this.connections.get(cid))
      .filter((c): c is Connection => c !== undefined);
  }

  scheduleEvent(event: SimEvent): void {
    this.queue.enqueue(event);
  }

  cancelEvent(eventId: string): void {
    this.queue.cancel(eventId);
  }

  sampleLatency(dist: LatencyDistribution): number {
    return sampleLatency(dist);
  }

  recordMetric(nodeId: string, timestamp: number, latency: number, isError: boolean): void {
    this.metrics.recordRequest(nodeId, timestamp, latency, isError);
  }

  generateId(): string {
    return uuidv4();
  }
}
