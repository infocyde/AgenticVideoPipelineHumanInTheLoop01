---
name: explainer
description: Make an illustrated, animated explainer (12-30 s) in a named visual style, such as Manga Page or Military HUD, drawn on a canvas with a synthesized sound score, storyboarded first for approval. Use when the user asks for an explainer, an animated explainer, a styled or illustrated animation, a manga/comic or tactical-HUD style piece, or b-roll that explains a mechanism or sequence in a hand-made style rather than as a plain chart. For plain themed charts (bars, big number, timeline) use the infographic skill.
---

# Explainer

One self-contained HTML page per piece: a 1280×720 canvas whose every frame is a pure function of `t`, plus a `scoreSound(k)` sound score. The same page is the player (an artifact the user can watch), the storyboard and the render source. `npm run explainer` scaffolds, checks and renders it.

Two uses:
- **Standalone:** `explainers/<name>/<name>.html` → `out/explainers/<name>/<name>.mp4`, with the score mixed in.
- **Episode b-roll:** `--episode <slug>` puts the page in `episodes/<slug>/infographics/<name>.html`. Render it **silent** with `npm run infographic -- <slug> <name> --seconds <s>`. The kit mutes b-roll, so the narration and the kit's own sfx carry the sound. That writes the `OWN WORK` credit and `assets.json` for you. Nothing in the kit's code changes, so it's allowed under CLAUDE.md rule 1.

## Styles

`npm run explainer -- styles` lists them. Each lives in `styles/<id>/`:

| File | What |
|---|---|
| `STYLE.md` | the style card: look, motion, how it explains, its scene changes, its helpers, its sound palette. **Read it before storyboarding.** |
| `style.js` | the drawing, texture and finishing helpers, copied into every page by `new` |
| `style.json` | name, fonts and variants (palette/font sets, injected as `STYLE_VARIANT`) |
| `reference.js` | (when present) the style's full reference animation, to study and not to copy |

Current styles:
- `manga-page`: black-and-white manga. **Incomplete:** its reference arrived truncated, so its finish pass, page turn and panels are provisional (see its STYLE.md).
- `military-hud`: tactical briefing display, built from the kit's `military` / `military-comparisons` themes (variants of the same names).

## Procedure

1. **Content.** Standalone: the user's topic or script. If you don't have it, ask for it before building. Episode b-roll: one beat of the script, and every fact must be in the script or the `notes.md` fact-check (CLAUDE.md rule 2). Either way, list anything you had to assume in `ASSUMPTIONS`, and flag added context to the user.
2. **Scaffold:** `npm run explainer -- new <name> --style <id> [--variant <v>] [--episode <slug>] [--title "..."]`. Read the style's `STYLE.md`.
3. **Storyboard first.** In the page's EXPLAINER block, fill `BEATS` (about 6–10 beats: `t0`, `t1`, `key` time, exact on-screen `text`, `flow`, `sounds`), `ASSUMPTIONS` and `SOURCES`, plus `<meta name="sources">`. Write `explainer()` so that each beat's key frame draws fully in the style, using the style helpers and its `styleBase` / `styleFinish`. These are still frames, with no motion yet. `flow` says how the beat arrives: *continuous* (which elements carry over and how they move or change) or *a scene change* (which transition, and why the story wants one).
4. `npm run explainer -- storyboard <name> [--episode <slug>]`, then **Read `storyboard.png`** and fix anything off: text size, overlap, wrong drawings. Load the `artifact-design` skill, then publish `<out>/<name>.storyboard.html` with the Artifact tool. **Wait for the user's OK** or changes.
5. **Build the animation** exactly as storyboarded, reusing the key-frame drawing code. Add the motion, the transitions and `scoreSound(k)`, and set `DURATION`.
6. **Check:** `npm run explainer -- frames <name> --at <t1,t2,…>` with a frame mid-transition, one at the key hit and one on the takeaway. Read the PNGs. It also checks determinism and per-frame draw time. Then publish the page itself as an artifact (the player), so the user can watch it with sound.
7. **Render:**
   - Standalone: `npm run explainer -- render <name>` (`--fps 30 --scale 1.5` defaults give 1920×1080. `--no-sound` drops the score. `--voiceover` uses the kit's voiceover mix, which drops beds and music and lowers minor sounds). Pull a frame or two from the MP4 and look.
   - B-roll: `npm run infographic -- <slug> <name> --seconds <slot + 2>`. The page holds its last frame after `DURATION`. Use it with `{ "name": "<name>", "cue": "…" }` in the segment's `visuals` (no `note` needed), and log it in `notes.md`.

## Rules

**Stay in the style.** Reuse the style's rendering techniques, palette, textures, lettering, line quality, arrows, labels, number treatment, transitions and timing feel. Change the story, the text and the things drawn, never the medium. The texture and finishing passes (`styleFinish`) are what make the medium read: run them on every frame at full strength, and never skip or thin them for speed.

**Draw the subject accurately.** Don't carry over a style's props or demo drawings unless they genuinely fit. Double-check the science and facts the visuals show.

**Determinism.** Each frame is a pure function of `t`. All randomness comes from `H.rng(seed)` / `H.makeNoise(seed)` inside the draw, seeded from constants or `boil(t)`, never `Math.random`, `Date`, `performance.now` or timers above the PLAYER block (`frames` and the lint warn about these). Caching static textures across frames is fine. State carried from one frame to the next is not.

**Legible on a phone** (sizes at 1280×720): headlines ≥ 44 px, every label or caption the story depends on ≥ 28 px (including the corner header and small annotations), key numbers ≥ 64 px. Frame each beat to fill most of the screen. Aim for well under 100 ms per frame at 1280×720. For episode b-roll, keep everything inside 133 px left/right and 80 px top/bottom (the kit zooms b-roll up to 1.18× and drifts it), and at most ~6 items per beat (split layouts show it at about half size).

**Structure like an explainer, not a title card.** A hook that gets out of the way within ~2 s, then beats where something changes every 1–2 s. Arrows draw on to show cause and flow. Labels land on what they label. Use one emphasis move on the key moment, then hold a short takeaway for ~1 s at the end. 12–30 s unless the content needs more.

**Flow between beats.** A new beat is not automatically a new scene. When the next idea builds on the last, stay continuous: what matters stays on screen and moves, grows, rearranges or transforms (a label becomes the next heading, a counter grows into a chart, the camera travels across the same scene). When the story really moves on (a new topic, a jump in time or place, before/after, a reveal), change scene the medium's own way (each STYLE.md names its transitions). Aim for a mix that fits the content, avoiding both a hard cut on every beat and one forced unbroken shot.

**Sound** (standalone, full mix):
- Sync is everything. Each sound starts on the exact frame its event appears, computed from the same times as the picture (share constants between `explainer()` and `scoreSound()`).
- Score what lands: pops and stamps, labels landing, arrows completing, transitions, a wrong/right moment, the key number (the biggest hit) and the takeaway (a resolving sound).
- Drawing makes its medium's noise for as long as it draws (`stroke` with the right `material` and `dur`, `typing` while text types, `text` blips for game dialog). Counters tick at most ~12 times a second, slowing as they settle.
- A quiet bed suited to the medium is welcome. Use music only if the style suits it (`k.music`, gain ≤ 0.6).
- Keep a hierarchy: effects in front, any bed clearly under them, no more than ~3 sounds at once, and small silences so the big hits read. Use the style's sound palette, not generic swooshes.

**Credits and licenses.** Everything is drawn and synthesized, so the piece is `OWN WORK`. The Google Fonts used are OFL. Embed no outside images unless they're licensed and credited for the episode (CLAUDE.md rule 3). For b-roll, `npm run infographic` writes the credit, using the page's `<title>` and `<meta name="sources">`.

## The page

- The EXPLAINER block is yours: `DURATION`, `BEATS`, `ASSUMPTIONS`, `SOURCES`, `explainer(ctx, W, H_, t)`, `scoreSound(k)` and any helpers.
- Above it are copies of `lib/harness.js` (the `H` library), `lib/sound.js` (the `SOUND` kit, whose sounds and beds are listed in its source; `npm run sfx` also renders episode sound effects from it, so a change there affects both) and the style's `style.js`. Leave the libraries unchanged. Edit the copied style helpers only for a one-off tweak; style-wide fixes go in `styles/<id>/style.js`.
- The PLAYER block is fixed. It loads the fonts before the first draw, fits the canvas with letterboxing, and gives play/pause, scrub, time, a sound toggle and loop (on by default). It plays the score with `SOUND.live(scoreSound, t, { voiceover: false })` and stops it on pause, seek and sound-off. It exposes `window.seek(t)`, `window.bkSeek(ms)`, `window.DURATION` and `window.scoreSound`. `#storyboard` shows the storyboard, and `?render&scale=1.5` gives the bare canvas.

## Adding a style

When the user gives a style prompt (a style card, a reference source, maybe a sound kit):
1. Ask for it as a file if it's long. Pasted messages are cut at 50,000 characters.
2. `styles/<id>/reference.js`: the full reference source, verbatim.
3. `styles/<id>/style.js`: its reusable drawing, texture and finishing helpers, verbatim, without the gallery-only `registerStyle` / `H.render` parts. It must define `styleBase(ctx, W, H_, t)` and `styleFinish(ctx, W, H_, t)`, using the reference's own surface and finishing functions. Don't add `'use strict'` or wrap it in a block: it is pasted into the page's script scope.
4. `styles/<id>/style.json`: name, family and variants, each with `fontsHref` (a Google Fonts css2 URL with `display=block`), `fontSpecs` (one `document.fonts.load` spec per face used) and `vars` (injected as `STYLE_VARIANT`).
5. `styles/<id>/STYLE.md`: the style card (look, motion, how it explains), its scene changes, its helper table, its sound palette and anything missing.
6. If the prompt's `lib/harness.js` or `lib/sound.js` differ from ours, tell the user before changing the shared copies: every style uses them.
7. Smoke-test it: `new zz-<id> --style <id>`, draw two beats with a transition, then `frames`, look at the PNGs, `render`, and delete the test folder.
