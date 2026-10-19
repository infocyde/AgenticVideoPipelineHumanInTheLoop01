# Brief Kit: producer playbook

This repo turns an article plus a voiceover into a short narrated YouTube video (Remotion). You are the **producer**: you make one episode at a time by filling one episode folder with **data and media only**.

**To make an episode, use the `new-episode` skill** (`.claude/skills/new-episode/SKILL.md`). It has the full step-by-step procedure and the asset-sourcing prompts. This file holds the rules that apply at every step.

## Hard rules

1. **Never edit `.tsx`, `src/kit/**` or `scripts/**` to make an episode.** If something can't be expressed in `episode.json`, tell the user what's missing; don't patch a component. The only files you write are under `episodes/<slug>/` and `public/episodes/<slug>/`.
2. **Facts come only from the article** (`episodes/<slug>/article.md`), **as corrected by the fact-check** (step 1b of the `new-episode` skill: verify the article's figures on the web before scripting, replace wrong ones with sourced figures, cut what can't be verified, and log every change in `notes.md`). Narration and on-screen text (headlines, stats, stamps, regions, outro) must not go beyond these. If you want added context (a date, a definition, background), flag it to the user and get approval. Record approved additions in `notes.md`.
3. **Licenses: PD, CC0, CC BY or CC BY-SA only** (plus `OWN WORK` for material the user made or owns, e.g. their own music, credited as they specify), and every media file needs a `credits.json` entry. No NC, ND, "editorial use only" or unknown licenses. No Pexels or Pixabay. If footage isn't of the event described, give that visual a `note` ("FILE FOOTAGE · LVIV, UKRAINE, 2022") and tell the user. Web-page screenshots (`npm run shot`) follow the same rule: the page must be PD, CC0, CC BY or CC BY-SA (Wikipedia text is CC BY-SA), never a commercial news site, and photos or logos on the page need their own license or must be cropped out. Infographics from `npm run infographic` are credited `OWN WORK`, and their numbers must come from the script and fact-check. The one exception is stills from `npm run generate` (FLUX 3), which are credited as `AI-GENERATED`. They're a fallback when licensed footage is missing or a poor stand-in, follow the **generate-image** skill's rules (no real identifiable people, no fake record of a specific event, never a copy of a specific photo), and always carry `"note": "AI-GENERATED ILLUSTRATION"`.
4. **`npm run check -- <slug>` must show 0 errors before rendering.** Fix the cause; don't work around it. `render` refuses to start otherwise.
5. **Captions show what was said.** If the recording differs from `voiceover.txt`, update `voiceover.txt` to match the audio (see `heard.txt`) and re-run align. Never the other way round.
6. **Wait for the user** at the three handoffs: script approval, the recorded MP3, and preview approval.
7. **Preview before every render.** Right before rendering, run `npm run preview -- <slug>` in the background; it opens the user's browser on the episode in Remotion Studio. Wait until they've watched it and approved, stop the preview, ask whether they're on AC power, and only then run `npm run render`.

## Commands (all take the episode slug)

```
npm run new -- <slug> [--format countdown|list] [--count N] [--theme threat-brief|clean-light|after-dark|military|military-comparisons|erotic]
npm run align -- <slug> [--estimate]      # timing.json from voiceover.mp3 (or rough, from text only)
npm run assets -- <slug>                  # assets.json from clips/, images/, library sfx/music
npm run generate -- <slug> <name> --prompt "..."   # last-resort FLUX 3 still (see generate-image skill)
npm run shot -- <slug> <name> --url <url> [--selector "<css>"] [--license PD]   # web-page screenshot still (PD/CC pages only)
npm run infographic -- <slug> <name> [--still]     # render episodes/<slug>/infographics/<name>.html (see infographic skill)
npm run check -- <slug>                   # 0 errors required
npm run preview -- <slug>                 # check, start Studio, open the browser on this episode (run in background)
npm run render -- <slug>                  # only after the user approves the preview -> out/<slug>/youtube.mp4
npm run thumb -- <slug>                   # out/<slug>/thumbnail.png
npm run credits -- <slug>                 # out/<slug>/DESCRIPTION.md
npm run kill                              # stop leftover render processes from this repo
```

## How timing works (read before writing episode.json)

- `timing.json` = every word of `voiceover.txt` with its audio time. Everything on screen is placed by **cues**: short spoken phrases from the script, never seconds.
- Cue matching: case- and accent-insensitive, punctuation ignored. All words must match exactly except the last, which may be a prefix ("kiwi" → "kiwifruit"). Pick cues that are distinctive and spoken where the event should happen.
- Search order is strict, and `check` errors if a cue isn't where it should be:
  - Segment `marker`s are found in order through the whole script. The outro `cue` comes after the last marker.
  - Cold-open beat cues and `title.cue` are found in order before the first marker. `title.bigCue` is found inside the title line.
  - Text sections (`"kind": "text"` entries in `segments`) have a `marker` too, found in the same order as the numbered segments; they don't use up a number.
  - Stat cues are found in order inside their segment, after the marker. Visual cues (every visual after the first needs one) are also found in order inside their segment, independently of the stats.
  - Outro line cues are found in order after the outro cue (the first line can omit its cue), then the CTA cue.
- Scenes cut 0.12s before their marker, so the number slam lands on the word.

## Where things are

- Schema with every field documented: `src/kit/schema.ts`. Each `episode.json` gets autocomplete from `episodes/episode.schema.json`.
- Text limits: `LIMITS` in `scripts/lib/check.ts`, e.g. headline ≤ 6 words, stamp ≤ 16 chars, stat value ≤ 10 chars.
- To add a one-off sound on a spoken cue, use `audio.sfxExtra` (`{ "sfx": "glitch", "cue": "...", "volume": 0.45 }`). To silence one preset sound for an episode, list its event in `audio.sfxOff` (e.g. `["stampBeat"]`; events are `SFX_EVENTS` in `src/kit/schema.ts`).
- Shared sounds and the music bed: `public/library/` (`sfx/`, `music/`, `credits.json`). Available sfx: alarm, glitch, impact, riser, tick, typing, whoosh, whoosh2. Music: bed.
- Map country names must match world-atlas 110m (e.g. "United States of America", "Dem. Rep. Congo", "Bosnia and Herz."). `check` warns and suggests names.
- Every video ends with a **sources scene** and a **credits roll** (on by default; `outro.sourcesCard` / `outro.creditsCard`). So `sources` in `episode.json` must list what the script relies on, and every media file must be in `credits.json`; the roll is built from it.
- Human docs: `README.md`.
