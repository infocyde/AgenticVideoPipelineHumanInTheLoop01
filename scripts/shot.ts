// Screenshot part of a web page as a b-roll still (an article paragraph, a chart, a data table, an official notice).
// Saves public/episodes/<slug>/images/<name>.png (1920×1080), records provenance in credits.json, refreshes assets.json.
//
// Usage: npm run shot -- <slug> <name> --url <url> --license <PD|CC0|CC BY|CC BY-SA|OWN WORK> [--author "..."] [options]
//   --selector "<css>"     capture one element (e.g. "table.wikitable", "#history"), first match; --pad <px> around it (default 12)
//   --clip x,y,w,h         capture a region of the page in CSS px instead (page coordinates, from the top-left)
//   --full                 capture the whole page (usually too tall to read; prefer --selector)
//   --scroll-to "<css>"    scroll an element to the top of the view before a plain viewport capture
//   --highlight "a|b"      mark phrase(s) with a highlighter before capturing (case-insensitive, within one text run)
//   --highlight-color <c>  CSS color for the marker (default rgba(255,214,0,0.75))
//   --hide "<css>,<css>"   hide extra elements (ads, sticky headers); cookie/consent banners are hidden by default
//   --keep-banners         don't hide cookie/consent banners
//   --width 1440 --height 810   viewport in CSS px (default 1440×810; narrower = bigger text on screen)
//   --scale 2              device pixel ratio (default 2, for crisp text)
//   --dark                 ask the page for its dark color scheme
//   --wait <ms>            extra settle time after load (default 1500)
//   --fit card|cover|raw   card (default): the shot centered on a blurred copy of itself, 1920×1080;
//                          cover: crop to fill 1920×1080 from the top; raw: keep the capture's own size
//   --title "..."          credit title (default: "Screenshot: <page title>")
//   --license-version 4.0  e.g. for CC BY / CC BY-SA
//   --force                replace an existing visual with the same name
//
// Licensing: the page itself must be PD, CC0, CC BY or CC BY-SA (or your own), same as any other media (CLAUDE.md
// rule 3). Wikipedia text is CC BY-SA 4.0 and is filled in automatically; photos and logos on a page carry their own
// licenses, so crop them out or check them. No screenshots of commercial news sites under "fair use".
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { type Credit, LICENSES, OWN_LICENSE } from "../src/kit/schema.ts";
import { IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { launchBrowser, newContext } from "./lib/browser.ts";
import { fail, info, ok, parseArgs, paths, requireSlug, warn } from "./lib/util.ts";

const usage = 'npm run shot -- <slug> <name> --url <url> --license "CC BY-SA" --author "..." [--selector "<css>"] [--highlight "phrase"] [--fit card]';
const slug = requireSlug(usage);
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const num = (k: string, d: number) => {
  const v = str(k);
  if (v === undefined) return d;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) fail(`--${k} must be a positive number`);
  return n;
};

const name = positional[1];
if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the visual a name (lowercase letters, digits, _ or -), e.g. wiki_casualties.\n  usage: ${usage}`);
const url = str("url");
if (!url || !/^https?:\/\//.test(url)) fail(`--url is required (http or https).\n  usage: ${usage}`);
const host = new URL(url!).hostname.replace(/^www\./, "");

// --- license gate (before touching the network) ---
const ALLOWED = [...LICENSES, OWN_LICENSE] as string[];
const isWikipedia = /(^|\.)wikipedia\.org$/.test(host);
let license = str("license");
let licenseVersion = str("license-version");
let author = str("author");
if (!license && isWikipedia) {
  license = "CC BY-SA";
  licenseVersion ??= "4.0";
  author ??= "Wikipedia contributors";
  info("Wikipedia page: text credited as CC BY-SA 4.0, Wikipedia contributors. Images on the page have their own licenses; crop them out or check them.");
}
if (!license) {
  const hint = /\.(gov|mil)$/.test(host)
    ? ` US federal works are usually PD, but state, local and contractor content may not be; check the site's copyright notice, then pass --license PD --author "<agency>".`
    : " Check the site's license or copyright notice. Commercial news sites are not allowed.";
  fail(`--license is required (${ALLOWED.join(", ")}).${hint}`);
}
if (!ALLOWED.includes(license!)) fail(`License "${license}" is not allowed. Use one of ${ALLOWED.join(", ")} (CLAUDE.md rule 3).`);
if (!author && (license === "CC BY" || license === "CC BY-SA")) fail(`${license} needs attribution: pass --author "<who made the page>".`);
if (!author) author = license === OWN_LICENSE ? "Own work" : host;

const fit = str("fit") ?? "card";
if (!["card", "cover", "raw"].includes(fit)) fail("--fit must be card, cover or raw");
const modes = [str("selector"), str("clip"), flags.full ? "full" : undefined].filter(Boolean);
if (modes.length > 1) fail("Use only one of --selector, --clip and --full.");

const p = paths(slug);
const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === name);
if (taken.length && !flags.force) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);

const CONSENT = [
  "#onetrust-banner-sdk", "#onetrust-consent-sdk", ".fc-consent-root", "#CybotCookiebotDialog", ".qc-cmp2-container", "#usercentrics-root",
  "#sp_message_container", '[id^="sp_message"]', ".truste_box_overlay", "#truste-consent-track",
  '[id*="cookie-banner" i]', '[class*="cookie-banner" i]', '[id*="cookie-consent" i]', '[class*="cookie-consent" i]',
  '[id*="consent-banner" i]', '[class*="consent-banner" i]', '[aria-label*="cookie" i][role="dialog"]',
];

const width = num("width", 1440);
const height = num("height", 810);
const scale = num("scale", 2);
const wait = num("wait", 1500);

info(`opening ${url} (${width}×${height} @${scale}x)…`);
const browser = await launchBrowser();
let raw: Buffer;
let pageTitle = "";
try {
  const ctx = await newContext(browser, {
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: flags.dark ? "dark" : "light",
    locale: "en-US",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  });
  const page: Page = await ctx.newPage();
  const res = await page.goto(url!, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (res && res.status() >= 400) fail(`${url} answered ${res.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  pageTitle = (await page.title()).trim();

  // Hide banners and anything the caller lists; undo scroll locks consent dialogs leave behind.
  const hide = [...(flags["keep-banners"] ? [] : CONSENT), ...(str("hide")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])];
  if (hide.length) {
    const css = `${hide.map((s) => `${s}:not(html):not(body)`).join(",\n")} { display: none !important; }\nhtml { overflow: auto !important; } body { overflow: visible !important; }`;
    await page.addStyleTag({ content: css }).catch(() => warn("couldn't inject the hide stylesheet (page CSP?)"));
  }

  // Lazy-loaded images: walk down the page once for full-page captures.
  if (flags.full) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
  }

  const phrases = str("highlight")?.split("|").map((s) => s.trim()).filter(Boolean) ?? [];
  if (phrases.length) {
    const color = str("highlight-color") ?? "rgba(255,214,0,0.75)";
    const counts = await page.evaluate(
      ({ phrases, color }) => {
        const counts: number[] = [];
        for (const phrase of phrases) {
          let n = 0;
          const needle = phrase.toLowerCase();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (t) => (t.parentElement && !["SCRIPT", "STYLE", "NOSCRIPT", "MARK"].includes(t.parentElement.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
          });
          const hits: Text[] = [];
          for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) if (t.data.toLowerCase().includes(needle)) hits.push(t);
          for (let t of hits) {
            let i: number;
            while ((i = t.data.toLowerCase().indexOf(needle)) >= 0) {
              const match = t.splitText(i);
              const rest = match.splitText(phrase.length);
              const mark = document.createElement("mark");
              mark.style.cssText = `background:${color};color:inherit;padding:0 .12em;border-radius:.15em;box-decoration-break:clone;-webkit-box-decoration-break:clone`;
              mark.textContent = match.data;
              match.replaceWith(mark);
              n++;
              t = rest;
            }
          }
          counts.push(n);
        }
        return counts;
      },
      { phrases, color },
    );
    phrases.forEach((ph, i) => (counts[i] ? info(`highlighted "${ph}" ×${counts[i]}`) : warn(`"${ph}" not found as one text run on the page; nothing highlighted`)));
  }

  await page.waitForTimeout(wait);

  const selector = str("selector");
  const clip = str("clip");
  const scrollTo = str("scroll-to");
  if (selector) {
    const el = page.locator(selector).first();
    if (!(await el.count())) fail(`no element matches --selector "${selector}"`);
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (!box) fail(`"${selector}" isn't visible on the page`);
    const pad = str("pad") === "0" ? 0 : num("pad", 12);
    const { sx, sy, pw, ph } = await page.evaluate(() => ({
      sx: scrollX,
      sy: scrollY,
      pw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      ph: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    }));
    const x = Math.max(0, box!.x + sx - pad);
    const y = Math.max(0, box!.y + sy - pad);
    raw = await page.screenshot({ fullPage: true, clip: { x, y, width: Math.min(pw - x, box!.width + pad * 2), height: Math.min(ph - y, box!.height + pad * 2) } });
  } else if (clip) {
    const [x, y, w, h] = clip.split(",").map(Number);
    if (![x, y, w, h].every((v) => Number.isFinite(v)) || w <= 0 || h <= 0) fail("--clip must be x,y,w,h in CSS px, e.g. 0,300,1440,700");
    raw = await page.screenshot({ fullPage: true, clip: { x, y, width: w, height: h } });
  } else if (flags.full) {
    raw = await page.screenshot({ fullPage: true });
  } else {
    if (scrollTo) {
      const el = page.locator(scrollTo).first();
      if (!(await el.count())) fail(`no element matches --scroll-to "${scrollTo}"`);
      await el.evaluate((e) => e.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(300);
    }
    raw = await page.screenshot();
  }
} finally {
  await browser.close();
}

// Keep the untouched capture next to the renders (out/ is not committed), then make the still.
const rawDir = join(p.out, "screenshots");
mkdirSync(rawDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const rawFile = join(rawDir, `${name}-${stamp}.png`);
writeFileSync(rawFile, raw!);

const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", rawFile], { encoding: "utf8" });
const [rw, rh] = probe.trim().split(",").map(Number);
const FW = 1650; // card: the shot fits inside 86% of the frame
const FH = 930;
if (fit === "card") {
  const up = Math.min(FW / rw, FH / rh);
  if (up > 1.6) warn(`the capture (${rw}×${rh}) is small and gets enlarged ${up.toFixed(1)}×; try --scale 3 or a narrower --width for sharper text.`);
  if (rh / rw > 1.4) warn(`the capture is tall (${rw}×${rh}) and will be small on screen; capture a smaller part with --selector or --clip.`);
}

mkdirSync(join(p.pub, "images"), { recursive: true });
const out = join(p.pub, "images", `${name}.png`);
const vf =
  fit === "card"
    ? `[0:v]split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=28:2,eq=brightness=-0.22:saturation=0.75[bg];` +
      `[b]scale=${FW}:${FH}:force_original_aspect_ratio=decrease:flags=lanczos,pad=iw+6:ih+6:3:3:color=0x101010[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`
    : fit === "cover"
      ? "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080:(iw-1920)/2:0"
      : "null";
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", rawFile, ...(fit === "card" ? ["-filter_complex", vf] : ["-vf", vf]), "-frames:v", "1", out]);

// Provenance in credits.json (replaces an earlier entry for the same file).
const file = `images/${name}.png`;
const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
const entry: Credit = {
  file,
  title: str("title") ?? `Screenshot: ${pageTitle || host}`,
  author: author!,
  license: license as Credit["license"],
  ...(licenseVersion ? { licenseVersion } : {}),
  ...(license === OWN_LICENSE ? {} : { sourceUrl: url! }),
  notes: `Screenshot of ${url} captured ${new Date().toISOString().slice(0, 10)}${str("highlight") ? `; highlighted: ${str("highlight")}` : ""}.`,
};
writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== file), entry], null, 2) + "\n");
scanAssets(slug);

ok(`public/episodes/${slug}/${file} (raw: out/${slug}/screenshots/${name}-${stamp}.png, ${rw}×${rh})`);
console.log(`
Next:
  • LOOK at the image: banners or ads left over, cut-off text, photos or logos that don't share the page's license.
    Re-shoot with --hide "<css>", a tighter --selector/--clip, or --force.
  • Use it as { "name": "${name}", "note": "SOURCE · ${host.toUpperCase()}" } (a note naming the site is recommended).`);
