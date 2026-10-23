// YouTube as a research source and, for Creative Commons videos, a clip source. No API key: everything goes
// through yt-dlp in .venv (npm run setup:align installs it), with Node as its JavaScript runtime.
// Raw material lands in episodes/<slug>/raw/youtube/, finished clips in public/episodes/<slug>/clips/.
//
// Usage:
//   npm run youtube -- <slug> search "<query>" [--limit 10] [--cc]
//       a table of hits (id, title, channel, date, duration, views, URL); --cc keeps only Creative Commons videos.
//       Saved to raw/youtube/search-<n>.json.
//   npm run youtube -- <slug> transcript <id|url> [--words 300]
//       metadata and English captions (manual first, then auto); saves raw/youtube/<id>/info.json and transcript.txt
//       ([mm:ss] per paragraph), prints a header and only the first N words. Read transcript.txt for the rest.
//   npm run youtube -- <slug> clip <id|url> <name> --from <t> --to <t> [--license PD --basis "<…>"] [--force]
//       cuts <from>–<to> (83, 1:23 or 1:02:03; at most 15 s) to public/episodes/<slug>/clips/<name>.mp4
//       (1920×1080, 30 fps, no audio), credits it and refreshes assets.json. The kit draws the channel tag.
//   npm run youtube -- --update     upgrade yt-dlp in .venv (try this first when YouTube extraction breaks)
//   --ignore-off   run while config.yaml has youtube.search_youtube: false (a one-off you asked for)
//
// Licensing: a clip needs YouTube's Creative Commons license (CC BY 3.0), which is checked before any video is
// downloaded. A standard-license video is refused, except a verified US federal agency channel's own footage, which
// is public domain: pass --license PD --basis "NASA, US federal work". Never a YouTube clip as the thumbnail.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Credit } from "../src/kit/schema.ts";
import { episodeVoiceover, IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { loadConfig } from "./lib/config.ts";
import {
  classifyLicense,
  clipCredit,
  firstWords,
  formatTranscript,
  isBlocked,
  parseJson3,
  parseTimestamp,
  pickCaptions,
  searchHits,
  validateRange,
  videoId,
  type VideoInfo,
} from "./lib/youtube.ts";
import { fail, fmtTime, info, ok, parseArgs, paths, requireSlug, ROOT, run, venvPython, warn } from "./lib/util.ts";

const usage = 'npm run youtube -- <slug> search "<query>" [--limit 10] [--cc] | transcript <id|url> [--words 300] | clip <id|url> <name> --from <t> --to <t>';
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");
const BLOCKED = "YouTube is blocking requests from this machine; try later or `npm run youtube -- --update`";

const py = venvPython();
const needVenv = () => {
  if (!existsSync(py)) fail("Run npm run setup:align (installs yt-dlp into .venv)");
};

if (flags.update) {
  needVenv();
  info("upgrading yt-dlp in .venv");
  if (run(py, ["-m", "pip", "install", "--disable-pip-version-check", "-q", "-U", "yt-dlp[default]"]) !== 0) fail("pip install failed (see output above).");
  const v = spawnSync(py, ["-m", "yt_dlp", "--version"], { encoding: "utf8" }).stdout.trim();
  ok(`yt-dlp ${v}`);
  process.exit(0);
}

if (!loadConfig().youtube.search_youtube && !flags["ignore-off"]) {
  fail("YouTube is off (config.yaml: youtube.search_youtube: false). Set it to true, or pass --ignore-off for a one-off.");
}

/** Run yt-dlp politely (1 s between requests, Node for YouTube's JavaScript); stops on a block, never retries. */
function ytdlp(args: string[]): { status: number; stdout: string; stderr: string } {
  needVenv();
  const r = spawnSync(py, ["-m", "yt_dlp", "--js-runtimes", "node", "--sleep-requests", "1", "--no-warnings", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  const stderr = r.stderr ?? "";
  if (/No module named yt_dlp/.test(stderr)) fail("Run npm run setup:align (installs yt-dlp into .venv)");
  if (isBlocked(stderr)) fail(BLOCKED);
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr };
}

/** Pause between separate requests to YouTube (yt-dlp's --sleep-requests only spaces those inside one run). */
const pause = (ms = 1000) => new Promise((r) => setTimeout(r, ms));

const lastLines = (s: string) => s.trim().split(/\r?\n/).slice(-3).join("\n  ");

/** Full metadata for one video (no download). */
function videoInfo(id: string): VideoInfo {
  const r = ytdlp(["-J", "--skip-download", `https://www.youtube.com/watch?v=${id}`]);
  if (r.status !== 0) fail(`yt-dlp couldn't read ${id}:\n  ${lastLines(r.stderr)}`);
  return JSON.parse(r.stdout) as VideoInfo;
}

const isoDate = (d?: string) => (d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : "?");
const licenseText = (v: VideoInfo) => v.license || "Standard YouTube License";

const slug = requireSlug(usage);
const p = paths(slug);
const ytDir = join(p.src, "raw", "youtube");
const cmd = positional[1];

if (cmd === "search") search();
else if (cmd === "transcript") await transcript();
else if (cmd === "clip") await clip();
else fail(`Give a subcommand: search, transcript or clip.\n  usage: ${usage}`);

function needId(arg: string | undefined): string {
  const id = arg ? videoId(arg) : null;
  if (!id) fail(`Give a YouTube video id or URL (got ${arg ? `"${arg}"` : "nothing"}).\n  usage: ${usage}`);
  return id!;
}

function search() {
  const query = positional[2]?.trim();
  if (!query) fail(`Give a search query.\n  usage: ${usage}`);
  const limit = str("limit") === undefined ? 10 : Number(str("limit"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) fail("--limit must be a whole number from 1 to 50");
  const cc = !!flags.cc;
  // YouTube's own Creative Commons filter (sp=EgIwAQ==). The results page has no natural end, so cap it.
  const target = cc ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query!)}&sp=EgIwAQ%253D%253D` : `ytsearch${limit}:${query}`;
  info(`searching YouTube${cc ? " (Creative Commons only)" : ""} for "${query}"…`);
  const r = ytdlp(["--flat-playlist", "--playlist-end", String(limit), "-J", target]);
  if (r.status !== 0) fail(`yt-dlp search failed:\n  ${lastLines(r.stderr)}`);
  const hits = searchHits(JSON.parse(r.stdout)).slice(0, limit);

  mkdirSync(ytDir, { recursive: true });
  const used = readdirSync(ytDir).map((f) => Number(/^search-(\d+)\.json$/.exec(f)?.[1] ?? 0));
  const file = join(ytDir, `search-${Math.max(0, ...used) + 1}.json`);
  writeFileSync(file, JSON.stringify({ query, cc, searched: new Date().toISOString(), hits }, null, 2) + "\n");

  if (!hits.length) {
    warn(`no results (saved ${rel(file)})`);
    return;
  }
  console.log("");
  hits.forEach((h, i) => {
    const views = h.views === undefined ? "" : `${h.views.toLocaleString("en-US")} views`;
    console.log(`${String(i + 1).padStart(2)}. ${h.title}`);
    console.log(`    ${h.id}  ${h.channel || "?"}  ${[h.uploadDate, h.duration ? fmtTime(h.duration) : "", views].filter(Boolean).join("  ")}`);
    console.log(`    ${h.url}`);
  });
  console.log("");
  ok(`${hits.length} result${hits.length === 1 ? "" : "s"} saved to ${rel(file)}`);
  console.log(`Next: npm run youtube -- ${slug} transcript <id> (license, captions and a 300-word preview).${cc ? " Each video's license is checked again by clip." : ""}`);
}

async function transcript() {
  const id = needId(positional[2]);
  const n = str("words") === undefined ? 300 : Number(str("words"));
  if (!Number.isInteger(n) || n < 1) fail("--words must be a positive whole number");
  info(`reading ${id}…`);
  const v = videoInfo(id);
  const caps = pickCaptions(v);
  const dir = join(ytDir, id);
  mkdirSync(dir, { recursive: true });
  const kind = !caps ? "none" : caps.from ? `auto, machine-translated from ${caps.from}` : caps.kind;
  const meta = {
    id: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.title,
    channel: v.channel ?? v.uploader ?? "",
    channel_url: v.channel_url ?? "",
    upload_date: isoDate(v.upload_date),
    duration: v.duration ?? 0,
    view_count: v.view_count,
    license: licenseText(v),
    captions: caps ? { lang: caps.lang, kind } : null,
    description: v.description ?? "",
  };
  writeFileSync(join(dir, "info.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log("");
  console.log(`${v.title}`);
  console.log(`  channel:  ${meta.channel || "?"}${meta.channel_url ? `  (${meta.channel_url})` : ""}`);
  console.log(`  uploaded: ${meta.upload_date}   duration: ${fmtTime(meta.duration)}`);
  console.log(`  license:  ${meta.license}${classifyLicense(v) === "cc-by" ? "  -> CC BY 3.0, clips allowed" : "  -> not reusable as a clip"}`);
  console.log(`  captions: ${caps ? `${kind} (${caps.lang})` : "none"}`);
  console.log(`  url:      ${meta.url}`);
  if (!caps) fail(`no English captions for ${id} (info saved to ${rel(join(dir, "info.json"))})`);

  let raw: unknown;
  await pause();
  try {
    const res = await fetch(caps!.url);
    if (res.status === 429) fail(BLOCKED);
    if (!res.ok) fail(`caption download answered HTTP ${res.status}`);
    raw = await res.json();
  } catch (e) {
    fail(`caption download failed: ${(e as Error).message}`);
  }
  const text = formatTranscript(parseJson3(raw, caps!.kind));
  if (!text) fail(`the ${kind} captions for ${id} are empty`);
  const file = join(dir, "transcript.txt");
  writeFileSync(file, text + "\n");
  const total = firstWords(text, Number.MAX_SAFE_INTEGER).split(" ").length;
  console.log(`\n--- first ${Math.min(n, total)} of ${total} words ---\n${firstWords(text, n)}\n---\n`);
  ok(`${rel(file)} (full transcript with [mm:ss] timestamps; read it when the preview is useful)`);
  if (caps!.from) warn(`machine-translated captions (from ${caps!.from}): confirm any number, name, date or quote from them before scripting it.`);
  else if (kind !== "manual") warn("auto-generated captions: confirm any number, name or date from them before scripting it.");
}

async function clip() {
  const id = needId(positional[2]);
  const name = positional[3];
  if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the clip a name (lowercase letters, digits, _ or -), e.g. artemis_launch.\n  usage: ${usage}`);
  let from = 0;
  let to = 0;
  try {
    if (!str("from") || !str("to")) throw new Error("--from and --to are required (e.g. --from 1:23 --to 1:29)");
    from = parseTimestamp(str("from")!);
    to = parseTimestamp(str("to")!);
  } catch (e) {
    fail((e as Error).message);
  }
  const lic = str("license");
  const basis = str("basis");
  if (lic && lic !== "PD") fail(`--license only takes PD (a CC BY license is read from YouTube itself).`);

  const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === name);
  if (taken.length && !flags.force) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);

  // --- license gate and range check, before any video is downloaded ---
  info(`reading ${id}…`);
  const v = videoInfo(id);
  const duration = Number(v.duration) || 0;
  if (!duration) fail(`${id} has no fixed duration (a live stream?); clips need a finished video.`);
  const bad = validateRange(from, to, duration);
  if (bad) fail(bad);
  let credit: Credit;
  if (classifyLicense(v) === "cc-by") {
    if (lic) warn(`YouTube lists this video as ${v.license}; it is credited CC BY, not PD.`);
    credit = clipCredit(v, name, from, to, { license: "CC BY" });
  } else {
    if (lic !== "PD" || !basis) {
      fail(`"${v.title}" (${v.channel ?? v.uploader ?? "?"}) has the standard YouTube license: not reusable; PD only for a verified US federal channel's own footage, with --basis`);
    }
    credit = clipCredit(v, name, from, to, { license: "PD", basis: basis! });
  }
  if (!credit.author.trim()) fail(`yt-dlp reported no channel name for ${id}; the credit and on-screen tag need one.`);

  // --- download only the section (1 s margin each side), video only ---
  const dir = join(ytDir, id);
  mkdirSync(dir, { recursive: true });
  const s0 = Math.max(0, from - 1);
  const s1 = Math.min(duration, to + 1);
  info(`downloading ${fmtTime(s0)}–${fmtTime(s1)} of "${v.title}"…`);
  await pause();
  const dl = ytdlp([
    "--download-sections", `*${s0}-${s1}`,
    "-f", "bv*[height<=1080][ext=mp4]/bv*[height<=1080]/bv*",
    "-o", join(dir, `section-${s0}-${s1}.%(ext)s`),
    "--force-overwrites",
    "--print", "after_move:filepath",
    "--no-simulate",
    `https://www.youtube.com/watch?v=${id}`,
  ]);
  const section = dl.stdout.trim().split(/\r?\n/).pop()?.trim() ?? "";
  if (dl.status !== 0 || !section || !existsSync(section)) fail(`download failed:\n  ${lastLines(dl.stderr)}`);

  // --- encode to the kit's clip spec, trimmed to exactly from–to ---
  mkdirSync(join(p.pub, "clips"), { recursive: true });
  const out = join(p.pub, "clips", `${name}.mp4`);
  const ff = spawnSync(
    "ffmpeg",
    [
      "-v", "error", "-y",
      "-ss", String(from - s0), "-i", section, "-t", String(to - from),
      "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-an", "-movflags", "+faststart",
      out,
    ],
    { encoding: "utf8" },
  );
  if (ff.status !== 0) fail(`ffmpeg failed:\n  ${lastLines(ff.stderr ?? "")}`);

  // --- credit (replaces an earlier entry for the same file) and assets.json ---
  const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
  writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== credit.file), credit], null, 2) + "\n");
  scanAssets(slug, episodeVoiceover(slug));

  ok(`public/episodes/${slug}/${credit.file} (${to - from}s; raw section: ${rel(section)})`);
  console.log(`credit: ${JSON.stringify(credit, null, 2)}`);
  console.log(`
Next:
  • LOOK at a few frames: reject burned-in text, logos or third-party watermarks you can't crop.
  • The kit tags it on screen as "VIDEO · ${credit.author} / YouTube". It can't be the thumbnail.`);
}
