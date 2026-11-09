import { plan, positive } from "./plan.ts";
import { assemble, fetchBatch } from "./source.ts";
import type { Result, Source } from "./source.ts";

export interface Options {
  readonly batchSize?: number;
  readonly concurrency?: number;
}

export class Loader<V> {
  readonly #source: Source<V>;
  readonly #batchSize: number;
  readonly #concurrency: number;

  constructor(source: Source<V>, options: Options = {}) {
    this.#source = source;
    this.#concurrency = positive(options.concurrency ?? 1, "concurrency");
    this.#batchSize = positive(options.batchSize ?? 50, "batchSize");
  }

  async load(keys: Iterable<string>): Promise<Result<V>[]> {
    const request = plan(keys, this.#batchSize);
    const values = new Map<string, V>();
    let cursor = 0;
    let failed = false;
    const worker = async () => {
      while (!failed && cursor < request.batches.length) {
        const batch = request.batches[cursor++];
        try {
          const rows = await fetchBatch(this.#source, batch);
          for (const [key, value] of rows) values.set(key, value);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    };
    const count = Math.min(this.#concurrency, request.batches.length);
    const results = await Promise.allSettled(Array.from({length:count}, worker));
    const failure = results.find(result => result.status === "rejected");
    if (failure) throw failure.reason;
    return assemble(request.input, values);
  }
}
