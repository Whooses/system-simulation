import { SimEvent } from "./models";

/**
 * Min-heap priority queue ordered by event timestamp.
 *
 * Supports lazy cancellation: cancelled event IDs are tracked in a set
 * and silently skipped during {@link dequeue}, avoiding an O(n) removal.
 */
export class EventQueue {
  private heap: SimEvent[] = [];
  /** Lazy-cancel set — events here are skipped on dequeue rather than removed in-place. */
  private cancelled = new Set<string>();

  get size(): number {
    return this.heap.length;
  }

  // === Public API ===

  /** Insert an event into the heap in O(log n) time. */
  enqueue(event: SimEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the earliest event.
   * Skips any events that were lazily cancelled.
   * @returns The next valid event, or `undefined` if the queue is empty.
   */
  dequeue(): SimEvent | undefined {
    while (this.heap.length > 0) {
      const top = this.heap[0];
      if (this.heap.length === 1) {
        this.heap.pop();
      } else {
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
      }
      // Skip lazily-cancelled events
      if (this.cancelled.has(top.id)) {
        this.cancelled.delete(top.id);
        continue;
      }
      return top;
    }
    return undefined;
  }

  /** Peek at the next non-cancelled event without removing it. */
  peek(): SimEvent | undefined {
    while (this.heap.length > 0 && this.cancelled.has(this.heap[0].id)) {
      this.dequeue();
    }
    return this.heap[0];
  }

  /** Mark an event for lazy cancellation (it will be skipped on dequeue). */
  cancel(eventId: string): void {
    this.cancelled.add(eventId);
  }

  /** Remove all events and clear the cancellation set. */
  clear(): void {
    this.heap = [];
    this.cancelled.clear();
  }

  // === Heap Internals ===

  /** Restore heap property upward after an insert. */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].timestamp <= this.heap[index].timestamp) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  /** Restore heap property downward after a removal. */
  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < length && this.heap[left].timestamp < this.heap[smallest].timestamp) {
        smallest = left;
      }
      if (right < length && this.heap[right].timestamp < this.heap[smallest].timestamp) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}
