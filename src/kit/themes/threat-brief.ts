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
  // Light grade (user, 2026-10-29: "backgrounds much lighter, fade out minimal"): footage stays bright and readable; the
  // text carries its own shadow, so the side fade only needs to take the edge off behind it.
  backdrop: {
    filter: "grayscale(0.15) contrast(1.06) brightness(0.97) saturate(0.95)",
    tintOpacity: 0.12,
    tintBlend: "multiply",
    sideGradient: "linear-gradient(90deg, rgba(4,5,7,0.5) 0%, rgba(4,5,7,0.28) 32%, rgba(4,5,7,0) 58%)",
    bottomGradient: "linear-gradient(0deg, rgba(4,5,7,0.55) 0%, transparent 20%)",
    sideCleared: 0.2,
  },
  // Text sections get out of the way once their second visual comes up (user, 2026-10-29).
  textSectionAutoExit: true,
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(red, size >= 80 ? 0.6 : size >= 50 ? 0.55 : 0.45)}`,
    textShadow: "0 4px 18px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.85)",
    captionShadow: "0 4px 18px rgba(0,0,0,0.95), 0 0 2px #000",
    vignette: "radial-gradient(ellipse at center, transparent 70%, rgba(0,0,0,0.35) 100%)",
    grainOpacity: 0.06,
    scanlineOpacity: 0.25,
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
