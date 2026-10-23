import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { resolveVisual } from "./lib/resolve";
import { thumbnailVisual } from "./lib/resolveMusicVideo";
import { FPS } from "./lib/timing";
import { useMusicVideo } from "./musicVideoContext";

/** 1280×720 YouTube thumbnail for a music video: a still or clip frame (default: the first shot), artist and title. */
export const MusicVideoThumbnail: React.FC = () => {
  const { episode, assets, theme } = useMusicVideo();
  const { colors, fonts, effects } = theme;
  const visual = resolveVisual(assets, thumbnailVisual(episode));
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.1) saturate(1.15)" };
  const title = episode.song.title;
  const titleSize = title.length <= 8 ? 170 : title.length <= 14 ? 130 : 96;
  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      {visual &&
        (visual.kind === "image" ? (
          <Img src={staticFile(visual.file)} style={media} />
        ) : (
          <OffthreadVideo src={staticFile(visual.file)} muted trimBefore={Math.round((episode.thumbnail?.frame ?? 1) * FPS)} style={media} />
        ))}
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0) 60%), linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0) 55%)" }} />
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 54 }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 34, letterSpacing: 6, textTransform: "uppercase", color: colors.accent, textShadow: effects.textShadow }}>
          {episode.song.artist}
        </div>
        <div style={{ fontFamily: fonts.display, fontSize: titleSize, lineHeight: 0.95, color: colors.text, textShadow: effects.textShadow, marginTop: 6 }}>{title}</div>
        {episode.song.subtitle && (
          <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: colors.text, marginTop: 12, textShadow: effects.textShadow }}>{episode.song.subtitle}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
