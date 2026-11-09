import { fetchBatch } from "./source.ts";
import type { Row, Source } from "./source.ts";

/** Fill absent rows from successive backends in priority order. */
export function fallback<V>(sources: Iterable<Source<V>>): Source<V> {
  const chain = Array.from(sources);
  return async keys => {
    const rows: Row<V>[] = [];
    let pending = [...new Set(keys)];
    for (const source of chain) {
      if (!pending.length) break;
      const found = await fetchBatch(source, pending);
      const remaining: string[] = [];
      for (const key of pending) {
        const value = found.get(key);
        if (value !== undefined) rows.push({key, value});
        else remaining.push(key);
      }
      pending = remaining;
    }
    return rows;
  };
}
