import assert from "node:assert/strict";
import { test } from "node:test";
import { type AssetManifest, assetsSchema, type MusicVideoInput, musicVideoSchema, type Timing } from "../schema.ts";
import { clipPlayback, resolveMusicVideo, subtitleLines, thumbnailVisual } from "./resolveMusicVideo.ts";
import { LEAD, toFrame } from "./timing.ts";

// The chorus, sung at 10 s and again at 60 s: words every 0.5 s on three lines.
const CHORUS = ["Managed", "Freedom", "See", "how", "free", "you", "are", "Empires", "Go"];
const LINE_OF = [0, 0, 1, 1, 1, 1, 1, 2, 2];
const chorus = (t0: number, line0: number) => CHORUS.map((word, i) => ({ word, start: t0 + i * 0.5, end: t0 + i * 0.5 + 0.45, line: line0 + LINE_OF[i] }));
const timing: Timing = {
  duration: 120,
  words: [...chorus(10, 0), ...chorus(60, 3)],
  beats: Array.from({ length: 241 }, (_, i) => i * 0.5),
};
const clip = (name: string) => ({ file: `episodes/x/clips/${name}.mp4`, duration: 30 });
const assets: AssetManifest = assetsSchema.parse({ clips: { a: clip("a"), b: clip("b"), c: clip("c"), d: clip("d") } });
const mv = (shots: MusicVideoInput["shots"], extra: Partial<MusicVideoInput> = {}) =>
  musicVideoSchema.parse({ slug: "x", format: "music-video", title: "T", song: { title: "S", artist: "A" }, shots, ...extra });
const where = (tl: ReturnType<typeof resolveMusicVideo>, level: "error" | "warning") => tl.issues.filter((i) => i.level === level).map((i) => i.where);

test("a repeated chorus cue hits the next occurrence", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b", cue: "Managed Freedom" }, { visual: "c", beat: 100 }, { visual: "d", cue: "Managed Freedom" }]), timing, assets);
  assert.equal(tl.shots[1].at, 10);
  assert.equal(tl.shots[2].at, 50);
  assert.equal(tl.shots[3].at, 60);
  assert.deepEqual(where(tl, "error"), []);
});

test("a cue after a beat shot is searched after the beat", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b", cue: "Managed Freedom" }, { visual: "c", beat: 130 }, { visual: "d", cue: "Managed Freedom" }]), timing, assets);
  assert.ok(where(tl, "error").includes("shots[3].cue"));
});

test("a beat before the previous shot is an error", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b", cue: "Managed Freedom" }, { visual: "c", beat: 10 }]), timing, assets);
  assert.ok(where(tl, "error").includes("shots[2].beat"));
});

test("a beat out of range is an error", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b", beat: 9999 }]), timing, assets);
  assert.ok(where(tl, "error").includes("shots[1].beat"));
});

test("a shot with neither cue nor beat is an error", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b" }]), timing, assets);
  assert.ok(where(tl, "error").includes("shots[1].cue"));
});

test("an in-point past the clip's end is an error", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a", in: 31 }]), timing, assets);
  assert.ok(where(tl, "error").includes("shots[0].in"));
});

test("a missing visual is an error", () => {
  const tl = resolveMusicVideo(mv([{ visual: "nope" }]), timing, assets);
  assert.ok(where(tl, "error").includes("shots[0].visual"));
});

test("a shot under 0.4 s is an error", () => {
  // beat 21 = 10.5 s (cut on the frame), then "See" at 11.0 s cuts LEAD early: 0.38 s apart
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b", beat: 21 }, { visual: "c", cue: "See" }]), timing, assets);
  assert.ok(where(tl, "error").includes("shots[1]"));
});

test("a shot over 12 s is a warning", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b", cue: "Empires Go" }]), timing, assets);
  assert.ok(where(tl, "warning").includes("shots[0]"));
});

test("a cue on the first shot is a warning", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a", cue: "Managed" }]), timing, assets);
  assert.ok(where(tl, "warning").includes("shots[0].cue"));
});

test("estimated timing is an error", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }]), { ...timing, estimated: true }, assets);
  assert.ok(where(tl, "error").includes("timing"));
});

test("credits come after the song by default", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }, { visual: "b", cue: "Managed Freedom" }]), timing, assets);
  assert.equal(tl.credits.from, toFrame(120) + 15);
  assert.equal(tl.credits.to - tl.credits.from, toFrame(8));
  assert.equal(tl.shots[1].to, tl.credits.from);
  assert.equal(tl.durationInFrames, tl.credits.to);
});

test("credits on a cue overlay the song after the last shot", () => {
  const tl = resolveMusicVideo(
    mv([{ visual: "a" }, { visual: "b", cue: "Managed Freedom" }, { visual: "c", beat: 100 }], { credits: { seconds: 8, cue: "Empires Go" } }),
    timing,
    assets,
  );
  assert.equal(tl.credits.from, toFrame(63.5 - LEAD));
  assert.equal(tl.shots[2].to, tl.credits.from);
  assert.equal(tl.durationInFrames, toFrame(121));
});

test("credit pages extend the roll", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }]), timing, assets, 3);
  assert.equal(tl.credits.pages, 3);
  assert.equal(tl.credits.to - tl.credits.from, 3 * toFrame(8));
});

test("title card frames", () => {
  assert.deepEqual(resolveMusicVideo(mv([{ visual: "a" }]), timing, assets).titleCard, { from: 0, to: toFrame(4) });
  assert.equal(resolveMusicVideo(mv([{ visual: "a" }], { titleCard: false }), timing, assets).titleCard, null);
});

test("subtitle display windows", () => {
  const subs = subtitleLines([
    { word: "a", start: 10, end: 10.5, line: 0 },
    { word: "b", start: 11, end: 11.5, line: 0 },
    { word: "c", start: 12, end: 12.5, line: 1 },
    { word: "d", start: 12.5, end: 13, line: 1 },
  ]);
  assert.equal(subs.length, 2);
  assert.equal(subs[0].text, "a b");
  const near = (x: number, y: number) => assert.ok(Math.abs(x - y) < 1e-9, `${x} != ${y}`);
  near(subs[0].start, 9.85);
  near(subs[0].end, 11.95);
  near(subs[1].start, 11.85);
  near(subs[1].end, 13.8);
});

test("subtitles drop a trailing comma, semicolon or colon but keep question marks", () => {
  const subs = subtitleLines([
    { word: "Jekyll", start: 1, end: 1.5, line: 0 },
    { word: "Island,", start: 1.5, end: 2, line: 0 },
    { word: "last?", start: 3, end: 3.5, line: 1 },
  ]);
  assert.equal(subs[0].text, "Jekyll Island");
  assert.equal(subs[1].text, "last?");
});

test("credits started on a cue run until the song ends, pages spread over the tail", () => {
  const tl = resolveMusicVideo(
    mv([{ visual: "a" }, { visual: "b", cue: "Managed Freedom" }, { visual: "c", beat: 100 }], { credits: { seconds: 8, cue: "Empires Go" } }),
    timing,
    assets,
    2,
  );
  assert.equal(tl.credits.to, tl.durationInFrames);
  assert.equal(tl.durationInFrames, toFrame(121));
  // a long tail: pages hold for their full length; the last one runs on to the song's end
  assert.equal(tl.credits.pageFrames, toFrame(8));
});

test("credit pages started on a cue squeeze into the song's tail, down to 4 s a page", () => {
  const ep = mv([{ visual: "a" }, { visual: "b", cue: "Managed Freedom" }, { visual: "c", beat: 100 }], { credits: { seconds: 8, cue: "Empires Go" } });
  // "Empires Go" (second chorus) at 63.5 s; a 120 s song leaves ~57.6 s of tail
  const fits = resolveMusicVideo(ep, { ...timing, duration: 80 }, assets, 3); // 17.6 s tail for 3 pages
  assert.equal(fits.credits.pageFrames, Math.floor((toFrame(81) - fits.credits.from) / 3));
  assert.equal(fits.credits.to, toFrame(81));
  const tight = resolveMusicVideo(ep, { ...timing, duration: 70 }, assets, 3); // 7.6 s tail for 3 pages
  assert.equal(tight.credits.pageFrames, toFrame(4));
  assert.equal(tight.credits.to, tight.credits.from + 3 * toFrame(4));
});

test("credits after the song keep their page length", () => {
  const tl = resolveMusicVideo(mv([{ visual: "a" }]), timing, assets, 2);
  assert.equal(tl.credits.pageFrames, toFrame(8));
});

test("clipPlayback plays a long-enough clip at full speed without looping", () => {
  assert.deepEqual(clipPlayback(10, 0, 240), { rate: 1, loopFrames: null });
});

test("clipPlayback slows a slightly short clip to fill the slot without looping back", () => {
  const p = clipPlayback(6, 0, 240); // 6 s for an 8 s slot
  assert.equal(p.loopFrames, null);
  assert.ok(p.rate < 0.75 && p.rate >= 0.5);
});

test("clipPlayback loops only when even half speed is too short", () => {
  const p = clipPlayback(3, 0, 240);
  assert.equal(p.rate, 0.5);
  assert.ok(p.loopFrames !== null && p.loopFrames < 240);
});

test("the thumbnail is thumbnail.visual, else the first shot's visual", () => {
  assert.equal(thumbnailVisual(mv([{ visual: "a" }, { visual: "b", beat: 4 }])), "a");
  assert.equal(thumbnailVisual(mv([{ visual: "a" }], { thumbnail: { visual: "c" } })), "c");
});
