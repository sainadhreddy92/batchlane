import test from "node:test";
import assert from "node:assert/strict";
import { Loader } from "../src/index.ts";

test("independent batches overlap up to the configured limit", async () => {
  let active = 0, peak = 0;
  const loader = new Loader(async keys => {
    peak = Math.max(peak, ++active);
    await Promise.resolve();
    active--;
    return keys.map(key => ({key, value:key}));
  }, {batchSize:1, concurrency:2});
  const rows = await loader.load(["c","b","a","c"]);
  assert.equal(peak, 2);
  assert.deepEqual(rows.map(r => r.key), ["c","b","a","c"]);
});

test("failed operations do not start their remaining batches", async () => {
  const calls: string[] = [];
  const loader = new Loader(async keys => {
    calls.push(keys[0]);
    throw new Error("source offline");
  }, {batchSize:1, concurrency:2});
  await assert.rejects(loader.load(["a","b","c","d"]), /source offline/);
  assert.deepEqual(calls, ["a","b"]);
});
