import assert from "node:assert/strict";
import { test } from "node:test";
import { lyricWords, parseLyrics } from "./lyrics.ts";

test("strips tags and records sections", () => {
  const l = parseLyrics("[Verse 1]\nJekyll Island,\nFirst European War\n\n[Chorus]\nManaged Freedom");
  assert.deepEqual(
    l.lines.map((x) => x.text),
    ["Jekyll Island,", "First European War", "Managed Freedom"],
  );
  assert.deepEqual(l.sections, [
    { name: "Verse 1", line: 0 },
    { name: "Chorus", line: 2 },
  ]);
  assert.equal(l.lines[0].stanza, 0);
  assert.equal(l.lines[2].stanza, 1);
  assert.equal(l.lines[2].section, "Chorus");
});

test("keeps parenthesized echoes as words", () => {
  assert.deepEqual(parseLyrics("Empires Go (go go go)").lines[0].words, ["Empires", "Go", "(go", "go", "go)"]);
});

test("production tag with no lines after it", () => {
  assert.deepEqual(parseLyrics("Stay alive\n\n[power ballad]").sections.at(-1), { name: "power ballad", line: 1 });
});

test("trims trailing spaces and ignores CRLF", () => {
  const l = parseLyrics("Jekyll Island, \r\nIncome Taxes");
  assert.equal(l.lines.length, 2);
  assert.equal(l.lines[0].text, "Jekyll Island,");
});

test("lyricWords numbers lines", () => {
  assert.deepEqual(
    lyricWords(parseLyrics("A b\n\nC")).map((w) => w.line),
    [0, 0, 1],
  );
});

test("empty sheet", () => {
  assert.equal(parseLyrics("").lines.length, 0);
});
