// The on-screen source tag for a clip pulled from YouTube ("VIDEO · <channel> / YouTube"), drawn by every footage
// renderer for a clip whose credit has a YouTube sourceUrl (assets.json `attribution`, see lib/youtube.ts tagChannel).
// It is a sibling after the theme's tint, never inside the graded layer, so the grade can't dim it.
// Corner: top-right of the visible media (the `note` tag owns bottom-right; captions and text own bottom and left).
// Positions checked with stills:
//   full frame 16:9 (Backdrop, frontier open)  right 64, top 100, size 16: under the top bar, above the map card (top 150)
//   full frame, text block on the right        same, top-left (Backdrop `mirror`), above the map card on the left
//   split frame (SplitSegment)                 inset 8, size 14 inside the 1040×585 frame: clear of the FILE chip (top-left)
//                                              and above the map card (40 down the frame)
//   frontier window (MediaStack)               inset 22, size 16, right of the VISUAL chip; the note pill is bottom-left;
//                                              with a GeoCard (map) over the window, wrapping at 460 px to its right
//   music video (ShotLayer)                    right 64, top 100: under the shot's note (right 64, top 56)
//   Shorts 9:16, full frame                    right 70, top 150, size 20, wrapping at 560 px: below the player's icons
//                                              (top 140), beside the brand bar, above the text panels (top 285)
//   frontier Shorts windows                    inset 22, size 18, wrapping to stay right of the VISUAL chip
import React from "react";
import { useTheme } from "../context";
import { TAG_PREFIX, TAG_SUFFIX, youtubeTagText } from "../lib/youtube";

/** Non-breaking spaces, so a wrapped tag keeps "VIDEO ·" and "/ YouTube" whole and breaks before, after or inside the name. */
const keep = (s: string) => s.replace(/ /g, "\u00a0");

/**
 * Small channel tag, absolutely positioned top-right (`side="left"`: top-left). `inset` is the offset from the side
 * (and from the top, unless `top` is given); `maxWidth` lets a long tag wrap instead of running into other overlays
 * (inside a spaceless channel name too, so it is never wider than `maxWidth`).
 */
export const SourceTag: React.FC<{ channel: string; inset?: number; top?: number; size?: number; maxWidth?: number; side?: "left" | "right" }> = ({
  channel,
  inset,
  top,
  size = 16,
  maxWidth,
  side = "right",
}) => {
  const { colors, fonts } = useTheme();
  const text = youtubeTagText(channel);
  return (
    <div
      style={{
        position: "absolute",
        [side]: inset ?? 64,
        top: top ?? inset ?? 100,
        zIndex: 6,
        maxWidth,
        fontFamily: fonts.mono,
        fontSize: size,
        lineHeight: 1.3,
        letterSpacing: 2,
        whiteSpace: maxWidth ? "normal" : "nowrap",
        overflowWrap: maxWidth ? "anywhere" : undefined, // a long name with no spaces still breaks, never overflows
        textAlign: side,
        color: colors.dim,
        background: colors.noteBg,
        padding: `${Math.round(size * 0.25)}px ${Math.round(size * 0.6)}px`,
        opacity: 0.85,
        textShadow: `0 1px 3px ${colors.noteBg}`, // a halo in the plate colour: dark on dark themes, light on clean-light
      }}
    >
      {maxWidth ? keep(TAG_PREFIX.trimEnd()) + " " + text.slice(TAG_PREFIX.length, -TAG_SUFFIX.length) + " " + keep(TAG_SUFFIX.trimStart()) : text}
    </div>
  );
};
