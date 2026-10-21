// Frontier text section (16:9): the mirror of a segment, so chapters read differently from items. The window floats
// on the left turned the other way, the label, heading and body sit on the right.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useEpisode } from "../../context";
import { allPins, type ResolvedText } from "../../lib/resolve";
import { DotMap } from "./DotMap";
import { Chip, F, Field, prog } from "./fx";
import { type Box, MediaStack, visualLabel, Window, windowEnter } from "./Media";
import { FrontierHeadline, visualsOf } from "./Segment";

export const TEXT_LAYOUT = {
  window: { left: 100, top: 150, width: 1060, height: 596 } as Box,
  column: { left: 1230, top: 170, width: 590 },
  captions: { left: 1230, width: 600, bottom: 96, fontSize: 46 },
  /** layout: "full": the visual large and centered, the label chip above it, captions under it. */
  full: { left: 240, top: 150, width: 1440, height: 810 } as Box,
  fullCaptions: { left: 160, right: 160, bottom: 50, fontSize: 44 },
};

/** Body copy in a glass card. */
export const BodyCard: React.FC<{ text: string; since: number; size: number }> = ({ text, since, size }) => {
  const { theme } = useEpisode();
  const p = prog(since, 0, 14);
  if (since < 0) return null;
  return (
    <div style={{ marginTop: 30, opacity: p, transform: `translateY(${(1 - p) * 24}px)`, borderRadius: 20, padding: 1.5, background: F.irisSoft }}>
      <div
        style={{
          borderRadius: 18.5,
          background: "rgba(10,12,22,0.78)",
          backdropFilter: "blur(16px)",
          padding: `${size * 0.7}px ${size * 0.85}px`,
          fontFamily: theme.fonts.body,
          fontWeight: F.weights.body,
          fontSize: size,
          lineHeight: 1.4,
          color: theme.colors.text,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const FrontierText: React.FC<{ t: ResolvedText }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { episode } = useEpisode();
  const { seg } = t;
  const dur = t.to - t.from;
  const { window: win, column: col } = TEXT_LAYOUT;
  const visuals = visualsOf(t.visuals, t.from);
  const pins = allPins(episode);
  if (seg.layout === "full") {
    const box = TEXT_LAYOUT.full;
    return (
      <AbsoluteFill>
        <Field ripple={frame - 2} />
        <div style={{ position: "absolute", left: box.left, top: box.top - 64 }}>{seg.label && <Chip text={seg.label} since={frame - 4} size={22} dot={F.lime} />}</div>
        <Window box={box} enter={windowEnter(frame, 2)} tilt={0} radius={24}>
          {visuals.length ? <MediaStack visuals={visuals} durationInFrames={dur} seed={t.index * 5 + 1} tint={false} /> : <Field ripple={frame - 8} />}
        </Window>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Field ripple={frame - 2} cx="75%" cy="25%" />
      <Window box={win} enter={windowEnter(frame, 4)} tilt={7} label={visualLabel(visuals, frame)}>
        {visuals.length ? (
          <MediaStack visuals={visuals} durationInFrames={dur} seed={t.index * 5 + 1} />
        ) : pins.length ? (
          <DotMap width={win.width - 4} height={win.height - 4} allPins={pins} pinDelay={6} zoomFrames={1} showLabels={false} pitch={7} />
        ) : (
          <Field ripple={frame - 8} />
        )}
      </Window>
      <div style={{ position: "absolute", left: col.left, top: col.top, width: col.width }}>
        {seg.label && <Chip text={seg.label} since={frame - 6} size={22} dot={F.lime} />}
        <div style={{ marginTop: seg.label ? 24 : 0 }}>
          <FrontierHeadline text={seg.heading} since={frame - 12} width={col.width} maxSize={72} minSize={42} maxLines={4} />
        </div>
        {seg.body && <BodyCard text={seg.body} since={frame - 24} size={28} />}
      </div>
    </AbsoluteFill>
  );
};
