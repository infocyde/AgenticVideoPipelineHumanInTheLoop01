// Illustrated explainers: one self-contained HTML page per piece (canvas + synthesized sound), in a named style.
// Source: explainers/<name>/<name>.html (standalone) or episodes/<slug>/infographics/<name>.html (--episode, for b-roll).
// See .claude/skills/explainer/SKILL.md.
//
// Usage:
//   npm run explainer -- styles                                   list styles and their variants
//   npm run explainer -- new <name> [--style <id>] [--variant <v>] [--episode <slug>] [--title "..."] [--force]
//   npm run explainer -- storyboard <name> [--episode <slug>]     <out>/<name>.storyboard.html (to publish) + storyboard.png (to look at)
//   npm run explainer -- frames <name> --at 1,4.5,9 [--episode <slug>]   PNG frames at those times + timing/determinism check
//   npm run explainer -- render <name> [--episode <slug>] [--fps 30] [--scale 1.5] [--no-sound] [--voiceover]
//                                                                 <out>/<name>.mp4 with the score mixed in
// <out> is out/explainers/<name>/ (standalone) or out/<slug>/explainers/<name>/ (--episode).
// For silent episode b-roll use the existing renderer on the same page: npm run infographic -- <slug> <name> --seconds <s>.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "playwright-core";
import { launchBrowser, newContext } from "./lib/browser.ts";
import { fail, info, ok, parseArgs, paths, readJson, ROOT, SLUG_RE, warn } from "./lib/util.ts";

const SKILL = join(ROOT, ".claude", "skills", "explainer");
const STYLES = join(SKILL, "styles");
const usage = "npm run explainer -- <styles|new|storyboard|frames|render> <name> [--episode <slug>] …";
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const num = (k: string, d: number) => {
  const v = str(k);
  if (v === undefined) return d;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) fail(`--${k} must be a number > 0`);
  return n;
};
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

type Variant = { fontsHref: string; fontSpecs: string[]; vars: Record<string, unknown> };
type Style = { name: string; family: string; default: string; variants: Record<string, Variant> };
const styleIds = () => readdirSync(STYLES, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(STYLES, d.name, "style.json"))).map((d) => d.name);
const readStyle = (id: string) => readJson<Style>(join(STYLES, id, "style.json"));

const cmd = positional[0];
if (cmd === "styles") {
  for (const id of styleIds()) {
    const s = readStyle(id);
    console.log(`  ${id.padEnd(16)} ${s.name} (${s.family})  variants: ${Object.keys(s.variants).join(", ")} [default ${s.default}]`);
  }
  process.exit(0);
}
if (!["new", "storyboard", "frames", "render"].includes(cmd ?? "")) fail(`Unknown command "${cmd ?? ""}".\n  usage: ${usage}`);
const name = positional[1];
if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the explainer a name (lowercase letters, digits, _ or -).\n  usage: ${usage}`);
const slug = str("episode");
if (slug !== undefined && (!SLUG_RE.test(slug) || !existsSync(paths(slug).episode))) fail(`No episode "${slug}" (episodes/${slug}/episode.json).`);
const src = slug ? join(paths(slug).src, "infographics", `${name}.html`) : join(ROOT, "explainers", name, `${name}.html`);
const outDir = slug ? join(paths(slug).out, "explainers", name) : join(ROOT, "out", "explainers", name);

// ---------------------------------------------------------------------------------------------------- new
if (cmd === "new") {
  if (existsSync(src) && !flags.force) fail(`${rel(src)} already exists. Pick another name, or pass --force to start it over.`);
  const theme = slug ? readJson<{ theme?: string }>(paths(slug).episode).theme : undefined;
  let styleId = str("style");
  if (!styleId && theme) styleId = styleIds().find((id) => theme in readStyle(id).variants);
  if (!styleId) fail(`Pick a style with --style <id>. Available: ${styleIds().join(", ")} (npm run explainer -- styles)`);
  if (!styleIds().includes(styleId!)) fail(`Unknown style "${styleId}". Available: ${styleIds().join(", ")}`);
  const style = readStyle(styleId!);
  const variantId = str("variant") ?? (theme && theme in style.variants ? theme : style.default);
  const variant = style.variants[variantId];
  if (!variant) fail(`Style ${styleId} has no variant "${variantId}". Variants: ${Object.keys(style.variants).join(", ")}`);
  const title = str("title") ?? name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const fill: Record<string, string> = {
    __TITLE__: title.replace(/[<&]/g, ""),
    __FONTS_HREF__: variant.fontsHref.replace(/&/g, "&amp;"),
    __HARNESS__: readFileSync(join(SKILL, "lib", "harness.js"), "utf8").trimEnd(),
    __SOUND__: readFileSync(join(SKILL, "lib", "sound.js"), "utf8").trimEnd(),
    __STYLE_ID__: `${styleId}${variantId === "default" ? "" : `/${variantId}`}`,
    __VARIANT__: JSON.stringify(variant.vars),
    __FONT_SPECS__: JSON.stringify(variant.fontSpecs),
    __STYLE__: readFileSync(join(STYLES, styleId!, "style.js"), "utf8").trimEnd(),
  };
  // One pass, so text inserted for one placeholder is never scanned for another.
  const html = readFileSync(join(SKILL, "template.html"), "utf8").replace(new RegExp(Object.keys(fill).join("|"), "g"), (k) => fill[k]);
  mkdirSync(join(src, ".."), { recursive: true });
  writeFileSync(src, html);
  ok(`${rel(src)}  (${style.name}, ${variantId})`);
  console.log(`
Next:
  • Fill BEATS / ASSUMPTIONS / SOURCES and draw each beat's key frame in explainer() (style helpers are already in the page).
  • npm run explainer -- storyboard ${name}${slug ? ` --episode ${slug}` : ""}   then publish the .storyboard.html and wait for approval.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------- page commands
if (!existsSync(src)) fail(`No ${rel(src)}. Start it with: npm run explainer -- new ${name}${slug ? ` --episode ${slug}` : ""} --style <id>`);
const html = readFileSync(src, "utf8");
lint(html);
mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser();
try {
  if (cmd === "storyboard") await storyboard();
  else if (cmd === "frames") await frames();
  else await render();
} finally {
  await browser.close();
}

function lint(page: string) {
  const at = page.indexOf("// ===== PLAYER");
  if (at < 0) warn("no PLAYER block marker found; was the page made with `npm run explainer -- new`?");
  // Only the style helpers and the EXPLAINER block (the libraries and the header comment are fixed text).
  const drawing = at < 0 ? page : page.slice(Math.max(0, page.indexOf("===== STYLE:")), at);
  const bad = ["Math.random", "Date.now", "new Date", "performance.now", "setTimeout", "setInterval", "requestAnimationFrame"].filter((s) => drawing.includes(s));
  if (bad.length) warn(`${bad.join(", ")} used above the PLAYER block. Frames must be a pure function of t: use H.rng(seed) / H.makeNoise(seed) and t.`);
  const ex = page.slice(page.indexOf("// ===== EXPLAINER"), page.indexOf("// ===== END EXPLAINER"));
  const small = [...ex.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 28);
  if (small.length) warn(`font size(s) under 28px in the EXPLAINER block (${[...new Set(small)].join(", ")}px). Labels the story depends on need >= 28px, headlines >= 44px, key numbers >= 64px.`);
  if (!/<meta name="sources" content="[^"]+"/.test(page)) warn('<meta name="sources"> is empty: say where the facts come from (it becomes the credit note for episode b-roll).');
}

async function openPage(query: string, viewport: { width: number; height: number }, view?: "storyboard"): Promise<Page> {
  const ctx = await newContext(browser, { viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  let file = src;
  if (view) {
    file = join(outDir, `${name}.storyboard.html`);
    writeFileSync(file, html.replace(/<html\b/i, '<html data-view="storyboard"'));
  }
  await page.goto(pathToFileURL(file).href + query, { waitUntil: "load", timeout: 60_000 });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 60_000 }).catch(() => problems.push("page never became ready (window.ready did not resolve)"));
  if (problems.length) fail(`the page has errors:\n  ${problems.join("\n  ")}`);
  const beats = await page.evaluate(() => {
    const w = window as unknown as { DURATION?: number; EXPLAINER?: { beats: Array<{ t0: number; t1: number; key?: number }> } };
    return { D: w.DURATION ?? 0, beats: w.EXPLAINER?.beats ?? [] };
  });
  beats.beats.forEach((b, i) => {
    if (b.t1 > beats.D + 1e-6) warn(`beat ${i + 1} ends at ${b.t1}s, after DURATION (${beats.D}s)`);
    if (b.key !== undefined && (b.key < b.t0 || b.key > b.t1)) warn(`beat ${i + 1}: key ${b.key}s is outside ${b.t0}–${b.t1}s`);
  });
  return page;
}

async function storyboard() {
  const page = await openPage("", { width: 1400, height: 900 }, "storyboard");
  const png = join(outDir, "storyboard.png");
  await page.screenshot({ path: png, fullPage: true });
  ok(`${rel(join(outDir, `${name}.storyboard.html`))}  (publish this as the storyboard artifact)`);
  ok(`${rel(png)}  (Read it to check the panels before you publish)`);
}

async function frames() {
  const times = (str("at") ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0);
  if (!times.length) fail("Give times in seconds: --at 1,4.5,9");
  const page = await openPage("?render=1&scale=1", { width: 1280, height: 720 });
  const shot = async (t: number) => {
    const ms = await page.evaluate((x) => { (window as unknown as { seek: (t: number) => void }).seek(x); return (window as unknown as { lastFrameMs: number }).lastFrameMs; }, t);
    return { ms, buf: await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1280, height: 720 } }) };
  };
  const hash = (b: Buffer) => createHash("sha1").update(b).digest("hex");
  let worst = 0;
  for (const t of times) {
    const { ms, buf } = await shot(t);
    worst = Math.max(worst, ms);
    const f = join(outDir, `frame-${t.toFixed(2).replace(".", "_")}s.png`);
    writeFileSync(f, buf);
    ok(`${rel(f)}  (${ms.toFixed(0)} ms)`);
  }
  // Determinism: the same t after another t must give the same pixels.
  const a = hash((await shot(times[0])).buf);
  await shot(times[times.length - 1] + 0.37);
  const b = hash((await shot(times[0])).buf);
  if (a !== b) warn(`frame at ${times[0]}s changed between two draws: something depends on draw order or uses unseeded randomness (cache keys, Math.random, state kept across frames).`);
  else info("deterministic: same t gives the same pixels");
  if (worst > 100) warn(`slowest frame ${worst.toFixed(0)} ms (aim for well under 100 ms at 1280x720).`);
}

async function render() {
  const fps = num("fps", 30), scale = num("scale", 1.5), withSound = !flags["no-sound"];
  const W = Math.round(1280 * scale), Hh = Math.round(720 * scale);
  const page = await openPage(`?render=1&scale=${scale}`, { width: W, height: Hh });
  const D = await page.evaluate(() => (window as unknown as { DURATION: number }).DURATION);
  const out = join(outDir, `${name}.mp4`), wav = join(outDir, `${name}.wav`);

  if (withSound) {
    info("rendering the score…");
    const r = await page.evaluate(async (vo) => {
      const w = window as unknown as { SOUND: { renderOffline: (f: unknown, d: number, sr: number, o: unknown) => Promise<{ inter: Float32Array; peak: number }> }; scoreSound: unknown; DURATION: number };
      const sr = 48000, res = await w.SOUND.renderOffline(w.scoreSound, w.DURATION, sr, { voiceover: vo });
      const n = res.inter.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const tag = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      tag(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); tag(8, "WAVE"); tag(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); tag(36, "data"); v.setUint32(40, n * 2, true);
      let clipped = 0;
      for (let i = 0; i < n; i++) { let s = res.inter[i]; if (s > 1 || s < -1) clipped++; s = Math.max(-1, Math.min(1, s)); v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true); }
      const u8 = new Uint8Array(buf); let bin = "";
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return { b64: btoa(bin), peak: res.peak, clipped };
    }, !!flags.voiceover);
    writeFileSync(wav, Buffer.from(r.b64, "base64"));
    info(`score peak ${(20 * Math.log10(Math.max(r.peak, 1e-6))).toFixed(1)} dBFS`);
    if (r.clipped) warn(`${r.clipped} samples clipped: lower gains in scoreSound.`);
    else if (r.peak < 0.1) warn("the score is very quiet (peak under -20 dBFS).");
  }

  info(`rendering ${D}s @ ${fps}fps, ${W}x${Hh}…`);
  const ff = spawn("ffmpeg", [
    "-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    ...(withSound ? ["-i", wav, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k"] : []),
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise<number>((res) => ff.on("close", (c) => res(c ?? 1)));
  const total = Math.round(D * fps);
  let sum = 0, worst = 0;
  for (let i = 0; i < total; i++) {
    const ms = await page.evaluate((x) => { (window as unknown as { seek: (t: number) => void }).seek(x); return (window as unknown as { lastFrameMs: number }).lastFrameMs; }, i / fps);
    sum += ms; worst = Math.max(worst, ms);
    const buf = await page.screenshot({ type: "jpeg", quality: 94, clip: { x: 0, y: 0, width: W, height: Hh } });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % fps === 0) process.stdout.write(`\r  frame ${i}/${total}`);
  }
  process.stdout.write(`\r  frame ${total}/${total}\n`);
  ff.stdin.end();
  if ((await done) !== 0) fail("ffmpeg failed");
  info(`draw time: avg ${(sum / Math.max(1, total)).toFixed(0)} ms, worst ${worst.toFixed(0)} ms per frame at ${W}x${Hh}`);
  ok(rel(out));
}
