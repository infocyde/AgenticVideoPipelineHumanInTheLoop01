import assert from "node:assert/strict";
import { test } from "node:test";
import { creditAttributions, voiceoverOf } from "./assets.ts";

const yt = { file: "clips/a.mp4", title: "T", author: "NASA", license: "CC BY", sourceUrl: "https://www.youtube.com/watch?v=1" };

test("creditAttributions maps YouTube clips to their channel", () => {
  assert.deepEqual(creditAttributions(JSON.stringify([yt])), { "clips/a.mp4": "NASA" });
});

test("creditAttributions gives none for missing or malformed credits.json (check reports it)", () => {
  assert.deepEqual(creditAttributions(null), {});
  assert.deepEqual(creditAttributions("[{ not json"), {});
});

test("voiceoverOf: a music video's song, an episode's audio.voiceover, else voiceover.mp3", () => {
  assert.equal(voiceoverOf({ format: "music-video", song: { file: "track.mp3" } }), "track.mp3");
  assert.equal(voiceoverOf({ format: "music-video", song: {} }), "song.wav");
  assert.equal(voiceoverOf({ audio: { voiceover: "vo2.mp3" } }), "vo2.mp3");
  assert.equal(voiceoverOf({}), "voiceover.mp3");
  assert.equal(voiceoverOf(null), "voiceover.mp3");
});
