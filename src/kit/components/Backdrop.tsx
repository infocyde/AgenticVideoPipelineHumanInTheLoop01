import React from "react";
import { AbsoluteFill, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { useTheme } from "../context";
import type { Asset } from "../lib/resolve";
import { FPS } from "../lib/timing";
import { GlitchCut } from "./Chrome";

export type BackdropVisual = { name: string; asset: Asset; note?: string; from: number };

const KenBurns: React.FC<{ frames: number; seed: number; children: React.ReactNode }> = ({ frames, seed, children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, frames], [1.06, 1.18]);
  const x = interpolate(frame, [0, frames], [0, 30 * (seed % 2 ? 1 : -1)]);
  return <AbsoluteFill style={{ transform: `scale(${s}) translateX(${x}px)` }}>{children}</AbsoluteFill>;
};

const VisualLayer: React.FC<{ asset: Asset; frames: number; seed: number }> = ({ asset, frames, seed }) => {
  const { backdrop } = useTheme();
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: backdrop.filter };
  if (asset.kind === "image") {
    return (
      <KenBurns frames={frames} seed={seed}>
        <Img src={staticFile(asset.file)} style={style} />
      </KenBurns>
    );
  }
  // Slow clips down (to at most half speed) to fill the slot, then loop if still short.
  const rate = Math.max(0.5, Math.min(1, asset.duration / (frames / FPS)));
  const loopFrames = Math.max(1, Math.floor(((asset.duration - 0.1) / rate) * FPS));
  return (
    <KenBurns frames={frames} seed={seed}>
      <Loop durationInFrames={loopFrames}>
        <OffthreadVideo src={staticFile(asset.file)} muted playbackRate={rate} style={style} />
      </Loop>
    </KenBurns>
  );
};

/**
 * Full-bleed b-roll (fills its parent). Each visual starts at its `from` frame (cue-based) and glitch-cuts from the previous one.
 * `clear` (0–1) eases off the side gradient once the text no longer needs it; `gradients={false}` drops the
 * side and bottom gradients entirely (for b-roll in a frame with no text over it).
 */
export const Backdrop: React.FC<{ visuals: BackdropVisual[]; durationInFrames: number; seed?: number; clear?: number; gradients?: boolean; noteInset?: number }> = ({
  visuals,
  durationInFrames,
  seed = 0,
  clear = 0,
  gradients = true,
  noteInset,
}) => {
  const { colors, backdrop, fonts } = useTheme();
  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      {visuals.map((v, i) => {
        const from = i === 0 ? 0 : Math.max(0, v.from);
        const slot = Math.max(1, (visuals[i + 1]?.from ?? durationInFrames) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={slot} layout="none">
            <AbsoluteFill>
              <VisualLayer asset={v.asset} frames={slot} seed={seed + i} />
            </AbsoluteFill>
            {v.note && (
              <div
                style={{
                  position: "absolute",
                  right: noteInset ?? 64,
                  bottom: noteInset ?? 78,
                  zIndex: 5,
                  fontFamily: fonts.mono,
                  fontSize: 18,
                  letterSpacing: 3,
                  color: colors.dim,
                  background: colors.noteBg,
                  padding: "4px 10px",
                }}
              >
                {v.note}
              </div>
            )}
            {i > 0 && <GlitchCut seed={seed * 7 + i} />}
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ background: colors.accentDeep, mixBlendMode: backdrop.tintBlend, opacity: backdrop.tintOpacity }} />
      {gradients && <AbsoluteFill style={{ background: backdrop.sideGradient, opacity: 1 - 0.65 * clear }} />}
      {gradients && <AbsoluteFill style={{ background: backdrop.bottomGradient }} />}
    </AbsoluteFill>
  );
};
