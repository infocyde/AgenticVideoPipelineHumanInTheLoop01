# Style card: Manga Page

**Family:** Illustration
**Fonts:** Archivo Black (headlines, numbers), Patrick Hand (balloon and narration lettering), VT323 (screens drawn inside panels)

**Look:** a black-and-white manga page: slanted panel gutters, brush-tapered ink, radiating focus lines, true halftone screentone gradients, katakana sound effects with white knock-out borders and hand-lettered speech balloons.

**Motion:** panels land one after another with a camera shake. Focus lines "boil" every couple of frames, and the ゴゴゴ letters tremble.

**How it explains:** a three-page manga. Panels slam in on twos and page turns carry the story. Bold outlined arrows and katakana SFX (ドドド, ブー, カチカチ, ピンポーン, グングン) mark cause and effect, numbers count in narration boxes, and focus-line bursts hit the key beats.

## What we have, and what's missing

The reference source (`styles/manga-panel.js`) arrived **truncated**, cut off inside `pencilRough()`. `style.js` holds:

- **Part 1, verbatim from the reference:** `poly`, `catmull`, `brush`, `bz`, `focusLines`, `KANA` + `kanaStrokes` + `sfx`, `bubble`, the extra explainer kana (ブ ー カ チ ポ グ), `tone` (screentone pattern), `gradTone`, `inkLoop`, `rrPts`, `ellPts`.
- **Part 2, provisional stand-ins** written to the style card above, not taken from the reference: `styleBase` (paper), `styleFinish` (print grain on twos plus a faint falloff), `slam`, `onTwos`, `panel`, `narration`, `knockText`, `sfxWord`, `inkArrow`, `pageTurn`.

Missing entirely: `pencilRough` (non-photo-blue layout rough), the reference's own finishing pass (paper grain, ink pooling and so on), its page-turn and panel-layout code, `draw()`, `explainer()` and `explainerSound()`. When you have the full source, save it as `styles/manga-page/reference.js`, then replace Part 2 with the reference's versions and delete this section.

## Katakana available

コ ゴ ピ ッ ド ク ン ブ ー カ チ ポ グ. That covers ドドド, ゴゴゴ, ブー, カチカチ, ピッ, グングン, ドクン. Any other kana needs a hand-built stroke entry in `KANA` (unit-box polylines, `['o', x, y, r]` for the handakuten circle). There is no Japanese font fallback, and none should be added: SFX are brushed, not typed.

## Sound palette

Paper and ink: `slap` on each panel landing, `stroke` with `material: 'brush'` while ink draws (match `dur` to the draw-on), `paper` on a page turn, `stamp` / `impact` on the focus-line hit and the key number, `tock` for カチカチ, `ding` / `success` for ピンポーン and the takeaway, `buzz` for ブー (wrong). No bed by default (effects only: the user doesn't want a background hum), and no music.
