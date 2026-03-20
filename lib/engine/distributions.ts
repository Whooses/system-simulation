import type { LatencyDistribution } from "./models";

// === Random Number Generation ===

/**
 * Box-Muller transform: converts two uniform random samples into
 * a standard-normal (mean=0, stddev=1) random variate.
 * Used by the normal and lognormal distributions below.
 */
function boxMuller(): number {
  let u1 = 0;
  let u2 = 0;
  // Reject exact 0 to avoid log(0) = -Infinity
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// === Latency Sampling ===

/**
 * Draw a single latency sample from the given distribution.
 * All results are clamped to >= 0 to prevent negative latencies.
 */
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
