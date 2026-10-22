// Scaffold a new episode: episodes/<slug>/ (data) and public/episodes/<slug>/ (media), then sync.
// Usage: npm run new -- <slug> [--format countdown|list|short] [--count N] [--theme threat-brief|clean-light|after-dark|military|military-comparisons|erotic|frontier]
//        npm run new -- <slug> --format music-video --song <path> [--title "…"] [--subtitle "…"] [--artist "…"] [--theme id]
//   --format short: a standalone YouTube Short (vertical 9:16, its own article and facts); --count = scenes (1-3, default 1).
//   --format music-video: a song cut to licensed shots (music-video skill). The song is copied in as song.<ext>; the title
//     comes from the file name ("Artist - Title (Mix).wav") unless given; the artist carries over from the last music video.
//   For Shorts cut from an existing episode, use npm run short -- <episode> instead.
// Brand, theme and audio settings carry over from the most recent episode of the same format, if any.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { estimateTiming } from "../src/kit/lib/timing.ts";
import { type EpisodeInput, isMusicVideo, type MusicVideoInput } from "../src/kit/schema.ts";
import { THEME_IDS } from "../src/kit/themes/ids.ts";
import { scanAssets } from "./lib/assets.ts";
import { songFileName, titleFromFile } from "./lib/musicVideo.ts";
import { ARTICLE_PLACEHOLDER, dateLabelFromSlug, MUSIC_VIDEO_NOTES_TEMPLATE, NOTES_TEMPLATE, templateEpisode, templateMusicVideo, templateShort } from "./lib/template.ts";
import { fail, info, ok, parseArgs, paths, readJson, requireSlug, ROOT } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run new -- <slug> [--format countdown|list|short] [--count N] [--theme id]", false);
const { flags } = parseArgs();
const p = paths(slug);
if (existsSync(p.src)) fail(`episodes/${slug}/ already exists. Pick another slug or delete that folder first.`);

const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const epDir = join(ROOT, "episodes");
/** Episode slugs, newest first (slugs sort by date). */
const previousSlugs = () =>
  existsSync(epDir)
    ? readdirSync(epDir)
        .filter((s) => existsSync(paths(s).episode))
        .sort()
        .reverse()
    : [];

if (flags.format === "music-video") {
  const song = str("song");
  if (!song) fail('a music video needs its song: npm run new -- <slug> --format music-video --song "path/to/song.wav"');
  if (!existsSync(song!)) fail(`no file at ${song}`);
  const theme = str("theme") ?? "threat-brief";
  if (!(THEME_IDS as readonly string[]).includes(theme)) fail(`unknown theme "${theme}". Available: ${THEME_IDS.join(", ")}`);
  let artist = str("artist");
  for (const prev of previousSlugs()) {
    if (artist) break;
    try {
      const e = readJson<unknown>(paths(prev).episode);
      if (isMusicVideo(e)) artist = (e as MusicVideoInput).song.artist;
    } catch {
      /* ignore unreadable episodes */
    }
  }
  artist ??= "Paranormal Threat Reduction Agency";
  const fromName = titleFromFile(song!);
  const title = str("title") ?? fromName.title;
  const subtitle = str("subtitle") ?? (str("title") ? undefined : fromName.subtitle);
  const songFile = songFileName(song!);

  mkdirSync(p.src, { recursive: true });
  for (const d of ["clips", "images"]) mkdirSync(join(p.pub, d), { recursive: true });
  copyFileSync(song!, join(p.pub, songFile));
  const { episode, lyrics } = templateMusicVideo({ slug, title, subtitle, artist, songFile, theme });
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(p.pub, songFile)]).toString().trim());
  writeFileSync(p.episode, JSON.stringify(episode, null, 2) + "\n");
  writeFileSync(p.lyrics, lyrics);
  writeFileSync(join(p.src, "notes.md"), MUSIC_VIDEO_NOTES_TEMPLATE(slug));
  writeFileSync(p.credits, JSON.stringify([{ file: songFile, title: subtitle ? `${title} (${subtitle})` : title, author: artist, license: "OWN WORK" }], null, 2) + "\n");
  writeFileSync(p.timing, JSON.stringify({ duration: +duration.toFixed(3), estimated: true, words: [] }, null, 1) + "\n");
  scanAssets(slug, songFile);
  sync();
  ok(`created episodes/${slug}/ and public/episodes/${slug}/ (music video "${episode.title}" by ${artist}, ${duration.toFixed(1)}s, theme ${theme})`);
  console.log(`
Next (the music-video skill has the full procedure):
  1. Paste the lyric sheet into episodes/${slug}/lyrics.txt (or leave it empty for a transcribed draft)
  2. npm run lyrics -- ${slug}
  3. Plan the shots, fill episodes/${slug}/episode.json, add media, then: npm run assets -- ${slug} && npm run check -- ${slug}`);
  process.exit(0);
}

const format = (flags.format ?? "countdown") as "countdown" | "list" | "short";
if (!["countdown", "list", "short"].includes(format)) fail(`--format must be "countdown", "list", "short" or "music-video", not "${format}"`);
const count = flags.count ? Number(flags.count) : format === "countdown" ? 10 : format === "list" ? 5 : 1;
const maxCount = format === "short" ? 3 : 20;
if (!Number.isInteger(count) || count < 1 || count > maxCount) fail(`--count must be a whole number from 1 to ${maxCount}${format === "short" ? " (scenes in the Short)" : ""}`);
const theme = (flags.theme ?? "threat-brief") as string;
if (!(THEME_IDS as readonly string[]).includes(theme)) fail(`unknown theme "${theme}". Available: ${THEME_IDS.join(", ")}`);

// Carry brand/theme/audio from the latest episode of the same format (slugs sort by date); a Short falls back to the
// latest episode of any format, so it looks like the channel.
let carry: Partial<EpisodeInput> | undefined;
const previous = previousSlugs();
for (const pass of format === "short" ? ["same", "any"] : ["same"]) {
  for (const prev of previous) {
    if (carry) break;
    try {
      const e = readJson<EpisodeInput>(paths(prev).episode);
      if (isMusicVideo(e)) continue; // no brand or narration settings to carry
      if (pass === "any" || (e.format ?? "countdown") === format) {
        carry = { brand: e.brand, theme: flags.theme ? (theme as EpisodeInput["theme"]) : e.theme, audio: e.audio };
        info(`carrying brand, theme and audio settings over from ${prev}`);
      }
    } catch {
      /* ignore unreadable episodes */
    }
  }
}

const { episode, script } =
  format === "short"
    ? templateShort({ slug, theme, scenes: count, carry: carry && { ...carry, brand: carry.brand && { ...carry.brand, dateLabel: dateLabelFromSlug(slug) } } })
    : templateEpisode({ slug, format, count, theme, carry });

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

ok(`created episodes/${slug}/ and public/episodes/${slug}/ (${format === "short" ? `standalone Short, 9:16, ${count} scene${count > 1 ? "s" : ""}` : `${format}, ${count} segments`}, theme ${episode.theme})`);
console.log(`
Next:
  1. Save the source article to episodes/${slug}/article.md
  2. Write episodes/${slug}/voiceover.txt, then preview with estimated timing: npm run align -- ${slug} --estimate
  3. Voice it: npm run voice -- ${slug}  (local TTS, if config.yaml has voice.enabled: true)
     or record public/episodes/${slug}/voiceover.mp3 yourself, then: npm run align -- ${slug}
  4. Fill episodes/${slug}/episode.json, add media, then: npm run assets -- ${slug} && npm run check -- ${slug}
  5. npm run dev  (composition "${slug}" is in Studio now, with placeholder content)`);
