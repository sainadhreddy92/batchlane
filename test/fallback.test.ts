import test from "node:test";
import assert from "node:assert/strict";
import { fallback, Loader, SourceError } from "../src/index.ts";

test("only unresolved keys reach the secondary source", async () => {
  const calls: string[][] = [];
  const loader = new Loader(fallback<number>([
    async () => [{key:"a", value:0}],
    async keys => { calls.push([...keys]); return [{key:"b",value:7}]; },
  ]));
  const rows = await loader.load(["b","a","c","a"]);
  assert.deepEqual(calls, [["b","c"]]);
  assert.deepEqual(rows.map(r => r.found ? r.value : null), [7,0,null,0]);
});

test("a protocol error is not interpreted as a miss", async () => {
  let secondary = 0;
  const loader = new Loader(fallback([
    async () => [{key:"unexpected",value:1}],
    async () => { secondary++; return []; },
  ]));
  await assert.rejects(loader.load(["a"]), SourceError);
  assert.equal(secondary, 0);
});
