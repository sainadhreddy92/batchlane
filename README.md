# Batchlane

Batchlane helps applications hydrate lists of IDs from a backend that supports bulk reads. Give it the IDs in display order. It requests each distinct key once, breaks large requests into batches, and reconstructs one result per input. Missing rows are explicit.

## Quick start

Use Node.js 24 or newer. From this checkout, run `npm test`.

```ts
import { Loader } from "./src/index.ts";

const products = new Map([["tea", 450], ["coffee", 525]]);
const loader = new Loader<number>(async keys =>
  keys.filter(key => products.has(key)).map(key => ({key, value: products.get(key)!})),
  { batchSize: 50 },
);

const prices = await loader.load(["tea", "sold-out", "tea"]);
console.log(prices);
// [{key:"tea", found:true, value:450}, {key:"sold-out", found:false},
//  {key:"tea", found:true, value:450}]
```

## Data-source contract

A source returns key/value rows in any order and omits missing keys. Returning two rows for one key or a row outside the requested batch raises a SourceError. A present value can be falsy, including undefined. A source rejection rejects the load. Batchlane treats nonempty string keys as opaque and uses exact string equality.

## Execution

Each load snapshots its input, partitions distinct keys in first-seen order, and awaits one source call at a time. Results follow the original input order, including duplicates. Independent loads can overlap. The default batch size is 50. Values are passed by reference; applications own their mutability.

The public Loader is in `src/loader.ts`, request planning in `src/plan.ts`, and response validation in `src/source.ts`.
