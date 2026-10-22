// Music videos: time the lyric sheet to the song and find its beats, writing public/episodes/<slug>/timing.json.
// Usage: npm run lyrics -- <slug> [--force] [--model medium] [--device cpu|cuda] [--language auto|en|…]
//   1. Demucs splits the vocal stem out of the mix (episodes/<slug>/stems/, cached; --force redoes it)
//   2. Whisper transcribes the stem (.venv, cached) and difflib matches the sheet's words to it (scripts/lyrics_align.py)
//   3. sheet words Whisper missed are placed inside their own lyric line (src/kit/lib/placeUnmatched.ts)
//   4. librosa finds the beats (scripts/beats.py), for shots that cut on the beat in instrumentals
// Writes timing.json (words with their line, beats, tempo), heard.txt (what Whisper heard) and lyrics-diff.txt (every
// place the singing departs from the sheet: show these to the user, then fix lyrics.txt to match the audio, re-run).
// An empty lyrics.txt gets Whisper's transcription as a draft, for the user to correct.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { lyricWords, parseLyrics } from "../src/kit/lib/lyrics.ts";
import { placeUnmatched } from "../src/kit/lib/placeUnmatched.ts";
import type { Timing } from "../src/kit/schema.ts";
import { scanAssets } from "./lib/assets.ts";
import { isMusicVideoSlug, loadMusicVideoFromDisk } from "./lib/musicVideo.ts";
import { bold, fail, fmtTime, info, musicPython, ok, parseArgs, readJson, requireSlug, ROOT, run, venvPython, warn } from "./lib/util.ts";
import { sync } from "./sync.ts";

/** Under this share of sheet words heard, the sheet probably differs from the recording. */
export const MATCH_WARN = 0.8;
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

// 3. place unheard words, 4. beats
const placed = placeUnmatched(a.times, words.map((w) => w.line), a.duration);
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
