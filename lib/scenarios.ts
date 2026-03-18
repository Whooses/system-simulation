import { Scenario } from "./engine/models";

export const PREDEFINED_SCENARIOS: Scenario[] = [
  { id: "steady-state", name: "Steady State", description: "Constant 100 rps for 60s", duration: 60,
    phases: [{ startTime: 0, duration: 60, requestRate: 100, requestDistribution: [{ type: "GET /api/users", weight: 1 }] }] },
  { id: "gradual-ramp", name: "Gradual Ramp", description: "10 to 500 rps over 120s", duration: 120,
    phases: [{ startTime: 0, duration: 120, requestRate: 500, rampUp: 120, requestDistribution: [{ type: "GET /api/users", weight: 1 }] }] },
  { id: "flash-sale", name: "Flash Sale Spike", description: "Steady 50 rps, burst to 1000 rps for 10s", duration: 70,
    phases: [
      { startTime: 0, duration: 30, requestRate: 50, requestDistribution: [{ type: "GET /api/products", weight: 1 }] },
      { startTime: 30, duration: 10, requestRate: 1000, requestDistribution: [{ type: "GET /api/products", weight: 1 }] },
      { startTime: 40, duration: 30, requestRate: 50, requestDistribution: [{ type: "GET /api/products", weight: 1 }] },
    ] },
  { id: "cascading-failure", name: "Cascading Failure", description: "Moderate load + DB failure at t=30s", duration: 90,
    phases: [{ startTime: 0, duration: 90, requestRate: 100, requestDistribution: [{ type: "GET /api/users", weight: 1 }] }] },
  { id: "thundering-herd", name: "Thundering Herd", description: "All cache entries expire simultaneously", duration: 60,
    phases: [{ startTime: 0, duration: 60, requestRate: 200, requestDistribution: [{ type: "GET /api/data", weight: 1 }] }] },
  { id: "retry-storm", name: "Retry Storm", description: "Backend failure triggers aggressive retries", duration: 60,
    phases: [{ startTime: 0, duration: 60, requestRate: 100, requestDistribution: [{ type: "GET /api/health", weight: 1 }] }] },
  { id: "diurnal", name: "Diurnal Pattern", description: "Sine wave traffic over 24h simulated", duration: 86400,
    phases: [{ startTime: 0, duration: 86400, requestRate: 100, requestDistribution: [{ type: "GET /api/feed", weight: 1 }] }] },
];
