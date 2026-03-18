import { v4 as uuidv4 } from "uuid";
import { Scenario, SimEvent, EventType } from "./models";

export class ScenarioRunner {
  private scenario: Scenario;
  private clientNodeIds: string[];

  constructor(scenario: Scenario, clientNodeIds: string[]) {
    this.scenario = scenario;
    this.clientNodeIds = clientNodeIds;
  }

  generateInitialEvents(): SimEvent[] {
    const events: SimEvent[] = [];
    for (const phase of this.scenario.phases) {
      const phaseStartMs = phase.startTime * 1000;
      const phaseDurationMs = phase.duration * 1000;
      const rampUpMs = (phase.rampUp ?? 0) * 1000;
      let currentTimeMs = phaseStartMs;
      const phaseEndMs = phaseStartMs + phaseDurationMs;

      while (currentTimeMs < phaseEndMs) {
        let currentRate: number;
        const elapsed = currentTimeMs - phaseStartMs;
        if (rampUpMs > 0 && elapsed < rampUpMs) {
          currentRate = phase.requestRate * (elapsed / rampUpMs);
        } else {
          currentRate = phase.requestRate;
        }
        if (currentRate <= 0) { currentTimeMs += 100; continue; }
        const intervalMs = 1000 / currentRate;

        for (const clientId of this.clientNodeIds) {
          events.push({
            id: uuidv4(), timestamp: currentTimeMs,
            type: EventType.REQUEST_ARRIVE, sourceNodeId: clientId, targetNodeId: clientId, transaction: null,
          });
        }
        currentTimeMs += intervalMs;
      }
    }
    return events;
  }
}
