export function positive(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer`);
  }
  return value;
}

export function validateKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("expected a nonempty string key");
  }
  return key;
}

export interface Plan {
  readonly input: readonly string[];
  readonly batches: readonly (readonly string[])[];
}

export function plan(input: Iterable<string>, size: number): Plan {
  positive(size, "batchSize");
  const keys = Array.from(input, validateKey);
  const distinct = [...new Set(keys)];
  const batches: string[][] = [];
  for (let i = 0; i < distinct.length; i += size) {
    batches.push(distinct.slice(i, i + size));
  }
  return { input: keys, batches };
}
