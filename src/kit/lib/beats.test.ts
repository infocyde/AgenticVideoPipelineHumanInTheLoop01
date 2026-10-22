import assert from "node:assert/strict";
import { test } from "node:test";
import { extendBeats } from "./beats.ts";

test("extendBeats fills the start and end of the song at the detected spacing", () => {
  const out = extendBeats([10, 10.5, 11, 11.5, 12], 14);
  assert.ok(Math.abs(out[0] - 0.5) < 1e-9 || Math.abs(out[0]) < 1e-9, String(out[0]));
  assert.ok(out[0] >= 0 && out[0] < 0.5 + 1e-9);
  assert.ok(out.includes(10) && out.includes(12));
  assert.ok(out.at(-1)! <= 14 && out.at(-1)! > 13.4);
  out.slice(1).forEach((b, i) => assert.ok(b > out[i]));
});

test("extendBeats leaves a grid that already covers the song alone", () => {
  assert.deepEqual(extendBeats([0.2, 0.7, 1.2], 1.5), [0.2, 0.7, 1.2]);
});

test("extendBeats with fewer than two beats returns them unchanged", () => {
  assert.deepEqual(extendBeats([3], 10), [3]);
});
