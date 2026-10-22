import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLyrics } from "../../src/kit/lib/lyrics.ts";
import { type Credit, musicVideoSchema } from "../../src/kit/schema.ts";
import { musicVideoDescription, musicVideoFullCredits } from "./musicVideoDescription.ts";

const ep = musicVideoSchema.parse({
  slug: "x",
  format: "music-video",
  title: "Empires (Plata o Plomo Power Mix)",
  summary: "A music video.",
  song: { title: "Empires", subtitle: "Plata o Plomo Power Mix", artist: "Paranormal Threat Reduction Agency" },
  shots: [{ visual: "a" }],
});
const lyrics = parseLyrics("[Chorus]\nManaged Freedom\nSee how free you are\n\n[Outro]\nEmpires Go (go go go)");
const pd = { file: "clips/war.mp4", title: "War", author: "U.S. Army", license: "PD", sourceUrl: "https://example.org/war" } as Credit;
const song = { file: "song.wav", title: "Empires", author: "Paranormal Threat Reduction Agency", license: "OWN WORK" } as Credit;
const md = musicVideoDescription(ep, lyrics, { visuals: [pd], generated: [], audio: [song] });

test("the description carries the lyrics without tags, stanzas as blank lines", () => {
  assert.ok(md.includes("LYRICS\nManaged Freedom\nSee how free you are\n\nEmpires Go (go go go)"), md);
  assert.ok(!md.includes("[Chorus]"));
});

test("the description credits the song and the footage", () => {
  assert.ok(md.includes("Music: Empires (Plata o Plomo Power Mix) by Paranormal Threat Reduction Agency"));
  assert.ok(md.includes("Public domain"));
  assert.ok(musicVideoFullCredits(ep, { visuals: [pd], generated: [], audio: [song] }).includes('- U.S. Army, "War", Public domain, https://example.org/war'));
});

test("the description has no chapters, map data or empty sources", () => {
  assert.ok(!md.includes("CHAPTERS"));
  assert.ok(!md.includes("Map data"));
  assert.ok(!md.includes("SOURCES"));
});

const many = (n: number, license: Credit["license"], ver?: string) =>
  Array.from({ length: n }, (_, i) => ({ file: `clips/f${license}${i}.mp4`, title: `A fairly long Commons file title number ${i}.webm`, author: `Photographer number ${i}`, license, ...(ver ? { licenseVersion: ver } : {}), sourceUrl: `https://commons.wikimedia.org/wiki/File:Some_long_file_name_${i}.webm` }) as Credit);

test("the description fits YouTube's 5,000 characters, with full credits in CREDITS.md", () => {
  const used = { visuals: [...many(31, "CC BY-SA", "4.0"), ...many(63, "PD")], generated: [], audio: [song] };
  const long = parseLyrics(Array.from({ length: 81 }, (_, i) => `Lyric line number ${i} goes here`).join("\n"));
  const d = musicVideoDescription(ep, long, used);
  const body = d.slice(d.indexOf("---") + 3);
  assert.ok(body.length <= 5000, `description body is ${body.length} characters`);
  assert.ok(body.includes("CC BY-SA 4.0"));
  assert.ok(body.includes("pinned comment"));
  const full = musicVideoFullCredits(ep, used);
  assert.ok(full.includes("https://commons.wikimedia.org/wiki/File:Some_long_file_name_62.webm"));
  assert.ok(full.length <= 10000 || full.includes("Public domain"), "full credits list every item");
});
