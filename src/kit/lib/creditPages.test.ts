import assert from "node:assert/strict";
import { test } from "node:test";
import { type Credit, musicVideoSchema } from "../schema.ts";
import { creditColumns, creditPages, musicVideoCredits, pagedCreditColumns } from "./credits.ts";

const group = (n: number) => ({ heading: "FOOTAGE & IMAGES", items: Array.from({ length: n }, (_, i) => ({ who: `Author ${i}`, what: "Public domain" })) });

test("creditPages splits a long group over pages, repeating its heading", () => {
  const pages = creditPages([group(30)], 14);
  assert.equal(pages.length, 3);
  pages.forEach((p) => assert.equal(p[0].heading, "FOOTAGE & IMAGES"));
  assert.equal(pages.reduce((n, p) => n + p[0].items.length, 0), 30);
});

test("creditPages keeps a short group on one page", () => {
  assert.equal(creditPages([group(5)], 14).length, 1);
});

const credit = (file: string, license: Credit["license"], extra: Partial<Credit> = {}): Credit =>
  ({ file, title: file, author: `by ${file}`, license, sourceUrl: "https://example.org/x", ...extra }) as Credit;

test("musicVideoCredits sorts the song, footage and AI stills", () => {
  const ep = musicVideoSchema.parse({ slug: "x", format: "music-video", title: "T", song: { title: "S", artist: "A" }, shots: [{ visual: "a" }] });
  const ai = credit("images/gen.png", "AI-GENERATED", { generator: { provider: "local", model: "z-image-turbo", prompt: "p", created: "2026-10-21" } });
  const used = musicVideoCredits(ep, [credit("song.wav", "OWN WORK"), credit("clips/war.mp4", "PD"), ai]);
  assert.deepEqual(used.audio.map((c) => c.file), ["song.wav"]);
  assert.deepEqual(used.visuals.map((c) => c.file), ["clips/war.mp4"]);
  assert.deepEqual(used.generated.map((c) => c.file), ["images/gen.png"]);
});

test("creditColumns leaves out map data for music videos", () => {
  const cols = creditColumns({ visuals: [], generated: [], audio: [] }, false);
  assert.ok(!cols.right.some((g) => g.heading === "MAP DATA"));
  assert.ok(creditColumns({ visuals: [], generated: [], audio: [] }, true).right.some((g) => g.heading === "MAP DATA"));
});

test("pagedCreditColumns gives one undefined page when everything fits, else one page per 14 rows", () => {
  const few = { visuals: [credit("clips/a.mp4", "PD")], generated: [], audio: [] };
  assert.deepEqual(pagedCreditColumns(few, false), [undefined]);
  const many = { visuals: Array.from({ length: 30 }, (_, i) => credit(`clips/${i}.mp4`, "PD")), generated: [], audio: [] };
  assert.equal(pagedCreditColumns(many, false).length, 3);
});

test("creditPages counts wrapped lines when a column is narrow", () => {
  const long = { heading: "FOOTAGE & IMAGES", items: Array.from({ length: 10 }, (_, i) => ({ who: "x".repeat(100), what: "" })) };
  // each item wraps to 3 lines at 44 chars: heading 1.6 + 4 x 3 = 13.6 rows a page -> 3 pages
  assert.equal(creditPages([long], 14, 44).length, 3);
});

test("pagedCreditColumns lays out three columns a page for a music video", () => {
  const many = { visuals: Array.from({ length: 80 }, (_, i) => credit(`clips/${i}.mp4`, "PD")), generated: [], audio: [credit("song.wav", "OWN WORK")] };
  const pages = pagedCreditColumns(many, false, { columns: 3, maxRows: 25, charsPerLine: 44 });
  assert.equal(pages.length, 2);
  pages.forEach((p) => assert.ok(p && p.length <= 3));
});
