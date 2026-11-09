import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { creditSchema } from "../../src/kit/schema.ts";
import { aiCreditAllowed, generatedClips } from "./check.ts";
import { cutInputs, LIPSYNC_MODEL, lipsyncCredit, windowIssues } from "./lipsync.ts";

const made = (over = {}) =>
  lipsyncCredit({
    file: "clips/singer_sync.mp4",
    name: "singer_sync",
    source: { clip: "clips/singer.mp4", in: 0, sourceUrl: "https://grok.com/imagine/post/abc" },
    audio: { file: "stems/htdemucs/song/vocals.wav", from: 15.41 },
    seconds: 3,
    version: "e00d",
    predictionId: "p123",
    input: { sync_mode: "cut_off", temperature: 0.5 },
    created: "2026-11-07T00:00:00.000Z",
    ...over,
  });

test("lipsyncCredit is a valid AI-GENERATED clip credit that records the source clip and the audio window", () => {
  const c = creditSchema.parse(made());
  assert.equal(c.license, "AI-GENERATED");
  assert.equal(c.generator?.provider, "replicate");
  assert.equal(c.generator?.model, LIPSYNC_MODEL);
  assert.equal(c.generator?.predictionId, "p123");
  assert.equal(c.sourceUrl, `https://replicate.com/${LIPSYNC_MODEL}`);
  assert.match(c.notes ?? "", /lip-synced/i);
  assert.match(c.notes ?? "", /clips\/singer\.mp4/);
  assert.deepEqual(c.generator?.input, {
    sync_mode: "cut_off",
    temperature: 0.5,
    source: { clip: "clips/singer.mp4", in: 0, sourceUrl: "https://grok.com/imagine/post/abc" },
    audio: { file: "stems/htdemucs/song/vocals.wav", from: 15.41 },
    seconds: 3,
  });
});

test("a lip-synced clip may carry AI-GENERATED and counts as an AI clip (on-screen note required)", () => {
  const c = creditSchema.parse(made());
  assert.equal(aiCreditAllowed(c), true);
  assert.deepEqual([...generatedClips([c])], ["singer_sync"]);
});

test("another Replicate model in clips/ is still refused", () => {
  const other = creditSchema.parse({ ...made(), generator: { ...made().generator, model: "someone/video-model" } });
  assert.equal(aiCreditAllowed(other), false);
  assert.deepEqual([...generatedClips([other])], []);
});

test("windowIssues accepts a window inside both the clip and the song", () => {
  assert.deepEqual(windowIssues({ clipSeconds: 10, songSeconds: 253, in: 0, from: 15.41, seconds: 3 }), []);
});

test("windowIssues refuses a window past the clip's end or the song's end, or too short or long", () => {
  assert.match(windowIssues({ clipSeconds: 10, songSeconds: 253, in: 8, from: 15, seconds: 3 }).join(), /clip/);
  assert.match(windowIssues({ clipSeconds: 10, songSeconds: 253, in: 0, from: 252, seconds: 3 }).join(), /song/);
  assert.match(windowIssues({ clipSeconds: 10, songSeconds: 253, in: 0, from: 15, seconds: 0.2 }).join(), /seconds/);
  assert.match(windowIssues({ clipSeconds: 30, songSeconds: 253, in: 0, from: 15, seconds: 21 }).join(), /seconds/);
});

test("cutInputs cuts a silent mp4 and a wav of the same length from the right offsets", () => {
  const dir = mkdtempSync(join(tmpdir(), "lipsync-"));
  try {
    const clip = join(dir, "clip.mp4");
    const song = join(dir, "song.wav");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=320x240:r=24:d=6", "-f", "lavfi", "-i", "sine=f=440:d=6", "-shortest", "-pix_fmt", "yuv420p", clip]);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=20", song]);
    const { video, audio } = cutInputs({ clip, in: 1, song, from: 10, seconds: 2.5, dir });
    const probe = (f: string, what: string) => execFileSync("ffprobe", ["-v", "error", "-show_entries", what, "-of", "csv=p=0", f], { encoding: "utf8" }).trim();
    assert.ok(Math.abs(Number(probe(video, "format=duration")) - 2.5) < 0.1, "video is 2.5 s");
    assert.ok(Math.abs(Number(probe(audio, "format=duration")) - 2.5) < 0.02, "audio is 2.5 s");
    assert.equal(probe(video, "stream=codec_type"), "video", "video has no audio stream");
    assert.match(audio, /\.wav$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
