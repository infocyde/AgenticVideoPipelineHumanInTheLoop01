// Demo theme: light paper background, blue accent, different fonts. Exists to prove nothing is hard-coded.
import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { alpha, type Theme } from "./types";

const oswald = loadOswald("normal", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] });
const plex = loadPlexMono("normal", { weights: ["400", "600"], subsets: ["latin", "latin-ext"] });
const dm = loadDMSans("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const blue = "#1f5eff";
const orange = "#e8590c";
const ink = "#14171f";

export const cleanLight: Theme = {
  id: "clean-light",
  fonts: { display: oswald.fontFamily, mono: plex.fontFamily, body: dm.fontFamily },
  fontsReady: () => Promise.all([oswald.waitUntilDone(), plex.waitUntilDone(), dm.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: "#f4f1ea",
    panel: "rgba(255, 255, 255, 0.86)",
    line: "rgba(20, 23, 31, 0.14)",
    text: ink,
    dim: "rgba(20, 23, 31, 0.58)",
    accent: blue,
    accentDeep: "#9db6ff",
    highlight: orange,
    onAccent: "#ffffff",
    ctaDone: "#9aa1ad",
    tickerBg: "rgba(255,255,255,0.94)",
    noteBg: "rgba(255,255,255,0.8)",
  },
  map: {
    land: "#e2ddd2",
    landEdge: "#c9c2b4",
    graticule: "rgba(20,23,31,0.06)",
    highlightFill: alpha(orange, 0.3),
    highlightStroke: orange,
    hostileFill: alpha(blue, 0.18),
    hostileStroke: alpha(blue, 0.6),
    pin: blue,
    pinStroke: "#ffffff",
    label: ink,
    labelHalo: "rgba(255,255,255,0.9)",
  },
  backdrop: {
    filter: "grayscale(0.25) contrast(1.05) brightness(1.04) saturate(0.9)",
    tintOpacity: 0.25,
    tintBlend: "soft-light",
    sideGradient:
      "linear-gradient(90deg, rgba(244,241,234,0.96) 0%, rgba(244,241,234,0.82) 40%, rgba(244,241,234,0.1) 72%, rgba(244,241,234,0.3) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(244,241,234,0.92) 0%, transparent 35%)",
  },
  effects: {
    accentGlow: () => "none",
    textShadow: "0 2px 12px rgba(255,255,255,0.7)",
    captionShadow: "0 0 3px #fff, 0 2px 10px rgba(255,255,255,0.95)",
    vignette: "radial-gradient(ellipse at center, transparent 65%, rgba(20,23,31,0.12) 100%)",
    grainOpacity: 0.05,
    scanlineOpacity: 0,
    glitchColors: [alpha(blue, 0.45), alpha(orange, 0.35)],
    flash: "#ffffff",
    outroScrim: "radial-gradient(ellipse at center, rgba(244,241,234,0.3) 0%, rgba(244,241,234,0.9) 75%)",
  },
  copy: {
    tickerLabel: "IN BRIEF",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "TOP STORY",
    locatorLabel: "WHERE",
    endCardNext: "UP NEXT",
  },
};
