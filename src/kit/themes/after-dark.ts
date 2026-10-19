// "AI After Dark": dystopian neon-noir. Hot magenta and electric cyan on violet-black, heavy scanlines and glitch.
// Suggestive mood through color and texture only; nothing in the theme is sexual imagery.
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadSpaceMono } from "@remotion/google-fonts/SpaceMono";
import { alpha, type Theme } from "./types";

const bebas = loadBebas("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] });
const mono = loadSpaceMono("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });
const sora = loadSora("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const magenta = "#ff2bd6";
const cyan = "#3df2ff";
const violet = "#8b5cff";

export const afterDark: Theme = {
  id: "after-dark",
  fonts: { display: bebas.fontFamily, mono: mono.fontFamily, body: sora.fontFamily },
  fontsReady: () => Promise.all([bebas.waitUntilDone(), mono.waitUntilDone(), sora.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: "#07040b",
    panel: "rgba(14, 6, 22, 0.8)",
    line: alpha(magenta, 0.22),
    text: "#f6eefa",
    dim: "rgba(246, 238, 250, 0.6)",
    accent: magenta,
    accentDeep: "#4a0a52",
    highlight: cyan,
    onAccent: "#ffffff",
    ctaDone: "#3b2b48",
    tickerBg: "rgba(9, 4, 14, 0.94)",
    noteBg: "rgba(10, 2, 16, 0.6)",
  },
  map: {
    land: "#150c1f",
    landEdge: "#2c1840",
    graticule: alpha(violet, 0.09),
    highlightFill: alpha(magenta, 0.32),
    highlightStroke: magenta,
    hostileFill: alpha(violet, 0.28),
    hostileStroke: alpha(violet, 0.8),
    pin: cyan,
    pinStroke: "#ffffff",
    label: "#f6eefa",
    labelHalo: "rgba(7,4,11,0.9)",
  },
  backdrop: {
    filter: "grayscale(0.35) contrast(1.3) brightness(0.62) saturate(1.15)",
    tintOpacity: 0.55,
    tintBlend: "multiply",
    sideGradient:
      "linear-gradient(90deg, rgba(7,4,11,0.94) 0%, rgba(12,4,20,0.74) 38%, rgba(60,8,70,0.18) 70%, rgba(7,4,11,0.45) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(7,4,11,0.92) 0%, rgba(40,6,48,0.25) 22%, transparent 40%)",
  },
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(magenta, size >= 80 ? 0.7 : size >= 50 ? 0.6 : 0.5)}, 0 0 ${Math.round(size / 3)}px ${alpha(magenta, 0.5)}`,
    textShadow: "0 6px 30px rgba(7,4,11,0.9)",
    captionShadow: `0 4px 18px rgba(0,0,0,0.95), 0 0 2px #000, 0 0 22px ${alpha(magenta, 0.25)}`,
    vignette: "radial-gradient(ellipse at center, transparent 50%, rgba(20,0,26,0.8) 100%)",
    grainOpacity: 0.11,
    scanlineOpacity: 0.6,
    glitchColors: [alpha(magenta, 0.6), alpha(cyan, 0.45)],
    flash: "#ffc2f3",
    outroScrim: "radial-gradient(ellipse at center, rgba(7,4,11,0.2) 0%, rgba(7,4,11,0.88) 75%)",
  },
  copy: {
    tickerLabel: "AFTER DARK",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "HIGHEST HARM",
    locatorLabel: "SIGNAL",
    endCardNext: "WATCH NEXT",
  },
};
