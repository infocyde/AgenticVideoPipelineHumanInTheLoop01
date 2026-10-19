// Default theme: the dark red/amber broadcast look of the October 2026 "Global Threat Brief".
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { alpha, type Theme } from "./types";

const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] });
const mono = loadMono("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });
const inter = loadInter("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const red = "#ff2b3a";
const amber = "#ffb21e";

export const threatBrief: Theme = {
  id: "threat-brief",
  fonts: { display: anton.fontFamily, mono: mono.fontFamily, body: inter.fontFamily },
  fontsReady: () => Promise.all([anton.waitUntilDone(), mono.waitUntilDone(), inter.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: "#06080b",
    panel: "rgba(8, 11, 15, 0.78)",
    line: "rgba(255, 255, 255, 0.14)",
    text: "#f2efe9",
    dim: "rgba(242, 239, 233, 0.62)",
    accent: red,
    accentDeep: "#8a0d16",
    highlight: amber,
    onAccent: "#ffffff",
    ctaDone: "#3a3f47",
    tickerBg: "rgba(5,6,8,0.92)",
    noteBg: "rgba(0,0,0,0.55)",
  },
  map: {
    land: "#1a2028",
    landEdge: "#2c3540",
    graticule: "rgba(255,255,255,0.06)",
    highlightFill: alpha(amber, 0.38),
    highlightStroke: amber,
    hostileFill: alpha(red, 0.22),
    hostileStroke: alpha(red, 0.7),
    pin: red,
    pinStroke: "#ffffff",
    label: "#f2efe9",
    labelHalo: "rgba(0,0,0,0.85)",
  },
  backdrop: {
    filter: "grayscale(0.55) contrast(1.25) brightness(0.72) saturate(0.85)",
    tintOpacity: 0.35,
    tintBlend: "multiply",
    sideGradient:
      "linear-gradient(90deg, rgba(4,5,7,0.92) 0%, rgba(4,5,7,0.7) 38%, rgba(4,5,7,0.15) 70%, rgba(4,5,7,0.35) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(4,5,7,0.9) 0%, transparent 35%)",
  },
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(red, size >= 80 ? 0.6 : size >= 50 ? 0.55 : 0.45)}`,
    textShadow: "0 6px 30px rgba(0,0,0,0.85)",
    captionShadow: "0 4px 18px rgba(0,0,0,0.95), 0 0 2px #000",
    vignette: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)",
    grainOpacity: 0.09,
    scanlineOpacity: 0.5,
    glitchColors: [alpha(red, 0.55), "rgba(80,220,255,0.35)"],
    flash: "#ffffff",
    outroScrim: "radial-gradient(ellipse at center, rgba(6,8,11,0.25) 0%, rgba(6,8,11,0.85) 75%)",
  },
  copy: {
    tickerLabel: "THIS WEEK",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "TOP THREAT",
    locatorLabel: "LOCATOR",
    endCardNext: "WATCH NEXT",
  },
};
