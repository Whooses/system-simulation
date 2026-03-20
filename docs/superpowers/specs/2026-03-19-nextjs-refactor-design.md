# Next.js Architecture Refactor — Design Spec

## Overview

Refactor the frontend of the system design simulation platform to follow Next.js best practices: top-level `components/` directory with co-located hooks/types/sub-components, thin page composition, eliminated prop-drilling, and clean `"use client"` usage.

## Goals

1. **Thin page** — `page.tsx` only composes, no hooks or state
2. **Co-located components** — each component folder owns its hook, types, and sub-components
3. **Eliminated prop-drilling** — `SimulatorLayout` owns orchestration hooks internally instead of receiving 25+ props
4. **Clean `"use client"`** — only on files that directly use client APIs
5. **Shared hooks in `lib/`** — WebSocket and persistence hooks are infrastructure, not component-specific

## Current Problems

- Components live under `app/components/` instead of top-level `components/`
- Hooks live under `app/hooks/` with no co-location
- `page.tsx` calls 3 hooks, destructures ~25 values, passes them all through `SimulatorLayout`
- `SimulatorLayout` is a prop-drilling relay (25+ props, just distributes to children)
- Every file has `"use client"` including pure presentational components
- `NodeData` type is defined in `use-canvas.ts` instead of near canvas components

## New Folder Structure

```
components/
  SimulatorLayout/
    index.tsx              — owns orchestration hooks, composes children
    SimulatorLayout.types.ts
  Canvas/
    index.tsx              — SimulationCanvas wrapper
    useCanvas.ts           — canvas interactions (drag/drop/connect/select)
    SimNode.tsx
    AnimatedEdge.tsx
    Canvas.types.ts        — NodeData type
  Toolbar/
    index.tsx
    SpeedControl.tsx
    SaveLoad.tsx
    ChaosMenu.tsx
    ScenarioPicker.tsx
  Palette/
    index.tsx              — NodePalette
    PaletteItem.tsx
  ConfigPanel/
    index.tsx              — NodeConfigPanel
  TransactionLog/
    index.tsx
lib/
  hooks/
    use-simulation.ts      — WebSocket hook (shared infrastructure)
    use-persistence.ts     — localStorage hook (shared utility)
  engine/                  — unchanged
  node-defaults.ts         — unchanged
app/
  page.tsx                 — thin: just <SimulatorLayout />
  layout.tsx               — unchanged
  api/                     — unchanged
```

## Component Composition

### page.tsx (thin composer)

```tsx
import SimulatorLayout from "@/components/SimulatorLayout";

export default function Home() {
  return <SimulatorLayout />;
}
```

No `"use client"`, no hooks, no state. Pure composition.

### SimulatorLayout (orchestration owner)

- Calls `useSimulation()` for WebSocket connection/state
- Calls `useEffect` to establish WebSocket connection on mount, with `disconnect` cleanup on unmount
- Owns `nodes`/`edges` state via `useNodesState`/`useEdgesState` (from @xyflow/react)
- Contains `handleRun` callback — maps nodes/edges to simulation topology, POSTs to `/api/simulation/create`, calls `start(simulationId)`
- Owns `onConfigChange` bridge — updates local canvas node config via `updateNodeConfig` AND sends `UPDATE_CONFIG` WebSocket message if simulation is running
- Passes `send` to Toolbar for ChaosMenu's `onInjectChaos`
- Passes minimal, targeted props to each child

**Design decision — why SimulatorLayout owns node/edge state:**
`handleRun` needs to read nodes/edges to build the simulation config. `onConfigChange` needs to both update node data and send a WebSocket message. ChaosMenu needs node IDs for target selection. Lifting state to SimulatorLayout gives it direct access without needing refs or imperative escape hatches. Canvas still owns all interaction logic (drag, drop, connect) via `useCanvas` — it just receives the state as parameters.

### Canvas (interaction owner)

- Receives `nodes`, `setNodes`, `edges`, `setEdges` as props (state owned by SimulatorLayout)
- Calls `useCanvas(nodes, setNodes, edges, setEdges)` internally for interaction handlers
- Exposes `onNodeSelect` callback to parent for config panel
- Renders `SimNode` and `AnimatedEdge` sub-components

### Other Components

- **Toolbar**: Receives simulation controls (running, speed, callbacks), plus `send` and `nodeIds` for ChaosMenu, and `onSave`/`onLoad` for SaveLoad
- **SaveLoad**: Calls `usePersistence()` internally for localStorage operations. Receives `onSave(config)` / `onLoad(config)` from Toolbar to serialize/restore canvas state
- **ChaosMenu**: Receives `onInjectChaos` (wraps `send({ type: "INJECT_CHAOS", ... })`) and `nodeIds` (derived from current nodes)
- **Palette**: Self-contained, no props needed. Communicates with Canvas implicitly via HTML drag-and-drop `dataTransfer` using the key `"application/reactflow-type"`
- **ConfigPanel**: Receives `selectedNode` + `onConfigChange` + `onClose`
- **TransactionLog**: Receives `transactions[]`

## Hook Responsibilities

### `lib/hooks/use-simulation.ts` (moved, unchanged logic)
- WebSocket connection, message parsing, state management
- Returns: `connected`, `state`, `connect`, `start`, `stop`, `pause`, `resume`, `setSpeed`, `send`

### `lib/hooks/use-persistence.ts` (moved, unchanged logic)
- localStorage CRUD for simulation configs
- Returns: `save`, `list`, `load`, `remove`

### `components/Canvas/useCanvas.ts` (refactored)
- Receives node/edge state + setters as parameters
- Owns: `onConnect`, `onDragOver`, `onDrop`, `onNodeClick`, `updateNodeConfig`, `selectedNode`
- Returns interaction handlers + selected node info

### `useSimulationRunner` — removed
- The `handleRun` callback moves into `SimulatorLayout`
- The node/edge-to-simulation mapping logic (~35 lines) is extracted into a pure function `buildTopology(nodes, edges)` in `lib/build-topology.ts` — keeps SimulatorLayout focused on orchestration, not data transformation
- `SimulatorLayout.handleRun` calls `buildTopology()`, POSTs the result, then calls `start(simulationId)`

## `"use client"` Strategy

**Convention:** Keep `"use client"` on any file that directly uses client APIs (hooks, useState, browser event handlers like onDragStart/onChange). Even though children of client components are automatically client components at runtime, the directive communicates intent and prevents breakage if a component is ever imported from a server context.

- **Keep**: `SimulatorLayout/index.tsx`, `Canvas/index.tsx`, `Canvas/SimNode.tsx`, `Toolbar/index.tsx`, `Toolbar/SaveLoad.tsx`, `Toolbar/ChaosMenu.tsx`, `Toolbar/ScenarioPicker.tsx`, `Palette/index.tsx`, `Palette/PaletteItem.tsx`, `ConfigPanel/index.tsx`, `TransactionLog/index.tsx`
- **Remove**: `AnimatedEdge.tsx` (pure SVG, no event handlers or hooks)
- **Rule**: If a component uses `on*` handlers, `useState`, `useEffect`, `useRef`, or browser APIs → keep `"use client"`

## What Does NOT Change

- `lib/engine/` — simulation engine is untouched
- `lib/node-defaults.ts` — node definitions unchanged
- `server/` — WebSocket server unchanged
- `app/api/` — REST endpoints unchanged
- Component visual appearance — no UI/styling changes
- All existing functionality — this is a structural refactor only

## New Folder Structure Addition

```
lib/
  build-topology.ts        — pure function: maps ReactFlow nodes/edges to simulation config
```

## Migration Strategy

1. Create new top-level `components/` directory structure
2. Move and refactor components into new locations
3. Move shared hooks to `lib/hooks/`
4. Extract `buildTopology()` into `lib/build-topology.ts`
5. Refactor `SimulatorLayout` to own orchestration (hooks, handleRun, onConfigChange, useEffect connect/disconnect)
6. Refactor `Canvas` to receive state as props, own `useCanvas` internally
7. Simplify `page.tsx` to thin composer
8. Update all imports throughout
9. Verify build and existing tests pass
10. Delete old `app/components/` and `app/hooks/` directories (only after step 9 passes)

**Note:** Engine tests under `lib/engine/__tests__/` only test backend logic and import from `lib/engine/` — they are unaffected by this refactor. No test file imports need updating.
