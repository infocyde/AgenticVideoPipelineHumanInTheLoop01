---
name: compose-music
description: Generate a background music bed for a Brief Kit episode or Short locally with Stable Audio 3 (npm run compose), sized to the video, level-matched to the library bed and credited AI-GENERATED (Powered by Stability AI). Use when config.yaml has music_gen.enabled true and an episode or Short needs its bed, or when the user asks for generated, AI or new background music, a different bed, or another take of one.
---

# Compose music

`npm run compose` runs Stable Audio 3 (Stability AI) on the local GPU in `.venv-music` and writes an instrumental bed to the episode's `music/` folder. It is loudness-matched to the library bed (`music_gen.lufs`, default −20.3 LUFS), credited `AI-GENERATED` with its provenance (model, prompt, seed) and refreshes `assets.json`. Every run gets a **fresh random seed**, recorded in `credits.json`, so the same prompt gives a new take each time; `--seed <n>` remakes one exactly.

```powershell
npm run compose -- <slug> bed --prompt "..."                 # sized to the whole video (needs timing.json)
npm run compose -- <slug> bed --prompt "..." --force         # another take (new random seed)
npm run compose -- <slug> bed --prompt "..." --seed 123456   # remake the take with that seed
npm run compose -- --sample "prompt" --seconds 30            # audition a prompt -> out/music-samples/ (no credit)
```

## When

- **`music_gen.enabled: true`** in `config.yaml`: every episode and every Short gets a generated bed, unless the user hands over their own track (their music always wins; credit it as they say).
- **`false`**: don't run it (it refuses without `--ignore-off`). Beds come from the library, the episode's `music/` folder or the user's own tracks.

## Procedure

1. **After the final voiceover is aligned** (new-episode step 3), because the bed is sized to the video: `--seconds` defaults to the whole video plus 2 s, from `timing.json`. Medium makes up to 380 s in one pass; a longer bed is extended with the model's own continuation (60 s of context, a 0.5 s crossfade at each join), so it never hard-loops. A long pass sometimes "ends the song" and leaves seconds of silence before starting again: compose finds every stretch 30 dB under the bed's level, widens it over the fade around it and regenerates it in place (inpainting), up to 3 tries, and says so. A 7-minute bed takes about 5 minutes on the RTX 4070 Laptop (peak ~5.1 GB VRAM).
2. **Write the prompt** (below). For a first bed in a new theme, or when unsure, audition with `--sample` (20–30 s) first. It's cheap.
3. **Compose:** `npm run compose -- <slug> bed --prompt "..."`.
4. **Use it:** `"audio": { "music": { "file": "bed", "level": 0.16, "duck": true } }`. Beds sit a little under the narration: `level` 0.14–0.19.
5. `npm run check`, then the user hears it in the preview with everything else. If they don't like it: `--force` for a new take (same prompt, new seed), or change the prompt. Log the prompt, seed and why in `notes.md`.
6. **Shorts:** each Short composes its own bed to its own length (`npm run compose -- <short> bed --prompt "<the parent's prompt>"`), so it has its own seed and a proper ending. A Short's `music/` is hard-linked from the parent; compose replaces only the Short's file.

## Prompts

Stable Audio 3 was trained on Freesound and AudioSparx; prompts that read like their metadata work best. Use this shape:

```
TrackType: Music, VocalType: Instrumental, Genre: <one or two>. <One or two sentences: the instruments, how they sound,
the mood and energy, the production.> <Tempo> BPM.
```

**What a bed under narration needs:**
- **Steady energy, no big drops or solos.** The voice is the lead. Ask for a "steady", "understated", "background" bed; avoid "drop", "climax", "solo", "anthemic".
- **Keep the voice's range clear.** Pads, pulses, low synths, light percussion and textures sit under speech; busy lead melodies, guitar solos and bright piano in the mid-range fight it.
- **Instrumental only.** The model doesn't sing, but it can make vocal-like textures: keep `VocalType: Instrumental` and avoid "choir" or "vocal".
- **Tempo:** 80–100 BPM for briefings, 100–120 for energetic tech, 60–80 for slow, intimate topics.
- **Match the theme and the subject**, not a genre for its own sake.

| Theme | Starting point |
|---|---|
| `frontier` (tech) | `TrackType: Music, VocalType: Instrumental, Genre: Electronic, Genre: Ambient. A sleek, forward-moving bed with soft analog synth arpeggios, a warm sub-bass pulse, airy pads and crisp minimal percussion, optimistic and curious, polished modern production. 108 BPM.` |
| `military`, `military-comparisons`, `threat-brief` | `TrackType: Music, VocalType: Instrumental, Genre: Cinematic, Genre: Electronic. A tense, steady briefing bed: low pulsing synth bass, muted taiko and ticking percussion, dark sustained strings, restrained and serious, no big hits. 92 BPM.` |
| `after-dark`, `erotic` | `TrackType: Music, VocalType: Instrumental, Genre: Downtempo, Genre: Lounge. A slow, intimate late-night bed: warm Rhodes chords, soft brushed drums, round upright-style bass, hazy reverb, sultry but understated. 76 BPM.` |
| `blackout` (dystopian tech) | `TrackType: Music, VocalType: Instrumental, Genre: Electronic, Genre: Dark Ambient. A cold, uneasy bed: a slow detuned analog synth pulse, deep sub-bass drone, glitchy ticking percussion, distant metallic textures and sparse dissonant pads, tense and steady, no big hits. 88 BPM.` |
| `clean-light` | `TrackType: Music, VocalType: Instrumental, Genre: Corporate, Genre: Electronic. A light, clean bed: plucked synths, soft marimba, gentle claps, bright but calm. 100 BPM.` |

Rewrite these for the episode's subject and mood (a space story, a court case and a gadget launch want different beds), and say what you changed in `notes.md`.

## Rules

- **License:** Stable Audio 3 weights are under the Stability AI Community License: free for commercial use under US$1M annual revenue, after a one-time free registration at https://stability.ai/community-license (the user's step). The user owns the output. The license asks for "Powered by Stability AI": `npm run credits` and the credits roll add it automatically for composed beds.
- **Credits are written for you** (`license: AI-GENERATED`, `generator.provider: local`). Don't edit them by hand. `check` accepts `AI-GENERATED` for `music/` only when it was made by compose, and never in `public/library/` (generated beds stay per episode).
- **Disclosure:** music generated with AI is "altered or synthetic content" only when it's realistic and could mislead; a background bed is not, but say "AI-generated music" in the description (the credits line does) and tick YouTube's box if the user's policy is to disclose all AI use.
- **No vocals, no imitation:** never prompt for a named artist's style, a specific song, or a real band ("in the style of …"). Describe the sound instead.
- **You can't hear it; the user can.** The bed is judged in the preview. Check what you can (length, level and the prompt against the mood), and when the user says it's too busy, too dark or off-mood, change the prompt in that direction rather than just re-rolling.

## Setup (one time)

- `npm run setup:music` creates `.venv-music` (Python 3.12, CUDA PyTorch 2.7.1, `stable-audio-3` pinned to a commit, Flash Attention 2 from a community prebuilt Windows wheel). It says whether the GPU and Flash Attention work.
- The weights are gated on Hugging Face (approval is automatic): accept the terms on https://huggingface.co/stabilityai/stable-audio-3-medium (and `-small-music`), then log in once with `.venv-music\Scripts\hf.exe auth login`, or put `HF_TOKEN=...` in `.env`. Compose says so when this is missing.
- **Models:** `medium` (1.4B, CUDA GPU with Flash Attention, ~5–6.5 GB VRAM, up to 380 s per pass, the default) or `small-music` (433M, runs on the CPU, up to 120 s per pass). Set `music_gen.model`, or `--model` for one run. Don't run it while a voice engine is generating: they share the 8 GB GPU.
