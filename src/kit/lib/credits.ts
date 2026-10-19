// Which credits an episode actually uses, grouped for the on-screen roll and DESCRIPTION.md. Pure.
import { AI_LICENSE, type AssetManifest, type Credit, creditSchema, type Episode } from "../schema";
import type { Timeline } from "./resolve";
import { sfxCues } from "./sfx";

export type UsedCredits = { visuals: Credit[]; generated: Credit[]; audio: Credit[] };

/** Parse a credits.json array, dropping invalid entries (`npm run check` reports those). */
export const parseCredits = (raw: unknown): Credit[] =>
  Array.isArray(raw) ? raw.flatMap((r) => {
    const c = creditSchema.safeParse(r);
    return c.success ? [c.data] : [];
  }) : [];

/** All episode media, plus the library sounds the sfx preset and music bed pull in. */
export const usedCredits = (ep: Episode, tl: Timeline, assets: AssetManifest, episodeCredits: Credit[], libraryCredits: Credit[]): UsedCredits => {
  const usedLib = new Set<string>();
  sfxCues(ep, tl).forEach((c) => {
    const f = assets.sfx[c.sfx]?.file;
    if (f?.startsWith("library/")) usedLib.add(f.slice("library/".length));
  });
  const mf = ep.audio.music && assets.music[ep.audio.music.file]?.file;
  if (mf?.startsWith("library/")) usedLib.add(mf.slice("library/".length));

  const isVisual = (c: Credit) => /^(clips|images)\//.test(c.file);
  return {
    visuals: episodeCredits.filter((c) => isVisual(c) && c.license !== AI_LICENSE),
    generated: episodeCredits.filter((c) => c.license === AI_LICENSE),
    audio: [...episodeCredits.filter((c) => /^(sfx|music)\//.test(c.file)), ...libraryCredits.filter((c) => usedLib.has(c.file))],
  };
};

export const licenseLabel = (c: Credit) =>
  c.license === "PD" ? "Public domain" : c.license === "OWN WORK" ? "Original work" : `${c.license}${c.licenseVersion ? ` ${c.licenseVersion}` : ""}`;
