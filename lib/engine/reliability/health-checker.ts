import { v4 as uuidv4 } from "uuid";
import { SimEvent, EventType, HealthStatus } from "../models";

/**
 * Tracks consecutive health-check failures per node and determines health status.
 *
 * Status transitions:
 *   HEALTHY → DEGRADED: at `ceil(threshold / 2)` consecutive failures
 *   DEGRADED → UNHEALTHY: at `threshold` consecutive failures
 *   Any → HEALTHY: on first successful check (resets counter)
 */
export class HealthChecker {
  /** Consecutive failure count per target node ID. */
  private failureCounts = new Map<string, number>();

  /** Create a HEALTH_CHECK event scheduled `intervalMs` in the future. */
  createHealthCheckEvent(sourceNodeId: string, targetNodeId: string, currentTime: number, intervalMs: number): SimEvent {
    return { id: uuidv4(), timestamp: currentTime + intervalMs, type: EventType.HEALTH_CHECK, sourceNodeId, targetNodeId, transaction: null };
  }

  /** Process a health check result and return the updated health status. */
  processHealthResult(targetNodeId: string, isHealthy: boolean, failureThreshold: number): HealthStatus {
    if (isHealthy) {
      this.failureCounts.set(targetNodeId, 0);
      return HealthStatus.HEALTHY;
    }
    const count = (this.failureCounts.get(targetNodeId) ?? 0) + 1;
    this.failureCounts.set(targetNodeId, count);
    if (count >= failureThreshold) {
      return HealthStatus.UNHEALTHY;
    }
    // Degraded at half the failure threshold
    if (count >= Math.ceil(failureThreshold / 2)) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }
}
