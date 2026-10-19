// Build out/<slug>/DESCRIPTION.md: summary placeholder, chapters, sources and credits, ready to paste into YouTube.
// Usage: npm run credits -- <slug>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { licenseLabel, parseCredits, usedCredits } from "../src/kit/lib/credits.ts";
import { FPS } from "../src/kit/lib/timing.ts";
import type { Credit } from "../src/kit/schema.ts";
import { LIBRARY } from "./lib/assets.ts";
import { loadFromDisk } from "./lib/episode.ts";
import { fail, fmtTime, ok, requireSlug, warn } from "./lib/util.ts";

const slug = requireSlug("npm run credits -- <slug>");
const d = loadFromDisk(slug);
if (!d.episode || !d.timeline) fail(`episode or timing doesn't load; run: npm run check -- ${slug}`);
const ep = d.episode!;
const tl = d.timeline!;
const assets = d.assets;
if (!assets) fail(`assets.json missing; run: npm run assets -- ${slug}`);

const readCredits = (file: string): Credit[] => (existsSync(file) ? parseCredits(JSON.parse(readFileSync(file, "utf8"))) : []);
const epCredits = readCredits(d.p.credits);
const libCredits = readCredits(join(LIBRARY, "credits.json"));

// Chapters: YouTube needs the first at 0:00, at least three, and ignores the whole list if any is under 10s,
// so a short chapter is merged into the one before it.
const all = [
  { at: 0, title: "Intro" },
  ...[
    ...tl.segments.map((s) => ({ at: Math.max(0, s.start - 0.12), title: `${ep.format === "countdown" ? `#${s.num}` : `${s.num}.`} ${s.seg.region}: ${s.seg.headline}` })),
    ...tl.texts.map((t) => ({ at: Math.max(0, t.start - 0.12), title: t.seg.heading })),
  ].sort((a, b) => a.at - b.at),
  { at: tl.outro.start, title: "Wrap-up" },
];
const chapters: typeof all = [];
all.forEach((c, i) => {
  const next = all[i + 1]?.at ?? tl.durationInFrames / FPS;
  if (i > 0 && next - c.at < 10) warn(`chapter "${c.title}" is ${(next - c.at).toFixed(1)}s (YouTube needs ≥ 10s); merged into the previous chapter`);
  else chapters.push(c);
});
if (chapters.length < 3) warn("fewer than 3 chapters; YouTube won't show chapters for this video");

// Only credit what this episode actually uses (same selection as the on-screen credits roll).
const used = usedCredits(ep, tl, assets!, epCredits, libCredits);
const line = (c: Credit) => `- ${c.author}, "${c.title}", ${licenseLabel(c)}${c.sourceUrl ? `, ${c.sourceUrl}` : ""}`;
const notedVisuals = ep.segments.flatMap((s) => s.visuals.filter((v) => v.note));
const visualLines = used.visuals.map((c) => {
  const name = c.file.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
  const note = notedVisuals.find((v) => v.name === name)?.note;
  return line(c) + (note ? ` (shown as: ${note})` : "");
});
const aiLines = used.generated.map((c) => `- ${c.file.replace(/^.*\//, "")}: generated with FLUX 3 (Black Forest Labs) via Replicate; not a photograph`);
const soundLines = used.audio.map(line);

const md = `# ${ep.title}: YouTube description

Paste everything below the line. Fill in the summary first.

---

${ep.title}

<1–2 sentence summary: what this episode covers. Only claims from the source article.>

CHAPTERS
${chapters.map((c) => `${fmtTime(c.at)} ${c.title}`).join("\n")}

SOURCES
${ep.sources.length ? ep.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") : "- <add sources to episode.json>"}

CREDITS
Footage & images:
${visualLines.join("\n") || "- (none)"}

${aiLines.length ? `AI-generated illustrations (labelled on screen):\n${aiLines.join("\n")}\n\n` : ""}Sound effects & music:
${soundLines.join("\n") || "- (none)"}

Map data: Natural Earth via world-atlas (public domain).
Public-domain and CC0 items are listed for transparency.
`;

// A standalone reference list, plain text so it pastes cleanly into a YouTube description.
const refs = `REFERENCES: ${ep.title}

${ep.sources.length ? ep.sources.map((s, i) => `${i + 1}. ${s.title}\n   ${s.url}`).join("\n") : "(no sources in episode.json)"}
`;

mkdirSync(d.p.out, { recursive: true });
writeFileSync(join(d.p.out, "DESCRIPTION.md"), md);
writeFileSync(join(d.p.out, "REFERENCES.md"), refs);
ok(`out/${slug}/REFERENCES.md (${ep.sources.length} sources)`);
ok(`out/${slug}/DESCRIPTION.md (${chapters.length} chapters, ${visualLines.length + aiLines.length + soundLines.length} credits)`);
