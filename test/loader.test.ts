import test from "node:test";
import assert from "node:assert/strict";
import { Loader, SourceError } from "../src/index.ts";

test("plans unique keys then restores display order", async () => {
  const calls: string[][] = [];
  const loader = new Loader(async keys => {
    calls.push([...keys]);
    return keys.filter(key => key !== "b").reverse().map(key => ({key, value:key}));
  }, {batchSize:2});
  const result = await loader.load(["a","b","c","a"]);
  assert.deepEqual(calls, [["a","b"],["c"]]);
  assert.deepEqual(result.map(r => r.found ? r.value : null), ["a",null,"c","a"]);
});

test("explicit undefined still means found", async () => {
  const loader = new Loader(async () => [{key:"a",value:undefined}]);
  assert.deepEqual(await loader.load(["a","b"]), [
    {key:"a",found:true,value:undefined}, {key:"b",found:false},
  ]);
});

test("malformed source responses reject the operation", async () => {
  for (const keys of [["x"], ["a","a"]]) {
    const loader = new Loader(async () => keys.map(key => ({key,value:1})));
    await assert.rejects(loader.load(["a"]), SourceError);
  }
});

test("validates the full input before contacting the source", async () => {
  let calls = 0;
  const loader = new Loader(async () => { calls++; return []; }, {batchSize:1});
  await assert.rejects(loader.load(["a",""]), TypeError);
  assert.deepEqual(await loader.load([]), []);
  assert.equal(calls, 0);
});
