// Which clips came from YouTube, and from which channel, for the on-screen source tag. Pure, no Node imports.
import type { Credit } from "../schema";
import { isYouTubeUrl } from "./youtube";

/** Clip file ("clips/x.mp4") -> channel (the credit's author), for credits with a YouTube sourceUrl under clips/. */
export const youtubeAttributions = (credits: Credit[]): Record<string, string> =>
  Object.fromEntries(credits.filter((c) => c.file.startsWith("clips/") && isYouTubeUrl(c.sourceUrl)).map((c) => [c.file, c.author]));
