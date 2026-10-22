import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, useEpisode } from "../context";
import { type CreditGroup, creditColumns, type UsedCredits } from "../lib/credits";
import type { Theme } from "../themes";

/**
 * Credits roll (footage, images, AI illustrations, music and sound, map data) on one page. `columns` overrides the
 * groups shown, for a roll split over several pages (music videos, creditPages()).
 */
export const CreditsRoll: React.FC<{ credits: UsedCredits; theme: Theme; mapData: boolean; columns?: { left: CreditGroup[]; right: CreditGroup[] } }> = ({
  credits,
  theme,
  mapData,
  columns,
}) => {
  const frame = useCurrentFrame();
  const { colors, fonts, effects } = theme;
  const fade = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const { left, right } = columns ?? creditColumns(credits, mapData);
  const count = (col: CreditGroup[]) => col.reduce((n, g) => n + g.items.length + 1.6, 0);
  const size = Math.max(17, Math.min(30, 700 / (Math.max(count(left), count(right)) * 1.45)));

  const Column: React.FC<{ groups: CreditGroup[]; delay: number }> = ({ groups, delay }) => (
    <div style={{ flex: 1, opacity: interpolate(frame, [delay, delay + 12], [0, 1], clamp) }}>
      {groups.map((g) => (
        <div key={g.heading} style={{ marginBottom: size * 1.1 }}>
          <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: size * 0.8, letterSpacing: 4, color: colors.highlight, marginBottom: size * 0.4 }}>{g.heading}</div>
          {g.items.map((r, i) => (
            <div key={i} style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: size, lineHeight: 1.35, color: colors.text }}>
              {r.who}
              {r.what && <span style={{ fontFamily: fonts.mono, fontWeight: 400, fontSize: size * 0.72, color: colors.dim, marginLeft: 14 }}>{r.what}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: colors.bg, opacity: fade }}>
      <AbsoluteFill style={{ background: effects.outroScrim }} />
      <div style={{ position: "absolute", left: 160, right: 160, top: 110 }}>
        <div style={{ fontFamily: fonts.display, fontSize: 96, lineHeight: 1, color: colors.accent, textShadow: effects.accentGlow(40), letterSpacing: 4 }}>CREDITS</div>
        <div style={{ height: 6, width: 220, background: colors.accent, margin: "16px 0 40px" }} />
        <div style={{ display: "flex", gap: 90 }}>
          <Column groups={left} delay={6} />
          <Column groups={right} delay={12} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Closing roll of media credits for news episodes and Shorts. */
export const CreditsCard: React.FC = () => {
  const { credits, theme } = useEpisode();
  return <CreditsRoll credits={credits} theme={theme} mapData />;
};
