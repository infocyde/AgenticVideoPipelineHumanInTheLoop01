import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseJson3,
  formatTranscript,
  firstWords,
  pickCaptions,
  classifyLicense,
  parseTimestamp,
  validateRange,
  searchHits,
  type VideoInfo,
} from "./youtube";

const ev = (tStartMs: number, utf8: string) => ({ tStartMs, dDurationMs: 2000, segs: [{ utf8 }] });

test("parseJson3 removes rolling auto-caption duplicates", () => {
  const lines = parseJson3({
    events: [
      { tStartMs: 0, dDurationMs: 1000 }, // no segs
      ev(0, "hello world"),
      { tStartMs: 1000, dDurationMs: 500, segs: [{ utf8: "\n" }], aAppend: 1 },
      ev(1000, "hello world this is"),
      ev(2000, "this is a test"),
    ],
  });
  assert.ok(lines.length <= 2);
  const words = lines.map((l) => l.text).join(" ");
  assert.equal(words, "hello world this is a test");
  assert.equal(lines[0].start, 0);
});

test("parseJson3 joins segs, collapses whitespace, strips sound cues", () => {
  const lines = parseJson3({
    events: [
      { tStartMs: 500, segs: [{ utf8: "  so  " }, { utf8: "this", tOffsetMs: 200 }, { utf8: " works" }] },
      ev(3000, "[Music]"),
      ev(4000, "(applause) thanks"),
    ],
  });
  assert.deepEqual(lines, [
    { start: 0.5, text: "so this works" },
    { start: 4, text: "thanks" },
  ]);
});

test("parseJson3 tolerates junk", () => {
  assert.deepEqual(parseJson3(null), []);
  assert.deepEqual(parseJson3({}), []);
});

test("formatTranscript groups ~20 s paragraphs with timestamps", () => {
  const out = formatTranscript([
    { start: 0, text: "one" },
    { start: 10, text: "two" },
    { start: 25, text: "three" },
    { start: 3605, text: "late" },
  ]);
  assert.equal(out, "[00:00] one two\n\n[00:25] three\n\n[1:00:05] late");
});

test("firstWords truncates to n words and drops timestamps", () => {
  const text = "[00:00] " + Array.from({ length: 500 }, (_, i) => `w${i}`).join(" ");
  const out = firstWords(text, 300);
  assert.equal(out.endsWith("…"), true);
  assert.equal(out.slice(0, -1).split(" ").length, 300);
  assert.equal(out.includes("[00:00]"), false);
  assert.equal(firstWords("[00:01] a b", 5), "a b");
});

const track = (url: string, ext = "json3") => ({ ext, url });
const base: VideoInfo = { id: "x", title: "t", channel: "c" };

test("pickCaptions prefers manual en-*, then auto en/en-orig, last resort translated", () => {
  const manual = pickCaptions({
    ...base,
    subtitles: { "en-GB": [track("m"), track("m-vtt", "vtt")] },
    automatic_captions: { en: [track("a")] },
  });
  assert.deepEqual(manual, { lang: "en-GB", kind: "manual", url: "m" });

  const auto = pickCaptions({ ...base, automatic_captions: { "en-orig": [track("o")], fr: [track("f")] } });
  assert.deepEqual(auto, { lang: "en-orig", kind: "auto", url: "o" });

  const translated = pickCaptions({ ...base, automatic_captions: { "fr-en": [track("t")], de: [track("d")] } });
  assert.deepEqual(translated, { lang: "fr-en", kind: "auto", url: "t" });

  assert.equal(pickCaptions({ ...base, subtitles: { fr: [track("f")] } }), null);
  assert.equal(pickCaptions({ ...base, subtitles: { en: [track("v", "vtt")] } }), null);
});

test("classifyLicense", () => {
  assert.equal(classifyLicense({ ...base, license: "Creative Commons Attribution license (reuse allowed)" }), "cc-by");
  assert.equal(classifyLicense(base), "standard");
  assert.equal(classifyLicense({ ...base, license: "Standard YouTube License" }), "standard");
});

test("parseTimestamp", () => {
  assert.equal(parseTimestamp("83"), 83);
  assert.equal(parseTimestamp("83.5"), 83.5);
  assert.equal(parseTimestamp("1:23"), 83);
  assert.equal(parseTimestamp("1:02:03"), 3723);
  for (const bad of ["1:2:3:4", "", "abc", "1:xx", "-5", "1:-2"]) assert.throws(() => parseTimestamp(bad), bad);
});

test("validateRange", () => {
  assert.match(validateRange(10, 5, 100)!, /after/);
  assert.match(validateRange(0, 20, 100)!, /15/);
  assert.match(validateRange(95, 101, 100)!, /100/);
  assert.equal(validateRange(10, 18, 100), null);
});

test("searchHits maps flat-playlist entries", () => {
  const hits = searchHits({
    entries: [
      { id: "abc", title: "A", channel: "Chan", duration: 61, url: "https://www.youtube.com/watch?v=abc", upload_date: "20240105", view_count: 7 },
      { id: "def", title: "B", uploader: "Up", duration: null },
      { title: "no id" },
    ],
  });
  assert.deepEqual(hits, [
    { id: "abc", title: "A", channel: "Chan", duration: 61, url: "https://www.youtube.com/watch?v=abc", uploadDate: "2024-01-05", views: 7 },
    { id: "def", title: "B", channel: "Up", duration: 0, url: "https://www.youtube.com/watch?v=def" },
  ]);
  assert.deepEqual(searchHits(undefined), []);
});
