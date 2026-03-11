export class RecentMessageCache {
  private readonly maxEntries: number;
  private readonly seenAt = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(input: {
    maxEntries: number;
    ttlMs: number;
  }) {
    this.maxEntries = input.maxEntries;
    this.ttlMs = input.ttlMs;
  }

  public shouldProcess(messageId: string, now = Date.now()): boolean {
    this.pruneExpired(now);

    if (this.seenAt.has(messageId)) {
      this.seenAt.delete(messageId);
      this.seenAt.set(messageId, now);
      return false;
    }

    this.seenAt.set(messageId, now);
    this.pruneOverflow();
    return true;
  }

  private pruneExpired(now: number): void {
    for (const [messageId, seenAt] of this.seenAt) {
      if (now - seenAt <= this.ttlMs) {
        continue;
      }

      this.seenAt.delete(messageId);
    }
  }

  private pruneOverflow(): void {
    while (this.seenAt.size > this.maxEntries) {
      const firstKey = this.seenAt.keys().next().value;

      if (!firstKey) {
        return;
      }

      this.seenAt.delete(firstKey);
    }
  }
}
