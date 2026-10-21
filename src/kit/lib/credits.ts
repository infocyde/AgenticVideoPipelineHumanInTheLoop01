// Which credits an episode actually uses, grouped for the on-screen roll and DESCRIPTION.md. Pure.
import { AI_LICENSE, type AssetManifest, type Credit, creditSchema, type Episode, PRESS_LICENSE } from "../schema";
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
  // A Short holds all of its parent's media (hard-linked) but shows only a few: credit just the visuals it references.
  // An episode's folder holds only what it uses, so it credits everything there.
  const referenced = new Set<string>([
    ...ep.coldOpen.beats.flatMap((b) => (b.visual ? [b.visual] : [])),
    ...ep.segments.flatMap((s) => s.visuals.map((v) => v.name)),
    ...(ep.thumbnail?.visual ? [ep.thumbnail.visual] : []),
  ]);
  const shown = (c: Credit) => ep.format !== "short" || referenced.has(c.file.replace(/^.*\//, "").replace(/\.[^.]+$/, ""));
  return {
    visuals: episodeCredits.filter((c) => isVisual(c) && c.license !== AI_LICENSE && shown(c)),
    generated: episodeCredits.filter((c) => c.license === AI_LICENSE && isVisual(c) && shown(c)),
    audio: [...episodeCredits.filter((c) => /^(sfx|music)\//.test(c.file)), ...libraryCredits.filter((c) => usedLib.has(c.file))],
  };
};

/** Music made by `npm run compose` (Stable Audio 3): its license asks for "Powered by Stability AI" where it's credited. */
export const isStableAudio = (c: Credit) => c.license === AI_LICENSE && /stable-audio/.test(c.generator?.model ?? "");

export const licenseLabel = (c: Credit) =>
  c.license === "PD"
    ? "Public domain"
    : c.license === "OWN WORK"
      ? "Original work"
      : c.license === PRESS_LICENSE
        ? "Press image"
      : isStableAudio(c)
        ? "AI-generated · Powered by Stability AI"
        : `${c.license}${c.licenseVersion ? ` ${c.licenseVersion}` : ""}`;
