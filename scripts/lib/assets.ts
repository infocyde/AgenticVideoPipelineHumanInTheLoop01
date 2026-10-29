// Scan an episode's media plus the shared library with ffprobe and write public/episodes/<slug>/assets.json.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { infographicFiles, youtubeAttributions } from "../../src/kit/lib/attribution.ts";
import { parseCredits } from "../../src/kit/lib/credits.ts";
import { type AssetManifest, type EpisodeInput, isMusicVideo, type MediaFile, type MusicVideoInput } from "../../src/kit/schema.ts";
import { paths, PUBLIC, readJson } from "./util.ts";

export const VIDEO_EXT = [".mp4", ".webm", ".mov"];
export const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];
export const AUDIO_EXT = [".mp3", ".wav", ".m4a", ".ogg"];

export const LIBRARY = join(PUBLIC, "library");

const probe = (file: string): Omit<MediaFile, "file"> => {
  const json = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type", "-of", "json", file]).toString(),
  ) as { format?: { duration?: string }; streams?: { width?: number; height?: number; codec_type?: string }[] };
  const v = json.streams?.find((s) => s.codec_type === "video" && s.width);
  const d = Number(json.format?.duration);
  return { ...(Number.isFinite(d) && d > 0 ? { duration: +d.toFixed(3) } : {}), ...(v ? { width: v.width, height: v.height } : {}) };
};

/** Files with the given extensions in `dir`, keyed by basename. */
export const listMedia = (dir: string, exts: string[]) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => exts.includes(extname(f).toLowerCase())).sort() : [];

const scanDir = (dir: string, exts: string[], probeIt: boolean): Record<string, MediaFile> =>
  Object.fromEntries(
    listMedia(dir, exts).map((f) => {
      const abs = join(dir, f);
      const file = relative(PUBLIC, abs).split("\\").join("/");
      return [basename(f, extname(f)), { file, ...(probeIt ? probe(abs) : {}) }];
    }),
  );

/** The audio file in the manifest's voiceover slot: a music video's song (its only audio), else `audio.voiceover`. */
export const voiceoverOf = (raw: unknown): string =>
  isMusicVideo(raw) ? ((raw as MusicVideoInput).song?.file ?? "song.wav") : ((raw as EpisodeInput | null)?.audio?.voiceover ?? "voiceover.mp3");

/** `voiceoverOf` the slug's episode.json; the default when it is missing or broken (check reports that). */
export const episodeVoiceover = (slug: string): string => {
  try {
    return voiceoverOf(readJson<unknown>(paths(slug).episode));
  } catch {
    return voiceoverOf(null);
  }
};

/** YouTube clip -> channel from credits.json text; none when it is missing or malformed (check reports bad JSON). */
export const creditAttributions = (text: string | null): Record<string, string> => {
  try {
    return youtubeAttributions(parseCredits(text === null ? [] : JSON.parse(text)));
  } catch {
    return {};
  }
};

/** Files made by npm run infographic, from credits.json text; none when it is missing or malformed. */
export const creditInfographics = (text: string | null): Set<string> => {
  try {
    return infographicFiles(parseCredits(text === null ? [] : JSON.parse(text)));
  } catch {
    return new Set();
  }
};

export const scanAssets = (slug: string, voiceover = "voiceover.mp3"): AssetManifest => {
  const p = paths(slug);
  const vo = join(p.pub, voiceover);
  const manifest: AssetManifest = {
    voiceover: existsSync(vo) ? { file: `episodes/${slug}/${voiceover}`, ...probe(vo) } : null,
    clips: scanDir(join(p.pub, "clips"), VIDEO_EXT, true),
    images: scanDir(join(p.pub, "images"), IMAGE_EXT, true),
    // Episode-local sounds override library sounds with the same name.
    sfx: { ...scanDir(join(LIBRARY, "sfx"), AUDIO_EXT, true), ...scanDir(join(p.pub, "sfx"), AUDIO_EXT, true) },
    music: { ...scanDir(join(LIBRARY, "music"), AUDIO_EXT, true), ...scanDir(join(p.pub, "music"), AUDIO_EXT, true) },
  };
  // Clips from YouTube carry their channel (the credit author) so the kit can tag them on screen.
  const creditsText = existsSync(p.credits) ? readFileSync(p.credits, "utf8") : null;
  const attr = creditAttributions(creditsText);
  for (const clip of Object.values(manifest.clips)) {
    const a = attr[`clips/${basename(clip.file)}`];
    if (a) clip.attribution = a;
  }
  // Infographics and explainers are marked so overlay layouts can show them in a panel.
  const graphics = creditInfographics(creditsText);
  for (const [dir, list] of [["clips", manifest.clips], ["images", manifest.images]] as const)
    for (const m of Object.values(list)) if (graphics.has(`${dir}/${basename(m.file)}`)) m.infographic = true;
  writeFileSync(p.assets, JSON.stringify(manifest, null, 1) + "\n");
  return manifest;
};
