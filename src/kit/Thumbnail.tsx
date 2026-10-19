import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { WorldMap } from "./components/WorldMap";
import { useEpisode } from "./context";
import { allPins, resolveVisual } from "./lib/resolve";
import { FPS } from "./lib/timing";

export const THUMB_WIDTH = 1280;
export const THUMB_HEIGHT = 720;

/** 1280×720 YouTube thumbnail built from the theme and episode: crisp text without an image model. */
export const Thumbnail: React.FC = () => {
  const { episode, assets, theme } = useEpisode();
  const { colors, fonts, effects, backdrop } = theme;
  const big = episode.thumbnail?.big ?? episode.coldOpen.title.big;
  const title = episode.thumbnail?.title ?? episode.coldOpen.title.small;
  const name = episode.thumbnail?.visual;
  const visual = name ? resolveVisual(assets, name) : null;
  // Thumbnails are seen small and need punch: keep the image bright (no in-video darkening) and anchor it to the
  // right, where layouts put the subject; the side gradient still darkens the left for the text.
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: "right center", filter: "contrast(1.1) saturate(1.15)" };
  const bigSize = big.length <= 2 ? 250 : big.length <= 4 ? 190 : 130;

  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ left: 260, opacity: visual ? 0.45 : 0.9 }}>
        <WorldMap width={1100} height={720} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} settled />
      </AbsoluteFill>
      {visual && (
        <AbsoluteFill style={{ opacity: 0.95 }}>
          {visual.kind === "image" ? (
            <Img src={staticFile(visual.file)} style={media} />
          ) : (
            <OffthreadVideo src={staticFile(visual.file)} muted startFrom={Math.round((episode.thumbnail?.frame ?? 1) * FPS)} style={media} />
          )}
          <AbsoluteFill style={{ background: colors.accentDeep, mixBlendMode: backdrop.tintBlend, opacity: backdrop.tintOpacity * 0.4 }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: backdrop.sideGradient }} />
      <AbsoluteFill style={{ background: effects.vignette }} />

      <div style={{ position: "absolute", top: 34, left: 44, display: "flex", alignItems: "center", gap: 12, fontFamily: fonts.mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: colors.text }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: colors.accent, boxShadow: `0 0 14px ${colors.accent}` }} />
        {episode.brand.name}
      </div>

      <div style={{ position: "absolute", left: 60, top: 70, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: fonts.display, fontSize: bigSize, lineHeight: 0.9, color: colors.accent, textShadow: effects.accentGlow(60) }}>{big}</div>
        <div style={{ fontFamily: fonts.display, fontSize: 100, lineHeight: 0.92, color: colors.text, whiteSpace: "pre", textTransform: "uppercase", textShadow: effects.textShadow }}>
          {title}
        </div>
        <div style={{ marginTop: 22, height: 10, width: 420, background: colors.accent }} />
        <div style={{ marginTop: 16, fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: colors.text }}>{episode.brand.dateLabel}</div>
      </div>
    </AbsoluteFill>
  );
};
