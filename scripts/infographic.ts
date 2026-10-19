// Render an HTML infographic (bar comparison, big number, timeline…) to b-roll in the episode's theme.
// Source: episodes/<slug>/infographics/<name>.html, written by the producer (start from .claude/skills/infographic/template.html).
// Output: public/episodes/<slug>/clips/<name>.mp4 (animated, default) or images/<name>.png (--still); credits.json + assets.json updated.
//
// Usage: npm run infographic -- <slug> <name> [--seconds 12] [--fps 30] [--still] [--at <ms>] [--theme <id>] [--force]
//   --seconds <s>   clip length (default 12). Animate in the first few seconds, then hold: the kit slows a clip that is
//                   shorter than its slot (down to half speed) and then loops it, which replays the animation.
//   --still         one PNG of the finished state (or of the moment given by --at <ms>)
//   --theme <id>    use another theme's tokens (default: the episode's theme)
//   --open          only build the page and print its path, to look at it in a browser (no render, no credit)
//
// The page gets the theme as CSS variables (--bg, --text, --accent, --highlight, --font-display…; see the skill) and the
// theme's Google fonts. Time is driven by the renderer: CSS animations / transitions and the Web Animations API are
// paused and seeked frame by frame, and a page may define window.bkSeek(ms) to draw anything else (counters, SVG paths).
// Don't use requestAnimationFrame, setTimeout or Date for motion; they are not frame-accurate here.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Credit, OWN_LICENSE } from "../src/kit/schema.ts";
import { themes } from "../src/kit/themes/index.ts";
import type { Theme } from "../src/kit/themes/types.ts";
import { IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { launchBrowser, newContext } from "./lib/browser.ts";
import { fail, info, ok, parseArgs, paths, readJson, requireSlug, warn } from "./lib/util.ts";

const usage = "npm run infographic -- <slug> <name> [--seconds 12] [--fps 30] [--still] [--theme <id>] [--force]";
const slug = requireSlug(usage);
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const num = (k: string, d: number) => {
  const v = str(k);
  if (v === undefined) return d;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) fail(`--${k} must be a number ≥ 0`);
  return n;
};

const name = positional[1];
if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the infographic a name (lowercase letters, digits, _ or -), e.g. range_bars.\n  usage: ${usage}`);
const p = paths(slug);
const srcDir = join(p.src, "infographics");
const src = join(srcDir, `${name}.html`);
if (!existsSync(src)) fail(`No ${src.replace(/\\/g, "/")}. Copy .claude/skills/infographic/template.html there and edit it.`);

const episode = readJson<{ theme?: string; brand?: { name?: string } }>(p.episode);
const themeId = str("theme") ?? episode.theme ?? "threat-brief";
const theme: Theme | undefined = (themes as Record<string, Theme>)[themeId];
if (!theme) fail(`unknown theme "${themeId}". Available: ${Object.keys(themes).join(", ")}`);
const still = !!flags.still;
const fps = num("fps", 30);
const seconds = num("seconds", 12);
if (!still && (seconds < 1 || fps < 1)) fail("--seconds and --fps must be at least 1");

const outFile = still ? join(p.pub, "images", `${name}.png`) : join(p.pub, "clips", `${name}.mp4`);
const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === name);
if (taken.length && !flags.force && !flags.open) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);

// --- theme -> CSS variables + font stylesheet ---
const require = createRequire(import.meta.url);
const fontHref = (family: string) => {
  try {
    const info = require(`@remotion/google-fonts/${family.replace(/[^A-Za-z0-9]/g, "")}`).getInfo() as { fonts: Record<string, Record<string, unknown>> };
    const weights = Object.keys(info.fonts.normal ?? {}).sort((a, b) => +a - +b);
    return `family=${encodeURIComponent(family).replace(/%20/g, "+")}${weights.length ? `:wght@${weights.join(";")}` : ""}`;
  } catch {
    return `family=${encodeURIComponent(family).replace(/%20/g, "+")}`;
  }
};
const families = [...new Set([theme!.fonts.display, theme!.fonts.mono, theme!.fonts.body])];
const fontsUrl = `https://fonts.googleapis.com/css2?${families.map(fontHref).join("&")}&display=block`;
const q = (f: string) => `'${f.replace(/'/g, "")}'`;
const c = theme!.colors;
const m = theme!.map;
const vars: Record<string, string> = {
  bg: c.bg, panel: c.panel, line: c.line, text: c.text, dim: c.dim, accent: c.accent, "accent-deep": c.accentDeep,
  highlight: c.highlight, "on-accent": c.onAccent, hostile: m.hostileStroke, ally: m.highlightStroke, land: m.land,
  "font-display": `${q(theme!.fonts.display)}, sans-serif`, "font-mono": `${q(theme!.fonts.mono)}, monospace`, "font-body": `${q(theme!.fonts.body)}, sans-serif`,
  "text-shadow": theme!.effects.textShadow, "accent-glow": theme!.effects.accentGlow(40),
};
const head = [
  `<base href="${pathToFileURL(srcDir).href}/">`,
  `<link rel="stylesheet" href="${fontsUrl}">`,
  `<style id="bk-theme">`,
  `:root { ${Object.entries(vars).map(([k, v]) => `--${k}: ${v};`).join(" ")} }`,
  `html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--bg); color: var(--text); font-family: var(--font-body); }`,
  `*, *::before, *::after { box-sizing: border-box; }`,
  `</style>`,
  `<script>window.BK = ${JSON.stringify({ theme: themeId, brand: episode.brand?.name ?? "", seconds: still ? 0 : seconds, fps })};</script>`,
].join("\n");
const html = readFileSync(src, "utf8");
const built = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => `${h}\n${head}\n`) : `${head}\n${html}`;
const workDir = join(p.out, "infographics");
mkdirSync(workDir, { recursive: true });
const builtFile = join(workDir, `${name}.built.html`);
writeFileSync(builtFile, built);
if (flags.open) {
  ok(`built ${builtFile.replace(/\\/g, "/")}: open it in a browser to look at it (animations run in real time there).`);
  process.exit(0);
}

// --- render ---
info(`rendering "${name}" in ${themeId} (${still ? "still" : `${seconds}s @ ${fps}fps`})…`);
const browser = await launchBrowser();
const framesDir = join(workDir, `${name}-frames`);
let title = "";
let sourcesMeta = "";
try {
  const ctx = await newContext(browser, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("requestfailed", (r) => problems.push(`failed to load ${r.url()}`));
  await page.goto(pathToFileURL(builtFile).href, { waitUntil: "load", timeout: 45_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
  });
  ({ title, sourcesMeta } = await page.evaluate(() => ({
    title: document.title.trim(),
    sourcesMeta: document.querySelector('meta[name="sources"]')?.getAttribute("content")?.trim() ?? "",
  })));
  // A family counts as loaded if any of its faces is (the page may use only some weights).
  const missing = await page.evaluate(
    (fams) => {
      const loaded = new Set<string>();
      document.fonts.forEach((face) => {
        if (face.status === "loaded") loaded.add(face.family.replace(/["']/g, ""));
      });
      return fams.filter((f) => !loaded.has(f));
    },
    families,
  );
  if (missing.length) warn(`font(s) not loaded: ${missing.join(", ")} (offline?). The render falls back to system fonts.`);
  problems.forEach((msg) => warn(`page: ${msg}`));

  // Seek every animation (and the page's own bkSeek) to `ms`; returns when the longest finite animation ends.
  const seek = (ms: number) =>
    page.evaluate((t) => {
      let end = 0;
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = t;
        const e = Number(a.effect?.getComputedTiming().endTime ?? 0);
        if (Number.isFinite(e)) end = Math.max(end, e);
      }
      (window as unknown as { bkSeek?: (ms: number) => void }).bkSeek?.(t);
      return end;
    }, ms);

  const animEnd = await seek(0);
  if (still) {
    const at = str("at") !== undefined ? num("at", 0) : Math.max(animEnd, 1) + 50;
    await seek(at);
    mkdirSync(dirname(outFile), { recursive: true });
    await page.screenshot({ path: outFile, type: "png" });
  } else {
    if (animEnd / 1000 > seconds - 3) warn(`the animation runs ${(animEnd / 1000).toFixed(1)}s of a ${seconds}s clip; leave a hold of several seconds at the end (raise --seconds or speed it up).`);
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });
    const total = Math.round(seconds * fps);
    for (let i = 0; i < total; i++) {
      await seek((i * 1000) / fps);
      await page.screenshot({ path: join(framesDir, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 95 });
      if (i % fps === 0) process.stdout.write(`\r  frame ${i}/${total}`);
    }
    process.stdout.write(`\r  frame ${total}/${total}\n`);
    mkdirSync(dirname(outFile), { recursive: true });
    execFileSync("ffmpeg", [
      "-v", "error", "-y", "-framerate", String(fps), "-i", join(framesDir, "f%05d.jpg"),
      "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outFile,
    ]);
    rmSync(framesDir, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}

// --- credit: made for the channel from the episode's own (fact-checked) figures ---
const file = still ? `images/${name}.png` : `clips/${name}.mp4`;
const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
if (!sourcesMeta) warn('no <meta name="sources" content="…"> in the page; say where the figures come from (it goes into the credit notes).');
const entry: Credit = {
  file,
  title: `Infographic: ${title || name}`,
  author: episode.brand?.name ? `${episode.brand.name} (infographic)` : "Own work (infographic)",
  license: OWN_LICENSE,
  notes: `Made for this episode with npm run infographic from episodes/${slug}/infographics/${name}.html.${sourcesMeta ? ` Data: ${sourcesMeta}.` : ""}`,
};
const replaced = new Set([`images/${name}.png`, `clips/${name}.mp4`]);
writeFileSync(p.credits, JSON.stringify([...credits.filter((x) => !replaced.has(x.file)), entry], null, 2) + "\n");
// A re-render in the other mode replaces the earlier file of the same name.
const other = still ? join(p.pub, "clips", `${name}.mp4`) : join(p.pub, "images", `${name}.png`);
if (existsSync(other)) rmSync(other);
scanAssets(slug);

ok(`public/episodes/${slug}/${file}`);
console.log(`
Next:
  • LOOK at it${still ? "" : " (open the MP4 or scrub it in the preview)"}: every number must match the script and the fact-check log.
  • Use it as a visual: { "name": "${name}" }. Keep key content inside the safe area; the kit zooms b-roll up to 1.18×,
    grades it with the theme, and in split layouts shows it at about half size.`);
