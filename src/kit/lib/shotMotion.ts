// Camera moves for music-video shots (`motion` in episode.json). Pure: progress through the shot in, a CSS transform out.
// Every move keeps the picture over the whole frame, so no edge ever shows.

export const SHOT_MOTIONS = [
  "zoom-in",
  "zoom-out",
  "push-in",
  "pull-out",
  "pan-left",
  "pan-right",
  "tilt-up",
  "tilt-down",
  "roll",
  "shake",
  "whip-left",
  "whip-right",
  "rack-focus",
] as const;
export type ShotMotion = (typeof SHOT_MOTIONS)[number];

const W = 1920;
const H = 1080;
/** How far a zoom and a push-in travel, as a multiple of the starting scale. */
const ZOOM = 1.3;
const PUSH = 1.55;
/** Scale that gives a pan, tilt or whip its room to travel. */
const TRAVEL = 1.3;
const ROLL_SCALE = 1.2;
const ROLL_DEGREES = 2.5;
const SHAKE_SCALE = 1.12;
const SHAKE_PX = 14;
const WHIP_BLUR = 18;
const RACK_BLUR = 14;

export type MotionFrame = {
  scale: number;
  /** Pixels at 1920x1080, applied after the scale. */
  x: number;
  y: number;
  /** Degrees. */
  rotate: number;
  /** Pixels of blur on the picture. */
  blur: number;
  /** The point that stays put in a zoom, as fractions of the frame (CSS transform-origin). */
  origin: [number, number];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (p: number) => p * p * (3 - 2 * p);
const easeOut = (p: number) => 1 - (1 - p) ** 3;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const within = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const shotMotion = (
  move: ShotMotion,
  progress: number,
  opts: { frame: number; focus?: [number, number]; crop?: number },
): MotionFrame => {
  const p = clamp01(progress);
  const crop = opts.crop ?? 1;
  const origin = opts.focus ?? ([0.5, 0.5] as [number, number]);
  const still = { x: 0, y: 0, rotate: 0, blur: 0, origin };

  // The slide range that keeps the picture over the frame at a scale, around this origin.
  const rangeX = (s: number): [number, number] => [-(1 - origin[0]) * W * (s - 1), origin[0] * W * (s - 1)];
  const rangeY = (s: number): [number, number] => [-(1 - origin[1]) * H * (s - 1), origin[1] * H * (s - 1)];
  const travel = Math.max(TRAVEL, crop);
  // A whip: most of the way in the first quarter, then a slow settle.
  const whip = p < 0.25 ? 0.85 * easeOut(p / 0.25) : lerp(0.85, 1, (p - 0.25) / 0.75);
  const whipBlur = WHIP_BLUR * Math.max(0, 1 - p / 0.2);

  switch (move) {
    case "zoom-in":
      return { ...still, scale: lerp(crop, crop * ZOOM, smooth(p)) };
    case "zoom-out":
      return { ...still, scale: lerp(crop * ZOOM, crop, smooth(p)) };
    case "push-in":
      return { ...still, scale: lerp(crop, crop * PUSH, easeOut(p)) };
    case "pull-out":
      return { ...still, scale: lerp(crop * PUSH, crop, easeOut(p)) };
    case "pan-left":
      return { ...still, scale: travel, x: lerp(...rangeX(travel), smooth(p)) };
    case "pan-right":
      return { ...still, scale: travel, x: lerp(rangeX(travel)[1], rangeX(travel)[0], smooth(p)) };
    case "tilt-up":
      return { ...still, scale: travel, y: lerp(...rangeY(travel), smooth(p)) };
    case "tilt-down":
      return { ...still, scale: travel, y: lerp(rangeY(travel)[1], rangeY(travel)[0], smooth(p)) };
    case "roll":
      return { ...still, origin: [0.5, 0.5], scale: Math.max(ROLL_SCALE, crop), rotate: lerp(-ROLL_DEGREES, ROLL_DEGREES, smooth(p)) };
    case "shake": {
      const scale = Math.max(SHAKE_SCALE, crop);
      const f = opts.frame;
      return {
        ...still,
        scale,
        x: within(SHAKE_PX * Math.sin(f * 1.3) * Math.cos(f * 0.47), ...rangeX(scale)),
        y: within(SHAKE_PX * Math.sin(f * 0.9 + 1) * Math.cos(f * 0.31), ...rangeY(scale)),
      };
    }
    case "whip-left":
      return { ...still, scale: travel, x: lerp(...rangeX(travel), whip), blur: whipBlur };
    case "whip-right":
      return { ...still, scale: travel, x: lerp(rangeX(travel)[1], rangeX(travel)[0], whip), blur: whipBlur };
    case "rack-focus":
      return { ...still, scale: lerp(crop, crop * 1.1, smooth(p)), blur: RACK_BLUR * Math.max(0, 1 - p / 0.4) };
  }
};
