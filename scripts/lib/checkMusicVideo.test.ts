import assert from "node:assert/strict";
import { test } from "node:test";
import { lyricsStale } from "./checkMusicVideo.ts";

const timing = {
  duration: 10,
  words: [
    { word: "Managed", start: 1, end: 1.5, line: 0 },
    { word: "Freedom", start: 1.5, end: 2, line: 0 },
    { word: "Empires", start: 3, end: 3.5, line: 1 },
  ],
};

test("lyricsStale is false for the sheet the timing came from", () => {
  assert.equal(lyricsStale("Managed Freedom\nEmpires", timing), false);
});

test("lyricsStale is true when a word changed", () => {
  assert.equal(lyricsStale("Managed Freedoms\nEmpires", timing), true);
});

test("lyricsStale is true when a line break moved", () => {
  assert.equal(lyricsStale("Managed\nFreedom Empires", timing), true);
});

test("lyricsStale ignores added tags and blank lines", () => {
  assert.equal(lyricsStale("[Chorus]\nManaged Freedom\n\n[Outro]\nEmpires\n\n[power ballad]", timing), false);
});
