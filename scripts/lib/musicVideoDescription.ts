// The YouTube description for a music video (npm run credits): title, summary, song credit, lyrics, sources, credits.
// YouTube cuts a description at 5,000 characters, and a music video can use a hundred files, so the description credits
// the Creative Commons works (whose licenses ask for attribution) by author, title and license, sums up the public-domain
// ones in a line, and points to the full list with links (CREDITS.md, for a pinned comment, which allows 10,000).
import { licenseLabel, type UsedCredits } from "../../src/kit/lib/credits.ts";
import type { Lyrics } from "../../src/kit/lib/lyrics.ts";
import type { Credit, MusicVideo } from "../../src/kit/schema.ts";

/** YouTube's limit for a video description. */
export const DESCRIPTION_MAX = 5000;

/** The lyrics as shown in the description: one line per line, a blank line between stanzas, no [tags]. */
const lyricsText = (lyrics: Lyrics) =>
  lyrics.lines.map((l, i) => (i > 0 && l.stanza !== lyrics.lines[i - 1].stanza ? `\n${l.text}` : l.text)).join("\n");

const songName = (ep: MusicVideo) => (ep.song.subtitle ? `${ep.song.title} (${ep.song.subtitle})` : ep.song.title);
const needsAttribution = (c: Credit) => c.license === "CC BY" || c.license === "CC BY-SA";
const fullLine = (c: Credit) => `- ${c.author}, "${c.title}", ${licenseLabel(c)}${c.sourceUrl ? `, ${c.sourceUrl}` : ""}`;

const aiLines = (used: UsedCredits) => used.generated.map((c) => `- ${c.file.replace(/^.*\//, "")}: ${c.author.replace(/^Generated/, "generated")}; not a photograph`);

export const musicVideoDescription = (ep: MusicVideo, lyrics: Lyrics, used: UsedCredits): string => {
  const song = songName(ep);
  const cc = used.visuals.filter(needsAttribution);
  const free = used.visuals.filter((c) => !needsAttribution(c));
  const ai = aiLines(used);
  const build = (ccLine: (c: Credit) => string) => `# ${ep.title}: YouTube description

Paste everything below the line. Paste CREDITS.md as a pinned comment.${ep.summary ? "" : ' Fill in the summary first (better: set "summary" in episode.json and run npm run credits again, so it survives).'}

---

${song}

${ep.summary ?? "<1–2 sentence summary of the video.>"}

Music: ${song} by ${ep.song.artist}

LYRICS
${lyricsText(lyrics)}
${ep.sources.length ? `\nSOURCES\n${ep.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}\n` : ""}
CREDITS
${cc.length ? `Footage & images under Creative Commons:\n${cc.map(ccLine).join("\n")}\n` : ""}${free.length ? `Public domain${free.some((c) => c.license === "CC0") ? " and CC0" : ""}: ${free.length} more clips and images, mostly U.S. government and pre-1931 archive works.\n` : ""}${ai.length ? `AI-generated illustrations (labelled on screen):\n${ai.join("\n")}\n` : ""}Full credits with links are in the pinned comment.
Music: ${song} by ${ep.song.artist} (original work)
`;
  const ccFull = (c: Credit) => `- ${c.author}, "${c.title}", ${licenseLabel(c)}`;
  const ccShort = (c: Credit) => `- ${c.author}, ${licenseLabel(c)}`;
  const body = (md: string) => md.slice(md.indexOf("---") + 3);
  const md = build(ccFull);
  return body(md).length <= DESCRIPTION_MAX ? md : build(ccShort);
};

/** Every credit with its link, for CREDITS.md (a pinned comment). */
export const musicVideoFullCredits = (ep: MusicVideo, used: UsedCredits): string => {
  const ai = aiLines(used);
  return `CREDITS: ${songName(ep)}

Music: ${songName(ep)} by ${ep.song.artist} (original work)

Footage & images:
${used.visuals.map(fullLine).join("\n") || "- (none)"}
${ai.length ? `\nAI-generated illustrations (labelled on screen):\n${ai.join("\n")}\n` : ""}
Public-domain and CC0 items are listed for transparency.
`;
};
