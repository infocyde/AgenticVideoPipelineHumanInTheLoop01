import assert from "node:assert/strict";
import { test } from "node:test";
import { placeUnmatched } from "./placeUnmatched.ts";

const near = (a: number[][], b: number[][]) =>
  a.forEach((p, i) => p.forEach((x, k) => assert.ok(Math.abs(x - b[i][k]) < 1e-9, `word ${i}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)));

test("interpolates a gap inside one line", () => {
  near(placeUnmatched([[1, 1.5], null, [2.5, 3]], [0, 0, 0], 10), [[1, 1.5], [1.5, 2.5], [2.5, 3]]);
});

test("does not spread unheard words across an instrumental", () => {
  // words 1-2 begin line 1, sung right before "heard" word 3 at 40 s; the 38 s before is instrumental
  near(placeUnmatched([[1, 1.5], null, null, [40, 40.5]], [0, 1, 1, 1], 60), [[1, 1.5], [39.3, 39.65], [39.65, 40], [40, 40.5]]);
});

test("trailing unmatched words follow the last heard word", () => {
  near(placeUnmatched([[1, 1.5], null], [0, 0], 10), [[1, 1.5], [1.5, 1.85]]);
});

test("leading unmatched words clamp at 0 and stay in order", () => {
  const out = placeUnmatched([null, null, [0.3, 0.6]], [0, 0, 0], 10);
  assert.ok(out[0][0] >= 0);
  assert.ok(out[0][1] <= out[1][0] + 1e-9);
  assert.ok(out[1][1] <= 0.3 + 1e-9);
});

test("never runs past the song's end", () => {
  const out = placeUnmatched([[9.8, 9.9], null, null], [0, 0, 0], 10);
  assert.ok(out[2][1] <= 10 + 1e-9);
});

test("no heard words at all spreads evenly over the song", () => {
  near(placeUnmatched([null, null], [0, 0], 10), [[0, 5], [5, 10]]);
});
