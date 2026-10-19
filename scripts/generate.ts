// Generate a still with FLUX 3 (Black Forest Labs, via Replicate) when no good licensed image can be found.
// Saves public/episodes/<slug>/images/<name>.jpg (1920×1080), records provenance in credits.json, refreshes assets.json.
//
// Usage: npm run generate -- <slug> <name> --prompt "..." [--aspect 16:9] [--resolution 2k] [--grounding] [--safety 2] [--force]
//   --prompt-file <path>  read the prompt from a file instead
//   --grounding           let the model web-search the prompt first (off by default: it pulls in real news imagery)
// Needs REPLICATE_API_TOKEN in the environment or in a .env file here or in a parent folder.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AI_LICENSE, type Credit } from "../src/kit/schema.ts";
import { IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { getSecret } from "./lib/env.ts";
import { fail, info, ok, parseArgs, paths, requireSlug, warn } from "./lib/util.ts";

const MODEL = "black-forest-labs/flux-3-image";
const ASPECTS = ["auto", "21:9", "2:1", "16:9", "3:2", "7:5", "4:3", "5:4", "1:1", "4:5", "3:4", "5:7", "2:3", "9:16", "1:2", "9:21"];
const RESOLUTIONS = ["768sq", "1k", "1.5k", "2k", "4k"];
export const AI_NOTE = "AI-GENERATED ILLUSTRATION";

const usage = 'npm run generate -- <slug> <name> --prompt "..." [--aspect 16:9] [--resolution 2k] [--grounding] [--force]';
const slug = requireSlug(usage);
const { positional, flags } = parseArgs();
const name = positional[1];
if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the visual a name (lowercase letters, digits, _ or -), e.g. tanker_night.\n  usage: ${usage}`);

const prompt = typeof flags["prompt-file"] === "string" ? readFileSync(flags["prompt-file"], "utf8").trim() : typeof flags.prompt === "string" ? flags.prompt.trim() : "";
if (!prompt) fail(`--prompt is required.\n  usage: ${usage}`);
const aspect = typeof flags.aspect === "string" ? flags.aspect : "16:9";
if (!ASPECTS.includes(aspect)) fail(`--aspect must be one of ${ASPECTS.join(", ")}`);
const resolution = typeof flags.resolution === "string" ? flags.resolution : "2k";
if (!RESOLUTIONS.includes(resolution)) fail(`--resolution must be one of ${RESOLUTIONS.join(", ")}`);
const safety = typeof flags.safety === "string" ? Number(flags.safety) : 2;
if (!Number.isInteger(safety) || safety < 0 || safety > 4) fail("--safety must be 0 (strictest) to 4");

const p = paths(slug);
const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === name);
if (taken.length && !flags.force) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);

const secret = getSecret("REPLICATE_API_TOKEN");
if (!secret) fail("REPLICATE_API_TOKEN not found in the environment or in a .env file in this folder or its parents.");
const headers = { Authorization: `Bearer ${secret!.value}`, "Content-Type": "application/json" };

type Prediction = { id: string; status: string; output?: string | string[] | null; error?: string | null; version?: string; urls: { get: string } };

const input = { prompt, aspect_ratio: aspect, resolution, grounding: !!flags.grounding, safety_tolerance: safety, output_format: "png" };

info(`generating "${name}" with FLUX 3 (${aspect}, ${resolution}${input.grounding ? ", grounding on" : ""})…`);
const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
  method: "POST",
  headers: { ...headers, Prefer: "wait=60" },
  body: JSON.stringify({ input }),
});
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

// Keep the untouched original next to the renders (out/ is not committed), then make the 1920×1080 still.
const rawDir = join(p.out, "generated");
mkdirSync(rawDir, { recursive: true });
const raw = join(rawDir, `${name}-${pred.id}.png`);
const img = await fetch(url!);
if (!img.ok) fail(`downloading the image failed (${img.status})`);
writeFileSync(raw, Buffer.from(await img.arrayBuffer()));

mkdirSync(join(p.pub, "images"), { recursive: true });
const out = join(p.pub, "images", `${name}.jpg`);
const vf = aspect === "16:9" ? "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" : "scale='min(1920,iw)':-2";
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", vf, "-q:v", "3", out]);

// Provenance in credits.json (replaces an earlier entry for the same file).
const file = `images/${name}.jpg`;
const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
const entry: Credit = {
  file,
  title: `AI-generated illustration: ${name}`,
  author: "Generated with FLUX 3 (Black Forest Labs) via Replicate",
  license: AI_LICENSE,
  sourceUrl: `https://replicate.com/${MODEL}`,
  originalUrl: url!,
  notes: "AI-generated; not a photograph of a real event. Shown with an on-screen note.",
  generator: { provider: "replicate", model: MODEL, version: pred.version, predictionId: pred.id, prompt, input, created: new Date().toISOString() },
};
writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== file), entry], null, 2) + "\n");
scanAssets(slug);

ok(`public/episodes/${slug}/${file} (raw: out/${slug}/generated/${name}-${pred.id}.png)`);
console.log(`
Next:
  • LOOK at the image before using it: wrong details, garbled text, logos, real-looking faces. Regenerate with --force if needed.
  • Use it as { "name": "${name}", "note": "${AI_NOTE}" } (check requires a note on AI-generated visuals),
    or as the thumbnail background: "thumbnail": { "visual": "${name}" }.`);
if (input.grounding) warn("grounding was on: make sure the image doesn't pass as a photo of the actual event or a real person.");
