# Style card: Freeform (creative mode)

**Family:** any
**Fonts:** whatever the piece needs. Pass them to `new --fonts "Family:wght@400;700|Other Family"`; the default (Inter Tight + JetBrains Mono) is only a placeholder.

**Look, motion, how it explains:** yours to invent, per piece. This style is deliberately empty: `style.js` gives `styleBase` (a flat field), an empty `styleFinish`, and the timing helpers `prog`, `boil`, `ease`, `TAU`. Everything else, from the surface and the line quality to the lettering, the textures, the transitions and the finishing pass, you write in the EXPLAINER block.

Use it for **creative mode** (see SKILL.md), or whenever no existing style fits and inventing one is the right call.

## Before you draw: write the piece's own style card

Put a short card at the top of the EXPLAINER block, as a comment, and show the gist in the storyboard (first beat's `flow`, or an `ASSUMPTIONS` line starting `STYLE:`). It answers:
- **Medium:** what this is made of (cut paper, chalk on slate, blueprint, risograph print, museum diorama, oscilloscope, stained glass, a subway map, a 1970s textbook…). Pick it because it says something about the subject, not because it is pretty.
- **Palette** (3–6 colors), **type** (display / label / number faces), **line and texture**.
- **Motion:** how things arrive, how they move, the emphasis move on the key hit.
- **Scene changes:** the medium's own one or two transitions.
- **Finish:** the pass that makes the medium read on every frame (grain, paper, glow, print misregistration, chalk dust…).
- **Sound palette:** which kit sounds (lib/sound.js) or tones and noise the medium makes.

Then hold yourself to that card for the whole piece, the way the named styles hold to theirs. A medium you invented still has to be consistent.

## Borrowing

You may copy helpers from any other style's `style.js` into the EXPLAINER block (a manga `brush` stroke, the HUD's `glitchCut`), mix them, and restyle them. Say so in the card.

## If it turns out good

A freeform medium that works is a candidate for a real style: offer the user to promote it to `styles/<id>/` (SKILL.md, "Adding a style").
