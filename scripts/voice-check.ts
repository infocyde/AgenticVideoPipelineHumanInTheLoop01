// Scan a finished voiceover for harsh stops: places where the voice is cut off while still sounding instead of
// decaying into the pause (a sentence chopped mid-word by the TTS, a clipped edit in a recording).
// For every pause (and the end of the file) it follows the level in 10 ms steps over the last 130 ms. A natural
// ending dips toward silence there (the word decays, or a final consonant closes before its release); a cut-off stays
// near speaking level right up to the edge. npm run voice fades the last 50 ms before each pause, which hides the
// click but not the cut word, so only the very last 10 ms are left out.
//
// Usage: npm run voice-check -- <slug> [--file <path>] [--min-pause 0.12] [--no-clips]
// Writes episodes/<slug>/work/voice-check/report.txt and, for each flagged stop, a listening snippet (.mp3) and a
// waveform (.png) in the same folder. Exits 0; read the report and listen to every HARSH and CHECK item.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { bold, fail, fmtTime, info, ok, parseArgs, paths, readJson, red, requireSlug, ROOT, warn, yellow } from "./lib/util.ts";

const SR = 24000;
const QUIET = 0.002; // ~-54 dBFS: the silence voice.ts inserts between sentences (MP3 leaves faint codec noise)
const WINDOW = 0.13; // seconds before the pause that are followed in 10 ms steps
const HARSH_DB = -20; // never drops below this (relative to the speaking level): still sounding when the audio stopped
const CHECK_DB = -24;

type Word = { word: string; start: number; end: number };

const slug = requireSlug("npm run voice-check -- <slug> [--file <path>] [--min-pause 0.12] [--no-clips]");
const { flags } = parseArgs();
const p = paths(slug);
const file = typeof flags.file === "string" ? join(ROOT, flags.file) : join(p.pub, "voiceover.mp3");
if (!existsSync(file)) fail(`No voiceover at ${relative(ROOT, file)}. Voice or record it first.`);
const minPause = Number(flags["min-pause"] ?? 0.12);
const clips = !flags["no-clips"];

const dec = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
if (dec.status !== 0) fail(`ffmpeg could not decode ${file}: ${dec.stderr?.toString()}`);
const buf = dec.stdout;
const x = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
const dur = x.length / SR;

const rmsDb = (t0: number, t1: number) => {
  const a = Math.max(0, Math.floor(t0 * SR));
  const b = Math.min(x.length, Math.floor(t1 * SR));
  if (b <= a) return -120;
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / (b - a) + 1e-12);
};

// Typical speaking level: median of the voiced 20 ms frames.
const voiced: number[] = [];
for (let t = 0; t + 0.02 <= dur; t += 0.02) {
  const db = rmsDb(t, t + 0.02);
  if (db > -40) voiced.push(db);
}
if (!voiced.length) fail("No speech found in the file.");
voiced.sort((a, b) => a - b);
const ref = voiced[Math.floor(voiced.length / 2)];

// Pause onsets: the first sample of each quiet run at least minPause long, plus the end of the file.
const onsets: number[] = [];
const minRun = Math.round(minPause * SR);
let runStart = -1;
for (let i = 0; i <= x.length; i++) {
  const quiet = i < x.length && Math.abs(x[i]) < QUIET;
  if (quiet && runStart < 0) runStart = i;
  if (!quiet && runStart >= 0) {
    if (runStart > 0 && (i - runStart >= minRun || i === x.length)) onsets.push(runStart / SR);
    runStart = -1;
  }
}
if (Math.abs(x[x.length - 1]) >= QUIET) onsets.push(dur);

const words: Word[] = existsSync(p.timing) ? (readJson<{ words?: Word[] }>(p.timing).words ?? []) : [];
const context = (t: number) => {
  let i = -1;
  // The word that ends at this pause. Alignment can stretch a word past the pause or start the next one a little
  // early, so take the nearest word end within 0.4 s, preferring one with punctuation (pauses follow sentences).
  let best = Infinity;
  for (let k = 0; k < words.length; k++) {
    const d = Math.abs(words[k].end - t) + (/[.!?,;]$/.test(words[k].word) ? 0 : 0.5);
    if (words[k].start < t && Math.abs(words[k].end - t) < 0.4 && d < best) [best, i] = [d, k];
  }
  if (i < 0) for (let k = 0; k < words.length; k++) if (words[k].start < t - 0.02) i = k;
  if (i < 0) return { word: "?", line: "" };
  let s = i;
  while (s > 0 && !/[.!?]$/.test(words[s - 1].word) && i - s < 12) s--;
  return { word: words[i].word, line: words.slice(s, i + 1).map((w) => w.word).join(" ") };
};

type Stop = { t: number; floor: number; edge: number; verdict: "HARSH" | "CHECK" | "ok"; word: string; line: string };
const stops: Stop[] = onsets
  .filter((t) => t > 0.2)
  .map((t) => {
    // Lowest 10 ms level in the window (the last 10 ms, deep in the fade, left out). High floor = no decay at all.
    let floor = 0;
    for (let a = t - WINDOW; a < t - 0.015; a += 0.01) floor = Math.min(floor, rmsDb(a, a + 0.01) - ref);
    const edge = rmsDb(t - 0.01, t) - ref;
    const verdict = floor > HARSH_DB ? "HARSH" : floor > CHECK_DB ? "CHECK" : "ok";
    return { t, floor, edge, verdict, ...context(t) };
  });

const outDir = join(p.src, "work", "voice-check");
mkdirSync(outDir, { recursive: true });
const flagged = stops.filter((s) => s.verdict !== "ok");
if (clips) {
  for (const s of flagged) {
    const base = join(outDir, `${s.verdict.toLowerCase()}-${s.t.toFixed(2).replace(".", "_")}s`);
    const from = Math.max(0, s.t - 1.5);
    const span = Math.min(dur, s.t + 0.4) - from;
    spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(from), "-t", String(span), "-i", file, "-c:a", "libmp3lame", "-q:a", "3", `${base}.mp3`]);
    spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(from), "-t", String(span), "-i", file, "-filter_complex", "showwavespic=s=1200x240:split_channels=0", "-frames:v", "1", `${base}.png`]);
  }
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
const lines = [
  `voice-check ${slug}: ${relative(ROOT, file)}, ${dur.toFixed(1)} s, speaking level ${ref.toFixed(1)} dBFS, ${stops.length} stops checked`,
  `floor = lowest 10 ms level in the last ${WINDOW * 1000} ms before the pause, edge = last 10 ms, both relative to the speaking level. HARSH: floor > ${HARSH_DB} dB, CHECK: floor > ${CHECK_DB} dB.`,
  "",
  ...stops.map((s) => `${pad(s.verdict, 6)} ${pad(fmtTime(s.t) + ` (${s.t.toFixed(2)}s)`, 16)} floor ${s.floor.toFixed(1).padStart(6)} dB  edge ${s.edge.toFixed(1).padStart(6)} dB  …${s.line}`),
];
writeFileSync(join(outDir, "report.txt"), lines.join("\n") + "\n");

info(lines[0]);
for (const s of flagged) {
  const tag = s.verdict === "HARSH" ? red(bold("HARSH")) : yellow("CHECK");
  console.log(`  ${tag} ${fmtTime(s.t)} (${s.t.toFixed(2)}s)  floor ${s.floor.toFixed(1)} dB  edge ${s.edge.toFixed(1)} dB  "${s.word}"  …${s.line}`);
}
const harsh = flagged.filter((s) => s.verdict === "HARSH").length;
const report = relative(ROOT, join(outDir, "report.txt"));
if (!flagged.length) ok(`no harsh stops (${stops.length} pauses checked); report: ${report}`);
else {
  warn(`${harsh} harsh, ${flagged.length - harsh} to check. Listen to each snippet in ${relative(ROOT, outDir)}/ (and look at its .png).`);
  info("A real cut-off: reword or respell the line in voiceover.txt and re-voice (npm run voice -- <slug> --force); a fade can't fix a cut word.");
  info(`Full report: ${report}`);
}
