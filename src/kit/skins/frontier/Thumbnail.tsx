// Frontier thumbnail (1280×720): the visual in a turned glass window on the right, the iridescent numeral and the
// title on the left over the lattice. Built to read at phone size.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { useEpisode } from "../../context";
import { allPins, resolveVisual } from "../../lib/resolve";
import { DotMap } from "./DotMap";
import { EqMark } from "./Chrome";
import { F, Field, GradientText } from "./fx";
import { Window } from "./Media";

export const FrontierThumbnail: React.FC = () => {
  const { episode, assets, theme } = useEpisode();
  // A Still runs at 1 fps, so the clip offset is in seconds here, not the video's FPS.
  const { fps } = useVideoConfig();
  const { fonts, colors } = theme;
  const big = episode.thumbnail?.big ?? episode.coldOpen.title.big;
  const title = episode.thumbnail?.title ?? episode.coldOpen.title.small;
  const name = episode.thumbnail?.visual;
  const visual = name ? resolveVisual(assets, name) : null;
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.1) saturate(1.15)" };
  const bigSize = big.length <= 2 ? 230 : big.length <= 4 ? 170 : 120;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Field />
      <Window box={{ left: 560, top: 110, width: 680, height: 500 }} enter={1} tilt={-9} radius={24}>
        {visual ? (
          visual.kind === "image" ? (
            <Img src={staticFile(visual.file)} style={media} />
          ) : (
            <OffthreadVideo src={staticFile(visual.file)} muted trimBefore={(episode.thumbnail?.frame ?? 1) * fps} style={media} />
          )
        ) : (
          <DotMap width={676} height={496} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} pitch={7} settled />
        )}
      </Window>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,6,10,0.92) 0%, rgba(5,6,10,0.6) 42%, transparent 62%)" }} />
      <div style={{ position: "absolute", top: 34, left: 48, display: "flex", alignItems: "center", gap: 12, fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 22, letterSpacing: 4, color: colors.text }}>
        <EqMark size={20} />
        {episode.brand.name}
      </div>
      <div style={{ position: "absolute", left: 56, top: 60, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: bigSize, lineHeight: 0.95, filter: "drop-shadow(0 0 40px rgba(139,107,255,0.6))" }}>
          <GradientText shift={30}>{big}</GradientText>
        </div>
        <div style={{ fontFamily: fonts.body, fontWeight: F.weights.caption, fontSize: 92, lineHeight: 0.95, letterSpacing: "-0.02em", color: "#fff", whiteSpace: "pre", textTransform: "uppercase", textShadow: "0 6px 30px rgba(2,3,8,0.9)" }}>
          {title}
        </div>
        <div style={{ marginTop: 22, height: 8, width: 380, borderRadius: 4, background: F.iris, boxShadow: `0 0 20px ${F.cyan}` }} />
        <div style={{ marginTop: 16, fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 26, letterSpacing: 4, color: colors.text }}>{episode.brand.dateLabel}</div>
      </div>
    </AbsoluteFill>
  );
};
