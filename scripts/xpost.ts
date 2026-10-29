// A post on X as a source: archive it with the episode, and optionally make an on-screen still of it.
// Only while config.yaml has x_posts.enabled: true. No login: it reads X's public embed data and screenshots X's own
// embed of the post in the kit's headless Chrome.
//
// Usage: npm run xpost -- <slug> <post url> --basis "<why this account counts>" [--still <name>] [--light] [--no-media] [--force]
//   --basis "..."    required: who the account is and why it counts, e.g. "NVIDIA's official account" or
//                    "Andrej Karpathy, OpenAI co-founder, well known in AI research"
//   --still <name>   also write public/episodes/<slug>/images/<name>.png (1920×1080 card), credited X POST
//   --light          X's light theme (default dark)
//   --no-media       hide the post's photo or video (when it isn't the poster's own)
//   --force          replace an existing still with the same name
//
// Proof, always: episodes/<slug>/raw/xpost/<id>/post.json (the post's text, author, date, badge, basis) and post.png.
// Prints the line for episode.json `sources` and one for notes.md. Rules: CLAUDE.md rules 2 and 3.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Credit } from "../src/kit/schema.ts";
import { IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { launchBrowser, newContext } from "./lib/browser.ts";
import { loadConfig } from "./lib/config.ts";
import { CARD_H, CARD_W, imageSize, writeCard } from "./lib/still.ts";
import { embedUrl, parsePost, type Post, postId, sourceEntry, syndicationUrl, xpostCredit } from "./lib/xpost.ts";
import { fail, info, ok, parseArgs, paths, requireSlug, ROOT, warn } from "./lib/util.ts";

const usage = 'npm run xpost -- <slug> <post url> --basis "<why this account counts>" [--still <name>] [--light] [--no-media]';
const slug = requireSlug(usage);
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

if (!loadConfig().x_posts.enabled) {
  fail("Posts on X are off (config.yaml x_posts.enabled: false): they're leads only. Find an article that reports it, or turn the option on.");
}
const id = postId(positional[1] ?? "");
if (!id) fail(`Give the post's URL (https://x.com/<handle>/status/<id>).\n  usage: ${usage}`);
const basis = str("basis");
if (!basis) fail(`--basis is required: who the account is and why it counts as a source (official for the subject, or well known in the field).\n  usage: ${usage}`);
const still = str("still");
if (flags.still !== undefined && (!still || !/^[a-z0-9_-]+$/.test(still))) fail("--still needs a name (lowercase letters, digits, _ or -), e.g. nvidia_post");

const p = paths(slug);
if (still) {
  const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === still);
  if (taken.length && !flags.force) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);
}

// --- the post, from X's public embed data ---
info(`fetching post ${id}…`);
const res = await fetch(syndicationUrl(id!), { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" } });
const body = res.ok ? await res.text() : "";
let post: Post;
try {
  post = parsePost(body ? JSON.parse(body) : null);
} catch (e) {
  fail(`${(e as Error).message} (HTTP ${res.status})`);
}
const captured = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
const dir = join(p.src, "raw", "xpost", id!);
mkdirSync(dir, { recursive: true });

// --- the screenshot: X's own embed of the post ---
info(`screenshotting X's embed of @${post!.handle}'s post…`);
const shot = join(dir, "post.png");
const browser = await launchBrowser();
try {
  const ctx = await newContext(browser, { viewport: { width: 700, height: 1400 }, deviceScaleFactor: 2, colorScheme: flags.light ? "light" : "dark", locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(embedUrl(id!, !!flags.light), { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("article", { timeout: 20_000 }).catch(() => fail("X's embed didn't draw the post (it may be deleted or restricted, or X is blocking requests); try again later"));
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  if (flags["no-media"]) {
    // Hide each media block: the outermost wrapper of the photo or video that doesn't also hold the post's text.
    const hidden = await page.evaluate(() => {
      const text = document.querySelector('[data-testid="tweetText"]');
      let n = 0;
      document.querySelectorAll('[data-testid="tweetPhoto"], [data-testid="videoComponent"], [data-testid="card.wrapper"]').forEach((m) => {
        let el = m as HTMLElement;
        while (el.parentElement && el.parentElement.tagName !== "ARTICLE" && !(text && el.parentElement.contains(text))) el = el.parentElement;
        el.style.display = "none";
        n++;
      });
      return n;
    });
    if (!hidden && post!.media.length) warn("--no-media: couldn't find the media on the embed; look at the still");
  }
  await page.waitForTimeout(800);
  // Transparent page behind the card, so its rounded corners don't carry white specks onto the still.
  await page.addStyleTag({ content: "html, body { background: transparent !important; }" });
  await page.locator("article").first().screenshot({ path: shot, omitBackground: true });
} finally {
  await browser.close();
}
writeFileSync(join(dir, "post.json"), JSON.stringify({ ...post!, basis, captured, embed: embedUrl(id!, !!flags.light) }, null, 2) + "\n");
ok(`proof: ${rel(join(dir, "post.json"))} and post.png`);

// --- the on-screen still (optional) ---
if (still) {
  const [rw, rh] = imageSize(shot);
  if (rh / rw > 1.25) warn(`the post is tall (${rw}×${rh}) and will be small on screen${post!.media.length && !flags["no-media"] ? "; --no-media makes it shorter" : ""}.`);
  if (Math.min(CARD_W / rw, CARD_H / rh) > 1.6) warn(`the capture (${rw}×${rh}) is enlarged a lot; look at the still for soft text.`);
  mkdirSync(join(p.pub, "images"), { recursive: true });
  writeCard(shot, join(p.pub, "images", `${still}.png`));
  const file = `images/${still}.png`;
  const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
  writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== file), xpostCredit(post!, file, basis!, captured)], null, 2) + "\n");
  scanAssets(slug);
  ok(`public/episodes/${slug}/${file} (credited X POST, ${post!.name} @${post!.handle})`);
  if (post!.media.length && !flags["no-media"]) {
    warn(`the post carries ${post!.media.join(", ")}: fine when it's the poster's own (a company's own product image); otherwise re-run with --no-media --force.`);
  }
}

const src = sourceEntry(post!);
console.log(`
@${post!.handle} (${post!.name}${post!.badge ? `, ${post!.badge}` : ""}), ${post!.created.slice(0, 10)}:
  "${post!.text.length > 280 ? `${post!.text.slice(0, 280)}…` : post!.text}"

Next:
  • LOOK at ${rel(shot)}${still ? ` and images/${still}.png` : ""}.
  • Add to episode.json "sources":
      ${JSON.stringify(src)}
  • Log in notes.md (Fact-check):
      - ${src.url}: ${basis}${/[.!?]$/.test(basis!) ? "" : "."} Archived ${captured} (raw/xpost/${id}/). Attribute it in the script ("${post!.name} said…").`);
