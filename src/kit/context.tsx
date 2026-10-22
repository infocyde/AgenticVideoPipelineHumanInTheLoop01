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
/** The theme on its own, so shared pieces (GlitchCut, Backdrop…) also work inside a music video (musicVideoContext). */
const ThemeCtx = createContext<Theme | null>(null);

export const EpisodeProvider: React.FC<{ value: EpisodeCtx; children: React.ReactNode }> = ({ value, children }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const ThemeProvider: React.FC<{ value: Theme; children: React.ReactNode }> = ({ value, children }) => (
  <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
);

export const useEpisode = (): EpisodeCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEpisode() must be used inside <EpisodeProvider>");
  return v;
};

export const useTheme = (): Theme => {
  const own = useContext(ThemeCtx);
  const episode = useContext(Ctx);
  const theme = own ?? episode?.theme;
  if (!theme) throw new Error("useTheme() must be used inside <EpisodeProvider> or <ThemeProvider>");
  return theme;
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
