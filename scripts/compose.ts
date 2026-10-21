// Generate a music bed locally with Stable Audio 3 (config.yaml music_gen:) into an episode's music/ folder,
// loudness-matched to the library bed and credited AI-GENERATED (Powered by Stability AI). See the compose-music skill.
//
// Usage:
//   npm run compose -- <slug> <name> --prompt "..." [--seconds N] [--seed N] [--model medium|small-music] [--force] [--ignore-off]
//       -> public/episodes/<slug>/music/<name>.mp3, credits.json entry, assets.json refreshed.
//          --seconds defaults to the whole video (timing.json) plus a little; the model makes up to 380 s per pass
//          (small-music 120 s) and longer beds are extended with its own continuation.
//          Every run takes a fresh random seed (recorded in credits.json); --seed re-makes a bed you liked.
//   npm run compose -- --sample "prompt" [--seconds 30] [--seed N]   audition a prompt -> out/music-samples/ (no credit)
import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { AI_LICENSE, type Credit } from "../src/kit/schema.ts";
import { scanAssets } from "./lib/assets.ts";
import { loadConfig } from "./lib/config.ts";
import { getSecret } from "./lib/env.ts";
import { loadFromDisk } from "./lib/episode.ts";
import { fail, info, ok, parseArgs, paths, readJson, ROOT, SLUG_RE, warn } from "./lib/util.ts";

const COMMIT = "77e0398c26f7d22d801ec1bb036307e8b231f741"; // stable-audio-3, as pinned in requirements-music.txt
const HF = { medium: "stabilityai/stable-audio-3-medium", "small-music": "stabilityai/stable-audio-3-small-music" } as const;
const LABEL = { medium: "Stable Audio 3 Medium", "small-music": "Stable Audio 3 Small-Music" } as const;
const usage = 'npm run compose -- <slug> <name> --prompt "..." [--seconds N] [--seed N]   (or --sample "prompt")';

const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const num = (k: string) => {
  const v = str(k);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`--${k} must be a number`);
  return n;
};
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

const cfg = loadConfig().music_gen;
const sample = str("sample");
const model = (str("model") ?? cfg.model) as keyof typeof HF;
if (!(model in HF)) fail(`--model must be medium or small-music`);
const py = process.platform === "win32" ? join(ROOT, ".venv-music", "Scripts", "python.exe") : join(ROOT, ".venv-music", "bin", "python");
if (!existsSync(py)) fail("The music environment isn't installed. Run: npm run setup:music  (one time)");

// --- what to make
let slug: string | undefined, name: string | undefined, prompt: string, seconds: number;
if (sample) {
  prompt = sample;
  seconds = num("seconds") ?? 30;
} else {
  [slug, name] = positional;
  if (!slug || !SLUG_RE.test(slug) || !existsSync(paths(slug).episode)) fail(`Give an episode slug and a bed name.\n  usage: ${usage}`);
  if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the bed a name (lowercase letters, digits, _ or -), e.g. bed.\n  usage: ${usage}`);
  if (!cfg.enabled && !flags["ignore-off"]) fail("Generated music is off (config.yaml: music_gen.enabled: false). Set it to true, or pass --ignore-off for a one-off.");
  const p = str("prompt");
  if (!p) fail(`Say what to make: --prompt "genre, instruments, mood, tempo (e.g. 96 BPM)". See the compose-music skill.`);
  prompt = p!;
  const given = num("seconds");
  if (given !== undefined) seconds = given;
  else {
    const d = loadFromDisk(slug!);
    if (!d.timeline) fail(`No timing for ${slug} yet, so the video length is unknown: run align (or align --estimate) first, or pass --seconds.`);
    seconds = Math.ceil(d.timeline!.durationInFrames / 30 + 2);
    info(`video is ${(d.timeline!.durationInFrames / 30).toFixed(1)}s${d.timeline!.estimated ? " (estimated timing)" : ""}: making a ${seconds}s bed`);
  }
}
if (!(seconds > 0 && seconds <= 1800)) fail("--seconds must be between 0 and 1800");
const seed = num("seed") ?? randomInt(0, 2 ** 31 - 1);

const out = slug ? join(paths(slug).pub, "music", `${name}.mp3`) : join(ROOT, "out", "music-samples", `sample-${Date.now()}-${seed}.mp3`);
if (slug && existsSync(out) && !flags.force) fail(`${rel(out)} already exists. Pick another name, or pass --force to replace it.`);

// --- generate (Python, .venv-music)
const tmp = join(ROOT, "out", "compose-tmp");
mkdirSync(tmp, { recursive: true });
const wav = join(tmp, `${name ?? "sample"}-${seed}.wav`);
const hf = getSecret("HF_TOKEN");
info(`${LABEL[model]}: ${seconds}s, seed ${seed}${seconds > (model === "medium" ? 380 : 120) ? " (longer than one pass: extending with continuation)" : ""}`);
const r = spawnSync(py, [join(ROOT, "scripts", "music_gen.py"), "--model", model, "--prompt", prompt, "--seconds", String(seconds), "--seed", String(seed), "--steps", String(cfg.steps), "--out", wav], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  env: { ...process.env, PYTHONIOENCODING: "utf-8", HF_HUB_DISABLE_SYMLINKS_WARNING: "1", ...(hf ? { HF_TOKEN: hf.value } : {}) },
});
const lines = (r.stdout ?? "").trim().split(/\r?\n/);
if (r.status !== 0 || !existsSync(wav)) {
  const text = lines.join("\n");
  if (r.status === 3 || /"error": "gated"/.test(text)) {
    fail(`Hugging Face refused the download. Accept the terms at https://huggingface.co/${HF[model]}, then log in: ${rel(py).replace("python.exe", "hf.exe").replace(/\/python$/, "/hf")} auth login (or HF_TOKEN=... in .env).`);
  }
  fail(`generation failed (exit ${r.status}). See the output above.${text ? `\n${text.slice(-1500)}` : ""}`);
}
const summary = JSON.parse(lines[lines.length - 1]) as {
  seconds: number;
  passes: { seed: number; seconds: number }[];
  repairs: { from: number; to: number; seed: number }[];
  holesLeft: [number, number][];
  generateSeconds: number;
  loadSeconds: number;
  device: string;
  peakVramGB: number | null;
};
if (summary.repairs.length) info(`regenerated ${summary.repairs.length} silent stretch${summary.repairs.length > 1 ? "es" : ""} in place (${summary.repairs.map((x) => `${x.from}–${x.to}s`).join(", ")})`);
if (summary.holesLeft.length) warn(`still quiet after 3 tries: ${summary.holesLeft.map(([a, b]) => `${a}–${b}s`).join(", ")}. Listen there, and run it again (--force) if it's a hole.`);

// --- level like the library bed, then MP3
const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf("{")).replace(/}[\s\S]*$/, "}")) as { input_i: string; input_tp: string };
const I = Number(m.input_i), TP = Number(m.input_tp);
const gain = Math.min(Number.isFinite(I) ? cfg.lufs - I : 0, -2 - TP);
mkdirSync(join(out, ".."), { recursive: true });
// Write beside it, then rename into place: a Short's music/ files are hard links to the parent's, and writing through
// the link would change the parent's bed too. The rename replaces only this folder's entry.
const mp3 = join(tmp, `${name ?? "sample"}-${seed}.mp3`);
const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-af", `volume=${gain.toFixed(2)}dB`, "-c:a", "libmp3lame", "-q:a", "2", mp3], { stdio: "inherit" });
if (ff.status !== 0) fail("ffmpeg could not write the MP3.");
rmSync(out, { force: true });
renameSync(mp3, out);
rmSync(wav, { force: true });

const level = `${Number.isFinite(I) ? `${(I + gain).toFixed(1)} LUFS, ` : ""}peak ${(TP + gain).toFixed(1)} dBTP`;
const timing = `${summary.generateSeconds}s on ${summary.device}${summary.peakVramGB ? `, peak ${summary.peakVramGB} GB VRAM` : ""}`;

if (!slug) {
  ok(`${rel(out)}  (${summary.seconds}s, seed ${seed}, ${level}; ${timing})`);
  if (process.platform === "win32" && !flags["no-play"]) spawnSync("cmd", ["/c", "start", "", out], { stdio: "ignore" });
  process.exit(0);
}

// --- credit + assets
const creditsFile = paths(slug).credits;
const credits: Credit[] = existsSync(creditsFile) ? readJson<Credit[]>(creditsFile) : [];
const file = `music/${name}.mp3`;
const entry: Credit = {
  file,
  title: `${name} (music bed)`,
  author: `Generated with ${LABEL[model]} (Stability AI)`,
  license: AI_LICENSE,
  sourceUrl: `https://huggingface.co/${HF[model]}`,
  notes: `Powered by Stability AI. ${LABEL[model]}, Stability AI Community License; generated locally with npm run compose. Prompt: "${prompt}". Seed ${seed}${summary.passes.length > 1 ? ` (+${summary.passes.length - 1} continuation passes, seeds ${summary.passes.slice(1).map((x) => x.seed).join(", ")})` : ""}${summary.repairs.length ? `, ${summary.repairs.length} silent stretch(es) regenerated in place` : ""}, ${cfg.steps} steps, ${summary.seconds}s, normalized to ${cfg.lufs} LUFS.`,
  generator: {
    provider: "local",
    model: HF[model],
    version: `stable-audio-3@${COMMIT.slice(0, 12)}`,
    prompt,
    input: { seed, steps: cfg.steps, seconds, passes: summary.passes, repairs: summary.repairs },
    created: new Date().toISOString(),
  },
};
writeFileSync(creditsFile, JSON.stringify([...credits.filter((c) => c.file !== file), entry], null, 2) + "\n");
scanAssets(slug);

ok(`${rel(out)}  (${summary.seconds}s, seed ${seed}, ${level}; ${timing})`);
const ep = readJson<{ audio?: { music?: { file?: string } } }>(paths(slug).episode);
const using = ep.audio?.music?.file === name;
console.log(`
Next:
  • LISTEN to it (or hear it in the preview).${using ? "" : `
  • Use it: "audio": { "music": { "file": "${name}", "level": 0.16, "duck": true } }`}
  • Not right? Run it again for a fresh seed (--force), or change the prompt. This one is seed ${seed} if you want it back.`);
if (!summary.passes.length) warn("no passes recorded");
