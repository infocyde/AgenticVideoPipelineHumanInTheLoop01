// Sound-effect presets: scene events -> library sounds. Pure, so `npm run credits` can list what an episode uses.
import type { Episode } from "../schema";
import type { Timeline } from "./resolve";
import { findPhrase, FPS, LEAD, MAP_EXIT, segmentOffset } from "./timing";

// Keep in sync with SFX_EVENTS in schema.ts (episodes can silence any of these with audio.sfxOff).
export type SfxEvent =
  | "open" // t=0
  | "beatCut" // every cold-open beat after the first
  | "stampBeat" // cold-open beats that show a stamp over a visual
  | "title" // cold-open title card appears
  | "coldOpenEnd" // first segment marker
  | "segment" // every segment scene cut (base = cut time, LEAD before the marker)
  | "section" // every text-section scene cut (base = cut time)
  | "slam" // countdown number slam (countdown format only; base = cut time)
  | "slamTop" // the slam of an `emphasis: "top"` segment (replaces "slam")
  | "top" // emphasis segment alarm (base = cut time)
  | "stat" // stat callout cue
  | "visualCut" // b-roll cut on a cue (segments and text sections)
  | "mapExit" // locator map card glitches out (segments with a map)
  | "outro" // outro marker
  | "outroLine" // each outro line after the first
  | "cta"; // subscribe button click

/** `sfx` alternates through the list across repeated events (e.g. whoosh, whoosh2). */
export type Hit = { sfx: string | string[]; offset: number; volume: number };
export type SfxPreset = Partial<Record<SfxEvent, Hit[]>>;

const CTA_CLICK = 17 / FPS;

/** The reference episode's mix. */
const intense: SfxPreset = {
  open: [{ sfx: "impact", offset: 0, volume: 0.7 }],
  beatCut: [{ sfx: "glitch", offset: -0.05, volume: 0.45 }],
  stampBeat: [{ sfx: "alarm", offset: 0.15, volume: 0.12 }],
  title: [{ sfx: "riser", offset: -2.4, volume: 0.5 }],
  coldOpenEnd: [{ sfx: "impact", offset: -1.1, volume: 0.9 }],
  segment: [
    { sfx: ["whoosh", "whoosh2"], offset: -0.35, volume: 0.55 },
    { sfx: "typing", offset: 0.75, volume: 0.12 },
  ],
  section: [{ sfx: ["whoosh", "whoosh2"], offset: -0.35, volume: 0.45 }],
  slam: [{ sfx: "impact", offset: 0.1, volume: 0.75 }],
  slamTop: [{ sfx: "impact", offset: 0.1, volume: 1 }],
  top: [{ sfx: "alarm", offset: LEAD + 0.6, volume: 0.35 }],
  stat: [{ sfx: "tick", offset: 0, volume: 0.6 }],
  visualCut: [{ sfx: "glitch", offset: -0.03, volume: 0.3 }],
  mapExit: [{ sfx: "glitch", offset: 0, volume: 0.25 }],
  outro: [{ sfx: "whoosh2", offset: -0.3, volume: 0.5 }],
  outroLine: [{ sfx: "impact", offset: 0, volume: 0.8 }],
  cta: [{ sfx: "tick", offset: CTA_CLICK, volume: 0.8 }],
};

/** Softer: transitions and ticks only, no alarms or impacts. */
const calm: SfxPreset = {
  title: [{ sfx: "riser", offset: -2.4, volume: 0.25 }],
  segment: [{ sfx: ["whoosh", "whoosh2"], offset: -0.35, volume: 0.35 }],
  section: [{ sfx: ["whoosh", "whoosh2"], offset: -0.35, volume: 0.3 }],
  stat: [{ sfx: "tick", offset: 0, volume: 0.4 }],
  visualCut: [{ sfx: "whoosh", offset: -0.2, volume: 0.12 }],
  outro: [{ sfx: "whoosh2", offset: -0.3, volume: 0.35 }],
  cta: [{ sfx: "tick", offset: CTA_CLICK, volume: 0.6 }],
};

export const SFX_PRESETS: Record<Episode["audio"]["sfxPreset"], SfxPreset> = { intense, calm, none: {} };

export type SfxCue = { at: number; sfx: string; volume: number };

/** Every sound-effect hit of an episode, in seconds (before checking which sounds exist). */
export const sfxCues = (ep: Episode, tl: Timeline): SfxCue[] => {
  const preset = SFX_PRESETS[ep.audio.sfxPreset];
  const cues: SfxCue[] = [];
  const count: Record<string, number> = {};
  const off = new Set<string>(ep.audio.sfxOff);
  const fire = (event: SfxEvent, base: number) => {
    if (off.has(event)) return;
    for (const h of preset[event] ?? []) {
      const n = (count[event] = (count[event] ?? 0) + 1) - 1;
      const sfx = Array.isArray(h.sfx) ? h.sfx[Math.floor(n / Math.max(1, (preset[event] ?? []).length)) % h.sfx.length] : h.sfx;
      cues.push({ at: base + h.offset, sfx, volume: h.volume });
    }
  };

  fire("open", 0);
  tl.coldOpen.beats.forEach((b, i) => {
    if (i > 0) fire("beatCut", b.start);
    if (b.asset && !b.beat.map) fire("stampBeat", b.start);
  });
  fire("title", tl.coldOpen.title.start);
  fire("coldOpenEnd", tl.coldOpen.end);

  tl.segments.forEach((s) => {
    const cut = s.start - LEAD;
    fire("segment", cut);
    if (ep.format === "countdown") fire(s.seg.emphasis === "top" ? "slamTop" : "slam", cut);
    if (s.seg.emphasis === "top") fire("top", cut);
    s.stats.forEach((st) => fire("stat", st.at));
    s.visuals.forEach((v, k) => k > 0 && v.asset && fire("visualCut", v.at));
    const mapExit = cut + (MAP_EXIT + segmentOffset(ep.format === "countdown")) / FPS;
    if (s.seg.map && mapExit < s.end) fire("mapExit", mapExit);
  });
  tl.texts.forEach((t) => {
    fire("section", t.start - LEAD);
    t.visuals.forEach((v, k) => k > 0 && v.asset && fire("visualCut", v.at));
  });

  fire("outro", tl.outro.start);
  tl.outro.lines.forEach((l, k) => k > 0 && fire("outroLine", l.at));
  if (tl.outro.cta) fire("cta", tl.outro.cta.at);

  // One-off hits from audio.sfxExtra (unresolved cues are reported by resolveEpisode).
  for (const x of ep.audio.sfxExtra) {
    const m = findPhrase(tl.words, x.cue);
    if (m) cues.push({ at: m.start + x.offset, sfx: x.sfx, volume: x.volume });
  }

  return cues.filter((c) => c.at >= 0).sort((a, b) => a.at - b.at);
};
