export class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Invalidate exact key or all keys with prefix. */
  invalidate(keyOrPrefix?: string): void {
    if (!keyOrPrefix) {
      this.store.clear();
      return;
    }
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
      return;
    }
    for (const k of this.store.keys()) {
      if (k.startsWith(keyOrPrefix)) this.store.delete(k);
    }
  }

  size(): number {
    return this.store.size;
  }
}
