import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, useEpisode } from "../context";
import { licenseLabel } from "../lib/credits";
import type { Credit } from "../schema";

type Row = { who: string; what: string };

/** One row per author + license (repeat files by the same author collapse into one line). */
const rows = (credits: Credit[]): Row[] => {
  const seen = new Map<string, Row>();
  for (const c of credits) {
    const key = `${c.author}|${licenseLabel(c)}`;
    if (!seen.has(key)) seen.set(key, { who: c.author, what: licenseLabel(c) });
  }
  return [...seen.values()];
};

/** Closing roll of media credits (footage, images, AI illustrations, music and sound, map data). */
export const CreditsCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { credits, theme } = useEpisode();
  const { colors, fonts, effects } = theme;
  const fade = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  const left: { heading: string; items: Row[] }[] = [{ heading: "FOOTAGE & IMAGES", items: rows(credits.visuals) }];
  // One row per generator (FLUX 3 via Replicate, Z-Image Turbo locally), from each credit's author line.
  if (credits.generated.length) left.push({ heading: "AI ILLUSTRATIONS", items: [...new Set(credits.generated.map((c) => c.author))].map((who) => ({ who, what: "" })) });
  const right = [
    { heading: "MUSIC & SOUND", items: rows(credits.audio) },
    { heading: "MAP DATA", items: [{ who: "Natural Earth via world-atlas", what: "Public domain" }] },
  ];
  const count = (col: typeof left) => col.reduce((n, g) => n + g.items.length + 1.6, 0);
  const size = Math.max(17, Math.min(30, 700 / (Math.max(count(left), count(right)) * 1.45)));

  const Column: React.FC<{ groups: typeof left; delay: number }> = ({ groups, delay }) => (
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
