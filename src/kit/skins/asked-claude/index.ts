// The Asked Claude skin: Claude's own page for answering a question (16:9). Sources, credits and the end card stay
// shared, and so do the vertical Shorts scenes, which take the theme's paper colors and fonts.
import type { Skin } from "../types";
import { AskedCaptions, AskedTopBar } from "./Chrome";
import { AskedColdOpen, AskedOutro } from "./Open";
import { AskedSegment, AskedText } from "./Scenes";

export const askedClaudeSkin: Skin = {
  ColdOpen: AskedColdOpen,
  Segment: AskedSegment,
  Text: AskedText,
  Outro: AskedOutro,
  TopBar: AskedTopBar,
  Ticker: null,
  Captions: AskedCaptions,
};
