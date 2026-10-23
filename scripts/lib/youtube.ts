// YouTube research parsing (pure, no network or fs): yt-dlp json3 captions, search results,
// license and clip-range checks. Used by scripts/youtube.ts. The render-side URL/tag helpers
// live in src/kit/lib/youtube.ts.

export type TranscriptLine = { start: number; text: string };

type CaptionTrack = { ext?: string; url?: string; name?: string };

/** The yt-dlp `-J` fields this kit reads. */
export type VideoInfo = {
  id: string;
  title: string;
  channel?: string;
  channel_url?: string;
  upload_date?: string;
  duration?: number;
  description?: string;
  license?: string;
  view_count?: number;
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

/** Parse yt-dlp json3 captions into timed lines: no empty events, no `[Music]` cues, no rolling duplicates. */
export function parseJson3(raw: unknown): TranscriptLine[] {
  const events = (raw as { events?: unknown })?.events;
  if (!Array.isArray(events)) return [];
  const out: TranscriptLine[] = [];
  for (const e of events) {
    if (!e || !Array.isArray(e.segs)) continue;
    const text = e.segs
      .map((s: { utf8?: string }) => s?.utf8 ?? "")
      .join("")
      .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const start = Math.round(((Number(e.tStartMs) || 0) / 1000) * 1000) / 1000;
    const prev = out[out.length - 1];
    if (!prev) {
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

/** Best json3 caption track: manual English, then auto English, then an auto translation into English. */
export function pickCaptions(info: VideoInfo): { lang: string; kind: "manual" | "auto"; url: string } | null {
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
  const a = find(info.automatic_captions, isEn, ["en", "en-orig"]);
  if (a) return { ...a, kind: "auto" };
  const t = find(info.automatic_captions, (l) => l.endsWith("-en"), []);
  return t ? { ...t, kind: "auto" } : null;
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
