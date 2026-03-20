// === Types ===

/** Three-state circuit breaker: CLOSED (healthy), OPEN (tripped), HALF_OPEN (probing). */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

// === Circuit Breaker ===

/**
 * Classic circuit breaker pattern for protecting downstream services.
 *
 * State transitions:
 *   CLOSED → OPEN: after `failureThreshold` consecutive failures
 *   OPEN → HALF_OPEN: after `resetTimeoutMs` elapses
 *   HALF_OPEN → CLOSED: on first successful probe
 *   HALF_OPEN → OPEN: on any failed probe
 */
export class CircuitBreaker {
  private _state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private failureThreshold: number;
  private resetTimeoutMs: number;
  private halfOpenMaxProbes: number;
  private probeCount = 0;

  constructor(failureThreshold: number, resetTimeoutMs: number, halfOpenMaxProbes: number) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxProbes = halfOpenMaxProbes;
  }

  get state(): CircuitState {
    return this._state;
  }

  // === Decision ===

  /** Check if a request should be allowed through based on current state and time. */
  shouldAllow(currentTime: number): boolean {
    switch (this._state) {
      case "CLOSED":
        return true;
      case "OPEN":
        // Transition to HALF_OPEN after the reset timeout elapses
        if (currentTime - this.lastFailureTime >= this.resetTimeoutMs) {
          this._state = "HALF_OPEN";
          this.probeCount = 0;
          return true;
        }
        return false;
      case "HALF_OPEN":
        return this.probeCount < this.halfOpenMaxProbes;
    }
  }

  // === Recording ===

  /** Record a request outcome and transition state accordingly. */
  recordResult(success: boolean, currentTime: number): void {
    if (this._state === "HALF_OPEN") {
      if (success) {
        this._state = "CLOSED";
        this.failureCount = 0;
      } else {
        this._state = "OPEN";
        this.lastFailureTime = currentTime;
      }
      return;
    }
    if (success) {
      this.failureCount = 0;
    } else {
      this.failureCount++;
      this.lastFailureTime = currentTime;
      if (this.failureCount >= this.failureThreshold) {
        this._state = "OPEN";
      }
    }
  }

  /** Reset to initial CLOSED state. */
  reset(): void {
    this._state = "CLOSED";
    this.failureCount = 0;
    this.probeCount = 0;
  }
}
