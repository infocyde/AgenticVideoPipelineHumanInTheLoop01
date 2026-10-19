import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode } from "../context";
import { allPins } from "../lib/resolve";
import { WIDTH } from "../lib/timing";

const domain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Closing card listing the episode's sources (title + site); full links go in the description. */
export const SourcesCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const { colors, fonts, effects } = theme;
  const sources = episode.sources;
  const fade = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const size = sources.length <= 5 ? 40 : sources.length <= 8 ? 32 : 26;

  return (
    <AbsoluteFill style={{ background: colors.bg, opacity: fade }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.25 }}>
        <WorldMap width={WIDTH} height={1000} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} settled />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: effects.outroScrim }} />

      <div style={{ position: "absolute", left: 160, right: 160, top: 150 }}>
        <div style={{ fontFamily: fonts.display, fontSize: 110, lineHeight: 1, color: colors.accent, textShadow: effects.accentGlow(40), letterSpacing: 4 }}>SOURCES</div>
        <div style={{ height: 6, width: 260, background: colors.accent, margin: "18px 0 40px" }} />
        {sources.map((s, i) => {
          const o = interpolate(frame, [8 + i * 4, 18 + i * 4], [0, 1], clamp);
          return (
            <div
              key={i}
              style={{
                opacity: o,
                transform: `translateX(${(1 - o) * -30}px)`,
                display: "flex",
                alignItems: "baseline",
                gap: 24,
                marginBottom: size * 0.7,
                fontFamily: fonts.body,
                fontWeight: 600,
                fontSize: size,
                color: colors.text,
              }}
            >
              <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: colors.highlight, fontSize: size * 0.7 }}>{String(i + 1).padStart(2, "0")}</span>
              <span>{s.title}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: size * 0.6, color: colors.dim, letterSpacing: 2 }}>{domain(s.url)}</span>
            </div>
          );
        })}
        <div style={{ marginTop: 30, fontFamily: fonts.mono, fontSize: 24, letterSpacing: 4, color: colors.dim }}>FULL LINKS IN THE DESCRIPTION</div>
      </div>
    </AbsoluteFill>
  );
};
