// Give every lyric word a time when the transcription missed some of them (music videos, npm run lyrics). Pure.
// Sung words Whisper didn't hear are placed inside their own lyric line, next to the heard words of that line, never
// spread across an instrumental between lines (which would put a subtitle up during the solo).

/** Width given to each unheard word when it is packed next to a heard one (seconds). */
export const UNHEARD_WORD = 0.35;

type Span = [number, number];

/** Pack `count` words back-to-back in [lo, hi], each UNHEARD_WORD wide when there is room, evenly squeezed otherwise. */
const pack = (count: number, lo: number, hi: number, anchor: "start" | "end"): Span[] => {
  const width = Math.max(0, hi - lo) >= count * UNHEARD_WORD ? UNHEARD_WORD : Math.max(0, hi - lo) / count;
  const start = anchor === "start" ? lo : hi - width * count;
  return Array.from({ length: count }, (_, k) => [start + k * width, start + (k + 1) * width] as Span);
};

/**
 * `times[i]` is the heard time of lyric word i (null when not heard), `lines[i]` its lyric line.
 * Returns a time for every word, in order, within [0, duration].
 */
export const placeUnmatched = (times: (Span | null)[], lines: number[], duration: number): Span[] => {
  const n = times.length;
  if (times.every((t) => t === null)) return Array.from({ length: n }, (_, k) => [(duration * k) / n, (duration * (k + 1)) / n] as Span);
  const out: Span[] = times.map((t) => (t ? [t[0], t[1]] : [0, 0]));
  let i = 0;
  while (i < n) {
    if (times[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !times[j]) j++;
    const prevEnd = i > 0 ? out[i - 1][1] : 0;
    const nextStart = j < n ? out[j][0] : duration;
    const sameLine = (a: number, b: number) => a >= 0 && b < n && lines[a] === lines[b];

    if (i > 0 && j < n && sameLine(i - 1, i) && sameLine(j - 1, j) && lines.slice(i, j).every((l) => l === lines[i])) {
      // One line, heard words on both sides: share the gap evenly.
      const step = (nextStart - prevEnd) / (j - i);
      for (let k = i; k < j; k++) out[k] = [prevEnd + step * (k - i), prevEnd + step * (k - i + 1)];
    } else {
      // The words that finish the previous heard word's line follow it; the rest lead into the next heard word.
      let split = i;
      if (i > 0) while (split < j && lines[split] === lines[i - 1]) split++;
      let lo = prevEnd;
      if (split > i) {
        const after = pack(split - i, prevEnd, nextStart, "start");
        after.forEach((s, k) => (out[i + k] = s));
        lo = after[after.length - 1][1];
      }
      if (j > split) pack(j - split, lo, nextStart, "end").forEach((s, k) => (out[split + k] = s));
    }
    i = j;
  }
  return out;
};
