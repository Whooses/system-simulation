import { Engine } from "../lib/engine/engine";
import { ScenarioRunner } from "../lib/engine/scenario-runner";
import { registerAllHandlers } from "../lib/engine/handlers/register-all";
import { SimulationNode, Connection, Scenario, NodeType, ServerMessage } from "../lib/engine/models";

// Register all node handlers once at module load
registerAllHandlers();

/**
 * Orchestrates a single simulation lifecycle: create → start → pause/resume → stop.
 *
 * Runs two interval timers at 50ms each:
 * - **Tick timer**: advances the engine by `speed * 10` steps per tick, then broadcasts SIM_STATUS
 * - **Batch timer**: flushes completed transactions and broadcasts NODE_STATE for every node
 *
 * Each WebSocket connection gets its own SimulationManager instance.
 */
export class SimulationManager {
  private engine: Engine | null = null;
  /** Interval that drives the simulation forward (event processing). */
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Interval that flushes transactions and node states to the client. */
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private onMessage: (msg: ServerMessage) => void;
  private speed = 1;

  constructor(onMessage: (msg: ServerMessage) => void) { this.onMessage = onMessage; }

  // === Lifecycle ===

  /** Initialize the engine with the given topology and seed it with scenario events. */
  create(nodes: SimulationNode[], connections: Connection[], scenario: Scenario): string {
    this.engine = new Engine(nodes, connections, scenario);
    const clientIds = nodes.filter((n) => n.type === NodeType.CLIENT).map((n) => n.id);
    const runner = new ScenarioRunner(scenario, clientIds);
    for (const event of runner.generateInitialEvents()) this.engine.injectEvent(event);
    return "sim-" + Date.now();
  }

  /** Start the tick and batch timers. */
  start(): void {
    if (!this.engine) return;
    // Tick timer: process events at 50ms intervals
    this.timer = setInterval(() => {
      if (!this.engine || this.speed === 0) return;
      // Higher speed = more steps per tick (linear scaling)
      const batchSize = Math.max(1, Math.floor(this.speed * 10));
      for (let i = 0; i < batchSize; i++) { if (!this.engine.step()) { this.stop(); return; } }
      this.onMessage({ type: "SIM_STATUS", data: { time: this.engine.currentTime, speed: this.speed, running: true } });
    }, 50);

    // Batch timer: flush transactions and broadcast node states at 50ms intervals
    this.batchTimer = setInterval(() => {
      if (!this.engine) return;
      const txns = this.engine.flushTransactions();
      if (txns.length > 0) {
        const batch: ServerMessage[] = txns.map((t) => ({ type: "TRANSACTION" as const, data: t }));
        this.onMessage({ type: "BATCH", data: batch });
      }
      const nodeStates = this.engine.getNodeStates();
      for (const [nodeId, node] of nodeStates) {
        this.onMessage({ type: "NODE_STATE", data: { nodeId, state: node.state } });
      }
    }, 50);
  }

  // === Controls ===

  pause(): void { this.speed = 0; }
  resume(): void { this.speed = 1; }
  setSpeed(multiplier: number): void { this.speed = multiplier; }

  /** Stop both timers, broadcast final status, and release the engine. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.timer = null; this.batchTimer = null;
    this.onMessage({ type: "SIM_STATUS", data: { time: this.engine?.currentTime ?? 0, speed: 0, running: false } });
    this.engine = null;
  }

  /** Hot-patch a node's config while the simulation is running. */
  updateConfig(nodeId: string, config: Record<string, unknown>): void { this.engine?.updateNodeConfig(nodeId, config); }

  /** Inject a FAILURE event at the current time to simulate chaos (e.g., node crash). */
  injectChaos(chaosType: string, target: string): void {
    if (!this.engine) return;
    this.engine.injectEvent({
      id: "chaos-" + Date.now(), timestamp: this.engine.currentTime,
      type: "FAILURE" as any, sourceNodeId: "chaos", targetNodeId: target, transaction: null,
    });
  }
}
