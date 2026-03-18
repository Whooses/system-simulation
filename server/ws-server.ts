import { WebSocketServer, WebSocket } from "ws";
import { SimulationManager } from "./simulation-manager";
import { ClientMessage, SimulationNode, Connection, Scenario } from "../lib/engine/models";

// Store pending configs from REST create
export const pendingConfigs = new Map<string, { nodes: SimulationNode[]; connections: Connection[]; scenario: Scenario }>();

export function createWSServer(server: import("http").Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let manager: SimulationManager | null = null;

    const sendMessage = (msg: unknown) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        switch (msg.type) {
          case "START": {
            const config = pendingConfigs.get(msg.data.simulationId);
            if (config) {
              manager = new SimulationManager(sendMessage);
              manager.create(config.nodes, config.connections, config.scenario);
              manager.start();
              pendingConfigs.delete(msg.data.simulationId);
            }
            break;
          }
          case "STOP": manager?.stop(); manager = null; break;
          case "PAUSE": manager?.pause(); break;
          case "RESUME": manager?.resume(); break;
          case "SPEED": manager?.setSpeed(msg.data.multiplier); break;
          case "UPDATE_CONFIG": manager?.updateConfig(msg.data.nodeId, msg.data.config as Record<string, unknown>); break;
          case "INJECT_CHAOS": manager?.injectChaos(msg.data.chaosType, msg.data.target); break;
        }
      } catch (err) { console.error("WS message error:", err); }
    });

    ws.on("close", () => { manager?.stop(); manager = null; });
  });

  return wss;
}
