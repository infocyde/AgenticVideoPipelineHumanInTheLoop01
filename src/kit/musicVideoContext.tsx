// Everything a music-video component needs: the episode, its resolved shots and subtitles, assets, credits and theme.
import React, { createContext, useContext } from "react";
import { ThemeProvider } from "./context";
import type { UsedCredits } from "./lib/credits";
import type { MusicVideoTimeline } from "./lib/resolveMusicVideo";
import type { AssetManifest, MusicVideo } from "./schema";
import type { Theme } from "./themes";

export type MusicVideoCtx = {
  episode: MusicVideo;
  timeline: MusicVideoTimeline;
  assets: AssetManifest;
  /** Media credits (footage, AI stills, the song), for the credits roll. */
  credits: UsedCredits;
  theme: Theme;
  /** Folder under public/ holding this episode's media, e.g. "episodes/2026-10-21-empires". */
  base: string;
};

const Ctx = createContext<MusicVideoCtx | null>(null);

export const MusicVideoProvider: React.FC<{ value: MusicVideoCtx; children: React.ReactNode }> = ({ value, children }) => (
  <Ctx.Provider value={value}>
    <ThemeProvider value={value.theme}>{children}</ThemeProvider>
  </Ctx.Provider>
);

export const useMusicVideo = (): MusicVideoCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMusicVideo() must be used inside <MusicVideoProvider>");
  return v;
};
