import test from "node:test";
import assert from "node:assert/strict";
import { Loader, LookupCache } from "../src/index.ts";
import type { Source } from "../src/index.ts";

function gate() {
  let open!: () => void;
  const promise = new Promise<void>(resolve => { open = resolve; });
  return { promise, open };
}

/** A price backend whose first call can be held open, recording every request. */
function priceBackend(prices: Map<string, number>, hold?: Promise<void>) {
  const calls: string[][] = [];
  const source: Source<number> = async keys => {
    calls.push([...keys]);
    const snapshot = new Map(prices);
    if (hold && calls.length === 1) await hold;
    return keys.filter(key => snapshot.has(key)).map(key => ({ key, value: snapshot.get(key)! }));
  };
  return { source, calls };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test("a fetch started before invalidate does not refill the cache", async () => {
  const prices = new Map([["sku-12", 1999]]);
  const held = gate();
  const { source, calls } = priceBackend(prices, held.promise);
  const cache = new LookupCache(new Loader(source), 60_000, () => 0);

  const first = cache.load(["sku-12"]);
  await tick();
  prices.set("sku-12", 2199);
  cache.invalidate("sku-12");
  held.open();
  assert.deepEqual(await first, [{ key: "sku-12", found: true, value: 1999 }]);

  assert.deepEqual(await cache.load(["sku-12"]), [{ key: "sku-12", found: true, value: 2199 }]);
  assert.equal(calls.length, 2);
});

test("an older fetch finishing last does not overwrite a newer entry", async () => {
  const prices = new Map([["sku-12", 1999]]);
  const held = gate();
  const { source, calls } = priceBackend(prices, held.promise);
  const cache = new LookupCache(new Loader(source), 60_000, () => 0);

  const older = cache.load(["sku-12"]);
  await tick();
  prices.set("sku-12", 2199);
  cache.invalidate("sku-12");
  assert.deepEqual(await cache.load(["sku-12"]), [{ key: "sku-12", found: true, value: 2199 }]);
  held.open();
  await older;

  assert.deepEqual(await cache.load(["sku-12"]), [{ key: "sku-12", found: true, value: 2199 }]);
  assert.equal(calls.length, 2);
});

test("a changed value is served only after the TTL elapses", async () => {
  let time = 0;
  const prices = new Map([["sku-12", 1999]]);
  const { source } = priceBackend(prices);
  const cache = new LookupCache(new Loader(source), 60_000, () => time);

  await cache.load(["sku-12"]);
  prices.set("sku-12", 2199);
  time = 59_999;
  assert.deepEqual(await cache.load(["sku-12"]), [{ key: "sku-12", found: true, value: 1999 }]);
  time = 60_000;
  assert.deepEqual(await cache.load(["sku-12"]), [{ key: "sku-12", found: true, value: 2199 }]);
});

test("the least recently used entry is evicted at the size limit", async () => {
  const prices = new Map([["sku-12", 1999], ["sku-40", 650], ["sku-77", 900]]);
  const { source, calls } = priceBackend(prices);
  const cache = new LookupCache(new Loader(source), 60_000, () => 0, 2);

  await cache.load(["sku-12"]);
  await cache.load(["sku-40"]);
  await cache.load(["sku-12"]);          // hit: sku-12 becomes most recently used
  await cache.load(["sku-77"]);          // over the limit: evicts sku-40
  assert.equal(cache.size, 2);
  calls.length = 0;
  await cache.load(["sku-12", "sku-77"]);
  assert.deepEqual(calls, []);
  await cache.load(["sku-40"]);
  assert.deepEqual(calls, [["sku-40"]]);
});

test("expired entries are removed when looked up", async () => {
  let time = 0;
  const { source } = priceBackend(new Map([["sku-12", 1999]]));
  const cache = new LookupCache(new Loader(source), 1_000, () => time);
  await cache.load(["sku-12", "sku-99"]);
  assert.equal(cache.size, 2);
  time = 1_000;
  const pending = cache.load(["sku-12"]);
  assert.equal(cache.size, 1);           // expired sku-12 removed on lookup; sku-99 was not looked up
  await pending;
});

test("the cache never holds more than maxEntries", async () => {
  const { source } = priceBackend(new Map());
  const cache = new LookupCache(new Loader(source), 60_000, () => 0, 100);
  for (let i = 0; i < 1_000; i++) await cache.load(["sku-" + i]);
  assert.equal(cache.size, 100);
});

test("maxEntries must be a positive integer", () => {
  const loader = new Loader<number>(async () => []);
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => new LookupCache(loader, 1_000, Date.now, bad), RangeError);
  }
});
