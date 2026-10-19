import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, type BackdropVisual } from "../components/Backdrop";
import { Headline } from "../components/Headline";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode } from "../context";
import { allPins, type ResolvedText } from "../lib/resolve";
import { toFrame, WIDTH } from "../lib/timing";

/** Unnumbered text section (intro, summary, recap): 1–4 cue-cut visuals full-bleed, one block of text over them. */
export const TextSection: React.FC<{ t: ResolvedText }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const { colors, fonts, effects } = theme;
  const { seg } = t;
  const dur = t.to - t.from;

  const label = seg.label ?? "";
  const barIn = interpolate(frame, [4, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const labelChars = Math.floor(interpolate(frame, [8, 8 + label.length * 0.8], [0, label.length], clamp));
  const headingWipe = interpolate(frame, [12, 26], [100, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bodyIn = interpolate(frame, [24, 38], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  const visuals: BackdropVisual[] = t.visuals.flatMap((v, i) =>
    v.asset ? [{ name: v.name, asset: v.asset, note: v.note, from: i === 0 ? 0 : toFrame(v.at) - t.from }] : [],
  );

  return (
    <AbsoluteFill>
      {visuals.length ? (
        <Backdrop visuals={visuals} durationInFrames={dur} seed={t.index * 5 + 1} />
      ) : (
        <AbsoluteFill style={{ background: colors.bg }}>
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.4 }}>
            <WorldMap width={WIDTH} height={1000} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: theme.backdrop.sideGradient }} />
        </AbsoluteFill>
      )}

      <div style={{ position: "absolute", left: 120, top: 230, width: 1120 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, height: 34 }}>
          <div style={{ width: 90 * barIn, height: 6, background: colors.accent, boxShadow: effects.accentGlow(16) }} />
          {label && (
            <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: colors.accent, textTransform: "uppercase" }}>
              {label.slice(0, labelChars)}
            </span>
          )}
        </div>
        <Headline text={seg.heading} width={1120} wipe={headingWipe} maxSize={124} minSize={64} maxLines={2} />
        {seg.body && (
          <div
            style={{
              marginTop: 26,
              maxWidth: 1040,
              paddingLeft: 26,
              borderLeft: `4px solid ${colors.highlight}`,
              fontFamily: fonts.body,
              fontWeight: 600,
              fontSize: 40,
              lineHeight: 1.3,
              color: colors.text,
              textShadow: effects.textShadow,
              opacity: bodyIn,
              transform: `translateY(${(1 - bodyIn) * 24}px)`,
            }}
          >
            {seg.body}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
