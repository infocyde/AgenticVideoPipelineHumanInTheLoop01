// "Dispatch": phone-first field dispatch for long Shorts (1–2.5 min, vertical). Signal yellow and ice blue on a cool
// ink black, tall condensed type that fills a narrow frame, footage shown as shot (whole, in cards, ungraded). Built
// for the long-Short layout (formats/LongShort.tsx: chapter rail, framed media card, headline above, stat below), and
// works on 16:9 episodes too with the shared overlay scenes.
import { loadFont as loadInstrument } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadRedHatMono } from "@remotion/google-fonts/RedHatMono";
import { loadFont as loadSofiaCondensed } from "@remotion/google-fonts/SofiaSansCondensed";
import { alpha, type Theme } from "./types";

// Only the heavy weights of the display face are loaded, so every display text (the shared scenes ask for 400) gets them.
const sofia = loadSofiaCondensed("normal", { weights: ["800", "900"], subsets: ["latin", "latin-ext"] });
const mono = loadRedHatMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const instrument = loadInstrument("normal", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] });

const signal = "#ffd60a";
const ice = "#7cd4ff";
const ink = "#0a0d12";
const text = "#f2f4f7";

export const dispatch: Theme = {
  id: "dispatch",
  fonts: { display: sofia.fontFamily, mono: mono.fontFamily, body: instrument.fontFamily },
  fontsReady: () => Promise.all([sofia.waitUntilDone(), mono.waitUntilDone(), instrument.waitUntilDone()]).then(() => undefined),
  colors: {
    bg: ink,
    panel: "rgba(14, 18, 25, 0.92)",
    line: alpha(text, 0.14),
    text,
    dim: "rgba(242, 244, 247, 0.6)",
    accent: signal,
    accentDeep: "#3a3206",
    highlight: ice,
    onAccent: "#0a0d12",
    ctaDone: "#2a2f38",
    tickerBg: "rgba(8, 10, 14, 0.95)",
    noteBg: "rgba(0, 0, 0, 0.6)",
  },
  map: {
    land: "#161c26",
    landEdge: "#2a3442",
    graticule: alpha(ice, 0.06),
    highlightFill: alpha(ice, 0.3),
    highlightStroke: ice,
    hostileFill: alpha(signal, 0.26),
    hostileStroke: alpha(signal, 0.85),
    pin: signal,
    pinStroke: ink,
    label: text,
    labelHalo: "rgba(10,13,18,0.9)",
  },
  backdrop: {
    // Footage plays as shot: no grade or tint, light gradients only where text sits over it (16:9 overlay scenes).
    filter: "none",
    tintOpacity: 0,
    tintBlend: "multiply",
    sideGradient: "linear-gradient(90deg, rgba(10,13,18,0.5) 0%, rgba(10,13,18,0.2) 34%, transparent 58%)",
    sideCleared: 0.3,
    bottomGradient: "linear-gradient(0deg, rgba(10,13,18,0.55) 0%, transparent 26%)",
    coldOpenSide: 0.5,
  },
  textSectionAutoExit: true,
  effects: {
    accentGlow: (size) => `0 0 ${Math.round(size / 2)}px ${alpha(signal, 0.35)}`,
    textShadow: "0 4px 22px rgba(0,0,0,0.75)",
    captionShadow: "0 3px 14px rgba(0,0,0,0.9), 0 0 2px #000",
    vignette: "radial-gradient(ellipse at center, transparent 72%, rgba(0,0,0,0.22) 100%)",
    grainOpacity: 0.05,
    scanlineOpacity: 0,
    glitchColors: [alpha(signal, 0.5), alpha(ice, 0.45)],
    flash: "#fff6c8",
    outroScrim: "radial-gradient(ellipse at center, rgba(10,13,18,0.3) 0%, rgba(10,13,18,0.9) 75%)",
  },
  copy: {
    tickerLabel: "DISPATCH",
    ctaLabel: "SUBSCRIBE",
    ctaDoneLabel: "SUBSCRIBED ✓",
    topEmphasisLabel: "TOP STORY",
    locatorLabel: "LOCATION",
    endCardNext: "NEXT DISPATCH",
  },
};
