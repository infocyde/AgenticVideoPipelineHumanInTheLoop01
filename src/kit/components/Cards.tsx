// Segment overlays: the countdown number slam, stat callouts and the locator map card.
import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { clamp, useTheme } from "../context";
import { MAP_GLITCH, MAP_SLIDE } from "../lib/timing";
import type { MapFocus } from "../schema";
import { WorldMap } from "./WorldMap";

/** Huge numeral that slams in over a dark scrim, then gets out of the way (frames 0–22). */
export const NumberSlam: React.FC<{ num: number }> = ({ num }) => {
  const frame = useCurrentFrame();
  const { colors, fonts, effects } = useTheme();
  if (frame > 22) return null;
  const scale =
    frame < 14
      ? interpolate(frame, [0, 5], [2.4, 1], { ...clamp, easing: Easing.out(Easing.exp) })
      : interpolate(frame, [14, 22], [1, 0.55], { ...clamp, easing: Easing.in(Easing.cubic) });
  const opacity = frame < 14 ? interpolate(frame, [0, 3], [0, 1], clamp) : interpolate(frame, [14, 22], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", background: `rgba(0,0,0,${0.55 * opacity})` }}>
      <div style={{ fontFamily: fonts.display, fontSize: 760, lineHeight: 1, color: colors.accent, transform: `scale(${scale})`, opacity, textShadow: effects.accentGlow(80) }}>
        {num}
      </div>
    </AbsoluteFill>
  );
};

/** Stat callout: value slams in, accent bar grows, label types out. `since` = frames since its cue. */
export const StatCard: React.FC<{ value: string; label: string; since: number }> = ({ value, label, since }) => {
  const { colors, fonts } = useTheme();
  const scale = interpolate(since, [0, 6], [1.5, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const opacity = interpolate(since, [0, 3], [0, 1], clamp);
  const bar = interpolate(since, [2, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const chars = Math.floor(interpolate(since, [4, 4 + label.length * 0.7], [0, label.length], clamp));
  return (
    <div style={{ marginTop: 34, opacity }}>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 150,
          lineHeight: 0.95,
          color: colors.highlight,
          transform: `scale(${scale})`,
          transformOrigin: "left center",
          textShadow: "0 6px 30px rgba(0,0,0,0.8)",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      <div style={{ height: 6, width: 420 * bar, background: colors.accent, margin: "14px 0 12px" }} />
      <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: colors.text, textTransform: "uppercase" }}>
        {label.slice(0, chars)}
        {chars < label.length && <span style={{ color: colors.accent }}>█</span>}
      </div>
    </div>
  );
};

/**
 * Map card: slides in from its side, then the map zooms to the focus box with pins.
 * `exit` = frames since its exit began: a short RGB-split glitch, then it snaps off the same side to clear the b-roll.
 * `side` defaults to the right (overlay layout); the split layout puts it over the framed b-roll on the left.
 */
export const LocatorCard: React.FC<{ map: MapFocus; enter: number; mapDelay: number; exit: number; side?: "left" | "right"; left?: number; top?: number }> = ({
  map,
  enter,
  mapDelay,
  exit,
  side = "right",
  left = 100,
  top = 150,
}) => {
  const { colors, fonts, copy, effects } = useTheme();
  const slide = interpolate(exit, [MAP_GLITCH, MAP_GLITCH + MAP_SLIDE], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (slide >= 1) return null;
  const pin = map.pins[0];
  const glitch = exit >= 0 && exit < MAP_GLITCH + 3 ? 1 - Math.max(0, exit - MAP_GLITCH) / 3 : 0;
  const jx = glitch * Math.sin(exit * 7.7) * 22;
  const split = glitch * (4 + (exit % 3) * 4);
  const flicker = glitch && exit % 4 === 1 ? 0.45 : 1;
  const dir = side === "right" ? 1 : -1;
  return (
    <div
      style={{
        position: "absolute",
        ...(side === "right" ? { right: 100, top: 150 } : { left, top }),
        width: 580,
        background: colors.panel,
        border: `1px solid ${colors.line}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        opacity: flicker,
        filter: split ? `drop-shadow(${split}px 0 0 ${effects.glitchColors[0]}) drop-shadow(${-split}px 0 0 ${effects.glitchColors[1]})` : undefined,
        transform: `translateX(${dir * ((1 - enter) * 700 + slide * 820) + jx}px) skewX(${glitch * Math.sin(exit * 3.3) * 6 - dir * slide * 10}deg)`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: `1px solid ${colors.line}`,
          fontFamily: fonts.mono,
          fontSize: 16,
          letterSpacing: 3,
          color: colors.dim,
        }}
      >
        <span>
          <span style={{ color: colors.accent }}>■</span> {copy.locatorLabel}
        </span>
        <span>
          {pin.lat.toFixed(1)}°, {pin.lon.toFixed(1)}°
        </span>
      </div>
      <Sequence from={mapDelay} layout="none">
        <WorldMap width={580} height={380} focus={map} />
      </Sequence>
    </div>
  );
};
