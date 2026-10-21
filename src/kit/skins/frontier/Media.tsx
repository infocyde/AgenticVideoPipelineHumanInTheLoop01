// B-roll in Frontier: a floating, slightly turned glass window (segments, text sections, Shorts) or full-bleed (cold
// open). Visuals cut on their cues with the light sweep instead of the shared glitch cut.
import React from "react";
import { AbsoluteFill, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { BackdropVisual } from "../../components/Backdrop";
import { useTheme } from "../../context";
import type { Asset } from "../../lib/resolve";
import { FPS } from "../../lib/timing";
import { F, pad2, prog, Sweep } from "./fx";

/** Slow push-in (gentler than the shared Ken Burns: the window itself already moves). */
const Drift: React.FC<{ frames: number; seed: number; children: React.ReactNode }> = ({ frames, seed, children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, frames], [1.04, 1.12]);
  const x = interpolate(frame, [0, frames], [0, 18 * (seed % 2 ? 1 : -1)]);
  return <AbsoluteFill style={{ transform: `scale(${s}) translateX(${x}px)` }}>{children}</AbsoluteFill>;
};

const Layer: React.FC<{ asset: Asset; frames: number; seed: number }> = ({ asset, frames, seed }) => {
  const { backdrop } = useTheme();
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: backdrop.filter };
  if (asset.kind === "image") {
    return (
      <Drift frames={frames} seed={seed}>
        <Img src={staticFile(asset.file)} style={style} />
      </Drift>
    );
  }
  // Same rule as the shared backdrop: slow a short clip to at most half speed to fill the slot, then loop.
  const rate = Math.max(0.5, Math.min(1, asset.duration / (frames / FPS)));
  const loopFrames = Math.max(1, Math.floor(((asset.duration - 0.1) / rate) * FPS));
  return (
    <Drift frames={frames} seed={seed}>
      <Loop durationInFrames={loopFrames}>
        <OffthreadVideo src={staticFile(asset.file)} muted playbackRate={rate} style={style} />
      </Loop>
    </Drift>
  );
};

/** The visuals of a scene, each from its cue frame, swept in; notes as a glass pill. Fills its parent. */
export const MediaStack: React.FC<{ visuals: BackdropVisual[]; durationInFrames: number; seed?: number; noteInset?: number; noteSize?: number; tint?: boolean }> = ({
  visuals,
  durationInFrames,
  seed = 0,
  noteInset = 22,
  noteSize = 17,
  tint = true,
}) => {
  const { colors, backdrop, fonts } = useTheme();
  return (
    <AbsoluteFill style={{ background: F.ink, overflow: "hidden" }}>
      {visuals.map((v, i) => {
        const from = i === 0 ? 0 : Math.max(0, v.from);
        const slot = Math.max(1, (visuals[i + 1]?.from ?? durationInFrames) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={slot} layout="none">
            <AbsoluteFill>
              <Layer asset={v.asset} frames={slot} seed={seed + i} />
            </AbsoluteFill>
            {tint && <AbsoluteFill style={{ background: colors.accentDeep, mixBlendMode: backdrop.tintBlend, opacity: backdrop.tintOpacity }} />}
            {v.note && (
              <div
                style={{
                  position: "absolute",
                  left: noteInset,
                  bottom: noteInset,
                  zIndex: 5,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: fonts.mono,
                  fontWeight: F.weights.mono,
                  fontSize: noteSize,
                  letterSpacing: 2.5,
                  color: "rgba(238,241,255,0.82)",
                  background: "rgba(5,6,10,0.84)",
                  border: `1px solid ${colors.line}`,
                  borderRadius: 999,
                  padding: `${noteSize * 0.35}px ${noteSize * 0.8}px`,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 2, background: F.magenta, transform: "rotate(45deg)" }} />
                {v.note}
              </div>
            )}
            {i > 0 && <Sweep />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export type Box = { left: number; top: number; width: number; height: number };

/**
 * The floating window: iridescent edge, rounded, turned a few degrees toward the text (`tilt`), bobbing slowly, with a
 * violet glow pooled under it. `enter` (0–1) swings it in. `label` is an optional top-left chip (e.g. "VISUAL 2/3").
 */
export const Window: React.FC<{ box: Box; enter: number; tilt?: number; radius?: number; label?: string; children: React.ReactNode; glow?: number }> = ({
  box,
  enter,
  tilt = -7,
  radius = 26,
  label,
  children,
  glow = 0,
}) => {
  const frame = useCurrentFrame();
  const { fonts, colors } = useTheme();
  const bob = Math.sin(frame / 46) * 5;
  const turn = tilt + (1 - enter) * tilt * 2.6;
  return (
    <div style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, perspective: 2600 }}>
      <div
        style={{
          position: "absolute",
          left: "8%",
          right: "8%",
          bottom: -70,
          height: 120,
          background: "radial-gradient(ellipse at center, rgba(139,107,255,0.45) 0%, rgba(61,240,255,0.12) 40%, transparent 70%)",
          filter: "blur(10px)",
          opacity: enter,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `translateY(${bob + (1 - enter) * 60}px) rotateY(${turn}deg) scale(${0.94 + 0.06 * enter})`,
          transformOrigin: tilt < 0 ? "left center" : "right center",
          opacity: enter,
          borderRadius: radius,
          padding: 2,
          background: F.iris,
          boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 ${50 + glow * 60}px rgba(61,240,255,${0.18 + glow * 0.3})`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: radius - 2, overflow: "hidden", background: F.ink }}>
          {children}
          {/* glass sheen */}
          <AbsoluteFill style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%)", pointerEvents: "none" }} />
          {label && (
            <div
              style={{
                position: "absolute",
                left: 20,
                top: 18,
                fontFamily: fonts.mono,
                fontWeight: F.weights.monoBold,
                fontSize: 17,
                letterSpacing: 3,
                color: colors.text,
                background: "rgba(5,6,10,0.84)",
                border: `1px solid ${colors.line}`,
                borderRadius: 999,
                padding: "5px 12px",
              }}
            >
              <span style={{ color: F.cyan }}>●</span> {label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** "VISUAL 2/3" for the window chip, or undefined with one visual. */
export const visualLabel = (visuals: BackdropVisual[], frame: number) => {
  if (visuals.length < 2) return undefined;
  const i = visuals.reduce((acc, v, k) => (frame >= v.from ? k : acc), 0);
  return `VISUAL ${pad2(i + 1)}/${pad2(visuals.length)}`;
};

/** Window entrance progress for a scene (frames from its start). */
export const windowEnter = (frame: number, t0: number) => prog(frame, t0, 18);

