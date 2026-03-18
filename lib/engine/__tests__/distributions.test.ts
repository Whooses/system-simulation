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
