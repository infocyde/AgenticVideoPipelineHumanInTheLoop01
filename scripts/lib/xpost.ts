// Posts on X as sources (npm run xpost): URL parsing, X's public embed data (no login), the sources line and the credit.
import { type Credit, XPOST_LICENSE } from "../../src/kit/schema.ts";

/** True for any x.com / twitter.com address. */
export const isXUrl = (url: string) => {
  try {
    return /(^|\.)(x|twitter)\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

/** The post id in an x.com / twitter.com status URL (or a bare id); undefined for anything else (a profile, a list). */
export const postId = (s: string): string | undefined => {
  const t = s.trim();
  if (/^\d{5,25}$/.test(t)) return t;
  if (!isXUrl(t)) return undefined;
  return new URL(t).pathname.match(/^\/(?:[A-Za-z0-9_]+|i(?:\/web)?)\/status(?:es)?\/(\d+)/)?.[1];
};

/** The token X's own embed script sends with a syndication request. */
export const syndicationToken = (id: string) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");

export const syndicationUrl = (id: string) => `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`;

/** X's embed page: the post as its official widget draws it, viewable without a login. */
export const embedUrl = (id: string, light = false) => `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=${light ? "light" : "dark"}&dnt=true&lang=en`;

export type Post = {
  id: string;
  url: string;
  handle: string;
  name: string;
  created: string;
  text: string;
  badge?: string;
  media: string[]; // "photo", "video", "animated_gif"
};

type Syndicated = {
  __typename?: string;
  tweet?: Syndicated; // TweetWithVisibilityResults wraps the post
  id_str?: string;
  text?: string;
  display_text_range?: [number, number];
  created_at?: string;
  entities?: { urls?: { url: string; expanded_url: string }[] };
  note_tweet?: { note_tweet_results?: { result?: { text?: string } } };
  mediaDetails?: { type?: string }[];
  user?: {
    name?: string;
    screen_name?: string;
    is_blue_verified?: boolean;
    verified_type?: string;
    highlighted_label?: { description?: string };
  };
};

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/** Read a syndication response into a Post; throws for deleted, protected or withheld posts. */
export const parsePost = (raw: unknown): Post => {
  let d = raw as Syndicated | null;
  if (d?.__typename === "TweetWithVisibilityResults" && d.tweet) d = d.tweet;
  if (!d || d.__typename !== "Tweet" || !d.id_str || !d.user?.screen_name) {
    throw new Error(`X returned no post (${d?.__typename ?? "empty response"}): it may be deleted, protected or age-restricted`);
  }
  // The full text of a long post lives in note_tweet; otherwise cut the trailing media link off with display_text_range.
  let text = d.note_tweet?.note_tweet_results?.result?.text ?? d.text ?? "";
  if (!d.note_tweet && d.display_text_range) text = Array.from(text).slice(d.display_text_range[0], d.display_text_range[1]).join("");
  for (const u of d.entities?.urls ?? []) text = text.split(u.url).join(u.expanded_url);
  const u = d.user;
  const badge = [
    u.verified_type ? `verified (${u.verified_type})` : u.is_blue_verified ? "verified" : "",
    u.highlighted_label?.description ? `affiliated with ${u.highlighted_label.description}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    id: d.id_str,
    url: `https://x.com/${u.screen_name}/status/${d.id_str}`,
    handle: u.screen_name!,
    name: u.name ?? u.screen_name!,
    created: d.created_at ? new Date(d.created_at).toISOString() : "",
    text: decode(text).trim(),
    ...(badge ? { badge } : {}),
    media: (d.mediaDetails ?? []).map((m) => m.type ?? "media"),
  };
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The post as an entry for episode.json `sources`: `@handle on X: "first words…" (Oct 28, 2026)`. */
export const sourceEntry = (post: Post) => {
  const words = post.text.replace(/https?:\/\/\S+/g, "").split(/\s+/).filter(Boolean);
  const quote = words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "");
  return { title: `@${post.handle} on X: "${quote}"${post.created ? ` (${day(post.created)})` : ""}`, url: post.url };
};

/** The credits.json entry for an on-screen screenshot of the post. */
export const xpostCredit = (post: Post, file: string, basis: string, captured: string): Credit => ({
  file,
  title: `Post on X, ${post.created ? day(post.created) : "undated"}`,
  author: `${post.name} (@${post.handle})`,
  license: XPOST_LICENSE,
  sourceUrl: post.url,
  notes: `Screenshot of X's embed of the post, captured ${captured}. Basis: ${basis}`,
  xpost: {
    id: post.id,
    handle: post.handle,
    name: post.name,
    created: post.created,
    text: post.text,
    ...(post.badge ? { badge: post.badge } : {}),
    basis,
    captured,
  },
});
