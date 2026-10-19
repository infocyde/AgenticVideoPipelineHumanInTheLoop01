// Load an episode's files from disk and resolve its timeline, the same way the composition does.
import { existsSync, readFileSync } from "node:fs";
import { resolveEpisode, type Timeline } from "../../src/kit/lib/resolve.ts";
import {
  type AssetManifest,
  assetsSchema,
  type Episode,
  episodeSchema,
  type Timing,
  timingSchema,
} from "../../src/kit/schema.ts";
import { paths, readJson } from "./util.ts";

export type Loaded = {
  slug: string;
  p: ReturnType<typeof paths>;
  episode: Episode | null;
  episodeErrors: string[];
  timing: Timing | null;
  assets: AssetManifest | null;
  timeline: Timeline | null;
};

export const zodIssues = (e: { issues: { path: PropertyKey[]; message: string }[] }) =>
  e.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);

export const loadFromDisk = (slug: string): Loaded => {
  const p = paths(slug);
  const out: Loaded = { slug, p, episode: null, episodeErrors: [], timing: null, assets: null, timeline: null };

  let raw: unknown;
  try {
    raw = readJson(p.episode);
  } catch (e) {
    out.episodeErrors.push(`episode.json is not valid JSON: ${(e as Error).message}`);
    return out;
  }
  const ep = episodeSchema.safeParse(raw);
  if (!ep.success) out.episodeErrors.push(...zodIssues(ep.error));
  else out.episode = ep.data;

  if (existsSync(p.timing)) {
    const t = timingSchema.safeParse(readJson(p.timing));
    if (t.success) out.timing = t.data;
  }
  if (existsSync(p.assets)) {
    const a = assetsSchema.safeParse(readJson(p.assets));
    if (a.success) out.assets = a.data;
  }
  if (out.episode && out.timing) out.timeline = resolveEpisode(out.episode, out.timing, out.assets ?? assetsSchema.parse({}));
  return out;
};

/** Words of voiceover.txt, split exactly as alignment splits them. */
export const scriptWords = (file: string) => readFileSync(file, "utf8").split(/\s+/).filter(Boolean);
