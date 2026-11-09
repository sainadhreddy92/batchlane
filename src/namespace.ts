import { validateKey } from "./plan.ts";
import { fetchBatch } from "./source.ts";
import type { Source } from "./source.ts";

/** Label keys at the source boundary while preserving public caller keys. */
export function namespace<V>(scope: string, source: Source<V>): Source<V> {
  validateKey(scope);
  return async keys => {
    const mapping = new Map<string, string>();
    for (const key of keys) {
      validateKey(key);
      mapping.set(JSON.stringify([scope, key]), key);
    }
    if (!mapping.size) return [];
    const physical = await fetchBatch(source, [...mapping.keys()]);
    return Array.from(physical, ([encoded, value]) => ({
      key: mapping.get(encoded)!,
      value,
    }));
  };
}
