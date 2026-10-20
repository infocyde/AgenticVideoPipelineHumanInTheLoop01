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
});

export const segmentSchema = z.object({
  kind: z.literal("item").optional().describe("Omit for a numbered segment (or set 'item'); use 'text' for an unnumbered text section"),
  marker: cue.describe("Spoken phrase that starts the segment, e.g. 'Number ten'"),
  num: z.number().int().positive().optional().describe("Shown number; defaults to N..1 for countdown, 1..N for list"),
  region: z.string().min(1),
  headline: z.string().min(1).describe("6 words or fewer"),
  emphasis: z.literal("top").optional().describe("Alarm treatment, usually on #1"),
  emphasisLabel: z.string().optional().describe("Badge text for emphasis; defaults to the theme's (e.g. 'TOP THREAT')"),
  stats: z.array(statSchema).default([]).describe("Overlay themes show one at a time; split themes stack them into spec-sheet panels of 5"),
  visuals: z.array(visualSchema).default([]),
  map: mapSchema.optional(),
});

export const textSectionSchema = z.object({
  kind: z.literal("text").describe("An unnumbered text section (intro, summary, recap) between or around the numbered segments"),
  marker: cue.describe("Spoken phrase that starts the section"),
  label: z.string().optional().describe("Small tag above the heading, e.g. 'INTRODUCTION' or 'THE BOTTOM LINE'"),
  heading: z.string().min(1).describe("8 words or fewer"),
  body: z.string().optional().describe("One short paragraph summing up what is said (≤ 200 characters); facts from the article only"),
  visuals: z.array(visualSchema).max(4).default([]).describe("1–4 clips or stills behind the text; every visual after the first needs a cue"),
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
    sfxPreset: z.enum(["intense", "calm", "none"]).default("intense"),
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
      "On by default: after the voiceover, list the episode's `sources` on screen for this many seconds. `false` turns it off.",
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
  words: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })),
});
export type Timing = z.output<typeof timingSchema>;
export type Word = Timing["words"][number];

const media = z.object({ file: z.string(), duration: z.number().optional(), width: z.number().optional(), height: z.number().optional() });
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
/** Images made by `npm run generate`; only valid with a `generator` provenance record. */
export const AI_LICENSE = "AI-GENERATED";
/** Material the channel owner made or owns outright (e.g. their own music); no source URL needed. */
export const OWN_LICENSE = "OWN WORK";

export const generatorSchema = z.object({
  provider: z.string(), // "replicate"
  model: z.string(), // "black-forest-labs/flux-3-image"
  version: z.string().optional(),
  predictionId: z.string(),
  prompt: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
  created: z.string(),
});

export const creditSchema = z
  .object({
    file: z.string().describe("Path relative to the folder holding this credits.json, e.g. 'clips/drone.mp4' (episode) or 'sfx/impact.mp3' (library)"),
    title: z.string().min(1),
    author: z.string().min(1),
    license: z.enum([...LICENSES, AI_LICENSE, OWN_LICENSE]),
    licenseVersion: z.string().optional(),
    sourceUrl: z.string().url().optional().describe("Landing page of the source; required for every license except OWN WORK"),
    originalUrl: z.string().url().optional(),
    notes: z.string().optional(),
    generator: generatorSchema.optional().describe("Provenance for AI-GENERATED images (written by `npm run generate`)"),
  })
  .refine((c) => c.license !== AI_LICENSE || !!c.generator, { message: "AI-GENERATED entries need a `generator` record", path: ["generator"] })
  .refine((c) => c.license === OWN_LICENSE || !!c.sourceUrl, { message: "needs a sourceUrl (only OWN WORK entries may omit it)", path: ["sourceUrl"] });
export type Credit = z.output<typeof creditSchema>;
