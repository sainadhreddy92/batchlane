import test from "node:test";
import assert from "node:assert/strict";
import { Loader, LookupCache } from "../src/index.ts";

test("positive and negative results expire at the boundary", async () => {
  let time = 10;
  const calls: string[][] = [];
  const cache = new LookupCache(new Loader(async keys => {
    calls.push([...keys]);
    return keys.filter(key => key === "a").map(key => ({key, value:0}));
  }), 5, () => time);
  await cache.load(["a","b"]);
  time = 14;
  assert.deepEqual((await cache.load(["b","a","b"])).map(r => r.found), [false,true,false]);
  time = 15;
  await cache.load(["b"]);
  assert.deepEqual(calls, [["a","b"],["b"]]);
});

test("invalidating one cached key forces a fresh lookup", async () => {
  let version = 0;
  const cache = new LookupCache(new Loader(async keys =>
    keys.map(key => ({key, value:++version}))), 100, () => 0);
  await cache.load(["x"]);
  cache.invalidate("x");
  assert.deepEqual(await cache.load(["x"]), [{key:"x", found:true, value:2}]);
});
