// Lip-sync an existing clip to the song's vocals with Sync Labs' lipsync-2-pro on Replicate (`npm run lipsync`):
// the pure parts, the input cutting and the provenance record.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AI_LICENSE, type Credit } from "../../src/kit/schema.ts";

export const LIPSYNC_MODEL = "sync/lipsync-2-pro";
export const LIPSYNC_PROVIDER = "replicate";
export const SYNC_MODES = ["loop", "bounce", "cut_off", "silence", "remap"];
/** A test of a line or two, not a whole performance: keeps each paid call small. */
export const MIN_SECONDS = 0.5;
export const MAX_SECONDS = 20;

/** Is this credit a clip made by `npm run lipsync`? */
export const lipsyncClip = (c: Credit) => c.file.startsWith("clips/") && c.generator?.provider === LIPSYNC_PROVIDER && c.generator?.model === LIPSYNC_MODEL;

type Window = { clipSeconds: number; songSeconds: number; in: number; from: number; seconds: number };

/** What's wrong with the window: it must fit inside the source clip (from `in`) and the song (from `from`). */
export const windowIssues = ({ clipSeconds, songSeconds, in: at, from, seconds }: Window): string[] => {
  const issues: string[] = [];
  if (!(seconds >= MIN_SECONDS && seconds <= MAX_SECONDS)) issues.push(`--seconds must be ${MIN_SECONDS}–${MAX_SECONDS} (got ${seconds})`);
  if (!(at >= 0) || at + seconds > clipSeconds + 0.01) issues.push(`the clip is ${clipSeconds.toFixed(2)} s: --in ${at} + --seconds ${seconds} runs past its end`);
  if (!(from >= 0) || from + seconds > songSeconds + 0.01) issues.push(`the song is ${songSeconds.toFixed(2)} s: --from ${from} + --seconds ${seconds} runs past its end`);
  return issues;
};

type Cut = { clip: string; in: number; song: string; from: number; seconds: number; dir: string };

/** Writes `dir`/video.mp4 (the clip from `in`, no audio) and `dir`/audio.wav (the song or stem from `from`), both `seconds` long. */
export const cutInputs = ({ clip, in: at, song, from, seconds, dir }: Cut) => {
  const video = join(dir, "video.mp4");
  const audio = join(dir, "audio.wav");
  // Re-encode so the cut starts on the exact frame (a stream copy would snap to the previous keyframe).
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(at), "-i", clip, "-t", String(seconds), "-an", "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(from), "-i", song, "-t", String(seconds), "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", audio]);
  return { video, audio };
};

type Made = {
  file: string;
  name: string;
  source: { clip: string; in: number; sourceUrl?: string };
  audio: { file: string; from: number };
  seconds: number;
  version?: string;
  predictionId: string;
  input: { sync_mode: string; temperature: number };
  created: string;
};

/** The credits.json entry: the model and prediction, plus the clip it was made from and the stretch of song it sings. */
export const lipsyncCredit = ({ file, name, source, audio, seconds, version, predictionId, input, created }: Made): Credit => ({
  file,
  title: `AI-generated footage: ${name}`,
  author: "Lip-synced with lipsync-2-pro (Sync Labs) via Replicate",
  license: AI_LICENSE,
  sourceUrl: `https://replicate.com/${LIPSYNC_MODEL}`,
  notes: `AI-generated; lip-synced from ${source.clip}${source.sourceUrl ? ` (${source.sourceUrl})` : ""} to the song's own vocals. Not footage of a real event. Shown with an on-screen note.`,
  generator: { provider: LIPSYNC_PROVIDER, model: LIPSYNC_MODEL, version, predictionId, prompt: "", input: { ...input, source, audio, seconds }, created },
});
