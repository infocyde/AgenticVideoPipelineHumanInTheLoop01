import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { configSchema } from "./config.ts";
import { slugFromPath, uploadBlocked } from "./upload.ts";

const eps: Record<string, { theme?: string; parent?: string }> = {
  "2026-11-02-rav4": { theme: "car-comparisons" },
  "2026-11-02-rav4-short1": { theme: "dispatch", parent: "2026-11-02-rav4" },
  "2026-11-02-rav4-short1-cut": { parent: "2026-11-02-rav4-short1" },
  "2026-11-02-drones": { theme: "military-comparisons" },
  "2026-11-02-orphan": { theme: "dispatch", parent: "2026-11-02-missing" },
};
const read = (s: string) => eps[s] ?? null;
const blocked = ["car-comparisons"];

test("a blocked theme blocks the episode", () => {
  assert.deepEqual(uploadBlocked("2026-11-02-rav4", blocked, read), { blocked: true, theme: "car-comparisons", via: "2026-11-02-rav4" });
});

test("a Short with its own theme is blocked through its parent", () => {
  const r = uploadBlocked("2026-11-02-rav4-short1", blocked, read);
  assert.equal(r.blocked, true);
  assert.equal(r.via, "2026-11-02-rav4");
  assert.equal(uploadBlocked("2026-11-02-rav4-short1-cut", blocked, read).blocked, true);
});

test("other themes, missing episodes and an empty list are not blocked", () => {
  assert.equal(uploadBlocked("2026-11-02-drones", blocked, read).blocked, false);
  assert.equal(uploadBlocked("2026-11-02-orphan", blocked, read).blocked, false);
  assert.equal(uploadBlocked("no-such-slug", blocked, read).blocked, false);
  assert.equal(uploadBlocked("2026-11-02-rav4", [], read).blocked, false);
});

test("a parent loop stops instead of hanging", () => {
  const loop = (s: string) => ({ a: { parent: "b" }, b: { parent: "a" } })[s as "a" | "b"] ?? null;
  assert.equal(uploadBlocked("a", blocked, loop).blocked, false);
});

test("slugFromPath finds the slug under out/ and public/episodes/ only", () => {
  const root = join("C:", "kit");
  assert.equal(slugFromPath(join(root, "out", "2026-11-02-rav4", "youtube.mp4"), root), "2026-11-02-rav4");
  assert.equal(slugFromPath(join(root, "out", "2026-11-02-rav4", "short1.mp4"), root), "2026-11-02-rav4");
  assert.equal(slugFromPath(join(root, "public", "episodes", "2026-11-02-rav4", "clips", "a.mp4"), root), "2026-11-02-rav4");
  assert.equal(slugFromPath(join(root, "voices", "collin_ro.wav"), root), null);
  assert.equal(slugFromPath(join(root, "out", "loose.mp4"), root), null);
  assert.equal(slugFromPath(join("D:", "elsewhere", "out", "x", "y.mp4"), root), null);
});

test("config: upload.blocked_themes defaults to an empty list", () => {
  assert.deepEqual(configSchema.parse({}).upload.blocked_themes, []);
  assert.deepEqual(configSchema.parse({ upload: { blocked_themes: ["car-comparisons"] } }).upload.blocked_themes, ["car-comparisons"]);
});
