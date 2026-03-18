import { Engine } from "../lib/engine/engine";
import { ScenarioRunner } from "../lib/engine/scenario-runner";
import { registerAllHandlers } from "../lib/engine/handlers/register-all";
import { SimulationNode, Connection, Scenario, NodeType, ServerMessage } from "../lib/engine/models";

registerAllHandlers();

export class SimulationManager {
  private engine: Engine | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private onMessage: (msg: ServerMessage) => void;
  private speed = 1;

  constructor(onMessage: (msg: ServerMessage) => void) { this.onMessage = onMessage; }

  create(nodes: SimulationNode[], connections: Connection[], scenario: Scenario): string {
    this.engine = new Engine(nodes, connections, scenario);
    const clientIds = nodes.filter((n) => n.type === NodeType.CLIENT).map((n) => n.id);
    const runner = new ScenarioRunner(scenario, clientIds);
    for (const event of runner.generateInitialEvents()) this.engine.injectEvent(event);
    return "sim-" + Date.now();
  }

  start(): void {
    if (!this.engine) return;
    this.timer = setInterval(() => {
      if (!this.engine || this.speed === 0) return;
      const batchSize = Math.max(1, Math.floor(this.speed * 10));
      for (let i = 0; i < batchSize; i++) { if (!this.engine.step()) { this.stop(); return; } }
      this.onMessage({ type: "SIM_STATUS", data: { time: this.engine.currentTime, speed: this.speed, running: true } });
    }, 50);

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

  pause(): void { this.speed = 0; }
  resume(): void { this.speed = 1; }
  setSpeed(multiplier: number): void { this.speed = multiplier; }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.timer = null; this.batchTimer = null;
    this.onMessage({ type: "SIM_STATUS", data: { time: this.engine?.currentTime ?? 0, speed: 0, running: false } });
    this.engine = null;
  }

  updateConfig(nodeId: string, config: Record<string, unknown>): void { this.engine?.updateNodeConfig(nodeId, config); }

  injectChaos(chaosType: string, target: string): void {
    if (!this.engine) return;
    this.engine.injectEvent({
      id: "chaos-" + Date.now(), timestamp: this.engine.currentTime,
      type: "FAILURE" as any, sourceNodeId: "chaos", targetNodeId: target, transaction: null,
    });
  }
}
