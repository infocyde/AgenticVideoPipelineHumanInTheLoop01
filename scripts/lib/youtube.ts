// YouTube research parsing (pure, no network or fs): yt-dlp json3 captions, search results,
// license and clip-range checks, video ids, block detection and clip credits. Used by
// scripts/youtube.ts. The render-side URL/tag helpers live in src/kit/lib/youtube.ts.
import type { Credit } from "../../src/kit/schema.ts";

export type TranscriptLine = { start: number; text: string };

type CaptionTrack = { ext?: string; url?: string; name?: string };

/** The yt-dlp `-J` fields this kit reads. */
export type VideoInfo = {
  id: string;
  title: string;
  channel?: string;
  uploader?: string;
  channel_url?: string;
  upload_date?: string;
  duration?: number;
  description?: string;
  license?: string;
  view_count?: number;
  /** The spoken language yt-dlp detected (from the audio track or the ASR captions); often null. */
  language?: string | null;
  subtitles?: Record<string, CaptionTrack[]>;
  automatic_captions?: Record<string, CaptionTrack[]>;
};

export type SearchHit = {
  id: string;
  title: string;
  channel: string;
  duration: number;
  url: string;
  uploadDate?: string;
  views?: number;
};

const words = (s: string) => s.split(" ").filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const SOUND_CUES = new Set(["applause", "laughter", "laughs", "music", "inaudible", "crosstalk", "cheering", "silence"]);
/** A `(...)` that is a sound cue (`(applause)`, `(MUSIC PLAYING)`), not a spoken aside like `(about 15%)`. */
const isSoundCue = (inner: string) => {
  const t = inner.trim();
  return SOUND_CUES.has(t.toLowerCase()) || (/\p{L}/u.test(t) && !/\d/.test(t) && t === t.toUpperCase());
};

/**
 * Parse yt-dlp json3 captions into timed lines: no empty events, no `[Music]` or `(applause)` cues, and for auto
 * captions no rolling duplicates (manual captions are kept line for line, repeats included).
 */
export function parseJson3(raw: unknown, kind: "manual" | "auto" = "auto"): TranscriptLine[] {
  const events = (raw as { events?: unknown })?.events;
  if (!Array.isArray(events)) return [];
  const out: TranscriptLine[] = [];
  for (const e of events) {
    if (!e || !Array.isArray(e.segs)) continue;
    const text = e.segs
      .map((s: { utf8?: string }) => s?.utf8 ?? "")
      .join("")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\(([^)]*)\)/g, (m: string, inner: string) => (isSoundCue(inner) ? " " : m))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const start = Math.round(((Number(e.tStartMs) || 0) / 1000) * 1000) / 1000;
    const prev = out[out.length - 1];
    if (!prev || kind === "manual") {
      out.push({ start, text });
      continue;
    }
    const pw = words(prev.text);
    let nw = words(text);
    const pn = pw.map(norm);
    const nn = nw.map(norm);
    // The new line repeats the previous one and extends it: grow the previous line.
    if (nn.length > pn.length && pn.every((w, i) => w === nn[i])) {
      prev.text = text;
      continue;
    }
    // Longest overlap between the previous line's tail and the new line's head.
    let k = 0;
    for (let n = Math.min(pn.length, nn.length); n >= 1; n--) {
      if (pn.slice(-n).every((w, i) => w === nn[i]) && (n >= 2 || n === nn.length)) {
        k = n;
        break;
      }
    }
    nw = nw.slice(k);
    if (nw.length) out.push({ start, text: nw.join(" ") });
  }
  return out;
}

function stamp(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `[${h}:${String(m).padStart(2, "0")}:${ss}]` : `[${String(m).padStart(2, "0")}:${ss}]`;
}

/** One paragraph per ~20 s window, each starting `[mm:ss] ` (`[h:mm:ss]` past an hour). */
export function formatTranscript(lines: TranscriptLine[]): string {
  const paras: string[] = [];
  let winStart = 0;
  let cur: string[] = [];
  for (const l of lines) {
    if (cur.length && l.start - winStart >= 20) {
      paras.push(cur.join(" "));
      cur = [];
    }
    if (!cur.length) {
      winStart = l.start;
      cur.push(`${stamp(l.start)} ${l.text}`);
    } else cur.push(l.text);
  }
  if (cur.length) paras.push(cur.join(" "));
  return paras.join("\n\n");
}

/** The first `n` words with timestamps removed, plus `…` if truncated. */
export function firstWords(text: string, n: number): string {
  const all = words(text.replace(/\[(?:\d+:)?\d{2}:\d{2}\]/g, " ").replace(/\s+/g, " ").trim());
  return all.length > n ? all.slice(0, n).join(" ") + "…" : all.join(" ");
}

function json3Url(tracks?: CaptionTrack[]): string | null {
  return tracks?.find((t) => t.ext === "json3" && t.url)?.url ?? null;
}

/**
 * Best json3 caption track: manual English, then auto English. `from` is set when the auto English track is YouTube's
 * machine translation: of the speech (plain `en` on a video whose ASR track, `<xx>-orig`, or `language` isn't English)
 * or of manual subtitles (`en-<xx>`).
 */
export function pickCaptions(info: VideoInfo): { lang: string; kind: "manual" | "auto"; url: string; from?: string } | null {
  const isEn = (l: string) => l === "en" || l.startsWith("en-");
  const find = (src: Record<string, CaptionTrack[]> | undefined, ok: (l: string) => boolean, order: string[]) => {
    const langs = Object.keys(src ?? {}).filter(ok);
    langs.sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib);
    });
    for (const lang of langs) {
      const url = json3Url(src![lang]);
      if (url) return { lang, url };
    }
    return null;
  };
  const m = find(info.subtitles, isEn, ["en"]);
  if (m) return { ...m, kind: "manual" };
  const auto = info.automatic_captions ?? {};
  const spoken = Object.keys(auto).find((l) => l.endsWith("-orig"))?.slice(0, -"-orig".length) ?? info.language ?? undefined;
  const from = (l: string) => (l === "en-orig" ? undefined : l.startsWith("en-") ? l.slice(3) : spoken && !isEn(spoken) ? spoken : undefined);
  const a = find(auto, (l) => isEn(l) && !from(l), ["en", "en-orig"]) ?? find(auto, isEn, ["en"]);
  if (!a) return null;
  const src = from(a.lang);
  return src ? { ...a, kind: "auto", from: src } : { ...a, kind: "auto" };
}

/** `cc-by` only when YouTube reports a Creative Commons license. */
export function classifyLicense(info: VideoInfo): "cc-by" | "standard" {
  return /creative commons/i.test(info.license ?? "") ? "cc-by" : "standard";
}

/** Seconds from `83`, `83.5`, `1:23` or `1:02:03`; throws on anything else. */
export function parseTimestamp(s: string): number {
  const parts = s.trim().split(":");
  if (parts.length > 3 || !parts.every((p, i) => (i === parts.length - 1 ? /^\d+(\.\d+)?$/ : /^\d+$/).test(p))) {
    throw new Error(`Bad timestamp "${s}" (use 83, 1:23 or 1:02:03)`);
  }
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** Error text for a clip range that is out of order, past the end, or over 15 s; `null` when fine. */
export function validateRange(from: number, to: number, duration: number): string | null {
  if (!(to > from)) return `Range end (${to}s) must be after its start (${from}s).`;
  if (to > duration) return `Range end (${to}s) is past the end of the video (${duration}s).`;
  if (to - from > 15) return `Range is ${to - from}s; clips are limited to 15s.`;
  return null;
}

/** Search hits from a `yt-dlp --flat-playlist -J` result. */
export function searchHits(raw: unknown): SearchHit[] {
  const entries = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) return [];
  const hits: SearchHit[] = [];
  for (const e of entries) {
    if (!e?.id || !e.title) continue;
    const hit: SearchHit = {
      id: e.id,
      title: e.title,
      channel: e.channel ?? e.uploader ?? "",
      duration: Number(e.duration) || 0,
      url: e.url ?? `https://www.youtube.com/watch?v=${e.id}`,
    };
    const d = /^(\d{4})(\d{2})(\d{2})$/.exec(e.upload_date ?? "");
    if (d) hit.uploadDate = `${d[1]}-${d[2]}-${d[3]}`;
    if (typeof e.view_count === "number") hit.views = e.view_count;
    hits.push(hit);
  }
  return hits;
}

/** The 11-character video id from a bare id or a watch, youtu.be, shorts, embed or live URL; `null` otherwise. */
export function videoId(idOrUrl: string): string | null {
  const s = idOrUrl.trim();
  const ID = /^[\w-]{11}$/;
  if (ID.test(s)) return s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let id: string | null | undefined;
  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([^/]+)/.exec(u.pathname)?.[1];
  }
  return id && ID.test(id) ? id : null;
}

/** True when yt-dlp's stderr shows YouTube refusing this machine (bot check or HTTP 429). */
export function isBlocked(stderr: string): boolean {
  return /confirm you.?re not a bot|HTTP Error 429/i.test(stderr);
}

const clock = (sec: number) => {
  const t = Math.round(sec * 10) / 10;
  const whole = Math.floor(t);
  const frac = Math.round((t - whole) * 10) / 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const ss = String(whole % 60).padStart(2, "0") + (frac ? String(frac).slice(1) : "");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/** The credits.json entry for a clip cut from `info` (CC BY 3.0, or PD with its basis in `notes`). */
export function clipCredit(info: VideoInfo, name: string, from: number, to: number, lic: { license: "CC BY" } | { license: "PD"; basis: string }): Credit {
  const notes = `YouTube ${clock(from)}–${clock(to)}; trimmed and scaled; channel watermark shown in the video`;
  return {
    file: `clips/${name}.mp4`,
    title: info.title,
    author: info.channel || info.uploader || "",
    license: lic.license,
    ...(lic.license === "CC BY" ? { licenseVersion: "3.0" } : {}),
    sourceUrl: `https://www.youtube.com/watch?v=${info.id}`,
    notes: lic.license === "PD" ? `${notes}; PD basis: ${lic.basis}` : notes,
  };
}
