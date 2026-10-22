// `npm run check` for music videos: song, lyrics timing, shots, subtitles and licensing. Returns issues, like runCheck.
import { existsSync, readFileSync } from "node:fs";
import { lyricWords, parseLyrics } from "../../src/kit/lib/lyrics.ts";
import type { Issue } from "../../src/kit/lib/resolve.ts";
import { assetsSchema, type Timing } from "../../src/kit/schema.ts";
import { creditCoverageIssues, generatedStills, pressIssues, staleAssetIssues } from "./check.ts";
import { loadMusicVideoFromDisk } from "./musicVideo.ts";

/** Under this share of sheet words heard by Whisper, the sheet probably differs from the recording. */
export const MATCH_WARN = 0.8;
/** A subtitle line longer than this won't fit two rows. */
export const SUBTITLE_CHARS = 80;

/** True when lyrics.txt no longer has the words (or line breaks) timing.json was aligned from. */
export const lyricsStale = (lyricsText: string, timing: Pick<Timing, "words">) => {
  const sheet = lyricWords(parseLyrics(lyricsText));
  return sheet.length !== timing.words.length || sheet.some((w, i) => w.word !== timing.words[i].word || w.line !== timing.words[i].line);
};

export const runMusicVideoCheck = (slug: string): Issue[] => {
  const d = loadMusicVideoFromDisk(slug);
  const { p } = d;
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: "warning", where, msg });

  if (d.episodeErrors.length) {
    d.episodeErrors.forEach((e) => err("episode.json", e));
    return issues;
  }
  const ep = d.episode!;
  if (ep.slug !== slug) err("slug", `episode.json says "${ep.slug}" but the folder is "${slug}"`);

  // --- generated files ---
  if (!existsSync(p.timing)) err("timing", `timing.json missing: run \`npm run lyrics -- ${slug}\``);
  else if (!d.timing) err("timing", "timing.json doesn't match the expected shape; re-run npm run lyrics");
  if (!existsSync(p.assets)) err("assets", `assets.json missing: run \`npm run assets -- ${slug}\``);
  const assets = d.assets ?? assetsSchema.parse({});
  issues.push(...staleAssetIssues(slug, assets));

  // --- song vs timing vs lyrics ---
  if (!assets.voiceover) err("song.file", `public/episodes/${slug}/${ep.song.file} not found (or assets.json is stale)`);
  const t = d.timing;
  if (t && !t.estimated) {
    if (assets.voiceover?.duration && Math.abs(assets.voiceover.duration - t.duration) > 0.5) {
      err("timing", `the song is ${assets.voiceover.duration.toFixed(2)}s but timing.json says ${t.duration.toFixed(2)}s: the song changed, re-run npm run lyrics`);
    }
    const sheet = existsSync(p.lyrics) ? readFileSync(p.lyrics, "utf8") : "";
    if (lyricsStale(sheet, t)) err("timing", `lyrics.txt changed since timing.json was written: re-run \`npm run lyrics -- ${slug}\``);
    if (t.match && t.match.matched / Math.max(1, t.match.total) < MATCH_WARN) {
      warn("timing", `Whisper heard only ${t.match.matched}/${t.match.total} sheet words; check episodes/${slug}/lyrics-diff.txt with the user (forced alignment placed the rest)`);
    }
    if (!t.beats && ep.shots.some((s) => s.beat !== undefined)) err("timing", `shots cut on beats but timing.json has none: run \`npm run lyrics -- ${slug}\` (it writes beats)`);
  }

  // --- shots, credits roll, subtitles (from the same resolver the video uses) ---
  if (d.timeline) {
    issues.push(...d.timeline.issues);
    d.timeline.subtitles
      .filter((s) => s.text.length > SUBTITLE_CHARS)
      .forEach((s) => warn("lyrics.txt", `line ${s.line + 1} "${s.text}" is ${s.text.length} characters; split it (≤ ${SUBTITLE_CHARS} fit two rows)`));
  }

  // --- licensing: every file credited, the song too ---
  const { epCredits, issues: coverage } = creditCoverageIssues(slug, new Set(), [ep.song.file]);
  issues.push(...coverage);
  const generated = generatedStills(epCredits.entries);
  const usesAi: string[] = [];
  ep.shots.forEach((s, i) => {
    if (!generated.has(s.visual) || assets.clips[s.visual]) return;
    usesAi.push(s.visual);
    if (!s.note) err(`shots[${i}]`, `"${s.visual}" is AI-generated: add "note": "AI-GENERATED ILLUSTRATION" so viewers know`);
  });
  if (ep.thumbnail?.visual && generated.has(ep.thumbnail.visual)) usesAi.push(ep.thumbnail.visual);
  if (usesAi.length) {
    warn("AI imagery", `uses AI-generated images (${[...new Set(usesAi)].join(", ")}). If any look realistic, tick YouTube's "altered or synthetic content" box when uploading.`);
  }
  issues.push(...pressIssues(epCredits.entries, ep.thumbnail?.visual));

  if (!ep.summary) warn("summary", "no summary: write 1–2 sentences for the top of the YouTube description; npm run credits puts it there");
  return issues;
};
