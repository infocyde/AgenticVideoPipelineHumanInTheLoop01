---
name: new-episode
description: Make one Brief Kit video episode from a source article, from intake and script through alignment, episode.json, licensed assets, check, preview and render. Use when the user asks for a new episode, video, countdown or weekly brief, or hands over an article or a voiceover for one.
---

# New episode

You take an article to a finished, licensed, loudness-mastered MP4 by writing **data and media only**. Read `CLAUDE.md` first: its hard rules apply at every step. Keep a running log in `episodes/<slug>/notes.md`.

There are three stops where you wait for the user: **script approval**, **the MP3**, and **preview approval / AC power**.

## 1. Intake

1. Get the article (a file path or pasted text).
2. Confirm with the user: format (`countdown` 10→1, `list` 1..N, or `short` for a **standalone YouTube Short**), item count, theme (default `threat-brief`), and the date label shown on screen (e.g. `OCT 2026` or `WEEK OF OCT 11–17, 2026`). A standalone Short follows this same procedure with the Short rules in section 8: `npm run new -- <slug> --format short [--count 1-3 scenes]`.
3. Pick a slug: `<YYYY-MM-DD>-<show>`, e.g. `2026-10-24-threat-brief`. Run:
   ```
   npm run new -- <slug> [--format list] [--count 5] [--theme clean-light]
   ```
4. Save the article verbatim to `episodes/<slug>/article.md`, replacing the placeholder.

## 1b. Fact-check the article

Articles are often AI-generated research reports, so check them before you script. Do this every episode, before the user sees a script.

1. List every figure and claim you plan to put in the script or on screen: dates, ranges, speeds, warheads, costs, production rates, counts, records, attributions, and "who did it first".
2. Dispatch **2–3 parallel research subagents**, each with one group of claims (e.g. one per system or topic). Ask each one to use WebSearch/WebFetch on reputable outlets (wire services, major papers, think tanks like CSIS/RUSI/ISW, trade press like Janes, official statements attributed as such) and to report a table: claim | verdict (confirmed / partly / wrong / unverified) | real figure | source title | URL | date. Have them also rate the article's own cited sources and flag anonymous or unsourced sites.
3. Rewrite with the results:
   - Replace wrong figures with verified ones.
   - Cut anything unverifiable.
   - Attribute contested or official claims ("the HUR says", "Moscow claims").
   - Give ranges where estimates conflict.
   - Add a line to the script saying where the figures come from, if they're mostly official claims.
4. Put every source the script now relies on in `episode.json` `sources`. Drop unreliable references from the article.
5. Log each change (article said → now says, with source) under a "Fact-check" heading in `notes.md`. These count as approved additions under the "facts come only from the article" rule. Show the user a short table of the main corrections with the script.

## 2. Script → `episodes/<slug>/voiceover.txt`

Shape (the scaffolded file shows it):

- **Cold open:** 3–4 short, punchy hook lines, each naming one concrete event. Then *"These are the N stories that defined this week."* (N spelled out).
- **Segments:** one paragraph each, starting with the marker sentence `Number ten.` … `Number one.` (countdown, least to most severe) or `Number one.` … (list). Two to four short sentences each.
- **Text sections (optional):** unnumbered paragraphs for an intro, a recap or a "what it means" wrap-up, placed anywhere among the segments. Each starts with a distinctive opening phrase that becomes its `marker` (e.g. *"First, the big picture."*). Not before the title line: the cold open ends at the first marker.
- **Outro:** starts *"Any one of these…"*, then *"That's the week."*, then a CTA line (*"Subscribe so you don't miss the next one."*).
- About **360 words for ~2:15**. Scale for other lengths at ~2.6 words a second.
- Write for the ear (TTS): spell out numbers and dates ("October twenty-fifth", "ninety percent", "two thousand"). Avoid symbols, abbreviations it may misread, parentheses and stage directions.
- **Every claim must be in the article or in the step 1b fact-check log.** List anything else you added (context, definitions) and ask the user to approve or cut it.
- Write with cues in mind: each stat you plan to show should be spoken with a distinctive word ("kiwifruit", "ninety", "halted"), and each b-roll cut should land on a distinctive phrase.

Optionally run `npm run align -- <slug> --estimate` and draft `episode.json` against the estimated timing, so the user can preview the layout before recording.

**Shorts:** if `config.yaml` has `shorts.enabled: true` (or the user asks for Shorts), write the Short scripts now too (section 8), so the user approves and records everything in one go.

**Stop.** Give the user the script (and any Short scripts) and wait for approval. Then read `config.yaml`:

- **`voice.enabled: true`:** voice it yourself: `npm run voice -- <slug>`. It writes `public/episodes/<slug>/voiceover.mp3` with the configured engine and voice, then runs align (step 3). Don't wait for an MP3. If it fails because the reference clip (`voices/narrator.wav`) is missing, tell the user (`voices/README.md` explains how to record one), or offer `--engine kokoro` for now.
- **`voice.enabled: false`:** wait for the user's MP3 at `public/episodes/<slug>/voiceover.mp3`.

## 3. Align

```
npm run align -- <slug>
```

- Every segment marker and the outro cue must show ✔.
- **Local TTS:** most mismatches are Whisper writing numbers as digits ("ten" becomes "10"), and those are fine. Look for real misreads in the report and `heard.txt` (a name said wrong, a dropped word). Respell the word in `voiceover.txt` for the ear and re-voice with `npm run voice -- <slug> --force`. Try `--seed <n>` for a different read of a flat or garbled line. Log respellings in `notes.md`.
- **Under 90% matched** usually means the recording differs from the script (lines changed in ElevenLabs, ad-libs). Read `episodes/<slug>/heard.txt` (Whisper's raw transcript), edit `voiceover.txt` to match **what was actually said** (keeping the script's spelling for names), and run align again. Captions must show what was said.
- If a marker is missing, the speaker probably said it differently ("Number 10" read as "Number ten" is fine; "At number ten" changes the marker). Fix `voiceover.txt` to match the audio, or change the `marker` in `episode.json`.

### 3b. Music bed (when `config.yaml` has `music_gen.enabled: true`)

Once the final voiceover is aligned, compose the bed with the **compose-music** skill: write a prompt that fits the theme and the subject, then `npm run compose -- <slug> bed --prompt "..."` (sized to the video, new random seed each run) and set `"audio": { "music": { "file": "bed", "level": 0.16, "duck": true } }`. If the user hands over their own track, use theirs instead. Log the prompt and seed in `notes.md`. Each Short composes its own bed the same way, with the parent's prompt.

## 4. Episode data → `episodes/<slug>/episode.json`

Replace every placeholder. The schema with docs is in `src/kit/schema.ts`; timing rules are in `CLAUDE.md`.

- `summary`: **always**, 1–2 sentences for the top of the YouTube description: what the video covers and its strongest specific fact (the #1 item, a key number). Facts from the article and fact-check log only, no hype words the script doesn't support, no hashtags. Write it now, while the facts are fresh; `npm run credits` puts it in `DESCRIPTION.md`, and `check` warns while it's missing.
- `brand`: carried from the last episode. Update `dateLabel`.
- `coldOpen.beats`: one per hook line. `cue` = the line's first words. A stamp beat gets `visual` + `stamp` (≤ 16 chars) + `sub`. One beat can be the map instead (`"map": "all-pins"`, `stamp` + `accent`, e.g. "EVERY" / "FRONT"). `title.cue` = "These are"; `title.bigCue` = "ten stories".
- Per segment:
  - `marker`: "Number ten".
  - `region`: uppercase place(s), e.g. "INDIA · NEW ZEALAND".
  - `headline`: ≤ 6 words, plain, from the article.
  - 1–2 `stats` with `value` (≤ 10 chars, e.g. "OCT 25", ">90%"), `label` (≤ 42 chars) and `cue` = the word spoken when the stat should pop.
  - `visuals`: 1–3 names. The first starts with the segment; each later one needs a `cue` on the phrase it illustrates. Never split evenly, which puts the wrong footage under the narration.
  - `map`: `bbox` [[w,s],[e,n]] around the places, `highlight` and optional `hostile` country names (world-atlas spelling), 1–3 `pins` with uppercase labels.
- Countdown: put `"emphasis": "top"` on #1.
- Text sections: an entry in `segments` with `"kind": "text"`, `marker`, optional `label` (≤ 28 chars, e.g. "INTRODUCTION"), `heading` (≤ 8 words), optional `body` (≤ 200 chars, one short paragraph summing up what's said, article facts only) and 1–4 `visuals` (cue rules as for segments). No number, stats or map.
- **Frontier** (`frontier`, the technology theme, "spatial" layout): b-roll floats in a glass window on the right and the stats become metric tiles under it that count up (3 visible at a time, the row slides on; 2–5 per segment read best, `check` warns above 6). A tile's `value` counts up when it is a quantity ("40M", "$20M", "97%"), and decodes when it is a year, a date or a name ("2023", "OCT 12", "H100"), so keep it short (≤ 10 chars) and put the meaning in `label` (it gets two lines). Headlines show **as written**, not forced to capitals: write them in sentence case ("Replika, the veteran"). Give each segment a `subhead` with the subject's plain name (≤ 32 chars, e.g. "GeForce RTX 5090") when the headline is a descriptor; it shows under the headline in cyan mono caps. The region is a small chip, so keep it short. Use the `tech` sound preset (`npm run new --theme frontier` sets it).
- **Split-layout themes** (`military-comparisons`, `erotic`): b-roll sits framed on the left and the stats build into a spec sheet on the right and stay up, so use more of them: one per spec the article gives (range, warhead, guidance, cost, production…). Five fit a panel; a sixth starts panel 2 (up to 3 panels). Keep `value` short ("1,500 KM", "GPS/INS", "$6–10K") and put the spec name in `label` ("RANGE", "UNIT COST"). The map card shows briefly over the footage and exits left.
- `outro.lines`: the first line has no cue ("ANY ONE COULD" + accent "BOIL OVER"); the next gets `cue: "That's the week"`. `cta.cue` = "Subscribe".
- `sources`: title and URL of each source the script relies on (required). Every video ends with a sources scene and a credits roll, both on by default (`outro.sourcesCard`, `outro.creditsCard`; only set `false` if the user asks). `npm run credits` also writes the sources to `out/<slug>/REFERENCES.md`.
- Optional: `outro.endScreen: { "seconds": 12 }` if the user wants YouTube end-screen slots. Use `thumbnail` to override the thumbnail text or background.

Run `npm run check -- <slug>`. Asset and license errors are expected at this point; fix everything else.

## 5. Assets

List the visuals `episode.json` needs and what each should show. Then dispatch **parallel subagents** with the prompts in [asset-prompts.md](asset-prompts.md):

- **A. Clips and images** (always), split across 2–3 agents if there are more than ~8 shots.
- **B. Sound effects and music** only when `check` reports a sound missing from `public/library/`, or the user asks for a new bed (with `music_gen.enabled: true` the bed is composed in step 3b instead of sourced). For a one-off effect the library lacks (a sonar ping, a heavier stamp, a radio blip), synthesizing it with `npm run sfx -- <slug> <name> --sound … | --recipe` is usually faster than sourcing it, and it needs no license check (`OWN WORK`).

The **find-media** skill (`.claude/skills/find-media/`) has the license gate, every source's tested API and the optional keys. The prompts point subagents to it, and you can use it directly for a single missing shot.

When they report back:

1. Review their tables. Every file needs a normalized `credits.json` entry with an allowed license.
2. Footage that isn't of the event described (a different place, year or weapon) gets a `note` on that visual: `"FILE FOOTAGE · <place>, <year>"`. Record it in `notes.md`.
3. If a shot couldn't be found, or the only licensed footage is a poor stand-in: for a beat about a number or a comparison, make an infographic with the **infographic** skill (`npm run infographic`). For a document or reference page (an infobox, an official notice), screenshot it with `npm run shot` (PD/CC pages only). Otherwise generate a still of the right subject with the **generate-image** skill (`npm run generate`), reuse another asset, or drop it (the segment falls back to its map). Generated images always get `"note": "AI-GENERATED ILLUSTRATION"`.
4. Run `npm run assets -- <slug>`, then `npm run check -- <slug>` until it reports **0 errors**. Look at the warnings too.

## 6. Preview, then render

**Never render before the user has watched the preview and approved it.**

1. Open the preview for the user yourself. Run it **in the background**, since it keeps running:
   ```
   npm run preview -- <slug>
   ```
   It runs `check`, starts Remotion Studio and opens the user's browser on this episode. Give the user the URL from the `preview ready:` line, and ask them to play it through with sound and tell you what to change. Studio shows any unresolved cue as a red panel over the video.
2. Apply their feedback in `episode.json` (and re-align if they re-record). Studio hot-reloads, so they just keep watching. Repeat until they approve.
3. Stop the preview (stop the background task, or `npm run kill`) so it doesn't compete with the render.
4. **Ask whether they're on AC power**; rendering takes several minutes at full GPU and CPU.
5. Run:
   ```
   npm run render -- <slug>
   npm run thumb -- <slug>
   npm run credits -- <slug>
   ```
   `render` fails unless `youtube.mp4` measures -14 ±1 LUFS with true peak ≤ -1 dBTP. If a render is interrupted, run `npm run kill`.
6. Check that `out/<slug>/DESCRIPTION.md` opens with the episode's `summary` (from `episode.json`). Never write the summary into `DESCRIPTION.md` by hand: `npm run credits` rewrites that file, so put any change in `episode.json` and run it again.

If the user wants a painted thumbnail instead, use the image-model prompt in [thumbnail-prompt.md](thumbnail-prompt.md).

## 7. Handoff

Tell the user:

- Paths: `out/<slug>/youtube.mp4` (upload this), `thumbnail.png`, `DESCRIPTION.md`, `REFERENCES.md`.
- Final loudness and true peak (printed by render).
- What to check by ear: names and numbers the TTS might mispronounce, and any sfx landing awkwardly.
- Every file-footage substitution and every approved claim beyond the article (from `notes.md`).
- Every AI-generated image, with a reminder to tick YouTube's "altered or synthetic content" box if any look realistic.

## 8. Shorts (optional)

YouTube Shorts are vertical (9:16, 1080×1920) and each one is its own small episode with its own script and voiceover, so every command works on it. Two kinds:

- **From an episode**, when `config.yaml` has `shorts.enabled: true` or the user asks: `npm run short -- <slug> [--count 1-3]` scaffolds `<slug>-short1`, `-short2`, … Each inherits the parent's theme, brand, music and sources, gets the parent's `article.md`, and has the parent's media hard-linked (no extra disk space) with its `credits.json`.
- **Standalone**: `npm run new -- <slug> --format short` (intake as usual, its own article and fact-check).

**Picking the Shorts** (from an episode, `shorts.count` of them): the strongest, most self-contained items: the #1 item, a striking number, a surprising contrast. Two related items can share one Short ("laser vs microwave"). Don't make a Short that only works with context from the full video.

**Script** (`episodes/<short>/voiceover.txt`), written at the main script's approval stop:
- At most `shorts.maxSeconds` (default 60 s, about 130 words at 2.6 words/s; check warns above it, and YouTube's hard limit is 3 minutes). 30–45 s is the sweet spot.
- Structure: a hook line in the first 2 s (no "welcome", no throat-clearing); a title line; 1–3 scenes, each starting with a distinctive marker ("First, …", "Second, …"); one outro line; a CTA ("Subscribe for the full briefing.").
- **Facts only from the parent's article and its fact-check log** (or the standalone Short's own fact-check), CLAUDE.md rule 2. Reuse the episode's checked wording wherever you can.
- Same ear rules as the main script: spell out numbers, no symbols.

**episode.json**: `summary` (1–2 sentences: the Short's one idea and its key fact; the description adds a link line to the full video and `#Shorts`), `coldOpen.beats` (1 hook beat: stamp ≤ 16 chars over a strong visual), `coldOpen.title` (kicker = brand, `big` ≤ 4 chars such as "#1" or "VS", `small` ≤ 2 short lines), `segments` (1–3 items or text sections, each with stats and 1–3 visuals; a `map` shows full-height first, then the b-roll), `outro` (1–2 lines + `cta`). `sourcesCard` and `creditsCard` stay `false`: on Shorts the sources and credits go in the description. File-footage `note`s and AI-image notes apply as usual.

**Then**, per Short: voice it (`npm run voice -- <short>` when local TTS is on, otherwise the user records `voiceover.mp3` alongside the main one), `npm run align`, `npm run assets`, `npm run check` (0 errors), and preview it with the main episode (`npm run preview -- <short>`; the user can approve them together). After approval and the AC-power question, `npm run render -- <short>` writes `out/<short>/youtube.mp4` and copies it to `out/<parent>/short<N>.mp4`. `npm run credits -- <short>` writes its description (link to the full video + `#Shorts`, sources, credits); no thumbnail (YouTube uses a frame).

**Hand off** each Short's path, length and description with the main episode, and log the picks and scripts in the parent's `notes.md`.

