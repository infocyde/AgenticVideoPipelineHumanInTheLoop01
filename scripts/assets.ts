// Scan clips, images, sfx and music (episode + shared library) with ffprobe and write assets.json.
// Usage: npm run assets -- <slug>
import { existsSync } from "node:fs";
import type { EpisodeInput } from "../src/kit/schema.ts";
import { scanAssets } from "./lib/assets.ts";
import { info, ok, paths, readJson, requireSlug, warn } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run assets -- <slug>");
const p = paths(slug);
let voiceover = "voiceover.mp3";
try {
  voiceover = readJson<EpisodeInput>(p.episode).audio?.voiceover ?? voiceover;
} catch {
  /* check reports a broken episode.json */
}

const hadManifest = existsSync(p.assets);
const m = scanAssets(slug, voiceover);
const fmt = (r: Record<string, { duration?: number; width?: number }>) =>
  Object.entries(r)
    .map(([k, v]) => `${k}${v.duration ? ` (${v.duration.toFixed(1)}s)` : v.width ? ` (${v.width}px)` : ""}`)
    .join(", ") || "-";

info(`voiceover: ${m.voiceover ? `${m.voiceover.file} (${m.voiceover.duration?.toFixed(2)}s)` : "not recorded yet"}`);
info(`clips:  ${fmt(m.clips)}`);
info(`images: ${fmt(m.images)}`);
info(`sfx:    ${Object.keys(m.sfx).join(", ") || "-"}`);
info(`music:  ${fmt(m.music)}`);
for (const [k, v] of Object.entries(m.clips)) {
  if (v.width && (v.width !== 1920 || v.height !== 1080)) warn(`clip ${k} is ${v.width}×${v.height}; the spec is 1920×1080`);
}
ok(`wrote public/episodes/${slug}/assets.json`);
if (!hadManifest) sync();
