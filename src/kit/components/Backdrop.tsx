import React from "react";
import { AbsoluteFill, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { useTheme } from "../context";
import type { Asset } from "../lib/resolve";
import { FPS } from "../lib/timing";
import { tagChannel } from "../lib/youtube";
import { GlitchCut } from "./Chrome";
import { SourceTag } from "./SourceTag";

/**
 * `grade: false` skips the theme filter and tint for this visual (an explainer or infographic already drawn in the theme).
 * `panel` true/false forces or refuses the framed panel; unset, infographics get one when the Backdrop has `panels`.
 */
export type BackdropVisual = { name: string; asset: Asset; note?: string; grade?: boolean; panel?: boolean; from: number };

/**
 * Framed panel for an infographic or explainer (16:9), beside the text: on the right, or on the left with `mirror`.
 * With nothing beside it (`focus` 1) it moves to the centre and grows to FOCUS_WIDTH, still clear of the captions.
 */
export const PANEL = { width: 1104, height: 621, inset: 96, top: 168 };
const FOCUS_WIDTH = 1320;
const FOCUS_TOP = 130;

export const KenBurns: React.FC<{ frames: number; seed: number; children: React.ReactNode }> = ({ frames, seed, children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, frames], [1.06, 1.18]);
  const x = interpolate(frame, [0, frames], [0, 30 * (seed % 2 ? 1 : -1)]);
  return <AbsoluteFill style={{ transform: `scale(${s}) translateX(${x}px)` }}>{children}</AbsoluteFill>;
};

const VisualLayer: React.FC<{ asset: Asset; frames: number; seed: number; grade: boolean; still?: boolean }> = ({ asset, frames, seed, grade, still = false }) => {
  const { backdrop } = useTheme();
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: grade ? backdrop.filter : "none" };
  // `still`: no Ken Burns drift (a panel shows the whole graphic, edge to edge).
  const move = (node: React.ReactNode) =>
    still ? <AbsoluteFill>{node}</AbsoluteFill> : <KenBurns frames={frames} seed={seed}>{node}</KenBurns>;
  if (asset.kind === "image") {
    return move(<Img src={staticFile(asset.file)} style={style} />);
  }
  // Slow clips down (to at most half speed) to fill the slot, then loop if still short.
  const rate = Math.max(0.5, Math.min(1, asset.duration / (frames / FPS)));
  const loopFrames = Math.max(1, Math.floor(((asset.duration - 0.1) / rate) * FPS));
  return move(
    <Loop durationInFrames={loopFrames}>
      <OffthreadVideo src={staticFile(asset.file)} muted playbackRate={rate} style={style} />
    </Loop>,
  );
};

/** An infographic or explainer in a framed panel over the theme's plain background; it settles in over ~10 frames. */
const PanelLayer: React.FC<{ asset: Asset; frames: number; seed: number; mirror: boolean; focus: number }> = ({ asset, frames, seed, mirror, focus }) => {
  const frame = useCurrentFrame();
  const { colors, effects } = useTheme();
  const k = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const width = PANEL.width + (FOCUS_WIDTH - PANEL.width) * focus;
  const height = (width * 9) / 16;
  const inset = PANEL.inset + ((1920 - FOCUS_WIDTH) / 2 - PANEL.inset) * focus;
  const top = PANEL.top + (FOCUS_TOP - PANEL.top) * focus;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${mirror ? "30%" : "70%"} 45%, ${colors.panel} 0%, ${colors.bg} 70%)` }}>
      <div
        style={{
          position: "absolute",
          top,
          [mirror ? "left" : "right"]: inset,
          width,
          height,
          overflow: "hidden",
          background: colors.bg,
          border: `2px solid ${colors.line}`,
          borderTop: `6px solid ${colors.accent}`,
          boxShadow: `0 30px 90px rgba(0,0,0,0.55), ${effects.accentGlow(18)}`,
          opacity: k,
          transform: `translateY(${(1 - k) * 24}px) scale(${0.97 + 0.03 * k})`,
        }}
      >
        <VisualLayer asset={asset} frames={frames} seed={seed} grade={false} still />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Full-bleed b-roll (fills its parent). Each visual starts at its `from` frame (cue-based) and glitch-cuts from the previous one.
 * `clear` (0–1) eases off the side gradient once the text no longer needs it (and fades in the theme's `clearedScrim`
 * behind what stays on screen, unless `scrim={false}`); `side` (0–1) scales the side gradient; `gradients={false}` drops the
 * side and bottom gradients entirely (for b-roll in a frame with no text over it); `mirror` flips the side gradient for text on the right.
 * `panels` puts infographics (and any visual with `panel: true`) in a framed panel on the right (left with `mirror`), ungraded;
 * `panelFocus` (0–1) moves that panel to the centre and enlarges it once no text sits beside it.
 * A clip credited to a YouTube channel gets the SourceTag (top-right, top-left with `mirror`; `tagInset`, `tagTop`, `tagSize` and
 * `tagMaxWidth` place, size and wrap it).
 */
export const Backdrop: React.FC<{ visuals: BackdropVisual[]; durationInFrames: number; seed?: number; clear?: number; side?: number; scrim?: boolean; gradients?: boolean; noteInset?: number; noteSize?: number; tagInset?: number; tagTop?: number; tagSize?: number; tagMaxWidth?: number; mirror?: boolean; panels?: boolean; panelFocus?: number }> = ({
  visuals,
  durationInFrames,
  seed = 0,
  clear = 0,
  side = 1,
  scrim = true,
  gradients = true,
  noteInset,
  noteSize = 18,
  tagInset,
  tagTop,
  tagSize,
  tagMaxWidth,
  mirror = false,
  panels = false,
  panelFocus = 0,
}) => {
  const { colors, backdrop, fonts } = useTheme();
  const inPanel = (v: BackdropVisual) => v.panel ?? (panels && !!v.asset.infographic);
  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      {visuals.map((v, i) => {
        const from = i === 0 ? 0 : Math.max(0, v.from);
        const slot = Math.max(1, (visuals[i + 1]?.from ?? durationInFrames) - from);
        const channel = tagChannel(v.asset);
        return (
          <Sequence key={i} from={from} durationInFrames={slot} layout="none">
            {inPanel(v) ? (
              <PanelLayer asset={v.asset} frames={slot} seed={seed + i} mirror={mirror} focus={panelFocus} />
            ) : (
              <AbsoluteFill>
                <VisualLayer asset={v.asset} frames={slot} seed={seed + i} grade={v.grade !== false} />
              </AbsoluteFill>
            )}
            {v.grade !== false && !inPanel(v) && <AbsoluteFill style={{ background: colors.accentDeep, mixBlendMode: backdrop.tintBlend, opacity: backdrop.tintOpacity }} />}
            {v.note && (
              <div
                style={{
                  position: "absolute",
                  right: noteInset ?? 64,
                  bottom: noteInset ?? 78,
                  zIndex: 5,
                  fontFamily: fonts.mono,
                  fontSize: noteSize,
                  letterSpacing: 3,
                  color: colors.dim,
                  background: colors.noteBg,
                  padding: "4px 10px",
                }}
              >
                {v.note}
              </div>
            )}
            {channel && <SourceTag channel={channel} inset={tagInset} top={tagTop} size={tagSize} maxWidth={tagMaxWidth} side={mirror ? "left" : "right"} />}
            {i > 0 && <GlitchCut seed={seed * 7 + i} />}
          </Sequence>
        );
      })}
      {gradients && <AbsoluteFill style={{ background: backdrop.sideGradient, opacity: side * (1 - (1 - (backdrop.sideCleared ?? 0.35)) * clear), transform: mirror ? "scaleX(-1)" : undefined }} />}
      {gradients && scrim && backdrop.clearedScrim && clear > 0 && <AbsoluteFill style={{ background: backdrop.clearedScrim, opacity: clear }} />}
      {gradients && <AbsoluteFill style={{ background: backdrop.bottomGradient }} />}
    </AbsoluteFill>
  );
};
