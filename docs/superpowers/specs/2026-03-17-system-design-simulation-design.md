# System Design Simulation Sandbox — Design Spec

## Overview

A web application where users drag-and-drop infrastructure nodes onto a canvas, connect them, and run real-time simulations powered by a discrete event simulation (DES) engine. Users observe animated request flow, inspect node metrics, inject failures, and learn how distributed systems behave under load.

### Goals

1. **Design sandbox** — Users model architectures and run simulated load to identify bottlenecks and single points of failure.
2. **Educational tool** (future) — Guided tutorials that explain how components interact.
3. **Interview prep** (future) — Structured system design scenarios with validation criteria.

### Explicitly Deferred

- Scriptable/custom node logic (architecture supports it, not built yet)
- Educational mode (guided tutorials, explanations)
- Interview prep mode (structured scenarios with validation)
- Server-side persistence / user accounts
- Collaborative editing

---

## 1. Core Simulation Engine

A discrete event simulation engine running on the Next.js backend.

### Event Queue

A min-heap priority queue sorted by simulated timestamp. Each event represents something happening in the system — a request arriving at a node, a processing step completing, a timeout firing, a failure occurring.

### Event Structure

```typescript
enum EventType {
  REQUEST_ARRIVE    = "REQUEST_ARRIVE",     // a request reaches a node
  PROCESS_COMPLETE  = "PROCESS_COMPLETE",   // a node finishes processing
  RESPONSE          = "RESPONSE",           // a response sent back to caller
  CACHE_HIT         = "CACHE_HIT",          // cache lookup succeeded
  CACHE_MISS        = "CACHE_MISS",         // cache lookup failed
  TIMEOUT           = "TIMEOUT",            // a request timed out
  FAILURE           = "FAILURE",            // a node crash or injected failure
  HEALTH_CHECK      = "HEALTH_CHECK",       // periodic health probe
  HEALTH_RESULT     = "HEALTH_RESULT",      // health check response
  QUEUE_ENQUEUE     = "QUEUE_ENQUEUE",      // message added to a queue
  QUEUE_DEQUEUE     = "QUEUE_DEQUEUE",      // consumer picks up a message
  CIRCUIT_OPEN      = "CIRCUIT_OPEN",       // circuit breaker tripped
  CIRCUIT_HALF_OPEN = "CIRCUIT_HALF_OPEN",  // circuit breaker probing
  CIRCUIT_CLOSE     = "CIRCUIT_CLOSE",      // circuit breaker recovered
  RETRY             = "RETRY",              // a retry attempt
}

interface Event {
  id: string;
  timestamp: number;           // simulated time in ms
  type: EventType;
  sourceNodeId: string;
  targetNodeId: string;
  transaction: Transaction;
}
```

### Transaction (Core Primitive)

Every interaction between two nodes is a transaction containing a message, a protocol, and a result. Note: "transaction" here means a request-response pair between two nodes, not a database/ACID transaction.

```typescript
interface Transaction {
  id: string;
  message: Message;             // payload, command, HTTP method + path, query, etc.
  protocol: Protocol;           // HTTP, gRPC, TCP, async (queue), DNS, etc.
  result: Result | null;        // success/failure/pending, status code, latency
  parentTransactionId?: string; // for tracing request chains
  metadata: Record<string, any>;
}
```

### SimContext

The context object passed to every node handler, providing access to simulation state and utilities.

```typescript
interface SimContext {
  currentTime: number;                          // current simulated time in ms
  getNode(nodeId: string): SimulationNode;      // look up any node by ID
  getConnections(nodeId: string): Connection[];  // outbound connections from a node
  scheduleEvent(event: Event): void;            // enqueue a new event
  cancelEvent(eventId: string): void;           // cancel a pending event (e.g., timeout)
  sampleLatency(dist: LatencyDistribution): number; // sample from a distribution
  recordMetric(nodeId: string, metric: string, value: number): void; // record a metric
  generateId(): string;                         // unique ID generator
}
```

### Simulation Loop

1. Pop the next event from the priority queue.
2. Advance simulated time to that event's timestamp.
3. Dispatch the event to the target node's handler.
4. The handler returns zero or more new events to enqueue.
5. Buffer completed transactions for the next WebSocket frame (batched every 50ms wall-clock).
6. Repeat.

Two separate streaming cadences feed the frontend: **transaction events** are batched into frames every 50ms of wall-clock time, while **node metrics** (`NODE_STATE`) are computed and sent every 200ms of simulated time.

### Time Control

A `speedMultiplier` controls how fast simulated time maps to wall-clock time:
- `1x` = real-time
- `10x` = fast-forward
- `0` = paused

The engine uses `setTimeout`/`setImmediate` to pace event dispatch according to the multiplier.

---

## 2. Node Model & Type System

Every node on the canvas is an instance of `SimulationNode` that delegates behavior to a `NodeHandler` based on its type.

### SimulationNode

```typescript
interface SimulationNode {
  id: string;
  type: NodeType;
  label: string;
  config: NodeConfig;           // type-specific knobs
  state: NodeState;             // runtime state (queue depth, connections, health)
  position: { x: number; y: number };
  connections: Connection[];
}
```

### Connection

```typescript
interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  protocol: Protocol;
  latency: LatencyDistribution;
}
```

### NodeHandler Interface

```typescript
interface NodeHandler {
  onEvent(node: SimulationNode, event: Event, context: SimContext): Event[];
}
```

Each node type implements this interface. For example, `LoadBalancerHandler.onEvent` receives a `REQUEST_ARRIVE`, picks a backend based on its strategy, and returns a new `REQUEST_ARRIVE` event targeting that backend with added latency. If all backends are unhealthy, it returns a `RESPONSE` event with a 503 error.

### Node Types and Configuration Knobs

| Category | Node Type | Key Config Knobs |
|----------|-----------|-----------------|
| Client & Entry | Client | request rate, request type distribution |
| Client & Entry | DNS | resolution latency, TTL, failure rate |
| Client & Entry | CDN | cache hit rate, origin fallback latency, TTL |
| Load Balancer | L4/L7 LB | strategy (round-robin, least-conn, IP hash), max connections, health check interval |
| Compute | Web/API Server | concurrency limit, processing latency distribution, error rate |
| Compute | Microservice | same as server, plus service-specific logic |
| Cache | In-Process Cache | capacity, hit rate, eviction policy (LRU/LFU), TTL |
| Cache | Distributed Cache | same + network latency, replication lag |
| Database | SQL DB | connection pool size, query latency distribution, replication lag, max IOPS |
| Database | NoSQL DB | partition count, read/write latency, consistency model (eventual/strong) |
| Queue | Message Queue | max depth, consumer throughput, delivery guarantee (at-least-once, exactly-once) |
| Queue | Event Stream | partition count, consumer group lag, retention |
| Storage | Object Storage | read/write latency, throughput limit |
| Search | Search Index | query latency, indexing lag |
| Gateway | API Gateway | rate limit, auth latency, routing rules |

### NodeState

Tracks runtime data per node:
- Current queue depth
- Active connections / connection pool utilization
- Health status (healthy, degraded, unhealthy)
- Rolling metrics: request count, error count, avg latency

Updated as events are processed and streamed to the frontend for display.

---

## 3. Failure & Reliability Modeling

Failures are first-class events in the simulation.

### Failure Types

| Failure | How It Works |
|---------|-------------|
| Node crash | Node stops processing events. Queued events pile up or timeout. Triggered manually or by overload (queue depth exceeds threshold). |
| Latency spike | Node's processing latency distribution shifts (e.g., mean jumps from 50ms to 2000ms). Simulates GC pauses, disk contention, noisy neighbors. |
| Partial failure | Node returns errors for a configurable percentage of requests. Simulates degraded state. |
| Network partition | A connection between two nodes stops delivering events. Requests timeout. Simulates split-brain, zone failures. |
| Resource exhaustion | Connection pool fills up, queue hits max depth. New requests get rejected/queued. Emerges naturally from simulation parameters. |

### Reliability Patterns (Built Into Node Handlers)

- **Retries with exponential backoff** — Configurable per connection: max retries, base delay, backoff multiplier, jitter. On error response, the source node re-enqueues the request with increasing delay.
- **Circuit breaker** — Tracks error rate over a sliding window. States: CLOSED (normal) -> OPEN (fail-fast) -> HALF-OPEN (probe). Configurable thresholds per connection.
- **Timeouts** — Every connection has a timeout. A TIMEOUT event is scheduled alongside each request. Whichever arrives first (response or timeout) wins; the other is discarded.
- **Health checks** — Load balancers periodically send health check events to backends. Unhealthy backends are removed from rotation. Configurable interval and failure threshold.
- **Bulkheads** — Nodes have concurrency limits. Requests beyond the limit are queued (up to queue max) or rejected. Prevents one slow dependency from consuming all resources.

### Cascading Failure Example

DB latency spikes -> server connection pools fill up -> servers stop accepting requests -> LB health checks fail -> LB marks servers unhealthy -> clients get 503s. All emergent from node configs and event propagation.

### Chaos Scenarios (Predefined)

- Kill a random node
- Spike latency on a connection
- Network partition between two zones
- Gradually increase traffic until something breaks

Users can also manually click a node to crash it, spike its latency, etc.

---

## 4. Traffic Scenarios & Load Generation

Traffic enters through Client nodes. A Scenario defines what traffic those clients generate.

### Scenario Structure

```typescript
interface Scenario {
  id: string;
  name: string;
  description: string;
  duration: number;              // simulated seconds
  phases: Phase[];
}

interface Phase {
  startTime: number;              // when this phase begins (simulated seconds)
  duration: number;
  requestRate: number;            // requests per second
  rampUp?: number;                // seconds to ramp from 0 to requestRate
  requestDistribution: {
    type: RequestType;
    weight: number;
  }[];
}
```

### Predefined Scenario Library

| Scenario | Description |
|----------|-------------|
| Steady State | Constant 100 rps for 60s. Baseline validation. |
| Gradual Ramp | 10 rps -> 500 rps over 120s. Find the breaking point. |
| Flash Sale Spike | Steady 50 rps, instant burst to 1000 rps for 10s, back to 50 rps. Tests buffering and cache effectiveness. |
| Diurnal Pattern | Sine wave traffic over 24 simulated hours. Tests sustained operation. |
| Cascading Failure | Moderate load + scheduled DB failure at t=30s. Watch failure propagation. |
| Thundering Herd | Cache TTL expires, all requests miss cache simultaneously and hit DB. |
| Retry Storm | Backend goes unhealthy, aggressive retry policies amplify load. |

### Request Types

Abstract — carry a `type` string and optional `payload`. Nodes interpret them: a cache node checks if the type is in its cached set; a DB node uses the type to determine which latency distribution to sample from (read vs. write).

---

## 5. Frontend Architecture

### Tech Stack

- React 19, Next.js 16, Tailwind 4 (existing)
- React Flow — node graph canvas (drag-and-drop, connections, zoom/pan)
- WebSocket — real-time event streaming from backend

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Toolbar: Run/Pause/Speed | Scenario picker | Chaos  │
├────────┬────────────────────────────────────────────┤
│        │                                            │
│ Node   │           Canvas (React Flow)              │
│ Palette│                                            │
│        │   [Client] ──> [LB] ──> [Server] ──> [DB] │
│ - Client│          animated request dots            │
│ - LB    │                                           │
│ - Server│                                           │
│ - Cache │                                           │
│ - DB    │                                           │
│ - Queue │                                           │
│ - ...   │                                           │
├────────┴────────────────────────────────────────────┤
│  Transaction Log (scrolling)                         │
│  12:00:05.123  Client->LB  HTTP GET /users  2ms  OK │
│  12:00:05.125  LB->Srv2    HTTP GET /users  1ms  OK │
│  12:00:05.130  Srv2->Cache  GET user:123   0.5ms ERR│
│  12:00:05.131  Srv2->DB    SELECT * FROM.. 45ms  OK │
└─────────────────────────────────────────────────────┘
```

### Canvas Nodes

Show real-time stats on hover or inline:
- Request count, error count, error rate
- Current queue depth / connection pool usage
- Average latency (rolling window)
- Health status indicator (green/yellow/red)

### Animated Request Flow

When the backend streams a transaction event, the frontend animates a dot traveling along the connection edge from source to target. Color-coded: green for success, red for error, yellow for slow. Multiple dots can be in flight simultaneously.

### Node Configuration Panel

Clicking a node opens a right-side panel showing type-specific knobs (sliders, dropdowns, number inputs). Changes sent to the backend take effect immediately in the running simulation.

### Transaction Log Panel

Scrolling table at the bottom. Columns: timestamp, source, target, protocol, message summary, latency, result. Filterable by node, status, protocol. Clicking a row highlights the corresponding nodes and connection on the canvas.

### State Management

Frontend state is minimal — canvas layout (node positions, connections) and UI state. All simulation state lives on the backend and is streamed. Canvas layout persisted to localStorage for save/load.

---

## 6. Backend Architecture & Communication Protocol

### Backend Structure

```
Next.js App
├── /app                    → Frontend pages & components
├── /app/api/simulation     → REST endpoints (setup & teardown only)
│   ├── POST /create        → Create simulation from canvas state, returns simulationId
│   └── GET  /state         → Get current simulation snapshot
├── /server/ws.ts           → Custom WebSocket server (ws library)
└── /lib/engine             → Simulation engine (runs in-process)
    ├── Engine              → Main loop, event queue, time control
    ├── EventQueue          → Min-heap priority queue
    ├── handlers/           → One NodeHandler per node type
    ├── models/             → Node, Event, Transaction, Connection types
    └── distributions/      → Latency sampling (normal, exponential, uniform, lognormal)
```

### WebSocket Implementation

Next.js API routes are request-response based and do not support persistent connections. The WebSocket server runs as a **custom server** using the `ws` library alongside Next.js. A custom `server.ts` wraps `next()` and attaches a `WebSocketServer` to the same HTTP server on a `/ws` path. This requires running via `node server.ts` (or `tsx server.ts`) instead of `next start`.

**Deployment requirement:** The app must run as a persistent Node.js process (VM, container, or `node server.ts`). It is not compatible with serverless deployment (Vercel functions, AWS Lambda) because the simulation engine maintains in-memory state and requires long-lived WebSocket connections.

### Communication Model

REST is used only for simulation setup and teardown. All real-time communication (control commands and event streaming) goes through WebSocket. This avoids ambiguity about which channel is canonical for control.

**Server to client (WebSocket):**

| Message Type | Data | Purpose |
|-------------|------|---------|
| `TRANSACTION` | `Transaction` | A transaction completed |
| `NODE_STATE` | `NodeStateUpdate` | Node metrics changed (sent every 200ms of simulated time) |
| `NODE_HEALTH` | `{ nodeId, status }` | Health status changed |
| `SIM_STATUS` | `{ time, speed, running }` | Sim clock update (sent every 50ms wall-clock) |
| `ALERT` | `{ message, severity }` | Circuit open, queue full, etc. |

**Client to server (WebSocket):**

| Message Type | Data | Purpose |
|-------------|------|---------|
| `START` | `{ simulationId }` | Start the simulation |
| `STOP` | — | Stop and tear down the simulation |
| `PAUSE` | — | Pause simulation |
| `RESUME` | — | Resume simulation |
| `SPEED` | `{ multiplier }` | Change simulation speed |
| `UPDATE_CONFIG` | `{ nodeId, config }` | Tweak a knob mid-sim |
| `INJECT_CHAOS` | `{ chaosType, target }` | Manual failure injection |

### Event Batching & Backpressure

At high request rates, the backend batches events into frames (every 50ms of wall-clock time) and sends them as an array. The frontend interpolates animations between frames.

At the engine level, if the event queue grows beyond a high-water mark (e.g., 100,000 pending events), the engine processes events in microbatches using `setImmediate` to yield to the Node.js event loop between batches. This prevents event loop starvation at high speed multipliers.

### Simulation Lifecycle

1. User builds canvas (frontend-only, no backend needed).
2. User clicks "Run" — frontend sends canvas state + selected scenario via REST `POST /create`, receives a `simulationId`.
3. Frontend opens WebSocket connection, sends `START { simulationId }`.
4. Backend instantiates the engine, begins the DES loop, streams events via WebSocket.
5. User can pause, resume, change speed, tweak configs, inject chaos — all via WebSocket messages.
6. User clicks "Stop" — frontend sends `STOP` via WebSocket, engine halts, server sends final `SIM_STATUS { running: false }` and closes the connection.

### Canvas Modification During Simulation

Modifying the canvas (adding/removing nodes or connections) while a simulation is running is not supported in v1. The user must stop the simulation, modify the canvas, and start a new one. The toolbar disables canvas editing while a simulation is active.

### Persistence

For v1, simulation configurations (canvas layouts + node configs) are saved to localStorage on the frontend as a JSON document conforming to the `SimulationConfig` schema:

```typescript
interface SimulationConfig {
  version: 1;
  name: string;
  nodes: SimulationNode[];
  connections: Connection[];
  scenario: Scenario;
}
```

No database needed. Backend is stateless between sessions.

---

## 7. Data Flow & Latency Modeling

### Request Flow Example

1. Engine pops `REQUEST_ARRIVE` targeting Client at `t=0`.
2. `ClientHandler` generates request, enqueues `REQUEST_ARRIVE` on DNS at `t += sample(dnsLatency)`.
3. `DNSHandler` resolves, enqueues `REQUEST_ARRIVE` on CDN/LB at `t += sample(dnsResolution)`.
4. `LoadBalancerHandler` picks backend, enqueues `REQUEST_ARRIVE` on Server2 at `t += sample(connectionLatency)`.
5. `ServerHandler` checks cache — enqueues `REQUEST_ARRIVE` on Cache at `t += sample(networkHop)`.
6. `CacheHandler` — miss — returns `CACHE_MISS` response to server.
7. `ServerHandler` receives miss, enqueues `REQUEST_ARRIVE` on DB at `t += sample(networkHop)`.
8. `DBHandler` checks connection pool, samples query latency, enqueues `RESPONSE` back at `t += sample(queryLatency)`.
9. Response propagates back: Server -> LB -> Client, each hop adding latency.

At every step, a `TIMEOUT` event is also enqueued. Whichever arrives first (response or timeout) wins; the other is discarded.

### Latency Distributions

```typescript
type LatencyDistribution =
  | { type: "constant"; value: number }
  | { type: "normal"; mean: number; stddev: number }
  | { type: "exponential"; mean: number }
  | { type: "uniform"; min: number; max: number }
  | { type: "lognormal"; mu: number; sigma: number };
```

Lognormal is the default for most node types — it naturally produces long-tail latency behavior seen in real systems.

### Queuing Model

Nodes with concurrency limits use an M/M/c queue model:
- Request arrives, checks if a worker/connection is available.
- If yes: start processing, enqueue completion event at `t + sample(processingLatency)`.
- If no and queue has capacity: add to queue, dequeued when a worker frees up.
- If no and queue is full: reject immediately (503/backpressure).

When processing completes, the handler checks the queue and starts the next waiting request.

### Metrics Collection

Per-node rolling windows (last 60 simulated seconds):
- Request count, error count, error rate
- Latency percentiles (p50, p95, p99)
- Queue depth over time
- Connection pool utilization

Streamed to frontend as `NODE_STATE` events at regular intervals.
