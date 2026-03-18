import { v4 as uuidv4 } from "uuid";
import { SimEvent, EventType, HealthStatus } from "../models";

export class HealthChecker {
  private failureCounts = new Map<string, number>();

  createHealthCheckEvent(sourceNodeId: string, targetNodeId: string, currentTime: number, intervalMs: number): SimEvent {
    return { id: uuidv4(), timestamp: currentTime + intervalMs, type: EventType.HEALTH_CHECK, sourceNodeId, targetNodeId, transaction: null };
  }

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
    if (count >= Math.ceil(failureThreshold / 2)) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }
}
