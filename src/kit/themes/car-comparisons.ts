// "Car Comparisons": new-model buyer's guide in the split layout (see ids.ts): trims, the nearest rivals, and whether one
// is a strong alternative worth a look. Showroom navy with white type, signal yellow for the one "worth a look" color
// (slams, brackets, the winner), electric-blue readouts, warning red only for cost deltas. Car paint is the hero, so
// the footage is shown in full color with no grade. Every trim keeps one `series` color for the whole video (segment
// `chip`, infographics' --series-N). These videos go to another channel: config.yaml upload.blocked_themes.
import { loadFont as loadBarlow } from "@remotion/google-fonts/Barlow";
import { loadFont as loadBarlowCondensed } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadRobotoMono } from "@remotion/google-fonts/RobotoMono";
import { alpha, type Theme } from "./types";

// Display text has no explicit weight in the components, so only one cut is loaded; 400 requests resolve to it.
const display = loadBarlowCondensed("normal", { weights: ["800"], subsets: ["latin", "latin-ext"] });
const mono = loadRobotoMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const body = loadBarlow("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });

const yellow = "#ffc629"; // signal yellow: winner, VS, "worth a look"
const blue = "#4da3ff"; // electric blue readouts
const red = "#ff4d4f"; // costs more, cautions
const white = "#f4f6fa";
const navy = "#0b1526"; // showroom navy

export const carComparisons: Theme = {
  id: "car-comparisons",
  fonts: { display: display.fontFamily, mono: mono.fontFamily, body: body.fontFamily },
  fontsReady: () => Promise.all([display.waitUntilDone(), mono.waitUntilDone(), body.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: navy,
    panel: "rgba(16, 29, 51, 0.88)",
    line: alpha(white, 0.14),
    text: white,
    dim: alpha(white, 0.62),
    accent: yellow,
    accentDeep: "#13284a", // navy tint, barely used: the grade stays off
    highlight: blue,
    onAccent: navy,
    ctaDone: "#56637a",
    tickerBg: "rgba(8, 15, 28, 0.94)",
    noteBg: "rgba(6, 12, 22, 0.7)",
  },
  // Trim chips, in the order the dealer channels use them: blue, red, green, purple, orange, teal, silver, gold.
  series: ["#3d8bff", "#ff5a5f", "#2ecc71", "#a970ff", "#ff9f1c", "#1fc8c8", "#c3cad6", "#e8c547"],
  map: {
    land: "#16243d",
    landEdge: "#2a3d5e",
    graticule: alpha(blue, 0.08),
    highlightFill: alpha(blue, 0.3),
    highlightStroke: blue,
    hostileFill: alpha(red, 0.24),
    hostileStroke: red,
    pin: yellow,
    pinStroke: navy,
    label: white,
    labelHalo: "rgba(6,12,22,0.9)",
  },
  // No grade: paint colors are the point. The gradients only matter in overlay scenes (cold open, text sections).
  backdrop: {
    filter: "saturate(1.04) contrast(1.02)",
    tintOpacity: 0.06,
    tintBlend: "soft-light",
    sideGradient:
      "linear-gradient(90deg, rgba(8,15,28,0.72) 0%, rgba(8,15,28,0.42) 40%, rgba(8,15,28,0.04) 64%, rgba(8,15,28,0.08) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(8,15,28,0.62) 0%, transparent 26%)",
    sideCleared: 0.2,
  },
  textSectionAutoExit: true,
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size * 0.6)}px ${alpha(yellow, size >= 80 ? 0.32 : 0.26)}, 0 4px 0 rgba(4,9,18,0.55)`,
    textShadow: "0 4px 24px rgba(4,9,18,0.85)",
    captionShadow: "0 3px 14px rgba(0,0,0,0.92), 0 0 2px #000",
    vignette: "radial-gradient(ellipse at center, transparent 68%, rgba(4,9,18,0.32) 100%)",
    grainOpacity: 0.03,
    scanlineOpacity: 0,
    glitchColors: [alpha(yellow, 0.45), alpha(blue, 0.4)],
    flash: "#ffffff",
    outroScrim: "radial-gradient(ellipse at center, rgba(11,21,38,0.25) 0%, rgba(11,21,38,0.9) 75%)",
  },
  copy: {
    tickerLabel: "LINEUP",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "WORTH A LOOK",
    locatorLabel: "BUILT IN",
    endCardNext: "NEXT MATCHUP",
    panelLabel: "SPECS",
    frameLabel: "MODEL",
  },
};
