# System Design Simulation Sandbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based system design sandbox where users drag-and-drop infrastructure nodes onto a canvas, connect them, and run real-time discrete event simulations with animated request flow, failure injection, and a transaction log.

**Architecture:** A Next.js 16 app with a custom WebSocket server (`ws` library) wrapping the Next.js HTTP server. The DES engine runs in-process on the backend, streaming events to the React Flow canvas via WebSocket. Frontend uses React 19, Tailwind 4, and React Flow for the node graph.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, React Flow, `ws` (WebSocket), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-17-system-design-simulation-design.md`

---

## Phase 1: Foundation — Engine Types, Event Queue, Distributions

### Task 1: Project Setup — Testing & Dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/engine/__tests__/.gitkeep`

- [ ] **Step 1: Install dependencies**

```bash
npm install ws @types/ws uuid
npm install -D vitest @types/uuid
```

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Run vitest to verify setup**

Run: `npx vitest run`
Expected: "No test files found" (no error)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest, ws, uuid dependencies and test config"
```

---

### Task 2: Core Type Definitions

**Files:**
- Create: `lib/engine/models/types.ts`
- Create: `lib/engine/models/index.ts`

- [ ] **Step 1: Create the core type definitions**

Create `lib/engine/models/types.ts` with all shared types from the spec:

```typescript
// === Enums ===

export enum EventType {
  REQUEST_ARRIVE = "REQUEST_ARRIVE",
  PROCESS_COMPLETE = "PROCESS_COMPLETE",
  RESPONSE = "RESPONSE",
  CACHE_HIT = "CACHE_HIT",
  CACHE_MISS = "CACHE_MISS",
  TIMEOUT = "TIMEOUT",
  FAILURE = "FAILURE",
  HEALTH_CHECK = "HEALTH_CHECK",
  HEALTH_RESULT = "HEALTH_RESULT",
  QUEUE_ENQUEUE = "QUEUE_ENQUEUE",
  QUEUE_DEQUEUE = "QUEUE_DEQUEUE",
  CIRCUIT_OPEN = "CIRCUIT_OPEN",
  CIRCUIT_HALF_OPEN = "CIRCUIT_HALF_OPEN",
  CIRCUIT_CLOSE = "CIRCUIT_CLOSE",
  RETRY = "RETRY",
}

export enum Protocol {
  HTTP = "HTTP",
  GRPC = "GRPC",
  TCP = "TCP",
  ASYNC = "ASYNC",
  DNS = "DNS",
  INTERNAL = "INTERNAL",
}

export enum HealthStatus {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  UNHEALTHY = "UNHEALTHY",
}

export enum NodeType {
  CLIENT = "CLIENT",
  DNS = "DNS",
  CDN = "CDN",
  LOAD_BALANCER = "LOAD_BALANCER",
  WEB_SERVER = "WEB_SERVER",
  MICROSERVICE = "MICROSERVICE",
  IN_PROCESS_CACHE = "IN_PROCESS_CACHE",
  DISTRIBUTED_CACHE = "DISTRIBUTED_CACHE",
  SQL_DB = "SQL_DB",
  NOSQL_DB = "NOSQL_DB",
  MESSAGE_QUEUE = "MESSAGE_QUEUE",
  EVENT_STREAM = "EVENT_STREAM",
  OBJECT_STORAGE = "OBJECT_STORAGE",
  SEARCH_INDEX = "SEARCH_INDEX",
  API_GATEWAY = "API_GATEWAY",
}

export enum ResultStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  PENDING = "PENDING",
}

// === Latency Distribution ===

export type LatencyDistribution =
  | { type: "constant"; value: number }
  | { type: "normal"; mean: number; stddev: number }
  | { type: "exponential"; mean: number }
  | { type: "uniform"; min: number; max: number }
  | { type: "lognormal"; mu: number; sigma: number };

// === Core Data Types ===

export interface Message {
  method: string;       // e.g., "GET", "POST", "QUERY", "RESOLVE"
  path: string;         // e.g., "/users", "user:123"
  payload?: unknown;
}

export interface Result {
  status: ResultStatus;
  statusCode: number;   // e.g., 200, 503, 408
  latency: number;      // total latency in ms
  error?: string;
}

export interface Transaction {
  id: string;
  message: Message;
  protocol: Protocol;
  result: Result | null;
  parentTransactionId?: string;
  metadata: Record<string, unknown>;
}

export interface SimEvent {
  id: string;
  timestamp: number;
  type: EventType;
  sourceNodeId: string;
  targetNodeId: string;
  transaction: Transaction | null;
}

// === Connection ===

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  protocol: Protocol;
  latency: LatencyDistribution;
  timeout: number;              // ms before timeout fires
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

// === Node Config (union per type) ===

export interface BaseNodeConfig {
  concurrencyLimit: number;
  maxQueueSize: number;
  processingLatency: LatencyDistribution;
  errorRate: number;            // 0.0 to 1.0
}

export interface ClientConfig extends BaseNodeConfig {
  requestRate: number;
  requestDistribution: { type: string; weight: number }[];
}

export interface DNSConfig extends BaseNodeConfig {
  resolutionLatency: LatencyDistribution;
  ttl: number;
  failureRate: number;
}

export interface CDNConfig extends BaseNodeConfig {
  cacheHitRate: number;
  originFallbackLatency: LatencyDistribution;
  ttl: number;
}

export interface LoadBalancerConfig extends BaseNodeConfig {
  strategy: "round-robin" | "least-connections" | "ip-hash";
  maxConnections: number;
  healthCheckInterval: number;
  healthCheckFailureThreshold: number;
}

export interface WebServerConfig extends BaseNodeConfig {
  // uses base config fields
}

export interface CacheConfig extends BaseNodeConfig {
  capacity: number;
  hitRate: number;
  evictionPolicy: "LRU" | "LFU";
  ttl: number;
  replicationLag?: number;
}

export interface SQLDBConfig extends BaseNodeConfig {
  connectionPoolSize: number;
  queryLatency: LatencyDistribution;
  replicationLag: number;
  maxIOPS: number;
}

export interface NoSQLDBConfig extends BaseNodeConfig {
  partitionCount: number;
  readLatency: LatencyDistribution;
  writeLatency: LatencyDistribution;
  consistencyModel: "eventual" | "strong";
}

export interface MessageQueueConfig extends BaseNodeConfig {
  maxDepth: number;
  consumerThroughput: number;
  deliveryGuarantee: "at-least-once" | "exactly-once";
}

export interface EventStreamConfig extends BaseNodeConfig {
  partitionCount: number;
  consumerGroupLag: number;
  retention: number;
}

export interface ObjectStorageConfig extends BaseNodeConfig {
  readLatency: LatencyDistribution;
  writeLatency: LatencyDistribution;
  throughputLimit: number;
}

export interface SearchIndexConfig extends BaseNodeConfig {
  queryLatency: LatencyDistribution;
  indexingLag: number;
}

export interface APIGatewayConfig extends BaseNodeConfig {
  rateLimit: number;
  authLatency: LatencyDistribution;
}

export type NodeConfig =
  | ClientConfig
  | DNSConfig
  | CDNConfig
  | LoadBalancerConfig
  | WebServerConfig
  | CacheConfig
  | SQLDBConfig
  | NoSQLDBConfig
  | MessageQueueConfig
  | EventStreamConfig
  | ObjectStorageConfig
  | SearchIndexConfig
  | APIGatewayConfig;

// === Node State ===

export interface NodeState {
  queueDepth: number;
  activeConnections: number;
  health: HealthStatus;
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  crashed: boolean;
}

// === Simulation Node ===

export interface SimulationNode {
  id: string;
  type: NodeType;
  label: string;
  config: NodeConfig;
  state: NodeState;
  position: { x: number; y: number };
  connections: string[];   // connection IDs
}

// === Scenario ===

export interface Phase {
  startTime: number;
  duration: number;
  requestRate: number;
  rampUp?: number;
  requestDistribution: { type: string; weight: number }[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  duration: number;
  phases: Phase[];
}

// === Simulation Config (for localStorage persistence) ===

export interface SimulationConfig {
  version: 1;
  name: string;
  nodes: SimulationNode[];
  connections: Connection[];
  scenario: Scenario;
}

// === WebSocket Messages ===

export type ServerMessage =
  | { type: "TRANSACTION"; data: Transaction }
  | { type: "NODE_STATE"; data: { nodeId: string; state: NodeState } }
  | { type: "NODE_HEALTH"; data: { nodeId: string; status: HealthStatus } }
  | { type: "SIM_STATUS"; data: { time: number; speed: number; running: boolean } }
  | { type: "ALERT"; data: { message: string; severity: "info" | "warning" | "critical" } }
  | { type: "BATCH"; data: ServerMessage[] };

export type ClientMessage =
  | { type: "START"; data: { simulationId: string } }
  | { type: "STOP" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SPEED"; data: { multiplier: number } }
  | { type: "UPDATE_CONFIG"; data: { nodeId: string; config: Partial<NodeConfig> } }
  | { type: "INJECT_CHAOS"; data: { chaosType: string; target: string } };
```

- [ ] **Step 2: Create barrel export**

Create `lib/engine/models/index.ts`:

```typescript
export * from "./types";
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit lib/engine/models/types.ts`
Expected: No errors (or use `npx tsc --noEmit` for full project check)

- [ ] **Step 4: Commit**

```bash
git add lib/engine/models/
git commit -m "feat: add core type definitions for simulation engine"
```

---

### Task 3: Event Queue (Min-Heap Priority Queue)

**Files:**
- Create: `lib/engine/event-queue.ts`
- Create: `lib/engine/__tests__/event-queue.test.ts`

- [ ] **Step 1: Write failing tests for EventQueue**

Create `lib/engine/__tests__/event-queue.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { EventQueue } from "../event-queue";
import { EventType, Protocol, ResultStatus } from "../models";

function makeEvent(id: string, timestamp: number) {
  return {
    id,
    timestamp,
    type: EventType.REQUEST_ARRIVE,
    sourceNodeId: "a",
    targetNodeId: "b",
    transaction: null,
  };
}

describe("EventQueue", () => {
  it("returns events in timestamp order", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("3", 30));
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 20));

    expect(q.dequeue()!.id).toBe("1");
    expect(q.dequeue()!.id).toBe("2");
    expect(q.dequeue()!.id).toBe("3");
  });

  it("returns undefined when empty", () => {
    const q = new EventQueue();
    expect(q.dequeue()).toBeUndefined();
  });

  it("reports correct size", () => {
    const q = new EventQueue();
    expect(q.size).toBe(0);
    q.enqueue(makeEvent("1", 10));
    expect(q.size).toBe(1);
    q.dequeue();
    expect(q.size).toBe(0);
  });

  it("peeks without removing", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 5));
    expect(q.peek()!.id).toBe("2");
    expect(q.size).toBe(2);
  });

  it("cancels an event by id", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 20));
    q.cancel("1");
    expect(q.dequeue()!.id).toBe("2");
    expect(q.dequeue()).toBeUndefined();
  });

  it("clears all events", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 20));
    q.clear();
    expect(q.size).toBe(0);
  });

  it("handles many events correctly", () => {
    const q = new EventQueue();
    const timestamps = Array.from({ length: 100 }, () => Math.random() * 1000);
    timestamps.forEach((t, i) => q.enqueue(makeEvent(String(i), t)));

    const sorted = [...timestamps].sort((a, b) => a - b);
    sorted.forEach((t) => {
      expect(q.dequeue()!.timestamp).toBe(t);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/event-queue.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement EventQueue**

Create `lib/engine/event-queue.ts`:

```typescript
import { SimEvent } from "./models";

export class EventQueue {
  private heap: SimEvent[] = [];
  private cancelled = new Set<string>();

  get size(): number {
    return this.heap.length;
  }

  enqueue(event: SimEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): SimEvent | undefined {
    while (this.heap.length > 0) {
      const top = this.heap[0];
      if (this.heap.length === 1) {
        this.heap.pop();
      } else {
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
      }
      if (this.cancelled.has(top.id)) {
        this.cancelled.delete(top.id);
        continue;
      }
      return top;
    }
    return undefined;
  }

  peek(): SimEvent | undefined {
    // Skip cancelled events at the top
    while (this.heap.length > 0 && this.cancelled.has(this.heap[0].id)) {
      this.dequeue(); // discard cancelled
    }
    return this.heap[0];
  }

  cancel(eventId: string): void {
    this.cancelled.add(eventId);
  }

  clear(): void {
    this.heap = [];
    this.cancelled.clear();
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].timestamp <= this.heap[index].timestamp) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.heap[left].timestamp < this.heap[smallest].timestamp) {
        smallest = left;
      }
      if (right < length && this.heap[right].timestamp < this.heap[smallest].timestamp) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/event-queue.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/event-queue.ts lib/engine/__tests__/event-queue.test.ts
git commit -m "feat: implement min-heap event queue with cancel support"
```

---

### Task 4: Latency Distribution Sampler

**Files:**
- Create: `lib/engine/distributions.ts`
- Create: `lib/engine/__tests__/distributions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/distributions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sampleLatency } from "../distributions";

describe("sampleLatency", () => {
  it("returns exact value for constant distribution", () => {
    expect(sampleLatency({ type: "constant", value: 42 })).toBe(42);
  });

  it("returns values within range for uniform distribution", () => {
    for (let i = 0; i < 100; i++) {
      const val = sampleLatency({ type: "uniform", min: 10, max: 20 });
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(20);
    }
  });

  it("returns non-negative values for normal distribution", () => {
    for (let i = 0; i < 100; i++) {
      const val = sampleLatency({ type: "normal", mean: 50, stddev: 10 });
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns non-negative values for exponential distribution", () => {
    for (let i = 0; i < 100; i++) {
      const val = sampleLatency({ type: "exponential", mean: 50 });
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns non-negative values for lognormal distribution", () => {
    for (let i = 0; i < 100; i++) {
      const val = sampleLatency({ type: "lognormal", mu: 3, sigma: 0.5 });
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });

  it("normal distribution mean is approximately correct", () => {
    const samples = Array.from({ length: 10000 }, () =>
      sampleLatency({ type: "normal", mean: 100, stddev: 10 })
    );
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(avg).toBeGreaterThan(95);
    expect(avg).toBeLessThan(105);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/distributions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement sampleLatency**

Create `lib/engine/distributions.ts`:

```typescript
import { LatencyDistribution } from "./models";

/**
 * Box-Muller transform: generates two independent standard normal random variables.
 * We use one and discard the other for simplicity.
 */
function boxMuller(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

export function sampleLatency(dist: LatencyDistribution): number {
  switch (dist.type) {
    case "constant":
      return dist.value;

    case "uniform":
      return dist.min + Math.random() * (dist.max - dist.min);

    case "normal":
      return Math.max(0, dist.mean + dist.stddev * boxMuller());

    case "exponential":
      return Math.max(0, -dist.mean * Math.log(1 - Math.random()));

    case "lognormal":
      return Math.max(0, Math.exp(dist.mu + dist.sigma * boxMuller()));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/distributions.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/distributions.ts lib/engine/__tests__/distributions.test.ts
git commit -m "feat: implement latency distribution sampler (constant, normal, exponential, uniform, lognormal)"
```

---

### Task 5: Metrics Collector (Rolling Window)

**Files:**
- Create: `lib/engine/metrics.ts`
- Create: `lib/engine/__tests__/metrics.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/metrics.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { MetricsCollector } from "../metrics";

describe("MetricsCollector", () => {
  it("records and retrieves request count", () => {
    const m = new MetricsCollector(60000);
    m.recordRequest("node1", 100, 50, false);
    m.recordRequest("node1", 200, 30, false);
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.requestCount).toBe(2);
    expect(snapshot.errorCount).toBe(0);
  });

  it("tracks error count", () => {
    const m = new MetricsCollector(60000);
    m.recordRequest("node1", 100, 50, true);
    m.recordRequest("node1", 200, 30, false);
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.errorCount).toBe(1);
    expect(snapshot.errorRate).toBeCloseTo(0.5);
  });

  it("computes latency percentiles", () => {
    const m = new MetricsCollector(60000);
    // Add 100 requests with latencies 1..100
    for (let i = 1; i <= 100; i++) {
      m.recordRequest("node1", i * 10, i, false);
    }
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.p50).toBeCloseTo(50, 0);
    expect(snapshot.p95).toBeCloseTo(95, 0);
    expect(snapshot.p99).toBeCloseTo(99, 0);
  });

  it("evicts entries outside the window", () => {
    const m = new MetricsCollector(1000); // 1 second window
    m.recordRequest("node1", 100, 50, false);
    m.recordRequest("node1", 1200, 30, false); // outside window of latest
    const snapshot = m.getSnapshot("node1");
    // Only the latest entry (t=1200) is in window relative to latest time
    expect(snapshot.requestCount).toBe(1);
  });

  it("returns zero snapshot for unknown node", () => {
    const m = new MetricsCollector(60000);
    const snapshot = m.getSnapshot("unknown");
    expect(snapshot.requestCount).toBe(0);
    expect(snapshot.errorRate).toBe(0);
  });

  it("clears metrics for a node", () => {
    const m = new MetricsCollector(60000);
    m.recordRequest("node1", 100, 50, false);
    m.clear("node1");
    const snapshot = m.getSnapshot("node1");
    expect(snapshot.requestCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/metrics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MetricsCollector**

Create `lib/engine/metrics.ts`:

```typescript
export interface MetricsSnapshot {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
}

interface MetricEntry {
  timestamp: number;
  latency: number;
  isError: boolean;
}

export class MetricsCollector {
  private data = new Map<string, MetricEntry[]>();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  recordRequest(nodeId: string, timestamp: number, latency: number, isError: boolean): void {
    if (!this.data.has(nodeId)) {
      this.data.set(nodeId, []);
    }
    this.data.get(nodeId)!.push({ timestamp, latency, isError });
  }

  getSnapshot(nodeId: string): MetricsSnapshot {
    const entries = this.data.get(nodeId);
    if (!entries || entries.length === 0) {
      return { requestCount: 0, errorCount: 0, errorRate: 0, avgLatency: 0, p50: 0, p95: 0, p99: 0 };
    }

    // Evict old entries based on the latest timestamp
    const latestTime = entries[entries.length - 1].timestamp;
    const cutoff = latestTime - this.windowMs;
    const inWindow = entries.filter((e) => e.timestamp >= cutoff);
    this.data.set(nodeId, inWindow);

    if (inWindow.length === 0) {
      return { requestCount: 0, errorCount: 0, errorRate: 0, avgLatency: 0, p50: 0, p95: 0, p99: 0 };
    }

    const requestCount = inWindow.length;
    const errorCount = inWindow.filter((e) => e.isError).length;
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
    const latencies = inWindow.map((e) => e.latency).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      requestCount,
      errorCount,
      errorRate,
      avgLatency,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    };
  }

  clear(nodeId: string): void {
    this.data.delete(nodeId);
  }

  clearAll(): void {
    this.data.clear();
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/metrics.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/metrics.ts lib/engine/__tests__/metrics.test.ts
git commit -m "feat: implement rolling-window metrics collector with percentiles"
```

---

## Phase 2: Simulation Engine Core

### Task 6: SimContext Implementation

**Files:**
- Create: `lib/engine/sim-context.ts`
- Create: `lib/engine/__tests__/sim-context.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/sim-context.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SimContextImpl } from "../sim-context";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import {
  SimulationNode, Connection, NodeType, HealthStatus, Protocol, EventType,
} from "../models";

function makeNode(id: string): SimulationNode {
  return {
    id,
    type: NodeType.WEB_SERVER,
    label: id,
    config: {
      concurrencyLimit: 10,
      maxQueueSize: 100,
      processingLatency: { type: "constant", value: 10 },
      errorRate: 0,
    },
    state: {
      queueDepth: 0,
      activeConnections: 0,
      health: HealthStatus.HEALTHY,
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: ["conn1"],
  };
}

function makeConnection(id: string, source: string, target: string): Connection {
  return {
    id,
    sourceNodeId: source,
    targetNodeId: target,
    protocol: Protocol.HTTP,
    latency: { type: "constant", value: 5 },
    timeout: 5000,
  };
}

describe("SimContextImpl", () => {
  it("looks up nodes by ID", () => {
    const nodes = new Map([["n1", makeNode("n1")]]);
    const connections = new Map([["conn1", makeConnection("conn1", "n1", "n2")]]);
    const ctx = new SimContextImpl(0, nodes, connections, new EventQueue(), new MetricsCollector(60000));
    expect(ctx.getNode("n1").id).toBe("n1");
  });

  it("throws for unknown node", () => {
    const ctx = new SimContextImpl(0, new Map(), new Map(), new EventQueue(), new MetricsCollector(60000));
    expect(() => ctx.getNode("missing")).toThrow();
  });

  it("returns outbound connections for a node", () => {
    const nodes = new Map([["n1", makeNode("n1")]]);
    const conn = makeConnection("conn1", "n1", "n2");
    const connections = new Map([["conn1", conn]]);
    const ctx = new SimContextImpl(0, nodes, connections, new EventQueue(), new MetricsCollector(60000));
    expect(ctx.getConnections("n1")).toEqual([conn]);
  });

  it("schedules and cancels events", () => {
    const queue = new EventQueue();
    const ctx = new SimContextImpl(0, new Map(), new Map(), queue, new MetricsCollector(60000));
    const event = {
      id: "e1", timestamp: 100, type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "a", targetNodeId: "b", transaction: null,
    };
    ctx.scheduleEvent(event);
    expect(queue.size).toBe(1);
    ctx.cancelEvent("e1");
    expect(queue.dequeue()).toBeUndefined();
  });

  it("samples latency from a distribution", () => {
    const ctx = new SimContextImpl(0, new Map(), new Map(), new EventQueue(), new MetricsCollector(60000));
    expect(ctx.sampleLatency({ type: "constant", value: 42 })).toBe(42);
  });

  it("generates unique IDs", () => {
    const ctx = new SimContextImpl(0, new Map(), new Map(), new EventQueue(), new MetricsCollector(60000));
    const id1 = ctx.generateId();
    const id2 = ctx.generateId();
    expect(id1).not.toBe(id2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/sim-context.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SimContextImpl**

Create `lib/engine/sim-context.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";
import {
  SimulationNode, Connection, SimEvent, LatencyDistribution,
} from "./models";
import { EventQueue } from "./event-queue";
import { MetricsCollector } from "./metrics";
import { sampleLatency } from "./distributions";

export interface SimContext {
  currentTime: number;
  getNode(nodeId: string): SimulationNode;
  getConnections(nodeId: string): Connection[];
  scheduleEvent(event: SimEvent): void;
  cancelEvent(eventId: string): void;
  sampleLatency(dist: LatencyDistribution): number;
  recordMetric(nodeId: string, timestamp: number, latency: number, isError: boolean): void;
  generateId(): string;
}

export class SimContextImpl implements SimContext {
  currentTime: number;
  private nodes: Map<string, SimulationNode>;
  private connections: Map<string, Connection>;
  private queue: EventQueue;
  private metrics: MetricsCollector;

  constructor(
    currentTime: number,
    nodes: Map<string, SimulationNode>,
    connections: Map<string, Connection>,
    queue: EventQueue,
    metrics: MetricsCollector,
  ) {
    this.currentTime = currentTime;
    this.nodes = nodes;
    this.connections = connections;
    this.queue = queue;
    this.metrics = metrics;
  }

  getNode(nodeId: string): SimulationNode {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);
    return node;
  }

  getConnections(nodeId: string): Connection[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.connections
      .map((cid) => this.connections.get(cid))
      .filter((c): c is Connection => c !== undefined);
  }

  scheduleEvent(event: SimEvent): void {
    this.queue.enqueue(event);
  }

  cancelEvent(eventId: string): void {
    this.queue.cancel(eventId);
  }

  sampleLatency(dist: LatencyDistribution): number {
    return sampleLatency(dist);
  }

  recordMetric(nodeId: string, timestamp: number, latency: number, isError: boolean): void {
    this.metrics.recordRequest(nodeId, timestamp, latency, isError);
  }

  generateId(): string {
    return uuidv4();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/sim-context.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/sim-context.ts lib/engine/__tests__/sim-context.test.ts
git commit -m "feat: implement SimContext with node lookup, event scheduling, and metrics"
```

---

### Task 7: Node Handler Interface & Handler Registry

**Files:**
- Create: `lib/engine/handlers/handler.ts`
- Create: `lib/engine/handlers/registry.ts`
- Create: `lib/engine/handlers/index.ts`

- [ ] **Step 1: Create the NodeHandler interface**

Create `lib/engine/handlers/handler.ts`:

```typescript
import { SimulationNode, SimEvent } from "../models";
import { SimContext } from "../sim-context";

export interface NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[];
}
```

- [ ] **Step 2: Create the handler registry**

Create `lib/engine/handlers/registry.ts`:

```typescript
import { NodeType } from "../models";
import { NodeHandler } from "./handler";

const handlers = new Map<NodeType, NodeHandler>();

export function registerHandler(type: NodeType, handler: NodeHandler): void {
  handlers.set(type, handler);
}

export function getHandler(type: NodeType): NodeHandler {
  const handler = handlers.get(type);
  if (!handler) throw new Error(`No handler registered for node type: ${type}`);
  return handler;
}
```

- [ ] **Step 3: Create barrel export**

Create `lib/engine/handlers/index.ts`:

```typescript
export { NodeHandler } from "./handler";
export { registerHandler, getHandler } from "./registry";
```

- [ ] **Step 4: Commit**

```bash
git add lib/engine/handlers/
git commit -m "feat: add NodeHandler interface and handler registry"
```

---

### Task 8: Engine Main Loop

**Files:**
- Create: `lib/engine/engine.ts`
- Create: `lib/engine/__tests__/engine.test.ts`

- [ ] **Step 1: Write failing tests for Engine**

Create `lib/engine/__tests__/engine.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Engine } from "../engine";
import {
  SimulationNode, Connection, Scenario, NodeType, HealthStatus,
  Protocol, EventType, SimEvent,
} from "../models";
import { registerHandler } from "../handlers";

function makeClientNode(): SimulationNode {
  return {
    id: "client1",
    type: NodeType.CLIENT,
    label: "Client",
    config: {
      concurrencyLimit: 100,
      maxQueueSize: 1000,
      processingLatency: { type: "constant", value: 0 },
      errorRate: 0,
      requestRate: 1,
      requestDistribution: [{ type: "GET /users", weight: 1 }],
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: ["conn1"],
  };
}

function makeServerNode(): SimulationNode {
  return {
    id: "server1",
    type: NodeType.WEB_SERVER,
    label: "Server",
    config: {
      concurrencyLimit: 10,
      maxQueueSize: 100,
      processingLatency: { type: "constant", value: 10 },
      errorRate: 0,
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 200, y: 0 },
    connections: [],
  };
}

function makeConnection(): Connection {
  return {
    id: "conn1",
    sourceNodeId: "client1",
    targetNodeId: "server1",
    protocol: Protocol.HTTP,
    latency: { type: "constant", value: 5 },
    timeout: 5000,
  };
}

function makeScenario(): Scenario {
  return {
    id: "test",
    name: "Test",
    description: "Test scenario",
    duration: 1,
    phases: [{
      startTime: 0,
      duration: 1,
      requestRate: 1,
      requestDistribution: [{ type: "GET /users", weight: 1 }],
    }],
  };
}

describe("Engine", () => {
  it("initializes with nodes and connections", () => {
    const engine = new Engine(
      [makeClientNode(), makeServerNode()],
      [makeConnection()],
      makeScenario(),
    );
    expect(engine).toBeDefined();
  });

  it("processes events and calls handlers", () => {
    const handlerSpy = vi.fn().mockReturnValue([]);
    registerHandler(NodeType.WEB_SERVER, { onEvent: handlerSpy });

    const engine = new Engine(
      [makeClientNode(), makeServerNode()],
      [makeConnection()],
      makeScenario(),
    );

    // Manually inject an event
    engine.injectEvent({
      id: "test-event",
      timestamp: 0,
      type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "client1",
      targetNodeId: "server1",
      transaction: {
        id: "tx1",
        message: { method: "GET", path: "/users" },
        protocol: Protocol.HTTP,
        result: null,
        metadata: {},
      },
    });

    const processed = engine.step();
    expect(processed).toBe(true);
    expect(handlerSpy).toHaveBeenCalledOnce();
  });

  it("returns false when no events remain", () => {
    registerHandler(NodeType.WEB_SERVER, { onEvent: () => [] });
    const engine = new Engine(
      [makeServerNode()],
      [],
      makeScenario(),
    );
    expect(engine.step()).toBe(false);
  });

  it("collects transactions from processed events", () => {
    registerHandler(NodeType.WEB_SERVER, { onEvent: () => [] });
    const engine = new Engine(
      [makeClientNode(), makeServerNode()],
      [makeConnection()],
      makeScenario(),
    );

    engine.injectEvent({
      id: "e1",
      timestamp: 0,
      type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "client1",
      targetNodeId: "server1",
      transaction: {
        id: "tx1",
        message: { method: "GET", path: "/users" },
        protocol: Protocol.HTTP,
        result: null,
        metadata: {},
      },
    });

    engine.step();
    const txns = engine.flushTransactions();
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("tx1");

    // Second flush should be empty
    expect(engine.flushTransactions()).toHaveLength(0);
  });

  it("advances simulated time", () => {
    registerHandler(NodeType.WEB_SERVER, { onEvent: () => [] });
    const engine = new Engine(
      [makeClientNode(), makeServerNode()],
      [makeConnection()],
      makeScenario(),
    );

    engine.injectEvent({
      id: "e1",
      timestamp: 500,
      type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "client1",
      targetNodeId: "server1",
      transaction: null,
    });

    engine.step();
    expect(engine.currentTime).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Engine**

Create `lib/engine/engine.ts`:

```typescript
import {
  SimulationNode, Connection, Scenario, SimEvent, Transaction,
} from "./models";
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

  constructor(
    nodes: SimulationNode[],
    connections: Connection[],
    scenario: Scenario,
  ) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.connections = new Map(connections.map((c) => [c.id, c]));
    this.scenario = scenario;
    this.queue = new EventQueue();
    this.metrics = new MetricsCollector(60000);
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get running(): boolean {
    return this._running;
  }

  get speed(): number {
    return this._speed;
  }

  set speed(value: number) {
    this._speed = value;
  }

  get eventQueueSize(): number {
    return this.queue.size;
  }

  injectEvent(event: SimEvent): void {
    this.queue.enqueue(event);
  }

  /**
   * Process the next event in the queue.
   * Returns true if an event was processed, false if queue is empty.
   */
  step(): boolean {
    const event = this.queue.dequeue();
    if (!event) return false;

    this._currentTime = event.timestamp;

    const targetNode = this.nodes.get(event.targetNodeId);
    if (!targetNode) return true; // skip events targeting removed nodes

    // Skip processing if node is crashed (unless it's a FAILURE event to un-crash)
    if (targetNode.state.crashed && event.type !== "FAILURE") {
      return true;
    }

    const context = new SimContextImpl(
      this._currentTime,
      this.nodes,
      this.connections,
      this.queue,
      this.metrics,
    );

    try {
      const handler = getHandler(targetNode.type);
      const newEvents = handler.onEvent(targetNode, event, context);
      for (const e of newEvents) {
        this.queue.enqueue(e);
      }
    } catch {
      // If no handler registered, silently skip
    }

    // Buffer transaction for streaming
    if (event.transaction) {
      this.transactionBuffer.push(event.transaction);
    }

    return true;
  }

  /**
   * Flush buffered transactions (for WebSocket streaming).
   */
  flushTransactions(): Transaction[] {
    const txns = this.transactionBuffer;
    this.transactionBuffer = [];
    return txns;
  }

  /**
   * Get a snapshot of all node states.
   */
  getNodeStates(): Map<string, SimulationNode> {
    return this.nodes;
  }

  /**
   * Get metrics snapshot for a node.
   */
  getMetricsSnapshot(nodeId: string) {
    return this.metrics.getSnapshot(nodeId);
  }

  /**
   * Update a node's config at runtime.
   */
  updateNodeConfig(nodeId: string, config: Partial<SimulationNode["config"]>): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.config = { ...node.config, ...config } as SimulationNode["config"];
    }
  }

  /**
   * Clear the event queue and reset state.
   */
  reset(): void {
    this.queue.clear();
    this.metrics.clearAll();
    this.transactionBuffer = [];
    this._currentTime = 0;
    this._running = false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/engine.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/engine.ts lib/engine/__tests__/engine.test.ts
git commit -m "feat: implement core DES engine with step-based event processing"
```

---

### Task 9: Client Handler (Traffic Generator)

**Files:**
- Create: `lib/engine/handlers/client-handler.ts`
- Create: `lib/engine/__tests__/client-handler.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/client-handler.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ClientHandler } from "../handlers/client-handler";
import {
  SimulationNode, NodeType, HealthStatus, EventType, Protocol, ClientConfig,
} from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeClientNode(overrides?: Partial<ClientConfig>): SimulationNode {
  return {
    id: "client1",
    type: NodeType.CLIENT,
    label: "Client",
    config: {
      concurrencyLimit: 100,
      maxQueueSize: 1000,
      processingLatency: { type: "constant", value: 0 },
      errorRate: 0,
      requestRate: 10,
      requestDistribution: [{ type: "GET /users", weight: 1 }],
      ...overrides,
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: ["conn1"],
  };
}

function makeContext(currentTime: number, nodes: Map<string, SimulationNode>) {
  const conn = {
    id: "conn1",
    sourceNodeId: "client1",
    targetNodeId: "server1",
    protocol: Protocol.HTTP as const,
    latency: { type: "constant" as const, value: 5 },
    timeout: 5000,
  };
  return new SimContextImpl(
    currentTime,
    nodes,
    new Map([["conn1", conn]]),
    new EventQueue(),
    new MetricsCollector(60000),
  );
}

describe("ClientHandler", () => {
  const handler = new ClientHandler();

  it("generates a REQUEST_ARRIVE event on the first connection target", () => {
    const node = makeClientNode();
    const ctx = makeContext(0, new Map([["client1", node]]));

    const triggerEvent = {
      id: "trigger",
      timestamp: 0,
      type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "client1",
      targetNodeId: "client1",
      transaction: null,
    };

    const events = handler.onEvent(node, triggerEvent, ctx);
    expect(events.length).toBeGreaterThanOrEqual(1);

    const requestEvent = events.find((e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "server1");
    expect(requestEvent).toBeDefined();
    expect(requestEvent!.timestamp).toBe(5); // 0 + constant latency 5
    expect(requestEvent!.transaction).not.toBeNull();
    expect(requestEvent!.transaction!.protocol).toBe(Protocol.HTTP);
  });

  it("schedules the next self-trigger based on request rate", () => {
    const node = makeClientNode({ requestRate: 10 }); // 10 rps = 100ms interval
    const ctx = makeContext(0, new Map([["client1", node]]));

    const triggerEvent = {
      id: "trigger",
      timestamp: 0,
      type: EventType.REQUEST_ARRIVE,
      sourceNodeId: "client1",
      targetNodeId: "client1",
      transaction: null,
    };

    const events = handler.onEvent(node, triggerEvent, ctx);
    const selfTrigger = events.find(
      (e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "client1"
    );
    expect(selfTrigger).toBeDefined();
    expect(selfTrigger!.timestamp).toBe(100); // 1000ms / 10rps = 100ms
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/client-handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ClientHandler**

Create `lib/engine/handlers/client-handler.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";
import { NodeHandler } from "./handler";
import {
  SimulationNode, SimEvent, EventType, Protocol, ClientConfig,
} from "../models";
import { SimContext } from "../sim-context";

export class ClientHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as ClientConfig;
    const events: SimEvent[] = [];

    if (event.type !== EventType.REQUEST_ARRIVE) return events;

    // Pick a request type based on weighted distribution
    const requestType = this.pickRequestType(config.requestDistribution);
    const [method, path] = requestType.split(" ", 2);

    // Send request to the first outbound connection
    const connections = context.getConnections(node.id);
    if (connections.length > 0) {
      const conn = connections[0];
      const latency = context.sampleLatency(conn.latency);
      const txId = context.generateId();

      events.push({
        id: context.generateId(),
        timestamp: context.currentTime + latency,
        type: EventType.REQUEST_ARRIVE,
        sourceNodeId: node.id,
        targetNodeId: conn.targetNodeId,
        transaction: {
          id: txId,
          message: { method: method || "GET", path: path || "/" },
          protocol: conn.protocol,
          result: null,
          metadata: {},
        },
      });
    }

    // Schedule next self-trigger based on request rate
    if (config.requestRate > 0) {
      const intervalMs = 1000 / config.requestRate;
      events.push({
        id: context.generateId(),
        timestamp: context.currentTime + intervalMs,
        type: EventType.REQUEST_ARRIVE,
        sourceNodeId: node.id,
        targetNodeId: node.id,
        transaction: null,
      });
    }

    node.state.requestCount++;
    return events;
  }

  private pickRequestType(distribution: { type: string; weight: number }[]): string {
    const totalWeight = distribution.reduce((sum, d) => sum + d.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const d of distribution) {
      rand -= d.weight;
      if (rand <= 0) return d.type;
    }
    return distribution[distribution.length - 1]?.type ?? "GET /";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/client-handler.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/handlers/client-handler.ts lib/engine/__tests__/client-handler.test.ts
git commit -m "feat: implement ClientHandler for traffic generation"
```

---

### Task 10: Web Server Handler (Request Processing + Queuing)

**Files:**
- Create: `lib/engine/handlers/web-server-handler.ts`
- Create: `lib/engine/__tests__/web-server-handler.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/web-server-handler.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { WebServerHandler } from "../handlers/web-server-handler";
import {
  SimulationNode, NodeType, HealthStatus, EventType, Protocol, WebServerConfig,
} from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeServerNode(overrides?: Partial<WebServerConfig>): SimulationNode {
  return {
    id: "server1",
    type: NodeType.WEB_SERVER,
    label: "Server",
    config: {
      concurrencyLimit: 2,
      maxQueueSize: 5,
      processingLatency: { type: "constant", value: 10 },
      errorRate: 0,
      ...overrides,
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: [],
  };
}

function makeContext(currentTime: number, node: SimulationNode) {
  return new SimContextImpl(
    currentTime,
    new Map([[node.id, node]]),
    new Map(),
    new EventQueue(),
    new MetricsCollector(60000),
  );
}

function makeRequestEvent(targetNodeId: string, timestamp = 0) {
  return {
    id: "req1",
    timestamp,
    type: EventType.REQUEST_ARRIVE as const,
    sourceNodeId: "client1",
    targetNodeId,
    transaction: {
      id: "tx1",
      message: { method: "GET", path: "/users" },
      protocol: Protocol.HTTP,
      result: null,
      metadata: {},
    },
  };
}

describe("WebServerHandler", () => {
  const handler = new WebServerHandler();

  it("processes request and enqueues PROCESS_COMPLETE", () => {
    const node = makeServerNode();
    const ctx = makeContext(0, node);
    const events = handler.onEvent(node, makeRequestEvent("server1"), ctx);

    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete).toBeDefined();
    expect(complete!.timestamp).toBe(10); // constant 10ms processing
    expect(node.state.activeConnections).toBe(1);
  });

  it("returns RESPONSE on PROCESS_COMPLETE", () => {
    const node = makeServerNode();
    node.state.activeConnections = 1;
    const ctx = makeContext(10, node);

    const completeEvent = {
      id: "pc1",
      timestamp: 10,
      type: EventType.PROCESS_COMPLETE,
      sourceNodeId: "server1",
      targetNodeId: "server1",
      transaction: {
        id: "tx1",
        message: { method: "GET", path: "/users" },
        protocol: Protocol.HTTP,
        result: null,
        metadata: { replyTo: "client1" },
      },
    };

    const events = handler.onEvent(node, completeEvent, ctx);
    const response = events.find((e) => e.type === EventType.RESPONSE);
    expect(response).toBeDefined();
    expect(response!.transaction!.result!.status).toBe("SUCCESS");
    expect(node.state.activeConnections).toBe(0);
  });

  it("rejects with 503 when queue is full and concurrency maxed", () => {
    const node = makeServerNode({ concurrencyLimit: 1, maxQueueSize: 0 });
    node.state.activeConnections = 1; // at capacity
    const ctx = makeContext(0, node);

    const events = handler.onEvent(node, makeRequestEvent("server1"), ctx);
    const response = events.find((e) => e.type === EventType.RESPONSE);
    expect(response).toBeDefined();
    expect(response!.transaction!.result!.statusCode).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/web-server-handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement WebServerHandler**

Create `lib/engine/handlers/web-server-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import {
  SimulationNode, SimEvent, EventType, ResultStatus, BaseNodeConfig,
} from "../models";
import { SimContext } from "../sim-context";

export class WebServerHandler implements NodeHandler {
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as BaseNodeConfig;

    switch (event.type) {
      case EventType.REQUEST_ARRIVE:
        return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE:
        return this.handleProcessComplete(node, event, context);
      default:
        return [];
    }
  }

  private handleRequest(
    node: SimulationNode,
    event: SimEvent,
    context: SimContext,
    config: BaseNodeConfig,
  ): SimEvent[] {
    // Check if we have capacity
    if (node.state.activeConnections < config.concurrencyLimit) {
      return this.startProcessing(node, event, context, config);
    }

    // Try to queue
    const queue = this.getQueue(node.id);
    if (queue.length < config.maxQueueSize) {
      queue.push(event);
      node.state.queueDepth = queue.length;
      return [];
    }

    // Reject: at capacity and queue full
    node.state.errorCount++;
    return [{
      id: context.generateId(),
      timestamp: context.currentTime,
      type: EventType.RESPONSE,
      sourceNodeId: node.id,
      targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? {
        ...event.transaction,
        result: {
          status: ResultStatus.FAILURE,
          statusCode: 503,
          latency: 0,
          error: "Service unavailable: queue full",
        },
      } : null,
    }];
  }

  private startProcessing(
    node: SimulationNode,
    event: SimEvent,
    context: SimContext,
    config: BaseNodeConfig,
  ): SimEvent[] {
    node.state.activeConnections++;
    node.state.requestCount++;

    const processingTime = context.sampleLatency(config.processingLatency);

    // Tag the transaction with replyTo so we know where to send the response
    const transaction = event.transaction ? {
      ...event.transaction,
      metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId },
    } : null;

    return [{
      id: context.generateId(),
      timestamp: context.currentTime + processingTime,
      type: EventType.PROCESS_COMPLETE,
      sourceNodeId: node.id,
      targetNodeId: node.id,
      transaction,
    }];
  }

  private handleProcessComplete(
    node: SimulationNode,
    event: SimEvent,
    context: SimContext,
  ): SimEvent[] {
    const config = node.config as BaseNodeConfig;
    node.state.activeConnections--;
    const events: SimEvent[] = [];

    // Determine success or error based on error rate
    const isError = Math.random() < config.errorRate;
    const replyTo = event.transaction?.metadata?.replyTo as string | undefined;

    if (replyTo) {
      events.push({
        id: context.generateId(),
        timestamp: context.currentTime,
        type: EventType.RESPONSE,
        sourceNodeId: node.id,
        targetNodeId: replyTo,
        transaction: event.transaction ? {
          ...event.transaction,
          result: {
            status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS,
            statusCode: isError ? 500 : 200,
            latency: context.currentTime - (event.transaction.metadata.arrivalTime as number || 0),
          },
        } : null,
      });
    }

    if (isError) node.state.errorCount++;

    // Process next queued request if any
    const queue = this.getQueue(node.id);
    if (queue.length > 0) {
      const next = queue.shift()!;
      node.state.queueDepth = queue.length;
      events.push(...this.startProcessing(node, next, context, config));
    }

    return events;
  }

  private getQueue(nodeId: string): SimEvent[] {
    if (!this.queues.has(nodeId)) {
      this.queues.set(nodeId, []);
    }
    return this.queues.get(nodeId)!;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/web-server-handler.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/handlers/web-server-handler.ts lib/engine/__tests__/web-server-handler.test.ts
git commit -m "feat: implement WebServerHandler with concurrency limits and queuing"
```

---

### Task 11: Load Balancer Handler

**Files:**
- Create: `lib/engine/handlers/load-balancer-handler.ts`
- Create: `lib/engine/__tests__/load-balancer-handler.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/load-balancer-handler.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { LoadBalancerHandler } from "../handlers/load-balancer-handler";
import {
  SimulationNode, Connection, NodeType, HealthStatus, EventType, Protocol,
  LoadBalancerConfig,
} from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeLBNode(strategy: LoadBalancerConfig["strategy"] = "round-robin"): SimulationNode {
  return {
    id: "lb1",
    type: NodeType.LOAD_BALANCER,
    label: "LB",
    config: {
      concurrencyLimit: 1000,
      maxQueueSize: 5000,
      processingLatency: { type: "constant", value: 1 },
      errorRate: 0,
      strategy,
      maxConnections: 1000,
      healthCheckInterval: 5000,
      healthCheckFailureThreshold: 3,
    },
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: ["conn1", "conn2"],
  };
}

function makeBackendNode(id: string, health = HealthStatus.HEALTHY): SimulationNode {
  return {
    id,
    type: NodeType.WEB_SERVER,
    label: id,
    config: {
      concurrencyLimit: 10,
      maxQueueSize: 100,
      processingLatency: { type: "constant", value: 10 },
      errorRate: 0,
    },
    state: {
      queueDepth: 0, activeConnections: 0, health,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 200, y: 0 },
    connections: [],
  };
}

function makeContext(
  lbNode: SimulationNode,
  backends: SimulationNode[],
  connections: Connection[],
) {
  const allNodes = new Map<string, SimulationNode>();
  allNodes.set(lbNode.id, lbNode);
  for (const b of backends) allNodes.set(b.id, b);
  return new SimContextImpl(
    0,
    allNodes,
    new Map(connections.map((c) => [c.id, c])),
    new EventQueue(),
    new MetricsCollector(60000),
  );
}

function makeConnections(): Connection[] {
  return [
    {
      id: "conn1", sourceNodeId: "lb1", targetNodeId: "srv1",
      protocol: Protocol.HTTP, latency: { type: "constant", value: 2 }, timeout: 5000,
    },
    {
      id: "conn2", sourceNodeId: "lb1", targetNodeId: "srv2",
      protocol: Protocol.HTTP, latency: { type: "constant", value: 2 }, timeout: 5000,
    },
  ];
}

function makeRequest() {
  return {
    id: "req1",
    timestamp: 0,
    type: EventType.REQUEST_ARRIVE as const,
    sourceNodeId: "client1",
    targetNodeId: "lb1",
    transaction: {
      id: "tx1",
      message: { method: "GET", path: "/users" },
      protocol: Protocol.HTTP,
      result: null,
      metadata: {},
    },
  };
}

describe("LoadBalancerHandler", () => {
  it("round-robin distributes across backends", () => {
    const handler = new LoadBalancerHandler();
    const lb = makeLBNode("round-robin");
    const srv1 = makeBackendNode("srv1");
    const srv2 = makeBackendNode("srv2");
    const conns = makeConnections();

    const ctx1 = makeContext(lb, [srv1, srv2], conns);
    const events1 = handler.onEvent(lb, makeRequest(), ctx1);
    const target1 = events1.find((e) => e.type === EventType.REQUEST_ARRIVE)?.targetNodeId;

    const ctx2 = makeContext(lb, [srv1, srv2], conns);
    const events2 = handler.onEvent(lb, { ...makeRequest(), id: "req2" }, ctx2);
    const target2 = events2.find((e) => e.type === EventType.REQUEST_ARRIVE)?.targetNodeId;

    expect(target1).not.toBe(target2);
  });

  it("returns 503 when all backends are unhealthy", () => {
    const handler = new LoadBalancerHandler();
    const lb = makeLBNode();
    const srv1 = makeBackendNode("srv1", HealthStatus.UNHEALTHY);
    const srv2 = makeBackendNode("srv2", HealthStatus.UNHEALTHY);
    const conns = makeConnections();
    const ctx = makeContext(lb, [srv1, srv2], conns);

    const events = handler.onEvent(lb, makeRequest(), ctx);
    const response = events.find((e) => e.type === EventType.RESPONSE);
    expect(response).toBeDefined();
    expect(response!.transaction!.result!.statusCode).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/load-balancer-handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LoadBalancerHandler**

Create `lib/engine/handlers/load-balancer-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import {
  SimulationNode, SimEvent, EventType, ResultStatus, LoadBalancerConfig, Connection,
} from "../models";
import { SimContext } from "../sim-context";

export class LoadBalancerHandler implements NodeHandler {
  private roundRobinIndex = new Map<string, number>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];

    const config = node.config as LoadBalancerConfig;
    const connections = context.getConnections(node.id);

    // Filter to healthy backends
    const healthy = connections.filter((conn) => {
      try {
        const backend = context.getNode(conn.targetNodeId);
        return backend.state.health !== "UNHEALTHY" && !backend.state.crashed;
      } catch {
        return false;
      }
    });

    if (healthy.length === 0) {
      node.state.errorCount++;
      return [{
        id: context.generateId(),
        timestamp: context.currentTime,
        type: EventType.RESPONSE,
        sourceNodeId: node.id,
        targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? {
          ...event.transaction,
          result: {
            status: ResultStatus.FAILURE,
            statusCode: 503,
            latency: 0,
            error: "No healthy backends available",
          },
        } : null,
      }];
    }

    const chosen = this.pickBackend(node.id, config.strategy, healthy, context);
    const latency = context.sampleLatency(chosen.latency);

    node.state.requestCount++;
    return [{
      id: context.generateId(),
      timestamp: context.currentTime + latency,
      type: EventType.REQUEST_ARRIVE,
      sourceNodeId: node.id,
      targetNodeId: chosen.targetNodeId,
      transaction: event.transaction ? {
        ...event.transaction,
        metadata: {
          ...event.transaction.metadata,
          replyTo: event.sourceNodeId,
          lbNodeId: node.id,
        },
      } : null,
    }];
  }

  private pickBackend(
    nodeId: string,
    strategy: LoadBalancerConfig["strategy"],
    connections: Connection[],
    context: SimContext,
  ): Connection {
    switch (strategy) {
      case "round-robin": {
        const idx = this.roundRobinIndex.get(nodeId) ?? 0;
        const chosen = connections[idx % connections.length];
        this.roundRobinIndex.set(nodeId, idx + 1);
        return chosen;
      }
      case "least-connections": {
        let minConn = connections[0];
        let minCount = Infinity;
        for (const conn of connections) {
          try {
            const backend = context.getNode(conn.targetNodeId);
            if (backend.state.activeConnections < minCount) {
              minCount = backend.state.activeConnections;
              minConn = conn;
            }
          } catch {
            continue;
          }
        }
        return minConn;
      }
      case "ip-hash": {
        // Simple hash based on source in the transaction
        const hash = nodeId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        return connections[hash % connections.length];
      }
      default:
        return connections[0];
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/load-balancer-handler.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/handlers/load-balancer-handler.ts lib/engine/__tests__/load-balancer-handler.test.ts
git commit -m "feat: implement LoadBalancerHandler with round-robin, least-conn, ip-hash"
```

---

### Task 12: Cache Handler

**Files:**
- Create: `lib/engine/handlers/cache-handler.ts`
- Create: `lib/engine/__tests__/cache-handler.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/cache-handler.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { CacheHandler } from "../handlers/cache-handler";
import {
  SimulationNode, NodeType, HealthStatus, EventType, Protocol, CacheConfig,
} from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeCacheNode(hitRate = 0.8): SimulationNode {
  return {
    id: "cache1",
    type: NodeType.DISTRIBUTED_CACHE,
    label: "Cache",
    config: {
      concurrencyLimit: 1000,
      maxQueueSize: 5000,
      processingLatency: { type: "constant", value: 1 },
      errorRate: 0,
      capacity: 10000,
      hitRate,
      evictionPolicy: "LRU",
      ttl: 300000,
      replicationLag: 0,
    } as CacheConfig,
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: [],
  };
}

function makeContext(node: SimulationNode) {
  return new SimContextImpl(
    0,
    new Map([[node.id, node]]),
    new Map(),
    new EventQueue(),
    new MetricsCollector(60000),
  );
}

function makeRequest() {
  return {
    id: "req1",
    timestamp: 0,
    type: EventType.REQUEST_ARRIVE as const,
    sourceNodeId: "server1",
    targetNodeId: "cache1",
    transaction: {
      id: "tx1",
      message: { method: "GET", path: "user:123" },
      protocol: Protocol.TCP,
      result: null,
      metadata: {},
    },
  };
}

describe("CacheHandler", () => {
  it("returns CACHE_HIT with 100% hit rate", () => {
    const handler = new CacheHandler();
    const node = makeCacheNode(1.0);
    const ctx = makeContext(node);
    const events = handler.onEvent(node, makeRequest(), ctx);
    const hit = events.find((e) => e.type === EventType.CACHE_HIT);
    expect(hit).toBeDefined();
    expect(hit!.transaction!.result!.status).toBe("SUCCESS");
  });

  it("returns CACHE_MISS with 0% hit rate", () => {
    const handler = new CacheHandler();
    const node = makeCacheNode(0.0);
    const ctx = makeContext(node);
    const events = handler.onEvent(node, makeRequest(), ctx);
    const miss = events.find((e) => e.type === EventType.CACHE_MISS);
    expect(miss).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/cache-handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CacheHandler**

Create `lib/engine/handlers/cache-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import {
  SimulationNode, SimEvent, EventType, ResultStatus, CacheConfig,
} from "../models";
import { SimContext } from "../sim-context";

export class CacheHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];

    const config = node.config as CacheConfig;
    node.state.requestCount++;

    const processingTime = context.sampleLatency(config.processingLatency);
    const isHit = Math.random() < config.hitRate;

    if (isHit) {
      return [{
        id: context.generateId(),
        timestamp: context.currentTime + processingTime,
        type: EventType.CACHE_HIT,
        sourceNodeId: node.id,
        targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? {
          ...event.transaction,
          result: {
            status: ResultStatus.SUCCESS,
            statusCode: 200,
            latency: processingTime,
          },
        } : null,
      }];
    }

    return [{
      id: context.generateId(),
      timestamp: context.currentTime + processingTime,
      type: EventType.CACHE_MISS,
      sourceNodeId: node.id,
      targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? {
        ...event.transaction,
        result: {
          status: ResultStatus.FAILURE,
          statusCode: 404,
          latency: processingTime,
          error: "Cache miss",
        },
      } : null,
    }];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/cache-handler.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/handlers/cache-handler.ts lib/engine/__tests__/cache-handler.test.ts
git commit -m "feat: implement CacheHandler with configurable hit rate"
```

---

### Task 13: SQL Database Handler

**Files:**
- Create: `lib/engine/handlers/sql-db-handler.ts`
- Create: `lib/engine/__tests__/sql-db-handler.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/sql-db-handler.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SQLDBHandler } from "../handlers/sql-db-handler";
import {
  SimulationNode, NodeType, HealthStatus, EventType, Protocol, SQLDBConfig,
} from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

function makeDBNode(poolSize = 5): SimulationNode {
  return {
    id: "db1",
    type: NodeType.SQL_DB,
    label: "PostgreSQL",
    config: {
      concurrencyLimit: poolSize,
      maxQueueSize: 50,
      processingLatency: { type: "constant", value: 0 },
      errorRate: 0,
      connectionPoolSize: poolSize,
      queryLatency: { type: "constant", value: 20 },
      replicationLag: 0,
      maxIOPS: 10000,
    } as SQLDBConfig,
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: [],
  };
}

function makeContext(node: SimulationNode) {
  return new SimContextImpl(
    0,
    new Map([[node.id, node]]),
    new Map(),
    new EventQueue(),
    new MetricsCollector(60000),
  );
}

function makeRequest() {
  return {
    id: "req1",
    timestamp: 0,
    type: EventType.REQUEST_ARRIVE as const,
    sourceNodeId: "server1",
    targetNodeId: "db1",
    transaction: {
      id: "tx1",
      message: { method: "QUERY", path: "SELECT * FROM users WHERE id=1" },
      protocol: Protocol.TCP,
      result: null,
      metadata: {},
    },
  };
}

describe("SQLDBHandler", () => {
  it("processes query and returns RESPONSE with latency", () => {
    const handler = new SQLDBHandler();
    const node = makeDBNode();
    const ctx = makeContext(node);
    const events = handler.onEvent(node, makeRequest(), ctx);

    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete).toBeDefined();
    expect(complete!.timestamp).toBe(20); // constant 20ms query latency
    expect(node.state.activeConnections).toBe(1);
  });

  it("rejects when connection pool is exhausted", () => {
    const handler = new SQLDBHandler();
    const node = makeDBNode(1);
    node.state.activeConnections = 1; // pool full
    const ctx = makeContext(node);

    // Queue should accept it since maxQueueSize > 0
    const events = handler.onEvent(node, makeRequest(), ctx);
    // Should be queued (no events returned)
    expect(events).toHaveLength(0);
    expect(node.state.queueDepth).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/sql-db-handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SQLDBHandler**

Create `lib/engine/handlers/sql-db-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import {
  SimulationNode, SimEvent, EventType, ResultStatus, SQLDBConfig,
} from "../models";
import { SimContext } from "../sim-context";

export class SQLDBHandler implements NodeHandler {
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as SQLDBConfig;

    switch (event.type) {
      case EventType.REQUEST_ARRIVE:
        return this.handleRequest(node, event, context, config);
      case EventType.PROCESS_COMPLETE:
        return this.handleComplete(node, event, context, config);
      default:
        return [];
    }
  }

  private handleRequest(
    node: SimulationNode,
    event: SimEvent,
    context: SimContext,
    config: SQLDBConfig,
  ): SimEvent[] {
    if (node.state.activeConnections < config.connectionPoolSize) {
      return this.startQuery(node, event, context, config);
    }

    const queue = this.getQueue(node.id);
    if (queue.length < config.maxQueueSize) {
      queue.push(event);
      node.state.queueDepth = queue.length;
      return [];
    }

    node.state.errorCount++;
    return [{
      id: context.generateId(),
      timestamp: context.currentTime,
      type: EventType.RESPONSE,
      sourceNodeId: node.id,
      targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? {
        ...event.transaction,
        result: {
          status: ResultStatus.FAILURE,
          statusCode: 503,
          latency: 0,
          error: "Connection pool exhausted",
        },
      } : null,
    }];
  }

  private startQuery(
    node: SimulationNode,
    event: SimEvent,
    context: SimContext,
    config: SQLDBConfig,
  ): SimEvent[] {
    node.state.activeConnections++;
    node.state.requestCount++;

    const queryTime = context.sampleLatency(config.queryLatency);

    return [{
      id: context.generateId(),
      timestamp: context.currentTime + queryTime,
      type: EventType.PROCESS_COMPLETE,
      sourceNodeId: node.id,
      targetNodeId: node.id,
      transaction: event.transaction ? {
        ...event.transaction,
        metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId },
      } : null,
    }];
  }

  private handleComplete(
    node: SimulationNode,
    event: SimEvent,
    context: SimContext,
    config: SQLDBConfig,
  ): SimEvent[] {
    node.state.activeConnections--;
    const events: SimEvent[] = [];

    const isError = Math.random() < config.errorRate;
    const replyTo = event.transaction?.metadata?.replyTo as string | undefined;

    if (replyTo) {
      events.push({
        id: context.generateId(),
        timestamp: context.currentTime,
        type: EventType.RESPONSE,
        sourceNodeId: node.id,
        targetNodeId: replyTo,
        transaction: event.transaction ? {
          ...event.transaction,
          result: {
            status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS,
            statusCode: isError ? 500 : 200,
            latency: context.sampleLatency(config.queryLatency),
          },
        } : null,
      });
    }

    // Process next queued query
    const queue = this.getQueue(node.id);
    if (queue.length > 0) {
      const next = queue.shift()!;
      node.state.queueDepth = queue.length;
      events.push(...this.startQuery(node, next, context, config));
    }

    return events;
  }

  private getQueue(nodeId: string): SimEvent[] {
    if (!this.queues.has(nodeId)) this.queues.set(nodeId, []);
    return this.queues.get(nodeId)!;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/sql-db-handler.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/handlers/sql-db-handler.ts lib/engine/__tests__/sql-db-handler.test.ts
git commit -m "feat: implement SQLDBHandler with connection pooling and queuing"
```

---

### Task 14: Remaining Node Handlers (DNS, CDN, Queue, API Gateway, NoSQL, Storage, Search)

**Files:**
- Create: `lib/engine/handlers/dns-handler.ts`
- Create: `lib/engine/handlers/cdn-handler.ts`
- Create: `lib/engine/handlers/message-queue-handler.ts`
- Create: `lib/engine/handlers/api-gateway-handler.ts`
- Create: `lib/engine/handlers/nosql-db-handler.ts`
- Create: `lib/engine/handlers/object-storage-handler.ts`
- Create: `lib/engine/handlers/search-index-handler.ts`
- Create: `lib/engine/handlers/event-stream-handler.ts`
- Create: `lib/engine/__tests__/remaining-handlers.test.ts`

- [ ] **Step 1: Write failing tests for all remaining handlers**

Create `lib/engine/__tests__/remaining-handlers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { DNSHandler } from "../handlers/dns-handler";
import { CDNHandler } from "../handlers/cdn-handler";
import { MessageQueueHandler } from "../handlers/message-queue-handler";
import { APIGatewayHandler } from "../handlers/api-gateway-handler";
import { NoSQLDBHandler } from "../handlers/nosql-db-handler";
import { ObjectStorageHandler } from "../handlers/object-storage-handler";
import { SearchIndexHandler } from "../handlers/search-index-handler";
import { EventStreamHandler } from "../handlers/event-stream-handler";
import {
  SimulationNode, NodeType, HealthStatus, EventType, Protocol,
  DNSConfig, CDNConfig, MessageQueueConfig, APIGatewayConfig,
  NoSQLDBConfig, ObjectStorageConfig, SearchIndexConfig, EventStreamConfig,
} from "../models";
import { EventQueue } from "../event-queue";
import { MetricsCollector } from "../metrics";
import { SimContextImpl } from "../sim-context";

// === Helpers ===

function makeNode(id: string, type: NodeType, config: any): SimulationNode {
  return {
    id, type, label: id, config,
    state: {
      queueDepth: 0, activeConnections: 0, health: HealthStatus.HEALTHY,
      requestCount: 0, errorCount: 0, totalLatency: 0, crashed: false,
    },
    position: { x: 0, y: 0 },
    connections: [],
  };
}

function makeCtx(node: SimulationNode, connections: any[] = []) {
  return new SimContextImpl(
    0, new Map([[node.id, node]]),
    new Map(connections.map((c: any) => [c.id, c])),
    new EventQueue(), new MetricsCollector(60000),
  );
}

function makeReq(targetId: string) {
  return {
    id: "req1", timestamp: 0, type: EventType.REQUEST_ARRIVE as const,
    sourceNodeId: "caller", targetNodeId: targetId,
    transaction: {
      id: "tx1", message: { method: "GET", path: "/data" },
      protocol: Protocol.HTTP, result: null, metadata: {},
    },
  };
}

const base = {
  concurrencyLimit: 100, maxQueueSize: 1000,
  processingLatency: { type: "constant" as const, value: 1 }, errorRate: 0,
};

// === DNS ===
describe("DNSHandler", () => {
  it("returns RESPONSE with resolution latency", () => {
    const handler = new DNSHandler();
    const node = makeNode("dns1", NodeType.DNS, {
      ...base, resolutionLatency: { type: "constant", value: 5 }, ttl: 300000, failureRate: 0,
    });
    const events = handler.onEvent(node, makeReq("dns1"), makeCtx(node));
    const resp = events.find((e) => e.type === EventType.RESPONSE);
    expect(resp).toBeDefined();
    expect(resp!.timestamp).toBe(5);
    expect(resp!.transaction!.result!.status).toBe("SUCCESS");
  });
});

// === CDN ===
describe("CDNHandler", () => {
  it("returns CACHE_HIT on hit", () => {
    const handler = new CDNHandler();
    const node = makeNode("cdn1", NodeType.CDN, {
      ...base, cacheHitRate: 1.0, originFallbackLatency: { type: "constant", value: 50 }, ttl: 86400000,
    });
    const events = handler.onEvent(node, makeReq("cdn1"), makeCtx(node));
    expect(events.find((e) => e.type === EventType.CACHE_HIT)).toBeDefined();
  });

  it("forwards to origin on miss", () => {
    const handler = new CDNHandler();
    const conn = {
      id: "c1", sourceNodeId: "cdn1", targetNodeId: "origin1",
      protocol: Protocol.HTTP, latency: { type: "constant" as const, value: 10 }, timeout: 5000,
    };
    const node = makeNode("cdn1", NodeType.CDN, {
      ...base, cacheHitRate: 0.0, originFallbackLatency: { type: "constant", value: 50 }, ttl: 86400000,
    });
    node.connections = ["c1"];
    const ctx = makeCtx(node, [conn]);
    const events = handler.onEvent(node, makeReq("cdn1"), ctx);
    const forward = events.find((e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "origin1");
    expect(forward).toBeDefined();
  });
});

// === Message Queue ===
describe("MessageQueueHandler", () => {
  it("enqueues message and returns QUEUE_ENQUEUE", () => {
    const handler = new MessageQueueHandler();
    const node = makeNode("mq1", NodeType.MESSAGE_QUEUE, {
      ...base, maxDepth: 1000, consumerThroughput: 100, deliveryGuarantee: "at-least-once",
    });
    const events = handler.onEvent(node, makeReq("mq1"), makeCtx(node));
    expect(events.find((e) => e.type === EventType.QUEUE_ENQUEUE)).toBeDefined();
  });
});

// === API Gateway ===
describe("APIGatewayHandler", () => {
  it("forwards request to downstream after auth latency", () => {
    const handler = new APIGatewayHandler();
    const conn = {
      id: "c1", sourceNodeId: "gw1", targetNodeId: "svc1",
      protocol: Protocol.HTTP, latency: { type: "constant" as const, value: 2 }, timeout: 5000,
    };
    const node = makeNode("gw1", NodeType.API_GATEWAY, {
      ...base, rateLimit: 1000, authLatency: { type: "constant", value: 3 },
    });
    node.connections = ["c1"];
    const ctx = makeCtx(node, [conn]);
    const events = handler.onEvent(node, makeReq("gw1"), ctx);
    const forward = events.find((e) => e.type === EventType.REQUEST_ARRIVE && e.targetNodeId === "svc1");
    expect(forward).toBeDefined();
    expect(forward!.timestamp).toBe(5); // 3ms auth + 2ms conn latency
  });

  it("returns 429 when rate limited", () => {
    const handler = new APIGatewayHandler();
    const node = makeNode("gw1", NodeType.API_GATEWAY, {
      ...base, rateLimit: 0, authLatency: { type: "constant", value: 3 },
    });
    const events = handler.onEvent(node, makeReq("gw1"), makeCtx(node));
    const resp = events.find((e) => e.type === EventType.RESPONSE);
    expect(resp!.transaction!.result!.statusCode).toBe(429);
  });
});

// === NoSQL DB ===
describe("NoSQLDBHandler", () => {
  it("uses readLatency for GET requests", () => {
    const handler = new NoSQLDBHandler();
    const node = makeNode("nosql1", NodeType.NOSQL_DB, {
      ...base, partitionCount: 8,
      readLatency: { type: "constant", value: 5 },
      writeLatency: { type: "constant", value: 15 },
      consistencyModel: "eventual",
    });
    const events = handler.onEvent(node, makeReq("nosql1"), makeCtx(node));
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete).toBeDefined();
    expect(complete!.timestamp).toBe(5);
  });
});

// === Object Storage ===
describe("ObjectStorageHandler", () => {
  it("responds with read latency", () => {
    const handler = new ObjectStorageHandler();
    const node = makeNode("s3", NodeType.OBJECT_STORAGE, {
      ...base,
      readLatency: { type: "constant", value: 20 },
      writeLatency: { type: "constant", value: 50 },
      throughputLimit: 5000,
    });
    const events = handler.onEvent(node, makeReq("s3"), makeCtx(node));
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete!.timestamp).toBe(20);
  });
});

// === Search Index ===
describe("SearchIndexHandler", () => {
  it("responds with query latency", () => {
    const handler = new SearchIndexHandler();
    const node = makeNode("es1", NodeType.SEARCH_INDEX, {
      ...base, queryLatency: { type: "constant", value: 12 }, indexingLag: 1000,
    });
    const events = handler.onEvent(node, makeReq("es1"), makeCtx(node));
    const complete = events.find((e) => e.type === EventType.PROCESS_COMPLETE);
    expect(complete!.timestamp).toBe(12);
  });
});

// === Event Stream ===
describe("EventStreamHandler", () => {
  it("enqueues to partition and returns QUEUE_ENQUEUE", () => {
    const handler = new EventStreamHandler();
    const node = makeNode("kafka1", NodeType.EVENT_STREAM, {
      ...base, partitionCount: 12, consumerGroupLag: 0, retention: 86400000,
    });
    const events = handler.onEvent(node, makeReq("kafka1"), makeCtx(node));
    expect(events.find((e) => e.type === EventType.QUEUE_ENQUEUE)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/remaining-handlers.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement DNSHandler**

Create `lib/engine/handlers/dns-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, DNSConfig } from "../models";
import { SimContext } from "../sim-context";

export class DNSHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as DNSConfig;
    node.state.requestCount++;
    const latency = context.sampleLatency(config.resolutionLatency);
    const isError = Math.random() < config.failureRate;

    return [{
      id: context.generateId(),
      timestamp: context.currentTime + latency,
      type: EventType.RESPONSE,
      sourceNodeId: node.id,
      targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? {
        ...event.transaction,
        result: {
          status: isError ? ResultStatus.FAILURE : ResultStatus.SUCCESS,
          statusCode: isError ? 503 : 200,
          latency,
          ...(isError && { error: "DNS resolution failed" }),
        },
      } : null,
    }];
  }
}
```

- [ ] **Step 4: Implement CDNHandler**

Create `lib/engine/handlers/cdn-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, CDNConfig } from "../models";
import { SimContext } from "../sim-context";

export class CDNHandler implements NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as CDNConfig;
    node.state.requestCount++;
    const processingTime = context.sampleLatency(config.processingLatency);
    const isHit = Math.random() < config.cacheHitRate;

    if (isHit) {
      return [{
        id: context.generateId(),
        timestamp: context.currentTime + processingTime,
        type: EventType.CACHE_HIT,
        sourceNodeId: node.id,
        targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? {
          ...event.transaction,
          result: { status: ResultStatus.SUCCESS, statusCode: 200, latency: processingTime },
        } : null,
      }];
    }

    // Miss — forward to origin via first outbound connection
    const connections = context.getConnections(node.id);
    if (connections.length > 0) {
      const conn = connections[0];
      const latency = context.sampleLatency(conn.latency);
      return [{
        id: context.generateId(),
        timestamp: context.currentTime + latency,
        type: EventType.REQUEST_ARRIVE,
        sourceNodeId: node.id,
        targetNodeId: conn.targetNodeId,
        transaction: event.transaction ? {
          ...event.transaction,
          metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId },
        } : null,
      }];
    }

    return [{
      id: context.generateId(),
      timestamp: context.currentTime + processingTime,
      type: EventType.CACHE_MISS,
      sourceNodeId: node.id,
      targetNodeId: event.sourceNodeId,
      transaction: event.transaction ? {
        ...event.transaction,
        result: { status: ResultStatus.FAILURE, statusCode: 404, latency: processingTime, error: "CDN miss, no origin" },
      } : null,
    }];
  }
}
```

- [ ] **Step 5: Implement MessageQueueHandler**

Create `lib/engine/handlers/message-queue-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, MessageQueueConfig } from "../models";
import { SimContext } from "../sim-context";

export class MessageQueueHandler implements NodeHandler {
  private queues = new Map<string, SimEvent[]>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    const config = node.config as MessageQueueConfig;

    if (event.type === EventType.REQUEST_ARRIVE) {
      return this.handleEnqueue(node, event, context, config);
    }
    if (event.type === EventType.QUEUE_DEQUEUE) {
      return this.handleDequeue(node, event, context, config);
    }
    return [];
  }

  private handleEnqueue(node: SimulationNode, event: SimEvent, context: SimContext, config: MessageQueueConfig): SimEvent[] {
    const queue = this.getQueue(node.id);
    if (queue.length >= config.maxDepth) {
      node.state.errorCount++;
      return [{
        id: context.generateId(), timestamp: context.currentTime,
        type: EventType.RESPONSE, sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? {
          ...event.transaction,
          result: { status: ResultStatus.FAILURE, statusCode: 503, latency: 0, error: "Queue full" },
        } : null,
      }];
    }

    queue.push(event);
    node.state.queueDepth = queue.length;
    node.state.requestCount++;

    const events: SimEvent[] = [{
      id: context.generateId(), timestamp: context.currentTime,
      type: EventType.QUEUE_ENQUEUE, sourceNodeId: node.id, targetNodeId: node.id,
      transaction: event.transaction,
    }];

    // Schedule dequeue if consumers exist
    const connections = context.getConnections(node.id);
    if (connections.length > 0 && queue.length === 1) {
      const dequeueDelay = 1000 / config.consumerThroughput;
      events.push({
        id: context.generateId(), timestamp: context.currentTime + dequeueDelay,
        type: EventType.QUEUE_DEQUEUE, sourceNodeId: node.id, targetNodeId: node.id,
        transaction: null,
      });
    }

    return events;
  }

  private handleDequeue(node: SimulationNode, event: SimEvent, context: SimContext, config: MessageQueueConfig): SimEvent[] {
    const queue = this.getQueue(node.id);
    if (queue.length === 0) return [];

    const msg = queue.shift()!;
    node.state.queueDepth = queue.length;

    const connections = context.getConnections(node.id);
    const events: SimEvent[] = [];

    if (connections.length > 0) {
      const conn = connections[0];
      events.push({
        id: context.generateId(), timestamp: context.currentTime + context.sampleLatency(conn.latency),
        type: EventType.REQUEST_ARRIVE, sourceNodeId: node.id, targetNodeId: conn.targetNodeId,
        transaction: msg.transaction,
      });
    }

    // Schedule next dequeue if more in queue
    if (queue.length > 0) {
      events.push({
        id: context.generateId(), timestamp: context.currentTime + 1000 / config.consumerThroughput,
        type: EventType.QUEUE_DEQUEUE, sourceNodeId: node.id, targetNodeId: node.id,
        transaction: null,
      });
    }

    return events;
  }

  private getQueue(nodeId: string): SimEvent[] {
    if (!this.queues.has(nodeId)) this.queues.set(nodeId, []);
    return this.queues.get(nodeId)!;
  }
}
```

- [ ] **Step 6: Implement APIGatewayHandler**

Create `lib/engine/handlers/api-gateway-handler.ts`:

```typescript
import { NodeHandler } from "./handler";
import { SimulationNode, SimEvent, EventType, ResultStatus, APIGatewayConfig } from "../models";
import { SimContext } from "../sim-context";

export class APIGatewayHandler implements NodeHandler {
  private requestCounts = new Map<string, { count: number; windowStart: number }>();

  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[] {
    if (event.type !== EventType.REQUEST_ARRIVE) return [];
    const config = node.config as APIGatewayConfig;
    node.state.requestCount++;

    // Rate limiting (sliding window per second)
    const window = this.getWindow(node.id, context.currentTime);
    if (config.rateLimit > 0 && window.count >= config.rateLimit) {
      node.state.errorCount++;
      return [{
        id: context.generateId(), timestamp: context.currentTime,
        type: EventType.RESPONSE, sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? {
          ...event.transaction,
          result: { status: ResultStatus.FAILURE, statusCode: 429, latency: 0, error: "Rate limited" },
        } : null,
      }];
    }
    window.count++;

    // Auth latency then forward
    const authTime = context.sampleLatency(config.authLatency);
    const connections = context.getConnections(node.id);
    if (connections.length === 0) {
      return [{
        id: context.generateId(), timestamp: context.currentTime + authTime,
        type: EventType.RESPONSE, sourceNodeId: node.id, targetNodeId: event.sourceNodeId,
        transaction: event.transaction ? {
          ...event.transaction,
          result: { status: ResultStatus.FAILURE, statusCode: 502, latency: authTime, error: "No downstream" },
        } : null,
      }];
    }

    const conn = connections[0];
    const connLatency = context.sampleLatency(conn.latency);
    return [{
      id: context.generateId(), timestamp: context.currentTime + authTime + connLatency,
      type: EventType.REQUEST_ARRIVE, sourceNodeId: node.id, targetNodeId: conn.targetNodeId,
      transaction: event.transaction ? {
        ...event.transaction,
        metadata: { ...event.transaction.metadata, replyTo: event.sourceNodeId },
      } : null,
    }];
  }

  private getWindow(nodeId: string, currentTime: number) {
    let w = this.requestCounts.get(nodeId);
    if (!w || currentTime - w.windowStart >= 1000) {
      w = { count: 0, windowStart: currentTime };
      this.requestCounts.set(nodeId, w);
    }
    return w;
  }
}
```

- [ ] **Step 7: Implement NoSQLDBHandler, ObjectStorageHandler, SearchIndexHandler, EventStreamHandler**

These are simpler variations. Create each file following the patterns above:

Create `lib/engine/handlers/nosql-db-handler.ts` — same structure as `SQLDBHandler` but casts to `NoSQLDBConfig` and uses `readLatency` for GET/read methods, `writeLatency` for POST/PUT/write methods. Uses `connectionPoolSize = config.partitionCount` as concurrency limit.

Create `lib/engine/handlers/object-storage-handler.ts` — on REQUEST_ARRIVE, picks `readLatency` or `writeLatency` based on method. Returns PROCESS_COMPLETE then RESPONSE. Simple processing node like WebServer.

Create `lib/engine/handlers/search-index-handler.ts` — on REQUEST_ARRIVE, uses `queryLatency` from config. Returns PROCESS_COMPLETE then RESPONSE.

Create `lib/engine/handlers/event-stream-handler.ts` — same pattern as `MessageQueueHandler` but uses `partitionCount` to hash messages to partitions and `consumerGroupLag` as additional dequeue delay.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/remaining-handlers.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 9: Register all handlers in a setup function**

Create `lib/engine/handlers/register-all.ts`:

```typescript
import { NodeType } from "../models";
import { registerHandler } from "./registry";
import { ClientHandler } from "./client-handler";
import { WebServerHandler } from "./web-server-handler";
import { LoadBalancerHandler } from "./load-balancer-handler";
import { CacheHandler } from "./cache-handler";
import { SQLDBHandler } from "./sql-db-handler";
import { DNSHandler } from "./dns-handler";
import { CDNHandler } from "./cdn-handler";
import { MessageQueueHandler } from "./message-queue-handler";
import { APIGatewayHandler } from "./api-gateway-handler";
import { NoSQLDBHandler } from "./nosql-db-handler";
import { ObjectStorageHandler } from "./object-storage-handler";
import { SearchIndexHandler } from "./search-index-handler";
import { EventStreamHandler } from "./event-stream-handler";

export function registerAllHandlers(): void {
  registerHandler(NodeType.CLIENT, new ClientHandler());
  registerHandler(NodeType.WEB_SERVER, new WebServerHandler());
  registerHandler(NodeType.MICROSERVICE, new WebServerHandler());
  registerHandler(NodeType.LOAD_BALANCER, new LoadBalancerHandler());
  registerHandler(NodeType.IN_PROCESS_CACHE, new CacheHandler());
  registerHandler(NodeType.DISTRIBUTED_CACHE, new CacheHandler());
  registerHandler(NodeType.SQL_DB, new SQLDBHandler());
  registerHandler(NodeType.NOSQL_DB, new NoSQLDBHandler());
  registerHandler(NodeType.DNS, new DNSHandler());
  registerHandler(NodeType.CDN, new CDNHandler());
  registerHandler(NodeType.MESSAGE_QUEUE, new MessageQueueHandler());
  registerHandler(NodeType.EVENT_STREAM, new EventStreamHandler());
  registerHandler(NodeType.API_GATEWAY, new APIGatewayHandler());
  registerHandler(NodeType.OBJECT_STORAGE, new ObjectStorageHandler());
  registerHandler(NodeType.SEARCH_INDEX, new SearchIndexHandler());
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/engine/handlers/
git commit -m "feat: implement all remaining node handlers (DNS, CDN, Queue, Gateway, NoSQL, Storage, Search)"
```

---

### Task 14b: Reliability Patterns (Timeouts, Circuit Breakers, Retries, Health Checks)

**Files:**
- Create: `lib/engine/reliability/timeout-manager.ts`
- Create: `lib/engine/reliability/circuit-breaker.ts`
- Create: `lib/engine/reliability/retry-handler.ts`
- Create: `lib/engine/reliability/health-checker.ts`
- Create: `lib/engine/reliability/index.ts`
- Create: `lib/engine/__tests__/reliability.test.ts`

These are cross-cutting concerns used by the Engine and node handlers, not standalone handlers.

- [ ] **Step 1: Write failing tests for reliability patterns**

Create `lib/engine/__tests__/reliability.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TimeoutManager } from "../reliability/timeout-manager";
import { CircuitBreaker } from "../reliability/circuit-breaker";
import { calculateRetryDelay } from "../reliability/retry-handler";
import { EventType, Protocol } from "../models";

// === Timeout Manager ===
describe("TimeoutManager", () => {
  it("creates a timeout event for a given connection timeout", () => {
    const mgr = new TimeoutManager();
    const timeout = mgr.createTimeout("req1", "server1", "client1", 100, 5000);
    expect(timeout.type).toBe(EventType.TIMEOUT);
    expect(timeout.timestamp).toBe(5100); // currentTime 100 + timeout 5000
    expect(timeout.targetNodeId).toBe("client1");
  });

  it("tracks pending timeouts by request ID", () => {
    const mgr = new TimeoutManager();
    mgr.createTimeout("req1", "server1", "client1", 100, 5000);
    expect(mgr.hasPending("req1")).toBe(true);
    mgr.resolve("req1");
    expect(mgr.hasPending("req1")).toBe(false);
  });
});

// === Circuit Breaker ===
describe("CircuitBreaker", () => {
  it("starts in CLOSED state", () => {
    const cb = new CircuitBreaker(5, 10000, 1);
    expect(cb.state).toBe("CLOSED");
  });

  it("opens after error threshold is exceeded", () => {
    const cb = new CircuitBreaker(3, 10000, 1);
    cb.recordResult(false, 100);
    cb.recordResult(false, 200);
    cb.recordResult(false, 300);
    expect(cb.state).toBe("OPEN");
  });

  it("rejects requests when OPEN", () => {
    const cb = new CircuitBreaker(1, 10000, 1);
    cb.recordResult(false, 100);
    expect(cb.shouldAllow(200)).toBe(false);
  });

  it("transitions to HALF_OPEN after reset timeout", () => {
    const cb = new CircuitBreaker(1, 100, 1);
    cb.recordResult(false, 0);
    expect(cb.state).toBe("OPEN");
    expect(cb.shouldAllow(200)).toBe(true); // 200 > 0 + 100 reset timeout
    expect(cb.state).toBe("HALF_OPEN");
  });

  it("closes on successful probe in HALF_OPEN", () => {
    const cb = new CircuitBreaker(1, 100, 1);
    cb.recordResult(false, 0);
    cb.shouldAllow(200); // moves to HALF_OPEN
    cb.recordResult(true, 200);
    expect(cb.state).toBe("CLOSED");
  });
});

// === Retry Delay ===
describe("calculateRetryDelay", () => {
  it("returns base delay for first retry", () => {
    const delay = calculateRetryDelay(0, 100, 2, false);
    expect(delay).toBe(100);
  });

  it("applies exponential backoff", () => {
    expect(calculateRetryDelay(1, 100, 2, false)).toBe(200);
    expect(calculateRetryDelay(2, 100, 2, false)).toBe(400);
  });

  it("adds jitter when enabled", () => {
    const delays = new Set<number>();
    for (let i = 0; i < 20; i++) {
      delays.add(calculateRetryDelay(0, 100, 2, true));
    }
    // With jitter, we should get varied results
    expect(delays.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/reliability.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement TimeoutManager**

Create `lib/engine/reliability/timeout-manager.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";
import { SimEvent, EventType } from "../models";

export class TimeoutManager {
  private pending = new Map<string, string>(); // requestId -> timeoutEventId

  createTimeout(
    requestId: string,
    sourceNodeId: string,
    replyToNodeId: string,
    currentTime: number,
    timeoutMs: number,
  ): SimEvent {
    const eventId = uuidv4();
    this.pending.set(requestId, eventId);

    return {
      id: eventId,
      timestamp: currentTime + timeoutMs,
      type: EventType.TIMEOUT,
      sourceNodeId,
      targetNodeId: replyToNodeId,
      transaction: null,
    };
  }

  hasPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /**
   * Resolve a pending timeout (response arrived first).
   * Returns the timeout event ID so it can be cancelled.
   */
  resolve(requestId: string): string | undefined {
    const eventId = this.pending.get(requestId);
    this.pending.delete(requestId);
    return eventId;
  }
}
```

- [ ] **Step 4: Implement CircuitBreaker**

Create `lib/engine/reliability/circuit-breaker.ts`:

```typescript
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private _state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private failureThreshold: number;
  private resetTimeoutMs: number;
  private halfOpenMaxProbes: number;
  private probeCount = 0;

  constructor(failureThreshold: number, resetTimeoutMs: number, halfOpenMaxProbes: number) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxProbes = halfOpenMaxProbes;
  }

  get state(): CircuitState {
    return this._state;
  }

  shouldAllow(currentTime: number): boolean {
    switch (this._state) {
      case "CLOSED":
        return true;
      case "OPEN":
        if (currentTime - this.lastFailureTime >= this.resetTimeoutMs) {
          this._state = "HALF_OPEN";
          this.probeCount = 0;
          return true;
        }
        return false;
      case "HALF_OPEN":
        return this.probeCount < this.halfOpenMaxProbes;
    }
  }

  recordResult(success: boolean, currentTime: number): void {
    if (this._state === "HALF_OPEN") {
      if (success) {
        this._state = "CLOSED";
        this.failureCount = 0;
      } else {
        this._state = "OPEN";
        this.lastFailureTime = currentTime;
      }
      return;
    }

    if (success) {
      this.failureCount = 0;
    } else {
      this.failureCount++;
      this.lastFailureTime = currentTime;
      if (this.failureCount >= this.failureThreshold) {
        this._state = "OPEN";
      }
    }
  }

  reset(): void {
    this._state = "CLOSED";
    this.failureCount = 0;
    this.probeCount = 0;
  }
}
```

- [ ] **Step 5: Implement retry delay calculator**

Create `lib/engine/reliability/retry-handler.ts`:

```typescript
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  multiplier: number,
  jitter: boolean,
): number {
  const delay = baseDelay * Math.pow(multiplier, attempt);
  if (jitter) {
    return delay * (0.5 + Math.random());
  }
  return delay;
}
```

- [ ] **Step 6: Implement HealthChecker**

Create `lib/engine/reliability/health-checker.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";
import { SimEvent, EventType, HealthStatus } from "../models";

export class HealthChecker {
  private failureCounts = new Map<string, number>();

  createHealthCheckEvent(
    sourceNodeId: string,
    targetNodeId: string,
    currentTime: number,
    intervalMs: number,
  ): SimEvent {
    return {
      id: uuidv4(),
      timestamp: currentTime + intervalMs,
      type: EventType.HEALTH_CHECK,
      sourceNodeId,
      targetNodeId,
      transaction: null,
    };
  }

  processHealthResult(
    targetNodeId: string,
    isHealthy: boolean,
    failureThreshold: number,
  ): HealthStatus {
    if (isHealthy) {
      this.failureCounts.set(targetNodeId, 0);
      return HealthStatus.HEALTHY;
    }

    const count = (this.failureCounts.get(targetNodeId) ?? 0) + 1;
    this.failureCounts.set(targetNodeId, count);

    if (count >= failureThreshold) return HealthStatus.UNHEALTHY;
    if (count >= Math.ceil(failureThreshold / 2)) return HealthStatus.DEGRADED;
    return HealthStatus.HEALTHY;
  }
}
```

- [ ] **Step 7: Create barrel export**

Create `lib/engine/reliability/index.ts`:

```typescript
export { TimeoutManager } from "./timeout-manager";
export { CircuitBreaker, type CircuitState } from "./circuit-breaker";
export { calculateRetryDelay } from "./retry-handler";
export { HealthChecker } from "./health-checker";
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/reliability.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 9: Commit**

```bash
git add lib/engine/reliability/ lib/engine/__tests__/reliability.test.ts
git commit -m "feat: implement reliability patterns (timeout, circuit breaker, retry, health check)"
```

---

### Task 15: Traffic Scenario Engine (Load Generator)

**Files:**
- Create: `lib/engine/scenario-runner.ts`
- Create: `lib/engine/__tests__/scenario-runner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/engine/__tests__/scenario-runner.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ScenarioRunner } from "../scenario-runner";
import { Scenario, NodeType } from "../models";

function makeScenario(): Scenario {
  return {
    id: "test",
    name: "Test",
    description: "test",
    duration: 2,
    phases: [{
      startTime: 0,
      duration: 1,
      requestRate: 10,
      requestDistribution: [{ type: "GET /users", weight: 1 }],
    }],
  };
}

describe("ScenarioRunner", () => {
  it("generates initial events for client nodes", () => {
    const runner = new ScenarioRunner(makeScenario(), ["client1"]);
    const events = runner.generateInitialEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].targetNodeId).toBe("client1");
  });

  it("generates correct number of events based on rate and duration", () => {
    const runner = new ScenarioRunner(makeScenario(), ["client1"]);
    const events = runner.generateInitialEvents();
    // 10 rps * 1 second = 10 events
    expect(events.length).toBe(10);
  });

  it("handles ramp-up phase", () => {
    const scenario: Scenario = {
      id: "ramp",
      name: "Ramp",
      description: "ramp",
      duration: 2,
      phases: [{
        startTime: 0,
        duration: 2,
        requestRate: 10,
        rampUp: 1,
        requestDistribution: [{ type: "GET /users", weight: 1 }],
      }],
    };
    const runner = new ScenarioRunner(scenario, ["client1"]);
    const events = runner.generateInitialEvents();
    // During ramp-up, events should have increasing timestamps
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/scenario-runner.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement ScenarioRunner**

Create `lib/engine/scenario-runner.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";
import { Scenario, SimEvent, EventType } from "./models";

export class ScenarioRunner {
  private scenario: Scenario;
  private clientNodeIds: string[];

  constructor(scenario: Scenario, clientNodeIds: string[]) {
    this.scenario = scenario;
    this.clientNodeIds = clientNodeIds;
  }

  /**
   * Generate all initial trigger events for client nodes based on the scenario phases.
   * These are self-referencing REQUEST_ARRIVE events that kick off the client handlers.
   */
  generateInitialEvents(): SimEvent[] {
    const events: SimEvent[] = [];

    for (const phase of this.scenario.phases) {
      const phaseStartMs = phase.startTime * 1000;
      const phaseDurationMs = phase.duration * 1000;
      const rampUpMs = (phase.rampUp ?? 0) * 1000;

      // Calculate events for each millisecond slice
      let currentTimeMs = phaseStartMs;
      const phaseEndMs = phaseStartMs + phaseDurationMs;

      while (currentTimeMs < phaseEndMs) {
        // Calculate current rate based on ramp-up
        let currentRate: number;
        const elapsed = currentTimeMs - phaseStartMs;

        if (rampUpMs > 0 && elapsed < rampUpMs) {
          currentRate = phase.requestRate * (elapsed / rampUpMs);
        } else {
          currentRate = phase.requestRate;
        }

        if (currentRate <= 0) {
          currentTimeMs += 100; // skip ahead
          continue;
        }

        const intervalMs = 1000 / currentRate;

        // Distribute across client nodes
        for (const clientId of this.clientNodeIds) {
          events.push({
            id: uuidv4(),
            timestamp: currentTimeMs,
            type: EventType.REQUEST_ARRIVE,
            sourceNodeId: clientId,
            targetNodeId: clientId,
            transaction: null,
          });
        }

        currentTimeMs += intervalMs;
      }
    }

    return events;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/scenario-runner.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/scenario-runner.ts lib/engine/__tests__/scenario-runner.test.ts
git commit -m "feat: implement ScenarioRunner for traffic generation from scenario phases"
```

---

## Phase 3: Backend — WebSocket Server & REST API

### Task 16: Custom WebSocket Server

**Files:**
- Create: `server/ws-server.ts`
- Create: `server/simulation-manager.ts`
- Create: `server/index.ts`

- [ ] **Step 1: Create SimulationManager**

Create `server/simulation-manager.ts` — manages engine lifecycle per simulation:

```typescript
import { Engine } from "@/lib/engine/engine";
import { ScenarioRunner } from "@/lib/engine/scenario-runner";
import { registerAllHandlers } from "@/lib/engine/handlers/register-all";
import {
  SimulationNode, Connection, Scenario, NodeType, ServerMessage, Transaction,
} from "@/lib/engine/models";

registerAllHandlers();

export class SimulationManager {
  private engine: Engine | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private onMessage: (msg: ServerMessage) => void;
  private speed = 1;

  constructor(onMessage: (msg: ServerMessage) => void) {
    this.onMessage = onMessage;
  }

  create(nodes: SimulationNode[], connections: Connection[], scenario: Scenario): string {
    this.engine = new Engine(nodes, connections, scenario);

    // Generate initial events from scenario
    const clientIds = nodes.filter((n) => n.type === NodeType.CLIENT).map((n) => n.id);
    const runner = new ScenarioRunner(scenario, clientIds);
    const initialEvents = runner.generateInitialEvents();
    for (const event of initialEvents) {
      this.engine.injectEvent(event);
    }

    return "sim-" + Date.now();
  }

  start(): void {
    if (!this.engine) return;

    // Main simulation loop — process events paced by speed multiplier
    this.timer = setInterval(() => {
      if (!this.engine || this.speed === 0) return;

      // Process a batch of events per tick
      const batchSize = Math.max(1, Math.floor(this.speed * 10));
      for (let i = 0; i < batchSize; i++) {
        if (!this.engine.step()) {
          this.stop();
          return;
        }
      }

      // Send sim status
      this.onMessage({
        type: "SIM_STATUS",
        data: { time: this.engine.currentTime, speed: this.speed, running: true },
      });
    }, 50); // 20 ticks per second

    // Batch transaction streaming (every 50ms wall-clock)
    this.batchTimer = setInterval(() => {
      if (!this.engine) return;
      const txns = this.engine.flushTransactions();
      if (txns.length > 0) {
        const batch: ServerMessage[] = txns.map((t) => ({
          type: "TRANSACTION" as const,
          data: t,
        }));
        this.onMessage({ type: "BATCH", data: batch });
      }

      // Stream NODE_STATE for all nodes (every 200ms simulated time,
      // approximated by sending with each batch frame)
      const nodeStates = this.engine.getNodeStates();
      for (const [nodeId, node] of nodeStates) {
        this.onMessage({
          type: "NODE_STATE",
          data: { nodeId, state: node.state },
        });
      }
    }, 50);
  }

  pause(): void {
    this.speed = 0;
  }

  resume(): void {
    this.speed = 1;
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.timer = null;
    this.batchTimer = null;
    this.onMessage({
      type: "SIM_STATUS",
      data: { time: this.engine?.currentTime ?? 0, speed: 0, running: false },
    });
    this.engine = null;
  }

  updateConfig(nodeId: string, config: Record<string, unknown>): void {
    this.engine?.updateNodeConfig(nodeId, config);
  }

  injectChaos(chaosType: string, target: string): void {
    if (!this.engine) return;
    // Inject failure event at current time
    this.engine.injectEvent({
      id: "chaos-" + Date.now(),
      timestamp: this.engine.currentTime,
      type: "FAILURE" as any,
      sourceNodeId: "chaos",
      targetNodeId: target,
      transaction: null,
    });
  }
}
```

- [ ] **Step 2: Create WebSocket server**

Create `server/ws-server.ts`:

```typescript
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { SimulationManager } from "./simulation-manager";
import { ClientMessage } from "@/lib/engine/models";

export function createWSServer(server: import("http").Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    let manager: SimulationManager | null = null;

    const sendMessage = (msg: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;

        switch (msg.type) {
          case "START":
            manager?.start();
            break;
          case "STOP":
            manager?.stop();
            manager = null;
            break;
          case "PAUSE":
            manager?.pause();
            break;
          case "RESUME":
            manager?.resume();
            break;
          case "SPEED":
            manager?.setSpeed(msg.data.multiplier);
            break;
          case "UPDATE_CONFIG":
            manager?.updateConfig(msg.data.nodeId, msg.data.config as Record<string, unknown>);
            break;
          case "INJECT_CHAOS":
            manager?.injectChaos(msg.data.chaosType, msg.data.target);
            break;
        }
      } catch (err) {
        console.error("WS message error:", err);
      }
    });

    ws.on("close", () => {
      manager?.stop();
      manager = null;
    });
  });

  return wss;
}
```

- [ ] **Step 3: Create custom server entry point**

Create `server/index.ts`:

```typescript
import { createServer } from "http";
import next from "next";
import { createWSServer } from "./ws-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  createWSServer(server);

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server on ws://${hostname}:${port}/ws`);
  });
});
```

- [ ] **Step 4: Add dev:ws script to package.json**

Add to `scripts`:

```json
"dev:ws": "tsx server/index.ts"
```

Install tsx if not present:

```bash
npm install -D tsx
```

- [ ] **Step 5: Verify the custom server starts**

Run: `npm run dev:ws`
Expected: "Ready on http://localhost:3000" and "WebSocket server on ws://localhost:3000/ws"

- [ ] **Step 6: Commit**

```bash
git add server/ package.json package-lock.json
git commit -m "feat: add custom WebSocket server with SimulationManager"
```

---

### Task 17: REST API — Simulation Create & State

**Files:**
- Create: `app/api/simulation/create/route.ts`
- Create: `app/api/simulation/state/route.ts`

- [ ] **Step 1: Create POST /api/simulation/create**

Create `app/api/simulation/create/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

// The actual simulation is managed via WebSocket.
// This endpoint validates the config and returns a simulationId.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes, connections, scenario } = body;

    if (!nodes || !connections || !scenario) {
      return NextResponse.json(
        { error: "Missing required fields: nodes, connections, scenario" },
        { status: 400 },
      );
    }

    const simulationId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json({ simulationId, nodes: nodes.length, connections: connections.length });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create GET /api/simulation/state**

Create `app/api/simulation/state/route.ts`:

```typescript
import { NextResponse } from "next/server";

// Placeholder — in v1, state is streamed via WebSocket.
// This endpoint returns a basic status.
export async function GET() {
  return NextResponse.json({ status: "idle", message: "Use WebSocket for live state" });
}
```

- [ ] **Step 3: Verify endpoints respond**

Run the dev server and test:

```bash
curl -X POST http://localhost:3000/api/simulation/create \
  -H "Content-Type: application/json" \
  -d '{"nodes":[],"connections":[],"scenario":{"id":"test","name":"test","description":"","duration":1,"phases":[]}}'
```

Expected: `{"simulationId":"sim-...","nodes":0,"connections":0}`

- [ ] **Step 4: Commit**

```bash
git add app/api/simulation/
git commit -m "feat: add REST endpoints for simulation create and state"
```

---

## Phase 4: Frontend — Canvas & UI

### Task 18: Install React Flow & Set Up Canvas Page

**Files:**
- Modify: `package.json`
- Modify: `app/page.tsx`
- Create: `app/components/canvas/simulation-canvas.tsx`

- [ ] **Step 1: Install React Flow**

```bash
npm install @xyflow/react
```

- [ ] **Step 2: Create SimulationCanvas component**

Create `app/components/canvas/simulation-canvas.tsx`:

```typescript
"use client";

import { useCallback, useState } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  type Connection as RFConnection,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: RFNode[] = [];
const initialEdges: RFEdge[] = [];

export default function SimulationCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: RFConnection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 3: Replace page.tsx with the simulation layout**

Replace `app/page.tsx`:

```typescript
import SimulationCanvas from "./components/canvas/simulation-canvas";

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Toolbar */}
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h1 className="text-sm font-semibold">System Design Simulator</h1>
        <div className="flex items-center gap-2">
          {/* Toolbar buttons added in later tasks */}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node palette - added in Task 19 */}
        <aside className="w-48 border-r border-zinc-800 p-3">
          <p className="text-xs text-zinc-500">Node Palette</p>
        </aside>

        {/* Canvas */}
        <main className="flex-1">
          <SimulationCanvas />
        </main>
      </div>

      {/* Transaction log - added in Task 23 */}
      <footer className="h-48 border-t border-zinc-800 p-3">
        <p className="text-xs text-zinc-500">Transaction Log</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Verify page renders with React Flow canvas**

Run: `npm run dev` and open http://localhost:3000
Expected: Dark page with "System Design Simulator" header, empty canvas with grid dots, sidebar, and footer area.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/page.tsx app/components/
git commit -m "feat: set up React Flow canvas with dark theme layout"
```

---

### Task 19: Node Palette (Drag-and-Drop)

**Files:**
- Create: `app/components/palette/node-palette.tsx`
- Create: `app/components/palette/palette-item.tsx`
- Create: `lib/node-defaults.ts`
- Modify: `app/page.tsx`
- Modify: `app/components/canvas/simulation-canvas.tsx`

- [ ] **Step 1: Create node defaults config**

Create `lib/node-defaults.ts` with default configs for each node type:

```typescript
import { NodeType, type NodeConfig, type BaseNodeConfig } from "./engine/models";

interface NodeDefinition {
  type: NodeType;
  label: string;
  category: string;
  color: string;
  defaultConfig: NodeConfig;
}

const base: BaseNodeConfig = {
  concurrencyLimit: 100,
  maxQueueSize: 1000,
  processingLatency: { type: "constant", value: 5 },
  errorRate: 0,
};

export const NODE_DEFINITIONS: NodeDefinition[] = [
  {
    type: NodeType.CLIENT, label: "Client", category: "Entry", color: "#6366f1",
    defaultConfig: { ...base, requestRate: 10, requestDistribution: [{ type: "GET /api", weight: 1 }] },
  },
  {
    type: NodeType.DNS, label: "DNS", category: "Entry", color: "#6366f1",
    defaultConfig: { ...base, resolutionLatency: { type: "constant", value: 5 }, ttl: 300000, failureRate: 0.01 },
  },
  {
    type: NodeType.CDN, label: "CDN", category: "Entry", color: "#6366f1",
    defaultConfig: { ...base, cacheHitRate: 0.9, originFallbackLatency: { type: "constant", value: 50 }, ttl: 86400000 },
  },
  {
    type: NodeType.LOAD_BALANCER, label: "Load Balancer", category: "Load Balancer", color: "#f59e0b",
    defaultConfig: { ...base, strategy: "round-robin", maxConnections: 10000, healthCheckInterval: 5000, healthCheckFailureThreshold: 3 },
  },
  {
    type: NodeType.WEB_SERVER, label: "Web Server", category: "Compute", color: "#10b981",
    defaultConfig: { ...base, concurrencyLimit: 50, processingLatency: { type: "lognormal", mu: 2.3, sigma: 0.5 } },
  },
  {
    type: NodeType.MICROSERVICE, label: "Microservice", category: "Compute", color: "#10b981",
    defaultConfig: { ...base, concurrencyLimit: 30, processingLatency: { type: "lognormal", mu: 2, sigma: 0.4 } },
  },
  {
    type: NodeType.DISTRIBUTED_CACHE, label: "Cache (Redis)", category: "Cache", color: "#ef4444",
    defaultConfig: { ...base, capacity: 100000, hitRate: 0.85, evictionPolicy: "LRU", ttl: 300000, replicationLag: 0 },
  },
  {
    type: NodeType.SQL_DB, label: "SQL DB", category: "Database", color: "#3b82f6",
    defaultConfig: { ...base, connectionPoolSize: 20, queryLatency: { type: "lognormal", mu: 2.7, sigma: 0.6 }, replicationLag: 10, maxIOPS: 5000 },
  },
  {
    type: NodeType.NOSQL_DB, label: "NoSQL DB", category: "Database", color: "#3b82f6",
    defaultConfig: { ...base, partitionCount: 8, readLatency: { type: "lognormal", mu: 1.6, sigma: 0.3 }, writeLatency: { type: "lognormal", mu: 2, sigma: 0.4 }, consistencyModel: "eventual" },
  },
  {
    type: NodeType.MESSAGE_QUEUE, label: "Message Queue", category: "Queue", color: "#a855f7",
    defaultConfig: { ...base, maxDepth: 100000, consumerThroughput: 1000, deliveryGuarantee: "at-least-once" },
  },
  {
    type: NodeType.EVENT_STREAM, label: "Event Stream", category: "Queue", color: "#a855f7",
    defaultConfig: { ...base, partitionCount: 12, consumerGroupLag: 0, retention: 86400000 },
  },
  {
    type: NodeType.OBJECT_STORAGE, label: "Object Storage", category: "Storage", color: "#64748b",
    defaultConfig: { ...base, readLatency: { type: "constant", value: 20 }, writeLatency: { type: "constant", value: 50 }, throughputLimit: 5000 },
  },
  {
    type: NodeType.SEARCH_INDEX, label: "Search Index", category: "Search", color: "#f97316",
    defaultConfig: { ...base, queryLatency: { type: "lognormal", mu: 2.3, sigma: 0.4 }, indexingLag: 1000 },
  },
  {
    type: NodeType.API_GATEWAY, label: "API Gateway", category: "Gateway", color: "#14b8a6",
    defaultConfig: { ...base, rateLimit: 1000, authLatency: { type: "constant", value: 3 } },
  },
];

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return NODE_DEFINITIONS.find((d) => d.type === type);
}
```

- [ ] **Step 2: Create PaletteItem component**

Create `app/components/palette/palette-item.tsx`:

```typescript
"use client";

import { type DragEvent } from "react";
import { NodeType } from "@/lib/engine/models";

interface PaletteItemProps {
  type: NodeType;
  label: string;
  color: string;
}

export default function PaletteItem({ type, label, color }: PaletteItemProps) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("application/reactflow-type", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="cursor-grab rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium transition-colors hover:border-zinc-500"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      draggable
      onDragStart={onDragStart}
    >
      {label}
    </div>
  );
}
```

- [ ] **Step 3: Create NodePalette component**

Create `app/components/palette/node-palette.tsx`:

```typescript
"use client";

import { NODE_DEFINITIONS } from "@/lib/node-defaults";
import PaletteItem from "./palette-item";

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

- [ ] **Step 4: Wire up drag-and-drop in SimulationCanvas**

Update `app/components/canvas/simulation-canvas.tsx` to handle drops:
- Add `onDragOver` and `onDrop` handlers to ReactFlow
- On drop, read the node type from dataTransfer, create a new RF node at the drop position
- Use `getNodeDefinition` to get the default config

- [ ] **Step 5: Update page.tsx to use NodePalette**

Replace the placeholder sidebar in `app/page.tsx` with `<NodePalette />`.

- [ ] **Step 6: Verify drag-and-drop works**

Run the dev server, drag a node from the palette onto the canvas.
Expected: A node appears at the drop position.

- [ ] **Step 7: Commit**

```bash
git add lib/node-defaults.ts app/components/palette/ app/components/canvas/ app/page.tsx
git commit -m "feat: add node palette with drag-and-drop onto canvas"
```

---

### Task 20: Custom Node Components (Visual Node Rendering)

**Files:**
- Create: `app/components/canvas/sim-node.tsx`
- Modify: `app/components/canvas/simulation-canvas.tsx`

- [ ] **Step 1: Create SimNode component**

Create `app/components/canvas/sim-node.tsx` — a custom React Flow node that displays:
- Node label and type
- Color accent matching the node type
- Source and target handles for connections
- A compact display of key metrics (when simulation is running, populated later)

```typescript
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
    <div
      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg"
      style={{ borderTopColor: color, borderTopWidth: 3, minWidth: 140 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-100">{nodeData.label}</span>
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: healthColor }}
        />
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

- [ ] **Step 2: Register custom node type in SimulationCanvas**

In `simulation-canvas.tsx`, add:

```typescript
import SimNode from "./sim-node";

const nodeTypes = { simNode: SimNode };
```

Pass `nodeTypes` to `<ReactFlow nodeTypes={nodeTypes} />`.

When creating nodes from palette drops, use `type: "simNode"`.

- [ ] **Step 3: Verify custom nodes render**

Drop nodes onto canvas, verify they display with the colored border, label, and handles.

- [ ] **Step 4: Commit**

```bash
git add app/components/canvas/
git commit -m "feat: add custom SimNode component with health indicator and metrics display"
```

---

### Task 21: WebSocket Client Hook

**Files:**
- Create: `app/hooks/use-simulation.ts`

- [ ] **Step 1: Create useSimulation hook**

Create `app/hooks/use-simulation.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage, ClientMessage, Transaction, NodeState, HealthStatus } from "@/lib/engine/models";

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

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      handleMessage(msg);
    };

    wsRef.current = ws;
  }, []);

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
        setState((s) => ({
          ...s,
          transactions: [...s.transactions.slice(-999), msg.data as Transaction],
        }));
        break;
      case "BATCH":
        for (const inner of msg.data) {
          handleMessage(inner);
        }
        break;
      case "ALERT":
        setState((s) => ({
          ...s,
          alerts: [...s.alerts.slice(-49), msg.data],
        }));
        break;
    }
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const start = useCallback((simulationId: string) => send({ type: "START", data: { simulationId } }), [send]);
  const stop = useCallback(() => send({ type: "STOP" }), [send]);
  const pause = useCallback(() => send({ type: "PAUSE" }), [send]);
  const resume = useCallback(() => send({ type: "RESUME" }), [send]);
  const setSpeed = useCallback((multiplier: number) => send({ type: "SPEED", data: { multiplier } }), [send]);

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

- [ ] **Step 2: Commit**

```bash
git add app/hooks/
git commit -m "feat: add useSimulation WebSocket hook for real-time state management"
```

---

### Task 22: Toolbar (Run/Pause/Speed/Scenario/Chaos)

**Files:**
- Create: `app/components/toolbar/toolbar.tsx`
- Create: `app/components/toolbar/speed-control.tsx`
- Create: `app/components/toolbar/scenario-picker.tsx`
- Create: `lib/scenarios.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create predefined scenarios**

Create `lib/scenarios.ts` with the 7 predefined scenarios from the spec:

```typescript
import { Scenario } from "./engine/models";

export const PREDEFINED_SCENARIOS: Scenario[] = [
  {
    id: "steady-state",
    name: "Steady State",
    description: "Constant 100 rps for 60s",
    duration: 60,
    phases: [{ startTime: 0, duration: 60, requestRate: 100, requestDistribution: [{ type: "GET /api/users", weight: 1 }] }],
  },
  {
    id: "gradual-ramp",
    name: "Gradual Ramp",
    description: "10 to 500 rps over 120s",
    duration: 120,
    phases: [{ startTime: 0, duration: 120, requestRate: 500, rampUp: 120, requestDistribution: [{ type: "GET /api/users", weight: 1 }] }],
  },
  {
    id: "flash-sale",
    name: "Flash Sale Spike",
    description: "Steady 50 rps, burst to 1000 rps for 10s",
    duration: 70,
    phases: [
      { startTime: 0, duration: 30, requestRate: 50, requestDistribution: [{ type: "GET /api/products", weight: 1 }] },
      { startTime: 30, duration: 10, requestRate: 1000, requestDistribution: [{ type: "GET /api/products", weight: 1 }] },
      { startTime: 40, duration: 30, requestRate: 50, requestDistribution: [{ type: "GET /api/products", weight: 1 }] },
    ],
  },
  {
    id: "cascading-failure",
    name: "Cascading Failure",
    description: "Moderate load + DB failure at t=30s",
    duration: 90,
    phases: [{ startTime: 0, duration: 90, requestRate: 100, requestDistribution: [{ type: "GET /api/users", weight: 1 }] }],
  },
  {
    id: "thundering-herd",
    name: "Thundering Herd",
    description: "All cache entries expire simultaneously",
    duration: 60,
    phases: [{ startTime: 0, duration: 60, requestRate: 200, requestDistribution: [{ type: "GET /api/data", weight: 1 }] }],
  },
  {
    id: "retry-storm",
    name: "Retry Storm",
    description: "Backend failure triggers aggressive retries",
    duration: 60,
    phases: [{ startTime: 0, duration: 60, requestRate: 100, requestDistribution: [{ type: "GET /api/health", weight: 1 }] }],
  },
  {
    id: "diurnal",
    name: "Diurnal Pattern",
    description: "Sine wave traffic over 24h simulated",
    duration: 86400,
    phases: [{ startTime: 0, duration: 86400, requestRate: 100, requestDistribution: [{ type: "GET /api/feed", weight: 1 }] }],
  },
];
```

- [ ] **Step 2: Create Toolbar, SpeedControl, and ScenarioPicker components**

Create the toolbar with:
- Run/Pause/Stop buttons
- Speed slider (0.1x to 20x)
- Scenario dropdown
- Chaos injection button (dropdown: kill node, spike latency, network partition)

These components use the `useSimulation` hook passed via props or context.

- [ ] **Step 3: Wire toolbar into page.tsx**

Replace the toolbar placeholder with the Toolbar component.

- [ ] **Step 4: Verify toolbar renders and buttons appear**

Run dev server, confirm toolbar buttons and dropdowns render.

- [ ] **Step 5: Commit**

```bash
git add app/components/toolbar/ lib/scenarios.ts app/page.tsx
git commit -m "feat: add toolbar with run/pause/speed controls and scenario picker"
```

---

### Task 23: Transaction Log Panel

**Files:**
- Create: `app/components/log/transaction-log.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create TransactionLog component**

Create `app/components/log/transaction-log.tsx`:

```typescript
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transactions.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-zinc-800 px-3 py-1.5">
        <span className="text-xs font-semibold text-zinc-400">Transaction Log</span>
        <span className="text-[10px] text-zinc-600">{transactions.length} events</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[80px_100px_100px_60px_1fr_60px_50px] gap-2 border-b border-zinc-800 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        <span>Time</span>
        <span>Source</span>
        <span>Target</span>
        <span>Proto</span>
        <span>Message</span>
        <span>Latency</span>
        <span>Status</span>
      </div>

      {/* Rows */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {transactions.map((tx, i) => (
          <div
            key={tx.id + i}
            className="grid cursor-pointer grid-cols-[80px_100px_100px_60px_1fr_60px_50px] gap-2 border-b border-zinc-900 px-3 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800/50"
            onClick={() => onRowClick?.(tx)}
          >
            <span className="text-zinc-500">{tx.metadata?.timestamp ?? "—"}</span>
            <span>{tx.metadata?.source ?? "—"}</span>
            <span>{tx.metadata?.target ?? "—"}</span>
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

- [ ] **Step 2: Wire into page.tsx**

Replace the footer placeholder with `<TransactionLog />`, passing transactions from `useSimulation`.

- [ ] **Step 3: Commit**

```bash
git add app/components/log/ app/page.tsx
git commit -m "feat: add scrolling transaction log panel with filtering"
```

---

### Task 24: Node Config Panel

**Files:**
- Create: `app/components/config/node-config-panel.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create NodeConfigPanel**

Create `app/components/config/node-config-panel.tsx` — a right-side slide-out panel shown when a canvas node is clicked:

- Displays the selected node's type-specific config knobs
- Each knob is a labeled input (slider for numeric, dropdown for enums)
- Changes dispatch `UPDATE_CONFIG` via the WebSocket hook
- Panel closes with an X button or clicking elsewhere

- [ ] **Step 2: Wire click handler in SimulationCanvas**

Add `onNodeClick` handler to ReactFlow that sets the selected node ID. Pass it to page-level state.

- [ ] **Step 3: Render NodeConfigPanel in page.tsx**

Conditionally render the panel when a node is selected.

- [ ] **Step 4: Commit**

```bash
git add app/components/config/ app/components/canvas/ app/page.tsx
git commit -m "feat: add node config panel with type-specific knobs"
```

---

### Task 25: Animated Edge Flow

**Files:**
- Create: `app/components/canvas/animated-edge.tsx`
- Modify: `app/components/canvas/simulation-canvas.tsx`

- [ ] **Step 1: Create AnimatedEdge component**

Create `app/components/canvas/animated-edge.tsx` — a custom React Flow edge that:

- Renders the default edge path
- When active transactions exist on this edge, renders animated dots moving along the path
- Dots are color-coded: green (success), red (error), yellow (slow/pending)
- Uses CSS animation along the SVG path

- [ ] **Step 2: Register custom edge type**

In `simulation-canvas.tsx`, add:

```typescript
import AnimatedEdge from "./animated-edge";
const edgeTypes = { animated: AnimatedEdge };
```

Pass `edgeTypes` to ReactFlow. Set default edge type to `"animated"`.

- [ ] **Step 3: Feed active transactions to edges**

Map the transaction stream to edge animations. When a `TRANSACTION` message arrives with sourceNodeId and targetNodeId, find the corresponding edge and add a dot animation.

- [ ] **Step 4: Commit**

```bash
git add app/components/canvas/
git commit -m "feat: add animated edge with color-coded request dots"
```

---

## Phase 5: Integration & End-to-End

### Task 26: Wire Everything Together

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/components/canvas/simulation-canvas.tsx`
- Modify: `server/simulation-manager.ts`

- [ ] **Step 1: Full integration in page.tsx**

Wire all components together:
- `useSimulation` hook at page level
- Toolbar connects to hook (start/stop/pause/speed)
- On "Run": serialize canvas nodes + edges + scenario → POST /create → WS start
- Transaction log receives transactions from hook state
- Node states from hook update SimNode data on canvas
- Config panel sends UPDATE_CONFIG via hook

- [ ] **Step 2: Update SimulationManager to accept config from WS**

In `server/ws-server.ts`, when the client sends `START`, create the simulation from a stored config (previously sent via REST `/create`). Store the config in a Map keyed by simulationId.

- [ ] **Step 3: End-to-end test**

1. Start dev server with `npm run dev:ws`
2. Drag Client → Load Balancer → Web Server → SQL DB onto canvas
3. Connect them with edges
4. Select "Steady State" scenario
5. Click Run
6. Verify: animated dots flow along edges, transaction log populates, node metrics update

- [ ] **Step 4: Commit**

```bash
git add app/ server/
git commit -m "feat: wire frontend and backend for end-to-end simulation"
```

---

### Task 27: Chaos Injection UI

**Files:**
- Create: `app/components/toolbar/chaos-menu.tsx`
- Modify: `app/components/toolbar/toolbar.tsx`

- [ ] **Step 1: Create ChaosMenu dropdown**

Create `app/components/toolbar/chaos-menu.tsx`:

- Dropdown with predefined chaos actions: "Kill random node", "Spike latency", "Network partition", "Increase traffic"
- "Kill random node" picks a random non-client node and sends INJECT_CHAOS
- "Spike latency" opens a submenu to pick which node/connection to spike
- Also allow right-clicking a canvas node to inject chaos on that specific node

- [ ] **Step 2: Wire to toolbar**

Add ChaosMenu to the toolbar. Only enabled when simulation is running.

- [ ] **Step 3: Verify chaos injection works**

Run a simulation, inject "Kill random node", verify the node stops processing and cascading failures occur.

- [ ] **Step 4: Commit**

```bash
git add app/components/toolbar/
git commit -m "feat: add chaos injection menu with predefined failure scenarios"
```

---

### Task 28: LocalStorage Persistence (Save/Load)

**Files:**
- Create: `app/hooks/use-persistence.ts`
- Create: `app/components/toolbar/save-load.tsx`
- Modify: `app/components/toolbar/toolbar.tsx`

- [ ] **Step 1: Create usePersistence hook**

Create `app/hooks/use-persistence.ts`:

```typescript
"use client";

import { SimulationConfig } from "@/lib/engine/models";

const STORAGE_KEY = "sim-configs";

export function usePersistence() {
  const save = (config: SimulationConfig) => {
    const existing = list();
    existing.push(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  };

  const list = (): SimulationConfig[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
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

- [ ] **Step 2: Create SaveLoad toolbar component**

Save button: prompts for name, serializes canvas state to `SimulationConfig`, saves to localStorage.
Load button: dropdown of saved configs, clicking one restores the canvas.

- [ ] **Step 3: Wire into toolbar**

- [ ] **Step 4: Verify save/load round-trips**

Build a small architecture, save it, refresh page, load it back. Verify nodes and connections restore correctly.

- [ ] **Step 5: Commit**

```bash
git add app/hooks/use-persistence.ts app/components/toolbar/save-load.tsx app/components/toolbar/toolbar.tsx
git commit -m "feat: add localStorage persistence for canvas save/load"
```

---

### Task 29: Final Polish & Engine Barrel Export

**Files:**
- Create: `lib/engine/index.ts`
- Modify: `app/globals.css` (if needed for React Flow styling)

- [ ] **Step 1: Create engine barrel export**

Create `lib/engine/index.ts`:

```typescript
export * from "./models";
export { Engine } from "./engine";
export { EventQueue } from "./event-queue";
export { sampleLatency } from "./distributions";
export { MetricsCollector } from "./metrics";
export { SimContextImpl } from "./sim-context";
export type { SimContext } from "./sim-context";
export { ScenarioRunner } from "./scenario-runner";
export { registerAllHandlers } from "./handlers/register-all";
```

- [ ] **Step 2: Verify full build passes**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run all tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/engine/index.ts
git commit -m "chore: add engine barrel export and verify full build"
```
