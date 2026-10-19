// Re-master an existing render without re-rendering. Usage: npm run master -- <slug>
import { existsSync } from "node:fs";
import { join } from "node:path";
import { master, MAX_TRUE_PEAK, TARGET_LUFS } from "./lib/master.ts";
import { fail, ok, paths, requireSlug } from "./lib/util.ts";

const slug = requireSlug("npm run master -- <slug>");
const out = paths(slug).out;
const input = join(out, "video.mp4");
if (!existsSync(input)) fail(`out/${slug}/video.mp4 not found. Run: npm run render -- ${slug}`);
const r = master(input, join(out, "youtube.mp4"));
const line = `out/${slug}/youtube.mp4: ${r.lufs.toFixed(1)} LUFS, true peak ${r.truePeak.toFixed(1)} dBTP`;
if (r.ok) ok(line);
else fail(`${line} (target ${TARGET_LUFS} ±1 LUFS, peak ≤ ${MAX_TRUE_PEAK} dBTP)`);
