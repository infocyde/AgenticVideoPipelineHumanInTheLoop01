// A song's lyric sheet (episodes/<slug>/lyrics.txt) for music videos. Pure.
// Lines in [brackets] are tags (sections like [Chorus], production notes like [power ballad]): never sung or shown.
// Every other line is one subtitle line; a blank line ends a stanza. Words in (parentheses) are sung echoes.

export type LyricLine = { text: string; words: string[]; stanza: number; section: string | null };
/** `sections[i].line` is the index of the first line after the tag (lines.length when nothing follows it). */
export type Lyrics = { lines: LyricLine[]; sections: { name: string; line: number }[] };

const TAG = /^\[([^\]]*)\]$/;

export const parseLyrics = (text: string): Lyrics => {
  const lines: LyricLine[] = [];
  const sections: Lyrics["sections"] = [];
  let stanza = 0;
  let section: string | null = null;
  let gap = false;
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    const tag = t.match(TAG);
    if (tag) {
      section = tag[1].trim();
      sections.push({ name: section, line: lines.length });
      gap = true;
      continue;
    }
    if (!t) {
      gap = true;
      continue;
    }
    if (gap && lines.length) stanza++;
    gap = false;
    lines.push({ text: t, words: t.split(/\s+/), stanza, section });
  }
  return { lines, sections };
};

/** Every sung word in order, with the index of its line. */
export const lyricWords = (l: Lyrics): { word: string; line: number }[] =>
  l.lines.flatMap((line, i) => line.words.map((word) => ({ word, line: i })));
