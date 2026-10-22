// Music videos on disk: telling them apart from news episodes, naming the song, and loading one the way the
// composition does (src/kit/lib/resolveMusicVideo.ts).
import { existsSync } from "node:fs";
import { basename, extname } from "node:path";
import { type MusicVideoTimeline, resolveMusicVideo } from "../../src/kit/lib/resolveMusicVideo.ts";
import { type AssetManifest, assetsSchema, isMusicVideo, type MusicVideo, musicVideoSchema, type Timing, timingSchema } from "../../src/kit/schema.ts";
import { zodIssues } from "./episode.ts";
import { paths, readJson } from "./util.ts";

/** True when episodes/<slug>/episode.json is a music video (false when it is missing or unreadable). */
export const isMusicVideoSlug = (slug: string) => {
  try {
    return isMusicVideo(readJson(paths(slug).episode));
  } catch {
    return false;
  }
};

/** The song's file name in public/episodes/<slug>/: "song" plus the source's extension, lowercased. */
export const songFileName = (source: string) => `song${extname(source).toLowerCase()}`;

/** "PTRA - Empires (Plata o Plomo Power Mix).wav" -> { title: "Empires", subtitle: "Plata o Plomo Power Mix" }. */
export const titleFromFile = (source: string): { title: string; subtitle?: string } => {
  const name = basename(source.replace(/\\/g, "/"), extname(source)).trim();
  const afterArtist = name.includes(" - ") ? name.slice(name.lastIndexOf(" - ") + 3).trim() : name;
  const m = afterArtist.match(/^(.*?)\s*\(([^()]+)\)$/);
  return m && m[1] ? { title: m[1], subtitle: m[2].trim() } : { title: afterArtist };
};

export type LoadedMusicVideo = {
  slug: string;
  p: ReturnType<typeof paths>;
  episode: MusicVideo | null;
  episodeErrors: string[];
  timing: Timing | null;
  assets: AssetManifest | null;
  timeline: MusicVideoTimeline | null;
};

export const loadMusicVideoFromDisk = (slug: string): LoadedMusicVideo => {
  const p = paths(slug);
  const out: LoadedMusicVideo = { slug, p, episode: null, episodeErrors: [], timing: null, assets: null, timeline: null };
  let raw: unknown;
  try {
    raw = readJson(p.episode);
  } catch (e) {
    out.episodeErrors.push(`episode.json is not valid JSON: ${(e as Error).message}`);
    return out;
  }
  const ep = musicVideoSchema.safeParse(raw);
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
  if (out.episode && out.timing) out.timeline = resolveMusicVideo(out.episode, out.timing, out.assets ?? assetsSchema.parse({}));
  return out;
};
