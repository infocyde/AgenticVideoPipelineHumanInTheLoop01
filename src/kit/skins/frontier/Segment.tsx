// Frontier's numbered segment ("spatial" layout, 1920×1080): media in a floating window on the right, number,
// region and headline on the left, stats as a row of up to three metric tiles under the window, the map in a glass
// card over the window's corner that collapses to a line and away.
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { BackdropVisual } from "../../components/Backdrop";
import { fitLines, useFontsReady } from "../../components/Headline";
import { clamp, useEpisode, useTheme } from "../../context";
import type { ResolvedSegment, ResolvedStat } from "../../lib/resolve";
import { MAP_EXIT, MAP_GLITCH, MAP_SLIDE, segmentOffset, toFrame } from "../../lib/timing";
import type { MapFocus } from "../../schema";
import { DotMap } from "./DotMap";
import { Chip, countUp, counts, Decode, F, Field, GradientText, pad2, prog, RiseLines } from "./fx";
import { type Box, MediaStack, visualLabel, Window, windowEnter } from "./Media";

/** Geometry of the spatial layout. Captions sit under the left column while a segment is up. */
export const SPATIAL = {
  window: { left: 760, top: 150, width: 1060, height: 596 } as Box,
  column: { left: 110, top: 150, width: 590 },
  tiles: { top: 782, height: 170, gap: 20, max: 3 },
  captions: { left: 110, width: 600, bottom: 96, fontSize: 48 },
  badge: { x: 110, y: 150, size: 128 },
};

// ------------------------------------------------------------------------------------------------ headline

/** Headline in Geist, as written (no forced caps), fitted to ≤ maxLines, rising in line by line. */
export const FrontierHeadline: React.FC<{ text: string; since: number; width: number; maxSize: number; minSize: number; maxLines: number; color?: string }> = ({
  text,
  since,
  width,
  maxSize,
  minSize,
  maxLines,
  color,
}) => {
  const { fonts, colors } = useTheme();
  const ready = useFontsReady();
  const fit = useMemo(
    () => (ready ? fitLines({ text, width, maxSize, minSize, maxLines, fontFamily: fonts.body, fontWeight: F.weights.headline, letterSpacing: -maxSize * 0.02 }) : null),
    [ready, text, width, maxSize, minSize, maxLines, fonts.body],
  );
  if (!fit || since < 0) return null;
  return (
    <RiseLines
      lines={fit.lines}
      since={since}
      size={fit.size}
      lineHeight={1.02}
      style={{ fontFamily: fonts.body, fontWeight: F.weights.headline, letterSpacing: `${-0.02}em`, color: color ?? colors.text, textShadow: "0 6px 30px rgba(2,3,8,0.7)" }}
    />
  );
};

/** The segment's `subhead` (e.g. the product name): a gradient tick and decoding mono caps under the headline. */
export const Subhead: React.FC<{ text: string; since: number; size: number }> = ({ text, since, size }) => {
  const { fonts } = useTheme();
  const p = prog(since, 0, 10);
  if (since < 0) return null;
  return (
    <div style={{ marginTop: size * 0.5, display: "flex", alignItems: "center", gap: size * 0.45, opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>
      <span style={{ width: size * 1.1 * p, height: 3, borderRadius: 2, background: F.iris, boxShadow: `0 0 10px ${F.cyan}`, flexShrink: 0 }} />
      <span style={{ fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: size, letterSpacing: size * 0.08, textTransform: "uppercase", color: F.cyan, whiteSpace: "nowrap", textShadow: "0 0 18px rgba(61,240,255,0.35)" }}>
        <Decode text={text} since={since} per={0.6} scramble={6} glyphColor={F.violet} />
      </span>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ the number boot

/**
 * Frames 0–22 of a countdown segment (same window as the shared number slam, so the "slam" sound still lands):
 * a ring of ticks charges around an outlined numeral while its gradient fill rises, then the numeral flies into the
 * segment's number badge at the top left.
 */
export const IndexBoot: React.FC<{ num: number; target: { x: number; y: number; size: number } }> = ({ num, target }) => {
  const frame = useCurrentFrame();
  const { fonts } = useTheme();
  if (frame > 22) return null;
  const size = 400;
  const charge = prog(frame, 0, 12, Easing.out(Easing.quad));
  const fill = prog(frame, 2, 9, Easing.out(Easing.cubic));
  const fly = prog(frame, 14, 8, Easing.inOut(Easing.cubic));
  const appear = prog(frame, 0, 5, Easing.out(Easing.exp));
  const scale = (0.86 + 0.14 * appear) * (1 - fly * (1 - target.size / size));
  const label = pad2(num);
  // Numeral center now vs. where the badge numeral's center is.
  const tw = label.length * target.size * 0.78;
  const cx = 960 + (target.x + tw / 2 - 960) * fly;
  const cy = 540 + (target.y + target.size * 0.5 - 540) * fly;
  const ticks = 72;
  return (
    <AbsoluteFill style={{ background: `rgba(5,6,10,${0.72 * (1 - fly)})` }}>
      <svg width={1920} height={1080} style={{ position: "absolute", opacity: 1 - fly * 1.6 }}>
        <g transform="translate(960,540)">
          <circle r={262} fill="none" stroke="rgba(160,180,255,0.14)" strokeWidth={2} />
          <circle
            r={262}
            fill="none"
            stroke={F.cyan}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 262 * charge} 9999`}
            transform="rotate(-90)"
            style={{ filter: `drop-shadow(0 0 10px ${F.cyan})` }}
          />
          {Array.from({ length: ticks }, (_, i) => {
            const on = i / ticks < charge;
            const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
            const r1 = 290, r2 = i % 6 === 0 ? 318 : 304;
            return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} stroke={on ? (i % 6 === 0 ? F.lime : F.violet) : "rgba(160,180,255,0.18)"} strokeWidth={i % 6 === 0 ? 3 : 2} />;
          })}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: `translate(-50%, -50%) scale(${scale})`,
          fontFamily: fonts.display,
          fontWeight: F.weights.display,
          fontSize: size,
          lineHeight: 1,
          opacity: appear * (1 - Math.max(0, fly - 0.75) * 4),
        }}
      >
        {/* glow: a blurred copy underneath (a filter on the clipped gradient layer would paint its box) */}
        <span style={{ position: "absolute", left: 0, top: 0, color: F.cyan, opacity: 0.45 * fill, filter: "blur(28px)" }}>{label}</span>
        <span style={{ position: "relative", color: "transparent", WebkitTextStroke: `3px ${F.cyan}` }}>{label}</span>
        <span style={{ position: "absolute", left: 0, top: 0, clipPath: `inset(${(1 - fill) * 100}% 0 0 0)` }}>
          <GradientText gradient={F.numeral} style={{ backgroundSize: "100% 100%" }}>
            {label}
          </GradientText>
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------------------------------------ metric tiles

const Tile: React.FC<{ st: ResolvedStat; since: number; active: boolean; width: number; height: number }> = ({ st, since, active, width, height }) => {
  const { fonts, colors } = useTheme();
  const ready = useFontsReady();
  const pad = 22;
  const fit = useMemo(
    () => (ready ? fitLines({ text: st.value, width: width - 2 * pad, maxSize: Math.min(62, height - 106), minSize: 28, maxLines: 1, fontFamily: fonts.display, fontWeight: F.weights.display }).size : 48),
    [ready, st.value, width, height, fonts.display],
  );
  const count = prog(since, 2, 20, Easing.out(Easing.cubic));
  const spark = prog(since, 4, 18);
  const value = counts(st.value) ? countUp(st.value, count) : null;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 20,
        padding: 1.5,
        background: active ? F.iris : colors.line,
        boxShadow: active ? "0 0 40px rgba(61,240,255,0.25), 0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ position: "relative", height: "100%", borderRadius: 18.5, background: active ? F.glassHi : F.glass, backdropFilter: "blur(16px)", padding: `16px ${pad}px`, overflow: "hidden" }}>
        <div
          style={{
            height: 46,
            fontFamily: fonts.mono,
            fontWeight: F.weights.monoBold,
            fontSize: 17,
            lineHeight: 1.3,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: active ? colors.text : colors.dim,
            overflow: "hidden",
          }}
        >
          <Decode text={st.label} since={since - 3} per={0.45} scramble={5} glyphColor={F.violet} seed={st.label.length} />
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: fonts.display,
            fontWeight: F.weights.display,
            fontSize: fit,
            lineHeight: 1.05,
            whiteSpace: "nowrap",
            color: active ? F.lime : colors.text,
            textShadow: active ? "0 0 26px rgba(200,255,61,0.35)" : undefined,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value ?? <Decode text={st.value} since={since} per={0.8} scramble={6} glyphColor={F.lime} />}
        </div>
        <div style={{ position: "absolute", left: pad, right: pad, bottom: 16, height: 3, borderRadius: 2, background: "rgba(160,180,255,0.12)" }}>
          <div style={{ width: `${spark * 100}%`, height: "100%", borderRadius: 2, background: active ? F.iris : "rgba(160,180,255,0.4)", boxShadow: active ? `0 0 10px ${F.cyan}` : undefined }} />
        </div>
      </div>
    </div>
  );
};

/** Up to `max` tiles in a row; each new stat enters on its cue at the right and the row slides left to make room. */
export const MetricRow: React.FC<{ stats: ResolvedStat[]; statFrames: number[]; left: number; top: number; width: number; height: number; gap: number; max: number }> = ({
  stats,
  statFrames,
  left,
  top,
  width,
  height,
  gap,
  max,
}) => {
  const frame = useCurrentFrame();
  const shown = statFrames.filter((f) => frame >= f).length;
  if (!shown) return null;
  const tileW = (width - gap * (max - 1)) / max;
  const since = frame - statFrames[shown - 1];
  const shift = prog(since, 0, 12, Easing.inOut(Easing.cubic));
  const startNow = Math.max(0, shown - max);
  const startPrev = Math.max(0, shown - 1 - max);
  return (
    <div style={{ position: "absolute", left, top, width, height }}>
      {stats.slice(0, shown).map((st, i) => {
        const slot = interpolate(shift, [0, 1], [i - startPrev, i - startNow]);
        if (slot < -0.99) return null;
        const s = frame - statFrames[i];
        const enter = prog(s, 0, 12, Easing.out(Easing.back(1.4)));
        const exit = slot < 0 ? -slot : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: slot * (tileW + gap),
              top: 0,
              opacity: Math.min(1, s / 4) * (1 - exit),
              transform: `translateY(${(1 - enter) * 40}px) scale(${0.96 + 0.04 * enter - exit * 0.08})`,
            }}
          >
            <Tile st={st} since={s} active={i === shown - 1} width={tileW} height={height} />
          </div>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ map card

/** Glass map card; at `exit` = 0 it collapses to a bright line (MAP_GLITCH frames) and the line shrinks away (MAP_SLIDE). */
export const GeoCard: React.FC<{ map: MapFocus; enter: number; mapDelay: number; exit: number; box: Box }> = ({ map, enter, mapDelay, exit, box }) => {
  const { fonts, colors, copy } = useTheme();
  if (exit >= MAP_GLITCH + MAP_SLIDE) return null;
  const sy = interpolate(exit, [0, MAP_GLITCH - 1], [1, 0.012], { ...clamp, easing: Easing.in(Easing.cubic) });
  const sx = interpolate(exit, [MAP_GLITCH, MAP_GLITCH + MAP_SLIDE - 1], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) });
  const line = exit >= MAP_GLITCH - 3;
  const pin = map.pins[0];
  const head = 46;
  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 30}px) scale(${(0.95 + 0.05 * enter) * sx}, ${sy})`,
        borderRadius: 20,
        padding: 1.5,
        background: line ? "#f2fdff" : F.iris,
        boxShadow: line ? `0 0 30px 6px ${F.cyan}` : "0 30px 70px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ height: "100%", borderRadius: 18.5, background: "rgba(7,8,16,0.9)", overflow: "hidden", position: "relative" }}>
        <div
          style={{
            height: head,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            borderBottom: `1px solid ${colors.line}`,
            fontFamily: fonts.mono,
            fontWeight: F.weights.monoBold,
            fontSize: 16,
            letterSpacing: 3,
            color: colors.dim,
          }}
        >
          <span>
            <span style={{ color: F.lime }}>◆</span> {copy.locatorLabel}
          </span>
          {pin && (
            <span style={{ color: colors.text }}>
              {pin.lat.toFixed(2)}°, {pin.lon.toFixed(2)}°
            </span>
          )}
        </div>
        <Sequence from={mapDelay} layout="none">
          <DotMap width={box.width - 3} height={box.height - head - 3} focus={map} pitch={6} />
        </Sequence>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ top item frame

/** The `emphasis: "top"` treatment: a rotating iridescent border around the whole frame and a breathing inner glow. */
export const TopFrame: React.FC = () => {
  const frame = useCurrentFrame();
  const breathe = (Math.sin(frame / 7) + 1) / 2;
  const ring = `conic-gradient(from ${frame * 3}deg, ${F.cyan}, ${F.violet}, ${F.magenta}, ${F.lime}, ${F.cyan})`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          padding: 5,
          background: ring,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          opacity: 0.75 + 0.25 * breathe,
        }}
      />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${90 + breathe * 90}px rgba(139,107,255,${0.25 + breathe * 0.2})` }} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------------------------------------ the scene

export const visualsOf = (list: { name: string; asset: BackdropVisual["asset"] | null; note?: string; grade?: boolean; at: number }[], from: number): BackdropVisual[] =>
  list.flatMap((v, i) => (v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, from: i === 0 ? 0 : toFrame(v.at) - from }] : []));

export const FrontierSegment: React.FC<{ s: ResolvedSegment; slam: boolean }> = ({ s, slam }) => {
  const frame = useCurrentFrame();
  const { timeline, theme } = useEpisode();
  const { fonts, colors, copy } = theme;
  const { seg } = s;
  const dur = s.to - s.from;
  const isTop = seg.emphasis === "top";
  const o = segmentOffset(slam);
  const { window: win, column: col, tiles, badge } = SPATIAL;

  const winIn = windowEnter(frame, 8 + o);
  const badgeIn = prog(frame, 14 + o, 8);
  const mapIn = prog(frame, 20 + o, 14);
  const statFrames = s.stats.map((st) => toFrame(st.at) - s.from);
  const visuals = visualsOf(s.visuals, s.from);
  const ripple = slam ? frame - 12 : frame - 2;

  return (
    <AbsoluteFill>
      <Field ripple={ripple} cx="25%" cy="22%" />

      <Window box={win} enter={winIn} label={visualLabel(visuals, frame)} glow={isTop ? 0.6 : 0}>
        {visuals.length ? (
          <MediaStack visuals={visuals} durationInFrames={dur} seed={s.num * 3} />
        ) : seg.map ? (
          <DotMap width={win.width - 4} height={win.height - 4} focus={seg.map} showLabels />
        ) : (
          <Field ripple={frame - 10} />
        )}
      </Window>

      {isTop && <TopFrame />}

      <div style={{ position: "absolute", left: col.left, top: col.top, width: col.width }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, opacity: slam ? (frame >= 20 ? 1 : 0) : badgeIn, transform: slam ? undefined : `translateX(${(1 - badgeIn) * -40}px)` }}>
          <span style={{ fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: badge.size, lineHeight: 1, filter: "drop-shadow(0 0 24px rgba(61,240,255,0.35))" }}>
            <GradientText gradient={F.numeral} style={{ backgroundSize: "100% 100%" }}>
              {pad2(s.num)}
            </GradientText>
          </span>
          {timeline.format === "list" && (
            <span style={{ fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 26, letterSpacing: 4, color: colors.dim, marginBottom: 14 }}>/ {pad2(timeline.total)}</span>
          )}
        </div>
        <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap", minHeight: 50 }}>
          {isTop && (
            <div
              style={{
                fontFamily: fonts.mono,
                fontWeight: F.weights.monoBold,
                fontSize: 22,
                letterSpacing: 4,
                color: F.ink,
                background: F.iris,
                borderRadius: 999,
                padding: "8px 18px",
                opacity: badgeIn,
              }}
            >
              {seg.emphasisLabel ?? copy.topEmphasisLabel}
            </div>
          )}
          <Chip text={seg.region} since={frame - (18 + o)} size={22} />
        </div>
        <div style={{ marginTop: 26 }}>
          <FrontierHeadline text={seg.headline} since={frame - (22 + o)} width={col.width} maxSize={80} minSize={46} maxLines={seg.subhead ? 2 : 3} />
          {seg.subhead && <Subhead text={seg.subhead} since={frame - (34 + o)} size={34} />}
        </div>
      </div>

      <MetricRow stats={s.stats} statFrames={statFrames} left={win.left} top={tiles.top} width={win.width} height={tiles.height} gap={tiles.gap} max={tiles.max} />

      {seg.map && visuals.length > 0 && (
        <GeoCard map={seg.map} enter={mapIn} mapDelay={20 + o} exit={frame - (MAP_EXIT + o)} box={{ left: win.left + 34, top: win.top + 34, width: 520, height: 350 }} />
      )}

      {slam && (
        <Sequence durationInFrames={24} layout="none">
          <IndexBoot num={s.num} target={{ x: col.left, y: col.top, size: badge.size }} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
