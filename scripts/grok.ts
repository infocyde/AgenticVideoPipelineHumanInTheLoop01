// The kit's side of the grok-imagine and grok-imagine-image skills: clips and stills made by hand-driving
// grok.com/imagine in the user's browser. The browser steps are in .claude/skills/grok-imagine*/SKILL.md; a clip is
// saved to episodes/<slug>/raw/grok/<name>/original.mp4 (a still to original.jpg) with
// `npm run pick-file -- <that path> --save`.
//
// Usage:
//   npm run grok -- <slug> still <name> --post <grok.com/imagine/post/… link> --prompt "..." | --prompt-file <path>
//       [--aspect 16:9|9:16|1:1|…] [--props a.jpg,b.jpg] [--force]
//       a still: raw/grok/<name>/original.jpg, or for a plain generation (no --props) its public copy, fetched here;
//       16:9 and 9:16 fill 1920×1080 / 1080×1920; writes public images/<name>.jpg, credits it, refreshes assets.json
//   npm run grok -- <slug> frames <name>
//       writes raw/grok/<name>/first.png and last.png, to start or continue the next clip
//   npm run grok -- <slug> import <name> --post <grok.com/imagine/post/… link> --prompt "..." | --prompt-file <path>
//       [--resolution 480p|720p] [--props first:a.jpg,ref:b.jpg,last:c.jpg] [--force]
//       --props lists the images attached in Grok, at most 4, each with its role there: first, middle, last, loop or ref
//       strips the audio, copies the picture as it is to public clips/<name>.mp4 (no upscale, no re-encode), credits it
//       AI-GENERATED with its post link, prompt and input images, and refreshes assets.json
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { Credit } from "../src/kit/schema.ts";
import { episodeVoiceover, IMAGE_EXT, listMedia, scanAssets, VIDEO_EXT } from "./lib/assets.ts";
import { AI_FOOTAGE_NOTE, checkProps, checkStillProps, fitStill, GROK_ASPECTS, GROK_RESOLUTIONS, grabFrames, grokCredit, grokStillCredit, publicImageUrl } from "./lib/grok.ts";
import { fail, info, ok, parseArgs, paths, requireSlug, ROOT } from "./lib/util.ts";

const usage =
  'npm run grok -- <slug> frames <name> | import <name> --post <url> --prompt "..." [--resolution 480p|720p] [--props a.jpg,b.jpg] [--force]' +
  ' | still <name> --post <url> --prompt "..." [--aspect 16:9] [--props a.jpg] [--force]';
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

const slug = requireSlug(usage);
const p = paths(slug);
const [, cmd, name] = positional;
if (cmd !== "frames" && cmd !== "import" && cmd !== "still") fail(`Give a subcommand: frames, import or still.\n  usage: ${usage}`);
if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give it a name (lowercase letters, digits, _ or -), e.g. wave_rise.\n  usage: ${usage}`);

const dir = join(p.src, "raw", "grok", name);
const raw = join(dir, "original.mp4");
const needClip = () => existsSync(raw) || fail(`${rel(raw)} isn't there yet. Save the clip from the browser first: npm run pick-file -- ${rel(raw)} --save`);

if (cmd === "frames") {
  needClip();
  const { first, last } = grabFrames(raw, dir);
  ok(`${rel(first)}\n  ${rel(last)}`);
} else if (cmd === "import") {
  needClip();
  importClip();
} else {
  await importStill();
}

function nameFree() {
  const taken = [...listMedia(join(p.pub, "images"), IMAGE_EXT), ...listMedia(join(p.pub, "clips"), VIDEO_EXT)].filter((f) => f.replace(/\.[^.]+$/, "") === name);
  if (taken.length && !flags.force) fail(`${taken.map((f) => `"${f}"`).join(", ")} already exists for this episode. Pick another name, or pass --force to replace it.`);
}

/** --post, --prompt and --props, shared by clips and stills. */
function provenance(what: string) {
  const post = str("post");
  if (!post) fail(`--post is the ${what}'s grok.com/imagine/post/… link.\n  usage: ${usage}`);
  const prompt = str("prompt-file") ? readFileSync(str("prompt-file")!, "utf8").trim() : str("prompt");
  if (!prompt) fail(`--prompt is required: it is the record of how the ${what} was made.\n  usage: ${usage}`);
  // "role:path" keeps its role and drops the folders: "first:public/…/beach_dawn.jpg" -> "first:beach_dawn.jpg".
  const props = (str("props") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^[a-z]+:(?![\\/])/.test(s) ? `${s.slice(0, s.indexOf(":"))}:${basename(s.slice(s.indexOf(":") + 1))}` : basename(s)));
  return { post: post!, prompt: prompt!, props };
}

function saveCredit(credit: Credit) {
  const credits: Credit[] = existsSync(p.credits) ? JSON.parse(readFileSync(p.credits, "utf8")) : [];
  writeFileSync(p.credits, JSON.stringify([...credits.filter((c) => c.file !== credit.file), credit], null, 2) + "\n");
  scanAssets(slug, episodeVoiceover(slug));
}

async function importStill() {
  nameFree();
  const { post, prompt, props } = provenance("still");
  const aspect = str("aspect") ?? "16:9";
  if (!GROK_ASPECTS.includes(aspect)) fail(`--aspect must be one of ${GROK_ASPECTS.join(", ")} (what Grok's Aspect Ratio menu was set to)`);
  const issues = checkStillProps(props);
  if (issues.length) fail(issues.join("\n"));

  let credit: Credit;
  try {
    credit = grokStillCredit({ file: `images/${name}.jpg`, name, post, prompt, aspect, props, created: new Date().toISOString() });
  } catch (e) {
    fail((e as Error).message);
  }
  const src = join(dir, "original.jpg");
  if (!existsSync(src)) {
    // A plain generation has a public copy; an edit (images attached) only comes through the browser's Save dialog.
    const save = `Save it from the post page instead: npm run pick-file -- ${rel(src)} --save, then click the page's Download button.`;
    if (props.length) fail(`${rel(src)} isn't there yet. ${save}`);
    const url = publicImageUrl(post);
    info(`fetching ${url}`);
    const r = await fetch(url).catch((e: Error) => fail(`couldn't fetch it (${e.message}). ${save}`));
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) fail(`no public copy (HTTP ${r.status}). ${save}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(src, Buffer.from(await r.arrayBuffer()));
  }

  const images = join(p.pub, "images");
  mkdirSync(images, { recursive: true });
  const out = join(images, `${name}.jpg`);
  fitStill(src, out, aspect);
  saveCredit(credit!);
  const size = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", out], { encoding: "utf8" }).trim();
  ok(`public/episodes/${slug}/images/${name}.jpg (${size}; Grok's original kept in ${rel(src)})`);
  console.log(`
Next:
  • LOOK at it: faces of real people, garbled text or logos, extra limbs or parts, a Grok mark.
  • On screen, use it with "note": "AI-GENERATED ILLUSTRATION" (check requires it).
  • As a keyframe or prop for a clip, attach public/episodes/${slug}/images/${name}.jpg in Grok (the grok-imagine skill).`);
}

function importClip() {
  nameFree();
  const { post, prompt, props } = provenance("clip");
  const resolution = str("resolution") ?? GROK_RESOLUTIONS[0];
  if (!GROK_RESOLUTIONS.includes(resolution)) fail(`--resolution must be one of ${GROK_RESOLUTIONS.join(", ")}`);
  const issues = checkProps(props);
  if (issues.length) fail(issues.join("\n"));

  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw], { encoding: "utf8" }).trim());
  const clips = join(p.pub, "clips");
  mkdirSync(clips, { recursive: true });
  const out = join(clips, `${name}.mp4`);
  info(`copying the picture without its audio to ${rel(out)}`);
  const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", out], { encoding: "utf8" });
  if (ff.status !== 0) fail(`ffmpeg failed:\n  ${(ff.stderr ?? "").trim().split(/\r?\n/).slice(-3).join("\n  ")}`);

  let credit: Credit;
  try {
    credit = grokCredit({ file: `clips/${name}.mp4`, name, post, prompt, resolution, seconds: Math.round(seconds * 100) / 100, props, created: new Date().toISOString() });
  } catch (e) {
    fail((e as Error).message);
  }
  saveCredit(credit!);
  ok(`public/episodes/${slug}/clips/${name}.mp4 (${seconds.toFixed(2)} s, ${resolution})`);
  console.log(`
Next:
  • LOOK at its frames: extra people or figures you didn't ask for, warped hands or faces, garbled text, a Grok mark.
  • Use it with "note": "${AI_FOOTAGE_NOTE}" (check requires it).`);
}
