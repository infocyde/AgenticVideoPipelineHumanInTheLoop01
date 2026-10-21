// A skin lets a theme bring its own scenes and chrome instead of restyling the shared ones. Every piece is optional:
// whatever a skin leaves out falls back to the shared component, so a skin can replace one scene or all of them.
// Skins must keep the shared timing contract (scene cuts, the 0–22 frame number window, stat/visual cues, MAP_EXIT,
// CTA_CLICK_FRAME), because the sound-effect presets in lib/sfx.ts fire on those times.
import type React from "react";
import type { CaptionBox } from "../components/Chrome";
import type { ResolvedSegment, ResolvedText } from "../lib/resolve";

export type SegmentScene = React.FC<{ s: ResolvedSegment; slam: boolean }>;
export type TextScene = React.FC<{ t: ResolvedText }>;

export type Skin = {
  /** 16:9 episode scenes (countdown and list). */
  ColdOpen?: React.FC;
  Segment?: SegmentScene;
  Text?: TextScene;
  Outro?: React.FC;
  EndCard?: React.FC;
  /** Persistent chrome over the scenes (16:9). `Ticker: null` drops the ticker. */
  Finish?: React.FC;
  TopBar?: React.FC;
  Ticker?: React.FC | null;
  Captions?: React.FC<{ box?: CaptionBox }>;
  /** 1280×720 YouTube thumbnail. */
  Thumbnail?: React.FC;
  /** Vertical 9:16 Shorts. */
  short?: {
    ColdOpen?: React.FC;
    Segment?: React.FC<{ s: ResolvedSegment }>;
    Text?: TextScene;
    Outro?: React.FC;
    TopBar?: React.FC;
    Captions?: React.FC<{ box?: CaptionBox }>;
  };
};
