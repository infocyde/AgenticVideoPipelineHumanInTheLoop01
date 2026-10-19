// The placeholder episode `npm run new` writes: a complete, valid episode with a matching script,
// so Studio previews immediately. The producer replaces every field and line.
import type { EpisodeInput } from "../../src/kit/schema.ts";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const numberWord = (n: number) => ONES[n] ?? String(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Spread-out placeholder locations so the maps look like maps before real data goes in.
const PLACES: [number, number, string][] = [
  [-77.0, 38.9, "WASHINGTON"],
  [2.35, 48.86, "PARIS"],
  [116.4, 39.9, "BEIJING"],
  [37.6, 55.75, "MOSCOW"],
  [-47.9, -15.8, "BRASÍLIA"],
  [77.2, 28.6, "NEW DELHI"],
  [36.8, -1.3, "NAIROBI"],
  [139.7, 35.7, "TOKYO"],
  [149.1, -35.3, "CANBERRA"],
  [-99.1, 19.4, "MEXICO CITY"],
  [31.2, 30.0, "CAIRO"],
  [-0.13, 51.5, "LONDON"],
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const dateLabelFromSlug = (slug: string) => {
  const m = slug.match(/^(\d{4})-(\d{2})-\d{2}/);
  return m ? `${MONTHS[Number(m[2]) - 1] ?? "MONTH"} ${m[1]}` : "MONTH YEAR";
};

export type TemplateOpts = { slug: string; format: "countdown" | "list"; count: number; theme: string; carry?: Partial<EpisodeInput> };

export const templateEpisode = ({ slug, format, count, theme, carry }: TemplateOpts) => {
  const order = Array.from({ length: count }, (_, i) => (format === "countdown" ? count - i : i + 1));
  const countWord = numberWord(count);

  const script = [
    `Placeholder hook line one. Placeholder hook line two. The pressure is building everywhere. These are the ${countWord} stories that defined this week.`,
    ...order.map(
      (n) =>
        `Number ${numberWord(n)}. Placeholder story ${numberWord(n)} goes here. Replace every line with the real script, written from the article.`,
    ),
    "Any one of these could boil over. That's the week. Subscribe so you don't miss the next one.",
  ].join("\n\n");

  const episode: EpisodeInput = {
    $schema: "../episode.schema.json",
    slug,
    title: `The week in ${count} ${format === "countdown" ? "flashpoints" : "stories"}`,
    theme: (carry?.theme ?? theme) as EpisodeInput["theme"],
    format,
    aspect: "16:9",
    brand: { ...(carry?.brand ?? { name: "YOUR BRAND", tagline: "// WEEKLY" }), dateLabel: dateLabelFromSlug(slug) },
    audio: carry?.audio ?? { voiceover: "voiceover.mp3", music: { file: "bed", level: 0.22, duck: true }, sfxPreset: "intense" },
    coldOpen: {
      beats: [
        { cue: "Placeholder hook line one", stamp: "HOOK ONE", sub: "REPLACE WITH A STAMP" },
        { cue: "Placeholder hook line two", stamp: "HOOK TWO", sub: "ONE BEAT PER HOOK LINE" },
        { cue: "The pressure", map: "all-pins", stamp: "EVERY", accent: "FRONT" },
      ],
      title: {
        cue: "These are",
        bigCue: `${countWord} stories`,
        kicker: "THE WEEK IN",
        big: String(count),
        small: format === "countdown" ? "FLASH\nPOINTS" : "BIG\nSTORIES",
      },
    },
    segments: order.map((n, i) => {
      const [lon, lat, label] = PLACES[i % PLACES.length];
      return {
        marker: `Number ${numberWord(n)}`,
        region: `REGION ${numberWord(n).toUpperCase()}`,
        headline: `Placeholder headline ${cap(numberWord(n))}`,
        stats: [{ value: "00%", label: "Replace with a stat from the article", cue: "Replace every" }],
        visuals: [],
        map: { bbox: [[lon - 12, lat - 8], [lon + 12, lat + 8]] as [[number, number], [number, number]], highlight: [], pins: [{ lon, lat, label }] },
      };
    }),
    outro: {
      cue: "Any one",
      lines: [
        { text: "ANY ONE COULD", accent: "BOIL OVER" },
        { text: "THAT'S THE", accent: "WEEK", cue: "That's the week" },
      ],
      cta: { cue: "Subscribe" },
      sourcesCard: { seconds: 7 },
      creditsCard: { seconds: 8 },
    },
    sources: [],
  };
  const last = episode.segments[episode.segments.length - 1];
  if (format === "countdown" && last.kind !== "text") last.emphasis = "top";
  return { episode, script };
};

export const ARTICLE_PLACEHOLDER = `<!-- Paste the source article here (or save the file over this one).
     Everything said or shown in the video must be supported by this text. -->
`;

export const NOTES_TEMPLATE = (slug: string) => `# ${slug}: producer notes

- Format / count / date label confirmed with user:
- Claims flagged as beyond the article:
- Footage substitutions (shown with a \`note\` tag):
- Things to verify by ear:
`;
