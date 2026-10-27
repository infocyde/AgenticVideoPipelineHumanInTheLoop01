import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { useEpisode } from "./context";
import { resolveVisual } from "./lib/resolve";

// Text column: the slab is 600px wide at the top and slants to 500px at the bottom; text stays inside 450px.
const SLAB_TOP = 600;
const SLAB_BOTTOM = 500;
const TEXT_LEFT = 46;
const TEXT_WIDTH = 450;
// Display faces are condensed; ~0.5em per character keeps the estimate on the safe side.
const fit = (text: string, max: number) => Math.min(max, Math.floor(TEXT_WIDTH / (Math.max(1, text.length) * 0.5)));

/**
 * "punch" layout: built to read at phone size and stand out in YouTube's dark mode. A bright full-bleed photo with
 * the subject framed (position, zoom) to fill the right half, and a solid accent slab on the left with 2–4 huge words
 * in dark text. No brand line or date: thumbnails are seen at ~170px wide, where small text is noise.
 */
export const PunchThumbnail: React.FC = () => {
  const { episode, assets, theme } = useEpisode();
  // A Still runs at 1 fps, so the clip offset is in seconds here, not the video's FPS.
  const { fps } = useVideoConfig();
  const { colors, fonts } = theme;
  const t = episode.thumbnail;
  const big = t?.big ?? episode.coldOpen.title.big;
  const lines = (t?.title ?? episode.coldOpen.title.small).toUpperCase().split("\n");
  const visual = t?.visual ? resolveVisual(assets, t.visual) : null;
  const position = t?.position ?? "70% center";
  const media: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: position,
    transform: `scale(${t?.zoom ?? 1})`,
    transformOrigin: position,
    filter: "contrast(1.12) saturate(1.2) brightness(1.04)",
  };
  const bigSize = fit(big, 260);
  const lineSize = Math.min(...lines.map((l) => fit(l, 150)));
  const slab = (inset: number) => `polygon(0 0, ${SLAB_TOP + inset}px 0, ${SLAB_BOTTOM + inset}px 100%, 0 100%)`;

  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      {visual && (
        <AbsoluteFill>
          {visual.kind === "image" ? (
            <Img src={staticFile(visual.file)} style={media} />
          ) : (
            <OffthreadVideo src={staticFile(visual.file)} muted trimBefore={(t?.frame ?? 1) * fps} style={media} />
          )}
        </AbsoluteFill>
      )}
      {/* a white edge between slab and photo keeps the two apart when the photo is dark or the same hue */}
      <AbsoluteFill style={{ background: "#ffffff", clipPath: slab(14) }} />
      <AbsoluteFill style={{ background: colors.accent, clipPath: slab(0) }} />

      <div style={{ position: "absolute", left: TEXT_LEFT, top: 0, bottom: 0, width: TEXT_WIDTH, display: "flex", flexDirection: "column", justifyContent: "center", color: colors.onAccent }}>
        {big && <div style={{ fontFamily: fonts.display, fontSize: bigSize, lineHeight: 0.82, whiteSpace: "nowrap" }}>{big}</div>}
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: fonts.display, fontSize: lineSize, lineHeight: 0.86, whiteSpace: "nowrap" }}>
            {l}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
