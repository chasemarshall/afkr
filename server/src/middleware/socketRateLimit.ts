interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface EventConfig {
  max: number;
  windowMs: number;
}

export class SocketEventRateLimiter {
  private store = new Map<string, Map<string, RateLimitEntry>>();

  isAllowed(socketId: string, eventName: string, config: EventConfig): boolean {
    const now = Date.now();
    let socketEntries = this.store.get(socketId);

    if (!socketEntries) {
      socketEntries = new Map<string, RateLimitEntry>();
      this.store.set(socketId, socketEntries);
    }

    let entry = socketEntries.get(eventName);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + config.windowMs };
      socketEntries.set(eventName, entry);
    }

    entry.count += 1;
    return entry.count <= config.max;
  }

  clearSocket(socketId: string): void {
    this.store.delete(socketId);
  }
}
