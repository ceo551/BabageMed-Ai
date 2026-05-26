interface Entry<T> {
  v: T;
  exp: number;
}

/**
 * Bounded LRU cache with per-entry TTL.
 *
 * - `get` bumps the entry to the most-recently-used slot by
 *   `delete + set`, so the cap evicts the least-recently-USED key (not
 *   the first inserted). Previously the cache evicted by insertion order
 *   which silently dropped hot keys whenever a cold key crossed the cap.
 * - When `set` finds the cache full, it first sweeps any expired entries.
 *   Without this an expired-but-still-counted entry could push out a
 *   live one even when the live one is hotter.
 */
export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  constructor(private defaultTtlSec: number = 86400, private maxEntries: number = 5000) {}

  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.exp) {
      this.store.delete(key);
      return undefined;
    }
    // Bump recency: re-insert at the tail of the iteration order.
    this.store.delete(key);
    this.store.set(key, e);
    return e.v;
  }

  set(key: string, value: T, ttlSec?: number): void {
    // Refresh recency even on overwrite.
    if (this.store.has(key)) this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      this.sweepExpired();
    }
    while (this.store.size >= this.maxEntries) {
      const first = this.store.keys().next().value;
      if (!first) break;
      this.store.delete(first);
    }
    this.store.set(key, { v: value, exp: Date.now() + (ttlSec ?? this.defaultTtlSec) * 1000 });
  }

  private sweepExpired() {
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (now > e.exp) this.store.delete(k);
    }
  }

  async wrap(key: string, fn: () => Promise<T>, ttlSec?: number): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const v = await fn();
    this.set(key, v, ttlSec);
    return v;
  }
}
