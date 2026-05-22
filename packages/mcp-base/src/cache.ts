interface Entry<T> {
  v: T;
  exp: number;
}

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
    return e.v;
  }

  set(key: string, value: T, ttlSec?: number): void {
    if (this.store.size >= this.maxEntries) {
      const first = this.store.keys().next().value;
      if (first) this.store.delete(first);
    }
    this.store.set(key, { v: value, exp: Date.now() + (ttlSec ?? this.defaultTtlSec) * 1000 });
  }

  async wrap(key: string, fn: () => Promise<T>, ttlSec?: number): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const v = await fn();
    this.set(key, v, ttlSec);
    return v;
  }
}
