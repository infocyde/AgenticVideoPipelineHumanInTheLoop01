// Align voiceover.txt to voiceover.mp3 (faster-whisper + difflib) and write timing.json; then report every marker.
// Usage: npm run align -- <slug> [--estimate] [--model medium.en] [--device cpu|cuda]
//   --estimate  write rough timing from voiceover.txt alone (no audio), to preview a draft script
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { estimateTiming } from "../src/kit/lib/timing.ts";
import type { EpisodeInput } from "../src/kit/schema.ts";
import { scanAssets } from "./lib/assets.ts";
import { loadFromDisk } from "./lib/episode.ts";
import { bold, fail, fmtTime, info, ok, parseArgs, paths, readJson, requireSlug, ROOT, run, venvPython, warn } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run align -- <slug> [--estimate]");
const { flags } = parseArgs();
const p = paths(slug);
if (!existsSync(p.script)) fail(`episodes/${slug}/voiceover.txt is missing. Write the script first.`);

let voiceover = "voiceover.mp3";
try {
  voiceover = readJson<EpisodeInput>(p.episode).audio?.voiceover ?? voiceover;
} catch {
  /* reported below */
}
const audio = join(p.pub, voiceover);

if (flags.estimate) {
  writeFileSync(p.timing, JSON.stringify(estimateTiming(readFileSync(p.script, "utf8")), null, 1) + "\n");
  ok(`wrote estimated timing (no audio) to public/episodes/${slug}/timing.json`);
} else {
  if (!existsSync(audio)) fail(`No voiceover at public/episodes/${slug}/${voiceover}. Save the MP3 there (or run with --estimate to preview from text).`);
  const py = venvPython();
  if (!existsSync(py)) fail("Alignment isn't set up yet. Run once: npm run setup:align");
  const model = typeof flags.model === "string" ? flags.model : "medium.en";
  const device = typeof flags.device === "string" ? flags.device : "cpu";
  const code = run(py, [join(ROOT, "scripts", "align.py"), audio, p.script, p.timing, p.heard, model, device]);
  if (code !== 0) fail("alignment failed (see the Python output above)");
}

scanAssets(slug, voiceover);
sync();

const d = loadFromDisk(slug);
if (!d.timing) fail("timing.json was not written");
const t = d.timing!;

if (t.match) {
  const rate = t.match.matched / Math.max(1, t.match.total);
  const line = `matched ${t.match.matched}/${t.match.total} script words (${(rate * 100).toFixed(1)}%), duration ${t.duration.toFixed(2)}s`;
  if (rate < 0.9) {
    warn(line);
    warn(
      `Under 90%: the recording probably differs from voiceover.txt. Compare with what Whisper heard in episodes/${slug}/heard.txt, ` +
        "edit voiceover.txt to match what was actually said (captions must show what was said), then re-run align.",
    );
  } else ok(line);
} else info(`estimated duration ${t.duration.toFixed(2)}s`);

if (!d.episode) {
  warn("episode.json doesn't validate yet, so markers weren't checked. Run: npm run check -- " + slug);
  process.exit(0);
}

const tl = d.timeline!;
console.log(bold("\nsegment markers"));
[...tl.segments, ...tl.texts]
  .sort((a, b) => a.index - b.index)
  .forEach((s) => {
    const missing = tl.issues.some((x) => x.where === `segments[${s.index}].marker`);
    const tag = "num" in s ? String(s.num).padStart(2) : " T";
    console.log(`  ${missing ? "✖" : "✔"} ${tag}  ${fmtTime(s.start).padStart(5)}  ${s.start.toFixed(2).padStart(7)}s  "${s.seg.marker}"${missing ? "  NOT FOUND" : ""}`);
  });
const outroMissing = tl.issues.some((x) => x.where === "outro.cue");
console.log(`  ${outroMissing ? "✖" : "✔"} outro ${fmtTime(tl.outro.start).padStart(5)}  ${tl.outro.start.toFixed(2).padStart(7)}s  "${d.episode.outro.cue}"`);

const errors = tl.issues.filter((x) => x.level === "error" && x.where !== "timing");
if (errors.length) {
  warn(`${errors.length} cue${errors.length > 1 ? "s" : ""} or visuals don't resolve yet; \`npm run check -- ${slug}\` lists them.`);
} else ok("every cue resolves");
