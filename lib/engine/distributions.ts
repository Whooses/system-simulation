import type { LatencyDistribution } from "./models";

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
