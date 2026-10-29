// The "card" still shared by the screenshot tools (npm run shot, npm run xpost): the capture centered on a darkened,
// blurred copy of itself, 1920×1080.
import { execFileSync } from "node:child_process";

/** The capture fits inside 86% of the frame. */
export const CARD_W = 1650;
export const CARD_H = 930;

export const cardFilter = () =>
  `[0:v]split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=28:2,eq=brightness=-0.22:saturation=0.75[bg];` +
  `[b]scale=${CARD_W}:${CARD_H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=iw+6:ih+6:3:3:color=0x101010[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;

/** Width and height of an image, by ffprobe. */
export const imageSize = (file: string): [number, number] => {
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  const [w, h] = probe.trim().split(",").map(Number);
  return [w, h];
};

/** Write `input` as a 1920×1080 card still to `out`. */
export const writeCard = (input: string, out: string) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", input, "-filter_complex", cardFilter(), "-frames:v", "1", out]);
