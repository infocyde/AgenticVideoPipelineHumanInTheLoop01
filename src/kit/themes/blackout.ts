// "Blackout": dark tech dystopia. Crimson alarm red and phosphor-green terminal data on a cold near-black field,
// drained, hard-contrast footage under a dark red cast, heavy scanlines, grain and glitch. For AI, cyber and
// surveillance stories told as a warning rather than a product launch.
import { loadFont as loadBigShoulders } from "@remotion/google-fonts/BigShoulders";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadSaira } from "@remotion/google-fonts/Saira";
import { alpha, type Theme } from "./types";

// Big Shoulders (condensed, industrial) fits the layouts sized for Anton and Bebas; IBM Plex Mono for the
// terminal labels; Saira (squared, 800) for captions and body.
const shoulders = loadBigShoulders("normal", { weights: ["800", "900"], subsets: ["latin", "latin-ext"] });
const mono = loadPlexMono("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });
const saira = loadSaira("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const crimson = "#ff1f3d";
const phosphor = "#5cff8f";
const text = "#e6ebe8";

export const blackout: Theme = {
  id: "blackout",
  fonts: { display: shoulders.fontFamily, mono: mono.fontFamily, body: saira.fontFamily },
  fontsReady: () => Promise.all([shoulders.waitUntilDone(), mono.waitUntilDone(), saira.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: "#030506",
    panel: "rgba(4, 8, 8, 0.82)",
    line: alpha(phosphor, 0.18),
    text,
    dim: "rgba(230, 235, 232, 0.58)",
    accent: crimson,
    accentDeep: "#2a0309",
    highlight: phosphor,
    onAccent: "#ffffff",
    ctaDone: "#1d2624",
    tickerBg: "rgba(2, 4, 4, 0.95)",
    noteBg: "rgba(0, 0, 0, 0.62)",
  },
  map: {
    land: "#0b1110",
    landEdge: "#1c2a27",
    graticule: alpha(phosphor, 0.07),
    highlightFill: alpha(phosphor, 0.26),
    highlightStroke: phosphor,
    hostileFill: alpha(crimson, 0.26),
    hostileStroke: alpha(crimson, 0.8),
    pin: crimson,
    pinStroke: "#ffffff",
    label: text,
    labelHalo: "rgba(2,4,4,0.9)",
  },
  backdrop: {
    filter: "grayscale(0.82) contrast(1.4) brightness(0.58) saturate(0.9)",
    tintOpacity: 0.5,
    tintBlend: "multiply",
    sideGradient:
      "linear-gradient(90deg, rgba(2,4,4,0.95) 0%, rgba(3,6,6,0.76) 38%, rgba(20,2,6,0.18) 70%, rgba(2,4,4,0.45) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(2,4,4,0.94) 0%, rgba(24,2,6,0.22) 22%, transparent 40%)",
  },
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(crimson, size >= 80 ? 0.65 : size >= 50 ? 0.55 : 0.45)}, 0 0 ${Math.round(size / 3)}px ${alpha(crimson, 0.45)}`,
    textShadow: "0 6px 30px rgba(0,0,0,0.92)",
    captionShadow: `0 4px 18px rgba(0,0,0,0.95), 0 0 2px #000, 0 0 20px ${alpha(phosphor, 0.18)}`,
    vignette: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.85) 100%)",
    grainOpacity: 0.14,
    scanlineOpacity: 0.75,
    glitchColors: [alpha(crimson, 0.6), alpha(phosphor, 0.4)],
    flash: "#ffd6dc",
    outroScrim: "radial-gradient(ellipse at center, rgba(3,5,6,0.25) 0%, rgba(3,5,6,0.9) 75%)",
  },
  copy: {
    tickerLabel: "SIGNAL LOST",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "CRITICAL",
    locatorLabel: "TRACE",
    endCardNext: "NEXT TRANSMISSION",
  },
};
