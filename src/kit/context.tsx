// Everything a component needs about the episode being rendered: data, resolved timeline, assets and theme.
import React, { createContext, useContext } from "react";
import type { UsedCredits } from "./lib/credits";
import type { Timeline } from "./lib/resolve";
import type { AssetManifest, Episode } from "./schema";
import type { Theme } from "./themes";

export type EpisodeCtx = {
  episode: Episode;
  timeline: Timeline;
  assets: AssetManifest;
  /** Media credits this episode uses (episode files + library sounds), for the credits roll. */
  credits: UsedCredits;
  theme: Theme;
  /** Folder under public/ holding this episode's media, e.g. "episodes/2026-10-17-threat-brief". */
  base: string;
};

const Ctx = createContext<EpisodeCtx | null>(null);

export const EpisodeProvider: React.FC<{ value: EpisodeCtx; children: React.ReactNode }> = ({ value, children }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const useEpisode = (): EpisodeCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEpisode() must be used inside <EpisodeProvider>");
  return v;
};

export const useTheme = (): Theme => useEpisode().theme;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
