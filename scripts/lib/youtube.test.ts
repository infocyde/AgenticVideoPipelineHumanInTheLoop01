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
  videoId,
  isBlocked,
  clipCredit,
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

test("parseJson3 keeps spoken asides in parentheses, strips only sound cues", () => {
  const lines = parseJson3(
    {
      events: [
        ev(0, "costs rose (about 15%) last year"),
        ev(3000, "we flew (the F-35) there"),
        ev(6000, "(Laughter) (MUSIC PLAYING) (inaudible) right"),
      ],
    },
    "manual",
  );
  assert.deepEqual(
    lines.map((l) => l.text),
    ["costs rose (about 15%) last year", "we flew (the F-35) there", "right"],
  );
});

test("parseJson3 keeps a deliberately repeated line in manual captions", () => {
  const events = [ev(0, "No."), ev(1000, "No."), ev(2000, "No. Not today.")];
  assert.deepEqual(
    parseJson3({ events }, "manual").map((l) => l.text),
    ["No.", "No.", "No. Not today."],
  );
  assert.deepEqual(
    parseJson3({ events }, "auto").map((l) => l.text),
    ["No. Not today."],
  );
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

test("pickCaptions prefers manual en-*, then auto en/en-orig", () => {
  const manual = pickCaptions({
    ...base,
    subtitles: { "en-GB": [track("m"), track("m-vtt", "vtt")] },
    automatic_captions: { en: [track("a")] },
  });
  assert.deepEqual(manual, { lang: "en-GB", kind: "manual", url: "m" });

  const auto = pickCaptions({ ...base, automatic_captions: { "en-orig": [track("o")], fr: [track("f")] } });
  assert.deepEqual(auto, { lang: "en-orig", kind: "auto", url: "o" });

  assert.equal(pickCaptions({ ...base, automatic_captions: { "fr-en": [track("t")], de: [track("d")] } }), null);

  assert.equal(pickCaptions({ ...base, subtitles: { fr: [track("f")] } }), null);
  assert.equal(pickCaptions({ ...base, subtitles: { en: [track("v", "vtt")] } }), null);
});

// Shaped on yt-dlp -J for a non-English video: the speech's ASR track appears as `<xx>-orig` and `<xx>`, and every
// translation of it as a plain code (`en`, `de`, ...); translations of manual subtitles are `<code>-<src>`.
test("pickCaptions marks auto English on a non-English video as machine-translated", () => {
  const uk = pickCaptions({
    ...base,
    language: "uk",
    automatic_captions: { "uk-orig": [track("uo")], uk: [track("u")], en: [track("e")], de: [track("d")] },
  });
  assert.deepEqual(uk, { lang: "en", kind: "auto", url: "e", from: "uk" });
  // `language` alone (no -orig key), and the -orig key alone (language null), are each enough.
  assert.deepEqual(pickCaptions({ ...base, language: "ru", automatic_captions: { en: [track("e")] } }), { lang: "en", kind: "auto", url: "e", from: "ru" });
  assert.deepEqual(pickCaptions({ ...base, language: null, automatic_captions: { "ru-orig": [track("r")], en: [track("e")] } }), {
    lang: "en",
    kind: "auto",
    url: "e",
    from: "ru",
  });
  // A translation of manual Ukrainian subtitles.
  assert.deepEqual(pickCaptions({ ...base, automatic_captions: { "en-uk": [track("t")] } }), { lang: "en-uk", kind: "auto", url: "t", from: "uk" });
});

test("pickCaptions keeps auto English on an English video unmarked", () => {
  const en = { "en-orig": [track("o")], en: [track("e")], fr: [track("f")] };
  assert.deepEqual(pickCaptions({ ...base, language: "en", automatic_captions: en }), { lang: "en", kind: "auto", url: "e" });
  assert.deepEqual(pickCaptions({ ...base, language: "en-US", automatic_captions: { en: [track("e")] } }), { lang: "en", kind: "auto", url: "e" });
  // An English ASR track beats a translation of manual subtitles.
  assert.deepEqual(pickCaptions({ ...base, automatic_captions: { "en-uk": [track("t")], "en-orig": [track("o")] } }), { lang: "en-orig", kind: "auto", url: "o" });
  // A manual English track still wins on a non-English video.
  assert.deepEqual(pickCaptions({ ...base, language: "uk", subtitles: { en: [track("m")] }, automatic_captions: { "uk-orig": [track("u")], en: [track("e")] } }), {
    lang: "en",
    kind: "manual",
    url: "m",
  });
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

test("videoId accepts a bare id and the usual YouTube URL shapes", () => {
  assert.equal(videoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://m.youtube.com/watch?feature=share&v=a-b_c1234XY"), "a-b_c1234XY");
  assert.equal(videoId("https://youtu.be/dQw4w9WgXcQ?si=x"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("short"), null);
  assert.equal(videoId("https://vimeo.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(videoId("https://www.youtube.com/@nasa"), null);
});

test("isBlocked spots YouTube's bot check and rate limiting only", () => {
  assert.ok(isBlocked("ERROR: [youtube] abc: Sign in to confirm you're not a bot. Use --cookies"));
  assert.ok(isBlocked("ERROR: [youtube] abc: Sign in to confirm you’re not a bot"));
  assert.ok(isBlocked("ERROR: unable to download video data: HTTP Error 429: Too Many Requests"));
  assert.ok(!isBlocked("ERROR: [youtube] abc: Video unavailable"));
  assert.ok(!isBlocked(""));
});

test("clipCredit builds the CC BY and PD credit shapes", () => {
  const info = { id: "abc123def45", title: "Launch", channel: "NASA" } as VideoInfo;
  assert.deepEqual(clipCredit(info, "launch", 83, 89.5, { license: "CC BY" }), {
    file: "clips/launch.mp4",
    title: "Launch",
    author: "NASA",
    license: "CC BY",
    licenseVersion: "3.0",
    sourceUrl: "https://www.youtube.com/watch?v=abc123def45",
    notes: "YouTube 1:23–1:29.5; trimmed and scaled; channel watermark shown in the video",
  });
  const pd = clipCredit(info, "launch", 3725, 3730, { license: "PD", basis: "NASA, US federal work" });
  assert.equal(pd.license, "PD");
  assert.equal(pd.licenseVersion, undefined);
  assert.equal(pd.notes, "YouTube 1:02:05–1:02:10; trimmed and scaled; channel watermark shown in the video; PD basis: NASA, US federal work");
  assert.match(clipCredit(info, "x", 59.96, 65, { license: "CC BY" }).notes!, /^YouTube 1:00–1:05;/);
  assert.equal(clipCredit({ ...info, channel: undefined, uploader: "Up" } as VideoInfo, "x", 0, 1, { license: "CC BY" }).author, "Up");
});
