// Asked Claude: the pieces every scene uses. A paper page, the quote-mark brand mark, the small mono label, fitted
// serif type, and the "print": footage or an image shown whole in a framed card beside the text, never under it.
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { BackdropVisual } from "../../components/Backdrop";
import { fitLines, useFontsReady } from "../../components/Headline";
import { SourceTag } from "../../components/SourceTag";
import { clamp, useTheme } from "../../context";
import type { Asset } from "../../lib/resolve";
import { FPS, toFrame } from "../../lib/timing";
import { tagChannel } from "../../lib/youtube";
import { AC } from "../../themes/asked-claude";

export { AC };
export const ease = Easing.out(Easing.cubic);
export const easeIO = Easing.inOut(Easing.cubic);
/** 0 → 1 over `dur` frames from `t0`. */
export const prog = (frame: number, t0: number, dur: number, e = ease) => interpolate(frame, [t0, t0 + dur], [0, 1], { ...clamp, easing: e });

/** The 16:9 page: text column on the left, the print on the right, captions across the bottom. */
export const PAGE = {
  column: { left: 120, top: 200, width: 730 },
  print: { left: 930, top: 172, width: 870, height: 504 },
  captions: { left: 140, right: 140, bottom: 72, fontSize: 44 },
  /** A section with no visual: the text alone, centered and larger. */
  solo: { left: 260, top: 210, width: 1400 },
  /** layout "full": the print large and centered. */
  full: { left: 270, top: 150, width: 1380, height: 776 },
};

/** Warm paper with a soft light from the top left and a faint ruled margin. */
export const Paper: React.FC<{ quote?: boolean; quoteOpacity?: number }> = ({ quote = false, quoteOpacity = 0.06 }) => {
  const { fonts } = useTheme();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 120% 90% at 18% 8%, #fbf7ef 0%, ${AC.paper} 46%, ${AC.paperDeep} 100%)` }}>
      <div style={{ position: "absolute", left: 76, top: 0, bottom: 0, width: 1.5, background: "rgba(194,96,61,0.16)" }} />
      {quote && (
        <div style={{ position: "absolute", right: 80, top: 330, fontFamily: fonts.display, fontSize: 900, lineHeight: 1, color: AC.clay, opacity: quoteOpacity }}>
          {"”"}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** The brand mark: an open quote in a clay rounded square ("someone asked; here's what I think"). */
export const Mark: React.FC<{ size: number; color?: string }> = ({ size, color = AC.clay }) => {
  const { fonts } = useTheme();
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontFamily: fonts.display, fontSize: size * 1.05, lineHeight: 1, color: "#fff8ef", transform: `translateY(${size * 0.24}px)` }}>{"“"}</span>
    </div>
  );
};

/** Small uppercase label: a clay dash that draws in, then the words. */
export const Label: React.FC<{ text: string; since: number; size?: number; color?: string }> = ({ text, since, size = 22, color = AC.clay }) => {
  const { fonts } = useTheme();
  const dash = prog(since, 0, 12);
  const words = prog(since, 4, 12);
  if (since < 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.7, height: size * 1.4 }}>
      <div style={{ width: size * 2.2 * dash, height: 3, borderRadius: 2, background: color }} />
      <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: size, letterSpacing: size * 0.22, color, opacity: words, transform: `translateX(${(1 - words) * -10}px)`, textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {text}
      </span>
    </div>
  );
};

/** Fitted lines in the display serif (or the body sans), once the fonts have loaded. */
export const useFit = (text: string, width: number, maxSize: number, minSize: number, maxLines: number, face: "display" | "body" = "display") => {
  const { fonts } = useTheme();
  const ready = useFontsReady();
  const family = face === "display" ? fonts.display : fonts.body;
  const weight = face === "display" ? 600 : 700;
  return useMemo(
    () => (ready ? fitLines({ text, width, maxSize, minSize, maxLines, fontFamily: family, fontWeight: weight }) : null),
    [ready, text, width, maxSize, minSize, maxLines, family, weight],
  );
};

/** Serif heading in sentence case: each line rises into place a few frames after the one above. */
export const Heading: React.FC<{ text: string; since: number; width: number; maxSize: number; minSize: number; maxLines: number; color?: string; align?: "left" | "center" }> = ({
  text,
  since,
  width,
  maxSize,
  minSize,
  maxLines,
  color = AC.ink,
  align = "left",
}) => {
  const { fonts } = useTheme();
  const fit = useFit(text, width, maxSize, minSize, maxLines);
  if (!fit || since < 0) return null;
  return (
    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: fit.size, lineHeight: 1.08, letterSpacing: "-0.01em", color, textAlign: align, width }}>
      {fit.lines.map((l, i) => {
        const p = prog(since, i * 4, 16);
        return (
          <div key={i} style={{ overflow: "hidden", paddingBottom: fit.size * 0.12, marginBottom: -fit.size * 0.12 }}>
            <div style={{ whiteSpace: "nowrap", opacity: p, transform: `translateY(${(1 - p) * fit.size * 0.6}px)` }}>{l}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Body copy beside a sage rule. */
export const Body: React.FC<{ text: string; since: number; size?: number; width?: number }> = ({ text, since, size = 34, width }) => {
  const { fonts } = useTheme();
  const p = prog(since, 0, 16);
  if (since < 0) return null;
  return (
    <div
      style={{
        marginTop: 34,
        width,
        paddingLeft: 26,
        borderLeft: `4px solid ${AC.sage}`,
        fontFamily: fonts.body,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.42,
        color: AC.ink,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
      }}
    >
      {text}
    </div>
  );
};

/** Slow drift for photos and clips inside the print (none for infographics, which show whole). */
const Drift: React.FC<{ frames: number; seed: number; on: boolean; children: React.ReactNode }> = ({ frames, seed, on, children }) => {
  const frame = useCurrentFrame();
  if (!on) return <AbsoluteFill>{children}</AbsoluteFill>;
  const s = interpolate(frame, [0, frames], [1.02, 1.09]);
  const x = interpolate(frame, [0, frames], [0, 14 * (seed % 2 ? 1 : -1)]);
  return <AbsoluteFill style={{ transform: `scale(${s}) translateX(${x}px)` }}>{children}</AbsoluteFill>;
};

const Layer: React.FC<{ asset: Asset; frames: number; seed: number }> = ({ asset, frames, seed }) => {
  const whole = !!asset.infographic;
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: whole ? "contain" : "cover" };
  if (asset.kind === "image") {
    return (
      <Drift frames={frames} seed={seed} on={!whole}>
        <Img src={staticFile(asset.file)} style={style} />
      </Drift>
    );
  }
  // As the shared backdrop: slow a short clip to at most half speed to fill its slot, then loop.
  const rate = Math.max(0.5, Math.min(1, asset.duration / (frames / FPS)));
  const loopFrames = Math.max(1, Math.floor(((asset.duration - 0.1) / rate) * FPS));
  return (
    <Drift frames={frames} seed={seed} on={!whole}>
      <Loop durationInFrames={loopFrames}>
        <OffthreadVideo src={staticFile(asset.file)} muted playbackRate={rate} style={style} />
      </Loop>
    </Drift>
  );
};

/** Resolved visuals → the print's list, each from its cue frame relative to the scene start. */
export const visualsOf = (list: { name: string; asset: Asset | null; note?: string; grade?: boolean; at: number }[], from: number): BackdropVisual[] =>
  list.flatMap((v, i) => (v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, from: i === 0 ? 0 : toFrame(v.at) - from }] : []));

export type Box = { left: number; top: number; width: number; height: number };

/**
 * The print: a framed card on the paper with a soft shadow, settling in from slightly below. Visuals cross-fade on their
 * cues. A visual's note is set under the frame in small type; a YouTube clip keeps its source tag inside the picture.
 */
export const Print: React.FC<{ box: Box; visuals: BackdropVisual[]; durationInFrames: number; seed?: number; enterAt?: number; children?: React.ReactNode }> = ({
  box,
  visuals,
  durationInFrames,
  seed = 0,
  enterAt = 4,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fonts } = useTheme();
  const enter = prog(frame, enterAt, 22);
  const mat = 14;
  const current = visuals.reduce((acc, v, k) => (frame >= v.from ? k : acc), 0);
  const note = visuals[current]?.note;
  const noteIn = visuals.length ? prog(frame, (visuals[current]?.from ?? 0) + 8, 12) : 0;
  return (
    <div style={{ position: "absolute", left: box.left, top: box.top, width: box.width, opacity: enter, transform: `translateY(${(1 - enter) * 30}px) rotate(${(1 - enter) * 0.6}deg)` }}>
      <div
        style={{
          width: box.width,
          height: box.height,
          padding: mat,
          boxSizing: "border-box",
          background: AC.card,
          borderRadius: 10,
          boxShadow: "0 30px 60px -28px rgba(60,40,20,0.45), 0 2px 6px rgba(60,40,20,0.12)",
          border: `1px solid ${AC.rule}`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 4, overflow: "hidden", background: AC.paperDeep }}>
          {children}
          {visuals.map((v, i) => {
            const from = i === 0 ? 0 : Math.max(0, v.from);
            const slot = Math.max(1, (visuals[i + 1]?.from ?? durationInFrames) - from + 10);
            const channel = tagChannel(v.asset);
            return (
              <Sequence key={i} from={from} durationInFrames={slot} layout="none">
                <CrossFade on={i > 0}>
                  <AbsoluteFill style={{ background: v.asset.infographic ? AC.card : AC.paperDeep }}>
                    <Layer asset={v.asset} frames={slot} seed={seed + i} />
                  </AbsoluteFill>
                  {channel && <SourceTag channel={channel} inset={18} size={15} />}
                </CrossFade>
              </Sequence>
            );
          })}
        </div>
      </div>
      {note && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, fontFamily: fonts.mono, fontWeight: 500, fontSize: 17, letterSpacing: 2, color: AC.inkSoft, opacity: noteIn }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: AC.clay }} />
          {note}
        </div>
      )}
    </div>
  );
};

const CrossFade: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => {
  const frame = useCurrentFrame();
  const o = on ? interpolate(frame, [0, 10], [0, 1], clamp) : 1;
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};
