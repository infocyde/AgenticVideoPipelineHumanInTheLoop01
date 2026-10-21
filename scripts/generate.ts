// Generate a still when no good licensed image can be found: locally with Z-Image Turbo (stable-diffusion.cpp, GGUF)
// or in the cloud with FLUX 3 (Black Forest Labs, via Replicate). config.yaml image_gen.mode picks:
//   local_render  every still on this GPU (free)
//   cloud_render  every still with FLUX 3 (paid API call)
//   mixed         local for ordinary stills; FLUX 3 for --detail high (thumbnail backgrounds, hero shots) when
//                 REPLICATE_API_TOKEN is available, otherwise local too
// Saves public/episodes/<slug>/images/<name>.jpg (1920×1080), records provenance in credits.json, refreshes assets.json.
// The untouched original is kept in out/<slug>/generated/.
//
// Usage: npm run generate -- <slug> <name> --prompt "..." [--detail high] [--engine local|cloud] [--seed N] [--force]
//          [--aspect 16:9] [--resolution 2k] [--grounding] [--safety 2]   (cloud only)
//        npm run generate -- --sample "prompt" [--detail high] [--engine local|cloud] [--seed N]   -> out/image-samples/
//   --prompt-file <path>  read the prompt from a file instead
//   --seed N              local only: remake an image (every run takes a fresh random seed, recorded in credits.json)
//   --steps N --cfg X     local only: override config.yaml for one run (the negative prompt applies only when cfg > 1)
//   --grounding           cloud only: let FLUX web-search the prompt first (off by default: it pulls in real news imagery)
import { execFileSync, spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { AI_LICENSE, type Credit } from "../src/kit/schema.ts";
import { IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { loadConfig } from "./lib/config.ts";
import { getSecret } from "./lib/env.ts";
import { fail, info, ok, parseArgs, paths, ROOT, SLUG_RE, warn } from "./lib/util.ts";

const FLUX = "black-forest-labs/flux-3-image";
const ZIMAGE = "Tongyi-MAI/Z-Image-Turbo";
const ASPECTS = ["auto", "21:9", "2:1", "16:9", "3:2", "7:5", "4:3", "5:4", "1:1", "4:5", "3:4", "5:7", "2:3", "9:16", "1:2", "9:21"];
const RESOLUTIONS = ["768sq", "1k", "1.5k", "2k", "4k"];
export const AI_NOTE = "AI-GENERATED ILLUSTRATION";

const usage = 'npm run generate -- <slug> <name> --prompt "..." [--detail high] [--engine local|cloud] [--seed N] [--force]   (or --sample "prompt")';
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");
const abs = (f: string) => (isAbsolute(f) ? f : join(ROOT, f));
const cfg = loadConfig().image_gen;

// --- what to make
const sample = str("sample");
let slug: string | undefined, name: string | undefined;
if (!sample) {
  [slug, name] = positional;
  if (!slug || !SLUG_RE.test(slug) || !existsSync(paths(slug).episode)) fail(`Give an episode slug and an image name.\n  usage: ${usage}`);
  if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the visual a name (lowercase letters, digits, _ or -), e.g. tanker_night.\n  usage: ${usage}`);
}
const prompt = sample ?? (str("prompt-file") ? readFileSync(str("prompt-file")!, "utf8").trim() : str("prompt") ?? "");
if (!prompt) fail(`--prompt is required.\n  usage: ${usage}`);

const p = slug ? paths(slug) : undefined;
if (p) {
  const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === name);
  if (taken.length && !flags.force) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);
}

// --- which engine
const detail = str("detail") ?? "normal";
if (!["normal", "high"].includes(detail)) fail("--detail must be normal or high");
const token = getSecret("REPLICATE_API_TOKEN");
let engine = str("engine") as "local" | "cloud" | undefined;
if (engine && !["local", "cloud"].includes(engine)) fail("--engine must be local or cloud");
if (!engine) {
  if (cfg.mode === "cloud_render") engine = "cloud";
  else if (cfg.mode === "local_render") engine = "local";
  else engine = detail === "high" && token ? "cloud" : "local";
  if (cfg.mode === "mixed" && detail === "high" && !token) warn("mixed mode wants FLUX 3 for --detail high, but REPLICATE_API_TOKEN isn't set: rendering locally instead.");
}
info(`engine: ${engine === "local" ? "Z-Image Turbo (local)" : "FLUX 3 (Replicate)"}  [image_gen.mode ${cfg.mode}${detail === "high" ? ", --detail high" : ""}${str("engine") ? ", --engine override" : ""}]`);

const rawDir = p ? join(p.out, "generated") : join(ROOT, "out", "image-samples");
mkdirSync(rawDir, { recursive: true });
let raw: string, entry: Omit<Credit, "file">, aspect = "16:9";

if (engine === "local") {
  // --- Z-Image Turbo via stable-diffusion.cpp
  const n = (k: string) => (str(k) !== undefined ? Number(str(k)) : undefined);
  const L = { ...cfg.local, steps: n("steps") ?? cfg.local.steps, cfg: n("cfg") ?? cfg.local.cfg };
  if (!(Number.isInteger(L.steps) && L.steps > 0) || !(L.cfg >= 1)) fail("--steps must be a whole number > 0 and --cfg ≥ 1");
  for (const [what, f] of [["sd-cli", L.sdcpp], ["model", L.model], ["text encoder", L.text_encoder], ["VAE", L.vae]] as const) {
    if (!existsSync(abs(f))) fail(`Local image generation isn't set up (${what} not found: ${f}). Run: npm run setup:image  (one time)`);
  }
  const seed = str("seed") !== undefined ? Number(str("seed")) : randomInt(0, 2 ** 31 - 1);
  if (!Number.isInteger(seed) || seed < 0) fail("--seed must be a whole number ≥ 0");
  raw = join(rawDir, `${name ?? "sample"}-local-${seed}.png`);
  const args = [
    "--diffusion-model", abs(L.model), "--llm", abs(L.text_encoder), "--vae", abs(L.vae),
    "-p", prompt, "-W", String(L.width), "-H", String(L.height),
    "--steps", String(L.steps), "--cfg-scale", String(L.cfg), "--flow-shift", String(L.shift),
    "--sampling-method", L.sampler, "--scheduler", L.scheduler,
    "-s", String(seed), "--rng", "cpu", "--sampler-rng", "cpu", "-o", raw,
    ...(L.negative_prompt && L.cfg > 1 ? ["-n", L.negative_prompt] : []),
    ...(L.offload_to_cpu ? ["--offload-to-cpu"] : []),
    ...(L.flash_attention ? ["--flash-attn", "off,diffusion=on"] : []),
    ...(L.vae_tiling ? ["--vae-tiling"] : []),
  ];
  info(`Z-Image Turbo ${L.width}×${L.height}, ${L.steps} steps, CFG ${L.cfg}${L.negative_prompt && L.cfg > 1 ? " + negative prompt" : ""}, seed ${seed}`);
  const t0 = Date.now();
  const r = spawnSync(abs(L.sdcpp), args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0 || !existsSync(raw)) fail(`sd-cli failed (exit ${r.status}):\n${(r.stderr || r.stdout || "").trim().split(/\r?\n/).slice(-12).join("\n")}`);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  info(`rendered in ${secs}s`);
  entry = {
    title: `AI-generated illustration: ${name}`,
    author: "Generated locally with Z-Image Turbo (Tongyi-MAI)",
    license: AI_LICENSE,
    sourceUrl: `https://huggingface.co/${ZIMAGE}`,
    notes: "AI-generated; not a photograph of a real event. Shown with an on-screen note. Z-Image Turbo (Apache-2.0), Q4_K GGUF via stable-diffusion.cpp.",
    generator: {
      provider: "local",
      model: ZIMAGE,
      version: L.model.replace(/^.*[\\/]/, ""),
      prompt,
      input: { seed, width: L.width, height: L.height, steps: L.steps, cfg: L.cfg, shift: L.shift, sampler: L.sampler, scheduler: L.scheduler, negative_prompt: L.cfg > 1 ? L.negative_prompt : "", text_encoder: L.text_encoder.replace(/^.*[\\/]/, ""), seconds: Number(secs) },
      created: new Date().toISOString(),
    },
  };
} else {
  // --- FLUX 3 via Replicate
  if (!token) fail("REPLICATE_API_TOKEN not found in the environment or in a .env file in this folder or its parents.");
  aspect = str("aspect") ?? "16:9";
  if (!ASPECTS.includes(aspect)) fail(`--aspect must be one of ${ASPECTS.join(", ")}`);
  const resolution = str("resolution") ?? cfg.cloud.resolution;
  if (!RESOLUTIONS.includes(resolution)) fail(`--resolution must be one of ${RESOLUTIONS.join(", ")}`);
  const safety = str("safety") !== undefined ? Number(str("safety")) : cfg.cloud.safety;
  if (!Number.isInteger(safety) || safety < 0 || safety > 4) fail("--safety must be 0 (strictest) to 4");
  const headers = { Authorization: `Bearer ${token!.value}`, "Content-Type": "application/json" };
  type Prediction = { id: string; status: string; output?: string | string[] | null; error?: string | null; version?: string; urls: { get: string } };
  const input = { prompt, aspect_ratio: aspect, resolution, grounding: !!flags.grounding, safety_tolerance: safety, output_format: "png" };

  info(`generating "${name ?? "sample"}" with FLUX 3 (${aspect}, ${resolution}${input.grounding ? ", grounding on" : ""})…`);
  const res = await fetch(`https://api.replicate.com/v1/models/${FLUX}/predictions`, { method: "POST", headers: { ...headers, Prefer: "wait=60" }, body: JSON.stringify({ input }) });
  if (!res.ok) fail(`Replicate refused the request (${res.status}): ${(await res.text()).slice(0, 500)}`);
  let pred = (await res.json()) as Prediction;
  const started = Date.now();
  while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
    if (Date.now() - started > 5 * 60_000) fail(`still ${pred.status} after 5 minutes; prediction ${pred.id}`);
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(pred.urls.get, { headers });
    if (!r.ok) fail(`polling failed (${r.status})`);
    pred = (await r.json()) as Prediction;
  }
  if (pred.status !== "succeeded") fail(`generation ${pred.status}: ${pred.error ?? "no error message"} (prediction ${pred.id})`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) fail(`prediction ${pred.id} succeeded but returned no image`);
  raw = join(rawDir, `${name ?? "sample"}-${pred.id}.png`);
  const img = await fetch(url!);
  if (!img.ok) fail(`downloading the image failed (${img.status})`);
  writeFileSync(raw, Buffer.from(await img.arrayBuffer()));
  entry = {
    title: `AI-generated illustration: ${name}`,
    author: "Generated with FLUX 3 (Black Forest Labs) via Replicate",
    license: AI_LICENSE,
    sourceUrl: `https://replicate.com/${FLUX}`,
    originalUrl: url!,
    notes: "AI-generated; not a photograph of a real event. Shown with an on-screen note.",
    generator: { provider: "replicate", model: FLUX, version: pred.version, predictionId: pred.id, prompt, input, created: new Date().toISOString() },
  };
  if (input.grounding) warn("grounding was on: make sure the image doesn't pass as a photo of the actual event or a real person.");
}

// --- the 1920×1080 still
const vf = aspect === "16:9" ? "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080" : "scale='min(1920,iw)':-2:flags=lanczos";
if (!p) {
  const out = raw.replace(/\.png$/, ".jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", vf, "-q:v", "3", out]);
  ok(`${rel(out)}  (original: ${rel(raw)})`);
  process.exit(0);
}
mkdirSync(join(p.pub, "images"), { recursive: true });
const out = join(p.pub, "images", `${name}.jpg`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", vf, "-q:v", "3", out]);

// Provenance in credits.json (replaces an earlier entry for the same file).
const file = `images/${name}.jpg`;
const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== file), { file, ...entry }], null, 2) + "\n");
scanAssets(slug!);

ok(`public/episodes/${slug}/${file} (original: ${rel(raw)})`);
console.log(`
Next:
  • LOOK at the image before using it: wrong details, garbled text, logos, real-looking faces. Regenerate with --force if needed.
  • Use it as { "name": "${name}", "note": "${AI_NOTE}" } (check requires a note on AI-generated visuals),
    or as the thumbnail background: "thumbnail": { "visual": "${name}" }.`);
