import { v4 as uuidv4 } from "uuid";
import { SimEvent, EventType } from "../models";

/**
 * Manages request timeouts by scheduling TIMEOUT events and
 * tracking which requests are still pending.
 *
 * When a response arrives before the timeout, call {@link resolve}
 * to get the timeout event ID (so it can be cancelled via the queue).
 */
export class TimeoutManager {
  /** Maps request ID → timeout event ID for in-flight requests. */
  private pending = new Map<string, string>();

  /** Schedule a TIMEOUT event and track the request as pending. */
  createTimeout(requestId: string, sourceNodeId: string, replyToNodeId: string, currentTime: number, timeoutMs: number): SimEvent {
    const eventId = uuidv4();
    this.pending.set(requestId, eventId);
    return { id: eventId, timestamp: currentTime + timeoutMs, type: EventType.TIMEOUT, sourceNodeId, targetNodeId: replyToNodeId, transaction: null };
  }

  /** Check if a request is still awaiting a response. */
  hasPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /** Remove a request from pending and return its timeout event ID for cancellation. */
  resolve(requestId: string): string | undefined {
    const eventId = this.pending.get(requestId);
    this.pending.delete(requestId);
    return eventId;
  }
}
