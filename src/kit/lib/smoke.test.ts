import assert from "node:assert/strict";
import { test } from "node:test";
import { findPhrase } from "./timing.ts";

test("findPhrase matches a prefix on the last word", () => {
  const words = [
    { word: "Managed", start: 1, end: 1.4 },
    { word: "Freedom", start: 1.4, end: 2 },
  ];
  assert.equal(findPhrase(words, "managed free")?.start, 1);
});
