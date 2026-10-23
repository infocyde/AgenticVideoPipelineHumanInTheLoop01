// Free stock sites (Pixabay, Pexels, Coverr) as a footage source for MUSIC VIDEOS only, when config.yaml has
// licensing.stock_media: music-video (the stock-media skill). Raw downloads land in episodes/<slug>/raw/stock/,
// finished media in public/episodes/<slug>/clips|images/, credited STOCK with the site, id, license and date.
//
// Usage:
//   npm run stock -- <slug> search "<query>" [--site pixabay|pexels] [--type video|image] [--limit 12]
//       API search (PIXABAY_API_KEY / PEXELS_API_KEY in .env); without --site, every site with a key. Saved to
//       raw/stock/search-<n>.json. Each hit prints as <site>:<id>, with an AI? flag from the site or its tags.
//   npm run stock -- <slug> get <site>:<id> <name> [--type video|image] [--from <s>] [--to <s>] [--ai] [--force]
//       downloads one hit, cuts --from..--to (default the first 8 s, at most 15 s) to clips/<name>.mp4 (1920x1080,
//       30 fps, no audio) or images/<name>.jpg, credits it and refreshes assets.json. --ai marks it AI-generated
//       (the shot then needs an on-screen note).
//   npm run stock -- <slug> import <file> <name> --site pexels|coverr|pixabay --page <url> --author "<name>"
//       [--author-url <url>] [--id <id>] [--title "<…>"] [--from <s>] [--to <s>] [--ai] [--force]
//       for a file the user downloaded in the browser (Coverr, or Pexels while it issues no API keys): the same
//       encode and credit. The page must be the clip's own page on that site.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import type { Credit } from "../src/kit/schema.ts";
import { episodeVoiceover, IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { loadConfig } from "./lib/config.ts";
import { getSecret } from "./lib/env.ts";
import { apiRequest, isSite, type Kind, pexelsHits, pixabayHits, redactKey, SITES, type Site, stockCredit, type StockHit } from "./lib/stock.ts";
import { fail, fmtTime, info, ok, parseArgs, paths, requireSlug, ROOT, warn } from "./lib/util.ts";

const usage =
  'npm run stock -- <slug> search "<query>" [--site pixabay|pexels] [--type video|image] | get <site>:<id> <name> [--from s --to s] | import <file> <name> --site <site> --page <url> --author "<name>"';
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");
const today = () => new Date().toISOString().slice(0, 10);
const MAX_CLIP = 15;

const slug = requireSlug(usage);
const p = paths(slug);

// --- gate: config and episode format ---
const mode = loadConfig().licensing.stock_media;
if (mode === "off") fail("Stock media is off (config.yaml licensing.stock_media: off).");
const format = existsSync(p.episode) ? (JSON.parse(readFileSync(p.episode, "utf8")) as { format?: string }).format : undefined;
if (format !== "music-video") fail(`Stock media is only enabled for music videos; ${slug} is ${format ? `a "${format}" episode` : "not scaffolded yet"}.`);

const stockDir = join(p.src, "raw", "stock");
const kind: Kind = str("type") === "image" ? "image" : "video";
const cmd = positional[1];

if (cmd === "search") await search();
else if (cmd === "get") await get();
else if (cmd === "import") importFile();
else fail(`Give a subcommand: search, get or import.\n  usage: ${usage}`);

function apiKey(site: "pixabay" | "pexels") {
  return getSecret(SITES[site].keyEnv!)?.value;
}

async function callApi(site: "pixabay" | "pexels", q: { query?: string; id?: string; perPage?: number }): Promise<StockHit[]> {
  const key = apiKey(site);
  if (!key) fail(`${SITES[site].keyEnv} is not set (.env). ${site === "pexels" ? "Pexels paused new API keys; import browser downloads instead." : "Get a free key at https://pixabay.com/api/docs/ (log in)."}`);
  const req = apiRequest(site, kind, key!, q);
  let res: Response;
  try {
    res = await fetch(req.url, { headers: req.headers });
  } catch (e) {
    fail(`${SITES[site].name} request failed: ${(e as Error).message}`);
  }
  if (res!.status === 429) fail(`${SITES[site].name} rate limit reached; wait a minute (Pixabay allows 100 requests a minute, Pexels 200 an hour).`);
  if (!res!.ok) fail(`${SITES[site].name} answered HTTP ${res!.status} for ${redactKey(req.url)}`);
  const json = await res!.json();
  return site === "pixabay" ? pixabayHits(json, kind) : pexelsHits(json, kind);
}

async function search() {
  const query = positional[2]?.trim();
  if (!query) fail(`Give a search query.\n  usage: ${usage}`);
  const limit = str("limit") === undefined ? 12 : Number(str("limit"));
  if (!Number.isInteger(limit) || limit < 3 || limit > 80) fail("--limit must be a whole number from 3 to 80");
  const want = str("site");
  if (want && want !== "pixabay" && want !== "pexels") fail("--site for search is pixabay or pexels (Coverr has no free API: import its downloads)");
  const sites = (want ? [want] : ["pixabay", "pexels"].filter((s) => apiKey(s as "pixabay" | "pexels"))) as ("pixabay" | "pexels")[];
  if (!sites.length) fail("No stock API key in .env: set PIXABAY_API_KEY (free at https://pixabay.com/api/docs/).");

  const hits: StockHit[] = [];
  for (const s of sites) {
    info(`searching ${SITES[s].name} ${kind}s for "${query}"…`);
    hits.push(...(await callApi(s, { query, perPage: limit })));
  }
  mkdirSync(stockDir, { recursive: true });
  const used = readdirSync(stockDir).map((f) => Number(/^search-(\d+)\.json$/.exec(f)?.[1] ?? 0));
  const file = join(stockDir, `search-${Math.max(0, ...used) + 1}.json`);
  writeFileSync(file, JSON.stringify({ query, kind, sites, searched: new Date().toISOString(), hits }, null, 2) + "\n");
  if (!hits.length) {
    warn(`no results (saved ${rel(file)})`);
    return;
  }
  console.log("");
  hits.forEach((h, i) => {
    const size = `${h.width}x${h.height}`;
    console.log(`${String(i + 1).padStart(2)}. ${h.site}:${h.id}  ${h.duration ? fmtTime(h.duration) + "  " : ""}${size}  ${h.author}${h.ai ? "  AI?" : ""}`);
    console.log(`    ${h.title}`);
    console.log(`    ${h.pageUrl}`);
  });
  console.log("");
  ok(`${hits.length} result${hits.length === 1 ? "" : "s"} saved to ${rel(file)}`);
  console.log(`Next: npm run stock -- ${slug} get <site>:<id> <name> [--from s --to s]. Open the page first: reject watermarks, logos, brands and anything marked AI unless you pass --ai.`);
}

function checkName(name: string | undefined) {
  if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the shot a name (lowercase letters, digits, _ or -), e.g. storm_clouds.\n  usage: ${usage}`);
  const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === name);
  if (taken.length && !flags.force) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);
}

/** In/out for a video: --from/--to in seconds, default the first 8 s, at most 15 s, inside the clip. */
function range(duration: number | undefined): [number, number] {
  const from = str("from") === undefined ? 0 : Number(str("from"));
  const to = str("to") === undefined ? from + 8 : Number(str("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from) fail("--from and --to are seconds, with --to after --from");
  if (to - from > MAX_CLIP) fail(`a stock clip is at most ${MAX_CLIP} s (asked for ${(to - from).toFixed(1)} s)`);
  if (duration && from >= duration) fail(`--from ${from} is past the end of the clip (${duration} s)`);
  return [from, duration ? Math.min(to, duration) : to];
}

function encode(src: string, name: string, r?: [number, number]): string {
  const isVideo = kind === "video";
  const dir = join(p.pub, isVideo ? "clips" : "images");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.${isVideo ? "mp4" : "jpg"}`);
  const args = isVideo
    ? ["-v", "error", "-y", "-ss", String(r![0]), "-i", src, "-t", String(r![1] - r![0]), "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-an", "-movflags", "+faststart", out]
    : ["-v", "error", "-y", "-i", src, "-vf", "scale='min(1920,iw)':-2", "-q:v", "3", out];
  const ff = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (ff.status !== 0) fail(`ffmpeg failed:\n  ${(ff.stderr ?? "").trim().split(/\r?\n/).slice(-3).join("\n  ")}`);
  return out;
}

function saveCredit(credit: Credit, out: string) {
  const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
  writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== credit.file), credit], null, 2) + "\n");
  scanAssets(slug, episodeVoiceover(slug));
  ok(`public/episodes/${slug}/${credit.file}${credit.stock?.ai ? "  (AI-generated: the shot needs \"note\": \"AI-GENERATED FOOTAGE\")" : ""}`);
  console.log(`credit: ${JSON.stringify(credit, null, 2)}`);
  console.log(`
Next:
  • LOOK at frames of ${rel(out)}: reject watermarks, burned-in text, logos and brands you can't crop.
  • Keep raw/stock/ (the API record and the original file): it is the proof of license if YouTube Content ID claims the clip.`);
}

async function get() {
  const ref = positional[2] ?? "";
  const m = /^(pixabay|pexels):(\d+)$/.exec(ref);
  if (!m) fail(`Give the hit as <site>:<id>, e.g. pixabay:125 (from npm run stock -- ${slug} search).\n  usage: ${usage}`);
  const site = m![1] as "pixabay" | "pexels";
  const name = positional[3];
  checkName(name);
  info(`reading ${site}:${m![2]}…`);
  const [hit] = await callApi(site, { id: m![2] });
  if (!hit) fail(`${SITES[site].name} has no ${kind} ${m![2]}${kind === "video" ? " (an image? pass --type image)" : ""}`);
  if (flags.ai) hit.ai = true;
  const r = kind === "video" ? range(hit.duration) : undefined;

  const dir = join(stockDir, `${site}-${hit.id}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "record.json"), JSON.stringify({ ...hit, fileUrl: redactKey(hit.fileUrl), fetched: new Date().toISOString(), license: SITES[site].license, licenseUrl: SITES[site].licenseUrl }, null, 2) + "\n");
  info(`downloading ${hit.width}x${hit.height} ${kind} by ${hit.author}…`);
  const res = await fetch(hit.fileUrl);
  if (!res.ok) fail(`download answered HTTP ${res.status}`);
  const ext = kind === "video" ? ".mp4" : extname(new URL(hit.fileUrl).pathname) || ".jpg";
  const raw = join(dir, `original${ext}`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));

  const out = encode(raw, name!, r);
  saveCredit(stockCredit(hit, `${kind === "video" ? "clips" : "images"}/${basename(out)}`, today(), r), out);
}

function importFile() {
  const src = positional[2] ? resolve(positional[2]) : "";
  const name = positional[3];
  if (!src || !existsSync(src)) fail(`Give the downloaded file's path.\n  usage: ${usage}`);
  checkName(name);
  const site = str("site") ?? "";
  if (!isSite(site)) fail("--site is pixabay, pexels or coverr");
  const page = str("page");
  const author = str("author");
  if (!page || !/^https:\/\//.test(page)) fail("--page is the clip's own page URL on the site (https://…)");
  const host = new URL(page!).hostname.replace(/^www\./, "");
  if (!host.endsWith(`${site}.com`) && !host.endsWith(`${site}.co`)) fail(`--page must be on ${SITES[site as Site].name}'s site (got ${host})`);
  if (!author) fail('--author is the uploader as the page credits them (e.g. "Jane Doe")');
  // Pexels and Pixabay pages end in "-<number>/"; Coverr's in a slug, which is its id.
  const last = new URL(page!).pathname.split("/").filter(Boolean).pop() ?? "";
  const id = str("id") ?? (/-(\d+)$/.exec(last)?.[1] || last || basename(src, extname(src)));
  const hit = {
    site: site as Site,
    id,
    kind,
    pageUrl: page!,
    title: str("title") ?? (basename(src, extname(src)).replace(/[-_]+/g, " ").trim() || `${SITES[site as Site].name} ${kind} ${id}`),
    author: author!,
    authorUrl: str("author-url"),
    ai: !!flags.ai,
  };
  const dur = kind === "video" ? Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], { encoding: "utf8" }).stdout.trim()) || undefined : undefined;
  const r = kind === "video" ? range(dur) : undefined;
  const dir = join(stockDir, `${site}-${id}`);
  mkdirSync(dir, { recursive: true });
  const raw = join(dir, `original${extname(src) || (kind === "video" ? ".mp4" : ".jpg")}`);
  copyFileSync(src, raw);
  writeFileSync(join(dir, "record.json"), JSON.stringify({ ...hit, imported: rel(src), fetched: new Date().toISOString(), license: SITES[site as Site].license, licenseUrl: SITES[site as Site].licenseUrl }, null, 2) + "\n");
  const out = encode(raw, name!, r);
  saveCredit(stockCredit(hit, `${kind === "video" ? "clips" : "images"}/${basename(out)}`, today(), r), out);
}
