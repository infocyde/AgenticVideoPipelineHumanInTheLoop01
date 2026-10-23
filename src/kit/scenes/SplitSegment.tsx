import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Backdrop, type BackdropVisual } from "../components/Backdrop";
import { LocatorCard, NumberSlam } from "../components/Cards";
import { fitLines, Headline, useFontsReady } from "../components/Headline";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode, useTheme } from "../context";
import type { ResolvedSegment } from "../lib/resolve";
import { MAP_EXIT, segmentOffset, toFrame } from "../lib/timing";

/** Split-layout geometry (1920×1080): framed b-roll on the left, spec column on the right. */
export const SPLIT = {
  frame: { left: 72, top: 118, width: 1040, height: 585 },
  column: { left: 1176, top: 118, width: 672 },
  statsTop: 470,
  rowHeight: 104,
  valueWidth: 300,
  /** Stat rows per panel; the next stat after a full panel starts a fresh one. */
  perPanel: 5,
  /** Captions sit under the frame while a split segment is on screen. */
  captions: { left: 72, width: 1040, bottom: 268, fontSize: 50 },
};

const Brackets: React.FC<{ enter: number }> = ({ enter }) => {
  const { colors } = useTheme();
  const { left, top, width, height } = SPLIT.frame;
  const arm = 38;
  const gap = 12 + (1 - enter) * 40;
  const stroke = `3px solid ${colors.accent}`;
  const corner = (x: number, y: number, h: "left" | "right", v: "top" | "bottom") => (
    <div
      style={{
        position: "absolute",
        left: x - (h === "left" ? gap : arm - gap),
        top: y - (v === "top" ? gap : arm - gap),
        width: arm,
        height: arm,
        opacity: enter,
        borderTop: v === "top" ? stroke : undefined,
        borderBottom: v === "bottom" ? stroke : undefined,
        borderLeft: h === "left" ? stroke : undefined,
        borderRight: h === "right" ? stroke : undefined,
      }}
    />
  );
  return (
    <>
      {corner(left, top, "left", "top")}
      {corner(left + width, top, "right", "top")}
      {corner(left, top + height, "left", "bottom")}
      {corner(left + width, top + height, "right", "bottom")}
    </>
  );
};

/** One spec-sheet row: accent tick grows, value slams in from the left, label types out. `since` = frames since its cue. */
const StatRow: React.FC<{ value: string; label: string; since: number; out: number }> = ({ value, label, since, out }) => {
  const { colors, fonts } = useTheme();
  const ready = useFontsReady();
  const size = useMemo(
    () => (ready ? fitLines({ text: value, width: SPLIT.valueWidth - 26 - 24, maxSize: 76, minSize: 40, maxLines: 1, fontFamily: fonts.display }).size : 64),
    [ready, value, fonts.display],
  );
  if (since < 0) return null;
  const scale = interpolate(since, [0, 6], [1.45, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const opacity = interpolate(since, [0, 3], [0, 1], clamp) * (1 - out);
  const tick = interpolate(since, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const line = interpolate(since, [2, 14], [0, 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  const chars = Math.floor(interpolate(since, [4, 4 + label.length * 0.7], [0, label.length], clamp));
  return (
    <div
      style={{
        position: "relative",
        height: SPLIT.rowHeight,
        display: "flex",
        alignItems: "center",
        opacity,
        transform: `translateX(${-out * 60}px)`,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 18, bottom: 18, width: 6, background: colors.accent, transform: `scaleY(${tick})` }} />
      <div
        style={{
          width: SPLIT.valueWidth,
          paddingLeft: 26,
          flexShrink: 0,
          fontFamily: fonts.display,
          fontSize: size,
          lineHeight: 1,
          color: colors.highlight,
          whiteSpace: "nowrap",
          transform: `scale(${scale})`,
          transformOrigin: "left center",
          textShadow: "0 4px 24px rgba(0,0,0,0.8)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          flex: 1,
          paddingLeft: 8,
          fontFamily: fonts.mono,
          fontWeight: 700,
          fontSize: 21,
          lineHeight: 1.25,
          letterSpacing: 2,
          color: colors.text,
          textTransform: "uppercase",
          maxHeight: 54,
          overflow: "hidden",
        }}
      >
        {label.slice(0, chars)}
        {chars < label.length && <span style={{ color: colors.accent }}>█</span>}
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 1, width: `${line}%`, background: colors.line }} />
    </div>
  );
};

/**
 * Split-layout numbered segment: b-roll in a bracketed frame on the left, number, region and headline on the right,
 * then the stats build into a spec sheet (panels of SPLIT.perPanel). The map card shows briefly over the frame and
 * exits to the left.
 */
export const SplitSegment: React.FC<{ s: ResolvedSegment; slam: boolean }> = ({ s, slam }) => {
  const frame = useCurrentFrame();
  const { timeline, theme } = useEpisode();
  const { colors, fonts, effects, copy } = theme;
  const { seg } = s;
  const dur = s.to - s.from;
  const isTop = seg.emphasis === "top";
  const o = segmentOffset(slam);
  const { frame: box, column: col } = SPLIT;

  const shake = slam && frame >= 3 && frame < 14 ? (14 - frame) / 11 : 0;
  const sx = Math.sin(frame * 12.3) * 14 * shake;
  const sy = Math.cos(frame * 9.1) * 10 * shake;

  const frameIn = interpolate(frame, [10 + o, 20 + o], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const badgeIn = interpolate(frame, [14 + o, 22 + o], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const regionChars = Math.floor(interpolate(frame, [18 + o, 18 + o + seg.region.length * 0.8], [0, seg.region.length], clamp));
  const headlineWipe = interpolate(frame, [22 + o, 34 + o], [100, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const mapIn = interpolate(frame, [20 + o, 34 + o], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const alarmPulse = isTop ? (Math.sin(frame / 4) + 1) / 2 : 0;

  const statFrames = s.stats.map((st) => toFrame(st.at) - s.from);
  const activeStat = statFrames.reduce((acc, f, i) => (frame >= f ? i : acc), -1);
  const panels = Math.ceil(s.stats.length / SPLIT.perPanel);
  const panel = activeStat < 0 ? 0 : Math.floor(activeStat / SPLIT.perPanel);
  const panelStart = panel * SPLIT.perPanel;
  // The previous panel's rows clear out over the first few frames of a new panel; the new first row waits for them.
  const sincePanel = panel > 0 ? frame - statFrames[panelStart] : Infinity;
  const CLEAR = 6;
  const prevOut = interpolate(sincePanel, [0, CLEAR], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const showPrev = panel > 0 && sincePanel < CLEAR;

  const visuals: BackdropVisual[] = s.visuals.flatMap((v, i) =>
    v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, from: i === 0 ? 0 : toFrame(v.at) - s.from }] : [],
  );
  const visualIdx = visuals.reduce((acc, v, i) => (frame >= v.from ? i : acc), 0);
  const pad = (n: number) => String(n).padStart(2, "0");

  const rows = (from: number, out: number) =>
    s.stats.slice(from, from + SPLIT.perPanel).map((st, k) => {
      const i = from + k;
      const since = frame - statFrames[i] - (i === panelStart && panel > 0 && out === 0 ? CLEAR - 2 : 0);
      return i <= activeStat ? <StatRow key={i} value={st.value} label={st.label} since={since} out={out} /> : null;
    });

  return (
    <AbsoluteFill style={{ background: colors.bg, transform: `translate(${sx}px, ${sy}px)` }}>
      {/* faint grid behind everything */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${colors.line} 1px, transparent 1px), linear-gradient(90deg, ${colors.line} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          opacity: 0.35,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          overflow: "hidden",
          background: colors.panel,
          outline: `1px solid ${colors.line}`,
          opacity: 0.4 + 0.6 * frameIn,
        }}
      >
        {visuals.length ? (
          <Backdrop visuals={visuals} durationInFrames={dur} seed={s.num * 3} gradients={false} noteInset={18} tagInset={8} tagSize={14} />
        ) : (
          seg.map && (
            <AbsoluteFill style={{ opacity: 0.8 }}>
              <WorldMap width={box.width} height={box.height} focus={seg.map} showLabels={false} />
            </AbsoluteFill>
          )
        )}
        {visuals.length > 1 && (
          <div
            style={{
              position: "absolute",
              left: 18,
              top: 16,
              fontFamily: fonts.mono,
              fontSize: 16,
              letterSpacing: 3,
              color: colors.dim,
              background: colors.noteBg,
              padding: "4px 10px",
            }}
          >
            <span style={{ color: colors.accent }}>■</span> FILE {pad(s.num)} · {visualIdx + 1}/{visuals.length}
          </div>
        )}
      </div>
      <Brackets enter={frameIn} />

      {isTop && (
        <AbsoluteFill
          style={{ boxShadow: `inset 0 0 ${80 + alarmPulse * 120}px ${colors.accent}${Math.round((0.35 + alarmPulse * 0.35) * 255).toString(16).padStart(2, "0")}` }}
        />
      )}

      <div style={{ position: "absolute", left: col.left, top: col.top, width: col.width }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, opacity: badgeIn, transform: `translateX(${(1 - badgeIn) * 60}px)` }}>
          <span style={{ fontFamily: fonts.display, fontSize: 150, lineHeight: 0.8, color: colors.accent, textShadow: effects.accentGlow(40) }}>{pad(s.num)}</span>
          {timeline.format === "list" && (
            <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 26, letterSpacing: 4, color: colors.dim, marginBottom: 8 }}>OF {pad(timeline.total)}</span>
          )}
          {isTop && (
            <span
              style={{
                fontFamily: fonts.mono,
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: 4,
                color: colors.onAccent,
                background: colors.accent,
                padding: "6px 12px",
                marginBottom: 8,
                opacity: 0.6 + alarmPulse * 0.4,
              }}
            >
              {seg.emphasisLabel ?? copy.topEmphasisLabel}
            </span>
          )}
        </div>
        <div style={{ marginTop: 16, fontFamily: fonts.mono, fontWeight: 700, fontSize: 24, letterSpacing: 5, color: colors.highlight }}>
          {seg.region.slice(0, regionChars)}
        </div>
        <Headline text={seg.headline} width={col.width} wipe={headlineWipe} maxSize={76} minSize={44} maxLines={2} />
      </div>

      <div style={{ position: "absolute", left: col.left, top: SPLIT.statsTop, width: col.width }}>
        {panels > 1 && activeStat >= 0 && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: -30,
              fontFamily: fonts.mono,
              fontSize: 17,
              letterSpacing: 3,
              color: colors.dim,
            }}
          >
            {copy.panelLabel ?? "PANEL"} <span style={{ color: colors.accent }}>{panel + 1}</span> / {panels}
          </div>
        )}
        {showPrev && <div style={{ position: "absolute", left: 0, right: 0, top: 0 }}>{rows(panelStart - SPLIT.perPanel, prevOut)}</div>}
        {rows(panelStart, 0)}
      </div>

      {seg.map && visuals.length > 0 && (
        <LocatorCard map={seg.map} enter={mapIn} mapDelay={20 + o} exit={frame - (MAP_EXIT + o)} side="left" left={box.left + 48} top={box.top + 40} />
      )}

      {slam && (
        <Sequence durationInFrames={24} layout="none">
          <NumberSlam num={s.num} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
