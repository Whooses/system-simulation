import { v4 as uuidv4 } from "uuid";
import { Scenario, SimEvent, EventType } from "./models";

/**
 * Converts a {@link Scenario} definition into a set of seed events
 * that kick off the simulation.
 *
 * Walks through each scenario phase, honoring ramp-up periods,
 * and generates one REQUEST_ARRIVE event per client node at each
 * tick interval determined by the phase's request rate.
 */
export class ScenarioRunner {
  private scenario: Scenario;
  private clientNodeIds: string[];

  constructor(scenario: Scenario, clientNodeIds: string[]) {
    this.scenario = scenario;
    this.clientNodeIds = clientNodeIds;
  }

  /**
   * Pre-generate all initial request events for every phase in the scenario.
   * These are injected into the engine's event queue before the simulation starts.
   */
  generateInitialEvents(): SimEvent[] {
    const events: SimEvent[] = [];
    for (const phase of this.scenario.phases) {
      // Convert scenario seconds to simulation milliseconds
      const phaseStartMs = phase.startTime * 1000;
      const phaseDurationMs = phase.duration * 1000;
      const rampUpMs = (phase.rampUp ?? 0) * 1000;
      let currentTimeMs = phaseStartMs;
      const phaseEndMs = phaseStartMs + phaseDurationMs;

      while (currentTimeMs < phaseEndMs) {
        // During ramp-up, linearly interpolate from 0 to the target rate
        let currentRate: number;
        const elapsed = currentTimeMs - phaseStartMs;
        if (rampUpMs > 0 && elapsed < rampUpMs) {
          currentRate = phase.requestRate * (elapsed / rampUpMs);
        } else {
          currentRate = phase.requestRate;
        }
        if (currentRate <= 0) { currentTimeMs += 100; continue; }
        const intervalMs = 1000 / currentRate;

        // Emit one request per client node at this tick
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
