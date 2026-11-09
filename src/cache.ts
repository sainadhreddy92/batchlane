import type { Loader } from "./loader.ts";
import type { Result } from "./source.ts";
import { positive, validateKey } from "./plan.ts";

interface Entry<V> {
  readonly result: Result<V>;
  readonly expires: number;
}

/** Fetches in flight for one key, and how many times it was invalidated meanwhile. */
interface Pending {
  count: number;
  version: number;
}

export class LookupCache<V> {
  readonly #loader: Loader<V>;
  readonly #ttl: number;
  readonly #now: () => number;
  readonly #maxEntries: number;
  // Map iteration order doubles as recency order: least recently used first.
  readonly #entries = new Map<string, Entry<V>>();
  readonly #pending = new Map<string, Pending>();

  constructor(loader: Loader<V>, ttlMs: number, now = Date.now, maxEntries = 10_000) {
    if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new RangeError("invalid TTL");
    this.#loader = loader;
    this.#ttl = ttlMs;
    this.#now = now;
    this.#maxEntries = positive(maxEntries, "maxEntries");
  }

  /** Number of entries currently held, including any not yet looked up since expiring. */
  get size(): number {
    return this.#entries.size;
  }

  invalidate(key: string): void {
    validateKey(key);
    this.#entries.delete(key);
    const pending = this.#pending.get(key);
    if (pending) pending.version++;
  }

  async load(input: Iterable<string>): Promise<Result<V>[]> {
    const keys = Array.from(input, validateKey);
    const resolved = new Map<string, Result<V>>();
    const missing = new Set<string>();
    const time = this.#now();
    for (const key of keys) {
      if (resolved.has(key) || missing.has(key)) continue;
      const entry = this.#entries.get(key);
      if (entry && time < entry.expires) {
        resolved.set(key, entry.result);
        this.#entries.delete(key);
        this.#entries.set(key, entry);
      } else {
        if (entry) this.#entries.delete(key);
        missing.add(key);
      }
    }
    if (missing.size) {
      const started = new Map<string, number>();
      for (const key of missing) {
        let pending = this.#pending.get(key);
        if (!pending) this.#pending.set(key, pending = { count: 0, version: 0 });
        pending.count++;
        started.set(key, pending.version);
      }
      try {
        const results = await this.#loader.load(missing);
        const expires = this.#now() + this.#ttl;
        for (const result of results) {
          resolved.set(result.key, result);
          if (this.#pending.get(result.key)!.version === started.get(result.key)) {
            this.#store(result.key, { result, expires });
          }
        }
      } finally {
        for (const key of missing) {
          const pending = this.#pending.get(key)!;
          if (--pending.count === 0) this.#pending.delete(key);
        }
      }
    }
    return keys.map(key => ({...resolved.get(key)!}));
  }

  #store(key: string, entry: Entry<V>): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    while (this.#entries.size > this.#maxEntries) {
      this.#entries.delete(this.#entries.keys().next().value!);
    }
  }
}
