import test from "node:test";
import assert from "node:assert/strict";
import { Loader, SourceError, namespace } from "../src/index.ts";
import type { Source } from "../src/index.ts";

test("opaque scope and key pairs map to independent backend keys", async () => {
  const physical = new Set<string>();
  const source: Source<number> = async keys => {
    keys.forEach(key => physical.add(key));
    return keys.map(key => ({key, value:0}));
  };
  const a = new Loader(namespace("a/b", source));
  const b = new Loader(namespace("a", source));
  assert.deepEqual(await a.load(["c","c"]), Array(2).fill({key:"c",found:true,value:0}));
  await b.load(["b/c"]);
  assert.equal(physical.size, 2);
});

test("malformed physical responses reject before key translation", async () => {
  const loader = new Loader(namespace("inventory", async () => [{key:"tea",value:1}]));
  await assert.rejects(loader.load(["tea"]), SourceError);
});

test("missing physical keys preserve the public key", async () => {
  const loader = new Loader(namespace("inventory", async () => []));
  assert.deepEqual(await loader.load(["tea"]), [{key:"tea",found:false}]);
});
