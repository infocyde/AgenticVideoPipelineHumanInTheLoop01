# Style card: Military HUD

**Family:** Motion graphics
**Source:** the Brief Kit video themes `military` and `military-comparisons` (`src/kit/themes/`). The palette, fonts, grain, scanlines, vignette, glitch colors and flash are copied from them, so a piece cut into one of those episodes matches the rest of the video.

| Variant | Palette | Display / mono / body |
|---|---|---|
| `military` (default) | sand text on olive-black, signal-amber accent, pale phosphor-green readouts, muted-red hostile | Big Shoulders Stencil 800 / Share Tech Mono / Barlow Condensed |
| `military-comparisons` | cool white on gunmetal, signal-orange accent, HUD-cyan readouts, red hostile | Teko 600 / IBM Plex Mono / Saira Condensed |

`new --episode <slug>` picks the variant whose name matches the episode's theme. Otherwise pass `--variant`.

**Look:** a tactical briefing display. A flat display-black field with a faint coordinate grid, stencil headlines with a soft drop shadow, tracked uppercase mono labels, glowing accent readouts, translucent data cards with an accent tab, target brackets, reticles, range rings and radar sweeps. The finish is the themes' screen treatment: a slow rolling refresh band, 3 px scanlines, a tinted vignette and grain that re-seeds every frame.

**Motion:** text types on with a block cursor, counters ease up and settle, tracks draw on with a glowing leading dot, brackets snap in from 1.6× to lock on, stamps slam in from 1.5×, and gauge segments flicker as they fill. Impacts get a short camera shake plus a flash in the theme's flash color.

**How it explains:** a briefing in 2–4 "screens". Each idea is a readout, track or gauge on the grid. Cause and effect is a track that draws from one marker to the next. The key number is a big accent readout with a flash and an impact. A verdict is a stamp (CONFIRMED, HOSTILE, OPERATIONAL).

**Scene changes, the medium's own way:**
- `glitchCut(ctx, W, H_, p, t, drawFrom, drawTo)` (~0.35 s): a signal tear with sliced rows and glitch-color bars. Use it when the story moves on (new topic, before/after, a reveal). Score it with `glitch`.
- `scanWipe(ctx, W, H_, p, drawFrom, drawTo)` (~0.6 s): a bright scan bar reveals the next screen. Use it for a continuation in a new place (next system, zooming to a region). Score it with `swish`, then `blip` on arrival.
- Prefer continuity within a screen: a readout shrinks into a card's label, or a track continues onto the next marker.

## Helpers in `style.js`

| Helper | Use |
|---|---|
| `styleBase(ctx, W, H_, t)` / `styleFinish(ctx, W, H_, t)` | first and last call of every frame (the finish runs at full strength, always) |
| `P`, `font(kind, size, weight?)` | palette tokens and font strings (`display`, `mono`, `body`) |
| `headline`, `label`, `body`, `readout` | lettering: headline ≥ 44 px, labels ≥ 28 px, readouts ≥ 64 px |
| `typeLine(ctx, text, x, y, size, t, t0, color?, cps?)`, `typeRate(cps)` | typed text with cursor; score it with `k.play('typing', t0, { n: text.length, rate: typeRate(cps) })` |
| `header(ctx, W, left, right, t, inset?, top?)` | corner header (kicker + grid ref) |
| `brackets`, `reticle`, `rangeRings`, `sweep`, `trace`, `gauge`, `card`, `stampBox` | HUD furniture; each takes a progress or a time so it animates from t |
| `counter(v0, v1, t, t0, dur)`, `counterTicks(t0, dur)` | eased key numbers, and their tick times (≤ 12/s, slowing as they settle) for the score |
| `shake(t, t0, amp?, dur?)`, `flash(ctx, W, H_, a)` | the emphasis move on the key hit |
| `glitchCut`, `scanWipe`, `sceneLayer` | scene changes (above) |
| `prog(t, t0, dur, ease?)`, `boil(t, rate)`, `ease` | timing utilities |

## Sound palette

Effects only, with no ambience bed. The user doesn't want the `hum` bed (it reads as a constant background hum), so don't add `hum`, or any other bed, unless they ask for one. The palette:
- `crtOn` once at the open; `blip` / `select` when readouts land; `typing` matched to typed text; `count` ticks from `counterTicks`
- `swish` for tracks drawing on (match `dur` to the draw) and for scan wipes; `glitch` on glitch cuts
- `stamp` for stamps and bracket locks; `impact` + `stamp` on the key number (the biggest hit); `error` for a wrong/denied moment
- `success` as the resolving sound on the takeaway

No music by default. A dark `pulse` at gain ≤ 0.4 suits long pieces.

## Accuracy

Draw military systems as diagrams (tracks, rings, silhouettes from simple shapes), never as detailed renders of a specific weapon you haven't checked. Ranges, counts and dates follow the facts rules in SKILL.md. Keep hostile red for the opposing side only, as the themes do on maps.
