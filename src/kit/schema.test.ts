import assert from "node:assert/strict";
import { test } from "node:test";
import { episodeSchema, isMusicVideo, musicVideoSchema, timingSchema } from "./schema.ts";

const minimal = { slug: "x-y", format: "music-video", title: "T", song: { title: "Empires", artist: "PTRA" }, shots: [{ visual: "a" }] };

test("parses a minimal music video with defaults", () => {
  const mv = musicVideoSchema.parse(minimal);
  assert.equal(mv.subtitles, true);
  assert.deepEqual(mv.titleCard, { seconds: 4 });
  assert.equal(mv.song.file, "song.wav");
  assert.equal(mv.credits.seconds, 8);
  assert.equal(mv.shots[0].transition, "cut");
});

test("rejects a shot with both a cue and a beat", () => {
  const r = musicVideoSchema.safeParse({ ...minimal, shots: [{ visual: "a" }, { visual: "b", cue: "x", beat: 3 }] });
  assert.equal(r.success, false);
  assert.match(r.error!.issues.map((i) => i.message).join(" "), /not both/);
});

test("isMusicVideo", () => {
  assert.equal(isMusicVideo({ format: "music-video" }), true);
  assert.equal(isMusicVideo({ format: "countdown" }), false);
  assert.equal(isMusicVideo(null), false);
  assert.equal(isMusicVideo("x"), false);
});

test("old timing files still parse", () => {
  assert.equal(timingSchema.parse({ duration: 1, words: [{ word: "a", start: 0, end: 1 }] }).words[0].line, undefined);
});

test("timing accepts lines, beats and tempo", () => {
  const t = timingSchema.parse({ duration: 1, words: [{ word: "a", start: 0, end: 1, line: 0 }], beats: [0.5], tempo: 120 });
  assert.equal(t.words[0].line, 0);
  assert.deepEqual(t.beats, [0.5]);
});

test("news episodes reject the music-video format", () => {
  assert.equal(episodeSchema.safeParse({ format: "music-video" }).success, false);
});
