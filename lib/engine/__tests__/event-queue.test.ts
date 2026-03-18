import { describe, it, expect } from "vitest";
import { EventQueue } from "../event-queue";
import { EventType } from "../models";

function makeEvent(id: string, timestamp: number) {
  return {
    id, timestamp, type: EventType.REQUEST_ARRIVE,
    sourceNodeId: "a", targetNodeId: "b", transaction: null,
  };
}

describe("EventQueue", () => {
  it("returns events in timestamp order", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("3", 30));
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 20));
    expect(q.dequeue()!.id).toBe("1");
    expect(q.dequeue()!.id).toBe("2");
    expect(q.dequeue()!.id).toBe("3");
  });

  it("returns undefined when empty", () => {
    const q = new EventQueue();
    expect(q.dequeue()).toBeUndefined();
  });

  it("reports correct size", () => {
    const q = new EventQueue();
    expect(q.size).toBe(0);
    q.enqueue(makeEvent("1", 10));
    expect(q.size).toBe(1);
    q.dequeue();
    expect(q.size).toBe(0);
  });

  it("peeks without removing", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 5));
    expect(q.peek()!.id).toBe("2");
    expect(q.size).toBe(2);
  });

  it("cancels an event by id", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 20));
    q.cancel("1");
    expect(q.dequeue()!.id).toBe("2");
    expect(q.dequeue()).toBeUndefined();
  });

  it("clears all events", () => {
    const q = new EventQueue();
    q.enqueue(makeEvent("1", 10));
    q.enqueue(makeEvent("2", 20));
    q.clear();
    expect(q.size).toBe(0);
  });

  it("handles many events correctly", () => {
    const q = new EventQueue();
    const timestamps = Array.from({ length: 100 }, () => Math.random() * 1000);
    timestamps.forEach((t, i) => q.enqueue(makeEvent(String(i), t)));
    const sorted = [...timestamps].sort((a, b) => a - b);
    sorted.forEach((t) => {
      expect(q.dequeue()!.timestamp).toBe(t);
    });
  });
});
