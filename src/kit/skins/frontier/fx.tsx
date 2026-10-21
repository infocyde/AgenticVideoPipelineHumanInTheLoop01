// Frontier's motion vocabulary: the living field, decoding text, counting numbers, line reveals, the light-sweep cut,
// glass panels with an iridescent edge. Every frame is a pure function of the frame number (Remotion renders in
// parallel), so all "randomness" is hashed from constants and the frame.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, useTheme } from "../../context";
import { FRONTIER } from "../../themes/frontier";

export const F = FRONTIER;
export const ease = Easing.out(Easing.cubic);
export const easeIO = Easing.inOut(Easing.cubic);
/** 0 before `t0`, eased 0..1 over `dur` frames. */
export const prog = (frame: number, t0: number, dur: number, e = ease) => interpolate(frame, [t0, t0 + dur], [0, 1], { ...clamp, easing: e });
/** Deterministic 0..1 hash. */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const pad2 = (n: number) => String(n).padStart(2, "0");

// ------------------------------------------------------------------------------------------------ the living field

/**
 * The background of every Frontier scene: ink, slowly drifting aurora, a fine dot lattice and (optionally) a ripple
 * of brighter dots running out from a point, for key hits. `ripple` = frames since the ripple started.
 */
export const Field: React.FC<{ ripple?: number; cx?: string; cy?: string; dots?: number; aurora?: number }> = ({
  ripple,
  cx = "50%",
  cy = "50%",
  dots = 1,
  aurora = 1,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const a = frame / 90;
  const blob = (x: number, y: number, r: number, color: string, k: number) =>
    `radial-gradient(circle at ${x + Math.sin(a * k) * 6}% ${y + Math.cos(a * k * 0.8) * 5}%, ${color} 0%, transparent ${r}%)`;
  const r = ripple === undefined ? -1 : ripple * (width / 28);
  const rippleOn = ripple !== undefined && ripple >= 0 && ripple < 48;
  const lattice = (c: string, size: number) => ({
    backgroundImage: `radial-gradient(circle, ${c} 1.3px, transparent 1.7px)`,
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: "center",
  });
  return (
    <AbsoluteFill style={{ background: F.ink, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          opacity: aurora,
          background: [
            blob(78, 18, 46, "rgba(139,107,255,0.30)", 1),
            blob(14, 88, 44, "rgba(61,240,255,0.16)", 1.3),
            blob(60, 96, 38, "rgba(255,79,216,0.12)", 0.7),
          ].join(","),
        }}
      />
      <AbsoluteFill style={{ ...lattice("rgba(170,186,255,0.17)", 34), opacity: dots }} />
      {rippleOn && (
        <AbsoluteFill
          style={{
            ...lattice(F.cyan, 34),
            opacity: interpolate(ripple!, [0, 6, 48], [0, 1, 0], clamp),
            WebkitMaskImage: `radial-gradient(circle at ${cx} ${cy}, transparent ${Math.max(0, r - 160)}px, #000 ${r - 30}px, #000 ${r}px, transparent ${r + 40}px)`,
            maskImage: `radial-gradient(circle at ${cx} ${cy}, transparent ${Math.max(0, r - 160)}px, #000 ${r - 30}px, #000 ${r}px, transparent ${r + 40}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------------------------------------ text

const GLYPHS = "01<>/\\#%&*+=?ABCDEFGHJKLMNPRSTUVXYZ▖▘▝▗";

/**
 * Decoding text: each character arrives as a cycling glyph and resolves in turn, left to right.
 * `since` = frames since it starts; `per` = frames between characters; `scramble` = frames a glyph cycles first.
 * Best on mono type (the glyphs don't change the line's width).
 */
export const Decode: React.FC<{ text: string; since: number; per?: number; scramble?: number; color?: string; glyphColor?: string; seed?: number; caret?: boolean }> = ({
  text,
  since,
  per = 0.7,
  scramble = 7,
  color,
  glyphColor = F.cyan,
  seed = 1,
  caret = false,
}) => {
  if (since < 0) return null;
  const chars = [...text];
  const shown = Math.min(chars.length, Math.floor(since / per) + 1);
  const done = since >= (chars.length - 1) * per + scramble;
  return (
    <span style={{ color, whiteSpace: "pre-wrap" }}>
      {chars.slice(0, shown).map((ch, i) => {
        const resolved = since >= i * per + scramble || ch === " ";
        if (resolved) return <React.Fragment key={i}>{ch}</React.Fragment>;
        const g = GLYPHS[Math.floor(hash(seed * 97 + i * 13.7 + Math.floor(since / 2) * 3.1) * GLYPHS.length)];
        return (
          <span key={i} style={{ color: glyphColor, opacity: 0.85 }}>
            {g}
          </span>
        );
      })}
      {caret && !done && <span style={{ color: glyphColor }}>▍</span>}
    </span>
  );
};

/** A value counting up to itself: the first number in `value` runs from 0, prefix/suffix and formatting kept. Years and plain codes decode instead (see `counts`). */
export const countUp = (value: string, p: number) => {
  const m = value.match(/\d[\d,]*(\.\d+)?/);
  if (!m || m.index === undefined) return value;
  const raw = m[0];
  const n = parseFloat(raw.replace(/,/g, ""));
  const dec = (raw.split(".")[1] ?? "").length;
  const v = n * p;
  const s = raw.includes(",") ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
  return value.slice(0, m.index) + s + value.slice(m.index + raw.length);
};
/** Whether a value should count (a quantity) rather than decode (a year, a model name like "H100", no number at all). */
export const counts = (value: string) => {
  const m = value.match(/\d[\d,]*(\.\d+)?/);
  if (!m) return false;
  const n = parseFloat(m[0].replace(/,/g, ""));
  if (/^\d{4}$/.test(m[0]) && n >= 1900 && n <= 2100) return false;
  return !/[A-Za-z]\d/.test(value); // "H100", "M4", "GPT-5" read as names
};

/** Gradient-filled text (iridescent by default). */
export const GradientText: React.FC<{ children: React.ReactNode; gradient?: string; shift?: number; style?: React.CSSProperties }> = ({
  children,
  gradient = F.iris,
  shift = 0,
  style,
}) => (
  <span
    style={{
      backgroundImage: gradient,
      backgroundSize: "200% 100%",
      backgroundPosition: `${shift}% 0`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      ...style,
    }}
  >
    {children}
  </span>
);

/** Lines that rise into place one after another behind a mask (the keynote reveal). `since` = frames since start. */
export const RiseLines: React.FC<{ lines: string[]; since: number; size: number; lineHeight?: number; stagger?: number; style?: React.CSSProperties; render?: (line: string, i: number) => React.ReactNode }> = ({
  lines,
  since,
  size,
  lineHeight = 1.04,
  stagger = 3,
  style,
  render,
}) => (
  <div style={{ fontSize: size, lineHeight, ...style }}>
    {lines.map((l, i) => {
      const p = prog(since, i * stagger, 14, Easing.out(Easing.exp));
      return (
        <div key={i} style={{ overflow: "hidden", paddingBottom: size * 0.08, marginBottom: -size * 0.08 }}>
          <div style={{ transform: `translateY(${(1 - p) * 105}%)`, opacity: since < i * stagger ? 0 : 1, whiteSpace: "nowrap" }}>{render ? render(l, i) : l}</div>
        </div>
      );
    })}
  </div>
);

/** "Focus pull": blur and oversize to sharp, for big words landing. Returns a style for the element. */
export const focusPull = (since: number, from = 1.3, blur = 26): React.CSSProperties => {
  const p = prog(since, 0, 10, Easing.out(Easing.exp));
  if (since < 0) return { opacity: 0 };
  return { opacity: Math.min(1, since / 3), transform: `scale(${from - (from - 1) * p})`, filter: p < 1 ? `blur(${(1 - p) * blur}px)` : undefined };
};

// ------------------------------------------------------------------------------------------------ surfaces

/** Glass panel with a 1.5px iridescent edge (or a plain hairline with `edge="line"`). */
export const Glass: React.FC<{ children?: React.ReactNode; radius?: number; edge?: "iris" | "line" | "none"; glow?: number; bg?: string; style?: React.CSSProperties; blur?: boolean }> = ({
  children,
  radius = 22,
  edge = "iris",
  glow = 0,
  bg = F.glass,
  style,
  blur = true,
}) => {
  const { colors } = useTheme();
  return (
    <div
      style={{
        position: "relative",
        borderRadius: radius,
        padding: edge === "iris" ? 1.5 : 0,
        background: edge === "iris" ? F.irisSoft : undefined,
        border: edge === "line" ? `1px solid ${colors.line}` : undefined,
        boxShadow: `0 24px 60px rgba(0,0,0,0.45)${glow ? `, 0 0 ${40 * glow}px rgba(61,240,255,${0.28 * glow})` : ""}`,
        ...style,
      }}
    >
      <div
        style={{
          borderRadius: radius - (edge === "iris" ? 1.5 : 0),
          background: bg,
          backdropFilter: blur ? "blur(18px) saturate(1.3)" : undefined,
          height: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Small mono chip: a status dot and decoded uppercase text. */
export const Chip: React.FC<{ text: string; since: number; size?: number; color?: string; dot?: string; pulse?: boolean }> = ({ text, since, size = 24, color, dot = F.cyan, pulse = true }) => {
  const frame = useCurrentFrame();
  const { fonts, colors } = useTheme();
  const p = prog(since, 0, 8);
  if (since < 0) return null;
  const beat = pulse ? 0.55 + 0.45 * ((Math.sin(frame / 6) + 1) / 2) : 1;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.5,
        padding: `${size * 0.32}px ${size * 0.7}px`,
        borderRadius: 999,
        border: `1px solid ${colors.line}`,
        background: "rgba(10,12,22,0.66)",
        opacity: p,
        transform: `translateY(${(1 - p) * 10}px)`,
        fontFamily: fonts.mono,
        fontWeight: F.weights.monoBold,
        fontSize: size,
        letterSpacing: size * 0.16,
        color: color ?? colors.text,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: 999, background: dot, opacity: beat, boxShadow: `0 0 ${size * 0.6}px ${dot}`, flexShrink: 0 }} />
      <Decode text={text} since={since} per={0.6} scramble={6} />
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ transitions

/** Frames a light-sweep cut takes. */
export const SWEEP = 10;

/**
 * The cut: a bright blade crosses left to right and reveals the new picture behind it (ahead of the blade the frame
 * is still the dark lattice). Place it at the start of the new picture's Sequence, over it.
 */
export const Sweep: React.FC<{ dir?: 1 | -1 }> = ({ dir = 1 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  if (frame >= SWEEP) return null;
  const p = interpolate(frame, [0, SWEEP - 1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const x = dir === 1 ? -60 + p * (width + 120) : width + 60 - p * (width + 120);
  const veil: React.CSSProperties = dir === 1 ? { left: x, right: 0 } : { left: 0, width: x };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, ...veil, background: F.ink }}>
        <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle, rgba(170,186,255,0.2) 1.3px, transparent 1.7px)", backgroundSize: "34px 34px" }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: x - (dir === 1 ? 220 : 0),
          width: 220,
          background: `linear-gradient(${dir === 1 ? 90 : 270}deg, transparent, rgba(139,107,255,0.25) 60%, rgba(61,240,255,0.55))`,
          mixBlendMode: "screen",
        }}
      />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: x - 2, width: 4, background: "#f2fdff", boxShadow: `0 0 24px 6px ${F.cyan}, 0 0 80px 20px rgba(139,107,255,0.6)` }} />
    </AbsoluteFill>
  );
};

/** A brief bright bloom for a hard hit (outro lines, the title). `since` = frames since the hit. */
export const Bloom: React.FC<{ since: number; strength?: number }> = ({ since, strength = 0.35 }) => {
  if (since < 0 || since > 10) return null;
  return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(circle at 50% 50%, rgba(61,240,255,${strength * (1 - since / 10)}) 0%, transparent 60%)`, mixBlendMode: "screen" }} />;
};
