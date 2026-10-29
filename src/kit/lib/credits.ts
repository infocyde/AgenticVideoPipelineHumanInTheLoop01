// Which credits an episode actually uses, grouped for the on-screen roll and DESCRIPTION.md. Pure.
import { AI_LICENSE, type AssetManifest, type Credit, creditSchema, type Episode, type MusicVideo, PRESS_LICENSE, STOCK_LICENSE, XPOST_LICENSE } from "../schema";
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
      : c.license === STOCK_LICENSE
        ? `${c.stock?.license ?? "Stock license"}${c.stock?.ai ? " · AI-generated" : ""}`
      : c.license === XPOST_LICENSE
        ? "Post on X"
      : isStableAudio(c)
        ? "AI-generated · Powered by Stability AI"
        : `${c.license}${c.licenseVersion ? ` ${c.licenseVersion}` : ""}`;

/** A music video's credits: its footage and stills, its AI stills, and the song. */
export const musicVideoCredits = (ep: MusicVideo, episodeCredits: Credit[]): UsedCredits => {
  const isVisual = (c: Credit) => /^(clips|images)\//.test(c.file);
  return {
    visuals: episodeCredits.filter((c) => isVisual(c) && c.license !== AI_LICENSE),
    generated: episodeCredits.filter((c) => isVisual(c) && c.license === AI_LICENSE),
    audio: episodeCredits.filter((c) => c.file === ep.song.file),
  };
};

export type CreditRow = { who: string; what: string };
export type CreditGroup = { heading: string; items: CreditRow[] };

/** One row per author + license (repeat files by the same author collapse into one line). */
const creditRows = (credits: Credit[]): CreditRow[] => {
  const seen = new Map<string, CreditRow>();
  for (const c of credits) {
    const key = `${c.author}|${licenseLabel(c)}`;
    if (!seen.has(key)) seen.set(key, { who: c.author, what: licenseLabel(c) });
  }
  return [...seen.values()];
};

/** The credits roll's two columns: footage and AI stills on the left; music, sound and (news episodes) map data on the right. */
export const creditColumns = (credits: UsedCredits, mapData: boolean): { left: CreditGroup[]; right: CreditGroup[] } => {
  const left: CreditGroup[] = [{ heading: "FOOTAGE & IMAGES", items: creditRows(credits.visuals) }];
  // One row per generator (FLUX 3 via Replicate, Z-Image Turbo locally), from each credit's author line.
  if (credits.generated.length) left.push({ heading: "AI ILLUSTRATIONS", items: [...new Set(credits.generated.map((c) => c.author))].map((who) => ({ who, what: "" })) });
  const right: CreditGroup[] = [{ heading: "MUSIC & SOUND", items: creditRows(credits.audio) }];
  if (mapData) right.push({ heading: "MAP DATA", items: [{ who: "Natural Earth via world-atlas", what: "Public domain" }] });
  return { left, right };
};

/** Rows a heading takes up in a column (it is larger and spaced). */
export const HEADING_ROWS = 1.6;

/** Lines a credit row wraps to in a column `charsPerLine` characters wide (the license label is set smaller). */
const rowLines = (r: CreditRow, charsPerLine: number) =>
  Number.isFinite(charsPerLine) ? Math.max(1, Math.ceil((r.who.length + (r.what ? 1 + r.what.length * 0.75 : 0)) / charsPerLine)) : 1;

/**
 * Split a column's groups into pages of at most `maxRows` lines; a group that continues repeats its heading. With a
 * finite `charsPerLine`, a long row counts as the lines it wraps to.
 */
export const creditPages = (groups: CreditGroup[], maxRows = 14, charsPerLine = Infinity): CreditGroup[][] => {
  const pages: CreditGroup[][] = [[]];
  let used = 0;
  for (const g of groups) {
    let cur: CreditGroup | null = null;
    const open = () => {
      if (used + HEADING_ROWS + 1 > maxRows && used > 0) {
        pages.push([]);
        used = 0;
      }
      cur = { heading: g.heading, items: [] };
      pages[pages.length - 1].push(cur);
      used += HEADING_ROWS;
    };
    open();
    for (const item of g.items) {
      const lines = rowLines(item, charsPerLine);
      if (used + lines > maxRows) {
        pages.push([]);
        used = 0;
        open();
      }
      cur!.items.push(item);
      used += lines;
    }
  }
  return pages;
};

/** Rows per credits column before a paged roll (music videos) turns the page. */
export const CREDIT_ROWS = 14;

/** A dense roll: `columns` columns a page, `maxRows` lines a column, wrapping at `charsPerLine`, text at `size` px. */
export type RollLayout = { columns: number; maxRows: number; charsPerLine: number; size?: number };
/** Music videos: three columns of 22 px text (a hundred archive credits would otherwise run to eight pages). */
export const MUSIC_VIDEO_ROLL: RollLayout = { columns: 3, maxRows: 24, charsPerLine: 44, size: 22 };

/**
 * The roll's pages, each a list of columns. With a row count, the news layout: footage on the left, music and map data
 * on the right; one page when everything fits, given as `undefined` so it lays out exactly like a news episode's
 * single-page roll. With a RollLayout, every group flows down column after column, `columns` to a page.
 */
export const pagedCreditColumns = (credits: UsedCredits, mapData: boolean, layout: number | RollLayout = CREDIT_ROWS): (CreditGroup[][] | undefined)[] => {
  const { left, right } = creditColumns(credits, mapData);
  if (typeof layout === "number") {
    const l = creditPages(left, layout);
    const r = creditPages(right, layout);
    const n = Math.max(l.length, r.length);
    return n === 1 ? [undefined] : Array.from({ length: n }, (_, i) => [l[i] ?? [], r[i] ?? []]);
  }
  const cols = creditPages([...left, ...right], layout.maxRows, layout.charsPerLine);
  return Array.from({ length: Math.ceil(cols.length / layout.columns) }, (_, i) => cols.slice(i * layout.columns, (i + 1) * layout.columns));
};
