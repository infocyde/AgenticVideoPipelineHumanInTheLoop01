// Pure timing helpers (no Remotion imports), shared by components and the Node scripts.
import type { Word } from "../schema";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** Each scene cuts in this long before its marker word, so slams land on the word. */
export const LEAD = 0.12;
/** Seconds of picture after the voiceover ends (when there is no end screen). */
export const TAIL = 3;

export const toFrame = (sec: number) => Math.round(sec * FPS);

/** Segment animations start this many frames earlier without a number slam (list format). */
export const segmentOffset = (slam: boolean) => (slam ? 0 : -12);
/** Locator map card: glitches at this segment frame (plus segmentOffset), ~1.2s after it lands, then slides off right. */
export const MAP_EXIT = 70;
export const MAP_GLITCH = 8;
export const MAP_SLIDE = 9;
/** As the map card slides off, the segment's text block shrinks to this scale in the top-left corner. */
export const TEXT_SHRINK = 0.5;

/** Lowercase, strip accents and punctuation: "Flávio," -> "flavio". */
export const norm = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export type Match = { index: number; start: number; end: number; endIndex: number };

/**
 * Find the first word sequence matching `phrase` with its first word in [from, to) (word indexes).
 * Every word must match exactly except the last, which may be a prefix ("kiwi" matches "kiwifruit").
 */
export const findPhrase = (words: Word[], phrase: string, from = 0, to = words.length): Match | null => {
  const target = phrase.split(/\s+/).map(norm).filter(Boolean);
  if (!target.length) return null;
  const last = target.length - 1;
  for (let i = Math.max(0, from); i < Math.min(to, words.length - last); i++) {
    const ok = target.every((t, j) => {
      const w = norm(words[i + j].word);
      return j === last ? w.startsWith(t) : w === t;
    });
    if (ok) return { index: i, start: words[i].start, end: words[i + last].end, endIndex: i + last + 1 };
  }
  return null;
};

/** Index of the first word starting at or after `sec`. */
export const wordIndexAt = (words: Word[], sec: number) => {
  const i = words.findIndex((w) => w.start >= sec);
  return i === -1 ? words.length : i;
};

/** Caption chunks: ≤5 words and ≤30 chars, breaking after punctuation or on pauses longer than 0.35s. */
export type Chunk = { words: Word[]; start: number; end: number };
export const captionChunks = (words: Word[]): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && prev && w.start - prev.end > 0.35) flush();
    if (cur.length && [...cur, w].map((c) => c.word).join(" ").length > 30) flush();
    cur.push(w);
    if (/[.,!?;:]["')\]]?$/.test(w.word) || cur.length >= 5) flush();
  });
  flush();
  return chunks;
};

/**
 * The caption chunk to show at `sec`: the latest chunk that has started (50 ms early), held up to 0.25 s past its last
 * word. When speech runs straight on, the next chunk replaces the previous one as soon as it starts.
 */
export const activeChunk = (chunks: Chunk[], sec: number): Chunk | undefined => {
  let hit: Chunk | undefined;
  for (const c of chunks) {
    if (sec < c.start - 0.05) break;
    if (sec < c.end + 0.25) hit = c;
  }
  return hit;
};

/** Gaps in speech longer than `min` seconds (used to swell the music bed). */
export const speechGaps = (words: Word[], duration: number, min = 0.4): [number, number][] => {
  const gaps: [number, number][] = [];
  let prevEnd = 0;
  for (const w of words) {
    if (w.start - prevEnd > min) gaps.push([prevEnd, w.start]);
    prevEnd = Math.max(prevEnd, w.end);
  }
  if (duration - prevEnd > min) gaps.push([prevEnd, duration]);
  return gaps;
};

/**
 * Rough timing from text alone (~2.6 words/s, pauses after sentences and paragraphs).
 * Used by `npm run new` and `align --estimate` so a draft previews before the voiceover exists.
 */
export const estimateTiming = (script: string) => {
  const words: Word[] = [];
  let t = 0.2;
  for (const para of script.split(/\n\s*\n/)) {
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const len = 0.18 + norm(word).length * 0.045;
      words.push({ word, start: +t.toFixed(3), end: +(t + len).toFixed(3) });
      t += len + 0.04;
      if (/[.!?]["')\]]?$/.test(word)) t += 0.35;
      else if (/[,;:]$/.test(word)) t += 0.15;
    }
    t += 0.45;
  }
  return { duration: +(t + 0.3).toFixed(3), estimated: true, words };
};
