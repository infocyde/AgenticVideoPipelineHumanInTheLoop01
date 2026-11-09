// Lip-sync a stretch of an existing clip to the song with Sync Labs' lipsync-2-pro on Replicate (a paid call, roughly
// $0.07–0.08 per second of video).
//   npm run lipsync -- <slug> <clip> <name> --from <song seconds> [--in <clip seconds>] [--seconds 3]
//       [--temperature 0.5] [--sync-mode cut_off] [--audio <wav>] [--force]
// Cuts <clip> from --in and the episode's vocals stem (the lyrics step's Demucs split; the song itself if there is none)
// from --from, both --seconds long, sends them to Replicate, and saves the result's picture as public clips/<name>.mp4
// (no audio: the song plays under it), credited AI-GENERATED with the source clip, the audio window and the prediction.
// Place it on the shot whose start is --from, with "in": 0, and "note": "AI-GENERATED FOOTAGE".
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Credit } from "../src/kit/schema.ts";
import { episodeVoiceover, scanAssets } from "./lib/assets.ts";
import { getSecret } from "./lib/env.ts";
import { cutInputs, LIPSYNC_MODEL, lipsyncCredit, SYNC_MODES, windowIssues } from "./lib/lipsync.ts";
import { fail, info, ok, parseArgs, paths, requireSlug, ROOT, warn } from "./lib/util.ts";

const usage = "npm run lipsync -- <slug> <clip> <name> --from <song seconds> [--in <clip seconds>] [--seconds 3] [--temperature 0.5] [--sync-mode cut_off] [--audio <wav>] [--force]";
const { positional, flags } = parseArgs();
const slug = requireSlug(usage);
const [, clip, name] = positional;
const p = paths(slug);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");
const num = (k: string, d?: number) => {
  const v = flags[k];
  if (v === undefined || v === true) return d;
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`--${k} must be a number (got ${v})`);
  return n;
};

if (!clip || !name) fail(`Give the source clip and a name for the new one.\n  usage: ${usage}`);
if (!/^[a-z0-9_-]+$/.test(name)) fail(`The name must be lowercase letters, digits, _ or - (got "${name}")`);
const src = join(p.pub, "clips", `${clip.replace(/\.mp4$/, "")}.mp4`);
if (!existsSync(src)) fail(`no clip ${rel(src)}`);
const out = join(p.pub, "clips", `${name}.mp4`);
if (existsSync(out) && !flags.force) fail(`"${name}.mp4" already exists for this episode. Pick another name, or pass --force to replace it.`);

const from = num("from");
if (from === undefined) fail(`--from (where in the song the shot starts, in seconds) is required.\n  usage: ${usage}`);
const at = num("in", 0)!;
const seconds = num("seconds", 3)!;
const temperature = num("temperature", 0.5)!;
if (temperature < 0 || temperature > 1) fail("--temperature must be 0–1");
const syncMode = typeof flags["sync-mode"] === "string" ? (flags["sync-mode"] as string) : "cut_off";
if (!SYNC_MODES.includes(syncMode)) fail(`--sync-mode must be one of ${SYNC_MODES.join(", ")}`);

// The audio: an explicit wav, else the vocals stem, else the song.
const episode = JSON.parse(readFileSync(p.episode, "utf8"));
const stem = join(p.src, "stems", "htdemucs", "song", "vocals.wav");
const songFile = episode.song?.file ? join(p.pub, episode.song.file) : undefined;
const audioSrc = typeof flags.audio === "string" ? join(ROOT, flags.audio as string) : existsSync(stem) ? stem : songFile;
if (!audioSrc || !existsSync(audioSrc)) fail("no audio: pass --audio <wav> (the episode has no vocals stem or song)");
const audioPath = audioSrc!;
const start = from!;
if (audioPath === songFile) warn("no vocals stem (run npm run lyrics first): sending the full mix, which syncs less cleanly");

const dur = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());
const issues = windowIssues({ clipSeconds: dur(src), songSeconds: dur(audioPath), in: at, from: start, seconds });
if (issues.length) fail(issues.join("\n  "));

const token = getSecret("REPLICATE_API_TOKEN");
if (!token) fail("REPLICATE_API_TOKEN not found in the environment or in a .env file in this folder or its parents.");
const auth = { Authorization: `Bearer ${token!.value}` };

// --- cut the inputs (kept with the episode)
const dir = join(p.src, "raw", "lipsync", name);
mkdirSync(dir, { recursive: true });
const { video, audio } = cutInputs({ clip: src, in: at, song: audioPath, from: start, seconds, dir });
info(`inputs: ${rel(video)} (${clip} from ${at} s) + ${rel(audio)} (song from ${start} s), ${seconds} s each`);

// --- upload them to Replicate's file store, then run the model
const upload = async (file: string, type: string) => {
  const form = new FormData();
  form.append("content", new Blob([readFileSync(file)], { type }), file.split(/[\\/]/).pop());
  const r = await fetch("https://api.replicate.com/v1/files", { method: "POST", headers: auth, body: form });
  if (!r.ok) fail(`uploading ${rel(file)} failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
  return ((await r.json()) as { urls: { get: string } }).urls.get;
};
const input = { video: await upload(video, "video/mp4"), audio: await upload(audio, "audio/wav"), sync_mode: syncMode, temperature, active_speaker: false };

type Prediction = { id: string; status: string; output?: string | null; error?: string | null; version?: string; urls: { get: string } };
info(`lip-syncing "${name}" with ${LIPSYNC_MODEL} (paid call)…`);
const res = await fetch(`https://api.replicate.com/v1/models/${LIPSYNC_MODEL}/predictions`, { method: "POST", headers: { ...auth, "Content-Type": "application/json", Prefer: "wait=60" }, body: JSON.stringify({ input }) });
if (!res.ok) fail(`Replicate refused the request (${res.status}): ${(await res.text()).slice(0, 500)}`);
let pred = (await res.json()) as Prediction;
const started = Date.now();
while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
  if (Date.now() - started > 15 * 60_000) fail(`still ${pred.status} after 15 minutes; prediction ${pred.id}`);
  await new Promise((r) => setTimeout(r, 3000));
  const r = await fetch(pred.urls.get, { headers: auth });
  if (!r.ok) fail(`polling failed (${r.status})`);
  pred = (await r.json()) as Prediction;
}
if (pred.status !== "succeeded" || !pred.output) fail(`lip-sync ${pred.status}: ${pred.error ?? "no output"} (prediction ${pred.id})`);
const dl = await fetch(pred.output!);
if (!dl.ok) fail(`downloading the result failed (${dl.status})`);
const result = join(dir, "output.mp4");
writeFileSync(result, Buffer.from(await dl.arrayBuffer()));

// --- the episode's copy: picture only (the song plays under it)
const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", result, "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", out], { encoding: "utf8" });
if (ff.status !== 0) fail(`ffmpeg failed:\n  ${(ff.stderr ?? "").trim().split(/\r?\n/).slice(-3).join("\n  ")}`);
copyFileSync(audio, join(dir, "audio.wav")); // already there; keeps the record obvious

const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
const srcCredit = credits.find((c) => c.file === `clips/${clip.replace(/\.mp4$/, "")}.mp4`);
const credit = lipsyncCredit({
  file: `clips/${name}.mp4`,
  name,
  source: { clip: `clips/${clip.replace(/\.mp4$/, "")}.mp4`, in: at, sourceUrl: srcCredit?.sourceUrl },
  audio: { file: rel(audioPath), from: start },
  seconds,
  version: pred.version,
  predictionId: pred.id,
  input: { sync_mode: syncMode, temperature },
  created: new Date().toISOString(),
});
writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== credit.file), credit], null, 2) + "\n");
scanAssets(slug, episodeVoiceover(slug));

ok(`${rel(out)} (${dur(out).toFixed(2)} s; original with audio: ${rel(result)}; prediction ${pred.id})`);
console.log(`\nNext:\n  • LOOK at it with the song: mouth on the words, held notes, face whole, no warping.\n  • Use it on the shot that starts at ${start} s with "in": 0 and "note": "AI-GENERATED FOOTAGE".`);
