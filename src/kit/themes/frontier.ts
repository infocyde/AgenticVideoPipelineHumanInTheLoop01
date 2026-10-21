// "Frontier": bleeding-edge technology. Ink-black field with a living dot lattice and drifting aurora, glass panels
// with iridescent edges, electric-cyan signal accent, acid-lime data, violet/magenta gradients.
// Unlike the other themes it brings its own scenes and chrome (src/kit/skins/frontier/): a spatial layout with a
// floating media window, decoding text, counting metric tiles, a dot-matrix map and light-sweep cuts.
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { alpha, type Theme } from "./types";

// Sora (geometric, wide numerals) for numbers and big words; Geist for headlines, captions and body; Geist Mono for labels.
// (Unbounded was the first pick; its E has a short, inset middle bar that read as a glitch at display sizes.)
const sora = loadSora("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });
const geist = loadGeist("normal", { weights: ["500", "700", "800"], subsets: ["latin", "latin-ext"] });
const geistMono = loadGeistMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

/** Frontier's own tokens beyond the shared Theme (used by its skin). */
export const FRONTIER = {
  cyan: "#3df0ff", // signal
  lime: "#c8ff3d", // data
  violet: "#8b6bff",
  magenta: "#ff4fd8",
  ink: "#05060a",
  glass: "rgba(18, 21, 36, 0.62)",
  glassHi: "rgba(30, 34, 58, 0.72)",
  /** The iridescent edge: borders, rules, gradient type. */
  iris: "linear-gradient(100deg, #3df0ff 0%, #8b6bff 45%, #ff4fd8 75%, #c8ff3d 100%)",
  irisSoft: "linear-gradient(100deg, rgba(61,240,255,0.55) 0%, rgba(139,107,255,0.55) 50%, rgba(255,79,216,0.45) 100%)",
  /** Gradient fill for big numerals. */
  numeral: "linear-gradient(180deg, #ffffff 0%, #c9f9ff 35%, #3df0ff 70%, #8b6bff 100%)",
  weights: { display: 800, headline: 700, caption: 800, body: 500, mono: 500, monoBold: 700 },
};

const { cyan, lime, violet, magenta, ink } = FRONTIER;
const text = "#eef1ff";

export const frontier: Theme = {
  id: "frontier",
  fonts: { display: sora.fontFamily, mono: geistMono.fontFamily, body: geist.fontFamily },
  fontsReady: () => Promise.all([sora.waitUntilDone(), geist.waitUntilDone(), geistMono.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: ink,
    panel: FRONTIER.glass,
    line: "rgba(160, 180, 255, 0.16)",
    text,
    dim: alpha(text, 0.58),
    accent: cyan,
    accentDeep: "#2a1e66", // violet tint: grades b-roll cool under multiply
    highlight: lime,
    onAccent: "#03121a",
    ctaDone: "#3a3f5c",
    tickerBg: "rgba(5, 6, 10, 0.78)",
    noteBg: "rgba(5, 6, 10, 0.62)",
  },
  map: {
    land: "#161a33",
    landEdge: "#262c52",
    graticule: alpha(violet, 0.1),
    highlightFill: alpha(cyan, 0.3),
    highlightStroke: cyan,
    hostileFill: alpha(magenta, 0.28),
    hostileStroke: alpha(magenta, 0.85),
    pin: lime,
    pinStroke: ink,
    label: text,
    labelHalo: "rgba(5,6,10,0.9)",
  },
  backdrop: {
    filter: "contrast(1.08) saturate(1.08) brightness(1.02)",
    tintOpacity: 0.16,
    tintBlend: "multiply",
    sideGradient:
      "linear-gradient(90deg, rgba(5,6,10,0.9) 0%, rgba(5,6,10,0.55) 40%, rgba(5,6,10,0.08) 72%, rgba(5,6,10,0.2) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(5,6,10,0.8) 0%, transparent 32%)",
  },
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(cyan, size >= 80 ? 0.45 : size >= 50 ? 0.4 : 0.34)}`,
    textShadow: "0 6px 30px rgba(2,3,8,0.85)",
    captionShadow: "0 4px 18px rgba(0,0,0,0.9), 0 0 2px #000",
    vignette: "radial-gradient(ellipse at center, transparent 60%, rgba(4,3,14,0.55) 100%)",
    grainOpacity: 0.035,
    scanlineOpacity: 0,
    glitchColors: [alpha(cyan, 0.5), alpha(magenta, 0.4)],
    flash: "#e8fbff",
    outroScrim: "radial-gradient(ellipse at center, rgba(5,6,10,0.2) 0%, rgba(5,6,10,0.88) 75%)",
  },
  copy: {
    tickerLabel: "SIGNAL",
    ctaLabel: "Subscribe",
    ctaDoneLabel: "Subscribed",
    topEmphasisLabel: "TOP SIGNAL",
    locatorLabel: "GEO",
    endCardNext: "NEXT BUILD",
    panelLabel: "METRICS",
  },
};
