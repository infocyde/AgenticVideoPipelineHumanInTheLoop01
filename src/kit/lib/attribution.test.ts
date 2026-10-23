import assert from "node:assert/strict";
import { test } from "node:test";
import { type Credit, assetsSchema } from "../schema.ts";
import { youtubeAttributions } from "./attribution.ts";
import { resolveVisual } from "./resolve.ts";

const credit = (o: Partial<Credit>): Credit => ({ file: "clips/a.mp4", title: "T", author: "NASA", license: "CC BY", sourceUrl: "https://www.youtube.com/watch?v=1", ...o }) as Credit;

test("youtubeAttributions maps YouTube clip credits to their channel", () => {
  assert.deepEqual(youtubeAttributions([credit({})]), { "clips/a.mp4": "NASA" });
});

test("youtubeAttributions ignores non-YouTube, non-clip and sourceless credits", () => {
  const list = [
    credit({ file: "clips/b.mp4", sourceUrl: "https://commons.wikimedia.org/wiki/File:b.webm" }),
    credit({ file: "images/x.jpg" }),
    credit({ file: "clips/c.mp4", sourceUrl: undefined, license: "OWN WORK" }),
  ];
  assert.deepEqual(youtubeAttributions(list), {});
});

test("resolveVisual copies attribution for clips only when present", () => {
  const base = assetsSchema.parse({});
  const withAttr = { ...base, clips: { a: { file: "episodes/s/clips/a.mp4", duration: 4, attribution: "NASA" } } };
  assert.deepEqual(resolveVisual(withAttr, "a"), { kind: "clip", file: "episodes/s/clips/a.mp4", duration: 4, attribution: "NASA" });
  const without = { ...base, clips: { a: { file: "episodes/s/clips/a.mp4", duration: 4 } } };
  assert.deepEqual(resolveVisual(without, "a"), { kind: "clip", file: "episodes/s/clips/a.mp4", duration: 4 });
});
