import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLyrics } from "../../src/kit/lib/lyrics.ts";
import { type Credit, musicVideoSchema } from "../../src/kit/schema.ts";
import { musicVideoDescription } from "./musicVideoDescription.ts";

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
  assert.ok(md.includes('- U.S. Army, "War", Public domain, https://example.org/war'));
});

test("the description has no chapters, map data or empty sources", () => {
  assert.ok(!md.includes("CHAPTERS"));
  assert.ok(!md.includes("Map data"));
  assert.ok(!md.includes("SOURCES"));
});
