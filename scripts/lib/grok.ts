// Clips made by hand-driving grok.com/imagine in the user's browser (the grok-imagine skill): the pure parts of
// `npm run grok`, the provenance record and the first and last frames that seed the next clip.
import { execFileSync } from "node:child_process";
import { extname, join } from "node:path";
import { AI_LICENSE, type Credit } from "../../src/kit/schema.ts";
import { IMAGE_EXT } from "./assets.ts";

export const GROK_PROVIDER = "grok-imagine";
export const GROK_MODEL = "Grok Imagine video (grok.com)";
export const AI_FOOTAGE_NOTE = "AI-GENERATED FOOTAGE";
export const MAX_PROPS = 4;
/** The two sizes grok.com offers once images are attached (1080p is only for prompts with no image). */
export const GROK_RESOLUTIONS = ["480p", "720p"];

/** The post's id from its grok.com/imagine/post/<id> link. Throws on any other link. */
export const postId = (url: string): string => {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`--post must be the clip's grok.com link (got "${url}")`);
  }
  if (u.hostname !== "grok.com") throw new Error(`--post must be on grok.com (got ${u.hostname})`);
  const m = /^\/imagine\/post\/([0-9a-z-]+)\/?$/i.exec(u.pathname);
  if (!m) throw new Error(`--post must be an Imagine post, grok.com/imagine/post/<id> (got ${u.pathname})`);
  return m[1];
};

/** The roles grok.com offers for an attached image (its thumbnail menu): keyframes are pinned, references only guide. */
export const PROP_ROLES = ["first", "middle", "last", "loop", "ref"];

/** What's wrong with a clip's list of input images ("role:file" or just "file"): at most four, images only. */
export const checkProps = (props: string[]): string[] => {
  const issues: string[] = [];
  if (props.length > MAX_PROPS) issues.push(`at most ${MAX_PROPS} images per clip (got ${props.length})`);
  const parsed = props.map((p) => (/^[a-z]+:/.test(p) ? { role: p.slice(0, p.indexOf(":")), file: p.slice(p.indexOf(":") + 1) } : { role: undefined, file: p }));
  parsed.filter((p) => p.role && !PROP_ROLES.includes(p.role)).forEach((p) => issues.push(`"${p.role}" isn't a role (${PROP_ROLES.join(", ")})`));
  for (const one of ["first", "last"]) if (parsed.filter((p) => p.role === one).length > 1) issues.push(`only one ${one} frame per clip`);
  parsed.filter((p) => !IMAGE_EXT.includes(extname(p.file).toLowerCase())).forEach((p) => issues.push(`${p.file} isn't an image (${IMAGE_EXT.join(", ")})`));
  return issues;
};

type Made = { file: string; name: string; post: string; prompt: string; resolution: string; seconds: number; props: string[]; created: string };

/** The credits.json entry for a clip. Grok gives no seed or version, so the post link and prompt are the record. */
export const grokCredit = ({ file, name, post, prompt, resolution, seconds, props, created }: Made): Credit => {
  const id = postId(post);
  return {
    file,
    title: `AI-generated footage: ${name}`,
    author: "Generated with Grok Imagine (xAI)",
    license: AI_LICENSE,
    sourceUrl: `https://grok.com/imagine/post/${id}`,
    notes: "AI-generated; not footage of a real event. Shown with an on-screen note.",
    generator: { provider: GROK_PROVIDER, model: GROK_MODEL, predictionId: id, prompt, input: { resolution, seconds, props, speed: "Speed" }, created },
  };
};

// --- stills (Image mode): b-roll, keyframes and props for clips ---

export const GROK_IMAGE_MODEL = "Grok Imagine image (grok.com)";
/** The shapes Image mode offers. */
export const GROK_ASPECTS = ["16:9", "9:16", "1:1", "2:3", "3:2", "4:3", "21:9", "5:2"];

/** Image mode takes up to five attached images ("Maximum of 5 images reached", 2026-11-07). */
export const MAX_STILL_PROPS = 5;

/** What's wrong with a still's attached images: references only (Image mode has no keyframes), at most five. */
export const checkStillProps = (props: string[]): string[] => [
  ...(props.length > MAX_STILL_PROPS ? [`at most ${MAX_STILL_PROPS} images per still (got ${props.length})`] : []),
  ...checkProps(props.slice(0, MAX_PROPS)),
  ...checkProps(props.slice(MAX_PROPS)).filter((i) => !/at most/.test(i)),
  ...props.filter((p) => /^[a-z]+:/.test(p) && !p.startsWith("ref:")).map((p) => `"${p}": a still takes reference images only, no ${p.slice(0, p.indexOf(":"))} role`),
];

/** A plain generation's public copy, the same bytes as the page's image. Edits (images attached) have none. */
export const publicImageUrl = (post: string) => `https://imagine-public.x.ai/imagine-public/images/${postId(post)}.jpg`;

type MadeStill = { file: string; name: string; post: string; prompt: string; aspect: string; props: string[]; created: string };

/** The credits.json entry for a still. As for clips, the post link and prompt are the record. */
export const grokStillCredit = ({ file, name, post, prompt, aspect, props, created }: MadeStill): Credit => {
  const id = postId(post);
  return {
    file,
    title: `AI-generated illustration: ${name}`,
    author: "Generated with Grok Imagine (xAI)",
    license: AI_LICENSE,
    sourceUrl: `https://grok.com/imagine/post/${id}`,
    notes: "AI-generated; not a photograph of a real event. Shown with an on-screen note.",
    generator: { provider: GROK_PROVIDER, model: GROK_IMAGE_MODEL, predictionId: id, prompt, input: { aspect, props, speed: "Speed" }, created },
  };
};

/** Writes `out` from Grok's image: 16:9 fills 1920×1080 and 9:16 fills 1080×1920 (as `npm run generate` does); other shapes keep their size. */
export const fitStill = (src: string, out: string, aspect: string) => {
  const box = aspect === "16:9" ? [1920, 1080] : aspect === "9:16" ? [1080, 1920] : null;
  const vf = box ? [`-vf`, `scale=${box[0]}:${box[1]}:force_original_aspect_ratio=increase:flags=lanczos,crop=${box[0]}:${box[1]}`] : [];
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, ...vf, "-q:v", "2", out]);
};

/** Saves first.png and last.png from a clip into `dir`: the frames that start or continue the next one. */
export const grabFrames = (clip: string, dir: string) => {
  const first = join(dir, "first.png");
  const last = join(dir, "last.png");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", clip, "-frames:v", "1", first]);
  // Seek just short of the end, then keep overwriting the image, so the last decoded frame is what's left.
  execFileSync("ffmpeg", ["-v", "error", "-y", "-sseof", "-0.5", "-i", clip, "-update", "1", last]);
  return { first, last };
};
