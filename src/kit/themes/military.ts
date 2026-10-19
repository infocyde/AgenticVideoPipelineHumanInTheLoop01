// "Military": modern defense-tech tactical briefing. Sand text on olive-black, signal-amber HUD accent,
// pale phosphor-green readouts, gritty green-gray b-roll grade, light scanlines.
import { loadFont as loadBarlow } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadStencil } from "@remotion/google-fonts/BigShouldersStencil";
import { loadFont as loadShareMono } from "@remotion/google-fonts/ShareTechMono";
import { alpha, type Theme } from "./types";

// Display text has no explicit weight in the components, so only the heavy cut is loaded; 400 requests resolve to it.
const stencil = loadStencil("normal", { weights: ["800"], subsets: ["latin", "latin-ext"] });
// Share Tech Mono ships one weight and latin only; bold mono text is synthesized.
const mono = loadShareMono("normal", { weights: ["400"], subsets: ["latin"] });
const barlow = loadBarlow("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const amber = "#ff9f1c"; // signal amber
const phosphor = "#b4f5a2"; // pale phosphor green
const sand = "#e4dcc3";
const hostile = "#c8483c"; // muted red
const olive = "#0a0d08";

export const military: Theme = {
  id: "military",
  fonts: { display: stencil.fontFamily, mono: mono.fontFamily, body: barlow.fontFamily },
  fontsReady: () => Promise.all([stencil.waitUntilDone(), mono.waitUntilDone(), barlow.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: olive,
    panel: "rgba(14, 18, 11, 0.82)",
    line: alpha(sand, 0.16),
    text: sand,
    dim: alpha(sand, 0.62),
    accent: amber,
    accentDeep: "#4b5634", // olive tint: grades b-roll green-gray under multiply
    highlight: phosphor,
    onAccent: olive,
    ctaDone: "#8c8a72",
    tickerBg: "rgba(8, 11, 7, 0.93)",
    noteBg: "rgba(6, 8, 5, 0.62)",
  },
  map: {
    land: "#1b2314",
    landEdge: "#36412a",
    graticule: alpha(phosphor, 0.09),
    highlightFill: alpha(amber, 0.36),
    highlightStroke: amber,
    hostileFill: alpha(hostile, 0.26),
    hostileStroke: alpha(hostile, 0.8),
    pin: phosphor,
    pinStroke: olive,
    label: sand,
    labelHalo: "rgba(6,8,5,0.9)",
  },
  backdrop: {
    filter: "grayscale(0.3) contrast(1.12) brightness(1) saturate(1)",
    tintOpacity: 0.22,
    tintBlend: "multiply",
    sideGradient:
      "linear-gradient(90deg, rgba(8,11,7,0.86) 0%, rgba(8,11,7,0.55) 38%, rgba(20,26,14,0.06) 70%, rgba(8,11,7,0.2) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(8,11,7,0.82) 0%, transparent 30%)",
  },
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(amber, size >= 80 ? 0.45 : size >= 50 ? 0.4 : 0.35)}`,
    textShadow: "0 6px 30px rgba(4,6,3,0.9)",
    captionShadow: "0 4px 18px rgba(0,0,0,0.95), 0 0 2px #000",
    vignette: "radial-gradient(ellipse at center, transparent 58%, rgba(4,7,3,0.6) 100%)",
    grainOpacity: 0.1,
    scanlineOpacity: 0.32,
    glitchColors: [alpha(amber, 0.5), alpha(phosphor, 0.35)],
    flash: "#f3ecd6",
    outroScrim: "radial-gradient(ellipse at center, rgba(10,13,8,0.25) 0%, rgba(10,13,8,0.88) 75%)",
  },
  copy: {
    tickerLabel: "SITREP",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "HIGHEST IMPACT",
    locatorLabel: "GRID REF",
    endCardNext: "NEXT BRIEFING",
  },
};
