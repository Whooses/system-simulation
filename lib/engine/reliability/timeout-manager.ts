import { v4 as uuidv4 } from "uuid";
import { SimEvent, EventType } from "../models";

export class TimeoutManager {
  private pending = new Map<string, string>();

  createTimeout(requestId: string, sourceNodeId: string, replyToNodeId: string, currentTime: number, timeoutMs: number): SimEvent {
    const eventId = uuidv4();
    this.pending.set(requestId, eventId);
    return { id: eventId, timestamp: currentTime + timeoutMs, type: EventType.TIMEOUT, sourceNodeId, targetNodeId: replyToNodeId, transaction: null };
  }

  hasPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  resolve(requestId: string): string | undefined {
    const eventId = this.pending.get(requestId);
    this.pending.delete(requestId);
    return eventId;
  }
}
