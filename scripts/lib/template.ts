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

export type ShortTemplateOpts = {
  slug: string;
  theme: string;
  /** Scenes in the Short (1–3); each gets a "First, … / Second, … / Third, …" marker. */
  scenes?: number;
  /** Slug of the episode it comes from (npm run short); omitted for a standalone Short (npm run new --format short). */
  parent?: string;
  title?: string;
  carry?: Partial<EpisodeInput>;
  /** A visual for the placeholder, so the preview isn't blank (the parent's first clip). */
  visual?: string;
};

/**
 * Placeholder YouTube Short (vertical 9:16, format "short"): one hook beat, a title, 1–3 scenes and an outro + CTA,
 * with a matching script, so it previews right away. No on-screen sources or credits rolls: on Shorts they go in the
 * description (npm run credits).
 */
export const templateShort = ({ slug, theme, scenes = 1, parent, title, carry, visual }: ShortTemplateOpts) => {
  const ORD = ["First", "Second", "Third"];
  const n = Math.max(1, Math.min(3, scenes));
  const script = [
    "Here is the hook line.",
    "This is the short title.",
    ...ORD.slice(0, n).map((o, i) => (i === 0 ? `${o}, the one thing to know, and it costs one hundred million.` : `${o}, another point worth knowing.`)),
    "Full story on the channel. Subscribe for more.",
  ].join("\n\n");
  const visuals = visual ? [{ name: visual }] : [];
  const episode: EpisodeInput = {
    $schema: "../episode.schema.json",
    slug,
    ...(parent ? { parent } : {}),
    title: title ?? "Short title",
    theme: (carry?.theme ?? theme) as EpisodeInput["theme"],
    format: "short",
    aspect: "9:16",
    brand: { ...(carry?.brand ?? { name: "YOUR BRAND", tagline: "// SHORTS" }), dateLabel: carry?.brand?.dateLabel ?? dateLabelFromSlug(slug) },
    audio: {
      voiceover: "voiceover.mp3",
      ...(carry?.audio?.music ? { music: carry.audio.music } : {}),
      sfxPreset: carry?.audio?.sfxPreset ?? "intense",
      sfxOff: [],
      sfxExtra: [],
    },
    coldOpen: {
      beats: [{ cue: "Here is", stamp: "HOOK LINE", ...(visual ? { visual } : {}) }],
      title: { cue: "This is", kicker: carry?.brand?.name ?? "YOUR BRAND", big: "#1", small: "SHORT\nTITLE" },
    },
    segments: ORD.slice(0, n).map((o, i) => ({
      marker: o,
      region: "REGION",
      headline: i === 0 ? "The one thing to know" : `Point ${cap(numberWord(i + 1))} headline`,
      stats: i === 0 ? [{ value: "$100M", label: "PLACEHOLDER STAT", cue: "one hundred" }] : [],
      visuals,
    })),
    outro: {
      cue: "Full story",
      lines: [{ text: "FULL STORY", accent: "ON THE CHANNEL" }],
      cta: { cue: "Subscribe" },
      sourcesCard: false,
      creditsCard: false,
    },
    sources: carry?.sources ?? [],
  };
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
