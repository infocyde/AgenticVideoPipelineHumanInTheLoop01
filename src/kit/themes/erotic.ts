// "Erotic": boudoir-editorial comparison sheet in the split layout (see ids.ts). Blush cream on wine-black,
// lipstick-crimson accent, champagne-gold readouts, warm low-key b-roll grade, soft grain, no scanlines.
// Mood comes from color and type only; nothing in the theme is sexual imagery.
import { loadFont as loadJosefin } from "@remotion/google-fonts/JosefinSans";
import { loadFont as loadJost } from "@remotion/google-fonts/Jost";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { alpha, type Theme } from "./types";

// Display text has no explicit weight in the components, so only one cut is loaded; 400 requests resolve to it.
const playfair = loadPlayfair("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });
// Tracked art-deco caps for labels, counters and readouts (the "mono" slot).
const josefin = loadJosefin("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const jost = loadJost("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const crimson = "#e3264f"; // lipstick red
const gold = "#ecc48f"; // champagne
const rose = "#ff7a9c";
const plum = "#a24bc4";
const cream = "#f7e9e4";
const wine = "#0f0508";

export const erotic: Theme = {
  id: "erotic",
  fonts: { display: playfair.fontFamily, mono: josefin.fontFamily, body: jost.fontFamily },
  fontsReady: () => Promise.all([playfair.waitUntilDone(), josefin.waitUntilDone(), jost.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: wine,
    panel: "rgba(24, 8, 14, 0.86)",
    line: alpha(rose, 0.2),
    text: cream,
    dim: alpha(cream, 0.62),
    accent: crimson,
    accentDeep: "#5c1026", // wine tint: grades b-roll warm and low-key under multiply
    highlight: gold,
    onAccent: "#fff5f3",
    ctaDone: "#6d4753",
    tickerBg: "rgba(14, 4, 8, 0.94)",
    noteBg: "rgba(14, 3, 8, 0.66)",
  },
  map: {
    land: "#1e0c13",
    landEdge: "#43202d",
    graticule: alpha(rose, 0.07),
    highlightFill: alpha(rose, 0.28),
    highlightStroke: rose,
    hostileFill: alpha(plum, 0.28),
    hostileStroke: alpha(plum, 0.85),
    pin: gold,
    pinStroke: wine,
    label: cream,
    labelHalo: "rgba(14,4,8,0.9)",
  },
  backdrop: {
    filter: "sepia(0.18) contrast(1.08) brightness(0.92) saturate(0.95)",
    tintOpacity: 0.32,
    tintBlend: "multiply",
    sideGradient:
      "linear-gradient(90deg, rgba(14,4,8,0.88) 0%, rgba(20,5,11,0.56) 42%, rgba(40,6,18,0.1) 72%, rgba(14,4,8,0.2) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(14,4,8,0.8) 0%, rgba(40,6,18,0.2) 22%, transparent 36%)",
  },
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size)}px ${alpha(crimson, size >= 80 ? 0.5 : size >= 50 ? 0.44 : 0.36)}`,
    textShadow: "0 6px 30px rgba(10,2,5,0.9)",
    captionShadow: `0 4px 18px rgba(0,0,0,0.95), 0 0 2px #000, 0 0 20px ${alpha(crimson, 0.18)}`,
    vignette: "radial-gradient(ellipse at center, transparent 55%, rgba(26,3,10,0.7) 100%)",
    grainOpacity: 0.07,
    scanlineOpacity: 0,
    glitchColors: [alpha(crimson, 0.5), alpha(gold, 0.4)],
    flash: "#ffdbe2",
    outroScrim: "radial-gradient(ellipse at center, rgba(15,5,8,0.25) 0%, rgba(15,5,8,0.9) 75%)",
  },
  copy: {
    tickerLabel: "AFTER HOURS",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "TOP PICK",
    locatorLabel: "LOCATION",
    endCardNext: "UP NEXT",
    panelLabel: "PROFILE",
  },
};
