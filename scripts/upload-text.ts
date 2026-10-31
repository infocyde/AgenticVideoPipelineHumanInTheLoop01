// YouTube upload text from out/<slug>/DESCRIPTION.md: the title and a description YouTube accepts (≤ 5,000 characters,
// no angle brackets). Episodes keep summary, chapters and sources, with the credits compacted to "author, license"
// when the full list doesn't fit (the full list is in the video's credits roll). Shorts drop the credits and get the
// parent video's link. Writes out/<slug>/upload.json { title, description, url } for the youtube-upload skill.
// Usage: npm run upload-text -- <slug>                 (run npm run credits first)
//        npm run upload-text -- <slug> --url <youtube url>   (records the uploaded video's link; Shorts read the parent's)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
const url = str("url") ?? prev.url ?? "";

// Everything below the "---" line, split into the title line and the rest.
const body = readFileSync(descFile, "utf8").split(/^---$/m).slice(1).join("---").trim();
const [title, ...rest] = body.split("\n");
let text = rest.join("\n").trim();
const [top, credits = ""] = text.split(/\nCREDITS\n/);

if (isShort) {
  const parentUrl = ep.parent && existsSync(join(out(ep.parent), "upload.json")) ? JSON.parse(readFileSync(join(out(ep.parent), "upload.json"), "utf8")).url : "";
  if (!parentUrl) warn(`the parent's YouTube link isn't recorded yet (npm run upload-text -- ${ep.parent} --url <link>); the "Full video" line keeps a placeholder`);
  text = top.trim().replace(/Full video: <[^>]*>/, `Full video: ${parentUrl || "LINK TO FULL VIDEO"}`);
} else if ([...text].length > MAX) {
  // Compact the credits: "- Author, "Title", License, URL (shown as …)" -> "- Author, License"; keep the other lines.
  const seen = new Set<string>();
  const lines = credits.split("\n").flatMap((l) => {
    const m = l.match(/^- (.+?), "(?:[^"]|"(?=[^,]))*", ([^,]+?)(?:, https?:\/\/\S+)?(?: \(shown as: [^)]*\))?$/);
    if (/^Public-domain and CC0 items are listed/.test(l)) return []; // the roll in the video still says it
    if (!m) return [l]; // lines in another shape (AI-generated stills, notes) stay as they are
    const k = `- ${m[1]}, ${m[2]}`;
    if (seen.has(k)) return [];
    seen.add(k);
    return [k];
  });
  text = `${top.trim()}\n\nCREDITS (full list with titles and links in the credits at the end of the video)\n${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}`;
}
text = text.replace(/</g, "‹").replace(/>/g, "›");
const n = [...text].length;
if (n > MAX) warn(`description is ${n} characters, over YouTube's ${MAX}; trim the sources or credits by hand in ${jsonFile.replace(ROOT, ".")}`);

writeFileSync(jsonFile, JSON.stringify({ title: title.trim(), description: text, url }, null, 2) + "\n");
ok(`out/${slug}/upload.json  (title ${[...title.trim()].length}/100, description ${n}/${MAX}${url ? `, url ${url}` : ""})`);
