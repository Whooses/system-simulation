# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A system design simulation platform — an interactive web app where users drag-and-drop infrastructure nodes (load balancers, databases, caches, queues, etc.) onto a canvas, wire them together, and run discrete-event simulations to observe behavior under load, failures, and chaos scenarios.

## Commands

```bash
npm run dev          # Next.js dev server (port 3000)
npm run dev:ws       # WebSocket server only (tsx)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (all tests)
npm run test:watch   # Vitest watch mode
npx vitest run lib/engine/__tests__/engine.test.ts  # Single test file
```

## Architecture

**Single Next.js monorepo** with three layers:

### Frontend (`app/`)
- **React 19 + Next.js 16** with App Router
- **@xyflow/react** for the interactive node-graph canvas
- **Tailwind CSS 4** for styling
- Key hooks: `use-simulation.ts` (WebSocket client + sim state), `use-persistence.ts` (localStorage save/load)
- Components organized by area: `canvas/`, `palette/`, `toolbar/`, `config/`, `log/`

### Backend (`server/` + `app/api/`)
- **WebSocket server** (`ws` library) handles real-time sim control (START/STOP/PAUSE/RESUME/SPEED/INJECT_CHAOS)
- **REST endpoint** `POST /api/simulation/create` initializes simulation config
- **SimulationManager** runs a 50ms tick loop, dequeues events, routes to handlers, broadcasts state via WS

### Simulation Engine (`lib/engine/`)
- **Discrete event simulator** with a priority queue (min-heap by timestamp)
- **14 node types** each with a dedicated handler in `handlers/` (web-server, load-balancer, cache, sql-db, nosql-db, message-queue, event-stream, dns, cdn, api-gateway, etc.)
- **Reliability patterns** in `reliability/` (circuit breaker, health checker, retry handler, timeout manager)
- **Latency distributions** (normal, exponential, lognormal, uniform, constant)
- **Metrics collector** with rolling window p50/p95/p99
- Types defined in `models/types.ts`; node defaults in `lib/node-defaults.ts`; predefined scenarios in `lib/scenarios.ts`

### Data Flow
1. User places nodes + edges on canvas, picks a scenario
2. "Run" → `POST /api/simulation/create` stores config → WS `START` message
3. Engine dequeues events from priority queue → routes to node handler → handler returns new events
4. SimulationManager broadcasts TRANSACTION/NODE_STATE/ALERT to frontend every 50ms

## Path Alias

`@/*` maps to the project root (configured in tsconfig.json).

## Testing

All engine tests live in `lib/engine/__tests__/`. Tests cover: engine core, all node handlers, distributions, scenario runner, metrics, and reliability patterns. Uses Vitest with node environment and global test APIs.
