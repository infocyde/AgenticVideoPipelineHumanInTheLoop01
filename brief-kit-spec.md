# Brief Kit: spec for a reusable narrated-countdown video template (Remotion)

**For:** a Claude Code instance that will build the kit.
**Reference implementation:** `C:\_activeDev\geop_video`, a finished one-off episode ("Global Threat Brief", October 2026). Read it before planning. Most components already exist there in a hard-coded form; this spec is about making them generic, data-driven and reusable.

---

## 1. Intent

The user wants to turn articles into short, intense, narrated YouTube videos, starting with a weekly top-10 geopolitics countdown and later covering other topics and formats. The first episode was built by hand: script, voiceover alignment, React scenes, b-roll hunting, sound design, render, loudness mastering.

The goal is a **kit**: a template repo where every React component, script and pipeline step already exists. A new video is then a **new episode folder holding data and assets only**. A Claude instance working with the user (the "episode producer") fills that folder: it writes the script, waits for the user's voiceover, aligns it, writes the episode data, sources licensed assets, previews and renders. **Making an episode must never require editing a component.**

There are two roles to keep separate:

| Role | Who | Does |
|---|---|---|
| **Builder** | You, once | Build the kit: components, schema, scripts, docs, and the producer playbook |
| **Producer** | A Claude instance, every episode | Follows the playbook you write (`CLAUDE.md` plus a skill) to make one episode |

## 2. Goals

1. **Data-driven episodes.** One `episode.json` per episode, validated by a schema, fully describes the video: brand text, segments, headlines, stats, map focus, visuals, which spoken cues drive which cuts, and the outro. Components read only from it plus the generated timing and asset manifests.
2. **Multiple episodes in one repo.** Each episode shows up as its own composition in Remotion Studio and renders with one command. `node_modules` is shared.
3. **A complete component library.** Covers everything in the reference video (§6), generalized and themeable.
4. **A scripted pipeline.** `new`, `align`, `assets`, `check`, `dev`, `render`, `thumb`, `credits`: each one command, each with a clear success or failure message (§7).
5. **A producer playbook.** `CLAUDE.md` plus `.claude/skills/new-episode/SKILL.md` let a fresh Claude instance take an article and a voiceover to a finished, licensed, mastered MP4 without help (§8).
6. **Themeable.** Brand name, colors, fonts, ticker label and CTA text come from a theme. The geopolitics look ships as the default theme, `threat-brief`.
7. **Reproduces the reference.** The October 2026 episode, ported to `episodes/2026-10-17-threat-brief/`, renders visually equivalent to the reference (§10).

## 3. Non-goals

- Text-to-speech generation. The user brings the voiceover (e.g. ElevenLabs). An optional TTS step can come later; leave a seam for it.
- Uploading to YouTube, scheduling, or analytics.
- A GUI or web app. Remotion Studio is the preview UI.
- A general-purpose video editor. The kit supports a small set of formats well.

## 4. Anti-goals (failure even if it works)

- Making an episode requires touching `.tsx` files.
- Any asset without a recorded license, or with a license that isn't PD, CC0, CC BY or CC BY-SA.
- On-screen text or narration that states facts beyond the source article. The playbook must enforce this.
- Silent fallbacks that hide broken timing, e.g. a stat cue that doesn't resolve quietly lands at "+2s". `check` must report it.
- A render whose loudness isn't YouTube-ready.

## 5. Architecture

### 5.1 Repo layout (decided)

New repo at `C:\_activeDev\brief-kit` (builder's call: a separate folder, not inside `geop_video`).

```
brief-kit/
  CLAUDE.md                       # producer playbook (entry point)
  .claude/skills/new-episode/SKILL.md
  README.md                       # human quick start
  package.json, tsconfig.json, remotion.config.ts
  src/
    index.ts, Root.tsx            # registers one composition per episode + Thumbnail per episode
    episodes.generated.ts         # written by `npm run sync`; imports each episode's json
    kit/
      schema.ts                   # zod schema for episode.json (single source of truth)
      themes/                     # threat-brief.ts (default) + one contrasting demo theme
      lib/                        # timing (phraseTime, cue resolution, captions), assets, audio cues
      components/                 # §6
      scenes/                     # ColdOpen, Segment, Outro, SourcesCard, CreditsCard, EndCard
      formats/                    # Countdown.tsx, List.tsx (compose scenes per format)
      Thumbnail.tsx
  episodes/<slug>/                # per-episode SOURCE (not served)
    episode.json
    voiceover.txt
    article.md                    # the source, kept for fact-checking
    notes.md                      # producer's working notes (optional)
  public/
    episodes/<slug>/
      voiceover.mp3
      timing.json                 # generated by align
      assets.json                 # generated by assets
      clips/  images/  credits.json
    library/
      sfx/  music/  credits.json  # shared across episodes (seed from reference)
  scripts/
    new.mjs  sync.mjs  align.py (or align.mjs, see §7.2)  assets.mjs  check.mjs  master.mjs  credits.mjs
  out/<slug>/                     # renders (gitignored)
```

Why `episodes/` and `public/episodes/` are split: Remotion only serves `public/`, but episode JSON should be imported at bundle time so Studio hot-reloads on edits. `sync.mjs` generates `src/episodes.generated.ts` from the folders that exist.

### 5.2 Episode schema (shape decided, field names are the builder's call)

Use zod (`@remotion/zod-types` is available) so Studio can show props. Approximate shape:

```ts
Episode = {
  slug: string
  title: string                       // e.g. "The week in 10 flashpoints"
  theme: string                       // theme id, default "threat-brief"
  format: "countdown" | "list"        // countdown = 10→1 with number slams; list = 1..N, no slams
  aspect: "16:9"                      // 9:16 is phase 2 (§11)
  brand: { name: string; tagline?: string; dateLabel: string }   // "OCT 2026", "WEEK OF OCT 11–17, 2026"
  audio: {
    voiceover: string                 // file in public/episodes/<slug>/
    music?: { file: string; level: number; duck: boolean }       // library/music/... or episode-local
    sfxPreset?: "intense" | "calm" | "none"
  }
  coldOpen: {
    beats: { cue: string; visual?: string; stamp: string; sub?: string; map?: "all-pins" }[]
    title: { cue: string; kicker: string; big: string; small: string }    // "THE WEEK IN" / "10" / "FLASHPOINTS"
  }
  segments: {
    marker: string                    // spoken phrase that starts the segment, e.g. "Number ten"
    num?: number
    region: string
    headline: string
    emphasis?: "top"                  // e.g. alarm treatment on #1
    stats: { value: string; label: string; cue: string }[]
    visuals: { name: string; cue?: string; note?: string }[]   // first visual starts at segment start; others cut on cue
    map?: { bbox: [[w,s],[e,n]]; highlight: string[]; hostile?: string[]; pins: { lon; lat; label }[] }
  }[]
  outro: {
    cue: string; lines: { text: string; accent?: string; cue?: string }[]; cta?: { label: string; cue: string }
    sourcesCard: { seconds: number } | false   // default { seconds: 7 }: on for every episode
    creditsCard: { seconds: number } | false   // default { seconds: 8 }: on for every episode
    endScreen?: { seconds: number }
  }
  ticker?: { label: string }          // items default to segment headlines
  sources: { title: string; url: string }[]   // from the article, go into credits/description
}
```

**Cues** are short spoken phrases, matched case- and accent-insensitively against the aligned words, searching forward from a given time (see `phraseTime` in the reference `src/lib/timing.ts`). Every cue must resolve; `check` reports any that don't.

### 5.3 Timing model (decided, ported from reference)

- `timing.json` = `{ duration, words: [{ word, start, end }] }`. The words are the **script's own words** with audio times (not Whisper's text), so captions are spelled exactly as written.
- Segment boundaries, visual cuts, stat pops, cold-open beats, outro lines and the CTA all come from resolving cues at runtime. Nothing is timed by hand in seconds.
- Each scene starts `LEAD = 0.12s` before its marker, so slams land on the spoken word. Inner times are relative to the scene start (the reference had an off-by-LEAD bug here; keep it fixed).
- **Every episode ends with a references scene and a credits scene** (added after the first build; required by default):
  1. 1s after the voiceover ends, `SourcesCard` lists `episode.sources` on screen (title + site, "full links in the description") for `outro.sourcesCard.seconds` (default 7).
  2. `CreditsCard` then rolls the media credits for `outro.creditsCard.seconds` (default 8): footage & images, AI illustrations, music & sound, and map data, one line per author + license. It is built from the same `credits.json` files `check` validates, and shows only what the episode actually uses (identical to the credits in `DESCRIPTION.md`).
  - The music bed carries through both cards and fades over the last 2s. The top bar and ticker stop when the outro ends.
  - An episode can opt out of either card with `false`. An episode with no `sources` fails `check` unless its sources card is off.
- Composition duration is the voiceover plus 1s plus the closing cards. With both cards off it is the voiceover plus a 3s tail, which reproduces the reference. If `outro.endScreen = { seconds: 5–20 }` is set, `EndCard` runs that long after the closing cards (or after the voiceover, if there are none) as a branded hold frame with empty, safe-area-correct slots for YouTube end-screen elements (subscribe and next video). Off by default.

## 6. Component library

Generalize these from the reference (paths are reference files). Every component takes theme values from context, not from imports of constants.

| Component | Reference | Generalize |
|---|---|---|
| `WorldMap` | `src/components/WorldMap.tsx` | Keep d3-geo + world-atlas 110m, the zoom-in from a widened bbox, pins with pulse rings, highlight and hostile tints, and label flip near the right edge. Add a check warning when a `highlight` country name isn't found in world-atlas. |
| `Backdrop` | `src/components/Backdrop.tsx` | B-roll with Ken Burns, slow-mo (≥0.5×) then loop to fill a slot, cue-based start frames, glitch on cuts, per-visual `note` tag ("FILE FOOTAGE · …"), images and clips. Treatment (filter, tint, gradients) comes from the theme. |
| `NumberSlam`, `StatCard`, `LocatorCard` | `src/scenes/Story.tsx` | Extract as components. The StatCard typewriter label and value slam stay. |
| `Headline` | inline in Story | Add **auto-fit**: choose the font size to avoid a 1-word orphan line and fit ≤3 lines (the reference needed a manual edit to fix an orphan). |
| `Stamp`, `TitleCard`, `EveryFront` (all-pins map) | `src/scenes/ColdOpen.tsx` | Drive from `coldOpen.beats` and `coldOpen.title`. |
| `TopBar`, `Ticker`, `Captions`, `Grain`, `GlitchCut` | `src/components/Chrome.tsx` | Brand text and counter from the episode. The counter hides outside segments. Captions hide once the outro title appears, use script words, chunk ≤5 words or ≤30 chars, break on punctuation or pauses >0.35s, and highlight the active word. |
| `SlamText`, `SubscribeCTA` | `src/scenes/Outro.tsx` | Driven by `outro`. The CTA label comes from the theme or episode. |
| `SourcesCard`, `CreditsCard` | new (after the first build) | Closing scenes, on by default for every episode: sources (title + site) then a media-credits roll from `credits.json`. Themed; each can be turned off per episode. |
| `MusicBed` | `src/GeoRecap.tsx` | **New: ducking.** Lower the bed under speech and swell it in gaps longer than ~0.4s and on slams, using the word timings. Fade in and out. |
| `SfxTrack` | `sfxCues()` in `GeoRecap.tsx` | Turn the hard-coded cue list into **presets** that map scene events (segment start, slam, stat pop, visual cut, cold-open beat, title, outro, CTA, top-emphasis) to library sounds and volumes. `intense` = the reference mix. |
| `Thumbnail` | new | A `Still` composition per episode, 1280×720, built from the theme and episode (big number or keyword, title, `brand.dateLabel`, map pins, optional background visual). This gives crisp text without relying on an image model. |

Formats: `Countdown` = ColdOpen → segments with NumberSlam → Outro. `List` = same without slams and with "1 of N" counters. Both reuse the same scenes.

Themes: `threat-brief` reproduces the reference exactly (Anton / JetBrains Mono / Inter, the colors in reference `src/theme.ts`). Add one deliberately different demo theme, e.g. light background with a blue accent and different fonts, to prove that nothing is hard-coded.

## 7. Pipeline

All commands take the episode slug. Windows with Git Bash and PowerShell is the primary platform; ffmpeg is on PATH; Node 22.

| Command | Does | Success looks like |
|---|---|---|
| `npm run new -- <slug>` | Scaffolds `episodes/<slug>/` and `public/episodes/<slug>/` from a template episode, then runs `sync` | Folder exists and Studio shows the composition (with a placeholder) |
| `npm run sync` | Regenerates `src/episodes.generated.ts` | |
| `npm run align -- <slug>` | Transcribes `voiceover.mp3`, aligns `voiceover.txt` words to it, writes `timing.json` | Prints matched/total words (warn under 90%) and duration |
| `npm run assets -- <slug>` | ffprobes clips, images and sfx (episode plus library) and writes `assets.json` | Lists what was found |
| `npm run check -- <slug>` | Schema valid; every cue resolves in order and inside its segment; every visual exists; every asset has a credits entry with an allowed license; headlines and labels within length limits; warns on visuals reused in adjacent segments | Zero errors; warnings listed |
| `npm run dev` | Remotion Studio | |
| `npm run render -- <slug>` | Runs `check`, renders with `--gl=angle` and progress output, then masters audio | `out/<slug>/video.mp4` and `out/<slug>/youtube.mp4` at -14 LUFS ±1, true peak ≤ -1 dBTP |
| `npm run thumb -- <slug>` | Renders the Thumbnail still | `out/<slug>/thumbnail.png` |
| `npm run credits -- <slug>` | Builds `out/<slug>/DESCRIPTION.md`: summary placeholder, chapter timestamps (from segment start times), sources, and credits. Also `out/<slug>/REFERENCES.md`: the numbered source list with links, on its own | Ready to paste into YouTube |

### 7.1 Lessons from the reference build (must carry over)

- **Whisper:** don't pass the script as `initial_prompt`. It hallucinated about 30s of text. Transcribe plainly with `condition_on_previous_text=False` and `vad_filter=True`, then align script words to the transcript with difflib. Interpolate unmatched words between anchors. The reference matched 349 of 362 words.
- **faster-whisper on this machine:** PyAV's `av.open(..., metadata_errors=...)` crashed, so decode audio with ffmpeg into numpy instead. CUDA failed with a missing `cublas64_12.dll`, so default to CPU int8 (about 3 min for 2:17 of audio with `medium.en`).
- **Rendering:** on this RTX 4070 laptop, `--gl=angle` was about 30% faster, with matching frames. Set it in `remotion.config.ts`. Always show render progress. Stopping a render can leave `chrome-headless-shell.exe` and `ffmpeg.exe` processes running; the README should say how to kill only this repo's processes.
- **Loudness:** the raw mix came out at -26 LUFS. Master with two-pass `loudnorm` (linear) plus `alimiter`, copying the video stream (reference `scripts/master.mjs`). Single-pass overshot the peaks.
- **Visual cuts on cues, not even splits.** Even splits put fire footage under narration about a drone.
- **Captions** duplicate the outro text if they aren't hidden there.

### 7.2 Alignment implementation (builder's call, with a requirement)

Either port the reference `align.py` (faster-whisper in `.venv`) or switch to `@remotion/install-whisper-cpp`, which keeps the kit Node-only and is better if other people will use it. Requirement: on the reference voiceover, at least 95% of script words get matched, and all 10 markers resolve within 0.15s of the reference `timing.json`.

## 8. Producer playbook (`CLAUDE.md` + `new-episode` skill)

Write this for a Claude instance that has never seen the project. It covers:

1. **Intake.** Get the article (a file or pasted text). Save it to `episodes/<slug>/article.md`. Confirm the format (countdown or list), the item count and the date label with the user.
2. **Script.** Write `voiceover.txt`:
   - A cold-open hook (3–4 short lines plus "These are the N stories that defined this week.").
   - Then `Number ten.` … `Number one.` paragraphs, ordered least to most severe.
   - Then an outro starting `Any one of these…` with a CTA line.
   - Budget about 360 words for ~2:15. Spell out numbers and dates for TTS ("October twenty-fifth", "ninety percent"). No stage directions.
   - **Claims must not go beyond the article.** Flag any added context to the user.
   - Hand the script to the user and wait for their MP3.
3. **Align.** Run `align` and check that every marker was found. If the match rate is under 90%, the recording probably drifted from the script (e.g. the user edited lines in ElevenLabs). Then `align` should also write Whisper's raw transcript to `episodes/<slug>/heard.txt`. The producer updates `voiceover.txt` to match what was actually said and re-runs `align`. Captions must show what was said.
4. **Episode data.** Write `episode.json`: headlines of ≤6 words, regions, 1–2 stats per segment with spoken cues, map bbox and pins, visuals with cue-based cuts.
5. **Assets.** Dispatch parallel subagents with the license rules (§4): one for clips and images (Wikimedia Commons, NASA, DVIDS/US-government PD, Openverse), one for sfx and music only if the library lacks something. Include the processing specs from the reference subagent prompts: 1920×1080 H.264, no audio, ≤8s, no watermarks or burned-in text, credits.json entries. Use `note` for footage that isn't of the event described.
6. **Check, preview, render.** Run `check` and fix everything. Have the user preview in `npm run dev`. Before rendering, ask whether they're on AC power. Then run `render`, `thumb` and `credits`.
7. **Handoff.** Give the output paths (including `REFERENCES.md`), loudness, anything to verify by ear, and any file-footage substitutions the user should know about. Every video ends with the sources and credits scenes, so `sources` must be filled in from the article.

Include the asset-sourcing subagent prompts (Appendix A) and the thumbnail image-prompt pattern (Appendix B), generalized by topic, as reusable templates in the skill.

**Credits format:** normalize every credits entry to `{ file, title, author, license: "PD" | "CC0" | "CC BY" | "CC BY-SA", licenseVersion?, sourceUrl, originalUrl?, notes? }`. The reference files use two different spellings (`cc0`/`by` + `license_version` in sfx, `"CC BY 4.0"` in clips), so the port converts them and `check` rejects anything else.

## 9. Constraints

- Remotion 4.0.x, with all `remotion`/`@remotion/*` packages pinned to the same exact version. React 19. TypeScript strict. `tsc --noEmit` must pass.
- 1920×1080 at 30fps. H.264 and AAC.
- Assets: PD, CC0, CC BY or CC BY-SA only, every file recorded in a credits.json.
- Windows-first. Scripts in Node where possible; Python only for alignment if §7.2 keeps it.

## 10. Acceptance

1. **Reference port.** `episodes/2026-10-17-threat-brief/` reproduces the reference video. Copy its voiceover, timing, clips, images, sfx and credits from `C:\_activeDev\geop_video\public`, and express `src/data/stories.ts`, the ColdOpen beats and the Outro as `episode.json`. Rendered frames at 5s, 13.5s, 45s, 108.5s, 120s and 136s should be visually equivalent to the reference (same layout, text, visuals and timing). Exact pixels aren't required.
2. **Generality.** A second test episode uses the demo theme, `format: "list"`, 5 segments and a different topic (e.g. 5 tech stories). Placeholder voiceover via any TTS or a recording is fine, as long as it's aligned for real. It must render with **zero component edits**.
3. **Pipeline.** Every command in §7 runs end to end on both episodes, and `check` catches a deliberately broken cue, a missing visual and an unlicensed asset.
4. **Playbook dry run.** A fresh subagent gets `CLAUDE.md`, the second test episode's article, its `voiceover.txt` and its MP3. It must produce a valid `episode.json` that passes `check`. In real use the producer writes the script before the user records it, so the dry run supplies the script rather than testing transcript-only intake. Don't give it the episode's finished `episode.json`.

## 11. Left to the builder, and later phases

- Builder's call: component internals, file names, zod details, how themes are provided (React context is suggested), the template-episode contents, and whether `List` gets its own segment intro animation.
- **Phase 2 (don't build now, but don't block):** 9:16 Shorts layout variant; optional TTS step (ElevenLabs API); a `single-topic explainer` format; Openverse/Commons fetch scripts that replace the subagent sourcing.

---

## Appendix A: asset-sourcing subagent prompts (used for the reference episode)

These worked for the reference episode. Templatize the `<…>` parts. Paths are relative to the kit root; the scratch directory is the session scratchpad.

### A.1 Clips and images

> You are sourcing b-roll VIDEO clips (and a few backup images) for a ~<duration> YouTube video: <one-line description of the episode and its look>. The clips will be shown darkened, tinted, with heavy text overlays, 3–8 seconds each.
>
> LICENSING IS STRICT: only public domain (incl. US federal government works: US Navy, DoD/DVIDS, NASA, NOAA, USGS), CC0, or CC BY / CC BY-SA. No NC, no ND, no "editorial only", no unknown license. Record attribution for every file.
>
> Sources (no API key needed): Wikimedia Commons API (`action=query&list=search&srnamespace=6&srsearch=<terms> filetype:video`, then `prop=imageinfo&iiprop=url|extmetadata|size|mime` for URL, LicenseShortName and Artist; send a descriptive User-Agent with no personal email); Openverse images API (`license=cc0,by,by-sa,pdm`) for stills; NASA image & video library API (`media_type=video`, public domain). Skip Pexels/Pixabay (they need keys).
>
> Needed shots (one clip each, filename in brackets; ★ = priority; if no video exists, fetch a strong still as `images/<name>.jpg`): <list derived from episode.json visuals, with a one-line description each>
>
> Processing: download raw files into `<scratch>/clips_raw/<name>/` (never run downloaded files). Pick the most dynamic ~8s segment, skipping intros, titles and black frames. Extract frames with `ffmpeg -ss T -frames:v 1` and LOOK at them to confirm the content and that there is no burned-in text, logos or watermarks. Output `public/episodes/<slug>/clips/<name>.mp4`: libx264, yuv420p, crf 23, `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080`, 30fps, `-an`, ≤8s, `-movflags +faststart`. Images: ≤1920px wide, JPEG quality 85. Verify each output with ffprobe and one viewed frame. Write `credits.json` in the normalized format (§8). Report a table (file, what it shows, duration, source resolution, license) plus anything missing or substituted (e.g. footage of a different event). Aim for ~15 good assets; don't sink time into any single one.

What happened in practice: about 50 minutes and about 100 tool calls; all 15 shots found. The agent correctly rejected clips with burned-in "UNCLASSIFIED" text, "Courtesy of Natochannel" (unclear PD status) and a TV logo. It cropped a photographer's signature off a CC BY-SA image. It flagged substitutions: a Tomahawk launch standing in for a North Korean missile, and a 2022 Lviv fuel-depot fire standing in for Baltic sabotage. Those flags became `note` tags.

### A.2 Sound effects and music bed (only when the library lacks something)

> Source sound effects from the Openverse audio API (`https://api.openverse.org/v1/audio/?q=…`; anonymous is fine but space out requests). Use `license=cc0,by,pdm` (ONLY CC0, PDM or CC BY), `category=sound_effect` (or `music` for the bed), `length=short`. Each result has `url`, `license`, `license_version`, `creator`, `title`, `foreign_landing_url`, `duration`.
>
> Save as `public/library/sfx/<name>.mp3`, 44.1kHz stereo 192k, leading silence removed (`silenceremove=start_periods=1:start_threshold=-50dB`; use a lower threshold for slow risers), trimmed to the max length with a short fade-out, `loudnorm=I=-16:TP=-1.5:LRA=11` (bed: two-pass linear to I=-20, full length, ideally longer than the video). Needed: <whoosh ≤1.5s, whoosh2, impact ≤3s, riser 2–5s, glitch ≤1.5s, tick ≤0.5s, typing 2–4s, alarm ≤2s, bed ≥ video length; dark, tense, no vocals>. Verify each with ffprobe and `volumedetect` (mean > -45dB). Skip anything with speech. Write credits in the normalized format and report a table.

## Appendix B: thumbnail image-prompt pattern

Use this as an alternative to `npm run thumb` when the user wants a painted or photographic thumbnail from an image model. Fill it from `episode.json` and the theme:

```
YouTube thumbnail, 16:9, 1280x720. <mood> <topic> news-briefing style.
Background: <map or scene>, subtle grid and scanlines. Glowing <accent> alert pins
over <top 3–4 locations>, thin <accent> lines connecting them.
Right side: dramatic silhouette of <the #1 story's key subject>, backlit with
<accent glow>; <secondary subject> above. Smoke and haze, cinematic rim lighting,
high contrast.
Left side, huge bold condensed sans-serif text in stacked lines: "<big number or
keyword>" in <accent> with a soft glow, then "<title word>" in off-white. Below it a
<accent> horizontal bar, then smaller white monospace text: "<brand.dateLabel>".
Small "<brand.name>" label with a <accent> dot in the top-left corner.
Color palette: <theme colors with hex>. Film grain, vignette, slight glitch/RGB-split
on edges. Bold, readable at small sizes, uncluttered, no extra text.
```

Negative prompt: `blurry text, misspelled words, extra words, watermark, logos, flags, real people's faces, cartoon style, bright daylight, cluttered layout`.

Tell the user that image models often garble dates. The fallback is to generate without text and composite the text in the `Thumbnail` composition, using the generated image as its background visual.
