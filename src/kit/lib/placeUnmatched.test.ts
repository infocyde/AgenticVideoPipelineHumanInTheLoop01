import assert from "node:assert/strict";
import { test } from "node:test";
import { dropWeakAnchors, enforceOrder, placeUnmatched, reconcile } from "./placeUnmatched.ts";

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

test("enforceOrder trims a word that runs into the next", () => {
  near(enforceOrder([[1, 3], [2, 2.5]]), [[1, 2], [2, 2.5]]);
});

test("enforceOrder moves a word that starts before the previous one", () => {
  const out = enforceOrder([[5, 6], [4, 4.5], [7, 8]]);
  assert.ok(out[1][0] >= out[0][0] && out[1][0] >= 6 - 1e-9, JSON.stringify(out));
  assert.ok(out[1][1] > out[1][0]);
  assert.ok(out[2][0] >= out[1][1] - 1e-9);
});

test("enforceOrder leaves ordered words alone", () => {
  near(enforceOrder([[1, 2], [2, 3], [4, 5]]), [[1, 2], [2, 3], [4, 5]]);
});

test("reconcile keeps Whisper's time when MMS drifts far from a heard word", () => {
  near(reconcile([[289.67, 289.9]], [[294.53, 294.61]]), [[289.67, 289.9]]);
});

test("reconcile takes MMS when it agrees with Whisper or Whisper missed the word", () => {
  near(reconcile([[10, 10.4], null], [[10.2, 10.5], [11, 11.3]]), [[10.2, 10.5], [11, 11.3]]);
});

test("reconcile caps a word stretched over silence", () => {
  near(reconcile([[347.62, 348]], [[347.43, 361.29]]), [[347.43, 351.43]]);
});

test("unheard lines after the last heard word follow it, not the song's end", () => {
  const out = placeUnmatched([[300, 300.5], null, null, null], [5, 6, 6, 7], 381);
  near(out, [[300, 300.5], [300.5, 300.85], [300.85, 301.2], [301.2, 301.55]]);
});

test("dropWeakAnchors drops a short word heard alone, keeps runs and long words", () => {
  const words = ["Two", "choices", "out", "of", "Millions", "Gold", "at", "forty", "thousand", "lunch", "at"];
  const times: ([number, number] | null)[] = [null, null, [248.7, 249], null, null, null, null, null, [273, 273.4], [273.8, 273.9], [273.9, 274]];
  const out = dropWeakAnchors(times, words);
  assert.equal(out[2], null); // "out", alone and short: dropped
  assert.deepEqual(out[8], [273, 273.4]); // "thousand": long enough to trust alone
  assert.deepEqual(out[9], [273.8, 273.9]); // part of a heard run
  assert.deepEqual(out[10], [273.9, 274]);
});
