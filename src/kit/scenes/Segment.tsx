import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Backdrop, type BackdropVisual } from "../components/Backdrop";
import { LocatorCard, NumberSlam, StatCard } from "../components/Cards";
import { Headline } from "../components/Headline";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode } from "../context";
import type { ResolvedSegment } from "../lib/resolve";
import { HEIGHT, MAP_EXIT, MAP_GLITCH, MAP_SLIDE, segmentOffset, TEXT_SHRINK, toFrame, WIDTH } from "../lib/timing";

/** One countdown/list item: b-roll, number badge, region, headline, cue-timed stats and the locator map. */
export const Segment: React.FC<{ s: ResolvedSegment; slam: boolean }> = ({ s, slam }) => {
  const frame = useCurrentFrame();
  const { timeline, theme } = useEpisode();
  const { colors, fonts, effects, copy } = theme;
  const { seg } = s;
  const dur = s.to - s.from;
  const isTop = seg.emphasis === "top";
  // With a slam, the badge and text wait for the numeral to clear (frame 14); without one they start almost at once.
  const o = segmentOffset(slam);

  const shake = slam && frame >= 3 && frame < 14 ? (14 - frame) / 11 : 0;
  const sx = Math.sin(frame * 12.3) * 14 * shake;
  const sy = Math.cos(frame * 9.1) * 10 * shake;

  const badgeIn = interpolate(frame, [14 + o, 22 + o], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const regionChars = Math.floor(interpolate(frame, [18 + o, 18 + o + seg.region.length * 0.8], [0, seg.region.length], clamp));
  const headlineWipe = interpolate(frame, [22 + o, 34 + o], [100, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const mapIn = interpolate(frame, [20 + o, 34 + o], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // Once the map card leaves, the text block tucks into the top-left corner and the side gradient eases off.
  const tuckAt = MAP_EXIT + MAP_GLITCH + o;
  const tuck = interpolate(frame, [tuckAt, tuckAt + MAP_SLIDE + 4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const textScale = 1 - (1 - TEXT_SHRINK) * tuck;
  // card: "exit" slides the whole block off the left edge instead of tucking it (its later stats stay off screen too).
  // side: "right" mirrors the block (it tucks into the top-right corner and exits off the right edge).
  const right = seg.side === "right";
  const dir = right ? -1 : 1;
  const cardTransform =
    seg.card === "exit"
      ? `translateX(${-1400 * dir * tuck}px)`
      : seg.card === "none"
        ? `translateX(${-2400 * dir}px)`
        : `translate(${-56 * dir * tuck}px, ${-36 * tuck}px) scale(${textScale})`;

  const statFrames = s.stats.map((st) => toFrame(st.at) - s.from);
  const activeStat = statFrames.reduce((acc, f, i) => (frame >= f ? i : acc), -1);
  const alarmPulse = isTop ? (Math.sin(frame / 4) + 1) / 2 : 0;

  const visuals: BackdropVisual[] = s.visuals.flatMap((v, i) =>
    v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, from: i === 0 ? 0 : toFrame(v.at) - s.from }] : [],
  );
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
      {visuals.length ? (
        <Backdrop visuals={visuals} durationInFrames={dur} seed={s.num * 3} clear={tuck} scrim={seg.card !== "exit" && seg.card !== "none"} mirror={right} />
      ) : (
        <AbsoluteFill style={{ background: colors.bg }}>
          {seg.map && (
            <AbsoluteFill style={{ opacity: 0.6, justifyContent: "center", alignItems: "center" }}>
              <WorldMap width={WIDTH} height={HEIGHT} focus={seg.map} showLabels={false} />
            </AbsoluteFill>
          )}
          <AbsoluteFill style={{ background: theme.backdrop.sideGradient }} />
        </AbsoluteFill>
      )}

      {isTop && <AbsoluteFill style={{ boxShadow: `inset 0 0 ${80 + alarmPulse * 120}px ${colors.accent}${Math.round((0.35 + alarmPulse * 0.35) * 255).toString(16).padStart(2, "0")}` }} />}

      <div
        style={{
          position: "absolute",
          left: right ? WIDTH - 120 - 1040 : 120,
          top: 128,
          width: 1040,
          transformOrigin: right ? "top right" : "top left",
          transform: cardTransform,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, opacity: badgeIn, transform: `translateX(${(1 - badgeIn) * -60}px)` }}>
          <span style={{ fontFamily: fonts.display, fontSize: 168, lineHeight: 0.85, color: colors.accent, textShadow: effects.accentGlow(40) }}>{pad(s.num)}</span>
          {timeline.format === "list" && (
            <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: colors.dim, marginBottom: 10 }}>OF {pad(timeline.total)}</span>
          )}
          {isTop && (
            <span
              style={{
                fontFamily: fonts.mono,
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: 4,
                color: colors.onAccent,
                background: colors.accent,
                padding: "6px 12px",
                marginBottom: 10,
                opacity: 0.6 + alarmPulse * 0.4,
              }}
            >
              {seg.emphasisLabel ?? copy.topEmphasisLabel}
            </span>
          )}
        </div>
        <div style={{ marginTop: 18, fontFamily: fonts.mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: colors.highlight }}>
          {seg.region.slice(0, regionChars)}
        </div>
        <Headline text={seg.headline} width={1040} wipe={headlineWipe} />
        {activeStat >= 0 && <StatCard key={activeStat} value={seg.stats[activeStat].value} label={seg.stats[activeStat].label} since={frame - statFrames[activeStat]} />}
      </div>

      {seg.map && <LocatorCard map={seg.map} enter={mapIn} mapDelay={20 + o} exit={frame - (MAP_EXIT + o)} side={right ? "left" : "right"} />}

      {slam && (
        <Sequence durationInFrames={24} layout="none">
          <NumberSlam num={s.num} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
