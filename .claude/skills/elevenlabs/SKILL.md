---
name: elevenlabs
description: Voice a Brief Kit episode or Short (or audition a line) with the ElevenLabs API through npm run voice --engine elevenlabs, in a voice on the user's ElevenLabs account (hacker_01 by default), sentence by sentence through the kit's usual pause, trim and align pipeline. Use when config.yaml has voice.engine elevenlabs, or when the user asks for ElevenLabs, an ElevenLabs voice, the hacker_01 voice, or an ElevenLabs take of a script.
---

# ElevenLabs voice

`npm run voice` with `--engine elevenlabs` (or `voice.engine: elevenlabs` in `config.yaml`) sends the script to the ElevenLabs API one sentence at a time, in the voice set in `voice.elevenlabs`. Everything after that is the same as for the other engines: each sentence is trimmed with a 250 ms tail and short fades (padded with silence first if the audio stops right at the last sound), the sentences are joined with `voice.pause` (double at paragraph breaks), the settings go to `episodes/<slug>/voice.json`, and `align` runs. It is an extra engine: the default stays whatever `voice.engine` says (`qwen-cloud` now). Don't change the default unless the user asks.

```powershell
npm run voice -- --sample "A line to try." --engine elevenlabs        # out/voice-samples/elevenlabs-<voice>.mp3
npm run voice -- <slug> --engine elevenlabs                            # the episode's voiceover, then align
npm run voice -- <slug> --engine elevenlabs --force                    # a new take (old one kept as voiceover.prev.mp3)
npm run voice -- <slug> --engine elevenlabs --out work/voice-takes/el-1.mp3   # a test take; the episode is untouched
npm run voice -- --voices                                              # lists the account's voices (* = default) and the quota
```

One-off overrides: `--voice <name|id>`, `--model <model_id>`, `--speed 0.7-1.2`, `--stability 0-1`, `--similarity 0-1`, `--style 0-1`, `--stitch text|ids|off`, `--concurrency N`, `--seed N`, `--pause S`.

## Setup

- **Key:** `ELEVENLABS_API_KEY` in a `.env` in the repo or a parent folder (the user's is in `c:\_activeDev\.env`), or in the environment. Read it only through the scripts (`scripts/lib/env.ts`); never print, log or commit its value.
- **Key permissions** (elevenlabs.io/app/settings/api-keys): **Text to Speech** is required. **Voices: Read** lets the kit look a voice up by name and list voices. **User: Read** lets it show the quota. With a key that has only Text to Speech, put the voice's ID in `voice.elevenlabs.voice_id` (ElevenLabs: My Voices, the voice, "ID") and the name lookup is skipped. If a run stops with "can't list voices", tell the user which of the two fixes they prefer; don't guess an ID.
- No Python setup beyond `npm run setup:voice` (the join step uses `.venv-tts`); no GPU.

## Choosing the voice

- `voice.elevenlabs.voice` is a name on the account (`hacker_01`), matched case-insensitively (then ignoring spaces, `_` and `-`), or a raw voice_id. An unknown name stops with the list of the account's voice names. Library voices must be added to My Voices first.
- The resolved name, ID and category (cloned, professional, premade, generated…) are printed and saved in `voice.json`.
- Audition with `--sample` before voicing a whole episode in a new voice or setting. Samples cost characters too: keep them short.

## Settings (`config.yaml` `voice.elevenlabs`)

| Key | Default | Notes |
|---|---|---|
| `model` | `eleven_multilingual_v2` | Most stable for narration, 29 languages, says foreign names well. `eleven_v4`: newest, highest quality (check the plan and price). `eleven_v3`: most dramatic, no request-id stitching. `eleven_flash_v2_5`: half the price per character, flatter. |
| `stability` | 0.5 | Lower is more expressive and varied, higher is steadier and flatter. For a steady news read, 0.5–0.65. |
| `similarity_boost` | 0.75 | How closely it sticks to the voice. |
| `style` | 0 | Exaggerates the voice's style; above 0 adds latency and can wobble. |
| `speaker_boost` | true | Slightly closer to the original speaker. |
| `speed` | 1.0 | 0.7–1.2. |
| `output_format` | `mp3_44100_128` | Works on every plan. `mp3_44100_192` needs Creator+, `pcm_44100` Pro+. |
| `stitch` | `text` | Continuity between sentences. `text`: each sentence goes with the two before it as `previous_text` and the next as `next_text`, so sentences run in parallel. `ids`: one at a time, each chained to the last three request IDs (`previous_request_ids`, ElevenLabs' preferred method; slower; not for `eleven_v3`, where it falls back to `text`). `off`: each sentence alone. |
| `concurrency` | 3 | Sentences in flight. The plan's limit: Free 2, Starter 3, Creator 5, Pro 10. Busy (429) responses are retried with backoff. |

`voice.seed` is sent too (seed + sentence number), so a re-run with the same settings and text usually gives the same take (ElevenLabs calls it best-effort). Change `--seed` for a different read of a flat or garbled line.

## Cost and quota

ElevenLabs bills per character of script text, at a rate that depends on the model and plan. Every run prints the characters billed (the sum of the `character-cost` ElevenLabs reports for each request) and, when the key has User: Read, the quota before and after. A full episode (~360 words) is about 2,000 characters. Before voicing a long script or several takes, check there is enough quota; a run that hits the limit stops with "quota exceeded" and nothing is written. Mention the characters used when you report the take, and log them in `notes.md` under "Voice".

## After voicing (same rules as every engine)

- **Captions show what was said (CLAUDE.md rule 5).** The audio is made from `voiceover.txt`, so when the voice misreads a word (align's mismatch report, `heard.txt`), respell that word in `voiceover.txt` for the ear and voice it again (`--force`). Never edit captions to cover a misread. Log respellings in `notes.md`.
- **Voice check, every voicing:** `npm run voice-check -- <slug>`, look at every HARSH and CHECK item, and fix real cut-offs by re-voicing or rewording (new-episode step 3c). ElevenLabs usually ends sentences cleanly, but check anyway; a re-voice with the same seed repeats the same take, so change `--seed` for a fresh one.
- The voiceover is heard in the preview with everything else (CLAUDE.md rule 6: with `voice.enabled: true` there is no MP3 handoff).

## Rights and credits

- **Commercial use** of ElevenLabs output (a monetized channel) needs a paid ElevenLabs plan; the Free plan is non-commercial and requires attribution. If the account's plan is unknown, ask the user once before voicing an episode that will be published.
- **The voice** must be one the user made from their own voice, owns, or has the rights to use (a voice they designed, a Voice Library voice used under ElevenLabs' terms, or a clone of someone who agreed in writing). Never make or use a clone of a real person without their consent, and don't copy an ElevenLabs voice into the kit's local cloning engines (`voices/README.md`).
- **Credits:** the kit doesn't credit TTS voiceovers in `credits.json` or the credits roll (no engine does); the provenance is `episodes/<slug>/voice.json` (engine, voice name and ID, model, settings). Follow suit, and note the engine, voice and model in `notes.md` under "Voice". If the user wants an on-screen or description credit for the voice, ask how they want it worded.
