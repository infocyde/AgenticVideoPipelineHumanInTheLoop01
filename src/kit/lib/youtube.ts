// YouTube helpers shared by the check and the render: pure, no Node imports.

export const TAG_PREFIX = "VIDEO · ";
export const TAG_SUFFIX = " / YouTube";

/** True for youtube.com (and its subdomains) and youtu.be links. */
export function isYouTubeUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

/** On-screen tag for a YouTube clip: "VIDEO · <channel> / YouTube", the channel cut to `max` characters. */
export function youtubeTagText(channel: string, max = 40): string {
  const chars = [...channel.trim()]; // code points, so an emoji is never split
  const name = chars.length > max ? chars.slice(0, max - 1).join("") + "…" : chars.join("");
  return `${TAG_PREFIX}${name}${TAG_SUFFIX}`;
}
