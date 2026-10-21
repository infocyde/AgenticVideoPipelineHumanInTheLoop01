// The Frontier skin: every scene and piece of chrome is its own (sources, credits and the end card stay shared).
import type { Skin } from "../types";
import { FrontierCaptions, FrontierRail, FrontierTopBar } from "./Chrome";
import { FrontierColdOpen, FrontierOutro } from "./Open";
import { FrontierSegment } from "./Segment";
import { FrontierShortCaptions, FrontierShortColdOpen, FrontierShortOutro, FrontierShortSegment, FrontierShortText, FrontierShortTopBar } from "./Short";
import { FrontierText } from "./Text";
import { FrontierThumbnail } from "./Thumbnail";

export const frontierSkin: Skin = {
  ColdOpen: FrontierColdOpen,
  Segment: FrontierSegment,
  Text: FrontierText,
  Outro: FrontierOutro,
  TopBar: FrontierTopBar,
  Ticker: FrontierRail,
  Captions: FrontierCaptions,
  Thumbnail: FrontierThumbnail,
  short: {
    ColdOpen: FrontierShortColdOpen,
    Segment: FrontierShortSegment,
    Text: FrontierShortText,
    Outro: FrontierShortOutro,
    TopBar: FrontierShortTopBar,
    Captions: FrontierShortCaptions,
  },
};
