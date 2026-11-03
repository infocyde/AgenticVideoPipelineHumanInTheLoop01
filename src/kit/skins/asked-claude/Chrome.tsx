// Asked Claude chrome (16:9): a quiet header (the mark, the brand and its "an AI's opinion" tagline, a dot per part of
// the answer, the date) and captions in sentence case, the word being spoken in clay with a line under it. No ticker.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { CaptionBox } from "../../components/Chrome";
import { clamp, useEpisode } from "../../context";
import { captionsHidden } from "../../lib/resolve";
import { activeChunk, FPS, toFrame } from "../../lib/timing";
import { AC, Mark, PAGE, prog } from "./parts";

export const AskedTopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { fonts } = theme;
  const enter = prog(frame, 0, 16);
  const parts = [...timeline.segments, ...timeline.texts].sort((a, b) => a.from - b.from);
  const dotsIn = interpolate(frame, [timeline.coldOpen.to, timeline.coldOpen.to + 12], [0, 1], clamp) * interpolate(frame, [timeline.outro.from - 6, timeline.outro.from], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 120,
        right: 120,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        opacity: enter,
        transform: `translateY(${(1 - enter) * -14}px)`,
        fontFamily: fonts.mono,
        fontSize: 19,
        letterSpacing: 3.5,
        color: AC.ink,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Mark size={32} />
        <span style={{ fontWeight: 700 }}>{episode.brand.name}</span>
        {episode.brand.tagline && <span style={{ color: AC.inkSoft }}>{episode.brand.tagline}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        {parts.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: dotsIn }}>
            {parts.map((s) => {
              const on = frame >= s.from && frame < s.to;
              const past = frame >= s.to;
              return <div key={`${"num" in s ? "s" : "t"}${s.index}`} style={{ width: on ? 30 : 10, height: 10, borderRadius: 5, background: on ? AC.clay : past ? AC.inkSoft : AC.rule }} />;
            })}
          </div>
        )}
        <span style={{ color: AC.inkSoft }}>{episode.brand.dateLabel}</span>
      </div>
    </div>
  );
};

/** Captions in a box: words appear as they're spoken; the current one is clay and underlined. */
export const AskedCaptionWords: React.FC<{ box: CaptionBox }> = ({ box }) => {
  const frame = useCurrentFrame();
  const { timeline, theme } = useEpisode();
  const sec = frame / FPS;
  if (sec >= timeline.outro.captionsOff - 0.1 || captionsHidden(timeline, frame)) return null;
  const chunk = activeChunk(timeline.chunks, sec);
  if (!chunk) return null;
  return (
    <div
      style={{
        position: "absolute",
        ...box,
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: `${box.fontSize * 0.1}px ${box.fontSize * 0.28}px`,
        fontFamily: theme.fonts.body,
        fontWeight: 700,
        fontSize: box.fontSize,
        lineHeight: 1.2,
      }}
    >
      {chunk.words.map((w, i) => {
        if (sec < w.start - 0.04) return null;
        const active = sec >= w.start && sec < w.end + 0.05;
        const rise = interpolate((sec - w.start) * FPS, [0, 4], [6, 0], clamp);
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", transform: `translateY(${rise}px)`, color: active ? AC.clay : AC.ink }}>
            {w.word.replace(/[,.;:]$/, "")}
            {active && <span style={{ position: "absolute", left: 0, right: 0, bottom: -box.fontSize * 0.12, height: 4, borderRadius: 2, background: AC.clay }} />}
          </span>
        );
      })}
    </div>
  );
};

/** 16:9 captions along the bottom; off while the question is on screen (the spoken question is the same words). */
export const AskedCaptions: React.FC<{ box?: CaptionBox }> = ({ box }) => {
  const frame = useCurrentFrame();
  const { timeline } = useEpisode();
  if (box) return <AskedCaptionWords box={box} />;
  if (frame < toFrame(timeline.coldOpen.title.start)) return null;
  return <AskedCaptionWords box={PAGE.captions} />;
};
