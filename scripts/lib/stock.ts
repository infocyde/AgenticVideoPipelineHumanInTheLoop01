// Free stock sites for music videos (npm run stock): API response parsing, file choice and the STOCK credit. Pure.
// Pixabay has a free API key; Pexels' API works with a key (new keys were paused on 2026-10-23); Coverr and Pexels
// without a key are imported from a file the user downloaded in the browser (both sites ban scrapers and bots).
import { type Credit, STOCK_LICENSE } from "../../src/kit/schema.ts";

export type Site = "pixabay" | "pexels" | "coverr";
export type Kind = "video" | "image";

export const SITES: Record<Site, { name: string; license: string; licenseUrl: string; keyEnv?: string }> = {
  pixabay: { name: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", keyEnv: "PIXABAY_API_KEY" },
  pexels: { name: "Pexels", license: "Pexels License", licenseUrl: "https://www.pexels.com/license/", keyEnv: "PEXELS_API_KEY" },
  coverr: { name: "Coverr", license: "Coverr License", licenseUrl: "https://coverr.co/license" },
};

export const isSite = (s: string): s is Site => s in SITES;

/** One search result, the same shape for every site. */
export type StockHit = {
  site: Site;
  id: string;
  kind: Kind;
  pageUrl: string;
  title: string;
  author: string;
  authorUrl?: string;
  duration?: number;
  width: number;
  height: number;
  fileUrl: string; // the file to download (≤ 1080p for video where the site offers it)
  tags: string[];
  ai: boolean; // the site or its tags mark it as AI-generated
};

/** Tags such as "ai generated", "ai-generated", "generative ai", "midjourney" mark AI uploads (Pixabay's API has no AI field). */
export const aiFromTags = (tags: string[]) => tags.some((t) => /\b(ai[\s-]?generated|generative[\s-]?ai|ai[\s-]?art|midjourney|stable[\s-]?diffusion|dall[\s-]?e|sora)\b/i.test(t) || /^ai$/i.test(t.trim()));

const splitTags = (s: unknown) =>
  String(s ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** "https://www.pexels.com/video/waves-crashing-on-rocks-1093662/" -> "Waves crashing on rocks". */
export const titleFromSlug = (url: string) => {
  const m = /\/(?:video|photo)\/([a-z0-9-]+?)-\d+\/?$/i.exec(url);
  if (!m) return "";
  const t = m[1].replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** The smallest file at least `target` wide, else the widest (keeps 4K downloads off the disk). */
export const pickFile = <T extends { width: number; height: number }>(files: T[], target = 1920): T | undefined => {
  const ok = files.filter((f) => f.width > 0 && f.height > 0);
  const big = ok.filter((f) => f.width >= target).sort((a, b) => a.width - b.width);
  return big[0] ?? ok.sort((a, b) => b.width - a.width)[0];
};

type PixabayVideo = { id: number; pageURL: string; tags?: string; duration?: number; user?: string; user_id?: number; videos?: Record<string, { url?: string; width?: number; height?: number }> };
type PixabayImage = { id: number; pageURL: string; tags?: string; user?: string; user_id?: number; largeImageURL?: string; fullHDURL?: string; imageWidth?: number; imageHeight?: number };

const pixabayUser = (h: { user?: string; user_id?: number }) => ({
  author: h.user || "Pixabay contributor",
  authorUrl: h.user && h.user_id ? `https://pixabay.com/users/${encodeURIComponent(h.user)}-${h.user_id}/` : undefined,
});

export const pixabayHits = (json: unknown, kind: Kind): StockHit[] => {
  const hits = ((json as { hits?: unknown[] })?.hits ?? []) as (PixabayVideo & PixabayImage)[];
  return hits.flatMap((h): StockHit[] => {
    const tags = splitTags(h.tags);
    const base = { site: "pixabay" as const, id: String(h.id), kind, pageUrl: h.pageURL, title: tags.slice(0, 4).join(", ") || `Pixabay ${kind} ${h.id}`, tags, ai: aiFromTags(tags), ...pixabayUser(h) };
    if (kind === "video") {
      const files = Object.values(h.videos ?? {})
        .filter((v) => v?.url)
        .map((v) => ({ url: v.url!, width: v.width ?? 0, height: v.height ?? 0 }));
      const f = pickFile(files);
      return f ? [{ ...base, duration: h.duration, width: f.width, height: f.height, fileUrl: f.url }] : [];
    }
    const url = h.fullHDURL || h.largeImageURL;
    if (!url) return [];
    // largeImageURL is scaled to 1280 px on its long side; fullHDURL (1920) needs full API access.
    const scale = h.fullHDURL ? 1920 : 1280;
    const w = h.imageWidth ?? 0;
    const hh = h.imageHeight ?? 0;
    const k = w && hh ? Math.min(1, scale / Math.max(w, hh)) : 1;
    return [{ ...base, width: Math.round(w * k), height: Math.round(hh * k), fileUrl: url }];
  });
};

type PexelsVideo = { id: number; url: string; duration?: number; user?: { name?: string; url?: string }; video_files?: { link?: string; width?: number; height?: number; file_type?: string; quality?: string }[] };
type PexelsPhoto = { id: number; url: string; alt?: string; width?: number; height?: number; photographer?: string; photographer_url?: string; src?: Record<string, string> };

export const pexelsHits = (json: unknown, kind: Kind): StockHit[] => {
  const j = json as { videos?: PexelsVideo[]; photos?: PexelsPhoto[] } & PexelsVideo & PexelsPhoto;
  // A search returns a list; "get by id" returns one object.
  const list = kind === "video" ? (j.videos ?? (j.video_files ? [j] : [])) : (j.photos ?? (j.src ? [j] : []));
  return (list as (PexelsVideo & PexelsPhoto)[]).flatMap((h): StockHit[] => {
    const title = (kind === "image" && h.alt) || titleFromSlug(h.url) || `Pexels ${kind} ${h.id}`;
    const common = { site: "pexels" as const, id: String(h.id), kind, pageUrl: h.url, title, tags: [], ai: false };
    if (kind === "video") {
      const files = (h.video_files ?? [])
        .filter((f) => f.link && f.file_type === "video/mp4")
        .map((f) => ({ url: f.link!, width: f.width ?? 0, height: f.height ?? 0 }));
      const f = pickFile(files);
      if (!f) return [];
      return [{ ...common, author: h.user?.name || "Pexels contributor", authorUrl: h.user?.url, duration: h.duration, width: f.width, height: f.height, fileUrl: f.url }];
    }
    const url = h.src?.large2x || h.src?.original;
    if (!url) return [];
    return [{ ...common, author: h.photographer || "Pexels contributor", authorUrl: h.photographer_url, width: h.width ?? 0, height: h.height ?? 0, fileUrl: url }];
  });
};

/** API request for a search or a single item. Pexels takes the key in a header, Pixabay in the query. */
export const apiRequest = (site: "pixabay" | "pexels", kind: Kind, key: string, q: { query?: string; id?: string; perPage?: number }): { url: string; headers: Record<string, string> } => {
  const n = String(Math.min(80, Math.max(3, q.perPage ?? 12)));
  if (site === "pixabay") {
    const u = new URL(kind === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/");
    u.searchParams.set("key", key);
    if (q.id) u.searchParams.set("id", q.id);
    else {
      u.searchParams.set("q", (q.query ?? "").slice(0, 100));
      u.searchParams.set("per_page", n);
      u.searchParams.set("safesearch", "true");
      if (kind === "image") u.searchParams.set("orientation", "horizontal");
    }
    return { url: u.toString(), headers: {} };
  }
  const base = "https://api.pexels.com/v1";
  const u = new URL(q.id ? (kind === "video" ? `${base}/videos/videos/${q.id}` : `${base}/photos/${q.id}`) : kind === "video" ? `${base}/videos/search` : `${base}/search`);
  if (!q.id) {
    u.searchParams.set("query", q.query ?? "");
    u.searchParams.set("per_page", n);
    u.searchParams.set("orientation", "landscape");
  }
  return { url: u.toString(), headers: { Authorization: key } };
};

/** Never print an API key: drop it from a URL before showing or saving it. */
export const redactKey = (url: string) => url.replace(/([?&]key=)[^&]+/, "$1***");

/** The STOCK credit. `range` is the in/out used from a video, for the notes. */
export const stockCredit = (hit: Omit<StockHit, "fileUrl" | "width" | "height" | "tags"> & { fileUrl?: string }, file: string, checked: string, range?: [number, number]): Credit => {
  const s = SITES[hit.site];
  const used = range ? `${range[0].toFixed(1)}–${range[1].toFixed(1)} s` : "";
  return {
    file,
    title: hit.title,
    author: hit.author,
    license: STOCK_LICENSE,
    sourceUrl: hit.pageUrl,
    ...(hit.fileUrl && !/[?&]key=/.test(hit.fileUrl) ? { originalUrl: hit.fileUrl } : {}),
    notes: [`${s.name} ${hit.kind} ${hit.id}`, hit.authorUrl ? `by ${hit.author} (${hit.authorUrl})` : `by ${hit.author}`, used && `used ${used}`, hit.ai ? "AI-generated per the site/tags" : ""]
      .filter(Boolean)
      .join("; "),
    stock: { site: s.name, id: hit.id, license: s.license, licenseUrl: s.licenseUrl, ai: hit.ai, checked },
  };
};
