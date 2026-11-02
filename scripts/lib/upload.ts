// Upload block: videos in a theme listed in config.yaml upload.blocked_themes go to another channel, and Claude never
// uploads them (the user's rule, 2026-11-01, for car-comparisons). A Short is blocked when it, or any parent up its
// chain, is in a blocked theme: `npm run short` and long Shorts can give a Short its own theme (e.g. dispatch).
// Used by npm run pick-file (refuses the file) and npm run upload-text (marks upload.json doNotUpload).
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { loadConfig } from "./config.ts";
import { ROOT } from "./util.ts";

type EpisodeRef = { theme?: string; parent?: string } | null;
export type UploadBlock = { blocked: boolean; theme?: string; via?: string };

/** The theme and parent of episodes/<slug>/episode.json, or null when there is none. */
export const readEpisodeRef = (slug: string): EpisodeRef => {
  const f = join(ROOT, "episodes", slug, "episode.json");
  if (!existsSync(f)) return null;
  try {
    const ep = JSON.parse(readFileSync(f, "utf8")) as { theme?: unknown; parent?: unknown };
    return { theme: typeof ep.theme === "string" ? ep.theme : undefined, parent: typeof ep.parent === "string" ? ep.parent : undefined };
  } catch {
    return null;
  }
};

/** Whether `slug` (or a parent up its chain, at most 5 deep) is in a blocked theme; `via` names the slug that decided it. */
export const uploadBlocked = (slug: string, blocked: string[], read: (slug: string) => EpisodeRef = readEpisodeRef): UploadBlock => {
  const seen = new Set<string>();
  let cur: string | undefined = slug;
  while (cur && !seen.has(cur) && seen.size < 6) {
    seen.add(cur);
    const ep = read(cur);
    if (!ep) break;
    if (ep.theme && blocked.includes(ep.theme)) return { blocked: true, theme: ep.theme, via: cur };
    cur = ep.parent;
  }
  return { blocked: false };
};

/** The episode slug of a file under <root>/out/<slug>/ or <root>/public/episodes/<slug>/, else null. */
export const slugFromPath = (absPath: string, root: string): string | null => {
  const rel = relative(root, absPath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  const parts = rel.split(sep);
  if (parts[0] === "out" && parts.length >= 3) return parts[1];
  if (parts[0] === "public" && parts[1] === "episodes" && parts.length >= 4) return parts[2];
  return null;
};

/** uploadBlocked with config.yaml's list. */
export const checkUpload = (slug: string): UploadBlock => uploadBlocked(slug, loadConfig().upload.blocked_themes);

/** One sentence for the refusal messages. */
export const blockMessage = (slug: string, b: UploadBlock) =>
  `${slug} ${b.via && b.via !== slug ? `comes from ${b.via}, which is` : "is"} in the ${b.theme} theme: those videos go to another channel (config.yaml upload.blocked_themes), and Claude never uploads them`;
