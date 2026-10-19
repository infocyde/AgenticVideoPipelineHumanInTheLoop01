// Scaffold a new episode: episodes/<slug>/ (data) and public/episodes/<slug>/ (media), then sync.
// Usage: npm run new -- <slug> [--format countdown|list] [--count N] [--theme threat-brief|clean-light|after-dark|military|military-comparisons]
// Brand, theme and audio settings carry over from the most recent episode of the same format, if any.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { estimateTiming } from "../src/kit/lib/timing.ts";
import type { EpisodeInput } from "../src/kit/schema.ts";
import { THEME_IDS } from "../src/kit/themes/ids.ts";
import { scanAssets } from "./lib/assets.ts";
import { ARTICLE_PLACEHOLDER, NOTES_TEMPLATE, templateEpisode } from "./lib/template.ts";
import { fail, info, ok, parseArgs, paths, readJson, requireSlug, ROOT } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run new -- <slug> [--format countdown|list] [--count N] [--theme id]", false);
const { flags } = parseArgs();
const p = paths(slug);
if (existsSync(p.src)) fail(`episodes/${slug}/ already exists. Pick another slug or delete that folder first.`);

const format = (flags.format ?? "countdown") as "countdown" | "list";
if (!["countdown", "list"].includes(format)) fail(`--format must be "countdown" or "list", not "${format}"`);
const count = flags.count ? Number(flags.count) : format === "countdown" ? 10 : 5;
if (!Number.isInteger(count) || count < 1 || count > 20) fail("--count must be a whole number from 1 to 20");
const theme = (flags.theme ?? "threat-brief") as string;
if (!(THEME_IDS as readonly string[]).includes(theme)) fail(`unknown theme "${theme}". Available: ${THEME_IDS.join(", ")}`);

// Carry brand/theme/audio from the latest episode of the same format (slugs sort by date).
let carry: Partial<EpisodeInput> | undefined;
const epDir = join(ROOT, "episodes");
const previous = existsSync(epDir)
  ? readdirSync(epDir)
      .filter((s) => existsSync(paths(s).episode))
      .sort()
      .reverse()
  : [];
for (const prev of previous) {
  try {
    const e = readJson<EpisodeInput>(paths(prev).episode);
    if ((e.format ?? "countdown") === format) {
      carry = { brand: e.brand, theme: flags.theme ? (theme as EpisodeInput["theme"]) : e.theme, audio: e.audio };
      info(`carrying brand, theme and audio settings over from ${prev}`);
      break;
    }
  } catch {
    /* ignore unreadable episodes */
  }
}

const { episode, script } = templateEpisode({ slug, format, count, theme, carry });

mkdirSync(p.src, { recursive: true });
for (const d of ["clips", "images"]) mkdirSync(join(p.pub, d), { recursive: true });
writeFileSync(p.episode, JSON.stringify(episode, null, 2) + "\n");
writeFileSync(p.script, script + "\n");
writeFileSync(p.article, ARTICLE_PLACEHOLDER);
writeFileSync(join(p.src, "notes.md"), NOTES_TEMPLATE(slug));
writeFileSync(p.credits, "[]\n");
writeFileSync(p.timing, JSON.stringify(estimateTiming(script), null, 1) + "\n");
scanAssets(slug);
sync();

ok(`created episodes/${slug}/ and public/episodes/${slug}/ (${format}, ${count} segments, theme ${episode.theme})`);
console.log(`
Next:
  1. Save the source article to episodes/${slug}/article.md
  2. Write episodes/${slug}/voiceover.txt, then preview with estimated timing: npm run align -- ${slug} --estimate
  3. Record the voiceover to public/episodes/${slug}/voiceover.mp3, then: npm run align -- ${slug}
  4. Fill episodes/${slug}/episode.json, add media, then: npm run assets -- ${slug} && npm run check -- ${slug}
  5. npm run dev  (composition "${slug}" is in Studio now, with placeholder content)`);
