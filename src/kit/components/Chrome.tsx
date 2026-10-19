// Persistent broadcast "chrome": film grain, scanlines, vignette, glitch cuts, top bar, ticker, captions.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, useEpisode, useTheme } from "../context";
import { FPS, HEIGHT } from "../lib/timing";
import { SPLIT } from "../scenes/SplitSegment";
import { layoutOf } from "../themes";

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const { effects } = useTheme();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {effects.grainOpacity > 0 && (
        <svg width="100%" height="100%" style={{ position: "absolute", opacity: effects.grainOpacity, mixBlendMode: "overlay" }}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 12} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      )}
      {effects.scanlineOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 2px, transparent 4px)",
            opacity: effects.scanlineOpacity,
          }}
        />
      )}
      <AbsoluteFill style={{ background: effects.vignette }} />
    </AbsoluteFill>
  );
};

/** A few frames of RGB-split bars and a flash, for hard cuts. */
export const GlitchCut: React.FC<{ seed?: number }> = ({ seed = 1 }) => {
  const frame = useCurrentFrame();
  const { effects } = useTheme();
  if (frame > 7) return null;
  const strength = 1 - frame / 8;
  const bars = Array.from({ length: 7 }, (_, i) => {
    const y = ((Math.sin(seed * 31.7 + i * 12.9 + frame * 3.1) + 1) / 2) * HEIGHT;
    const h = 8 + ((i * 37 + seed * 11 + frame * 7) % 60);
    const dx = Math.sin(seed + i * 4.3 + frame) * 80 * strength;
    return { y, h, dx, color: effects.glitchColors[i % 2 ? 0 : 1] };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: effects.flash, opacity: frame < 2 ? 0.35 * strength : 0 }} />
      {bars.map((b, i) => (
        <div
          key={i}
          style={{ position: "absolute", left: 0, right: 0, top: b.y, height: b.h, background: b.color, transform: `translateX(${b.dx}px)`, mixBlendMode: "screen" }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Brand, blinking dot, segment counter (only during segments) and date label. */
export const TopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts } = theme;
  // The scene on screen; the counter shows only during numbered segments, not text sections.
  const current = [...timeline.segments, ...timeline.texts].sort((a, b) => b.from - a.from).find((s) => frame >= s.from);
  const inSegments = frame >= timeline.coldOpen.to && frame < timeline.outro.from && !!current && "num" in current;
  const blink = Math.floor(frame / 15) % 2 === 0;
  const enter = interpolate(frame, [0, 12], [-80, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      style={{
        position: "absolute",
        top: 36,
        left: 64,
        right: 64,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transform: `translateY(${enter}px)`,
        fontFamily: fonts.mono,
        color: colors.text,
        fontSize: 22,
        letterSpacing: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: colors.accent, opacity: blink ? 1 : 0.25, boxShadow: `0 0 16px ${colors.accent}` }} />
        <span style={{ fontWeight: 700 }}>{episode.brand.name}</span>
        {episode.brand.tagline && <span style={{ color: colors.dim }}>{episode.brand.tagline}</span>}
      </div>
      <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
        {inSegments && current && "num" in current && (
          <span>
            <span style={{ color: colors.accent, fontWeight: 700 }}>{pad(current.num)}</span>
            <span style={{ color: colors.dim }}>{timeline.format === "list" ? ` OF ${pad(timeline.total)}` : ` / ${pad(timeline.total)}`}</span>
          </span>
        )}
        <span style={{ color: colors.dim }}>{episode.brand.dateLabel}</span>
      </div>
    </div>
  );
};

/** Scrolling headline ticker along the bottom edge. */
export const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts } = theme;
  const items =
    episode.ticker?.items ??
    (timeline.format === "countdown" ? [...timeline.segments].reverse() : timeline.segments).map(
      (s) => `${s.seg.region} — ${s.seg.headline.toUpperCase()}`,
    );
  const text = items.join("   ◆   ");
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 58,
        background: colors.tickerBg,
        borderTop: `2px solid ${colors.accent}`,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          padding: "0 28px",
          background: colors.accent,
          color: colors.onAccent,
          fontFamily: fonts.display,
          fontSize: 30,
          letterSpacing: 2,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {episode.ticker?.label ?? theme.copy.tickerLabel}
      </div>
      <div
        style={{
          whiteSpace: "nowrap",
          transform: `translateX(${-frame * 3.2}px)`,
          fontFamily: fonts.mono,
          fontWeight: 700,
          color: colors.text,
          fontSize: 24,
          letterSpacing: 2,
          paddingLeft: 40,
        }}
      >
        {`${text}   ◆   `.repeat(Math.max(4, Math.ceil(12000 / Math.max(1, text.length * 15))))}
      </div>
    </div>
  );
};

/** Word-by-word captions from the script's own words; hidden once the outro title slams in. */
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { timeline, theme } = useEpisode();
  const { colors, fonts, effects } = theme;
  const sec = frame / FPS;
  if (sec >= timeline.outro.captionsOff - 0.1) return null;
  const chunk = timeline.chunks.find((c) => sec >= c.start - 0.05 && sec < c.end + 0.25);
  if (!chunk) return null;
  // Split layout: during a numbered segment, captions sit under the framed b-roll, clear of the spec column.
  const split = layoutOf(theme.id) === "split" && timeline.segments.some((s) => frame >= s.from && frame < s.to);
  const box = split
    ? { left: SPLIT.captions.left, width: SPLIT.captions.width, bottom: SPLIT.captions.bottom, fontSize: SPLIT.captions.fontSize }
    : { left: 120, right: 120, bottom: 108, fontSize: 54 };

  return (
    <div
      style={{
        position: "absolute",
        ...box,
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "0 18px",
        fontFamily: fonts.body,
        fontWeight: 800,
        textTransform: "uppercase",
        lineHeight: 1.15,
      }}
    >
      {chunk.words.map((w, i) => {
        if (sec < w.start - 0.04) return null;
        const active = sec >= w.start && sec < w.end + 0.05;
        const pop = interpolate((sec - w.start) * FPS, [0, 4], [0.7, 1], { ...clamp, easing: Easing.out(Easing.back(3)) });
        return (
          <span
            key={i}
            style={{ display: "inline-block", transform: `scale(${pop})`, color: active ? colors.highlight : colors.text, textShadow: effects.captionShadow }}
          >
            {w.word.replace(/[,.;:]$/, "")}
          </span>
        );
      })}
    </div>
  );
};
