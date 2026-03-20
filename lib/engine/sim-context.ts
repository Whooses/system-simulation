import { v4 as uuidv4 } from "uuid";
import {
  SimulationNode, Connection, SimEvent, LatencyDistribution,
} from "./models";
import { EventQueue } from "./event-queue";
import { MetricsCollector } from "./metrics";
import { sampleLatency } from "./distributions";

// === Interface ===

/**
 * Simulation context passed to every node handler on each event.
 *
 * Provides handlers with read access to the node graph, the ability
 * to schedule/cancel follow-on events, sample latency distributions,
 * and record per-node metrics — without exposing engine internals.
 */
export interface SimContext {
  /** Current simulation clock (milliseconds). */
  currentTime: number;
  /** Look up a node by ID. Throws if not found. */
  getNode(nodeId: string): SimulationNode;
  /** Return all outgoing connections from a node. */
  getConnections(nodeId: string): Connection[];
  /** Enqueue a follow-on event into the priority queue. */
  scheduleEvent(event: SimEvent): void;
  /** Lazily cancel a previously scheduled event by ID. */
  cancelEvent(eventId: string): void;
  /** Draw a random latency sample from a distribution config. */
  sampleLatency(dist: LatencyDistribution): number;
  /** Record a request metric (latency + success/error) for a node. */
  recordMetric(nodeId: string, timestamp: number, latency: number, isError: boolean): void;
  /** Generate a unique ID for new events/transactions. */
  generateId(): string;
}

// === Implementation ===

/**
 * Concrete SimContext created per-event by the engine.
 * Wraps the shared node map, connection map, event queue, and metrics collector.
 */
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
