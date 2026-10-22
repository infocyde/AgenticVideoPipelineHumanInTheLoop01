import assert from "node:assert/strict";
import { test } from "node:test";
import { activeChunk, type Chunk } from "./timing.ts";

const w = (word: string, start: number, end: number) => ({ word, start, end });
const chunks: Chunk[] = [
  { words: [w("exposing", 96.0, 96.4), w("data", 96.4, 96.8), w("on", 96.8, 97.0), w("about", 97.0, 97.5)], start: 96.0, end: 97.5 },
  { words: [w("sixty-eight", 97.56, 98.3), w("thousand", 98.3, 98.8)], start: 97.56, end: 98.8 },
  { words: [w("President", 100.0, 100.5)], start: 100.0, end: 100.5 },
];

test("the next chunk replaces the previous one as soon as it starts, even inside the hold", () => {
  assert.equal(activeChunk(chunks, 97.6)?.start, 97.56);
  assert.equal(activeChunk(chunks, 97.52)?.start, 97.56); // 50 ms early
});

test("a chunk is held 0.25 s past its last word across a pause, then cleared", () => {
  assert.equal(activeChunk(chunks, 98.9)?.start, 97.56);
  assert.equal(activeChunk(chunks, 99.2), undefined);
  assert.equal(activeChunk(chunks, 95.0), undefined);
});
