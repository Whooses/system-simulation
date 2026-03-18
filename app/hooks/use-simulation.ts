"use client";

import { useCallback, useRef, useState } from "react";
import type { ServerMessage, ClientMessage, Transaction, NodeState } from "@/lib/engine/models";

interface SimulationState {
  running: boolean;
  time: number;
  speed: number;
  nodeStates: Map<string, NodeState>;
  transactions: Transaction[];
  alerts: { message: string; severity: string }[];
}

export function useSimulation() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<SimulationState>({
    running: false, time: 0, speed: 1,
    nodeStates: new Map(), transactions: [], alerts: [],
  });

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
        setState((s) => ({ ...s, transactions: [...s.transactions.slice(-999), msg.data as Transaction] }));
        break;
      case "BATCH":
        for (const inner of msg.data) handleMessage(inner);
        break;
      case "ALERT":
        setState((s) => ({ ...s, alerts: [...s.alerts.slice(-49), msg.data] }));
        break;
    }
  }, []);

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}/ws`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); wsRef.current = null; };
    ws.onmessage = (event) => { const msg = JSON.parse(event.data) as ServerMessage; handleMessage(msg); };
    wsRef.current = ws;
  }, [handleMessage]);

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
