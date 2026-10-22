// The YouTube description for a music video (npm run credits): title, summary, song credit, lyrics, sources, credits.
import { licenseLabel, type UsedCredits } from "../../src/kit/lib/credits.ts";
import type { Lyrics } from "../../src/kit/lib/lyrics.ts";
import type { Credit, MusicVideo } from "../../src/kit/schema.ts";

/** The lyrics as shown in the description: one line per line, a blank line between stanzas, no [tags]. */
const lyricsText = (lyrics: Lyrics) =>
  lyrics.lines.map((l, i) => (i > 0 && l.stanza !== lyrics.lines[i - 1].stanza ? `\n${l.text}` : l.text)).join("\n");

export const musicVideoDescription = (ep: MusicVideo, lyrics: Lyrics, used: UsedCredits): string => {
  const song = ep.song.subtitle ? `${ep.song.title} (${ep.song.subtitle})` : ep.song.title;
  const line = (c: Credit) => `- ${c.author}, "${c.title}", ${licenseLabel(c)}${c.sourceUrl ? `, ${c.sourceUrl}` : ""}`;
  const shotNotes = new Map(ep.shots.filter((s) => s.note).map((s) => [s.visual, s.note!]));
  const visualLines = used.visuals.map((c) => {
    const note = shotNotes.get(c.file.replace(/^.*\//, "").replace(/\.[^.]+$/, ""));
    return line(c) + (note ? ` (shown as: ${note})` : "");
  });
  const aiLines = used.generated.map((c) => `- ${c.file.replace(/^.*\//, "")}: ${c.author.replace(/^Generated/, "generated")}; not a photograph`);
  return `# ${ep.title}: YouTube description

Paste everything below the line.${ep.summary ? "" : ' Fill in the summary first (better: set "summary" in episode.json and run npm run credits again, so it survives).'}

---

${song}

${ep.summary ?? "<1–2 sentence summary of the video.>"}

Music: ${song} by ${ep.song.artist}

LYRICS
${lyricsText(lyrics)}
${ep.sources.length ? `\nSOURCES\n${ep.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}\n` : ""}
CREDITS
Footage & images:
${visualLines.join("\n") || "- (none)"}

${aiLines.length ? `AI-generated illustrations (labelled on screen):\n${aiLines.join("\n")}\n\n` : ""}Music: ${song} by ${ep.song.artist} (original work)
Public-domain and CC0 items are listed for transparency.
`;
};
