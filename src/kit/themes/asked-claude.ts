// "Asked Claude": Claude, an AI, answering a question with its own opinion. Designed by Claude as the look it would
// choose for itself: a warm paper page instead of a broadcast screen, serif headings set in sentence case like a
// considered letter, one clay accent for the answer and one sage for the evidence, footage shown whole in framed prints
// beside the text (never full-bleed under it), and slow, quiet motion. Its own scenes live in src/kit/skins/asked-claude/.
// No Anthropic logo or wordmark anywhere: this is an independent channel's format, and the chrome says it's an AI's opinion.
import { loadFont as loadFigtree } from "@remotion/google-fonts/Figtree";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import { alpha, type Theme } from "./types";

// One display weight, so the shared scenes' weight-400 requests (Shorts, sources, credits) get it too.
const fraunces = loadFraunces("normal", { weights: ["600"], subsets: ["latin", "latin-ext"] });
const frauncesItalic = loadFraunces("italic", { weights: ["500"], subsets: ["latin", "latin-ext"] });
const figtree = loadFigtree("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const mono = loadJetBrains("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

/** The palette, shared with the skin. */
export const AC = {
  paper: "#f4efe5",
  paperDeep: "#ebe3d5",
  card: "#fbf8f2",
  ink: "#27221d",
  inkSoft: "rgba(39, 34, 29, 0.62)",
  rule: "rgba(39, 34, 29, 0.14)",
  clay: "#c2603d",
  clayDeep: "#9e4a2d",
  sage: "#3f6c5f",
  sun: "#e9b872",
};

export const askedClaude: Theme = {
  id: "asked-claude",
  fonts: { display: fraunces.fontFamily, mono: mono.fontFamily, body: figtree.fontFamily },
  fontsReady: () =>
    Promise.all([fraunces.waitUntilDone(), frauncesItalic.waitUntilDone(), figtree.waitUntilDone(), mono.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: AC.paper,
    panel: "rgba(251, 248, 242, 0.94)",
    line: AC.rule,
    text: AC.ink,
    dim: AC.inkSoft,
    accent: AC.clay,
    accentDeep: "#e6c3b1",
    highlight: AC.sage,
    onAccent: "#fff8ef",
    ctaDone: "#a99f92",
    tickerBg: "rgba(250, 246, 238, 0.96)",
    noteBg: "rgba(251, 248, 242, 0.9)",
  },
  map: {
    land: "#e2dacb",
    landEdge: "#cbc0ad",
    graticule: alpha(AC.ink, 0.05),
    highlightFill: alpha(AC.sage, 0.3),
    highlightStroke: AC.sage,
    hostileFill: alpha(AC.clay, 0.24),
    hostileStroke: alpha(AC.clay, 0.75),
    pin: AC.clay,
    pinStroke: "#fff8ef",
    label: AC.ink,
    labelHalo: "rgba(251,248,242,0.92)",
  },
  series: [AC.clay, AC.sage, "#5b6fa8", AC.sun, "#8a5a9e", "#4f8fa0", "#a8794f", "#7a8a3e"],
  backdrop: {
    // Used only by the shared scenes (Shorts): footage nearly as shot, paper washes where text sits over it.
    filter: "saturate(0.92) contrast(1.02)",
    tintOpacity: 0.08,
    tintBlend: "soft-light",
    sideGradient:
      "linear-gradient(90deg, rgba(244,239,229,0.96) 0%, rgba(244,239,229,0.82) 40%, rgba(244,239,229,0.1) 72%, rgba(244,239,229,0.3) 100%)",
    bottomGradient: "linear-gradient(0deg, rgba(244,239,229,0.82) 0%, transparent 26%)",
    sideCleared: 0,
    coldOpenSide: 0.5,
    clearedScrim:
      "radial-gradient(ellipse 760px 400px at 0% 0%, rgba(244,239,229,0.94) 0%, rgba(244,239,229,0.78) 50%, transparent 100%), linear-gradient(180deg, rgba(244,239,229,0.8) 0%, rgba(244,239,229,0.5) 6%, transparent 13%)",
  },
  textSectionAutoExit: true,
  effects: {
    accentGlow: () => "none",
    textShadow: "0 2px 12px rgba(251,248,242,0.7)",
    captionShadow: "0 0 3px #fbf8f2, 0 2px 10px rgba(251,248,242,0.95)",
    vignette: "radial-gradient(ellipse at center, transparent 68%, rgba(39,34,29,0.10) 100%)",
    grainOpacity: 0.035,
    scanlineOpacity: 0,
    glitchColors: [alpha(AC.clay, 0.35), alpha(AC.sage, 0.3)],
    flash: "#fffaf2",
    outroScrim: "radial-gradient(ellipse at center, rgba(244,239,229,0.3) 0%, rgba(244,239,229,0.92) 75%)",
  },
  copy: {
    tickerLabel: "ASKED CLAUDE",
    ctaLabel: "Subscribe",
    ctaDoneLabel: "Subscribed",
    topEmphasisLabel: "WHERE I LAND",
    locatorLabel: "WHERE",
    endCardNext: "NEXT QUESTION",
  },
};
