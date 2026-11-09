import { plan, positive } from "./plan.ts";
import { assemble, fetchBatch } from "./source.ts";
import type { Result, Source } from "./source.ts";

export interface Options {
  readonly batchSize?: number;
}

export class Loader<V> {
  readonly #source: Source<V>;
  readonly #batchSize: number;

  constructor(source: Source<V>, options: Options = {}) {
    this.#source = source;
    this.#batchSize = positive(options.batchSize ?? 50, "batchSize");
  }

  async load(keys: Iterable<string>): Promise<Result<V>[]> {
    const request = plan(keys, this.#batchSize);
    const values = new Map<string, V>();
    for (const batch of request.batches) {
      const rows = await fetchBatch(this.#source, batch);
      for (const [key, value] of rows) values.set(key, value);
    }
    return assemble(request.input, values);
  }
}
