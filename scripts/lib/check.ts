// Everything `npm run check` verifies. Returns issues instead of exiting, so render can reuse it.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { feature } from "topojson-client";
import type { Issue } from "../../src/kit/lib/resolve.ts";
import { sfxCues } from "../../src/kit/lib/sfx.ts";
import { norm } from "../../src/kit/lib/timing.ts";
import { AI_LICENSE, type AssetManifest, assetsSchema, type Credit, creditSchema, isTextSection, LICENSES, OWN_LICENSE, PRESS_LICENSE } from "../../src/kit/schema.ts";
import { layoutOf } from "../../src/kit/themes/ids.ts";
import { AUDIO_EXT, IMAGE_EXT, LIBRARY, listMedia, VIDEO_EXT } from "./assets.ts";
import { loadFromDisk, scriptWords, zodIssues } from "./episode.ts";
import { loadConfig } from "./config.ts";
import { runMusicVideoCheck } from "./checkMusicVideo.ts";
import { isMusicVideoSlug } from "./musicVideo.ts";
import { paths, PUBLIC } from "./util.ts";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topology = require("world-atlas/countries-110m.json") as any;
const COUNTRIES = new Set<string>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (feature(topology, topology.objects.countries) as any).features.map((f: { properties: { name: string } }) => f.properties.name),
);

/** Length limits that keep text inside its box at the components' font sizes. */
export const LIMITS = {
  headlineWords: 6,
  headlineChars: 44,
  subhead: 32,
  region: 34,
  statValue: 10,
  statLabel: 42,
  stamp: 16,
  beatSub: 40,
  everyFront: 22,
  outroLine: 26, // text + accent, lines before the last (130px)
  outroLast: 18, // last line (190px)
  note: 48,
  titleBig: 4,
  titleSmallLine: 12,
  // text sections (kind: "text")
  sectionLabel: 28,
  sectionHeadingWords: 8,
  sectionHeadingChars: 48,
  sectionBody: 200,
  sectionVisuals: 4,
  // split-layout themes: stat rows per panel and the most panels that still read well
  splitPerPanel: 5,
  splitPanels: 3,
  // spatial-layout themes (frontier): metric tiles, 3 visible at a time
  spatialStats: 6,
};

type Credits = { entries: Credit[]; issues: Issue[] };

export const loadCredits = (file: string, where: string): Credits => {
  const issues: Issue[] = [];
  if (!existsSync(file)) return { entries: [], issues };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { entries: [], issues: [{ level: "error", where, msg: `not valid JSON: ${(e as Error).message}` }] };
  }
  if (!Array.isArray(raw)) return { entries: [], issues: [{ level: "error", where, msg: "must be a JSON array of credit entries" }] };
  const entries: Credit[] = [];
  raw.forEach((r, i) => {
    const c = creditSchema.safeParse(r);
    if (c.success) entries.push(c.data);
    else {
      const file = (r as { file?: string })?.file ?? `entry ${i}`;
      const lic = (r as { license?: string })?.license;
      const licMsg =
        lic !== undefined && lic !== AI_LICENSE && lic !== OWN_LICENSE && lic !== PRESS_LICENSE && !(LICENSES as readonly string[]).includes(lic)
          ? ` License "${lic}" is not allowed (only ${LICENSES.join(", ")}, ${OWN_LICENSE} for your own material, ${AI_LICENSE} via \`npm run generate\` / \`npm run compose\`, or ${PRESS_LICENSE} for official press images when config.yaml allows them).`
          : "";
      issues.push({ level: "error", where: `${where} ${file}`, msg: `${zodIssues(c.error).join("; ")}.${licMsg}` });
    }
  });
  return { entries, issues };
};

/**
 * Every media file in the episode (clips, images, sfx, music, plus `extraFiles` such as a music video's song) and every
 * library file it uses needs an allowed-license credit; AI-GENERATED is only for generated stills and composed beds.
 * Shared by news episodes and music videos. Also returns the parsed episode credits for the checks that follow.
 */
export const creditCoverageIssues = (slug: string, usedLib: Set<string>, extraFiles: string[] = []) => {
  const p = paths(slug);
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
  const epCredits = loadCredits(p.credits, "credits.json");
  const libCredits = loadCredits(join(LIBRARY, "credits.json"), "library/credits.json");
  issues.push(...epCredits.issues, ...libCredits.issues);
  if (!existsSync(p.credits)) err("credits.json", `public/episodes/${slug}/credits.json is missing`);
  const epFiles = new Set(epCredits.entries.map((c) => c.file));
  const libFiles = new Set(libCredits.entries.map((c) => c.file));
  const need = (set: Set<string>, rel: string, where: string) => {
    if (!set.has(rel)) err(where, `${rel} has no credits entry with an allowed license (${LICENSES.join(", ")})`);
  };
  for (const [dir, exts] of [
    ["clips", VIDEO_EXT],
    ["images", IMAGE_EXT],
    ["sfx", AUDIO_EXT],
    ["music", AUDIO_EXT],
  ] as const) {
    listMedia(join(p.pub, dir), exts).forEach((f) => need(epFiles, `${dir}/${f}`, "credits.json"));
  }
  extraFiles.forEach((f) => need(epFiles, f, "credits.json"));
  usedLib.forEach((f) => need(libFiles, f, "library/credits.json"));
  epCredits.entries
    .filter((c) => !existsSync(join(p.pub, c.file)))
    .forEach((c) => issues.push({ level: "warning", where: "credits.json", msg: `${c.file} is credited but not on disk` }));

  const composed = (c: Credit) => c.file.startsWith("music/") && c.generator?.provider === "local" && /stable-audio-3/.test(c.generator.model);
  epCredits.entries
    .filter((c) => c.license === AI_LICENSE && !c.file.startsWith("images/") && !composed(c))
    .forEach((c) => err("credits.json", `${c.file}: ${AI_LICENSE} is only allowed for images/ made by \`npm run generate\` and music/ made by \`npm run compose\``));
  libCredits.entries.filter((c) => c.license === AI_LICENSE).forEach((c) => err("library/credits.json", `${c.file}: ${AI_LICENSE} isn't allowed in the shared library`));
  return { epCredits, issues };
};

/** Basenames of the episode's AI-generated stills (npm run generate), which must carry an on-screen note. */
export const generatedStills = (entries: Credit[]) =>
  new Set(entries.filter((c) => c.license === AI_LICENSE && c.file.startsWith("images/")).map((c) => c.file.replace(/^images\//, "").replace(/\.[^.]+$/, "")));

/** Press images: only when config.yaml allows them, only images/ and clips/, never in the library, never the thumbnail. */
export const pressIssues = (entries: Credit[], thumbnailVisual?: string): Issue[] => {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
  const pressOn = loadConfig().licensing.press_images;
  const press = entries.filter((c) => c.license === PRESS_LICENSE);
  press.forEach((c) => {
    if (!pressOn) err("credits.json", `${c.file}: press images are off (config.yaml licensing.press_images: false); replace it with licensed media`);
    if (!/^(images|clips)\//.test(c.file)) err("credits.json", `${c.file}: ${PRESS_LICENSE} is only for images/ and clips/`);
  });
  loadCredits(join(LIBRARY, "credits.json"), "library/credits.json")
    .entries.filter((c) => c.license === PRESS_LICENSE)
    .forEach((c) => err("library/credits.json", `${c.file}: press images stay per episode, not in the shared library`));
  const pressNames = new Set(press.map((c) => c.file.replace(/^.*\//, "").replace(/\.[^.]+$/, "")));
  if (thumbnailVisual && pressNames.has(thumbnailVisual)) err("thumbnail.visual", `"${thumbnailVisual}" is a press image: press images can't be the thumbnail (it promotes the video, not the product)`);
  return issues;
};

/** assets.json must list exactly the clips and images on disk. */
export const staleAssetIssues = (slug: string, assets: AssetManifest): Issue[] => {
  const p = paths(slug);
  const stale: string[] = [];
  const onDisk = (dir: string, exts: string[]) => listMedia(dir, exts).map((f) => f.replace(/\.[^.]+$/, ""));
  for (const [kind, dir, exts] of [
    ["clips", join(p.pub, "clips"), VIDEO_EXT],
    ["images", join(p.pub, "images"), IMAGE_EXT],
  ] as const) {
    const names = onDisk(dir, exts);
    names.filter((n) => !assets[kind][n]).forEach((n) => stale.push(`${kind}/${n} not in assets.json`));
    Object.keys(assets[kind])
      .filter((n) => !names.includes(n))
      .forEach((n) => stale.push(`${kind}/${n} listed but missing on disk`));
  }
  return stale.length
    ? [{ level: "error", where: "assets", msg: `assets.json is out of date (${stale.slice(0, 4).join("; ")}${stale.length > 4 ? "; …" : ""}): run \`npm run assets -- ${slug}\`` }]
    : [];
};

export const runCheck = (slug: string): Issue[] => {
  if (isMusicVideoSlug(slug)) return runMusicVideoCheck(slug);
  const d = loadFromDisk(slug);
  const { p } = d;
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: "warning", where, msg });

  if (d.episodeErrors.length) {
    d.episodeErrors.forEach((e) => err("episode.json", e));
    return issues;
  }
  const ep = d.episode!;
  if (ep.slug !== slug) err("slug", `episode.json says "${ep.slug}" but the folder is "${slug}"`);

  // --- Shorts: vertical, from a parent episode, short enough ---
  if ((ep.format === "short") !== (ep.aspect === "9:16")) {
    err("aspect", ep.format === "short" ? 'a Short must be "aspect": "9:16"' : '"aspect": "9:16" is only for Shorts ("format": "short")');
  }
  if (ep.format === "short") {
    // A standalone Short (npm run new --format short) has no parent; one cut from an episode names it.
    if (ep.parent && !existsSync(join(p.src, "..", ep.parent, "episode.json"))) err("parent", `no episode "${ep.parent}" (episodes/${ep.parent}/episode.json)`);
    const secs = d.timing && !d.timing.estimated ? d.timing.duration : null;
    const target = loadConfig().shorts.maxSeconds;
    if (secs !== null && secs > 180) err("timing", `${secs.toFixed(0)} s of voiceover: a YouTube Short can be at most 3 minutes`);
    else if (secs !== null && secs > target) warn("timing", `${secs.toFixed(0)} s of voiceover; Shorts work best at ${target} s or less (config.yaml shorts.maxSeconds)`);
  }

  // --- generated files ---
  if (!existsSync(p.timing)) err("timing", `timing.json missing: run \`npm run align -- ${slug}\``);
  else if (!d.timing) err("timing", "timing.json doesn't match the expected shape; re-run align");
  if (!existsSync(p.assets)) err("assets", `assets.json missing: run \`npm run assets -- ${slug}\``);
  const assets = d.assets ?? assetsSchema.parse({});

  // Manifest must match what's on disk.
  issues.push(...staleAssetIssues(slug, assets));

  // --- voiceover vs timing vs script ---
  if (!assets.voiceover) err("audio.voiceover", `public/episodes/${slug}/${ep.audio.voiceover} not found (or assets.json is stale)`);
  if (d.timing && assets.voiceover?.duration && !d.timing.estimated && Math.abs(assets.voiceover.duration - d.timing.duration) > 0.5) {
    err("timing", `voiceover is ${assets.voiceover.duration.toFixed(2)}s but timing.json says ${d.timing.duration.toFixed(2)}s: the MP3 changed, re-run align`);
  }
  if (d.timing && existsSync(p.script)) {
    const sw = scriptWords(p.script);
    const tw = d.timing.words.map((w) => w.word);
    if (sw.length !== tw.length || sw.some((w, i) => w !== tw[i])) {
      err("timing", "voiceover.txt changed since timing.json was written: re-run align (or `align --estimate` for a draft)");
    }
  }
  if (d.timing?.match && d.timing.match.matched / Math.max(1, d.timing.match.total) < 0.9) {
    warn("timing", `only ${d.timing.match.matched}/${d.timing.match.total} script words matched the audio; compare voiceover.txt with heard.txt`);
  }

  // --- cues and visuals (from the same resolver the video uses) ---
  if (d.timeline) issues.push(...d.timeline.issues);

  // --- text lengths ---
  const long = (where: string, text: string, max: number, what = "characters") => {
    if (text.length > max) err(where, `"${text}" is ${text.length} ${what}; keep it ≤ ${max} so it fits`);
  };
  const layout = layoutOf(ep.theme);
  const split = layout === "split";
  const lastItem = ep.segments.reduce((acc, s, i) => (isTextSection(s) ? acc : i), -1);
  ep.segments.forEach((s, i) => {
    const w = `segments[${i}]`;
    if (isTextSection(s)) {
      if (s.label) long(`${w}.label`, s.label, LIMITS.sectionLabel);
      const words = s.heading.split(/\s+/).filter(Boolean).length;
      if (words > LIMITS.sectionHeadingWords) err(`${w}.heading`, `"${s.heading}" is ${words} words; keep section headings ≤ ${LIMITS.sectionHeadingWords}`);
      long(`${w}.heading`, s.heading, LIMITS.sectionHeadingChars);
      if (s.body) long(`${w}.body`, s.body, LIMITS.sectionBody);
      s.visuals.forEach((v, k) => v.note && long(`${w}.visuals[${k}].note`, v.note, LIMITS.note));
      if (!s.visuals.length) warn(`${w}.visuals`, `no visuals; the section shows its text over the world map (1–${LIMITS.sectionVisuals} visuals read best)`);
      return;
    }
    const words = s.headline.split(/\s+/).filter(Boolean).length;
    if (words > LIMITS.headlineWords) err(`${w}.headline`, `"${s.headline}" is ${words} words; keep headlines ≤ ${LIMITS.headlineWords}`);
    long(`${w}.headline`, s.headline, LIMITS.headlineChars);
    if (s.subhead) long(`${w}.subhead`, s.subhead, LIMITS.subhead);
    long(`${w}.region`, s.region, LIMITS.region);
    s.stats.forEach((st, k) => {
      long(`${w}.stats[${k}].value`, st.value, LIMITS.statValue);
      long(`${w}.stats[${k}].label`, st.label, LIMITS.statLabel);
    });
    if (split) {
      const max = LIMITS.splitPerPanel * LIMITS.splitPanels;
      if (s.stats.length > max) warn(`${w}.stats`, `${s.stats.length} stats; more than ${LIMITS.splitPanels} panels of ${LIMITS.splitPerPanel} is hard to follow`);
      if (s.stats.length === 0) warn(`${w}.stats`, "no stats; the spec column will be just the headline");
    } else if (layout === "spatial") {
      if (s.stats.length > LIMITS.spatialStats) warn(`${w}.stats`, `${s.stats.length} stats; the metric tiles show 3 at a time and slide on, so more than ${LIMITS.spatialStats} is hard to follow`);
      if (s.stats.length === 0) warn(`${w}.stats`, "no stats; the row of metric tiles under the window stays empty");
    } else {
      if (s.stats.length > 2) warn(`${w}.stats`, `${s.stats.length} stats; 1–2 per segment reads best`);
      if (s.stats.length === 0) warn(`${w}.stats`, "no stats; the left column will be just the headline");
    }
    s.visuals.forEach((v, k) => v.note && long(`${w}.visuals[${k}].note`, v.note, LIMITS.note));
    if (!s.visuals.length) warn(`${w}.visuals`, "no visuals; the segment shows its map full-screen");
    if (!s.map) warn(`${w}.map`, "no map; the locator card is hidden and the all-fronts map skips this segment");
    if (s.emphasis !== "top" && ep.format === "countdown" && i === lastItem) warn(`${w}.emphasis`, 'the #1 segment usually gets emphasis: "top"');
  });
  ep.coldOpen.beats.forEach((b, i) => {
    const w = `coldOpen.beats[${i}]`;
    if (b.map) long(`${w}.stamp`, `${b.stamp} ${b.accent ?? ""}`.trim(), LIMITS.everyFront);
    else long(`${w}.stamp`, b.stamp, LIMITS.stamp);
    if (b.sub) long(`${w}.sub`, b.sub, LIMITS.beatSub);
    if (b.accent && !b.map) warn(`${w}.accent`, "accent is only drawn on map beats");
  });
  long("coldOpen.title.big", ep.coldOpen.title.big, LIMITS.titleBig);
  ep.coldOpen.title.small.split("\n").forEach((l) => long("coldOpen.title.small", l, LIMITS.titleSmallLine, "characters on one line (use \\n)"));
  ep.outro.lines.forEach((l, i) => {
    const text = `${l.text} ${l.accent ?? ""}`.trim();
    long(`outro.lines[${i}]`, text, i === ep.outro.lines.length - 1 && ep.outro.lines.length > 1 ? LIMITS.outroLast : LIMITS.outroLine);
  });

  // --- maps ---
  ep.segments.forEach((s, i) => {
    if (isTextSection(s) || !s.map) return;
    const w = `segments[${i}].map`;
    const [[west, south], [east, north]] = s.map.bbox;
    if (!(west < east && south < north)) err(`${w}.bbox`, "must be [[west, south], [east, north]] with west < east and south < north");
    for (const key of ["highlight", "hostile"] as const) {
      (s.map[key] ?? []).forEach((c) => {
        if (!COUNTRIES.has(c)) {
          const close = [...COUNTRIES].filter((n) => norm(n).includes(norm(c)) || norm(c).includes(norm(n))).slice(0, 3);
          warn(`${w}.${key}`, `"${c}" isn't a world-atlas country name, so it won't be tinted${close.length ? ` (did you mean ${close.map((x) => `"${x}"`).join(", ")}?)` : ""}`);
        }
      });
    }
    s.map.pins.forEach((pin, k) => {
      if (pin.lon < west || pin.lon > east || pin.lat < south || pin.lat > north) warn(`${w}.pins[${k}]`, `${pin.label} is outside the bbox and may be off the map`);
    });
  });

  // --- visual reuse ---
  ep.segments.forEach((s, i) => {
    const names = s.visuals.map((v) => v.name);
    names.filter((n, k) => names.indexOf(n) !== k).forEach((n) => warn(`segments[${i}].visuals`, `"${n}" is used twice in one segment`));
    if (i > 0) {
      const prev = new Set(ep.segments[i - 1].visuals.map((v) => v.name));
      names.filter((n) => prev.has(n)).forEach((n) => warn(`segments[${i}].visuals`, `"${n}" also appears in the previous segment`));
    }
  });

  // --- audio library ---
  if (d.timeline) {
    const missing = [...new Set(sfxCues(ep, d.timeline).map((c) => c.sfx))].filter((s) => !assets.sfx[s]);
    if (missing.length) err("audio.sfxPreset", `preset "${ep.audio.sfxPreset}" needs sounds missing from public/library/sfx: ${missing.join(", ")}`);
  }
  if (ep.audio.music && !assets.music[ep.audio.music.file] && !(ep.audio.music.file.includes("/") && existsSync(join(PUBLIC, ep.audio.music.file)))) {
    err("audio.music.file", `"${ep.audio.music.file}" is not in public/library/music or the episode's music/ folder`);
  }

  // --- licensing: every media file needs an allowed-license credit ---
  const usedLib = new Set<string>();
  const sfxUsed = d.timeline ? new Set(sfxCues(ep, d.timeline).map((c) => c.sfx)) : new Set<string>();
  sfxUsed.forEach((s) => assets.sfx[s]?.file.startsWith("library/") && usedLib.add(assets.sfx[s].file.slice("library/".length)));
  const mf = ep.audio.music && assets.music[ep.audio.music.file]?.file;
  if (mf && mf.startsWith("library/")) usedLib.add(mf.slice("library/".length));
  const { epCredits, issues: coverage } = creditCoverageIssues(slug, usedLib);
  issues.push(...coverage);

  // --- AI-generated media: stills (npm run generate, always tagged on screen) and music beds (npm run compose) ---
  const generated = generatedStills(epCredits.entries);
  const usesAi: string[] = [];
  ep.segments.forEach((s, i) =>
    s.visuals.forEach((v, k) => {
      if (!generated.has(v.name) || assets.clips[v.name]) return;
      usesAi.push(v.name);
      if (!v.note) err(`segments[${i}].visuals[${k}]`, `"${v.name}" is AI-generated: add "note": "AI-GENERATED ILLUSTRATION" so viewers know`);
    }),
  );
  ep.coldOpen.beats.forEach((b, i) => {
    if (!b.visual || !generated.has(b.visual) || assets.clips[b.visual]) return;
    usesAi.push(b.visual);
    if (!b.note) err(`coldOpen.beats[${i}]`, `"${b.visual}" is AI-generated: add "note": "AI-GENERATED ILLUSTRATION" so viewers know`);
  });
  if (ep.thumbnail?.visual && generated.has(ep.thumbnail.visual)) usesAi.push(ep.thumbnail.visual);
  if (usesAi.length) {
    warn("AI imagery", `uses AI-generated images (${[...new Set(usesAi)].join(", ")}). If any look realistic, tick YouTube's "altered or synthetic content" box when uploading.`);
  }

  // --- press images (config.yaml licensing.press_images): official manufacturer images of a product being discussed ---
  issues.push(...pressIssues(epCredits.entries, ep.thumbnail?.visual));

  // --- source material ---
  if (!existsSync(p.article) || readFileSync(p.article, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim().length < 200) {
    err("article.md", "episodes/<slug>/article.md is empty; save the source article there (it is the fact-check reference)");
  }
  if (!ep.sources.length && !ep.outro.sourcesCard) warn("sources", "no sources listed; they go into the YouTube description");
  if (!ep.summary) warn("summary", "no summary: write 1–2 sentences (facts from the article) for the top of the YouTube description; npm run credits puts it there");

  return issues;
};
