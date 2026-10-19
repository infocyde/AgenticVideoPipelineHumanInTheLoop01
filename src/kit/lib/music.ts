// Music-bed volume envelope: dips under speech, swells in pauses and on slams, fades in and out. Pure.
import type { Timeline } from "./resolve";
import { FPS, speechGaps, toFrame } from "./timing";

export type MusicOpts = { level: number; duck: boolean };

const DUCKED = 0.55; // bed level under speech, relative to `level`
const SWELL = 1.3; // bed level on a slam
const SLAM_FRAMES = 15;
const RAMP_SEC = 0.35; // time for a full duck <-> open swing

/** Volume for every frame of the composition. */
export const musicEnvelope = (tl: Timeline, { level, duck }: MusicOpts): number[] => {
  const n = tl.durationInFrames;
  const vo = toFrame(tl.voiceoverDuration);
  const raw = new Array<number>(n).fill(level);

  if (duck) {
    raw.fill(level * DUCKED, 0, Math.min(vo, n));
    for (const [a, b] of speechGaps(tl.words, tl.voiceoverDuration, 0.4)) {
      raw.fill(level, toFrame(a), Math.min(toFrame(b), n));
    }
    if (tl.format === "countdown") {
      for (const s of tl.segments) raw.fill(level * SWELL, Math.max(0, s.from), Math.min(s.from + SLAM_FRAMES, n));
    }
    // Ramp instead of stepping: swells start when a pause starts, dips finish by the time speech resumes.
    const step = (level * (1 - DUCKED)) / (RAMP_SEC * FPS);
    for (let f = 1; f < n; f++) raw[f] = Math.min(raw[f], raw[f - 1] + step);
    for (let f = n - 2; f >= 0; f--) raw[f] = Math.min(raw[f], raw[f + 1] + step);
  }

  // Fade in over 20 frames; fade out over the last second of voiceover + tail (or over the last 2s of the closing cards).
  const fadeOutStart = tl.endScreen || tl.sourcesCard || tl.creditsCard ? n - 2 * FPS : vo - 30;
  return raw.map((v, f) => {
    const fin = Math.min(1, f / 20);
    const fout = f < fadeOutStart ? 1 : Math.max(0, (n - f) / Math.max(1, n - fadeOutStart));
    return v * fin * fout;
  });
};
