export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

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

  shouldAllow(currentTime: number): boolean {
    switch (this._state) {
      case "CLOSED":
        return true;
      case "OPEN":
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

  reset(): void {
    this._state = "CLOSED";
    this.failureCount = 0;
    this.probeCount = 0;
  }
}
