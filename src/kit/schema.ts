// The episode.json schema: the single source of truth for what an episode can say.
// Components, `npm run check` and the generated JSON Schema (episodes/episode.schema.json) all derive from this.
import { z } from "zod";
import { THEME_IDS } from "./themes/ids";

/** Scene events the sfx presets hang sounds on (see lib/sfx.ts for what each one is). */
export const SFX_EVENTS = [
  "open", "beatCut", "stampBeat", "title", "coldOpenEnd", "segment", "section", "slam", "slamTop",
  "top", "stat", "visualCut", "mapExit", "outro", "outroLine", "cta",
] as const;

const cue = z
  .string()
  .min(1)
  .describe(
    "A short spoken phrase from voiceover.txt (case- and accent-insensitive; the last word may be a prefix, e.g. 'kiwi' matches 'kiwifruit'). Times are found by searching the aligned words forward.",
  );

const visualName = z
  .string()
  .regex(/^[a-z0-9_-]+$/i, "visual names are file basenames without extension, e.g. 'gulf_navy'")
  .describe("Basename of a file in public/episodes/<slug>/clips/ (preferred) or images/");

export const pinSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  label: z.string().describe("Short uppercase label, e.g. 'HORMUZ'"),
});

export const mapSchema = z.object({
  bbox: z
    .tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])])
    .describe("[[west, south], [east, north]] in degrees"),
  highlight: z.array(z.string()).default([]).describe("Country names as spelled in world-atlas 110m, e.g. 'United States of America'"),
  hostile: z.array(z.string()).optional().describe("Countries tinted with the hostile color"),
  pins: z.array(pinSchema).min(1),
});

export const statSchema = z.object({
  value: z.string().min(1).describe("Big number or keyword, e.g. '>90%', 'OCT 25'"),
  label: z.string().min(1).describe("Typed-out caption under the value"),
  cue,
});

export const visualSchema = z.object({
  name: visualName,
  cue: cue.optional().describe("Required for every visual after the first: the spoken phrase it cuts on"),
  note: z.string().optional().describe("On-screen tag for footage that isn't of the event, e.g. 'FILE FOOTAGE · LVIV, UKRAINE, 2022'"),
  grade: z
    .boolean()
    .optional()
    .describe("false shows this visual as it is, without the theme's filter and tint (for explainers and infographics already drawn in the theme). The side and bottom gradients still apply"),
});

export const segmentSchema = z.object({
  kind: z.literal("item").optional().describe("Omit for a numbered segment (or set 'item'); use 'text' for an unnumbered text section"),
  marker: cue.describe("Spoken phrase that starts the segment, e.g. 'Number ten'"),
  num: z.number().int().positive().optional().describe("Shown number; defaults to N..1 for countdown, 1..N for list"),
  region: z.string().min(1),
  headline: z.string().min(1).describe("6 words or fewer"),
  subhead: z.string().optional().describe("Optional second line under the headline, e.g. the product's name ('GeForce RTX 5090'); ≤ 32 chars. Shown by the frontier theme"),
  emphasis: z.literal("top").optional().describe("Alarm treatment, usually on #1"),
  emphasisLabel: z.string().optional().describe("Badge text for emphasis; defaults to the theme's (e.g. 'TOP THREAT')"),
  stats: z.array(statSchema).default([]).describe("Overlay themes show one at a time; split themes stack them into spec-sheet panels of 5"),
  visuals: z.array(visualSchema).default([]),
  map: mapSchema.optional(),
  captions: z
    .boolean()
    .optional()
    .describe("false hides the word-by-word captions for this segment, e.g. over an explainer whose own text they would cover"),
  side: z
    .enum(["left", "right"])
    .optional()
    .describe("Overlay layouts: which side the number/region/headline/stat block sits on (default 'left'). 'right' mirrors the side gradient, tucks the block into the top-right corner and moves the map card to the left"),
  exitAt: cue
    .optional()
    .describe("Overlay layouts and Shorts: at this spoken phrase the number/headline/stat block (the text panel, on a Short) leaves the screen and stays off (e.g. when a full-frame explainer or infographic comes up)"),
  card: z
    .enum(["tuck", "exit", "none"])
    .optional()
    .describe(
      "Overlay layouts: what the number/headline/stat block does once the map card leaves. 'tuck' (default) shrinks it into the top-left corner; 'exit' slides it off the left edge so the b-roll has the whole frame; 'none' never shows the region and headline (Shorts too). Split and spatial layouts ignore it",
    ),
  fade: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Shorts: strength of an optional paper wash over this segment's b-roll, 0 (none, the default) to 1"),
  overlay: z
    .enum(["top", "bottom", "none"])
    .optional()
    .describe("Shorts: where the region/headline/stat panel sits so it stays off the action: 'top' (default), 'bottom' (just above the captions) or 'none' (hidden)"),
});

export const textSectionSchema = z.object({
  kind: z.literal("text").describe("An unnumbered text section (intro, summary, recap) between or around the numbered segments"),
  marker: cue.describe("Spoken phrase that starts the section"),
  label: z.string().optional().describe("Small tag above the heading, e.g. 'INTRODUCTION' or 'THE BOTTOM LINE'"),
  heading: z.string().min(1).describe("8 words or fewer"),
  body: z.string().optional().describe("One short paragraph summing up what is said (≤ 200 characters); facts from the article only"),
  visuals: z.array(visualSchema).max(4).default([]).describe("1–4 clips or stills behind the text; every visual after the first needs a cue"),
  layout: z
    .enum(["window", "full"])
    .optional()
    .describe("frontier: 'full' shows the visual large across the frame (a summary board, a big chart) with just the label; default 'window'"),
  captions: z.boolean().optional().describe("false hides the word-by-word captions for this section"),
  textAt: cue
    .optional()
    .describe("Overlay layouts: the label and heading stay off screen until this spoken phrase, then come in (e.g. after an explainer that needs the whole frame). The side gradient stays light until then"),
  tuckAt: cue
    .optional()
    .describe("Overlay layouts: at this spoken phrase the label and heading shrink into the top-left corner, like a numbered segment's text once its map card leaves"),
});

/** One entry of `segments`: a numbered item, or a text section (`kind: "text"`). */
export const sceneSchema = z.discriminatedUnion("kind", [segmentSchema, textSectionSchema]);

export const beatSchema = z.object({
  cue,
  visual: visualName.optional(),
  note: z.string().optional(),
  stamp: z.string().min(1).describe("Big stamped text, or the headline over the map for a map beat"),
  accent: z.string().optional().describe("Map beats only: trailing word(s) drawn in the accent color, e.g. stamp 'EVERY' + accent 'FRONT'"),
  sub: z.string().optional(),
  fade: z.number().min(0).max(1).optional().describe("Shorts: strength of an optional paper wash over this beat's b-roll, 0 (none, the default) to 1"),
  stampAt: z.enum(["top", "center", "bottom"]).optional().describe("Shorts: where the hook stamp sits, to keep it off the action (default 'center')"),
  map: z.literal("all-pins").optional().describe("Show the world map with every segment's first pin instead of a visual"),
});

export const outroLineSchema = z.object({
  text: z.string().min(1),
  accent: z.string().optional().describe("Trailing word(s) in the accent color"),
  cue: cue.optional().describe("When this line slams in; the first line defaults to the outro start"),
});

/** A closing card that every episode gets unless it opts out with `false`. */
const closingCard = (min: number, defaultSeconds: number) =>
  z
    .union([z.object({ seconds: z.number().min(min).max(20).default(defaultSeconds) }), z.literal(false)])
    .default({ seconds: defaultSeconds });

export const episodeSchema = z.object({
  $schema: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1).describe("e.g. 'The week in 10 flashpoints'"),
  summary: z
    .string()
    .min(1)
    .optional()
    .describe("1–2 sentences for the top of the YouTube description (npm run credits): what the video covers, facts from the article and fact-check only"),
  theme: z.enum(THEME_IDS).default("threat-brief").describe("Theme id from src/kit/themes/"),
  format: z
    .enum(["countdown", "list", "short"])
    .default("countdown")
    .describe("'short': a YouTube Short (vertical, aspect 9:16) made from a parent episode by `npm run short`"),
  aspect: z.enum(["16:9", "9:16"]).default("16:9").describe("16:9 = 1920×1080 (episodes); 9:16 = 1080×1920 (Shorts)"),
  parent: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional()
    .describe("Shorts only: slug of the episode this Short comes from (its facts, theme, media and credits)"),
  brand: z.object({
    name: z.string().min(1).describe("Top-bar brand, e.g. 'GLOBAL THREAT BRIEF'"),
    tagline: z.string().optional().describe("e.g. '// WEEKLY'"),
    dateLabel: z.string().min(1).describe("e.g. 'OCT 2026' or 'WEEK OF OCT 11–17, 2026'"),
  }),
  audio: z.object({
    voiceover: z.string().default("voiceover.mp3").describe("File in public/episodes/<slug>/"),
    music: z
      .object({
        file: z.string().describe("Music name from the library or episode (e.g. 'bed'), or a path under public/"),
        level: z.number().min(0).max(1).default(0.22),
        duck: z.boolean().default(true).describe("Dip under speech, swell in gaps and on slams"),
      })
      .optional(),
    sfxPreset: z.enum(["intense", "calm", "tech", "none"]).default("intense").describe("Sound-effect preset (lib/sfx.ts); tech suits the frontier theme"),
    sfxOff: z
      .array(z.enum(SFX_EVENTS))
      .default([])
      .describe("Preset events to silence for this episode only, e.g. [\"stampBeat\"] drops the alert under the cold-open stamps"),
    sfxExtra: z
      .array(
        z.object({
          sfx: z.string().min(1).describe("Sound name from the library or the episode's sfx/ folder, e.g. 'glitch'"),
          cue: cue.describe("Spoken phrase the sound lands on (searched through the whole script)"),
          offset: z.number().default(0).describe("Seconds relative to the cue's first word"),
          volume: z.number().min(0).max(1).default(0.5),
        }),
      )
      .default([])
      .describe("One-off sounds on top of the preset, each placed on a spoken cue"),
  }),
  coldOpen: z.object({
    beats: z.array(beatSchema).min(1),
    title: z.object({
      cue,
      bigCue: cue.optional().describe("Phrase the big number slams on, e.g. 'ten stories'; default 0.3s after the title cue"),
      kicker: z.string().describe("e.g. 'THE WEEK IN'"),
      big: z.string().describe("e.g. '10'"),
      small: z.string().describe("e.g. 'FLASH\\nPOINTS' (\\n breaks the line)"),
    }),
  }),
  segments: z
    .array(sceneSchema)
    .min(1)
    .describe("Scenes in spoken order: numbered segments, plus optional text sections (`kind: \"text\"`) anywhere among them"),
  outro: z.object({
    cue,
    lines: z.array(outroLineSchema).min(1),
    cta: z.object({ label: z.string().optional(), cue }).optional(),
    sourcesCard: closingCard(3, 7).describe(
      "On by default: after the voiceover, list the episode's `sources` on screen for this many seconds. More than 8 sources are split evenly over several cards, each shown this long. `false` turns it off.",
    ),
    creditsCard: closingCard(4, 8).describe(
      "On by default: after the sources card, roll the media credits (footage, images, music, sound, map data) from credits.json. `false` turns it off.",
    ),
    endScreen: z
      .object({ seconds: z.number().min(5).max(20) })
      .optional()
      .describe("Hold a branded end card this long after the voiceover, with empty slots for YouTube end-screen elements"),
  }),
  ticker: z
    .object({
      label: z.string().optional().describe("Defaults to the theme's, e.g. 'THIS WEEK'"),
      items: z.array(z.string()).optional().describe("Defaults to 'REGION — HEADLINE' per segment"),
    })
    .optional(),
  thumbnail: z
    .object({
      big: z.string().optional().describe("Defaults to coldOpen.title.big"),
      title: z.string().optional().describe("Defaults to coldOpen.title.small"),
      visual: visualName.optional().describe("Background image or clip frame"),
      frame: z.number().optional().describe("Seconds into the clip to grab when `visual` is a clip"),
    })
    .optional(),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
});

// ---- music videos (format "music-video"): a song cut to licensed shots, placed by sung words or beats ----

export const shotSchema = z
  .object({
    visual: visualName,
    cue: cue.optional().describe("A sung phrase from lyrics.txt the shot cuts on, searched in order after the previous shot (choruses repeat, so it finds the next one)"),
    beat: z.number().int().nonnegative().optional().describe("Index into timing.json `beats` (npm run lyrics prints them per instrumental) the shot cuts on; for passages with no words"),
    in: z.number().nonnegative().optional().describe("Seconds into the clip to start from (clips only)"),
    transition: z.enum(["cut", "flash", "glitch"]).default("cut").describe("How the shot arrives: a hard cut (default), a white flash, or a glitch"),
    subtitles: z.boolean().optional().describe("false hides the lyric subtitles during this shot, e.g. over an explainer's own text"),
    note: z.string().optional().describe("On-screen tag; required ('AI-GENERATED ILLUSTRATION') for AI stills, otherwise leave it out"),
  })
  .refine((s) => s.cue === undefined || s.beat === undefined, { message: "a shot cuts on a cue or a beat, not both", path: ["beat"] });

export const musicVideoSchema = z.object({
  $schema: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  format: z.literal("music-video").describe("A music video: the song is the only audio, the lyric sheet stands in for the script"),
  title: z.string().min(1).describe("Video title, e.g. 'Empires (Plata o Plomo Power Mix)'"),
  summary: z.string().min(1).optional().describe("1–2 sentences for the top of the YouTube description (npm run credits)"),
  theme: z.enum(THEME_IDS).default("threat-brief").describe("Fonts and colors for subtitles, title card and credits"),
  song: z.object({
    file: z.string().default("song.wav").describe("The song in public/episodes/<slug>/"),
    title: z.string().min(1),
    subtitle: z.string().optional().describe("e.g. the mix name, 'Plata o Plomo Power Mix'"),
    artist: z.string().min(1),
  }),
  subtitles: z.boolean().default(true).describe("Show the lyrics one line at a time (asked per video)"),
  titleCard: z
    .union([z.object({ seconds: z.number().min(1).max(10).default(4) }), z.literal(false)])
    .default({ seconds: 4 })
    .describe("Song title and artist over the opening shot; false = none"),
  shots: z.array(shotSchema).min(1).describe("Shots in order; every shot after the first needs a `cue` or a `beat`"),
  credits: z
    .object({
      seconds: z.number().min(4).max(20).default(8).describe("Seconds per page of the credits roll"),
      cue: cue.optional().describe("Start the roll on this sung phrase (after the last shot) instead of after the song"),
      beat: z.number().int().nonnegative().optional().describe("Start the roll on this beat instead of after the song"),
    })
    .default({ seconds: 8 }),
  thumbnail: z
    .object({
      visual: visualName.optional().describe("Background image or clip frame; defaults to the first shot"),
      frame: z.number().optional().describe("Seconds into the clip to grab when `visual` is a clip"),
    })
    .optional(),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]).describe("Sources for any facts the video adds on screen (YouTube description only)"),
});

export type MusicVideoInput = z.input<typeof musicVideoSchema>;
export type MusicVideo = z.output<typeof musicVideoSchema>;
export type Shot = MusicVideo["shots"][number];

/** True for a raw episode.json that is a music video (checked before choosing which schema parses it). */
export const isMusicVideo = (raw: unknown): boolean =>
  typeof raw === "object" && raw !== null && (raw as { format?: unknown }).format === "music-video";

export type EpisodeInput = z.input<typeof episodeSchema>;
export type Episode = z.output<typeof episodeSchema>;
export type Scene = Episode["segments"][number];
export type Segment = z.output<typeof segmentSchema>;
export type TextSection = z.output<typeof textSectionSchema>;
export const isTextSection = (s: Scene): s is TextSection => s.kind === "text";
export type Stat = Segment["stats"][number];
export type SegmentVisual = Segment["visuals"][number];
export type MapFocus = z.output<typeof mapSchema>;
export type Pin = z.output<typeof pinSchema>;
export type Beat = Episode["coldOpen"]["beats"][number];
export type OutroLine = Episode["outro"]["lines"][number];

// ---- generated files (written by scripts, read by components) ----

export const timingSchema = z.object({
  duration: z.number().positive(),
  estimated: z.boolean().optional().describe("True when written by `align --estimate` from text only, without audio"),
  match: z.object({ matched: z.number(), total: z.number() }).optional(),
  words: z.array(
    z.object({
      word: z.string(),
      start: z.number(),
      end: z.number(),
      line: z.number().int().nonnegative().optional().describe("Music videos: index of the lyric line (subtitle) this word belongs to"),
    }),
  ),
  beats: z.array(z.number()).optional().describe("Music videos: beat times in seconds (npm run lyrics); shots cut on them by index"),
  tempo: z.number().optional(),
});
export type Timing = z.output<typeof timingSchema>;
export type Word = Timing["words"][number];

const media = z.object({
  file: z.string(),
  duration: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  attribution: z.string().optional().describe("Channel shown in the kit's YouTube source tag; written by npm run assets from credits.json"),
});
export const assetsSchema = z.object({
  voiceover: media.nullable().default(null),
  clips: z.record(z.string(), media).default({}),
  images: z.record(z.string(), media).default({}),
  sfx: z.record(z.string(), media).default({}),
  music: z.record(z.string(), media).default({}),
});
export type AssetManifest = z.output<typeof assetsSchema>;
export type MediaFile = z.output<typeof media>;

/** Licenses for sourced media. */
export const LICENSES = ["PD", "CC0", "CC BY", "CC BY-SA"] as const;
/** Images made by `npm run generate` and music beds made by `npm run compose`; only valid with a `generator` provenance record. */
export const AI_LICENSE = "AI-GENERATED";
/** Material the channel owner made or owns outright (e.g. their own music); no source URL needed. */
export const OWN_LICENSE = "OWN WORK";
/**
 * Official manufacturer press images (newsroom / press kit) of a product the video discusses, used for commentary.
 * Only accepted when config.yaml has licensing.press_images: true; author = the company, sourceUrl = the press page.
 */
export const PRESS_LICENSE = "PRESS";
/**
 * Free stock sites with their own licenses (Pexels, Pixabay, Coverr), fetched by `npm run stock`.
 * Only accepted in music videos, and only when config.yaml has licensing.stock_media: music-video; needs a `stock` record.
 */
export const STOCK_LICENSE = "STOCK";

export const stockSchema = z.object({
  site: z.string(), // "Pexels", "Pixabay", "Coverr"
  id: z.string(), // the site's id for the clip or photo
  license: z.string(), // the site's license name, e.g. "Pexels License"
  licenseUrl: z.string().url(),
  ai: z.boolean().default(false), // the site marks it as AI-generated
  checked: z.string(), // ISO date the license and page were read
});

export const generatorSchema = z.object({
  provider: z.string(), // "replicate" (npm run generate) or "local" (npm run compose)
  model: z.string(), // "black-forest-labs/flux-3-image", "stabilityai/stable-audio-3-medium"
  version: z.string().optional(),
  predictionId: z.string().optional(), // Replicate's id; local generations record their seed in `input`
  prompt: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
  created: z.string(),
});

export const creditSchema = z
  .object({
    file: z.string().describe("Path relative to the folder holding this credits.json, e.g. 'clips/drone.mp4' (episode) or 'sfx/impact.mp3' (library)"),
    title: z.string().min(1),
    author: z.string().min(1),
    license: z.enum([...LICENSES, AI_LICENSE, OWN_LICENSE, PRESS_LICENSE, STOCK_LICENSE]),
    licenseVersion: z.string().optional(),
    sourceUrl: z.string().url().optional().describe("Landing page of the source; required for every license except OWN WORK"),
    originalUrl: z.string().url().optional(),
    notes: z.string().optional(),
    generator: generatorSchema.optional().describe("Provenance for AI-GENERATED media (written by `npm run generate` and `npm run compose`)"),
    stock: stockSchema.optional().describe("Provenance for STOCK media (written by `npm run stock`)"),
  })
  .refine((c) => c.license !== AI_LICENSE || !!c.generator, { message: "AI-GENERATED entries need a `generator` record", path: ["generator"] })
  .refine((c) => c.license !== STOCK_LICENSE || !!c.stock, { message: "STOCK entries need a `stock` record (written by `npm run stock`)", path: ["stock"] })
  .refine((c) => c.license === OWN_LICENSE || !!c.sourceUrl, { message: "needs a sourceUrl (only OWN WORK entries may omit it)", path: ["sourceUrl"] });
export type Credit = z.output<typeof creditSchema>;
