# Music video format — design

Date: 2026-10-21 · Status: draft for approval

## Intent

The channel owner makes their own songs (credited as **Paranormal Threat Reduction Agency**, `OWN WORK`) and wants Brief Kit to turn a finished song file into a music video for YouTube. The video consists of licensed archive and news footage cut to the lyrics, plus some illustrated explainers, with the lyrics subtitled. The first song is `temp_input/PTRA - Empires (Plata o Plomo Power Mix).wav` (6:21, 48 kHz stereo WAV). Its imagery covers war, economics, laughing politicians and historical archive film.

Brief Kit today makes narrated news videos: an article becomes a script, the script is voiced, and the aligned words place everything on screen by spoken cues. A music video reuses that machinery: word alignment, cue placement, licensed-asset pipeline, credits, check/preview/render, loudness mastering. What changes is the source: **the song replaces the voiceover, and the lyrics replace the script**. There is no narration, no countdown/list structure and no news template.

## Goals

1. A new episode format, `"format": "music-video"`, that renders a full-frame, shot-by-shot video over the song, with optional lyric subtitles and an end credits roll.
2. A lyrics step that takes the song and the lyric sheet (when the user has one) and produces word-level timings. Cuts and subtitles land on sung words.
3. Cut points for instrumental passages, where there are no words to cue on, taken from detected beats.
4. A producer procedure (a new `music-video` skill) that goes from song file to rendered MP4: lyrics → shot plan → sourcing → explainers → check → preview → render, with user stops at the right places.
5. Existing formats and episodes keep working exactly as before.

## Non-goals (for now)

- Shorts or vertical 9:16 music videos.
- Karaoke-style word highlighting, animated lyric typography, audio visualizers, beat-reactive effects.
- Lip sync, performance footage, any shot of the band.
- Sound effects or a music bed under the song. The song is the only audio.
- Editing or remixing the song itself (trimming, fades, new intros).

## Anti-goals (failure even if it "works")

- **Subtitles that don't show what's sung.** CLAUDE.md rule 5 applies: the audio is the truth, the lyric sheet gets corrected to it, never the other way round.
- **Footage edited or arranged to look like a real record of something that didn't happen.** This covers putting words in a real person's mouth, AI imagery of real identifiable people, and passing off a generated still as a photo. Juxtaposition (a laughing politician cut against a war clip) is fine. That is what music videos do.
- **Breaking existing episodes.** Every current episode must still pass `npm run check` and render as before.
- **Licensing slippage.** Same gate as everything else: PD, CC0, CC BY, CC BY-SA, `OWN WORK`, AI-generated with provenance, opt-in `PRESS` (CLAUDE.md rule 3). No Pexels/Pixabay, NC, ND or editorial-only material. Every file goes in `credits.json`.

## Decisions made with the user

- **Format:** a new episode type, "music video", with no news template.
- **Lyrics source:** the user usually has the lyric sheet (Suno export). Transcription still runs on the audio, to check the sheet against what's actually sung and to get timings. When there's no sheet, the transcription becomes the draft lyrics for the user to correct.
- **Subtitles:** decided **per video** at intake. For "Empires": **on**.
- **Visuals:** found licensed footage chosen from the lyrics, plus **explainers in creative mode** (the explainer skill), rendered silent as b-roll. AI stills stay the existing last-resort fallback with their `AI-GENERATED ILLUSTRATION` note.
- **No "FILE FOOTAGE · place, year" tags** on music-video shots. A music video doesn't claim any clip shows a specific event, and the credits roll plus the description carry the sourcing. AI-generated stills **keep** their `AI-GENERATED ILLUSTRATION` note (CLAUDE.md rule 3 is unchanged for those).
- **"Do it" = drop the tags.** The user answered "do it" to the file-footage question; read as accepting the recommendation. Confirm when approving this doc.
- **Song credit:** `OWN WORK`, author "Paranormal Threat Reduction Agency" (from the user's memory record; confirm per song at intake).

## The pipeline

### 1. Scaffold

`npm run new -- <slug> --format music-video --song <path>`

- Copies the song into `public/episodes/<slug>/` (the builder picks the file name, e.g. `song.wav`; converting to a smaller lossless/high-bitrate file is fine if Remotion handles WAV poorly).
- Writes a placeholder `episode.json` (shape below), an empty lyrics file, `notes.md`, and a `credits.json` with the song's `OWN WORK` entry.
- Optional flags for title/artist. Otherwise the title is taken from the file name and the artist defaults to the last music video's.

### 2. Lyrics: `npm run lyrics -- <slug>`

Input: the song plus `episodes/<slug>/lyrics.txt`. The producer pastes the user's sheet into that file. Sheet conventions to support:

- Section tags in brackets, like `[Chorus]` and `[Verse 1]`, plus production tags like `[base line]` and `[power ballad]`. They are never sung. Keep them for the plan, strip them for alignment and subtitles.
- **One line in the file = one subtitle line.** A blank line separates stanzas.
- Repeated choruses are written out in full each time they're sung, so every sung word has exactly one place in the file.
- **Parentheses** mark echoes and backing vocals, e.g. "Empires Go (go go go)". *(Builder-check call.)* The words in parentheses count as sung, in order after the words before them. They are aligned and subtitled like any other words when the audio has them; if the audio doesn't, the lyrics step removes them. **Overlapping vocal parts are a non-goal.** There is one vocal line in order. Where two parts sing at once, the sheet holds the lead and the other part is left out of the subtitles. "Empires" has no known overlaps.
- **Language** *(builder-check call)*: the "Empires" sheet is English. Use a multilingual Whisper model (not `medium.en`) so short non-English ad-libs (the mix title is Spanish) show up in `heard.txt` instead of being garbled, and so later songs in other languages work.

Steps:

1. **Separate the vocals** (Demucs or equivalent) into a vocal stem. It's a working file, not rendered, and lives outside `public/` or is git-ignored. Whisper on a full dense mix (death-metal/techno/operatic here) is unreliable. On the stem it's usable.
2. **Transcribe** the stem with Whisper word timestamps and write `heard.txt`, as `align` does today.
3. **Align the sheet's words to the audio.** Write `timing.json` in the existing format (`words[]` with start/end) so cue matching works unchanged, plus enough to know which subtitle line each word belongs to.
   - Whisper + difflib, as in `scripts/align.py`, is the baseline. A forced aligner given the known text (e.g. torchaudio's MMS forced alignment on the stem; `.venv-music` already has torch/torchaudio 2.7.1 with CUDA) is likely far more accurate for singing. **Builder's call** after trying both on "Empires".
   - Report the match rate and every stretch where the heard words and the sheet disagree. Those are where the singer departs from the sheet (ad-libs, repeats, cut lines). The producer shows the user these differences and fixes `lyrics.txt` to match the audio.
4. **Detect beats** (and downbeats if feasible) over the whole mix and write them to a file in the episode (e.g. `beats.json`: times in seconds, an index per beat, tempo). Print a short map of the song: sections from the tags, where each starts, and the beat index range of each instrumental stretch.
5. When `lyrics.txt` is empty, write the transcription into it as a draft (one Whisper segment per line) and tell the producer to get it corrected by the user.

New Python dependencies go in a setup step (`npm run setup:lyrics`, or an extension of `setup:align`). Reuse `.venv-music` (it has torch and CUDA) or make a new venv: **builder's call**. The GPU is an RTX 4070 Laptop, 8 GB.

### 3. Episode data: `episode.json` for a music video

A music video doesn't fit the current `episodeSchema`, which requires `coldOpen`, numbered `segments` and `outro`. Make the schema accept a second shape selected by `format: "music-video"`, for example a discriminated union on `format`. Keep the existing shape and its JSON-schema autocomplete intact. Field names below are proposals; the builder may rename them for consistency with `schema.ts`.

```jsonc
{
  "$schema": "../episode.schema.json",
  "slug": "2026-10-21-empires",
  "format": "music-video",
  "title": "Empires (Plata o Plomo Power Mix)",
  "summary": "1–2 sentences for the YouTube description.",
  "theme": "threat-brief",                 // fonts/colors for subtitles, title card and credits
  "song": { "file": "song.wav", "title": "Empires", "subtitle": "Plata o Plomo Power Mix", "artist": "Paranormal Threat Reduction Agency" },
  "subtitles": true,                        // per-video choice from intake
  "titleCard": { "seconds": 4 },            // song title + artist over the first shot; false = none
  "shots": [
    { "visual": "jekyll_island_club" },                         // first shot starts at 0
    { "visual": "ww1_trenches", "cue": "First European" },      // cuts on a sung phrase
    { "visual": "irs_1913_form", "cue": "Income", "in": 2.5 },  // `in`: seconds into the clip to start from
    { "visual": "bassline_glitch", "beat": 412 },               // instrumental: cuts on beat #412 from beats.json
    { "visual": "factory_explainer", "cue": "To asia", "subtitles": false } // hide subtitles over an explainer's own text
  ],
  "credits": { "seconds": 10 },             // credits roll; see "End of the video"
  "thumbnail": { "visual": "…", "frame": 3.2 },
  "sources": []                              // usually empty; filled only if any on-screen text states facts
}
```

Rules:

- **Every shot after the first has exactly one of `cue` or `beat`.** Cues use the existing matching rules (case/accent-insensitive, last word may be a prefix) against the lyric words, searched **in order through the whole song**. Each cue is found after the previous shot's cue. This matters because choruses repeat: "Managed Freedom" matches the next chorus each time. `beat` is an index into the episode's beat file and must be greater than the previous shot's time. Mixing the two in order is normal.
- Shots cut slightly before their word (the existing `LEAD`), so cuts land on the syllable.
- A shot lasts until the next shot starts. The last one runs until the credits.
- `in` is the clip in-point. If the clip runs out before the shot ends, slow it down, hold it, or loop it, as the current `Backdrop` does. Check warns.
- Optional per-shot `transition` (hard cut by default; a short flash/glitch/fade) is **builder's call**. A hard cut on the beat is the core.
- Optional per-shot `note`, only for `AI-GENERATED ILLUSTRATION` (or anything the producer must flag). No file-footage notes.

### 4. Rendering

A `MusicVideo` format component, next to `Countdown`/`List`/`Short`, chosen in `Episode.tsx`:

- **Picture:** each shot full-frame, 16:9 1920×1080, 30 fps. Clips are muted; stills get gentle motion (existing Ken Burns). Reuse `Backdrop`'s handling of clips and images where it fits. No top bar, ticker, number slams, maps, stats or headlines.
- **Subtitles** (when `subtitles: true`): one lyric line at a time, from the line structure of `lyrics.txt`, in the lower part of the frame. Use the theme's body font with a shadow or scrim for legibility over any footage. Each line appears when its first word is sung and clears shortly after its last word, or when the next line starts. Long lines wrap to two rows. No per-word highlighting. Hidden over shots with `subtitles: false`.
- **Title card:** song title, subtitle and artist over the opening shot for `titleCard.seconds`, styled by the theme.
- **Audio:** the song only, at full level. No sfx preset, no bed, no ducking. Mastering to -14 LUFS / ≤ -1 dBTP stays as is (`render` → `youtube.mp4`). A mastered song will mostly be turned down, which is fine.
- **End of the video:** the credits roll uses the existing `CreditsCard` data: footage and images, AI illustrations, music (the song as `OWN WORK`). With 50+ sources it must still be legible. Builder's call: paginate, scroll, or roll over the song's last seconds. By default the roll comes after the song ends. If the song ends in a long instrumental tail, the producer may start the roll on a cue or beat inside it (`credits.cue` / `credits.beat`) so the video doesn't end in silence. No sources card unless `sources` is non-empty.
- **Thumbnail** (`npm run thumb`): a frame or still from `thumbnail.visual` with the song title and artist in the theme.

### 5. Check, preview, credits

`npm run check` for a music video reports:

- shots whose `cue` isn't found in order, or `beat` out of range or out of order
- missing visuals and licenses, as today
- shots shorter than ~0.4 s (error) or longer than ~12 s (warning)
- clips shorter than their slot from the in-point (warning)
- a lyric-alignment match rate under a threshold (warning, threshold builder's call), and estimated timing (error)
- subtitle lines longer than fit two rows (warning)

`npm run preview` and `npm run render` work unchanged. `npm run credits` writes `DESCRIPTION.md`: the summary, a song credit line ("Music: Empires (Plata o Plomo Power Mix) by Paranormal Threat Reduction Agency"), the **full lyrics** (no tags), and the media credits.

### 6. Producer procedure: new skill `.claude/skills/music-video/SKILL.md`

Stops where the producer waits for the user are marked **STOP**.

1. **Intake:** song file, lyric sheet if any, theme, subtitles on/off (**ask every time**), title card wording, artist name. Slug `<date>-<song>`. `npm run new -- … --format music-video --song …`.
2. **Lyrics:** paste the sheet into `lyrics.txt`. Fix obvious spelling for display: for "Empires", hallowed → hollowed, "smiles son TV" → "smiles on TV", "Your at" → "You're at", "it's bite" → "its bite", Nickle → Nickel. Log the changes in `notes.md`. Run `npm run lyrics`. **STOP:** show the user every place the sung audio differs from the sheet, then correct `lyrics.txt` to the audio and re-run.
3. **Shot plan:** a table with one row per shot: time, lyric line (or "instrumental, beats N–M"), what's on screen, likely source (archive, DVIDS, NARA, Commons…) or "explainer". Pacing follows the song: roughly one shot per lyric line, faster in dense passages, cuts every 1–2 bars in instrumentals. The same source clip may return at different in-points. Pick 2–4 lines for **creative-mode explainers** (the producer chooses which, per the explainer skill's creative mode). **STOP:** the user approves the plan.
4. **Sourcing:** the existing find-media subagents, driven by the plan, with the usual license gate and `credits.json`. Historical imagery is mostly PD: National Archives, Library of Congress, Prelinger/Internet Archive PD films, DVIDS, White House and Congressional video. Real politicians laughing come from PD government video (White House, Congress, DoD). Fallbacks per the existing rules (infographic, screenshot, AI still with note).
5. **Explainers:** creative mode, storyboard approval per the explainer skill (**STOP** per storyboard unless the user waives it), rendered silent with `npm run infographic -- <slug> <name> --seconds <slot+2>`.
6. **episode.json → assets → check** (0 errors).
7. **Preview (STOP for approval) → AC power question → render → thumb → credits**, as for episodes.

**Facts in a music video.** The lyrics are the artist's words and aren't fact-checked; they're art and opinion. Any **on-screen text the video adds** must be true and sourced in `notes.md` and `sources`: an explainer's dates and figures, a caption, a year. Examples: "1913: 16th Amendment" or "National Security Act, 1947". This applies to explainers especially. An explainer for "Gold at forty thousand" may show the lyric's number as the lyric's projection, but must not present it as a current price.

### 7. Docs to update

- `CLAUDE.md`:
  - Add the format to the commands list and add `npm run lyrics`.
  - Rule 2: for a music video, the lyrics stand in for the article, and any added on-screen facts need sources.
  - Rule 3: no file-footage notes on music videos; the AI-image note still applies.
  - Rule 6: handoffs for music videos are lyrics confirmation, plan approval and preview approval; no voice step.
- `README.md`: a short section on music videos.
- `new-episode` skill: one line pointing music videos to the `music-video` skill.

## What's left to the builder

- Exact schema mechanics (union vs separate schema), field names, and where the per-line subtitle structure is stored.
- Vocal separation tool and model; alignment method (Whisper+difflib vs forced alignment); beat-tracking library; which venv.
- Subtitle styling details and safe-area placement; title-card design; transitions beyond a hard cut.
- Credits-roll layout for many entries.
- Thresholds in `check`.
- Whether `scripts/lib/check.ts`, `resolve.ts`, `credits.ts` and `sync.ts` branch on format or get music-video siblings.

## Done means

- `npm run typecheck` passes. Every existing episode still passes `npm run check` with the same result as before the change.
- A music video can be scaffolded, aligned, checked, previewed and rendered end to end. Proven by the "Empires" episode: lyrics aligned on the real song, at least a handful of real licensed shots and one explainer placed by cue and by beat, subtitles in sync in the preview, and the render passing mastering.

## Appendix: "Empires" lyric sheet (as given by the user, 2026-10-21)

Suno V5 export, verbatim, including its spelling. The display spelling fixes are listed in pipeline step 6.2. The sung Power Mix may differ from this sheet, which is what the lyrics step checks. Style prompt from the export: *melodic acid pads complex drums death metal techno dark goth industrial cyberpunk progressive metal, distorted trance, goth 80s metal operatic singer.*

```
[Verse 1]
Jekyll Island,
First European War
Income Taxes
World War 2
Pax Americana
National Security State
The root sets in

[Chorus]
Managed Freedom
See how free you are
Two choices out of Millions
Vote, get a star
How long will it last?
Who can know
Empires Come,
Empires Go

[Verse 2]
Bankers in control,
Labor is the new gold
To asia we go
domestic factories close
The biggest export now is our jobs
to other nations

[Verse 3a]
Inflation takes it's bite
Higher taxes
Nickle and Dime
The Great Divide
Smell the Freedom
More fees for thee
But None for me

[Verse 3b]
Policing the borders
of the world
everywhere but here
Sons fight and die for others
in places most can't find on a map

[Chorus]
Managed Freedom
See how free you are
Two choices out of Millions
Vote, get a star
How long will it last?
Who can know
Empires Come,
Empires Go

[Bridge]
You thought you were free
Your nation hallowed out
The smiles son TV
Keep you from figuring it out
As they take your wealth
Your health
Your lives
While you saved the world
You were conquered from the inside

[Chorus]
Managed Freedom
See how free you are
Two choices out of Millions
Vote, get a star
How long will it last?
Who can know
Empires Come,
Empires Go

[Verse 4]
Gold at forty thousand
Your lunch at five k
Your at half ration
Do your part
For the Fighting in Asia
Power is out
Stocks at all time highs
The dollar's value dwindles
Instability, insurrection
The nation disintegrates
dies

[base line]

[Verse 6]
Rich have their fortress towns
Or moved

The ancient pattern repeats
Transition Time
Keep your head down
Stay alive

[Outro]
How long will it last?
Who can know
This one will be rough
But remember
Empires come
Empires Go (go go go)

[power ballad]
```
