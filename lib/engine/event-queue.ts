import { SimEvent } from "./models";

export class EventQueue {
  private heap: SimEvent[] = [];
  private cancelled = new Set<string>();

  get size(): number {
    return this.heap.length;
  }

  enqueue(event: SimEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): SimEvent | undefined {
    while (this.heap.length > 0) {
      const top = this.heap[0];
      if (this.heap.length === 1) {
        this.heap.pop();
      } else {
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
      }
      if (this.cancelled.has(top.id)) {
        this.cancelled.delete(top.id);
        continue;
      }
      return top;
    }
    return undefined;
  }

  peek(): SimEvent | undefined {
    while (this.heap.length > 0 && this.cancelled.has(this.heap[0].id)) {
      this.dequeue();
    }
    return this.heap[0];
  }

  cancel(eventId: string): void {
    this.cancelled.add(eventId);
  }

  clear(): void {
    this.heap = [];
    this.cancelled.clear();
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].timestamp <= this.heap[index].timestamp) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

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
