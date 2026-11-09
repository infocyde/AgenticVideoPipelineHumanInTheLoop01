// YouTube upload text from out/<slug>/DESCRIPTION.md: the title and a description YouTube accepts (≤ 5,000 characters,
// no angle brackets). Episodes keep summary, chapters, sources and credits when they fit. When they don't (the user's
// rule, 2026-11-06), the credits go and a closing line says the full references and credits are at the end of the video.
// If it is still too long, the sources become KEY LINKS: the producer's picks from episodes/<slug>/key-links.txt
// ("Title | URL", one per line), or, without that file, the first sources that fit. Shorts (episodic, standalone and
// long) have no end cards: they keep their credits when everything fits; when it doesn't, the credits are dropped whole
// (the user's rule, 2026-10-31), and only then do the sources shrink to "Outlet (date): link" while they fit, the rest
// on one "Also:" line. Episodic Shorts also get the parent video's link.
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
  // 1. Drop the credits. Episodes point to their end cards; Shorts have none, so theirs go without a pointer.
  const END_LINE = "The full list of references and credits is at the end of the video.";
  text = isShort ? top.trim() : `${top.trim()}\n\n${END_LINE}`;
  // 2. Still too long: fewer links.
  const s0 = top.search(/^SOURCES$/m);
  if ([...text].length > MAX && s0 >= 0) {
    const head = top.slice(0, s0);
    const items = top.slice(s0).split("\n").filter((l) => l.startsWith("- ")).map((l) => {
      const m = l.match(/^- (.*?): (https?:\/\/\S+)$/);
      const t = m ? m[1] : l.slice(2);
      const date = t.match(/\(([^()]*\d{4}[^()]*)\)\s*$/)?.[1];
      return { short: date && t.includes(":") ? `${t.split(":")[0].trim()} (${date})` : t, url: m?.[2] ?? "" };
    });
    if (isShort) {
      // Shorts: "Outlet (date): link" while they fit, the rest on one "Also:" line.
      const build = (k: number) => {
        const linked = items.slice(0, k).map((it) => `- ${it.short}${it.url ? `: ${it.url}` : ""}`);
        const rest = items.slice(k).map((it) => it.short);
        if (rest.length) linked.push(`- Also: ${rest.join("; ")}`);
        return `${head}SOURCES\n${linked.join("\n")}`;
      };
      let k = items.length;
      while (k > 0 && [...build(k)].length > MAX - 50) k--;
      text = build(k);
      warn(`credits dropped and sources shortened to fit: links kept for ${k}/${items.length} sources`);
    } else {
      // Episodes: KEY LINKS, the producer's picks when there are any; the end cards have the rest.
      const pickFile = join(ROOT, "episodes", slug, "key-links.txt");
      const picks = existsSync(pickFile)
        ? readFileSync(pickFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
            const [t, u] = l.split(/\s+\|\s+/);
            if (!u || !/^https?:\/\//.test(u)) fail(`episodes/${slug}/key-links.txt: "${l}" isn't "Title | URL"`);
            if (!items.some((it) => it.url === u)) warn(`key link isn't in the episode's sources: ${u}`);
            return { short: t, url: u };
          })
        : [];
      const links = picks.length ? picks : items.filter((it) => it.url);
      const build = (k: number) => `${head}KEY LINKS\n${links.slice(0, k).map((it) => `- ${it.short}: ${it.url}`).join("\n")}\n\n${END_LINE}`;
      let k = links.length;
      while (k > 0 && [...build(k)].length > MAX - 50) k--;
      text = build(k);
      if (picks.length) warn(`credits dropped to fit; ${k}/${links.length} key links from key-links.txt`);
      else warn(`credits dropped to fit; the first ${k} of ${items.length} sources kept as key links. Pick the most important ones in episodes/${slug}/key-links.txt ("Title | URL", one per line) and run this again.`);
    }
  } else warn(isShort ? "credits dropped to fit (Shorts rule)" : "credits dropped to fit (the end cards have them)");
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
