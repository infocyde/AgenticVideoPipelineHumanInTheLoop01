// Music videos: time the lyric sheet to the song and find its beats, writing public/episodes/<slug>/timing.json.
// Usage: npm run lyrics -- <slug> [--force] [--model medium] [--device cpu|cuda] [--language auto|en|…] [--aligner mms|whisper]
//   1. Demucs splits the vocal stem out of the mix (episodes/<slug>/stems/, cached; --force redoes it)
//   2. Whisper transcribes the stem (.venv, cached) and difflib matches the sheet's words to it (scripts/lyrics_align.py)
//   3. sheet words Whisper missed are placed inside their own lyric line (src/kit/lib/placeUnmatched.ts)
//   4. (--aligner mms, the default) forced alignment refines every word on the vocal stem (scripts/lyrics_fa.py)
//   5. librosa finds the beats (scripts/beats.py), for shots that cut on the beat in instrumentals
// Writes timing.json (words with their line, beats, tempo), heard.txt (what Whisper heard) and lyrics-diff.txt (every
// place the singing departs from the sheet: show these to the user, then fix lyrics.txt to match the audio, re-run).
// An empty lyrics.txt gets Whisper's transcription as a draft, for the user to correct.
//
// Why MMS is the default (tested on "Empires", 6:21 of operatic metal, 2026-10-21): Whisper medium heard 168 of 293
// sheet words (57%) and none of the first chorus. MMS forced alignment, with each chunk's window widened to the
// nearest heard words, put every line on sung audio (12/12 chunks; median 0.10 s and 95th percentile 0.78 s from
// Whisper on the words both placed). reconcile() keeps Whisper's time where MMS drifts > 1.5 s from a heard word and
// caps words at 4 s; enforceOrder() keeps the words in sung order across chunks. Whole run: ~25 s with stems cached.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { lyricWords, parseLyrics } from "../src/kit/lib/lyrics.ts";
import { enforceOrder, placeUnmatched, reconcile } from "../src/kit/lib/placeUnmatched.ts";
import type { Timing } from "../src/kit/schema.ts";
import { scanAssets } from "./lib/assets.ts";
import { MATCH_WARN } from "./lib/checkMusicVideo.ts";
import { isMusicVideoSlug, loadMusicVideoFromDisk } from "./lib/musicVideo.ts";
import { bold, fail, fmtTime, info, musicPython, ok, parseArgs, readJson, requireSlug, ROOT, run, venvPython, warn } from "./lib/util.ts";
import { sync } from "./sync.ts";

/** A gap between lyric lines longer than this is listed as an instrumental in the song map (seconds). */
const INSTRUMENTAL = 4;

type AlignOut = {
  duration: number;
  language: string;
  matched: number;
  total: number;
  times: ([number, number] | null)[];
  diffs: { op: "replace" | "delete" | "insert"; sheetFrom: number; sheetTo: number; heard: string; start: number | null; end: number | null }[];
  heardLines: string[];
};

const slug = requireSlug("npm run lyrics -- <slug> [--force] [--model medium] [--device cpu|cuda] [--language auto]");
if (!isMusicVideoSlug(slug)) fail(`${slug} is not a music video; narrated episodes use \`npm run align -- ${slug}\`.`);
const { flags } = parseArgs();
const str = (k: string, d: string) => (typeof flags[k] === "string" ? (flags[k] as string) : d);
const force = !!flags.force;
const d = loadMusicVideoFromDisk(slug);
if (!d.episode) fail(`episode.json doesn't validate: ${d.episodeErrors.join("; ")}`);
const ep = d.episode!;
const p = d.p;
const song = join(p.pub, ep.song.file);
if (!existsSync(song)) fail(`no song at public/episodes/${slug}/${ep.song.file}`);
if (!existsSync(musicPython())) fail("lyrics aren't set up yet. Run once: npm run setup:lyrics");
if (!existsSync(venvPython())) fail("Whisper isn't set up yet. Run once: npm run setup:align");
mkdirSync(p.stems, { recursive: true });

// 1. vocal stem
const vocals = join(p.stems, "htdemucs", basename(song, extname(song)), "vocals.wav");
if (force || !existsSync(vocals)) {
  info("separating the vocals with Demucs (htdemucs; a minute or two on the GPU)…");
  if (run(musicPython(), ["-m", "demucs.separate", "--two-stems", "vocals", "-n", "htdemucs", "-o", p.stems, song]) !== 0 || !existsSync(vocals)) {
    fail("Demucs failed (see the output above)");
  }
} else info("vocal stem: cached (--force to redo)");

// 2. transcribe + match
const sheetText = existsSync(p.lyrics) ? readFileSync(p.lyrics, "utf8") : "";
const lyrics = parseLyrics(sheetText);
const words = lyricWords(lyrics);
const wordsFile = join(p.stems, "words.json");
const alignFile = join(p.stems, "align.json");
writeFileSync(wordsFile, JSON.stringify(words.map((w) => w.word)));
const model = str("model", "medium");
const code = run(venvPython(), ["-I", join(ROOT, "scripts", "lyrics_align.py"), vocals, wordsFile, alignFile, p.heard, join(p.stems, "transcript.json"), model, str("device", "cpu"), str("language", "auto")]);
if (code !== 0) fail("transcription failed (see the Python output above)");
const a = readJson<AlignOut>(alignFile);

if (!words.length) {
  writeFileSync(p.lyrics, a.heardLines.join("\n") + "\n");
  ok(`no lyric sheet, so Whisper's transcription is now a draft in episodes/${slug}/lyrics.txt (${a.heardLines.length} lines)`);
  warn("Get the user to correct it (one subtitle line per line, [Section] tags optional), then run npm run lyrics again.");
  process.exit(0);
}

// 3. place unheard words
let placed = placeUnmatched(a.times, words.map((w) => w.line), a.duration);

// 4. forced alignment (MMS) on the stem
const aligner = str("aligner", "mms");
if (aligner !== "mms" && aligner !== "whisper") fail('--aligner must be "mms" or "whisper"');
if (aligner === "mms") {
  info("forced alignment (MMS) on the vocal stem…");
  const faIn = join(p.stems, "fa-in.json");
  const faOut = join(p.stems, "fa-out.json");
  writeFileSync(faIn, JSON.stringify({ words: words.map((w, i) => ({ word: w.word, start: placed[i][0], end: placed[i][1], line: w.line, heard: a.times[i] !== null })) }));
  if (run(musicPython(), ["-I", join(ROOT, "scripts", "lyrics_fa.py"), vocals, faIn, faOut]) !== 0) fail("forced alignment failed (see the Python output above); --aligner whisper skips it");
  const fa = readJson<{ words: { start: number; end: number }[]; chunks: { from: number; to: number; ok: boolean; reason?: string }[] }>(faOut);
  fa.chunks.filter((c) => !c.ok).forEach((c) => warn(`lines with words ${c.from}–${c.to - 1} kept Whisper's times: ${c.reason}`));
  // How far MMS moved the words Whisper did hear (a sanity check on both).
  const deltas = a.times.flatMap((t, i) => (t ? [Math.abs(fa.words[i].start - t[0])] : [])).sort((x, y) => x - y);
  const q = (f: number) => deltas[Math.min(deltas.length - 1, Math.floor(f * deltas.length))] ?? 0;
  info(`MMS vs Whisper on ${deltas.length} heard words: median ${q(0.5).toFixed(2)}s, 95th percentile ${q(0.95).toFixed(2)}s`);
  placed = enforceOrder(reconcile(a.times, fa.words.map((w) => [w.start, w.end])));
}

// 5. beats
const beatsFile = join(p.stems, "beats.json");
if (force || !existsSync(beatsFile)) {
  info("finding the beats (librosa)…");
  if (run(musicPython(), ["-I", join(ROOT, "scripts", "beats.py"), song, beatsFile]) !== 0) fail("beat tracking failed (see the Python output above)");
}
const beats = readJson<{ tempo: number; beats: number[] }>(beatsFile);

const timing: Timing = {
  duration: a.duration,
  match: { matched: a.matched, total: a.total },
  words: words.map((w, i) => ({ word: w.word, start: +placed[i][0].toFixed(3), end: +placed[i][1].toFixed(3), line: w.line })),
  beats: beats.beats,
  tempo: beats.tempo,
};
writeFileSync(p.timing, JSON.stringify(timing, null, 1) + "\n");

// Where the singing departs from the sheet.
const at = (s: number) => `${fmtTime(s)}.${String(Math.floor((s % 1) * 10))}`;
const LABEL = { replace: "sung differently", delete: "in the sheet, not heard", insert: "heard, not in the sheet" };
const diffLines = a.diffs.map((x) => {
  const t = x.start ?? placed[Math.min(x.sheetFrom, placed.length - 1)]?.[0] ?? 0;
  const sheet = words.slice(x.sheetFrom, x.sheetTo).map((w) => w.word).join(" ");
  return `${at(t).padStart(7)}  ${LABEL[x.op]}\n         sheet: ${sheet || "-"}\n         heard: ${x.heard || "-"}`;
});
writeFileSync(
  p.lyricsDiff,
  `# ${slug}: where the singing differs from lyrics.txt (${a.diffs.length} places; Whisper also mishears, so listen before changing the sheet)\n\n${diffLines.join("\n\n")}\n`,
);

// Song map: sections and instrumentals (with their beat ranges, for beat cuts).
const firstWord = (line: number) => timing.words.find((w) => w.line === line);
const beatRange = (from: number, to: number) => {
  const idx = beats.beats.map((b, i) => [b, i] as const).filter(([b]) => b >= from && b <= to);
  return idx.length ? `beats ${idx[0][1]}–${idx[idx.length - 1][1]}` : "no beats";
};
const map: { t: number; text: string }[] = [];
lyrics.sections.forEach((s) => {
  const w = firstWord(s.line);
  map.push({ t: w?.start ?? a.duration, text: `[${s.name}]${w ? "" : " (after the last line)"}` });
});
const lineSpans = lyrics.lines.map((_, i) => {
  const ws = timing.words.filter((w) => w.line === i);
  return [ws[0].start, ws[ws.length - 1].end] as const;
});
const gaps: [number, number][] = [];
if (lineSpans.length && lineSpans[0][0] > INSTRUMENTAL) gaps.push([0, lineSpans[0][0]]);
lineSpans.forEach((s, i) => {
  const next = lineSpans[i + 1];
  if (next && next[0] - s[1] > INSTRUMENTAL) gaps.push([s[1], next[0]]);
});
const last = lineSpans[lineSpans.length - 1];
if (last && a.duration - last[1] > INSTRUMENTAL) gaps.push([last[1], a.duration]);
gaps.forEach(([f, t]) => map.push({ t: f, text: `  instrumental ${at(f)}–${at(t)} (${(t - f).toFixed(1)}s), ${beatRange(f, t)}` }));
map.sort((x, y) => x.t - y.t);

console.log(bold(`\nsong map (${beats.beats.length} beats, ${beats.tempo} BPM)`));
map.forEach((m) => console.log(`  ${at(m.t).padStart(7)}  ${m.text}`));
console.log(bold(`\n${a.diffs.length} places where the singing differs from the sheet`) + ` (full list: episodes/${slug}/lyrics-diff.txt)`);
diffLines.slice(0, 12).forEach((l) => console.log(l));
if (diffLines.length > 12) console.log(`  … ${diffLines.length - 12} more in lyrics-diff.txt`);

const rate = a.matched / Math.max(1, a.total);
const line = `matched ${a.matched}/${a.total} sheet words (${(rate * 100).toFixed(1)}%) with ${model}, heard as ${a.language}; song ${a.duration.toFixed(2)}s`;
if (rate < MATCH_WARN) warn(`${line}. Under ${MATCH_WARN * 100}%: compare the sheet with heard.txt and lyrics-diff.txt.`);
else ok(line);
scanAssets(slug, ep.song.file);
sync();
ok(`wrote public/episodes/${slug}/timing.json`);
