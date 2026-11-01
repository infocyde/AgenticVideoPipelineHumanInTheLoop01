// Scaffold YouTube Shorts for an episode. Each Short is a small episode of its own (its own script, voiceover,
// timing and episode.json) with format "short" and aspect 9:16, so every command works on it: voice/align, assets,
// check, preview, render, credits.
//   episodes/<parent>-short<N>/          episode.json (theme, brand, music, sources from the parent), voiceover.txt,
//                                        article.md (the parent's, for the fact rule), notes.md
//   public/episodes/<parent>-short<N>/   clips/ images/ sfx/ music/ hard-linked from the parent (no extra disk space),
//                                        credits.json copied from the parent
// Usage: npm run short -- <parent-slug> [--count N] [--only N] [--long [--scenes N] [--theme id]]
//   --count N  how many Shorts (1-3; default: config.yaml shorts.count, or 1 with --long)
//   --only N   scaffold just Short N (e.g. to add a third later)
//   --long     long Shorts (1-2.5 min, "long": true; config.yaml shorts.long): --scenes chapters each (2-10, default
//              shorts.long.scenes), music at shorts.long.musicLevel, voice sped up by shorts.long.voiceSpeed. They keep
//              the parent's theme unless --theme is given (e.g. --theme dispatch).
// Existing Short folders are left alone. Re-link media after adding files to the parent: delete the Short's
// public folder's media dirs and run again, or hard-link the new files by hand.
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { estimateTiming } from "../src/kit/lib/timing.ts";
import type { EpisodeInput } from "../src/kit/schema.ts";
import { scanAssets } from "./lib/assets.ts";
import { templateShort } from "./lib/template.ts";
import { loadConfig } from "./lib/config.ts";
import { isMusicVideoSlug } from "./lib/musicVideo.ts";
import { THEME_IDS } from "../src/kit/themes/ids.ts";
import { fail, info, ok, parseArgs, paths, readJson, requireSlug, warn } from "./lib/util.ts";
import { sync } from "./sync.ts";

const usage = "npm run short -- <parent-slug> [--count N] [--only N] [--long [--scenes N] [--theme id]]";
const parent = requireSlug(usage);
if (isMusicVideoSlug(parent)) fail(`${parent} is a music video: Shorts from music videos aren't supported.`);
const { flags } = parseArgs();
const cfg = loadConfig().shorts;
const pp = paths(parent);
const pe = readJson<EpisodeInput>(pp.episode);
if (pe.format === "short") fail(`${parent} is itself a Short; give the main episode's slug.`);
if (!cfg.enabled) info("shorts are off in config.yaml (shorts.enabled: false); scaffolding anyway because you asked for them.");

const long = !!flags.long;
const scenes = flags.scenes ? Number(flags.scenes) : cfg.long.scenes;
if (long && (!Number.isInteger(scenes) || scenes < 2 || scenes > 10)) fail("--scenes must be a whole number from 2 to 10 (chapters in the long Short)");
const theme = typeof flags.theme === "string" ? flags.theme : pe.theme;
if (theme && !(THEME_IDS as readonly string[]).includes(theme)) fail(`unknown theme "${theme}". Available: ${THEME_IDS.join(", ")}`);
const count = flags.count ? Number(flags.count) : long ? 1 : cfg.count;
if (!Number.isInteger(count) || count < 1 || count > 3) fail("--count must be 1, 2 or 3");
const only = flags.only ? Number(flags.only) : null;
if (only !== null && (!Number.isInteger(only) || only < 1 || only > 3)) fail("--only must be 1, 2 or 3");
const which = only ? [only] : Array.from({ length: count }, (_, i) => i + 1);

// A first visual for the placeholder, so the preview isn't blank: the parent's first clip, else its first image.
const firstMedia = (dir: string) =>
  existsSync(join(pp.pub, dir)) ? readdirSync(join(pp.pub, dir)).filter((f) => /\.(mp4|mov|webm|mkv|png|jpe?g|webp)$/i.test(f)).sort()[0] : undefined;
const firstVisual = (firstMedia("clips") ?? firstMedia("images"))?.replace(/\.[^.]+$/, "");

/** Hard-link every file of a media dir from the parent (copy if linking isn't possible, e.g. across drives). */
const linkDir = (dir: string, dest: string) => {
  const from = join(pp.pub, dir);
  if (!existsSync(from)) return 0;
  mkdirSync(join(dest, dir), { recursive: true });
  let n = 0;
  for (const f of readdirSync(from, { withFileTypes: true })) {
    if (!f.isFile()) continue;
    const to = join(dest, dir, f.name);
    if (existsSync(to)) continue;
    try {
      linkSync(join(from, f.name), to);
    } catch {
      copyFileSync(join(from, f.name), to);
    }
    n++;
  }
  return n;
};

const made: string[] = [];
for (const n of which) {
  const slug = `${parent}-short${n}`;
  const p = paths(slug);
  if (existsSync(p.src)) {
    warn(`episodes/${slug}/ already exists; left alone.`);
    continue;
  }
  const { episode, script } = templateShort({
    slug,
    theme: theme ?? "threat-brief",
    parent,
    title: `${pe.title} (Short ${n})`,
    carry: { theme: theme as EpisodeInput["theme"], brand: pe.brand, audio: pe.audio, sources: pe.sources },
    visual: firstVisual,
    ...(long ? { scenes, long: { musicLevel: cfg.long.musicLevel, voiceSpeed: cfg.long.voiceSpeed } } : {}),
  });
  mkdirSync(p.src, { recursive: true });
  mkdirSync(p.pub, { recursive: true });
  writeFileSync(p.episode, JSON.stringify(episode, null, 2) + "\n");
  writeFileSync(p.script, script + "\n");
  if (existsSync(pp.article)) copyFileSync(pp.article, p.article);
  writeFileSync(
    join(p.src, "notes.md"),
    `# ${slug}: producer notes\n\n- ${long ? "Long " : ""}YouTube Short ${n} of [${parent}](../${parent}/). Vertical 9:16, ${long ? `${cfg.long.minSeconds}-${cfg.long.maxSeconds} s at ${cfg.long.voiceSpeed}x voice speed (new-episode skill, 8b)` : `aim for ${cfg.maxSeconds} s or less`}.\n` +
      `- Facts come only from the parent's article (copied here as article.md) and its fact-check in ../${parent}/notes.md.\n` +
      `- Media is hard-linked from public/episodes/${parent}/; credits.json is the parent's.\n`,
  );
  const linked = ["clips", "images", "sfx", "music"].reduce((a, d) => a + linkDir(d, p.pub), 0);
  if (existsSync(pp.credits)) copyFileSync(pp.credits, p.credits);
  else writeFileSync(p.credits, "[]\n");
  writeFileSync(p.timing, JSON.stringify(estimateTiming(script), null, 1) + "\n");
  scanAssets(slug);
  made.push(slug);
  ok(`episodes/${slug}/ (${long ? `long Short, ${scenes} chapters, ` : ""}${linked} media files linked from ${parent})`);
}
if (!made.length) process.exit(0);
sync();

console.log(`
Next, for each Short (see the new-episode skill, "Shorts"${long ? ', and 8b "Long Shorts"' : ""}):
  1. Write episodes/<short>/voiceover.txt: ${long ? `a ${cfg.long.minSeconds}-${cfg.long.maxSeconds} s script (about ${Math.round(cfg.long.minSeconds * 2.6 * cfg.long.voiceSpeed)}-${Math.round(cfg.long.maxSeconds * 2.6 * cfg.long.voiceSpeed)} words at ${cfg.long.voiceSpeed}x) from the parent's facts (hook, title, chapters, CTA)` : `a ${cfg.maxSeconds} s-or-less script from the parent's facts (hook, one idea, CTA)`}.
  2. Fill its episode.json (hook stamp, title, 1-2 scenes with stats and visuals, outro + CTA).
  3. Voice it (npm run voice -- <short>, or record public/episodes/<short>/voiceover.mp3), then npm run align -- <short>.
  4. npm run check -- <short>, preview, then npm run render -- <short> (also copied to out/${parent}/).`);
