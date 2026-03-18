import { SimulationNode, Connection, Scenario, SimEvent, Transaction } from "./models";
import { EventQueue } from "./event-queue";
import { MetricsCollector } from "./metrics";
import { SimContextImpl } from "./sim-context";
import { getHandler } from "./handlers";

export class Engine {
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
    this.metrics = new MetricsCollector(60000);
  }

  get currentTime(): number { return this._currentTime; }
  get running(): boolean { return this._running; }
  get speed(): number { return this._speed; }
  set speed(value: number) { this._speed = value; }
  get eventQueueSize(): number { return this.queue.size; }

  injectEvent(event: SimEvent): void { this.queue.enqueue(event); }

  step(): boolean {
    const event = this.queue.dequeue();
    if (!event) return false;
    this._currentTime = event.timestamp;
    const targetNode = this.nodes.get(event.targetNodeId);
    if (!targetNode) return true;
    if (targetNode.state.crashed && event.type !== "FAILURE") return true;

    const context = new SimContextImpl(this._currentTime, this.nodes, this.connections, this.queue, this.metrics);
    try {
      const handler = getHandler(targetNode.type);
      const newEvents = handler.onEvent(targetNode, event, context);
      for (const e of newEvents) { this.queue.enqueue(e); }
    } catch { /* no handler registered, skip */ }

    if (event.transaction) { this.transactionBuffer.push(event.transaction); }
    return true;
  }

  flushTransactions(): Transaction[] {
    const txns = this.transactionBuffer;
    this.transactionBuffer = [];
    return txns;
  }

  getNodeStates(): Map<string, SimulationNode> { return this.nodes; }
  getMetricsSnapshot(nodeId: string) { return this.metrics.getSnapshot(nodeId); }

  updateNodeConfig(nodeId: string, config: Partial<SimulationNode["config"]>): void {
    const node = this.nodes.get(nodeId);
    if (node) { node.config = { ...node.config, ...config } as SimulationNode["config"]; }
  }

  reset(): void {
    this.queue.clear();
    this.metrics.clearAll();
    this.transactionBuffer = [];
    this._currentTime = 0;
    this._running = false;
  }
}
