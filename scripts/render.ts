// Check, render and master an episode.
// Usage: npm run render -- <slug> [-- extra remotion flags, e.g. --frames=0-299 for a quick partial test]
// Output: out/<slug>/video.mp4 (raw mix) and out/<slug>/youtube.mp4 (-14 LUFS, true peak ≤ -1 dBTP: upload this one)
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { printIssues } from "./check.ts";
import { runCheck } from "./lib/check.ts";
import { master, MAX_TRUE_PEAK, TARGET_LUFS } from "./lib/master.ts";
import type { EpisodeInput } from "../src/kit/schema.ts";
import { fail, info, ok, parseArgs, paths, readJson, requireSlug, ROOT, run } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run render -- <slug>");
const { rest } = parseArgs();
sync();
if (printIssues(slug, runCheck(slug))) fail("render cancelled: `check` has errors (listed above).");

const out = paths(slug).out;
mkdirSync(out, { recursive: true });
const video = join(out, "video.mp4");
info(`rendering ${slug} -> out/${slug}/video.mp4 (stop with Ctrl+C; if processes linger, run: npm run kill)`);
const started = Date.now();
const code = run(process.execPath, [
  join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js"),
  "render",
  "src/index.ts",
  slug,
  video,
  "--gl=angle",
  "--codec=h264",
  "--audio-codec=aac",
  ...rest,
]);
if (code !== 0) fail(`remotion render exited with code ${code}`);
ok(`rendered in ${((Date.now() - started) / 60000).toFixed(1)} min`);

info("mastering audio (two-pass loudnorm + limiter)");
const r = master(video, join(out, "youtube.mp4"));
const line = `out/${slug}/youtube.mp4: ${r.lufs.toFixed(1)} LUFS, true peak ${r.truePeak.toFixed(1)} dBTP`;
if (!r.ok) fail(`${line} (target ${TARGET_LUFS} ±1 LUFS, true peak ≤ ${MAX_TRUE_PEAK} dBTP)`);
ok(line);

// A Short also lands next to its parent's video: out/<parent>/short<N>.mp4.
const ep = readJson<EpisodeInput>(paths(slug).episode);
if (ep.format === "short" && ep.parent) {
  const n = slug.match(/-short(\d+)$/)?.[1] ?? slug;
  const dest = join(paths(ep.parent).out, `short${n}.mp4`);
  mkdirSync(paths(ep.parent).out, { recursive: true });
  copyFileSync(join(out, "youtube.mp4"), dest);
  ok(`copied to out/${ep.parent}/short${n}.mp4`);
}
