# Brief Kit

A template for short, narrated countdown and list videos (Remotion + React). Each video is an **episode**: one folder of data and media. The components, scenes, sound design, captions, mastering and checks are already built, so making an episode never means editing a `.tsx` file.

```
article  ──►  fact-check  ──►  voiceover.txt  ──►  (you record) voiceover.mp3  ──►  align  ──►  episode.json + media  ──►  check  ──►  render
```

## Working with Claude (the usual way)

Brief Kit is built to be run with [Claude Code](https://claude.com/claude-code) as your production partner. **You bring two things: the article and the voiceover.** Claude does the rest and stops at three points for your decision.

| Step | You | Claude |
|---|---|---|
| 1. Intake | Paste the article text (or a file path) and say *"let's start a new episode"*. Answer a few questions: format, item count, length, theme. | Scaffolds the episode and saves the article. |
| 2. Fact-check | — | Sends research agents to check every figure against reputable sources. Wrong numbers are replaced with sourced ones, unverifiable claims cut, and the sources list rebuilt. Every change goes in `notes.md`. |
| 3. Script | **Approve** the script, or ask for changes. | Writes `voiceover.txt` for text-to-speech, with a table of what the fact-check changed. |
| 4. Voiceover | Record the script (e.g. ElevenLabs) and drop the MP3 in the episode folder. Optionally add your own music track (`.wav` or `.mp3`). | Moves the MP3 into place, aligns every word to the audio, and builds a music bed from your track. |
| 5. Build | — | Writes `episode.json` and sends sourcing agents for licensed b-roll (PD / CC0 / CC BY / CC BY-SA only). Generates a labeled FLUX still for any shot it can't find, and runs `check` until it reports 0 errors. You can set the rules: "favor Russian footage", "cap the search at 45 minutes". |
| 6. Preview | **Watch** the preview Claude opens in your browser and say what to change. | Applies the changes live in Remotion Studio. |
| 7. Render | **Approve**, and confirm you're on AC power. | Renders, masters to YouTube loudness, and writes the thumbnail and `DESCRIPTION.md`. |

Then upload `out/<slug>/youtube.mp4` with the thumbnail and description. If an episode uses AI-generated stills, tick YouTube's "altered or synthetic content" box.

`CLAUDE.md` holds the rules Claude follows at every step, and `.claude/skills/new-episode/` holds the full procedure. Step away whenever you like: tell Claude to make its best calls, and it logs each decision in `notes.md` for you to review.

### Starting a session

```powershell
cd brief-kit
claude                    # or open the folder in VS Code with the Claude Code extension
```

Then paste the article and say *"let's start a new episode"*.

### Just ask in plain words

You don't need the commands, slugs or file paths in the rest of this README. Claude picks the slug, runs the `npm` commands, and finds the right episode from context. Say what you want:

- *"Let's start a new episode"* (then paste the article)
- *"Make it the top 5, about 5 minutes, same look as the last one"*
- *"Verify those facts on the web and update the sources"*
- *"I added the voice MP3 and a music track"*
- *"Favor Russian footage, cap the search at 45 minutes, and use FLUX for anything you can't find"*
- *"Make an infographic comparing the ranges for the Geran segment"*
- *"Screenshot the Wikipedia infobox for the Shahed as b-roll"*
- *"The artillery shot in the Lancet segment runs too long, use a Lancet clip"*
- *"Open the preview"* / *"Render it"*
- *"Re-render last week's episode with a new thumbnail"*

To come back to an older episode, describe it (*"the Russian drone one"*). Claude lists the episodes and picks the match.

---

## One-time setup

You need Node 22, ffmpeg on `PATH`, Python 3.10+ (for alignment and the image lead finder), and Claude Code.

```powershell
npm install
npm run setup:align      # creates .venv and installs requirements.txt; the Whisper model (~1.5 GB) downloads on first align
copy .env.example .env   # optional: add REPLICATE_API_TOKEN for the AI-image fallback (see the comments in the file)
```

Python packages are pinned in `requirements.txt`: faster-whisper and numpy for `align`, and ddgs for the find-media skill's DuckDuckGo lead finder. To install them by hand, run `.venv\Scripts\python.exe -m pip install -r requirements.txt`. `npm run shot` and `npm run infographic` drive the headless Chrome that Remotion already downloads (through `playwright-core`), so they need no extra browser.

The rest of this README is reference: the commands and files Claude uses at each step. You only need it to see how things work, or to run a step yourself without Claude.

## Make a new episode

Slugs are lowercase with dashes. Start them with the date so they sort: `2026-10-24-threat-brief`.

### 1. Scaffold

```powershell
npm run new -- 2026-10-24-threat-brief                       # countdown, 10 segments, theme threat-brief
npm run new -- 2026-10-24-tech-five --format list --count 5 --theme clean-light
```

This creates:

| Path | What it is |
|---|---|
| `episodes/<slug>/episode.json` | Everything on screen: brand, cold open, segments, stats, maps, visuals, outro |
| `episodes/<slug>/voiceover.txt` | The script, word for word as it will be spoken |
| `episodes/<slug>/article.md` | The source article: the fact-check reference for every claim |
| `episodes/<slug>/notes.md` | Working notes (substitutions, things to verify) |
| `public/episodes/<slug>/` | Media: `voiceover.mp3`, `clips/`, `images/`, `credits.json`, plus generated `timing.json` and `assets.json` |

The new episode is a complete placeholder that previews straight away in `npm run dev`. Brand, theme and audio settings carry over from your latest episode of the same format.

### 2. Article and script

1. Save the source article to `episodes/<slug>/article.md`.
2. **Fact-check it.** Articles are often AI-generated research reports, and they get numbers wrong. Check every figure you plan to use against reputable sources. Replace wrong ones with sourced figures, cut what you can't verify, attribute official claims ("Moscow claims…"), and list the sources you actually rely on in `episode.json` `sources`. Log each change in `notes.md`.
3. Write `episodes/<slug>/voiceover.txt` in this shape:
   - **Cold open:** 3–4 short hook lines, then *"These are the ten stories that defined this week."*
   - **Segments:** paragraphs starting `Number ten.` … `Number one.` (countdown, least to most severe) or `Number one.` … `Number five.` (list).
   - **Outro:** starts *"Any one of these…"*, then a CTA line such as *"Subscribe so you don't miss the next one."*
   - About 360 words is roughly 2:15. Spell out numbers and dates the way they should be read ("October twenty-fifth", "ninety percent"). No stage directions.
   - Don't state anything that neither the article nor your fact-check supports.
4. Optional: `npm run align -- <slug> --estimate` gives rough timing from the text alone, so you can preview the layout before recording.

### 3. Record and align

1. Record or generate the voiceover (e.g. ElevenLabs) and save it as `public/episodes/<slug>/voiceover.mp3`.
2. Run:

   ```powershell
   npm run align -- <slug>       # ~3 min on CPU for 2:15 of audio
   ```

   It prints how many script words matched the audio, plus the time of every segment marker. Under 90% means the recording differs from the script (for example, you edited lines in ElevenLabs). Whisper's transcript is saved to `episodes/<slug>/heard.txt`. Edit `voiceover.txt` to match what was actually said and align again. Captions use the script's own words, so they must match the audio.

### 4. Fill in `episode.json`

Timing comes from **cues**, not seconds. A cue is a short phrase from `voiceover.txt` ("Number ten", "kiwifruit", "That's the week"). Matching ignores case and accents, and the last word can be a prefix ("kiwi" matches "kiwifruit"). The search runs forward through the script: stats and visual cuts are searched inside their own segment, in order.

```jsonc
{
  "marker": "Number three",                  // spoken phrase that starts the segment
  "region": "PACIFIC · PANAMA CANAL",
  "headline": "A monster El Niño is coming",   // ≤ 6 words; font size auto-fits to ≤ 3 lines with no orphan word
  "stats": [{ "value": ">90%", "label": "Odds of a very strong El Niño", "cue": "ninety" }],
  "visuals": [
    { "name": "earth" },                       // first visual starts with the segment
    { "name": "drought", "cue": "drought" }    // later ones cut on their cue
  ],
  "map": {
    "bbox": [[-170, -30], [-60, 30]],          // [[west, south], [east, north]]
    "highlight": ["Panama"],                   // world-atlas country names ("United States of America")
    "pins": [{ "lon": -79.7, "lat": 9.1, "label": "PANAMA CANAL" }]
  }
}
```

Every field is documented in `src/kit/schema.ts`. Editors that read JSON Schema (VS Code does) show hover docs and autocomplete, because each `episode.json` points at `episodes/episode.schema.json`. Optional extras:

- `"emphasis": "top"`: alarm treatment and a "TOP THREAT" badge (usually on #1).
- `"note": "FILE FOOTAGE · LVIV, 2022"` on a visual: an on-screen tag for footage that isn't of the event described.
- **Every episode ends with a sources scene and a credits scene.** After the voiceover, a "SOURCES" card lists `sources` (title + site) for 7s. Then a "CREDITS" roll built from `credits.json` (footage, images, AI illustrations, music, sound, map data) runs for 8s, listing only what the episode actually uses, the same as `DESCRIPTION.md`. Change the lengths with `"outro": { "sourcesCard": { "seconds": 7 }, "creditsCard": { "seconds": 8 } }`, or turn one off with `false`. `check` fails an episode with no `sources` while its sources card is on.
- `"outro": { "endScreen": { "seconds": 12 } }`: a branded hold frame after the voiceover (and after the sources card, if any), with empty slots for YouTube's end-screen elements.
- `"thumbnail": { "big": "10", "title": "FLASH\nPOINTS", "visual": "gulf_navy" }`
- `"audio": { "music": { "file": "bed", "level": 0.22, "duck": true }, "sfxPreset": "intense" | "calm" | "none" }`

### 5. Media and licenses

- B-roll clips go in `public/episodes/<slug>/clips/<name>.mp4`: 1920×1080 H.264, no audio, ≤ 8s, no watermarks or burned-in text. Stills go in `images/<name>.jpg`. `name` is what `episode.json` refers to.
- **Every file needs an entry in `public/episodes/<slug>/credits.json`**, and only PD, CC0, CC BY and CC BY-SA licenses are allowed:

  ```json
  { "file": "clips/drone.mp4", "title": "MQ-9 Reaper aerial video", "author": "Senior Airman Haley Stevens",
    "license": "PD", "sourceUrl": "https://commons.wikimedia.org/wiki/File:..." }
  ```

  Optional fields: `licenseVersion` ("4.0"), `originalUrl`, `notes`.
- **No good image anywhere, or only a poor stand-in?** Generate a still with FLUX 3 via Replicate:

  ```powershell
  npm run generate -- <slug> tanker_dusk --prompt "Oil tanker at anchor at dusk, subject on the right third, empty space on the left, muted colors, documentary photography. No text, no logos, no flags, no identifiable people."
  ```

  This needs `REPLICATE_API_TOKEN` in the environment or in a `.env` file in this folder or a parent folder. It writes `images/<name>.jpg` (1920×1080) and a credits entry with license `AI-GENERATED`, plus the exact prompt and prediction id. A generated visual must carry `"note": "AI-GENERATED ILLUSTRATION"` (check enforces this). If it looks realistic, tick YouTube's "altered or synthetic content" box when uploading. Each run is a paid API call. Prompt rules are in `.claude/skills/generate-image/SKILL.md`.
- **A web page as b-roll** (an encyclopedia infobox, an official notice, a data table): screenshot part of it.

  ```powershell
  npm run shot -- <slug> wiki_shahed --url https://en.wikipedia.org/wiki/HESA_Shahed_136 --selector "table.infobox"
  npm run shot -- <slug> dod_notice --url https://www.defense.gov/News/... --license PD --author "U.S. Department of Defense" --scroll-to "h1" --highlight "one-way attack"
  ```

  It writes `images/<name>.png` (1920×1080) and a credits entry with the page as the source. By default the capture sits centered on a blurred copy of itself; `--fit cover` and `--fit raw` are the alternatives. The page has to meet the same license rules as any media: PD, CC0, CC BY or CC BY-SA. Wikipedia text is filled in as CC BY-SA 4.0 automatically. Every other site needs `--license`, plus `--author` for CC BY and CC BY-SA. Commercial news sites are not allowed. Photos and logos on a page carry their own licenses, so crop them out or check them. Other options: `--clip x,y,w,h`, `--full`, `--hide "<css>"` (cookie banners are hidden by default), `--width`/`--height` (a narrower viewport gives bigger text) and `--dark`. Give the visual a `note` naming the site, e.g. `"SOURCE · EN.WIKIPEDIA.ORG"`.
- **An infographic** (bar comparison, big number, timeline, versus card): write a small HTML page in `episodes/<slug>/infographics/<name>.html`, starting from `.claude/skills/infographic/template.html`, and render it in the episode's theme:

  ```powershell
  npm run infographic -- <slug> range_bars             # clips/range_bars.mp4, 12 s: animates in, then holds
  npm run infographic -- <slug> range_bars --still     # images/range_bars.png
  ```

  The page gets the theme's colors and fonts as CSS variables (`--accent`, `--highlight`, `--font-display`…). The renderer steps CSS animations and an optional `window.bkSeek(ms)` through the clip frame by frame, so motion lands exactly on each frame. The credit is `OWN WORK`, with the data sources from `<meta name="sources">` in its notes. Like everything else on screen, the numbers must come from the script and the fact-check. Rules and layout patterns are in `.claude/skills/infographic/SKILL.md`.
- Sound effects and the music bed are shared across episodes in `public/library/` (credited in `public/library/credits.json`). An episode can override one by adding `sfx/<name>.mp3` or `music/<name>.mp3` to its own folder.

Then:

```powershell
npm run assets -- <slug>      # ffprobes everything, writes assets.json
```

### 6. Check, preview, render

```powershell
npm run check -- <slug>       # must report 0 errors
npm run preview -- <slug>     # opens the browser on this episode in Remotion Studio; watch it with sound
npm run render -- <slug>      # after you're happy with the preview: check, render, master
npm run thumb -- <slug>       # out/<slug>/thumbnail.png
npm run credits -- <slug>     # out/<slug>/DESCRIPTION.md for YouTube
```

Rendering a ~2:20 episode takes several minutes on a laptop GPU. Plug in to AC power first. Outputs:

| File | Use |
|---|---|
| `out/<slug>/video.mp4` | Raw mix (around -26 LUFS) |
| `out/<slug>/youtube.mp4` | **Upload this.** Mastered to -14 LUFS ±1, true peak ≤ -1 dBTP |
| `out/<slug>/thumbnail.png` | 1280×720 thumbnail |
| `out/<slug>/DESCRIPTION.md` | Summary placeholder, chapters, sources and credits |
| `out/<slug>/REFERENCES.md` | Just the numbered source list with links, to paste into the description |

For a quick partial render, pass Remotion flags after a second `--`: `npm run render -- <slug> -- --frames=0-299`.

---

## Commands

| Command | Does |
|---|---|
| `npm run new -- <slug> [--format list] [--count N] [--theme id]` | Scaffold an episode with placeholder content |
| `npm run sync` | Regenerate `src/episodes.generated.ts` (run by `new`, `dev`, `render`, `align`) |
| `npm run align -- <slug> [--estimate]` | Write `timing.json` from the voiceover (or from text only) |
| `npm run assets -- <slug>` | Write `assets.json` |
| `npm run generate -- <slug> <name> --prompt "..." [--aspect 16:9] [--resolution 2k] [--force]` | Last-resort FLUX 3 still, with credit and provenance |
| `npm run shot -- <slug> <name> --url <url> [--selector "<css>"] [--license PD] [--highlight "..."]` | Screenshot part of a web page as a still, with credit |
| `npm run infographic -- <slug> <name> [--seconds 12] [--still]` | Render `episodes/<slug>/infographics/<name>.html` as a themed clip or still, with credit |
| `npm run check -- <slug>` | Validate schema, cues, visuals, licenses, text lengths, maps and generated files |
| `npm run preview -- <slug> [--port N] [--no-open]` | Check, start Remotion Studio and open the browser on this episode (stop with Ctrl+C) |
| `npm run dev` | Remotion Studio, all episodes |
| `npm run render -- <slug>` | Check, render, master |
| `npm run master -- <slug>` | Re-master an existing render |
| `npm run thumb -- <slug>` | Thumbnail still |
| `npm run credits -- <slug>` | YouTube description |
| `npm run kill` | Stop leftover render processes from this repo |
| `npm run typecheck` | `tsc --noEmit` |

## What `check` catches

Errors block rendering:

- Schema problems in `episode.json` (wrong field, wrong type, bad theme id).
- A marker, stat, visual, beat, outro or CTA cue that isn't spoken where it should be: missing, out of order, or outside its segment. Nothing falls back silently. In Studio, unresolved cues also show as a red panel over the video.
- A visual named in `episode.json` that isn't in `clips/` or `images/`.
- A media file with no credits entry, or a license other than PD, CC0, CC BY or CC BY-SA. `AI-GENERATED` is accepted only for `npm run generate` stills, and only with their provenance record and an on-screen note.
- Estimated timing, a voiceover/timing duration mismatch, or a `voiceover.txt` edited since alignment.
- A stale `assets.json`, a missing sound from the sfx preset, or a missing music file.
- Text over its length limit (headline over 6 words, long stamps, stat values or outro lines).
- An empty `article.md`.

Warnings: unknown map country names (with a suggestion), pins outside the map box, visuals reused in adjacent segments, segments without stats, visuals or a map, and missing sources.

## If a render is interrupted

Stopping a render with Ctrl+C can leave `chrome-headless-shell.exe`, `ffmpeg.exe` and `remotion.exe` running. Run:

```powershell
npm run kill
```

It stops only processes whose executable lives in this repo, plus node processes running this repo's Remotion CLI. That includes a running Studio, but nothing else on the machine.

## Themes and formats

- `threat-brief` (default): dark, red and amber, with Anton, JetBrains Mono and Inter.
- `clean-light`: a light demo theme with a blue accent, Oswald, IBM Plex Mono and DM Sans.
- `after-dark`: neon-noir, magenta and cyan on violet-black, with Bebas Neue, Space Mono and Sora.
- `military`: tactical briefing, sand text on olive-black with a signal-amber accent and phosphor-green readouts, with Big Shoulders Stencil, Share Tech Mono and Barlow Condensed.
- `military-comparisons`: weapons-system spec briefing in the **split layout**. Footage plays in a bracketed frame on the left; the number, headline and stats sit on the right, and the stats build into a spec sheet that stays up (5 rows a panel, then panel 2, 3). The map card shows briefly over the footage and slides off to the left. Cool white on gunmetal, HUD-cyan readouts, signal-orange accent, with Teko, IBM Plex Mono and Saira Condensed.
- `erotic`: a boudoir-editorial comparison sheet in the same **split layout** as `military-comparisons`. Blush cream on wine-black, lipstick-crimson accent, champagne-gold readouts, a warm low-key b-roll grade and soft grain with no scanlines. Fonts are Playfair Display, Josefin Sans and Jost. Default labels: AFTER HOURS ticker, TOP PICK, PROFILE panels. The mood comes from color and type only. The theme has no imagery of its own, and b-roll still has to pass YouTube's rules and the license gate.

A theme controls colors, fonts, b-roll treatment, glows, grain and default wording (ticker label, CTA, emphasis badge), and picks a segment layout (`overlay` or `split`, set in `THEME_LAYOUT` in `src/kit/themes/ids.ts`). To add one, copy `src/kit/themes/threat-brief.ts`, then register it in `src/kit/themes/index.ts` and `src/kit/themes/ids.ts`.

**Text sections.** Any entry in `segments` can be `"kind": "text"` instead of a numbered item: a `marker`, optional `label`, a `heading`, an optional short `body` and 1–4 cue-cut `visuals` full-screen behind one block of text. Use them for an intro, a recap or a closing "what it means" section. They work in every theme, don't take a number, and are skipped by the top-bar counter and the ticker.

Formats: `countdown` (10 → 1, with a number slam per segment) and `list` (1 … N, with "3 OF 5" counters and no slams). Both reuse the same scenes.

## Layout

```
episodes/<slug>/                 episode source data (episode.json, voiceover.txt, article.md, notes.md, heard.txt)
episodes/episode.schema.json     generated JSON Schema for editor autocomplete
public/episodes/<slug>/          episode media + generated timing.json / assets.json + credits.json
public/library/                  shared sfx/ and music/ + credits.json
src/kit/schema.ts                episode.json schema (zod): the single source of truth
src/kit/lib/                     cue resolution, captions, sfx presets, music ducking (pure TS, shared with scripts)
src/kit/components/              WorldMap, Backdrop, Headline, cards, titles, chrome, audio
src/kit/scenes/                  ColdOpen, Segment, SplitSegment, TextSection, Outro, EndCard
src/kit/formats/                 Countdown, List
src/kit/themes/                  threat-brief, clean-light, after-dark, military, military-comparisons, erotic
scripts/                         the npm commands (TypeScript, run with tsx) + align.py
scripts/lib/browser.ts           headless Chrome for shot and infographic (Remotion's chrome-headless-shell via playwright-core)
episodes/<slug>/infographics/    HTML sources for npm run infographic
requirements.txt                 Python packages for .venv (align, find-media lead finder)
.claude/skills/                  new-episode, find-media, generate-image, infographic
```
