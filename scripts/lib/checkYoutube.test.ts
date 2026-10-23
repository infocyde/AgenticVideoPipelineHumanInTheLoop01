import assert from "node:assert/strict";
import { test } from "node:test";
import { type Credit, assetsSchema } from "../../src/kit/schema.ts";
import { youtubeIssues } from "./check.ts";

const credit = (o: Partial<Credit> = {}): Credit =>
  ({ file: "clips/a.mp4", title: "T", author: "NASA", license: "CC BY", sourceUrl: "https://www.youtube.com/watch?v=1", ...o }) as Credit;
const manifest = (attribution?: string) => {
  const a = assetsSchema.parse({});
  a.clips.a = { file: "episodes/x/clips/a.mp4", ...(attribution ? { attribution } : {}) } as (typeof a.clips)[string];
  return a;
};
const run = (c: Credit, assets = manifest("NASA"), thumb?: string, on = true) => youtubeIssues([c], assets, thumb, on);

test("a CC BY clip with a matching channel tag is clean", () => {
  assert.deepEqual(run(credit()), []);
});

test("CC BY-SA on YouTube is an error naming the file", () => {
  const r = run(credit({ license: "CC BY-SA" }));
  assert.equal(r.length, 1);
  assert.match(r[0].msg, /clips\/a\.mp4/);
  assert.match(r[0].msg, /CC BY or PD/);
});

test("a YouTube credit outside clips/ is an error", () => {
  const r = run(credit({ file: "images/x.jpg" }));
  assert.ok(r.some((i) => i.level === "error" && /clips\/ only/.test(i.msg)));
});

test("author YouTube or blank must name the channel", () => {
  for (const author of ["YouTube", " "]) {
    assert.ok(run(credit({ author }), manifest(author)).some((i) => /name the channel/.test(i.msg)), author);
  }
});

test("PD needs a basis in notes", () => {
  assert.ok(run(credit({ license: "PD" })).some((i) => /basis/.test(i.msg)));
  assert.deepEqual(run(credit({ license: "PD", notes: "NASA, US federal work" })), []);
});

test("the thumbnail can't be a YouTube clip", () => {
  const r = run(credit(), manifest("NASA"), "a");
  assert.ok(r.some((i) => i.where === "thumbnail.visual"));
});

test("a missing or different attribution in assets.json is stale", () => {
  for (const a of [manifest(), manifest("Other")]) {
    assert.ok(run(credit(), a).some((i) => i.level === "error" && /npm run assets/.test(i.msg)));
  }
});

test("search_youtube off with a YouTube credit is one warning", () => {
  const r = run(credit(), manifest("NASA"), undefined, false);
  assert.equal(r.length, 1);
  assert.equal(r[0].level, "warning");
});

test("a Commons credit whose originalUrl is YouTube is untouched", () => {
  const c = credit({ sourceUrl: "https://commons.wikimedia.org/wiki/File:A.webm", originalUrl: "https://www.youtube.com/watch?v=1" });
  assert.deepEqual(run(c, manifest()), []);
});

test("a credited clip with no assets.json entry (file deleted) is left to the coverage checks", () => {
  assert.deepEqual(run(credit(), assetsSchema.parse({})), []);
});
