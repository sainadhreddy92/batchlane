export interface Row<V> {
  readonly key: string;
  readonly value: V;
}

export type Source<V> = (keys: readonly string[]) => Promise<readonly Row<V>[]>;

export type Result<V> =
  | { readonly key: string; readonly found: true; readonly value: V }
  | { readonly key: string; readonly found: false };

export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceError";
  }
}

export async function fetchBatch<V>(
  source: Source<V>,
  keys: readonly string[],
): Promise<Map<string, V>> {
  const expected = new Set(keys);
  const values = new Map<string, V>();
  const rows = await source(keys);
  for (const row of rows) {
    if (!expected.has(row.key)) throw new SourceError(`unexpected key: ${row.key}`);
    if (values.has(row.key)) throw new SourceError(`duplicate key: ${row.key}`);
    values.set(row.key, row.value);
  }
  return values;
}

export function assemble<V>(keys: readonly string[], values: ReadonlyMap<string, V>): Result<V>[] {
  return keys.map(key => values.has(key)
    ? { key, found: true, value: values.get(key)! }
    : { key, found: false });
}
