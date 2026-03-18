import { describe, it, expect } from "vitest";
import { ScenarioRunner } from "../scenario-runner";
import { Scenario } from "../models";

function makeScenario(): Scenario {
  return { id: "test", name: "Test", description: "test", duration: 2,
    phases: [{ startTime: 0, duration: 1, requestRate: 10, requestDistribution: [{ type: "GET /users", weight: 1 }] }] };
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
    expect(events.length).toBe(10);
  });

  it("handles ramp-up phase", () => {
    const scenario: Scenario = { id: "ramp", name: "Ramp", description: "ramp", duration: 2,
      phases: [{ startTime: 0, duration: 2, requestRate: 10, rampUp: 1, requestDistribution: [{ type: "GET /users", weight: 1 }] }] };
    const runner = new ScenarioRunner(scenario, ["client1"]);
    const events = runner.generateInitialEvents();
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
    }
  });
});
