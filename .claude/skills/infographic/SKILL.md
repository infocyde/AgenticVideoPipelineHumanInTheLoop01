---
name: infographic
description: Make an animated infographic (bar comparison, big number, timeline, ranked list, versus card, proportion grid) as b-roll for a Brief Kit episode, in the episode's theme. Use when a segment's point is a number or a comparison that footage can't show, when licensed footage is missing for a data-heavy beat, or when the user asks for an infographic, chart or data graphic.
---

# Infographic

You write one self-contained HTML page per graphic, and `npm run infographic` renders it frame by frame into a clip (or a still) in the episode's theme. The output is ordinary b-roll: a file in `clips/` or `images/` with a `credits.json` entry, used by name in `visuals`. Nothing in the kit's code changes, so it's allowed under CLAUDE.md rule 1.

## When to use one

- The beat is a number, a comparison, a trend or a sequence (ranges, costs, counts, dates), and a chart shows it better than file footage.
- Licensed footage is missing or a poor stand-in for a data-heavy beat. Prefer an infographic to an AI still when the point is a figure.
- Don't repeat the segment's on-screen stats one-for-one. The stats panel already shows those; the infographic should *compare* (this system vs others, then vs now, share of a total).

## Rules

1. **Facts:** every number, label and date must be in the script or the fact-check log in `notes.md` (CLAUDE.md rule 2). Round the same way the narration does. Put the sources in `<meta name="sources" content="…">` and in a small source line on the graphic.
2. **Theme, not hard-coded style:** use the injected CSS variables for every color and font. Never name a font or write a hex color in the page.
3. **Safe area:** keep everything inside `left/right 200px, top/bottom 120px` of the 1920×1080 page. The kit zooms b-roll up to 1.18× and drifts it 30px.
4. **Legible at half size:** in split-layout themes (`military-comparisons`, `erotic`) and in `frontier` (a floating window) the clip plays in a frame about 1040–1060px wide. Body text ≥ 40px, values ≥ 64px, at most ~6 rows or items, one idea per graphic.
5. **Animate early, then hold:** finish the motion by ~3 s, then hold the finished state. Make the clip **longer than its slot** (default `--seconds 12`). A shorter clip gets slowed to as little as half speed and then loops, which replays the animation.
6. **Frame-accurate motion only:** use CSS animations/transitions or the Web Animations API (the renderer pauses and seeks them), and/or define `window.bkSeek(ms)` to draw from the time directly (counters, bar widths, SVG line drawing). No `requestAnimationFrame`, `setTimeout`, `setInterval` or `Date.now()` for motion.
7. **Self-contained:** no external scripts, and no images unless they're licensed media already credited for this episode. Local files next to the HTML resolve relative to `episodes/<slug>/infographics/`.

## Theme variables (injected)

| Variable | Use |
|---|---|
| `--bg` `--panel` `--line` | page background, cards/tracks, hairlines |
| `--text` `--dim` | main text, secondary text and source lines |
| `--accent` | the one thing to look at: the top item, the key bar, kicker rules |
| `--highlight` | values and normal bars |
| `--on-accent` | text on an accent fill |
| `--hostile` `--ally` `--land` | map-style categories (opposing side / own side / neutral) |
| `--accent-deep` | dark tint for large fills |
| `--font-display` | big numbers and headings |
| `--font-mono` | kickers, labels, source lines (tracked uppercase) |
| `--font-body` | row labels, short text |
| `--text-shadow` `--accent-glow` | the theme's shadow and glow (`text-shadow` / `box-shadow`) |

`window.BK` holds `{ theme, brand, seconds, fps }`.

## Steps

1. Decide the graphic and its data from the script, and pick the segment and cue where it plays.
2. Copy the template:
   ```
   episodes/<slug>/infographics/<name>.html   ← .claude/skills/infographic/template.html
   ```
   Replace the EXAMPLE DATA, `<title>`, `<meta name="sources">` and the source line. Adapt the layout using the patterns below.
3. Render:
   ```
   npm run infographic -- <slug> <name>                 # clips/<name>.mp4, 12 s
   npm run infographic -- <slug> <name> --seconds 16    # for a long slot
   npm run infographic -- <slug> <name> --still         # images/<name>.png (gets the kit's Ken Burns drift)
   npm run infographic -- <slug> <name> --open          # only build the page, to open it in a browser
   ```
   Re-render with `--force`. The credit (`OWN WORK`, with the data sources in the notes) and `assets.json` are written for you.
4. **Look at it.** For a still, Read the PNG. For a clip, pull frames: `ffmpeg -v error -ss 1 -i public/episodes/<slug>/clips/<name>.mp4 -frames:v 1 <scratchpad>/f1.png`, plus one near the end. Check the numbers against the script, clipping at the safe area, wrapping, and contrast.
5. Use it: `{ "name": "<name>", "cue": "<spoken phrase>" }` in the segment's `visuals`. It needs no `note`.
6. Log it in `notes.md` (which beat, which figures, which sources).

## Patterns

Each is a small change to the template. Keep the template's `.safe`, `.kicker`, `h1` and `.source`.

- **Bar comparison** (the template): 2–6 rows, the subject as `top: true`. Sort by value unless the order means something (chronology).
- **Big number:** one huge value in `--font-display` at 260–360px in `--accent`, a one-line label under it in `--font-mono`. Count it up in `bkSeek` with the template's `ease`. Good for "1.5 MILLION" or "$193,000".
- **Versus card:** two columns split by a hairline (`--line`), each with a name, then 3–4 matching spec rows (label `--dim` / value `--highlight`). Highlight the winning value of each row in `--accent`. Reveal the rows with a staggered `rise`.
- **Timeline:** a horizontal rule across the safe area with 3–6 dots. Draw the rule in `bkSeek` (width 0→100%), then pop each dot and its date (`--font-display`) and a two-to-four-word caption (`--font-body`) as the line reaches it.
- **Ranked list:** 3–6 rows with a big rank number (`--font-display`, `--accent` for #1), a name and one value. Stagger the rows 150–200 ms apart.
- **Proportion grid:** a 10×10 grid of squares (`--panel`), filling N of them with `--highlight` in sequence for "N in 100" or "N percent". Fill in `bkSeek`: `i < Math.round(ease(t) * N)`.
- **Line trend:** an inline SVG `<path>` with `stroke-dasharray`/`stroke-dashoffset` set from `bkSeek`, axis labels in `--font-mono`, the last point labelled with its value. At most 8 points; label the start and end values and skip the gridlines.

For an illustrated, styled piece (manga, tactical HUD) that explains a mechanism rather than charting a number, use the **explainer** skill instead. It renders through the same `npm run infographic`.

For chart-design judgement (which form fits the data, how to label, and keeping one accent per graphic), the `dataviz` skill applies too. Ignore its palette and use the theme variables.
