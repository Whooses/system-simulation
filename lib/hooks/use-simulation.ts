"use client";

import { useCallback, useRef, useState } from "react";
import type { ServerMessage, ClientMessage, Transaction, NodeState } from "@/lib/engine/models";

// === Types ===

/** Client-side simulation state aggregated from WebSocket messages. */
interface SimulationState {
  running: boolean;
  time: number;
  speed: number;
  nodeStates: Map<string, NodeState>;
  transactions: Transaction[];
  alerts: { message: string; severity: string }[];
}

// === Hook ===

/**
 * WebSocket client hook for real-time simulation control.
 *
 * Manages the WS connection lifecycle and merges incoming server
 * messages (SIM_STATUS, NODE_STATE, TRANSACTION, BATCH, ALERT)
 * into a single reactive {@link SimulationState}.
 *
 * Exposes convenience methods for start/stop/pause/resume/speed
 * that send typed {@link ClientMessage} frames over the socket.
 */
export function useSimulation() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<SimulationState>({
    running: false, time: 0, speed: 1,
    nodeStates: new Map(), transactions: [], alerts: [],
  });

  // === Message Handling ===

  /** Route incoming server messages to the appropriate state updater. */
  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "SIM_STATUS":
        setState((s) => ({ ...s, running: msg.data.running, time: msg.data.time, speed: msg.data.speed }));
        break;
      case "NODE_STATE":
        setState((s) => {
          const newStates = new Map(s.nodeStates);
          newStates.set(msg.data.nodeId, msg.data.state);
          return { ...s, nodeStates: newStates };
        });
        break;
      case "TRANSACTION":
        // Keep last 1000 transactions to avoid unbounded memory growth
        setState((s) => ({ ...s, transactions: [...s.transactions.slice(-999), msg.data as Transaction] }));
        break;
      case "BATCH":
        // Recursively handle each message in the batch
        for (const inner of msg.data) handleMessage(inner);
        break;
      case "ALERT":
        // Keep last 50 alerts
        setState((s) => ({ ...s, alerts: [...s.alerts.slice(-49), msg.data] }));
        break;
    }
  }, []);

  // === Connection Lifecycle ===

  /** Open a WebSocket connection to the simulation server. */
  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}/ws`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); wsRef.current = null; };
    ws.onmessage = (event) => { const msg = JSON.parse(event.data) as ServerMessage; handleMessage(msg); };
    wsRef.current = ws;
  }, [handleMessage]);

  // === Commands ===

  /** Send a typed client message over the WebSocket. */
  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  }, []);

  const start = useCallback((simulationId: string) => send({ type: "START", data: { simulationId } }), [send]);
  const stop = useCallback(() => send({ type: "STOP" }), [send]);
  const pause = useCallback(() => send({ type: "PAUSE" }), [send]);
  const resume = useCallback(() => send({ type: "RESUME" }), [send]);
  const setSpeed = useCallback((multiplier: number) => send({ type: "SPEED", data: { multiplier } }), [send]);
  const disconnect = useCallback(() => { wsRef.current?.close(); }, []);

  return { connected, state, connect, disconnect, start, stop, pause, resume, setSpeed, send };
}
