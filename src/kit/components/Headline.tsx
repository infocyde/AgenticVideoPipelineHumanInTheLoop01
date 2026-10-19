import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { useTheme } from "../context";

/** True once the theme's fonts have loaded; holds the render until then. */
export const useFontsReady = () => {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender(`fonts for theme ${theme.id}`));
  useEffect(() => {
    let live = true;
    theme
      .fontsReady()
      .catch(() => undefined)
      .then(() => {
        if (live) setReady(true);
        continueRender(handle);
      });
    return () => {
      live = false;
    };
  }, [theme, handle]);
  return ready;
};

let ctx: CanvasRenderingContext2D | null = null;
const measure = (text: string, font: string, letterSpacing: number) => {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * 0.5 * parseFloat(font.split("px")[0].split(" ").pop() ?? "100");
  ctx.font = font;
  return ctx.measureText(text).width + letterSpacing * text.length;
};

export type FitOptions = {
  text: string;
  width: number;
  maxSize: number;
  minSize: number;
  maxLines: number;
  fontFamily: string;
  fontWeight?: number | string;
  letterSpacing?: number;
  uppercase?: boolean;
};

/**
 * Pick the largest font size whose wrapped lines fit `maxLines` without a one-word orphan on the last line.
 * Orphans are first fixed by pulling a word down from the line above; only if that fails does the size shrink.
 */
export const fitLines = (o: FitOptions): { size: number; lines: string[] } => {
  const words = (o.uppercase ? o.text.toUpperCase() : o.text).split(/\s+/).filter(Boolean);
  const ls = o.letterSpacing ?? 0;
  let fallback: { size: number; lines: string[] } | null = null;
  for (let size = o.maxSize; size >= o.minSize; size -= 4) {
    const font = `${o.fontWeight ?? 400} ${size}px ${o.fontFamily}`;
    const fits = (line: string) => measure(line, font, ls) <= o.width;
    const lines: string[][] = [];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if (cur && fits([...cur, w].join(" "))) cur.push(w);
      else lines.push([w]);
    }
    if (lines.some((l) => !fits(l.join(" ")))) continue; // a single word is wider than the box
    if (lines.length > o.maxLines) continue;
    fallback ??= { size, lines: lines.map((l) => l.join(" ")) };
    const last = lines[lines.length - 1];
    if (lines.length === 1 || last.length > 1) return { size, lines: lines.map((l) => l.join(" ")) };
    // Orphan: move words down from the previous line while it stays balanced and fits.
    const prev = lines[lines.length - 2];
    while (prev.length > 1 && last.length < 2) last.unshift(prev.pop()!);
    if (fits(last.join(" ")) && last.length > 1) return { size, lines: lines.map((l) => l.join(" ")) };
  }
  return fallback ?? { size: o.minSize, lines: [words.join(" ")] };
};

/** Segment headline: auto-fits to ≤3 lines with no orphan word, then wipes in from the left. */
export const Headline: React.FC<{ text: string; width: number; wipe: number; maxSize?: number; minSize?: number; maxLines?: number }> = ({
  text,
  width,
  wipe,
  maxSize = 104,
  minSize = 60,
  maxLines = 3,
}) => {
  const { fonts, colors, effects } = useTheme();
  const ready = useFontsReady();
  const fit = useMemo(
    () => (ready ? fitLines({ text, width, maxSize, minSize, maxLines, fontFamily: fonts.display, uppercase: true }) : null),
    [ready, text, width, maxSize, minSize, maxLines, fonts.display],
  );
  if (!fit) return null;
  return (
    <div
      style={{
        marginTop: 8,
        fontFamily: fonts.display,
        fontSize: fit.size,
        lineHeight: 1.0,
        color: colors.text,
        textTransform: "uppercase",
        clipPath: `inset(0 ${wipe}% 0 0)`,
        textShadow: effects.textShadow,
        whiteSpace: "nowrap",
      }}
    >
      {fit.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
};
