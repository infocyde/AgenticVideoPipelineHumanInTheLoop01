// Resolve a music video's shots (sung cues or beats), subtitles, title card and credits roll into absolute times.
// Pure (no Remotion imports): the MusicVideo composition renders from this, and `npm run check` reports its issues.
import type { AssetManifest, MusicVideo, Shot, Timing } from "../schema";
import { type Asset, type Issue, resolveVisual } from "./resolve";
import { findPhrase, FPS, LEAD, toFrame, wordIndexAt } from "./timing";

export type ResolvedShot = {
  index: number;
  shot: Shot;
  /** Seconds: the sung word or beat the shot cuts on (0 for the first shot). */
  at: number;
  /** Frames: first frame of the shot, and the first frame after it. */
  from: number;
  to: number;
  asset: Asset | null;
  /** Seconds into the clip the shot starts from. */
  in: number;
};
/** One lyric line on screen, `start`–`end` being its display window in seconds. */
export type SubtitleLine = { line: number; text: string; start: number; end: number };
export type MusicVideoTimeline = {
  slug: string;
  songDuration: number;
  durationInFrames: number;
  estimated: boolean;
  shots: ResolvedShot[];
  subtitles: SubtitleLine[];
  titleCard: { from: number; to: number } | null;
  /** Frames: the roll from `from` to `to`, `pages` pages of `pageFrames` each. */
  credits: { from: number; to: number; pages: number; pageFrames: number };
  issues: Issue[];
};

/** A subtitle shows this long before its first word, and holds this long after its last (until the next line). */
export const SUB_LEAD = 0.15;
export const SUB_HOLD = 0.8;
const SUB_GAP = 0.05;
/** Shots shorter than this are an error; longer than SHOT_LONG a warning (seconds). */
export const SHOT_MIN = 0.4;
export const SHOT_LONG = 5;
/** Shortest a credits page holds when a roll is squeezed into the song's tail (seconds). */
export const CREDIT_PAGE_MIN = 4;

/** The thumbnail's visual: `thumbnail.visual`, else the first shot's (what MusicVideoThumbnail renders and check vets). */
export const thumbnailVisual = (ep: Pick<MusicVideo, "thumbnail" | "shots">): string => ep.thumbnail?.visual ?? ep.shots[0].visual;

/**
 * How a clip fills its slot from its in-point: at full speed when it can, slowed (to half speed at most) when it is a
 * little short, and looped (`loopFrames`, the frames before it restarts at the in-point) only when even half speed is
 * too short. The last 0.1 s of a file is left unused (decoders can stall on it).
 */
export const clipPlayback = (duration: number, inPoint: number, slotFrames: number): { rate: number; loopFrames: number | null } => {
  const usable = Math.max(0.1, duration - inPoint - 0.1);
  const rate = Math.max(0.5, Math.min(1, usable / (slotFrames / FPS)));
  const playFrames = Math.floor((usable / rate) * FPS + 1e-6);
  return { rate, loopFrames: rate <= 0.5 && playFrames < slotFrames ? Math.max(1, playFrames) : null };
};

/** Group aligned words into subtitle lines by their `line` (words without one are skipped). */
export const subtitleLines = (words: Timing["words"]): SubtitleLine[] => {
  const groups = new Map<number, Timing["words"]>();
  for (const w of words) {
    if (w.line === undefined) continue;
    if (!groups.has(w.line)) groups.set(w.line, []);
    groups.get(w.line)!.push(w);
  }
  const lines = [...groups.entries()].sort((a, b) => a[0] - b[0]);
  return lines.map(([line, ws], i) => {
    const next = lines[i + 1]?.[1][0];
    const lastEnd = ws[ws.length - 1].end + SUB_HOLD;
    return {
      line,
      text: ws.map((w) => w.word).join(" ").replace(/[,;:]$/, ""),
      start: ws[0].start - SUB_LEAD,
      end: next ? Math.min(lastEnd, next.start - SUB_GAP) : lastEnd,
    };
  });
};

export const resolveMusicVideo = (ep: MusicVideo, timing: Timing, assets: AssetManifest, creditPages = 1): MusicVideoTimeline => {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: "warning", where, msg });
  const words = timing.words;
  const beats = timing.beats ?? [];
  const songDuration = timing.duration;
  const quote = (s: string) => `"${s}"`;

  if (timing.estimated) err("timing", `timing.json has no sung words yet. Paste the lyrics, then run \`npm run lyrics -- ${ep.slug}\`.`);

  // Cues and beats are found in order: each after the previous shot's word and time (choruses repeat).
  let prevAt = 0;
  let wordFrom = 0;
  type Hit = { at: number; from: number } | null;
  const place = (where: string, c: { cue?: string; beat?: number }, what: string): Hit => {
    if (c.cue !== undefined) {
      const m = findPhrase(words, c.cue, Math.max(wordFrom, wordIndexAt(words, prevAt + 0.01)));
      if (!m) {
        err(`${where}.cue`, `${quote(c.cue)} not found in the lyrics after ${what}`);
        return null;
      }
      wordFrom = m.endIndex;
      prevAt = m.start;
      return { at: m.start, from: toFrame(m.start - LEAD) };
    }
    if (c.beat !== undefined) {
      const at = beats[c.beat];
      if (at === undefined) {
        err(`${where}.beat`, beats.length ? `beat ${c.beat} is past the last beat (${beats.length - 1})` : `no beats in timing.json: run \`npm run lyrics -- ${ep.slug}\``);
        return null;
      }
      if (at <= prevAt) {
        err(`${where}.beat`, `beat ${c.beat} (${at.toFixed(2)}s) is not after ${what} (${prevAt.toFixed(2)}s)`);
        return null;
      }
      prevAt = at;
      return { at, from: toFrame(at) };
    }
    return null;
  };

  const hits: Hit[] = ep.shots.map((s, i) => {
    const where = `shots[${i}]`;
    if (i === 0) {
      if (s.cue !== undefined || s.beat !== undefined) warn(`${where}.${s.cue !== undefined ? "cue" : "beat"}`, "the first shot always starts at 0; its cue or beat is ignored");
      return { at: 0, from: 0 };
    }
    if (s.cue === undefined && s.beat === undefined) {
      err(`${where}.cue`, `shot ${quote(s.visual)} needs a cue (a sung phrase) or a beat to cut on`);
      return null;
    }
    return place(where, s, "the previous shot");
  });

  // Credits: on a cue or beat after the last shot, else just after the song ends.
  const c = ep.credits;
  const creditsHit = c.cue !== undefined || c.beat !== undefined ? place("credits", c, "the last shot") : null;
  const creditsFrom = creditsHit?.from ?? toFrame(songDuration) + FPS / 2;
  // A roll started inside the song spreads its pages over the song's tail (each between CREDIT_PAGE_MIN and
  // credits.seconds), and its last page holds until the song ends, so the video neither goes blank nor runs on silent.
  const songEnd = toFrame(songDuration + 1);
  const pageFrames = creditsHit
    ? Math.max(toFrame(CREDIT_PAGE_MIN), Math.min(toFrame(c.seconds), Math.floor((songEnd - creditsFrom) / creditPages)))
    : toFrame(c.seconds);
  const creditsTo = Math.max(creditsFrom + creditPages * pageFrames, creditsHit ? songEnd : 0);
  const credits = { from: creditsFrom, to: creditsTo, pages: creditPages, pageFrames };

  // Unresolved shots are spaced evenly between resolved neighbours so the preview still shows them (check fails).
  const froms = hits.map((h) => h?.from ?? null);
  for (let i = 0; i < froms.length; i++) {
    if (froms[i] !== null) continue;
    let j = i;
    while (j < froms.length && froms[j] === null) j++;
    const lo = froms[i - 1]!;
    const hi = j < froms.length ? froms[j]! : credits.from;
    for (let k = i; k < j; k++) froms[k] = Math.round(lo + ((hi - lo) * (k - i + 1)) / (j - i + 1));
    i = j;
  }

  const shots: ResolvedShot[] = ep.shots.map((shot, i) => {
    const where = `shots[${i}]`;
    const from = froms[i]!;
    const to = i + 1 < froms.length ? froms[i + 1]! : credits.from;
    const asset = resolveVisual(assets, shot.visual);
    if (!asset) err(`${where}.visual`, `visual ${quote(shot.visual)} not found in clips/ or images/ (run \`npm run assets -- ${ep.slug}\` after adding files)`);
    const secs = (to - from) / FPS;
    if (to - from < toFrame(SHOT_MIN)) err(where, `shot ${quote(shot.visual)} is only ${secs.toFixed(2)}s long (minimum ${SHOT_MIN}s); its cut points are probably out of order`);
    else if (secs > SHOT_LONG) warn(where, `shot ${quote(shot.visual)} holds for ${secs.toFixed(1)}s; over ${SHOT_LONG}s drags: music videos cut every 3–4 s`);
    const inPoint = shot.in ?? 0;
    if (asset?.kind === "clip") {
      if (inPoint >= asset.duration) err(`${where}.in`, `in-point ${inPoint}s is past the end of ${quote(shot.visual)} (${asset.duration.toFixed(1)}s)`);
      else if (asset.duration - inPoint < secs * 0.5) warn(`${where}.in`, `${quote(shot.visual)} has ${(asset.duration - inPoint).toFixed(1)}s left from the in-point for a ${secs.toFixed(1)}s shot: it is slowed to half speed and looped`);
    }
    return { index: i, shot, at: hits[i]?.at ?? from / FPS, from, to, asset, in: inPoint };
  });

  return {
    slug: ep.slug,
    songDuration,
    durationInFrames: Math.max(toFrame(songDuration + 1), credits.to),
    estimated: !!timing.estimated,
    shots,
    subtitles: subtitleLines(words),
    titleCard: ep.titleCard ? { from: 0, to: toFrame(ep.titleCard.seconds) } : null,
    credits,
    issues,
  };
};
