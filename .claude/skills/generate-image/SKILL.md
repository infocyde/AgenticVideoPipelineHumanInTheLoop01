---
name: generate-image
description: Generate a Brief Kit still or thumbnail background, locally with Z-Image Turbo or in the cloud with FLUX 3 (Black Forest Labs, via Replicate) per config.yaml image_gen.mode, when no good PD/CC-licensed image or clip can be found. Use only as a fallback after sourcing fails, or when the user asks for a generated image or a painted thumbnail.
---

# Generate an image (fallback)

Real, licensed footage comes first. In a music video with `licensing.stock_media: music-video`, that includes the stock sites (the **stock-media** skill), so search them before generating. Generate when:

- the sourcing subagents found nothing usable for a shot (missing, watermarked, wrong subject or unclear license),
- the only licensed footage is a poor stand-in (a different system, country or era) and a generated image of the right subject would serve the viewer better, or
- the user asks for a generated image or a painted thumbnail background.

Tell the user which shots you're generating, and why, before you start (and before you spend credits on cloud renders).

## Engines and modes

`config.yaml` `image_gen.mode` decides where a still is made:

| Mode | Ordinary stills | `--detail high` |
|---|---|---|
| `local_render` | Z-Image Turbo on this GPU | Z-Image Turbo |
| `cloud_render` | FLUX 3 via Replicate | FLUX 3 |
| `mixed` (default) | Z-Image Turbo | FLUX 3 when `REPLICATE_API_TOKEN` is set, otherwise Z-Image Turbo |

- **Z-Image Turbo** (Tongyi-MAI, Apache-2.0): a Q4_K GGUF run by stable-diffusion.cpp in `models/image/` (set up with `npm run setup:image`). Free, about 35–55 s per image on the RTX 4070 Laptop, rendered at 1600×896 and scaled to 1920×1080. Settings (steps 8, CFG 1.5, shift 3, sampler, size, the default negative prompt) are in `config.yaml` `image_gen.local`; the negative prompt only applies when CFG is above 1. Every run takes a fresh random seed, recorded in `credits.json`; `--seed <n>` remakes one.
- **FLUX 3** (Black Forest Labs via Replicate): a paid API call per image, sharper fine detail and more reliable on complex machinery and lettering.
- **Use `--detail high`** for the thumbnail background and for a hero still that sits full-screen for a long time. Ordinary b-roll stills (darkened, tinted and covered by text) don't need it.
- `--engine local` or `--engine cloud` overrides the mode for one image.

## Command

```
npm run generate -- <slug> <name> --prompt "<prompt>" [--detail high] [--engine local|cloud] [--seed N] [--force]
npm run generate -- --sample "<prompt>"          # try a prompt -> out/image-samples/ (no credit)
```

- Writes `public/episodes/<slug>/images/<name>.jpg` (1920×1080) and a `credits.json` entry with license `AI-GENERATED` and a full provenance record (model, exact prompt and inputs, and the seed or Replicate prediction id). It also refreshes `assets.json`. The untouched original is kept in `out/<slug>/generated/`.
- Local only: `--steps N` and `--cfg X` override `config.yaml` for one run.
- Cloud only: `--aspect 16:9`, `--resolution 2k` (default from `image_gen.cloud`), `--safety`, `--grounding`. The token comes from `REPLICATE_API_TOKEN`, either in the environment or in a `.env` file in the repo or a parent folder (currently `C:\_activeDev\.env`). Never print or log it. Keep `2k` for anything shown full-screen; `1k` only comes out at about 1360×768 and gets upscaled.
- `--grounding` (cloud) lets the model web-search the prompt first. Leave it off; it pulls in real news photos and makes images that pass as real coverage.
- `--force` replaces an existing image with the same name (and its credit entry).
- Use a long prompt from a file with `--prompt-file <path>`.

## Prompt rules

The image will sit under heavy text overlays, darkened and tinted by the theme.

- **Specific subjects are fine.** A named weapon system, vehicle, ship or aircraft can be shown as it really looks ("a Magura V5 naval drone skimming the Black Sea"), in a realistic operating setting, with the national colors or markings it actually carries. Describe it from the article and general knowledge in the prompt.
- **Not a fake record of a specific event.** Don't stage a particular reported incident as if it were footage of it ("the strike on the Novorossiysk refinery on October 12"). A system in action in a generic setting is fine.
- **Never copy a specific photo.** Don't feed an unlicensed photo in as a reference or recreate its composition with small changes; that is still a derivative of the photographer's work. Write the prompt from a description.
- **Unlicensed photos as visual reference only.** To get a named system right, look at photos of it (any license; DuckDuckGo image search is fine) and write down its features in words: airframe and wing layout, propulsion and propeller position, launcher, hull shape, size cues, color. The prompt is that text description, with your own framing and setting. Afterwards compare the result with the reference and regenerate if the design is wrong.
- **No real, identifiable people.** No politicians, leaders or named individuals, and no recognisable faces. Silhouettes, distant figures, helmeted soldiers seen from behind and hands are fine.
- **Name the subject's shape, not just its name.** The local model knows fewer named systems than FLUX: "a Magura naval drone" came out as a flying quadcopter. Say what it is and how it looks ("a low, wedge-shaped uncrewed speedboat with a dark gray hull, skimming the waves"). This matters for both engines, more for the local one.
- **Text and markings garble.** Allow flags or insignia only when they matter, and reject any image where lettering, hull numbers or symbols come out mangled. When markings don't matter, end the prompt with: `No text, no logos.`
- **Leave room for the layout.** The left ~55% of the frame is covered by the headline and stats, so put the subject right of centre: `subject on the right third, empty dark space on the left`.
- **Match the theme.** threat-brief: `moody, overcast or night, muted desaturated colors, high contrast, cinematic documentary photography`. clean-light: `bright, soft daylight, clean, editorial photography`. military: `overcast, dusty, muted olive and gray tones, gritty high contrast, documentary photography`. military-comparisons: `cold overcast light, steel blue and gunmetal gray tones, high contrast, clean documentary photography`. erotic: `warm low-key lighting, deep wine and blush tones with soft gold highlights, shallow depth of field, elegant editorial photography` (suggestive mood only: fully clothed or no people, nothing explicit).

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

Only stills can be generated (both are image models). A generated still works as b-roll: the Backdrop gives it a slow Ken Burns move.
