// What a theme controls. Components read these through useTheme(); nothing else hard-codes look or wording.
export type Theme = {
  id: string;
  fonts: { display: string; mono: string; body: string };
  /** Resolves once every font of the theme has loaded (used before measuring text). */
  fontsReady: () => Promise<void>;
  colors: {
    bg: string;
    panel: string;
    line: string;
    text: string;
    dim: string;
    accent: string; // slams, pins, bars (reference: red)
    accentDeep: string; // backdrop tint
    highlight: string; // stat values, region, active caption word (reference: amber)
    onAccent: string; // text on accent fills
    ctaDone: string; // pressed subscribe button
    tickerBg: string;
    noteBg: string;
  };
  map: {
    land: string;
    landEdge: string;
    graticule: string;
    highlightFill: string;
    highlightStroke: string;
    hostileFill: string;
    hostileStroke: string;
    pin: string;
    pinStroke: string;
    label: string;
    labelHalo: string;
  };
  /** Treatment of b-roll under the text. */
  backdrop: {
    filter: string;
    tintOpacity: number;
    tintBlend: "multiply" | "screen" | "overlay" | "soft-light";
    sideGradient: string;
    bottomGradient: string;
  };
  /** Text shadows and glows, as CSS values. */
  effects: {
    /** text-shadow glow in the accent color; `size` is the blur radius in px. */
    accentGlow: (size: number) => string;
    textShadow: string;
    captionShadow: string;
    vignette: string;
    grainOpacity: number;
    scanlineOpacity: number;
    glitchColors: [string, string];
    flash: string;
    outroScrim: string;
  };
  /** Default wording; episodes can override most of these. */
  copy: {
    tickerLabel: string;
    ctaLabel: string;
    ctaDoneLabel: string;
    topEmphasisLabel: string;
    locatorLabel: string;
    endCardNext: string;
    /** Split layout: counter over the stat rows when they run to more than one panel (default "PANEL"). */
    panelLabel?: string;
  };
};

/** "#ff2b3a" + 0.5 -> "rgba(255,43,58,0.5)" */
export const alpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
