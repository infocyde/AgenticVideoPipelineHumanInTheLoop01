import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SlamText, SubscribeCTA } from "../components/Titles";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode } from "../context";
import { allPins } from "../lib/resolve";
import { toFrame, WIDTH } from "../lib/timing";

/** Outro lines slam in one after another over the all-pins map; the last one stays, with the subscribe CTA under it. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, effects, copy } = theme;
  const { from, lines, cta } = timeline.outro;
  const at = lines.map((l) => toFrame(l.at) - from);
  const mapZoom = interpolate(frame, [0, 240], [1.12, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ctaAt = cta ? toFrame(cta.at) - from : null;
  const last = lines.length - 1;

  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <AbsoluteFill style={{ transform: `scale(${mapZoom})`, justifyContent: "center", alignItems: "center", opacity: 0.85 }}>
        <WorldMap width={WIDTH} height={1000} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: effects.outroScrim }} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 10, paddingBottom: 140 }}>
        {lines.map(({ line }, i) => {
          if (frame < at[i]) return null;
          if (i < last) {
            const out = interpolate(frame, [at[i + 1] - 4, at[i + 1]], [1, 0], clamp);
            if (out <= 0) return null;
            return (
              <div key={i} style={{ opacity: out, position: "absolute", textAlign: "center" }}>
                <SlamText since={frame - at[i]} size={130} text={line.text} accent={line.accent} />
              </div>
            );
          }
          return (
            <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <SlamText since={frame - at[i]} size={lines.length > 1 ? 190 : 150} text={line.text} accent={line.accent} />
              {ctaAt !== null && frame >= ctaAt && (
                <SubscribeCTA since={frame - ctaAt} label={cta?.label ?? episode.outro.cta?.label ?? copy.ctaLabel} doneLabel={copy.ctaDoneLabel} />
              )}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
