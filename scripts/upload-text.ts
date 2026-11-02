// YouTube upload text from out/<slug>/DESCRIPTION.md: the title and a description YouTube accepts (≤ 5,000 characters,
// no angle brackets). Episodes keep summary, chapters, sources and credits when they fit. When they don't, the credits
// go first (one line points to the video's credits roll, which has the full list; the user's rule since 2026-10-31),
// then, if it is still too long, the sources shrink to "Outlet (date): link" while they fit, with the rest named on
// one "Also:" line (the video's sources card has every title). Shorts (episodic, standalone and long) keep their
// credits when everything fits; when it doesn't, the credits are dropped whole (the user's rule, 2026-10-31), and only
// then do the sources shrink the same way. Episodic Shorts also get the parent video's link.
// Writes out/<slug>/upload.json { title, description, url } for the youtube-upload skill.
// Usage: npm run upload-text -- <slug>                 (run npm run credits first)
//        npm run upload-text -- <slug> --url <youtube url>   (records the uploaded video's link; Shorts read the parent's)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blockMessage, checkUpload } from "./lib/upload.ts";
import { fail, ok, parseArgs, requireSlug, ROOT, warn } from "./lib/util.ts";

const MAX = 5000;
const { flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const slug = requireSlug("npm run upload-text -- <slug> [--url <youtube url>]");
const out = (s: string) => join(ROOT, "out", s);
const descFile = join(out(slug), "DESCRIPTION.md");
if (!existsSync(descFile)) fail(`out/${slug}/DESCRIPTION.md is missing; run: npm run credits -- ${slug}`);
const epFile = join(ROOT, "episodes", slug, "episode.json");
const ep = existsSync(epFile) ? JSON.parse(readFileSync(epFile, "utf8")) : {};
const isShort = ep.format === "short";
const jsonFile = join(out(slug), "upload.json");
const prev = existsSync(jsonFile) ? JSON.parse(readFileSync(jsonFile, "utf8")) : {};
// Another channel's video (config.yaml upload.blocked_themes): the text is still written, for the user to post by hand,
// but marked doNotUpload, and no upload link is ever recorded for it.
const block = checkUpload(slug);
if (block.blocked && str("url")) fail(`not recording a link: ${blockMessage(slug, block)}`);
const url = block.blocked ? "" : (str("url") ?? prev.url ?? "");

// Everything below the "---" line, split into the title line and the rest.
const body = readFileSync(descFile, "utf8").split(/^---$/m).slice(1).join("---").trim();
const [title, ...rest] = body.split("\n");
let text = rest.join("\n").trim();
if (isShort && ep.parent) {
  const parentUrl = existsSync(join(out(ep.parent), "upload.json")) ? JSON.parse(readFileSync(join(out(ep.parent), "upload.json"), "utf8")).url : "";
  if (!parentUrl) warn(`the parent's YouTube link isn't recorded yet (npm run upload-text -- ${ep.parent} --url <link>); the "Full video" line keeps a placeholder`);
  text = text.replace(/Full video: <[^>]*>/, `Full video: ${parentUrl || "LINK TO FULL VIDEO"}`);
}
text = text.replace(/\n*Full video: <[^>]*>\n*/, "\n\n"); // a standalone Short's DESCRIPTION.md from before 2026-10-31
const [top] = text.split(/\nCREDITS\n/);

if ([...text].length > MAX) {
  // 1. Drop the credits. Episodes point to their credits roll; Shorts have none, so theirs go without a pointer.
  text = isShort ? top.trim() : `${top.trim()}\n\nCREDITS: the full list, with licenses and links, is in the credits at the end of the video.`;
  // 2. Still too long: shrink the sources to "Outlet (date): link" while they fit, the rest on one "Also:" line.
  const s0 = text.search(/^SOURCES$/m);
  if ([...text].length > MAX && s0 >= 0) {
    const c1 = text.indexOf("\n\nCREDITS", s0);
    const c0 = c1 >= 0 ? c1 : text.length;
    const head = text.slice(0, s0), tail = text.slice(c0);
    const items = text.slice(s0, c0).split("\n").filter((l) => l.startsWith("- ")).map((l) => {
      const m = l.match(/^- (.*?): (https?:\/\/\S+)$/);
      const t = m ? m[1] : l.slice(2);
      const date = t.match(/\(([^()]*\d{4}[^()]*)\)\s*$/)?.[1];
      return { short: date && t.includes(":") ? `${t.split(":")[0].trim()} (${date})` : t, url: m?.[2] ?? "" };
    });
    const build = (k: number) => {
      const linked = items.slice(0, k).map((it) => `- ${it.short}${it.url ? `: ${it.url}` : ""}`);
      const rest = items.slice(k).map((it) => it.short);
      if (rest.length) linked.push(`- Also: ${rest.join("; ")}`);
      return `${head}SOURCES${isShort ? "" : " (full titles in the sources card at the end of the video)"}\n${linked.join("\n")}${tail}`;
    };
    let k = items.length;
    while (k > 0 && [...build(k)].length > MAX - 50) k--;
    text = build(k);
    warn(`credits dropped and sources shortened to fit: links kept for ${k}/${items.length} sources`);
  } else warn(isShort ? "credits dropped to fit (Shorts rule)" : "credits dropped to fit (the credits roll in the video has them)");
}
text = text.replace(/</g, "‹").replace(/>/g, "›");
const n = [...text].length;
if (n > MAX) warn(`description is ${n} characters, over YouTube's ${MAX}; trim it by hand in ${jsonFile.replace(ROOT, ".")}`);

const record = block.blocked
  ? { title: title.trim(), description: text, doNotUpload: true, reason: blockMessage(slug, block) }
  : { title: title.trim(), description: text, url };
writeFileSync(jsonFile, JSON.stringify(record, null, 2) + "\n");
if (block.blocked) warn(`DO NOT UPLOAD: ${blockMessage(slug, block)}. upload.json is for posting by hand.`);
ok(`out/${slug}/upload.json  (title ${[...title.trim()].length}/100, description ${n}/${MAX}${url ? `, url ${url}` : ""})`);
