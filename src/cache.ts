import type { Loader } from "./loader.ts";
import type { Result } from "./source.ts";
import { validateKey } from "./plan.ts";

interface Entry<V> {
  readonly result: Result<V>;
  readonly expires: number;
}

export class LookupCache<V> {
  readonly #loader: Loader<V>;
  readonly #ttl: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry<V>>();

  constructor(loader: Loader<V>, ttlMs: number, now = Date.now) {
    if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new RangeError("invalid TTL");
    this.#loader = loader;
    this.#ttl = ttlMs;
    this.#now = now;
  }

  invalidate(key: string): void {
    this.#entries.delete(validateKey(key));
  }

  async load(input: Iterable<string>): Promise<Result<V>[]> {
    const keys = Array.from(input, validateKey);
    const resolved = new Map<string, Result<V>>();
    const missing = new Set<string>();
    const time = this.#now();
    for (const key of keys) {
      const entry = this.#entries.get(key);
      if (entry && time < entry.expires) resolved.set(key, entry.result);
      else missing.add(key);
    }
    if (missing.size) {
      const results = await this.#loader.load(missing);
      const expires = this.#now() + this.#ttl;
      for (const result of results) {
        resolved.set(result.key, result);
        this.#entries.set(result.key, { result, expires });
      }
    }
    return keys.map(key => ({...resolved.get(key)!}));
  }
}
