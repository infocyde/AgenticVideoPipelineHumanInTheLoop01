// Which clips came from YouTube, and from which channel, for the on-screen source tag. Pure, no Node imports.
import type { Credit } from "../schema";
import { isYouTubeUrl } from "./youtube";

/** Clip file ("clips/x.mp4") -> channel (the credit's author), for credits with a YouTube sourceUrl under clips/. */
export const youtubeAttributions = (credits: Credit[]): Record<string, string> =>
  Object.fromEntries(credits.filter((c) => c.file.startsWith("clips/") && isYouTubeUrl(c.sourceUrl)).map((c) => [c.file, c.author]));

/** Files ("clips/x.mp4", "images/x.png") made by npm run infographic (infographics and explainers): their credit title says so. */
export const infographicFiles = (credits: Credit[]): Set<string> => new Set(credits.filter((c) => c.title.startsWith("Infographic:")).map((c) => c.file));
