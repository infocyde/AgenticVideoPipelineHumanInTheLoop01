// Big type for the cold open and outro: stamps, the title card, the all-fronts map, slam lines and the CTA.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, useTheme } from "../context";
import { WIDTH } from "../lib/timing";
import type { Pin } from "../schema";
import { WorldMap } from "./WorldMap";

/** Rubber-stamp text that slams in tilted, with a mono subline. */
export const Stamp: React.FC<{ text: string; sub?: string }> = ({ text, sub }) => {
  const frame = useCurrentFrame();
  const { colors, fonts, effects } = useTheme();
  const s = interpolate(frame, [0, 6], [1.8, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const o = interpolate(frame, [0, 3], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 120, top: 380, opacity: o, transform: `scale(${s}) rotate(-3deg)`, transformOrigin: "left center" }}>
      <div
        style={{
          display: "inline-block",
          border: `6px solid ${colors.accent}`,
          padding: "10px 26px",
          fontFamily: fonts.display,
          fontSize: 120,
          lineHeight: 1,
          color: colors.accent,
          letterSpacing: 4,
          textShadow: effects.accentGlow(30),
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      {sub && <div style={{ marginTop: 18, fontFamily: fonts.mono, fontWeight: 700, fontSize: 28, letterSpacing: 6, color: colors.text }}>{sub}</div>}
    </div>
  );
};

/** World map with one pin per segment and a headline across the top ("EVERY FRONT"). */
export const EveryFront: React.FC<{ pins: Pin[]; text: string; accent?: string }> = ({ pins, text, accent }) => {
  const frame = useCurrentFrame();
  const { colors, fonts } = useTheme();
  const z = interpolate(frame, [0, 90], [1.0, 1.08]);
  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <AbsoluteFill style={{ transform: `scale(${z})`, justifyContent: "center", alignItems: "center" }}>
        <WorldMap width={WIDTH} height={1000} allPins={pins} pinDelay={0} zoomFrames={1} showLabels={false} />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 120,
          textAlign: "center",
          fontFamily: fonts.display,
          fontSize: 130,
          color: colors.text,
          letterSpacing: 6,
          textShadow: `0 8px 40px ${colors.bg}`,
        }}
      >
        {text}
        {accent && <span style={{ color: colors.accent }}> {accent}</span>}
      </div>
    </AbsoluteFill>
  );
};

/** "THE WEEK IN / 10 / FLASHPOINTS": kicker fades in, the big text slams at `bigAt` (frames), rule grows. */
export const TitleCard: React.FC<{ kicker: string; big: string; small: string; bigAt: number }> = ({ kicker, big, small, bigAt }) => {
  const frame = useCurrentFrame();
  const { colors, fonts, effects } = useTheme();
  const since = frame - bigAt;
  const s = interpolate(since, [0, 6], [2.2, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const o = interpolate(since, [0, 3], [0, 1], clamp);
  const rule = interpolate(frame, [bigAt + 10, bigAt + 20], [0, 1], clamp);
  const pre = interpolate(frame, [0, 8], [0, 1], clamp);
  const bigSize = big.length <= 2 ? 380 : big.length <= 4 ? 300 : 220;
  return (
    <AbsoluteFill style={{ background: colors.bg, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 34, letterSpacing: 14, color: colors.dim, opacity: pre }}>{kicker}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 10 }}>
        <span style={{ fontFamily: fonts.display, fontSize: bigSize, lineHeight: 1, color: colors.accent, opacity: o, transform: `scale(${s})`, textShadow: effects.accentGlow(90) }}>
          {big}
        </span>
        <span style={{ fontFamily: fonts.display, fontSize: 150, lineHeight: 0.95, color: colors.text, opacity: o, whiteSpace: "pre" }}>{small}</span>
      </div>
      <div style={{ marginTop: 20, height: 6, width: 900 * rule, background: colors.accent }} />
    </AbsoluteFill>
  );
};

/** A line of display type that slams in; `since` = frames since it appears. */
export const SlamText: React.FC<{ since: number; size: number; text: string; accent?: string }> = ({ since, size, text, accent }) => {
  const { colors, fonts } = useTheme();
  if (since < 0) return null;
  const s = interpolate(since, [0, 6], [1.8, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const o = interpolate(since, [0, 3], [0, 1], clamp);
  return (
    <div style={{ fontFamily: fonts.display, fontSize: size, lineHeight: 1, color: colors.text, opacity: o, transform: `scale(${s})`, textShadow: `0 8px 40px ${colors.bg}`, letterSpacing: 3 }}>
      {text}
      {accent && <span style={{ color: colors.accent }}> {accent}</span>}
    </div>
  );
};

/** Subscribe button that pops in, gets clicked by a cursor (at frame 14) and flips to its "done" state. */
export const SubscribeCTA: React.FC<{ since: number; label: string; doneLabel: string }> = ({ since, label, doneLabel }) => {
  const { colors, fonts, effects } = useTheme();
  if (since < 0) return null;
  const click = since - 14;
  const btnScale = interpolate(since, [0, 7], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }) * (click >= 0 && click < 6 ? 0.92 : 1);
  const done = click >= 3;
  const cursorX = interpolate(since, [0, 14], [380, 120], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cursorY = interpolate(since, [0, 14], [220, 40], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "relative", marginTop: 50 }}>
      <div
        style={{
          transform: `scale(${btnScale})`,
          background: done ? colors.ctaDone : colors.accent,
          color: colors.onAccent,
          fontFamily: fonts.body,
          fontWeight: 800,
          fontSize: 48,
          letterSpacing: 2,
          padding: "22px 60px",
          borderRadius: 60,
          boxShadow: done || effects.accentGlow(50) === "none" ? "none" : `0 0 50px ${colors.accent}99`,
          whiteSpace: "nowrap",
        }}
      >
        {done ? doneLabel : label}
      </div>
      <svg width="60" height="60" viewBox="0 0 24 24" style={{ position: "absolute", left: cursorX + 200, top: cursorY + 30 }}>
        <path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" fill="#fff" stroke="#000" strokeWidth={1.2} />
      </svg>
    </div>
  );
};

/** Frames after which the CTA's click sound should play. */
export const CTA_CLICK_FRAME = 17;
