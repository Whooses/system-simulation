import { SimulationNode, Connection, Scenario, SimEvent, Transaction } from "./models";
import { EventQueue } from "./event-queue";
import { MetricsCollector } from "./metrics";
import { SimContextImpl } from "./sim-context";
import { getHandler } from "./handlers";

/**
 * Core discrete-event simulation engine.
 *
 * Owns the node graph, event priority queue, and metrics collector.
 * Each call to {@link step} dequeues the next event by timestamp,
 * routes it to the appropriate node handler, and enqueues any
 * resulting follow-on events.
 */
export class Engine {
  // === State ===

  private nodes: Map<string, SimulationNode>;
  private connections: Map<string, Connection>;
  private scenario: Scenario;
  private queue: EventQueue;
  private metrics: MetricsCollector;
  private transactionBuffer: Transaction[] = [];
  private _currentTime = 0;
  private _running = false;
  private _speed = 1;

  constructor(nodes: SimulationNode[], connections: Connection[], scenario: Scenario) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.connections = new Map(connections.map((c) => [c.id, c]));
    this.scenario = scenario;
    this.queue = new EventQueue();
    this.metrics = new MetricsCollector(60000); // 60-second rolling window
  }

  // === Accessors ===

  get currentTime(): number { return this._currentTime; }
  get running(): boolean { return this._running; }
  get speed(): number { return this._speed; }
  set speed(value: number) { this._speed = value; }
  get eventQueueSize(): number { return this.queue.size; }

  // === Event Processing ===

  /** Manually inject an event into the priority queue (used for chaos injection and scenario seeding). */
  injectEvent(event: SimEvent): void { this.queue.enqueue(event); }

  /**
   * Process the next event in the queue.
   * @returns `false` when the queue is empty (simulation complete), `true` otherwise.
   */
  step(): boolean {
    const event = this.queue.dequeue();
    if (!event) return false;
    this._currentTime = event.timestamp;
    const targetNode = this.nodes.get(event.targetNodeId);
    if (!targetNode) return true;
    // Crashed nodes only accept FAILURE events (e.g., for recovery checks)
    if (targetNode.state.crashed && event.type !== "FAILURE") return true;

    const context = new SimContextImpl(this._currentTime, this.nodes, this.connections, this.queue, this.metrics);
    try {
      const handler = getHandler(targetNode.type);
      const newEvents = handler.onEvent(targetNode, event, context);
      for (const e of newEvents) { this.queue.enqueue(e); }
    } catch { /* no handler registered for this node type — skip */ }

    if (event.transaction) { this.transactionBuffer.push(event.transaction); }
    return true;
  }

  // === Transaction Buffer ===

  /** Drain and return all completed transactions since the last flush. */
  flushTransactions(): Transaction[] {
    const txns = this.transactionBuffer;
    this.transactionBuffer = [];
    return txns;
  }

  // === Queries & Mutations ===

  /** Returns the full node map (used by SimulationManager to broadcast state). */
  getNodeStates(): Map<string, SimulationNode> { return this.nodes; }

  /** Returns a rolling-window metrics snapshot for a single node. */
  getMetricsSnapshot(nodeId: string) { return this.metrics.getSnapshot(nodeId); }

  /** Hot-patch a node's config while the simulation is running. */
  updateNodeConfig(nodeId: string, config: Partial<SimulationNode["config"]>): void {
    const node = this.nodes.get(nodeId);
    if (node) { node.config = { ...node.config, ...config } as SimulationNode["config"]; }
  }

  /** Reset all engine state for a fresh run. */
  reset(): void {
    this.queue.clear();
    this.metrics.clearAll();
    this.transactionBuffer = [];
    this._currentTime = 0;
    this._running = false;
  }
}
