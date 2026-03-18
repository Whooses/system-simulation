import { describe, it, expect } from "vitest";
import { TimeoutManager } from "../reliability/timeout-manager";
import { CircuitBreaker } from "../reliability/circuit-breaker";
import { calculateRetryDelay } from "../reliability/retry-handler";
import { EventType } from "../models";

describe("TimeoutManager", () => {
  it("creates a timeout event for a given connection timeout", () => {
    const mgr = new TimeoutManager();
    const timeout = mgr.createTimeout("req1", "server1", "client1", 100, 5000);
    expect(timeout.type).toBe(EventType.TIMEOUT);
    expect(timeout.timestamp).toBe(5100);
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
    expect(cb.shouldAllow(200)).toBe(true);
    expect(cb.state).toBe("HALF_OPEN");
  });
  it("closes on successful probe in HALF_OPEN", () => {
    const cb = new CircuitBreaker(1, 100, 1);
    cb.recordResult(false, 0);
    cb.shouldAllow(200);
    cb.recordResult(true, 200);
    expect(cb.state).toBe("CLOSED");
  });
});

describe("calculateRetryDelay", () => {
  it("returns base delay for first retry", () => {
    expect(calculateRetryDelay(0, 100, 2, false)).toBe(100);
  });
  it("applies exponential backoff", () => {
    expect(calculateRetryDelay(1, 100, 2, false)).toBe(200);
    expect(calculateRetryDelay(2, 100, 2, false)).toBe(400);
  });
  it("adds jitter when enabled", () => {
    const delays = new Set<number>();
    for (let i = 0; i < 20; i++) delays.add(calculateRetryDelay(0, 100, 2, true));
    expect(delays.size).toBeGreaterThan(1);
  });
});
