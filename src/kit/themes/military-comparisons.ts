// "Military Comparisons": weapons-system spec briefing in the split layout (see ids.ts). Cool white on gunmetal,
// HUD-cyan readouts, signal-orange accent, steel-blue b-roll grade, fine scanlines.
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadSaira } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadTeko } from "@remotion/google-fonts/Teko";
import { alpha, type Theme } from "./types";

// Display text has no explicit weight in the components, so only one cut is loaded; 400 requests resolve to it.
const teko = loadTeko("normal", { weights: ["600"], subsets: ["latin", "latin-ext"] });
const mono = loadPlexMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const saira = loadSaira("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const orange = "#ff5a1f"; // signal orange
const cyan = "#5ce1e6"; // HUD cyan
const white = "#e3e9ec";
const hostile = "#e0453a";
const gunmetal = "#0a0f13";

export const militaryComparisons: Theme = {
  id: "military-comparisons",
  fonts: { display: teko.fontFamily, mono: mono.fontFamily, body: saira.fontFamily },
  fontsReady: () => Promise.all([teko.waitUntilDone(), mono.waitUntilDone(), saira.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: gunmetal,
    panel: "rgba(11, 17, 22, 0.86)",
    line: alpha(white, 0.16),
    text: white,
    dim: alpha(white, 0.6),
    accent: orange,
    accentDeep: "#2a4152", // steel-blue tint: grades b-roll cold under multiply
    highlight: cyan,
    onAccent: gunmetal,
    ctaDone: "#7d8a92",
    tickerBg: "rgba(7, 11, 14, 0.94)",
    noteBg: "rgba(5, 8, 10, 0.66)",
  },
  map: {
    land: "#15202a",
    landEdge: "#2c3f4d",
    graticule: alpha(cyan, 0.08),
    highlightFill: alpha(cyan, 0.28),
    highlightStroke: cyan,
    hostileFill: alpha(hostile, 0.26),
    hostileStroke: alpha(hostile, 0.85),
    pin: orange,
    pinStroke: gunmetal,
    label: white,
    labelHalo: "rgba(5,8,10,0.9)",
  },
  backdrop: {
    filter: "grayscale(0.4) contrast(1.12) brightness(1.06) saturate(1)",
    tintOpacity: 0.22,
    tintBlend: "multiply",
    sideGradient:
      "linear-gradient(90deg, rgba(7,11,14,0.86) 0%, rgba(7,11,14,0.52) 42%, rgba(7,11,14,0.08) 72%, rgba(7,11,14,0.16) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(7,11,14,0.75) 0%, transparent 30%)",
  },
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(orange, size >= 80 ? 0.42 : size >= 50 ? 0.38 : 0.32)}`,
    textShadow: "0 6px 30px rgba(3,5,7,0.9)",
    captionShadow: "0 4px 18px rgba(0,0,0,0.95), 0 0 2px #000",
    vignette: "radial-gradient(ellipse at center, transparent 62%, rgba(3,6,8,0.5) 100%)",
    grainOpacity: 0.08,
    scanlineOpacity: 0.22,
    glitchColors: [alpha(orange, 0.5), alpha(cyan, 0.4)],
    flash: "#eef4f6",
    outroScrim: "radial-gradient(ellipse at center, rgba(10,15,19,0.25) 0%, rgba(10,15,19,0.9) 75%)",
  },
  copy: {
    tickerLabel: "ARSENAL",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "TOP SYSTEM",
    locatorLabel: "AO / GRID",
    endCardNext: "NEXT FILE",
    panelLabel: "SPEC PANEL",
  },
};
