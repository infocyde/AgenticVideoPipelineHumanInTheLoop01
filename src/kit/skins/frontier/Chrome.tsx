// Frontier chrome: a status bar with a live equalizer mark and segment progress pips, a slim signal rail instead of
// the broadcast ticker, and karaoke captions (sentence case, the spoken word lit in a lime pill).
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { CaptionBox } from "../../components/Chrome";
import { clamp, useEpisode } from "../../context";
import { FPS } from "../../lib/timing";
import { F, pad2 } from "./fx";
import { SPATIAL } from "./Segment";
import { TEXT_LAYOUT } from "./Text";

/** Four bars breathing at different rates: the brand mark. */
export const EqMark: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: size * 0.14, height: size }}>
      {[0, 1, 2, 3].map((i) => {
        const h = 0.3 + 0.7 * ((Math.sin(frame / (5 + i * 1.7) + i * 1.9) + 1) / 2);
        return <div key={i} style={{ width: size * 0.16, height: size * h, borderRadius: size, background: i % 2 ? F.violet : F.cyan, boxShadow: `0 0 ${size * 0.4}px ${i % 2 ? F.violet : F.cyan}` }} />;
      })}
    </div>
  );
};

export const FrontierTopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts } = theme;
  const enter = interpolate(frame, [0, 14], [-70, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const segs = timeline.segments;
  const inBody = frame >= timeline.coldOpen.to && frame < timeline.outro.from;
  const pipsIn = interpolate(frame, [timeline.coldOpen.to, timeline.coldOpen.to + 12], [0, 1], clamp) * interpolate(frame, [timeline.outro.from - 6, timeline.outro.from], [1, 0], clamp);
  const current = [...timeline.segments, ...timeline.texts].sort((a, b) => b.from - a.from).find((s) => frame >= s.from);
  const num = inBody && current && "num" in current ? current.num : null;
  // Pips in the order the items play; each fills while its segment is on screen.
  const order = [...segs].sort((a, b) => a.from - b.from);
  return (
    <div
      style={{
        position: "absolute",
        top: 34,
        left: 64,
        right: 64,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transform: `translateY(${enter}px)`,
        fontFamily: fonts.mono,
        fontSize: 21,
        letterSpacing: 3.5,
        color: colors.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <EqMark size={22} />
        <span style={{ fontWeight: F.weights.monoBold }}>{episode.brand.name}</span>
        {episode.brand.tagline && <span style={{ color: colors.dim }}>{episode.brand.tagline}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        {order.length > 1 && (
          <div style={{ display: "flex", gap: 6, opacity: pipsIn }}>
            {order.map((s) => {
              const p = interpolate(frame, [s.from, s.to], [0, 1], clamp);
              const on = frame >= s.from && frame < s.to;
              return (
                <div key={s.index} style={{ width: on ? 46 : 26, height: 6, borderRadius: 3, background: "rgba(160,180,255,0.18)", overflow: "hidden" }}>
                  <div style={{ width: `${p * 100}%`, height: "100%", background: on ? F.iris : F.cyan, opacity: on ? 1 : 0.7, backgroundSize: "46px 6px" }} />
                </div>
              );
            })}
          </div>
        )}
        {num !== null && (
          <span>
            <span style={{ color: F.cyan, fontWeight: F.weights.monoBold }}>{pad2(num)}</span>
            <span style={{ color: colors.dim }}> / {pad2(timeline.total)}</span>
          </span>
        )}
        <span style={{ color: colors.dim }}>{episode.brand.dateLabel}</span>
      </div>
    </div>
  );
};

/** Slim glass rail along the bottom: a label pill and the items drifting by. */
export const FrontierRail: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts, copy } = theme;
  const items =
    episode.ticker?.items ??
    (timeline.format === "countdown" ? [...timeline.segments].reverse() : timeline.segments).map((s) => `${pad2(s.num)}  ${s.seg.headline}`);
  const text = items.join("      ◇      ");
  const enter = interpolate(frame, [0, 12], [44, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 44, transform: `translateY(${enter}px)`, background: colors.tickerBg, backdropFilter: "blur(14px)", overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1.5, background: F.irisSoft }} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 26px 0 64px",
          background: F.ink,
          boxShadow: `24px 0 24px -4px ${F.ink}`,
          fontFamily: fonts.mono,
          fontWeight: F.weights.monoBold,
          fontSize: 17,
          letterSpacing: 4,
          color: F.cyan,
          flexShrink: 0,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: F.cyan, boxShadow: `0 0 10px ${F.cyan}` }} />
        {episode.ticker?.label ?? copy.tickerLabel}
      </div>
      <div style={{ whiteSpace: "nowrap", transform: `translateX(${-frame * 2.4}px)`, fontFamily: fonts.mono, fontSize: 18, letterSpacing: 2, color: colors.dim }}>
        {`${text}      ◇      `.repeat(Math.max(4, Math.ceil(12000 / Math.max(1, text.length * 11))))}
      </div>
    </div>
  );
};

/** Karaoke captions in a given box. */
export const CaptionWords: React.FC<{ box: CaptionBox; align?: "center" | "flex-start" }> = ({ box, align = "center" }) => {
  const frame = useCurrentFrame();
  const { timeline, theme } = useEpisode();
  const { fonts, effects } = theme;
  const sec = frame / FPS;
  if (sec >= timeline.outro.captionsOff - 0.1) return null;
  const chunk = timeline.chunks.find((c) => sec >= c.start - 0.05 && sec < c.end + 0.25);
  if (!chunk) return null;
  const padX = box.fontSize * 0.2;
  return (
    <div
      style={{
        position: "absolute",
        ...box,
        display: "flex",
        justifyContent: align,
        flexWrap: "wrap",
        gap: `${box.fontSize * 0.12}px ${box.fontSize * 0.3}px`,
        fontFamily: fonts.body,
        fontWeight: F.weights.caption,
        letterSpacing: "-0.01em",
        lineHeight: 1.18,
      }}
    >
      {chunk.words.map((w, i) => {
        if (sec < w.start - 0.04) return null;
        const active = sec >= w.start && sec < w.end + 0.05;
        const pop = interpolate((sec - w.start) * FPS, [0, 4], [0.75, 1], { ...clamp, easing: Easing.out(Easing.back(2.6)) });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `scale(${pop})`,
              padding: `0 ${padX}px`,
              margin: `0 ${-padX}px`,
              borderRadius: box.fontSize * 0.22,
              background: active ? F.lime : "transparent",
              color: active ? F.ink : "#fff",
              textShadow: active ? undefined : effects.captionShadow,
              boxShadow: active ? `0 0 ${box.fontSize * 0.5}px rgba(200,255,61,0.45)` : undefined,
            }}
          >
            {w.word.replace(/[,.;:]$/, "")}
          </span>
        );
      })}
    </div>
  );
};

/** 16:9 captions: under the left column in segments, under the right column in text sections, centered otherwise. */
export const FrontierCaptions: React.FC<{ box?: CaptionBox }> = ({ box }) => {
  const frame = useCurrentFrame();
  const { timeline } = useEpisode();
  if (box) return <CaptionWords box={box} />;
  const inSeg = timeline.segments.some((s) => frame >= s.from && frame < s.to);
  const text = timeline.texts.find((t) => frame >= t.from && frame < t.to);
  if (text?.seg.layout === "full") return <CaptionWords box={TEXT_LAYOUT.fullCaptions} />;
  const inText = !!text;
  if (inSeg) return <CaptionWords box={SPATIAL.captions} align="flex-start" />;
  if (inText) return <CaptionWords box={TEXT_LAYOUT.captions} align="flex-start" />;
  return <CaptionWords box={{ left: 160, right: 160, bottom: 100, fontSize: 54 }} />;
};
