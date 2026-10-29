import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, type BackdropVisual } from "../components/Backdrop";
import { Headline } from "../components/Headline";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode } from "../context";
import { allPins, type ResolvedText } from "../lib/resolve";
import { MAP_SLIDE, TEXT_SHRINK, toFrame, WIDTH } from "../lib/timing";

/** Unnumbered text section (intro, summary, recap): 1–4 cue-cut visuals full-bleed, one block of text over them. */
export const TextSection: React.FC<{ t: ResolvedText }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const { colors, fonts, effects } = theme;
  const { seg } = t;
  const dur = t.to - t.from;

  // textAt: the label and heading wait off screen and come in at that cue; until then the side gradient stays light.
  const textFrom = t.textAt !== undefined ? Math.max(0, toFrame(t.textAt) - t.from) : 0;
  const f = frame - textFrom;
  const label = seg.label ?? "";
  const barIn = interpolate(f, [4, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const labelChars = Math.floor(interpolate(f, [8, 8 + label.length * 0.8], [0, label.length], clamp));
  const headingWipe = interpolate(f, [12, 26], [100, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bodyIn = interpolate(f, [24, 38], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const slideIn = textFrom ? interpolate(f, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  // tuckAt: the block shrinks into the top-left corner, as a numbered segment's text does once its map card leaves.
  const tuckFrom = t.tuckAt !== undefined ? toFrame(t.tuckAt) - t.from : null;
  const tuck = tuckFrom === null ? 0 : interpolate(frame, [tuckFrom, tuckFrom + MAP_SLIDE + 4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const visuals: BackdropVisual[] = t.visuals.flatMap((v, i) =>
    v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, panel: v.panel, from: i === 0 ? 0 : toFrame(v.at) - t.from }] : [],
  );

  // exitAt (or, in themes with textSectionAutoExit, the second visual's cue): the block fades out up and to the right.
  const autoExit = theme.textSectionAutoExit && t.tuckAt === undefined && visuals.length > 1 ? visuals[1].from : null;
  const exitFrom = t.exitAt !== undefined ? toFrame(t.exitAt) - t.from : autoExit;
  const out = exitFrom === null ? 0 : interpolate(frame, [exitFrom, exitFrom + 16], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const blockTransform = `translate(${-1400 * (1 - slideIn) - 56 * tuck + 320 * out}px, ${-130 * tuck - 200 * out}px) scale(${1 - (1 - TEXT_SHRINK) * tuck})`;
  const clear = Math.max(1 - slideIn, tuck, out);

  return (
    <AbsoluteFill>
      {visuals.length ? (
        <Backdrop visuals={visuals} durationInFrames={dur} seed={t.index * 5 + 1} clear={clear} scrim={out === 0} panels panelFocus={out} />
      ) : (
        <AbsoluteFill style={{ background: colors.bg }}>
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.4 }}>
            <WorldMap width={WIDTH} height={1000} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: theme.backdrop.sideGradient }} />
        </AbsoluteFill>
      )}

      <div style={{ position: "absolute", left: 120, top: 230, width: 1120, transformOrigin: "top left", transform: blockTransform, opacity: 1 - out }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, height: 34 }}>
          <div style={{ width: 90 * barIn, height: 6, background: colors.accent, boxShadow: effects.accentGlow(16) }} />
          {label && (
            <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: colors.accent, textTransform: "uppercase", textShadow: effects.textShadow }}>
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
