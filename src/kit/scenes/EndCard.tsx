import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode } from "../context";
import { allPins } from "../lib/resolve";
import { WIDTH } from "../lib/timing";

/**
 * Slots for YouTube end-screen elements, in 1920×1080 pixels. YouTube draws its own video and subscribe
 * elements on top; keep these clear of text. Both sit inside the end-screen safe area.
 */
export const END_SLOTS = {
  video: { left: 230, top: 360, width: 800, height: 450 },
  subscribe: { cx: 1450, cy: 585, r: 160 },
};

/** Branded hold frame after the voiceover, with empty slots for YouTube's end-screen elements. */
export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const { colors, fonts, effects, copy } = theme;
  const fade = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const { video, subscribe } = END_SLOTS;
  const label: React.CSSProperties = { position: "absolute", fontFamily: fonts.mono, fontWeight: 700, fontSize: 24, letterSpacing: 6, color: colors.dim };
  const slot = `2px solid ${colors.line}`;

  return (
    <AbsoluteFill style={{ background: colors.bg, opacity: fade }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.35 }}>
        <WorldMap width={WIDTH} height={1000} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: effects.outroScrim }} />

      <div style={{ position: "absolute", top: 130, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 26, letterSpacing: 8, color: colors.accent }}>{episode.brand.name}</div>
        <div style={{ marginTop: 10, fontFamily: fonts.display, fontSize: 96, lineHeight: 1, color: colors.text, textTransform: "uppercase" }}>{episode.title}</div>
      </div>

      <div style={{ ...label, left: video.left, top: video.top - 44 }}>{copy.endCardNext}</div>
      <div style={{ position: "absolute", ...video, border: slot, background: "rgba(0,0,0,0.25)" }} />

      <div style={{ ...label, left: subscribe.cx - 140, width: 280, textAlign: "center", top: subscribe.cy - subscribe.r - 44 }}>{copy.ctaLabel}</div>
      <div
        style={{
          position: "absolute",
          left: subscribe.cx - subscribe.r,
          top: subscribe.cy - subscribe.r,
          width: subscribe.r * 2,
          height: subscribe.r * 2,
          borderRadius: "50%",
          border: slot,
          background: "rgba(0,0,0,0.25)",
        }}
      />

      <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, textAlign: "center", fontFamily: fonts.mono, fontSize: 22, letterSpacing: 6, color: colors.dim }}>
        {episode.brand.dateLabel}
      </div>
    </AbsoluteFill>
  );
};
