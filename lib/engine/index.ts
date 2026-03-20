/**
 * Public API for the simulation engine.
 * Re-exports all types, the core engine, and supporting modules.
 */
export * from "./models";
export { Engine } from "./engine";
export { EventQueue } from "./event-queue";
export { sampleLatency } from "./distributions";
export { MetricsCollector } from "./metrics";
export { SimContextImpl } from "./sim-context";
export type { SimContext } from "./sim-context";
export { ScenarioRunner } from "./scenario-runner";
export { registerAllHandlers } from "./handlers/register-all";
