# Next.js Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the frontend to follow Next.js best practices — top-level `components/` with co-located files, thin page, eliminated prop-drilling.

**Architecture:** Move from `app/components/` + `app/hooks/` to top-level `components/` folders with co-located hooks/types. SimulatorLayout becomes the orchestration owner (calls hooks, holds state). Page becomes a thin composer.

**Tech Stack:** Next.js 16, React 19, @xyflow/react, Tailwind CSS 4, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-19-nextjs-refactor-design.md`

---

## File Structure

### New Files to Create
- `lib/hooks/use-simulation.ts` — moved from `app/hooks/use-simulation.ts` (unchanged logic)
- `lib/hooks/use-persistence.ts` — moved from `app/hooks/use-persistence.ts` (unchanged logic)
- `lib/build-topology.ts` — pure function extracted from `app/hooks/use-simulation-runner.ts`
- `components/Canvas/Canvas.types.ts` — `NodeData` type (moved from `app/hooks/use-canvas.ts`)
- `components/Canvas/index.tsx` — canvas wrapper owning `useCanvas` internally
- `components/Canvas/useCanvas.ts` — refactored to receive state as params
- `components/Canvas/SimNode.tsx` — moved from `app/components/canvas/sim-node.tsx`
- `components/Canvas/AnimatedEdge.tsx` — moved from `app/components/canvas/animated-edge.tsx`
- `components/Toolbar/index.tsx` — expanded to include ChaosMenu + SaveLoad
- `components/Toolbar/SpeedControl.tsx` — moved unchanged
- `components/Toolbar/SaveLoad.tsx` — moved, import path updated
- `components/Toolbar/ChaosMenu.tsx` — moved unchanged
- `components/Toolbar/ScenarioPicker.tsx` — moved unchanged
- `components/Palette/index.tsx` — moved unchanged
- `components/Palette/PaletteItem.tsx` — moved unchanged
- `components/ConfigPanel/index.tsx` — moved unchanged
- `components/TransactionLog/index.tsx` — moved unchanged
- `components/SimulatorLayout/index.tsx` — rewritten to own orchestration

### Files to Delete (after verification)
- `app/components/` — entire directory
- `app/hooks/` — entire directory

### Files to Modify
- `app/page.tsx` — slim down to thin composer

---

## Task 1: Create `lib/build-topology.ts`

Extract the node/edge mapping logic from `use-simulation-runner.ts` into a pure, testable function.

**Files:**
- Create: `lib/build-topology.ts`

- [ ] **Step 1: Create `lib/build-topology.ts`**

```ts
import { type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import { HealthStatus, Protocol } from "@/lib/engine/models";

interface NodeData {
  label: string;
  nodeType: string;
  config: Record<string, unknown>;
}

export function buildTopology(nodes: RFNode[], edges: RFEdge[]) {
  const simNodes = nodes.map((n) => {
    const data = n.data as NodeData;
    return {
      id: n.id,
      type: data.nodeType,
      label: data.label,
      config: data.config,
      state: {
        queueDepth: 0,
        activeConnections: 0,
        health: HealthStatus.HEALTHY,
        requestCount: 0,
        errorCount: 0,
        totalLatency: 0,
        crashed: false,
      },
      position: n.position,
      connections: edges.filter((e) => e.source === n.id).map((e) => e.id),
    };
  });

  const simConnections = edges.map((e) => ({
    id: e.id,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    protocol: Protocol.HTTP,
    latency: { type: "constant" as const, value: 5 },
    timeout: 5000,
  }));

  return { nodes: simNodes, connections: simConnections };
}
```

- [ ] **Step 2: Verify no build errors**

Run: `npx tsc --noEmit`
Expected: No errors related to `lib/build-topology.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/build-topology.ts
git commit -m "refactor: extract buildTopology pure function from simulation runner"
```

---

## Task 2: Move shared hooks to `lib/hooks/`

Move `use-simulation.ts` and `use-persistence.ts` from `app/hooks/` to `lib/hooks/`. Remove `"use client"` directives (these are pure logic hooks, the `"use client"` will come from the consuming component).

**Files:**
- Create: `lib/hooks/use-simulation.ts`
- Create: `lib/hooks/use-persistence.ts`

- [ ] **Step 1: Create `lib/hooks/use-simulation.ts`**

Copy from `app/hooks/use-simulation.ts` verbatim — same content, same logic. Keep `"use client"` since it uses `useState`/`useCallback`/`useRef`.

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ServerMessage,
  ClientMessage,
  Transaction,
  NodeState,
} from "@/lib/engine/models";

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
    running: false,
    time: 0,
    speed: 1,
    nodeStates: new Map(),
    transactions: [],
    alerts: [],
  });

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "SIM_STATUS":
        setState(s => ({
          ...s,
          running: msg.data.running,
          time: msg.data.time,
          speed: msg.data.speed,
        }));
        break;
      case "NODE_STATE":
        setState(s => {
          const newStates = new Map(s.nodeStates);
          newStates.set(msg.data.nodeId, msg.data.state);
          return { ...s, nodeStates: newStates };
        });
        break;
      case "TRANSACTION":
        setState(s => ({
          ...s,
          transactions: [
            ...s.transactions.slice(-999),
            msg.data as Transaction,
          ],
        }));
        break;
      case "BATCH":
        for (const inner of msg.data) handleMessage(inner);
        break;
      case "ALERT":
        setState(s => ({ ...s, alerts: [...s.alerts.slice(-49), msg.data] }));
        break;
    }
  }, []);

  const connect = useCallback(() => {
    const ws = new WebSocket(
      `ws://${window.location.hostname}:${window.location.port}/ws`,
    );
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onmessage = event => {
      const msg = JSON.parse(event.data) as ServerMessage;
      handleMessage(msg);
    };
    wsRef.current = ws;
  }, [handleMessage]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(msg));
  }, []);

  const start = useCallback(
    (simulationId: string) => send({ type: "START", data: { simulationId } }),
    [send],
  );
  const stop = useCallback(() => send({ type: "STOP" }), [send]);
  const pause = useCallback(() => send({ type: "PAUSE" }), [send]);
  const resume = useCallback(() => send({ type: "RESUME" }), [send]);
  const setSpeed = useCallback(
    (multiplier: number) => send({ type: "SPEED", data: { multiplier } }),
    [send],
  );
  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return {
    connected,
    state,
    connect,
    disconnect,
    start,
    stop,
    pause,
    resume,
    setSpeed,
    send,
  };
}
```

- [ ] **Step 2: Create `lib/hooks/use-persistence.ts`**

Copy from `app/hooks/use-persistence.ts` verbatim. Keep `"use client"` since it accesses `localStorage`.

```ts
"use client";

import type { SimulationConfig } from "@/lib/engine/models";

const STORAGE_KEY = "sim-configs";

export function usePersistence() {
  const save = (config: SimulationConfig) => {
    const existing = list();
    const filtered = existing.filter((c) => c.name !== config.name);
    filtered.push(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  const list = (): SimulationConfig[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  };

  const load = (name: string): SimulationConfig | undefined => {
    return list().find((c) => c.name === name);
  };

  const remove = (name: string) => {
    const filtered = list().filter((c) => c.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  return { save, list, load, remove };
}
```

- [ ] **Step 3: Verify no build errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/use-simulation.ts lib/hooks/use-persistence.ts
git commit -m "refactor: move shared hooks to lib/hooks/"
```

---

## Task 3: Create `components/Canvas/` folder

Create the Canvas component folder with types, hook, sub-components, and main component.

**Files:**
- Create: `components/Canvas/Canvas.types.ts`
- Create: `components/Canvas/useCanvas.ts`
- Create: `components/Canvas/SimNode.tsx`
- Create: `components/Canvas/AnimatedEdge.tsx`
- Create: `components/Canvas/index.tsx`

- [ ] **Step 1: Create `components/Canvas/Canvas.types.ts`**

```ts
import { NodeType, type NodeConfig } from "@/lib/engine/models";

export interface NodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeType;
  config: NodeConfig;
}
```

- [ ] **Step 2: Create `components/Canvas/useCanvas.ts`**

Refactored from `app/hooks/use-canvas.ts` — receives state as params instead of owning it.

```ts
"use client";

import { useState, useCallback, useRef, type DragEvent, type Dispatch, type SetStateAction } from "react";
import {
  addEdge,
  type Connection as RFConnection,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import { getNodeDefinition } from "@/lib/node-defaults";
import { NodeType, type NodeConfig } from "@/lib/engine/models";
import { type NodeData } from "./Canvas.types";

export function useCanvas(
  setNodes: Dispatch<SetStateAction<RFNode[]>>,
  setEdges: Dispatch<SetStateAction<RFEdge[]>>,
) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (connection: RFConnection) => {
      setEdges((eds) => addEdge({ ...connection, type: "animated" }, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow-type") as NodeType;
      if (!type) return;

      const def = getNodeDefinition(type);
      if (!def) return;

      const bounds = wrapperRef.current?.getBoundingClientRect();
      const position = {
        x: e.clientX - (bounds?.left ?? 0) - 70,
        y: e.clientY - (bounds?.top ?? 0) - 20,
      };

      const newNode: RFNode = {
        id: `${type}-${Date.now()}`,
        type: "simNode",
        position,
        data: { label: def.label, nodeType: type, config: def.defaultConfig } as NodeData,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const onNodeClick = useCallback((_: unknown, node: RFNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const updateNodeConfig = useCallback(
    (id: string, config: Partial<NodeConfig>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const data = n.data as NodeData;
          return { ...n, data: { ...data, config: { ...data.config, ...config } } };
        })
      );
    },
    [setNodes]
  );

  return {
    wrapperRef,
    onConnect,
    onDragOver,
    onDrop,
    onNodeClick,
    selectedNodeId,
    setSelectedNodeId,
    updateNodeConfig,
  };
}
```

- [ ] **Step 3: Create `components/Canvas/SimNode.tsx`**

Copied from `app/components/canvas/sim-node.tsx` unchanged.

```tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NodeType, HealthStatus } from "@/lib/engine/models";
import { getNodeDefinition } from "@/lib/node-defaults";

interface SimNodeData {
  label: string;
  nodeType: NodeType;
  health?: HealthStatus;
  requestCount?: number;
  errorRate?: number;
  avgLatency?: number;
  queueDepth?: number;
}

export default function SimNode({ data }: NodeProps) {
  const nodeData = data as unknown as SimNodeData;
  const def = getNodeDefinition(nodeData.nodeType);
  const color = def?.color ?? "#666";

  const healthColor =
    nodeData.health === HealthStatus.UNHEALTHY ? "#ef4444" :
    nodeData.health === HealthStatus.DEGRADED ? "#f59e0b" : "#22c55e";

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg"
      style={{ borderTopColor: color, borderTopWidth: 3, minWidth: 140 }}>
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-100">{nodeData.label}</span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: healthColor }} />
      </div>
      <p className="text-[10px] text-zinc-500">{def?.label ?? nodeData.nodeType}</p>
      {nodeData.requestCount !== undefined && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-zinc-400">
          <span>reqs: {nodeData.requestCount}</span>
          <span>err: {((nodeData.errorRate ?? 0) * 100).toFixed(1)}%</span>
          <span>lat: {(nodeData.avgLatency ?? 0).toFixed(1)}ms</span>
          <span>q: {nodeData.queueDepth ?? 0}</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
    </div>
  );
}
```

- [ ] **Step 4: Create `components/Canvas/AnimatedEdge.tsx`**

Copied from `app/components/canvas/animated-edge.tsx`. Remove `"use client"` (pure SVG, no hooks/handlers).

```tsx
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export default function AnimatedEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <circle r="4" fill="#22c55e" opacity="0.8">
        <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}
```

- [ ] **Step 5: Create `components/Canvas/index.tsx`**

New wrapper that owns `useCanvas` and renders `SimulationCanvas` (ReactFlow).

```tsx
"use client";

import { type Dispatch, type SetStateAction, type DragEvent } from "react";
import { ReactFlow, Controls, Background, BackgroundVariant,
  type Node as RFNode, type Edge as RFEdge, type OnNodesChange, type OnEdgesChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import SimNode from "./SimNode";
import AnimatedEdge from "./AnimatedEdge";
import { useCanvas } from "./useCanvas";

const nodeTypes = { simNode: SimNode };
const edgeTypes = { animated: AnimatedEdge };

interface CanvasProps {
  nodes: RFNode[];
  edges: RFEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: Dispatch<SetStateAction<RFNode[]>>;
  setEdges: Dispatch<SetStateAction<RFEdge[]>>;
  onNodeSelect: (node: RFNode | undefined) => void;
}

export default function Canvas({
  nodes, edges, onNodesChange, onEdgesChange,
  setNodes, setEdges, onNodeSelect,
}: CanvasProps) {
  const { wrapperRef, onConnect, onDragOver, onDrop, onNodeClick } = useCanvas(setNodes, setEdges);

  const handleNodeClick = (_: unknown, node: RFNode) => {
    onNodeClick(_, node);
    onNodeSelect(node);
  };

  return (
    <main ref={wrapperRef} className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="h-full w-full">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onNodeClick={handleNodeClick} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "animated" }} fitView>
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verify no build errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add components/Canvas/
git commit -m "refactor: create Canvas component folder with co-located hook and types"
```

---

## Task 4: Create `components/Toolbar/` folder

Move toolbar sub-components and expand the main Toolbar to include ChaosMenu and SaveLoad.

**Files:**
- Create: `components/Toolbar/SpeedControl.tsx`
- Create: `components/Toolbar/ScenarioPicker.tsx`
- Create: `components/Toolbar/ChaosMenu.tsx`
- Create: `components/Toolbar/SaveLoad.tsx`
- Create: `components/Toolbar/index.tsx`

- [ ] **Step 1: Create `components/Toolbar/SpeedControl.tsx`**

Copied from `app/components/toolbar/speed-control.tsx` unchanged.

```tsx
"use client";

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled?: boolean;
}

const SPEEDS = [0.1, 0.5, 1, 2, 5, 10, 20];

export default function SpeedControl({ speed, onSpeedChange, disabled }: SpeedControlProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500">Speed:</span>
      <select
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
        value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))} disabled={disabled}
      >
        {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/Toolbar/ScenarioPicker.tsx`**

Copied from `app/components/toolbar/scenario-picker.tsx` unchanged.

```tsx
"use client";

import { PREDEFINED_SCENARIOS } from "@/lib/scenarios";
import type { Scenario } from "@/lib/engine/models";

interface ScenarioPickerProps {
  selected: Scenario | null;
  onSelect: (scenario: Scenario) => void;
  disabled?: boolean;
}

export default function ScenarioPicker({ selected, onSelect, disabled }: ScenarioPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500">Scenario:</span>
      <select
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
        value={selected?.id ?? ""} disabled={disabled}
        onChange={(e) => {
          const s = PREDEFINED_SCENARIOS.find((sc) => sc.id === e.target.value);
          if (s) onSelect(s);
        }}
      >
        <option value="">Select...</option>
        {PREDEFINED_SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/Toolbar/ChaosMenu.tsx`**

Copied from `app/components/toolbar/chaos-menu.tsx` unchanged.

```tsx
"use client";

import { useState } from "react";

interface ChaosMenuProps {
  disabled?: boolean;
  onInjectChaos: (chaosType: string, target: string) => void;
  nodeIds: string[];
}

export default function ChaosMenu({ disabled, onInjectChaos, nodeIds }: ChaosMenuProps) {
  const [open, setOpen] = useState(false);

  const chaosActions = [
    { id: "kill-random", label: "Kill Random Node", description: "Crash a random non-client node" },
    { id: "spike-latency", label: "Spike Latency", description: "10x latency on a random node" },
    { id: "network-partition", label: "Network Partition", description: "Disconnect a random node" },
    { id: "increase-traffic", label: "Increase Traffic", description: "Double the request rate" },
  ];

  const handleAction = (chaosType: string) => {
    const nonClientNodes = nodeIds.filter((id) => !id.toLowerCase().startsWith("client"));
    const target = nonClientNodes.length > 0
      ? nonClientNodes[Math.floor(Math.random() * nonClientNodes.length)]
      : nodeIds[0] ?? "";
    if (target) onInjectChaos(chaosType, target);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={disabled}
        className="rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-40">
        Chaos
      </button>
      {open && !disabled && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-xl">
          {chaosActions.map((action) => (
            <button key={action.id} onClick={() => handleAction(action.id)}
              className="flex w-full flex-col rounded px-3 py-2 text-left hover:bg-zinc-700">
              <span className="text-xs font-medium text-zinc-200">{action.label}</span>
              <span className="text-[10px] text-zinc-500">{action.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/Toolbar/SaveLoad.tsx`**

Updated import path for `usePersistence`.

```tsx
"use client";

import { useState } from "react";
import { usePersistence } from "@/lib/hooks/use-persistence";
import type { SimulationConfig } from "@/lib/engine/models";

interface SaveLoadProps {
  onSave: (name: string) => void;
  onLoad: (config: SimulationConfig) => void;
  disabled?: boolean;
}

export default function SaveLoad({ onSave, onLoad, disabled }: SaveLoadProps) {
  const { list, load } = usePersistence();
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    if (name.trim()) { onSave(name.trim()); setShowSave(false); setName(""); }
  };

  const handleLoad = (configName: string) => {
    const config = load(configName);
    if (config) { onLoad(config); setShowLoad(false); }
  };

  const configs = list();

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <button onClick={() => { setShowSave(!showSave); setShowLoad(false); }} disabled={disabled}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40">
          Save
        </button>
        {showSave && (
          <div className="absolute left-0 top-full z-50 mt-1 flex w-48 gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-2 shadow-xl">
            <input type="text" placeholder="Config name..." value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300" />
            <button onClick={handleSave} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">OK</button>
          </div>
        )}
      </div>
      <div className="relative">
        <button onClick={() => { setShowLoad(!showLoad); setShowSave(false); }} disabled={disabled}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40">
          Load
        </button>
        {showLoad && configs.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-xl">
            {configs.map((c) => (
              <button key={c.name} onClick={() => handleLoad(c.name)}
                className="flex w-full rounded px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700">
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/Toolbar/index.tsx`**

Expanded to include ChaosMenu and SaveLoad (previously these were rendered elsewhere or not at all in Toolbar).

```tsx
"use client";

import SpeedControl from "./SpeedControl";
import ScenarioPicker from "./ScenarioPicker";
import ChaosMenu from "./ChaosMenu";
import SaveLoad from "./SaveLoad";
import type { Scenario, SimulationConfig } from "@/lib/engine/models";

interface ToolbarProps {
  running: boolean;
  connected: boolean;
  speed: number;
  time: number;
  selectedScenario: Scenario | null;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onScenarioSelect: (scenario: Scenario) => void;
  onInjectChaos: (chaosType: string, target: string) => void;
  nodeIds: string[];
  onSave: (name: string) => void;
  onLoad: (config: SimulationConfig) => void;
}

export default function Toolbar({
  running, connected, speed, time, selectedScenario,
  onRun, onPause, onResume, onStop, onSpeedChange, onScenarioSelect,
  onInjectChaos, nodeIds, onSave, onLoad,
}: ToolbarProps) {
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h.toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        {!running ? (
          <button onClick={onRun} disabled={!connected || !selectedScenario}
            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-40">
            Run
          </button>
        ) : (
          <>
            <button onClick={speed === 0 ? onResume : onPause}
              className="rounded bg-yellow-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-yellow-500">
              {speed === 0 ? "Resume" : "Pause"}
            </button>
            <button onClick={onStop}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500">
              Stop
            </button>
          </>
        )}
      </div>

      <ScenarioPicker selected={selectedScenario} onSelect={onScenarioSelect} disabled={running} />
      <SpeedControl speed={speed} onSpeedChange={onSpeedChange} disabled={!running} />
      <ChaosMenu disabled={!running} onInjectChaos={onInjectChaos} nodeIds={nodeIds} />
      <SaveLoad onSave={onSave} onLoad={onLoad} disabled={running} />

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>{formatTime(time)}</span>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify no build errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add components/Toolbar/
git commit -m "refactor: create Toolbar component folder with ChaosMenu and SaveLoad integration"
```

---

## Task 5: Create `components/Palette/`, `components/ConfigPanel/`, `components/TransactionLog/`

Move remaining leaf components unchanged (except import paths).

**Files:**
- Create: `components/Palette/index.tsx`
- Create: `components/Palette/PaletteItem.tsx`
- Create: `components/ConfigPanel/index.tsx`
- Create: `components/TransactionLog/index.tsx`

- [ ] **Step 1: Create `components/Palette/index.tsx`**

```tsx
"use client";

import { NODE_DEFINITIONS } from "@/lib/node-defaults";
import PaletteItem from "./PaletteItem";

export default function NodePalette() {
  const categories = [...new Set(NODE_DEFINITIONS.map((d) => d.category))];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nodes</p>
      {categories.map((cat) => (
        <div key={cat} className="flex flex-col gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">{cat}</p>
          {NODE_DEFINITIONS.filter((d) => d.category === cat).map((def) => (
            <PaletteItem key={def.type} type={def.type} label={def.label} color={def.color} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/Palette/PaletteItem.tsx`**

```tsx
"use client";

import { type DragEvent } from "react";
import { NodeType } from "@/lib/engine/models";

interface PaletteItemProps { type: NodeType; label: string; color: string; }

export default function PaletteItem({ type, label, color }: PaletteItemProps) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("application/reactflow-type", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="cursor-grab rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium transition-colors hover:border-zinc-500"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }} draggable onDragStart={onDragStart}>
      {label}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/ConfigPanel/index.tsx`**

Copied from `app/components/config/node-config-panel.tsx` unchanged.

```tsx
"use client";

import { NodeType, type NodeConfig } from "@/lib/engine/models";
import { getNodeDefinition } from "@/lib/node-defaults";

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: NodeType;
  config: NodeConfig;
  onConfigChange: (nodeId: string, config: Partial<NodeConfig>) => void;
  onClose: () => void;
}

interface ConfigField {
  key: string;
  label: string;
  type: "number" | "range" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
}

function getFieldsForType(nodeType: NodeType): ConfigField[] {
  const base: ConfigField[] = [
    { key: "concurrencyLimit", label: "Concurrency Limit", type: "number", min: 1, max: 10000 },
    { key: "maxQueueSize", label: "Max Queue Size", type: "number", min: 0, max: 100000 },
    { key: "errorRate", label: "Error Rate", type: "range", min: 0, max: 1, step: 0.01 },
  ];

  const extra: Record<string, ConfigField[]> = {
    [NodeType.CLIENT]: [
      { key: "requestRate", label: "Request Rate (rps)", type: "number", min: 1, max: 10000 },
    ],
    [NodeType.LOAD_BALANCER]: [
      { key: "strategy", label: "Strategy", type: "select", options: [
        { label: "Round Robin", value: "round-robin" },
        { label: "Least Connections", value: "least-connections" },
        { label: "IP Hash", value: "ip-hash" },
      ]},
      { key: "maxConnections", label: "Max Connections", type: "number", min: 1, max: 100000 },
      { key: "healthCheckInterval", label: "Health Check Interval (ms)", type: "number", min: 100, max: 60000 },
    ],
    [NodeType.DISTRIBUTED_CACHE]: [
      { key: "hitRate", label: "Hit Rate", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "capacity", label: "Capacity", type: "number", min: 100, max: 10000000 },
      { key: "ttl", label: "TTL (ms)", type: "number", min: 1000, max: 86400000 },
    ],
    [NodeType.SQL_DB]: [
      { key: "connectionPoolSize", label: "Connection Pool Size", type: "number", min: 1, max: 1000 },
      { key: "maxIOPS", label: "Max IOPS", type: "number", min: 100, max: 100000 },
    ],
    [NodeType.NOSQL_DB]: [
      { key: "partitionCount", label: "Partition Count", type: "number", min: 1, max: 256 },
      { key: "consistencyModel", label: "Consistency", type: "select", options: [
        { label: "Eventual", value: "eventual" }, { label: "Strong", value: "strong" },
      ]},
    ],
    [NodeType.MESSAGE_QUEUE]: [
      { key: "maxDepth", label: "Max Queue Depth", type: "number", min: 100, max: 10000000 },
      { key: "consumerThroughput", label: "Consumer Throughput", type: "number", min: 1, max: 100000 },
    ],
    [NodeType.API_GATEWAY]: [
      { key: "rateLimit", label: "Rate Limit (rps)", type: "number", min: 0, max: 100000 },
    ],
  };

  return [...base, ...(extra[nodeType] ?? [])];
}

export default function NodeConfigPanel({ nodeId, nodeType, config, onConfigChange, onClose }: NodeConfigPanelProps) {
  const def = getNodeDefinition(nodeType);
  const fields = getFieldsForType(nodeType);

  const handleChange = (key: string, value: string | number) => {
    onConfigChange(nodeId, { [key]: value } as Partial<NodeConfig>);
  };

  return (
    <div className="flex h-full w-72 flex-col border-l border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{def?.label ?? nodeType}</h3>
          <p className="text-[10px] text-zinc-500">{nodeId}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {fields.map((field) => {
            const value = (config as unknown as Record<string, unknown>)[field.key];
            return (
              <div key={field.key} className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{field.label}</label>
                {field.type === "select" ? (
                  <select className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
                    value={String(value ?? "")} onChange={(e) => handleChange(field.key, e.target.value)}>
                    {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : field.type === "range" ? (
                  <div className="flex items-center gap-2">
                    <input type="range" className="flex-1" min={field.min} max={field.max} step={field.step}
                      value={Number(value ?? 0)} onChange={(e) => handleChange(field.key, Number(e.target.value))} />
                    <span className="w-12 text-right text-xs text-zinc-400">{Number(value ?? 0).toFixed(2)}</span>
                  </div>
                ) : (
                  <input type="number" className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
                    min={field.min} max={field.max} step={field.step ?? 1}
                    value={Number(value ?? 0)} onChange={(e) => handleChange(field.key, Number(e.target.value))} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/TransactionLog/index.tsx`**

Copied from `app/components/log/transaction-log.tsx` unchanged.

```tsx
"use client";

import { useRef, useEffect } from "react";
import type { Transaction } from "@/lib/engine/models";

interface TransactionLogProps {
  transactions: Transaction[];
  onRowClick?: (transaction: Transaction) => void;
}

export default function TransactionLog({ transactions, onRowClick }: TransactionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transactions.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-zinc-800 px-3 py-1.5">
        <span className="text-xs font-semibold text-zinc-400">Transaction Log</span>
        <span className="text-[10px] text-zinc-600">{transactions.length} events</span>
      </div>
      <div className="grid grid-cols-[80px_100px_100px_60px_1fr_60px_50px] gap-2 border-b border-zinc-800 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        <span>Time</span><span>Source</span><span>Target</span><span>Proto</span><span>Message</span><span>Latency</span><span>Status</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {transactions.map((tx, i) => (
          <div key={tx.id + i}
            className="grid cursor-pointer grid-cols-[80px_100px_100px_60px_1fr_60px_50px] gap-2 border-b border-zinc-900 px-3 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800/50"
            onClick={() => onRowClick?.(tx)}>
            <span className="text-zinc-500">{String(tx.metadata?.timestamp ?? "—")}</span>
            <span>{String(tx.metadata?.source ?? "—")}</span>
            <span>{String(tx.metadata?.target ?? "—")}</span>
            <span>{tx.protocol}</span>
            <span className="truncate">{tx.message.method} {tx.message.path}</span>
            <span>{tx.result?.latency?.toFixed(1) ?? "—"}ms</span>
            <span className={tx.result?.status === "SUCCESS" ? "text-green-500" : "text-red-500"}>
              {tx.result?.statusCode ?? "..."}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify no build errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add components/Palette/ components/ConfigPanel/ components/TransactionLog/
git commit -m "refactor: create Palette, ConfigPanel, and TransactionLog component folders"
```

---

## Task 6: Create `components/SimulatorLayout/` — the orchestration owner

This is the key refactored component. It owns hooks, state, and passes targeted props to children.

**Files:**
- Create: `components/SimulatorLayout/index.tsx`

- [ ] **Step 1: Create `components/SimulatorLayout/index.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNodesState, useEdgesState, type Node as RFNode } from "@xyflow/react";
import { useSimulation } from "@/lib/hooks/use-simulation";
import { buildTopology } from "@/lib/build-topology";
import { type NodeData } from "@/components/Canvas/Canvas.types";
import { type Scenario, type NodeConfig, type SimulationConfig } from "@/lib/engine/models";
import Canvas from "@/components/Canvas";
import NodePalette from "@/components/Palette";
import Toolbar from "@/components/Toolbar";
import TransactionLog from "@/components/TransactionLog";
import NodeConfigPanel from "@/components/ConfigPanel";

export default function SimulatorLayout() {
  const { connected, state, connect, disconnect, start, stop, pause, resume, setSpeed, send } = useSimulation();
  const [nodes, setNodes, onNodesChange] = useNodesState([] as RFNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Connect WebSocket on mount, disconnect on unmount (deliberate improvement over original)
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const handleRun = useCallback(async () => {
    if (!selectedScenario || nodes.length === 0) return;

    const topology = buildTopology(nodes, edges);
    const res = await fetch("/api/simulation/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...topology, scenario: selectedScenario }),
    });

    const { simulationId } = await res.json();
    start(simulationId);
  }, [nodes, edges, selectedScenario, start]);

  const handleConfigChange = useCallback((id: string, config: Partial<NodeConfig>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const data = n.data as NodeData;
        return { ...n, data: { ...data, config: { ...data.config, ...config } } };
      })
    );
    if (state.running) send({ type: "UPDATE_CONFIG", data: { nodeId: id, config } });
  }, [setNodes, state.running, send]);

  const handleInjectChaos = useCallback((chaosType: string, target: string) => {
    send({ type: "INJECT_CHAOS", data: { chaosType, target } });
  }, [send]);

  const handleSave = useCallback((name: string) => {
    // SaveLoad component handles persistence internally
    // This callback is a placeholder for future canvas serialization
  }, []);

  const handleLoad = useCallback((config: SimulationConfig) => {
    // Future: restore canvas state from config
  }, []);

  const handleNodeSelect = useCallback((node: RFNode | undefined) => {
    setSelectedNodeId(node?.id ?? null);
  }, []);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h1 className="text-sm font-semibold">System Design Simulator</h1>
        <Toolbar
          running={state.running}
          connected={connected}
          speed={state.speed}
          time={state.time}
          selectedScenario={selectedScenario}
          onRun={handleRun}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          onSpeedChange={setSpeed}
          onScenarioSelect={setSelectedScenario}
          onInjectChaos={handleInjectChaos}
          nodeIds={nodeIds}
          onSave={handleSave}
          onLoad={handleLoad}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 overflow-y-auto border-r border-zinc-800 p-3">
          <NodePalette />
        </aside>

        <Canvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodeSelect={handleNodeSelect}
        />

        {selectedNode && (
          <NodeConfigPanel
            nodeId={selectedNode.id}
            nodeType={(selectedNode.data as NodeData).nodeType}
            config={(selectedNode.data as NodeData).config}
            onClose={() => setSelectedNodeId(null)}
            onConfigChange={handleConfigChange}
          />
        )}
      </div>

      <footer className="h-48 border-t border-zinc-800">
        <TransactionLog transactions={state.transactions} />
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify no build errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/SimulatorLayout/
git commit -m "refactor: create SimulatorLayout as orchestration owner with internal hooks"
```

---

## Task 7: Update `app/page.tsx` to thin composer

Replace the current page with a single import and render.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx` content**

```tsx
import SimulatorLayout from "@/components/SimulatorLayout";

export default function Home() {
  return <SimulatorLayout />;
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify dev server starts**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "refactor: simplify page.tsx to thin composer"
```

---

## Task 8: Delete old files and final verification

Remove the old `app/components/` and `app/hooks/` directories. Verify everything still works.

**Files:**
- Delete: `app/components/` (entire directory)
- Delete: `app/hooks/` (entire directory)

- [ ] **Step 1: Delete old directories**

```bash
rm -rf app/components/ app/hooks/
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Verify tests pass**

Run: `npm run test`
Expected: All existing engine tests pass (they don't import from deleted dirs)

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove old app/components/ and app/hooks/ directories"
```

---

## Summary

| Task | Description | New Files |
|------|-------------|-----------|
| 1 | Extract `buildTopology` | 1 |
| 2 | Move shared hooks to `lib/hooks/` | 2 |
| 3 | Create `components/Canvas/` | 5 |
| 4 | Create `components/Toolbar/` | 5 |
| 5 | Create Palette, ConfigPanel, TransactionLog | 4 |
| 6 | Create SimulatorLayout (orchestration) | 1 |
| 7 | Slim down `page.tsx` | 0 (modify) |
| 8 | Delete old files + verify | 0 (delete) |
