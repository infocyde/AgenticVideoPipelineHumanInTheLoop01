// Loudness mastering for YouTube: two-pass linear loudnorm + limiter, video stream copied untouched.
// Single-pass loudnorm overshot the peaks on the first episode; the raw Remotion mix sits around -26 LUFS.
import { execFileSync, spawnSync } from "node:child_process";

export const TARGET_LUFS = -14;
export const MAX_TRUE_PEAK = -1;
const TARGET = `I=${TARGET_LUFS}:TP=-1.5:LRA=11`;

/** Integrated loudness and true peak of a file's audio (ebur128). */
export const measure = (file: string) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const summary = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const i = summary.match(/I:\s+(-?[\d.]+) LUFS/);
  const tp = summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/);
  if (!i || !tp) throw new Error(`loudness measurement failed:\n${r.stderr.slice(-600)}`);
  return { lufs: Number(i[1]), truePeak: tp[1] === "-inf" ? -Infinity : Number(tp[1]) };
};

export const master = (input: string, output: string) => {
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", input, "-vn", "-af", `loudnorm=${TARGET}:print_format=json`, "-f", "null", "-"], {
    encoding: "utf8",
  });
  const json = probe.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!json) throw new Error(`loudnorm measurement failed:\n${probe.stderr.slice(-800)}`);
  const m = JSON.parse(json[0]);
  console.log(`raw mix: ${m.input_i} LUFS, true peak ${m.input_tp} dBTP`);

  // `ceilingDb` is the limiter's sample-peak ceiling. AAC encoding can add inter-sample peaks above it,
  // so the loop below lowers it when the measured true peak still misses.
  const pass = (trimDb: number, ceilingDb: number) => {
    const filter =
      `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
      `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` +
      (trimDb ? `,volume=${trimDb.toFixed(2)}dB` : "") +
      `,alimiter=limit=${Math.pow(10, ceilingDb / 20).toFixed(4)}:level=false`;
    execFileSync(
      "ffmpeg",
      ["-v", "error", "-y", "-i", input, "-c:v", "copy", "-af", filter, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output],
      { stdio: "inherit" },
    );
    return measure(output);
  };

  // loudnorm drops out of linear mode when the gain would push peaks too high, and the limiter then
  // shaves loudness off; hot mixes can also land a hair over the true-peak ceiling after encoding.
  // Retry with a gain trim (loudness off by > 0.5 LU) and/or a lower limiter ceiling (true peak over).
  let trim = 0;
  let ceiling = -1.5;
  let after = pass(trim, ceiling);
  for (let i = 0; i < 3; i++) {
    const loudOff = Math.abs(after.lufs - TARGET_LUFS) > 0.5;
    const peakOver = after.truePeak > MAX_TRUE_PEAK - 0.1;
    if (!loudOff && !peakOver) break;
    if (loudOff) trim += TARGET_LUFS - after.lufs;
    if (peakOver) ceiling -= after.truePeak - MAX_TRUE_PEAK + 0.3;
    console.log(
      `landed at ${after.lufs.toFixed(1)} LUFS, true peak ${after.truePeak.toFixed(1)} dBTP; re-mastering with ` +
        `${trim >= 0 ? "+" : ""}${trim.toFixed(1)} dB trim, limiter ceiling ${ceiling.toFixed(1)} dB`,
    );
    after = pass(trim, ceiling);
  }
  const okLoud = Math.abs(after.lufs - TARGET_LUFS) <= 1;
  const okPeak = after.truePeak <= MAX_TRUE_PEAK;
  return { ...after, ok: okLoud && okPeak, okLoud, okPeak };
};
