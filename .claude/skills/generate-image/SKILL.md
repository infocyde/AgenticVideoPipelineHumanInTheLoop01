---
name: generate-image
description: Generate a Brief Kit still or thumbnail background with FLUX 3 (Black Forest Labs, via Replicate) when no good PD/CC-licensed image or clip can be found. Use only as a fallback after sourcing fails, or when the user asks for a generated image or a painted thumbnail.
---

# Generate an image (fallback)

Real, licensed footage comes first. Generate when:

- the sourcing subagents found nothing usable for a shot (missing, watermarked, wrong subject or unclear license),
- the only licensed footage is a poor stand-in (a different system, country or era) and a generated image of the right subject would serve the viewer better, or
- the user asks for a generated image or a painted thumbnail background.

Tell the user which shots you're generating, and why, before you spend credits.

## Command

```
npm run generate -- <slug> <name> --prompt "<prompt>" [--aspect 16:9] [--resolution 2k] [--force]
```

- Writes `public/episodes/<slug>/images/<name>.jpg` (1920×1080) and a `credits.json` entry with license `AI-GENERATED` and a full provenance record (model, prediction id, exact prompt and inputs). It also refreshes `assets.json`. The untouched original is kept in `out/<slug>/generated/`.
- The token comes from `REPLICATE_API_TOKEN`, either in the environment or in a `.env` file in the repo or a parent folder (currently `C:\_activeDev\.env`). Never print or log it.
- Each run is a paid API call. Keep the default `2k` for anything shown full-screen; `1k` only comes out at about 1360×768 and gets upscaled.
- `--grounding` lets the model web-search the prompt first. Leave it off; it pulls in real news photos and makes images that pass as real coverage.
- `--force` replaces an existing image with the same name (and its credit entry).
- Use a long prompt from a file with `--prompt-file <path>`.

## Prompt rules

The image will sit under heavy text overlays, darkened and tinted by the theme.

- **Specific subjects are fine.** A named weapon system, vehicle, ship or aircraft can be shown as it really looks ("a Magura V5 naval drone skimming the Black Sea"), in a realistic operating setting, with the national colors or markings it actually carries. Describe it from the article and general knowledge in the prompt.
- **Not a fake record of a specific event.** Don't stage a particular reported incident as if it were footage of it ("the strike on the Novorossiysk refinery on October 12"). A system in action in a generic setting is fine.
- **Never copy a specific photo.** Don't feed an unlicensed photo in as a reference or recreate its composition with small changes; that is still a derivative of the photographer's work. Write the prompt from a description.
- **Unlicensed photos as visual reference only.** To get a named system right, look at photos of it (any license; DuckDuckGo image search is fine) and write down its features in words: airframe and wing layout, propulsion and propeller position, launcher, hull shape, size cues, color. The prompt is that text description, with your own framing and setting. Afterwards compare the result with the reference and regenerate if the design is wrong.
- **No real, identifiable people.** No politicians, leaders or named individuals, and no recognisable faces. Silhouettes, distant figures, helmeted soldiers seen from behind and hands are fine.
- **Text and markings garble.** Allow flags or insignia only when they matter, and reject any image where lettering, hull numbers or symbols come out mangled. When markings don't matter, end the prompt with: `No text, no logos.`
- **Leave room for the layout.** The left ~55% of the frame is covered by the headline and stats, so put the subject right of centre: `subject on the right third, empty dark space on the left`.
- **Match the theme.** threat-brief: `moody, overcast or night, muted desaturated colors, high contrast, cinematic documentary photography`. clean-light: `bright, soft daylight, clean, editorial photography`. military: `overcast, dusty, muted olive and gray tones, gritty high contrast, documentary photography`. military-comparisons: `cold overcast light, steel blue and gunmetal gray tones, high contrast, clean documentary photography`.

Template:

```
<subject: the system, object or scene>, <framing: wide shot / close-up>, subject on the right third,
empty space on the left. <light and mood from the theme>. Documentary photography style, natural detail.
No text, no logos, no identifiable people.
```

## After generating

1. **Look at the image** (open the `.jpg`). Reject and regenerate with `--force` if it has garbled text or symbols, logos, real-looking faces, or wrong or anachronistic details (a cargo ship where a tanker was asked for, the wrong type of aircraft or drone), or if it looks like a news photo of a specific reported event.
   **Check symmetry and structure part by part.** Aircraft, drones, missiles and vehicles are symmetric: count wings, fins, propellers and blades on each side and make sure left and right match (no extra or missing wing, no lone fin), that every part attaches to something, and that nothing passes through the ground, a vehicle or another object (a tail or rail leg sinking into the dirt behind a truck). Check lettering on vehicles too (tailgates, plates). Reject on any of these.
   **Up to three attempts per subject.** Generate each attempt under its own name (`<name>_a`, `<name>_b`, `<name>_c`), refining the prompt between them, then keep the best one: rename it to `<name>.jpg` (and its `credits.json` entry's `file`), and delete the other attempts' files and credit entries so they don't reach the credits roll. If none of the three is right, fall back to another asset or the map and tell the user.
2. Use it with the on-screen label. `check` errors without one:
   ```json
   { "name": "tanker_dusk", "cue": "tanker", "note": "AI-GENERATED ILLUSTRATION" }
   ```
   A cold-open beat takes the same `note`. For a thumbnail background, set `"thumbnail": { "visual": "<name>" }`; no on-screen note is needed there.
3. Record it in `notes.md`. In the handoff, tell the user which visuals are AI-generated, and remind them to tick YouTube's **"altered or synthetic content"** box when uploading if any of them look realistic. `check` warns about this too, and `npm run credits` lists the images under "AI-generated illustrations" in `DESCRIPTION.md`.

Only stills can be generated (FLUX 3 is an image model). A generated still works as b-roll: the Backdrop gives it a slow Ken Burns move.
