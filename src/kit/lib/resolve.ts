// Resolve an episode's spoken cues against the aligned words into absolute times.
// Pure (no Remotion imports): the composition renders from this, and `npm run check` reports its issues.
import { type AssetManifest, type Beat, type Episode, isTextSection, type OutroLine, type Pin, type Segment, type SegmentVisual, type Stat, type TextSection, type Timing, type Word } from "../schema";
import { captionChunks, type Chunk, findPhrase, FPS, LEAD, TAIL, toFrame } from "./timing";

export type Issue = { level: "error" | "warning"; where: string; msg: string };

export type Asset = { kind: "clip"; file: string; duration: number } | { kind: "image"; file: string };

export type ResolvedVisual = { name: string; note?: string; at: number; asset: Asset | null };
export type ResolvedStat = Stat & { at: number };
export type ResolvedSegment = {
  /** Position in episode.segments (text sections included), as used in issue paths like `segments[3]`. */
  index: number;
  num: number;
  seg: Segment;
  /** Marker start, end of the marker phrase, and the next segment's (or the outro's) marker start, in seconds. */
  start: number;
  markerEnd: number;
  end: number;
  from: number; // first frame of the scene (LEAD before the marker)
  to: number; // first frame after the scene
  stats: ResolvedStat[];
  visuals: ResolvedVisual[];
};
/** A text section (`kind: "text"`): no number, no stats or map; same timing fields as a segment. */
export type ResolvedText = {
  index: number;
  seg: TextSection;
  start: number;
  markerEnd: number;
  end: number;
  from: number;
  to: number;
  visuals: ResolvedVisual[];
};
export type ResolvedBeat = { beat: Beat; start: number; end: number; asset: Asset | null };

export type Timeline = {
  slug: string;
  format: Episode["format"];
  total: number;
  words: Word[];
  chunks: Chunk[];
  voiceoverDuration: number;
  durationInFrames: number;
  estimated: boolean;
  coldOpen: { end: number; to: number; beats: ResolvedBeat[]; title: { start: number; bigAt: number } };
  /** Numbered segments only. */
  segments: ResolvedSegment[];
  /** Text sections, in order. */
  texts: ResolvedText[];
  outro: { start: number; from: number; to: number; lines: { line: OutroLine; at: number }[]; cta: { label?: string; at: number } | null; captionsOff: number };
  sourcesCard: { from: number; to: number } | null;
  creditsCard: { from: number; to: number } | null;
  endScreen: { from: number; to: number } | null;
  issues: Issue[];
};

export const resolveVisual = (assets: AssetManifest, name: string): Asset | null => {
  const clip = assets.clips[name];
  if (clip) return { kind: "clip", file: clip.file, duration: clip.duration ?? 1 };
  const img = assets.images[name];
  if (img) return { kind: "image", file: img.file };
  return null;
};

/** The numbered segments of an episode (text sections left out). */
export const items = (ep: Episode): Segment[] => ep.segments.filter((s): s is Segment => !isTextSection(s));

/** Shown number of the scene at `i` in episode.segments; text sections don't use up a number. */
export const segmentNum = (ep: Episode, i: number) => {
  const s = ep.segments[i];
  if (!isTextSection(s) && s.num) return s.num;
  const ord = ep.segments.slice(0, i).filter((x) => !isTextSection(x)).length;
  return ep.format === "countdown" ? items(ep).length - ord : ord + 1;
};

/** One pin per segment (its first), for the all-fronts map. */
export const firstPins = (ep: Episode): Pin[] => items(ep).flatMap((s) => s.map?.pins.slice(0, 1) ?? []);
export const allPins = (ep: Episode): Pin[] => items(ep).flatMap((s) => s.map?.pins ?? []);

/** The sources card shows at most this many sources at once; more are split evenly over several cards. */
export const SOURCES_PER_CARD = 8;
/** Index ranges [start, end) of the sources on each card, e.g. 16 sources -> [[0, 8], [8, 16]]. */
export const sourcePages = (n: number): [number, number][] => {
  const pages = Math.max(1, Math.ceil(n / SOURCES_PER_CARD));
  const per = Math.ceil(n / pages);
  return Array.from({ length: pages }, (_, p) => [p * per, Math.min(n, (p + 1) * per)] as [number, number]);
};

export const resolveEpisode = (ep: Episode, timing: Timing, assets: AssetManifest): Timeline => {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
  const words = timing.words;
  const quote = (s: string) => `"${s}"`;

  if (timing.estimated) {
    err("timing", "timing.json is an estimate from text only. Record the voiceover, then run `npm run align -- " + ep.slug + "`.");
  }

  // --- segment markers (sequential) ---
  type Hit = { index: number; endIndex: number; start: number; end: number } | null;
  const markerHits: Hit[] = [];
  let from = 0;
  ep.segments.forEach((s, i) => {
    const m = findPhrase(words, s.marker, from);
    if (!m) err(`segments[${i}].marker`, `${quote(s.marker)} not found in the voiceover after the previous marker`);
    markerHits.push(m);
    if (m) from = m.endIndex;
  });

  const outroHit = findPhrase(words, ep.outro.cue, from);
  if (!outroHit) err("outro.cue", `${quote(ep.outro.cue)} not found after the last segment marker`);
  const outroStart = outroHit?.start ?? Math.max(timing.duration - 6, 0);

  // Fill unresolved markers by spacing them evenly between resolved neighbours (preview only; check fails).
  const firstSegFallback = Math.min(8, outroStart / (ep.segments.length + 1));
  const starts = markerHits.map((m) => m?.start ?? null);
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] !== null) continue;
    let j = i;
    while (j < starts.length && starts[j] === null) j++;
    const lo = i > 0 ? starts[i - 1]! : firstSegFallback;
    const hi = j < starts.length ? starts[j]! : outroStart;
    const step = (hi - lo) / (j - i + (i > 0 ? 1 : 0));
    for (let k = i; k < j; k++) starts[k] = lo + step * (k - i + (i > 0 ? 1 : 0));
  }
  const idxAt = (sec: number) => {
    const k = words.findIndex((w) => w.start >= sec - 1e-6);
    return k === -1 ? words.length : k;
  };
  const firstSegStart = starts[0]!;
  const firstSegIdx = markerHits[0]?.index ?? idxAt(firstSegStart);

  // --- cold open ---
  const beats: ResolvedBeat[] = [];
  let bFrom = 0;
  const beatTimes: (number | null)[] = ep.coldOpen.beats.map((b, i) => {
    const m = findPhrase(words, b.cue, bFrom, firstSegIdx);
    if (!m) err(`coldOpen.beats[${i}].cue`, `${quote(b.cue)} not found before the first segment marker`);
    else bFrom = m.endIndex;
    return m?.start ?? null;
  });
  const titleHit = findPhrase(words, ep.coldOpen.title.cue, bFrom, firstSegIdx);
  if (!titleHit) err("coldOpen.title.cue", `${quote(ep.coldOpen.title.cue)} not found after the last beat and before the first segment marker`);
  const titleStart = titleHit?.start ?? Math.max(0, firstSegStart - 3);
  let bigAt = titleStart + 0.3;
  if (ep.coldOpen.title.bigCue) {
    const m = findPhrase(words, ep.coldOpen.title.bigCue, titleHit?.index ?? bFrom, firstSegIdx);
    if (!m) err("coldOpen.title.bigCue", `${quote(ep.coldOpen.title.bigCue)} not found inside the title line`);
    else bigAt = m.start;
  }
  if (beatTimes[0] !== null && beatTimes[0] > 0.6) {
    issues.push({ level: "warning", where: "coldOpen.beats[0].cue", msg: `first beat starts at ${beatTimes[0].toFixed(2)}s; the picture before it is blank` });
  }
  ep.coldOpen.beats.forEach((b, i) => {
    const start = i === 0 ? 0 : beatTimes[i] ?? (titleStart * i) / ep.coldOpen.beats.length;
    const nextT = i + 1 < beatTimes.length ? beatTimes[i + 1] : null;
    const end = nextT ?? (i + 1 < ep.coldOpen.beats.length ? (titleStart * (i + 1)) / ep.coldOpen.beats.length : titleStart);
    let asset: Asset | null = null;
    if (b.visual) {
      asset = resolveVisual(assets, b.visual);
      if (!asset) err(`coldOpen.beats[${i}].visual`, `visual ${quote(b.visual)} not found in clips/ or images/ (run \`npm run assets -- ${ep.slug}\` after adding files)`);
    } else if (!b.map) {
      issues.push({ level: "warning", where: `coldOpen.beats[${i}]`, msg: "beat has neither a visual nor map: 'all-pins'; it shows a plain background" });
    }
    beats.push({ beat: b, start, end, asset });
  });

  // --- segments and text sections ---
  if (!items(ep).length) err("segments", 'every scene is a text section; add at least one numbered segment (no `kind`, or `kind: "item"`)');
  const segments: ResolvedSegment[] = [];
  const texts: ResolvedText[] = [];
  ep.segments.forEach((seg, i) => {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? starts[i + 1]! : outroStart;
    const hit = markerHits[i];
    const lo = hit?.endIndex ?? idxAt(start);
    const hi = idxAt(end);
    const where = `segments[${i}]`;
    const what = isTextSection(seg) ? "section" : "segment";

    let vFrom = lo;
    const resolveVisuals = (list: SegmentVisual[]) =>
      list.map((v, k) => {
        const asset = resolveVisual(assets, v.name);
        if (!asset) err(`${where}.visuals[${k}]`, `visual ${quote(v.name)} not found in clips/ or images/ (run \`npm run assets -- ${ep.slug}\` after adding files)`);
        if (k === 0) {
          if (v.cue) issues.push({ level: "warning", where: `${where}.visuals[0].cue`, msg: `the first visual always starts with the ${what}; its cue is ignored` });
          return { name: v.name, note: v.note, at: start, asset };
        }
        if (!v.cue) {
          err(`${where}.visuals[${k}].cue`, `visual ${quote(v.name)} needs a cue (the spoken phrase it cuts on)`);
          return { name: v.name, note: v.note, at: start + ((end - start) * k) / list.length, asset };
        }
        const m = findPhrase(words, v.cue, vFrom, hi);
        if (!m) err(`${where}.visuals[${k}].cue`, `${quote(v.cue)} not found inside ${what} "${seg.marker}"${k > 1 ? " after the previous visual cue" : ""}`);
        else vFrom = m.endIndex;
        return { name: v.name, note: v.note, at: m?.start ?? start + ((end - start) * k) / list.length, asset };
      });

    const base = { index: i, start, markerEnd: hit?.end ?? start + 0.6, end, from: toFrame(start - LEAD), to: toFrame(end - LEAD) };
    if (isTextSection(seg)) {
      texts.push({ ...base, seg, visuals: resolveVisuals(seg.visuals) });
      return;
    }

    let sFrom = lo;
    const stats = seg.stats.map((st, k) => {
      const m = findPhrase(words, st.cue, sFrom, hi);
      if (!m) err(`${where}.stats[${k}].cue`, `${quote(st.cue)} not found inside segment "${seg.marker}"${k ? " after the previous stat" : ""}`);
      else sFrom = m.endIndex;
      return { ...st, at: m?.start ?? start + 2 + k * 2 };
    });
    segments.push({ ...base, num: segmentNum(ep, i), seg, stats, visuals: resolveVisuals(seg.visuals) });
  });

  [...segments, ...texts].forEach((s) => {
    if (s.end - s.start < 3) err(`segments[${s.index}]`, `${isTextSection(s.seg) ? "section" : "segment"} "${s.seg.marker}" is only ${(s.end - s.start).toFixed(2)}s long; markers are probably out of order`);
  });

  // --- outro ---
  const outroIdx = outroHit?.index ?? idxAt(outroStart);
  let lFrom = outroHit?.endIndex ?? outroIdx;
  const lines = ep.outro.lines.map((line, k) => {
    if (!line.cue) {
      if (k > 0) err(`outro.lines[${k}].cue`, "every outro line after the first needs a cue");
      return { line, at: k === 0 ? outroStart : outroStart + k * 2 };
    }
    const m = findPhrase(words, line.cue, k === 0 ? outroIdx : lFrom);
    if (!m) err(`outro.lines[${k}].cue`, `${quote(line.cue)} not found in the outro${k ? " after the previous line" : ""}`);
    else lFrom = m.endIndex;
    return { line, at: m?.start ?? outroStart + k * 2 };
  });
  let cta: Timeline["outro"]["cta"] = null;
  if (ep.outro.cta) {
    const m = findPhrase(words, ep.outro.cta.cue, lFrom);
    if (!m) err("outro.cta.cue", `${quote(ep.outro.cta.cue)} not found after the last outro line`);
    cta = { label: ep.outro.cta.label, at: m?.start ?? lines[lines.length - 1].at + 1.5 };
  }

  ep.audio.sfxExtra.forEach((x, i) => {
    if (!findPhrase(words, x.cue)) err(`audio.sfxExtra[${i}].cue`, `${quote(x.cue)} not found in the voiceover`);
  });

  // After the voiceover: [1s settle] sources card, then end screen; otherwise a plain tail.
  const voiceoverDuration = timing.duration;
  const voEnd = toFrame(voiceoverDuration);
  const { sourcesCard: sc, creditsCard: cc, endScreen: es } = ep.outro;
  if (sc && !ep.sources.length) {
    err("sources", "no sources: every episode ends on a sources card, so add the article's sources (or set outro.sourcesCard to false)");
  }
  const card = (start: number, seconds?: number) => (seconds ? { from: start, to: start + toFrame(seconds) } : null);
  const sourcesCard = card(voEnd + FPS, sc ? sc.seconds * sourcePages(ep.sources.length).length : undefined);
  const creditsCard = card(sourcesCard?.to ?? voEnd + FPS, cc ? cc.seconds : undefined);
  const endScreen = card(creditsCard?.to ?? sourcesCard?.to ?? voEnd, es?.seconds);
  const durationInFrames = Math.max(1, endScreen?.to ?? creditsCard?.to ?? sourcesCard?.to ?? toFrame(voiceoverDuration + TAIL));
  const outroFrom = toFrame(outroStart - LEAD);

  return {
    slug: ep.slug,
    format: ep.format,
    total: segments.length,
    words,
    chunks: captionChunks(words),
    voiceoverDuration,
    durationInFrames,
    estimated: !!timing.estimated,
    coldOpen: { end: firstSegStart, to: toFrame(firstSegStart - LEAD), beats, title: { start: titleStart, bigAt } },
    segments,
    texts,
    outro: {
      start: outroStart,
      from: outroFrom,
      to: sourcesCard?.from ?? creditsCard?.from ?? endScreen?.from ?? durationInFrames,
      lines,
      cta,
      captionsOff: lines[lines.length - 1].at,
    },
    sourcesCard,
    creditsCard,
    endScreen,
    issues,
  };
};
