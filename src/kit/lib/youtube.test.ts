import assert from "node:assert/strict";
import { test } from "node:test";
import { isYouTubeUrl, youtubeTagText } from "./youtube.ts";

test("isYouTubeUrl accepts youtube.com hosts and youtu.be", () => {
  for (const u of [
    "https://www.youtube.com/watch?v=abc",
    "https://youtube.com/watch?v=abc",
    "https://m.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
  ]) assert.equal(isYouTubeUrl(u), true, u);
});

test("isYouTubeUrl rejects other hosts and non-URLs", () => {
  for (const u of ["https://commons.wikimedia.org/wiki/File:X.webm", "https://notyoutube.com/x", undefined, "not a url"])
    assert.equal(isYouTubeUrl(u), false, String(u));
});

test("youtubeTagText wraps the channel", () => {
  assert.equal(youtubeTagText("NASA"), "VIDEO · NASA / YouTube");
  assert.equal(youtubeTagText("  Spaced  "), "VIDEO · Spaced / YouTube");
});

test("youtubeTagText shortens a long channel with an ellipsis", () => {
  assert.equal(youtubeTagText("A".repeat(60)), "VIDEO · " + "A".repeat(39) + "… / YouTube");
});

test("youtubeTagText cuts by code points, not UTF-16 units", () => {
  const out = youtubeTagText("😀".repeat(60));
  assert.equal(out, "VIDEO · " + "😀".repeat(39) + "… / YouTube");
  assert.equal(youtubeTagText("日本語".repeat(20), 5), "VIDEO · 日本語日… / YouTube");
});
