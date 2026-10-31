# Brief Kit

A template for short, narrated countdown and list videos (Remotion + React), plus vertical **YouTube Shorts**. Each video is an **episode**: one folder of data and media. The components, scenes, sound design, captions, mastering and checks are already built, so making an episode never means editing a `.tsx` file. Around that core: local text-to-speech with your own cloned voice, locally generated music beds (Stable Audio 3) and AI stills (Z-Image Turbo, or FLUX 3 in the cloud), illustrated explainers and infographics as b-roll, synthesized sound effects, and licensed-media sourcing, with the optional parts switched on or off in `config.yaml`. Themes range from news and military briefings to `frontier`, a technology theme with scenes of its own.

```
article  ──►  fact-check  ──►  voiceover.txt  ──►  voiceover.mp3 (local TTS, or you record it)  ──►  align  ──►  episode.json + media  ──►  check  ──►  render
```

## Working with Claude (the usual way)

Brief Kit is built to be run with [Claude Code](https://claude.com/claude-code) as your production partner. **You bring the article** (and, if local TTS is off in `config.yaml`, the voiceover). Claude does the rest and stops at three points for your decision.

| Step | You | Claude |
|---|---|---|
| 1. Intake | Paste the article text (or a file path) and say *"let's start a new episode"* (or *"make a Short from this"*). Answer a few questions: format, item count, length, theme. | Scaffolds the episode and saves the article. |
| 2. Fact-check | — | Sends research agents to check every figure against reputable sources. Wrong numbers are replaced with sourced ones, unverifiable claims cut, and the sources list rebuilt. Every change goes in `notes.md`. |
| 3. Script | **Approve** the script, or ask for changes. | Writes `voiceover.txt` for text-to-speech, with a table of what the fact-check changed. With Shorts on (`config.yaml`), also writes 1–3 Short scripts from the same facts. |
| 4. Voiceover | With `voice.enabled: true` in `config.yaml`: nothing (you hear it in the preview). Otherwise record the script (e.g. ElevenLabs) and drop the MP3 in the episode folder. Optionally add your own music track (`.wav` or `.mp3`). | Voices the script with `npm run voice` (Qwen3-TTS, Chatterbox or Kokoro on your GPU in your cloned voice, Qwen3-TTS on Replicate, or an ElevenLabs voice through its API), or moves your MP3 into place. Aligns every word to the audio. Builds the music bed from your track, or, with `music_gen.enabled: true`, composes one with Stable Audio 3 sized to the video. |
| 5. Build | — | Writes `episode.json` and sends sourcing agents for licensed b-roll (PD / CC0 / CC BY / CC BY-SA only). Generates a labeled AI still for any shot it can't find (locally with Z-Image Turbo, or FLUX 3 for high-detail shots, per `image_gen.mode`), and runs `check` until it reports 0 errors. You can set the rules: "favor Russian footage", "cap the search at 45 minutes". |
| 6. Preview | **Watch** the preview Claude opens in your browser and say what to change. | Applies the changes live in Remotion Studio. |
| 7. Render | **Approve**. | Renders, masters to YouTube loudness, and writes the thumbnail and `DESCRIPTION.md`, which opens with a 1–2 sentence summary Claude writes from the fact-checked article. Then builds and renders any Shorts the same way. |

Then upload `out/<slug>/youtube.mp4` with the thumbnail and description, and each Short (`out/<slug>/short1.mp4`, …) with its own `DESCRIPTION.md`. If a video uses AI-generated stills that look realistic, tick YouTube's "altered or synthetic content" box. If it uses a composed music bed, keep the "Powered by Stability AI" line that `DESCRIPTION.md` already has (see [Using Stable Audio 3 legally](#using-stable-audio-3-legally)).

`CLAUDE.md` holds the rules Claude follows at every step, and `.claude/skills/new-episode/` holds the full procedure. Step away whenever you like: tell Claude to make its best calls, and it logs each decision in `notes.md` for you to review.

### Starting a session

```powershell
cd brief-kit
claude                    # or open the folder in VS Code with the Claude Code extension
```

Then paste the article and say *"let's start a new episode"*.

### Just ask in plain words

You don't need the commands, slugs or file paths in the rest of this README. Claude picks the slug, runs the `npm` commands, and finds the right episode from context. Say what you want:

- *"Recon"* (experimental: Claude reads your X lists and what's trending on X in your own Brave, read-only, and brings back a ranked list of video ideas, each with a blurb on why. Run it from the Claude Code CLI; setup is under [Recon (experimental)](#recon-experimental-claude-in-your-browser))
- *"Let's start a new episode"* (then paste the article)
- *"Make it the top 5, about 5 minutes, same look as the last one"*
- *"Verify those facts on the web and update the sources"*
- *"I added the voice MP3 and a music track"*
- *"Favor Russian footage, cap the search at 45 minutes, and use FLUX for anything you can't find"*
- *"Make an infographic comparing the ranges for the Geran segment"*
- *"Screenshot the Wikipedia infobox for the Shahed as b-roll"*
- *"Use NVIDIA's post on X as a source and show it on screen"* (only with `x_posts.enabled: true`)
- *"The artillery shot in the Lancet segment runs too long, use a Lancet clip"*
- *"Open the preview"* / *"Render it"*
- *"Re-render last week's episode with a new thumbnail"*
- *"Make two Shorts from this episode"* / *"Make a standalone Short about the LOCUST laser"*
- *"Voice it with my collin_ro voice"* / *"Record a new voice called collin_calm"*
- *"Make a military explainer on why a draft doesn't instantly produce an army"*
- *"Make a sonar ping sound for the submarine segment"*
- *"Use the tech theme"* / *"Make the explainer in creative mode, your call"*
- *"Compose a darker bed for this one"* / *"Give me another take of the music"*
- *"Render the stills locally"* / *"Use FLUX for the thumbnail"*

To come back to an older episode, describe it (*"the Russian drone one"*). Claude lists the episodes and picks the match.

---

## One-time setup

You need Node 22, ffmpeg on `PATH`, Python 3.10+ (for alignment and the image lead finder), and Claude Code.

```powershell
npm install
npm run setup:align      # creates .venv and installs requirements.txt; the Whisper model (~1.5 GB) downloads on first align
copy .env.example .env   # optional: add REPLICATE_API_TOKEN for the AI-image fallback (see the comments in the file)
```

Optional, for local text-to-speech instead of ElevenLabs (needs [uv](https://docs.astral.sh/uv/); an NVIDIA GPU with 6 GB+ is strongly recommended):

```powershell
npm run setup:voice      # creates .venv-tts (Python 3.12) and installs requirements-tts.txt: CUDA PyTorch, Chatterbox, Kokoro (~4 GB)
npm run setup:voice -- --qwen   # optional third engine: .venv-qwen + requirements-qwen.txt (Qwen3-TTS; model ~4.5 GB on first use)
npm run setup:music      # local music beds: .venv-music + requirements-music.txt (Stable Audio 3, Flash Attention; see below)
```

Optional, for local AI stills (Z-Image Turbo through stable-diffusion.cpp; no Python needed):

```powershell
npm run setup:image      # sd-cli + Z-Image Turbo Q4_K + Qwen3-4B encoder + FLUX.1 VAE into models/image/ (~6.7 GB); --from <folder> hard-links files you already have
```

### Recon (experimental): Claude in your browser

Recon has Claude read your X lists and X's trending pages in **your own browser**, signed in as you, through the Claude browser extension ("Claude in Chrome"). It's experimental. It hasn't had a full run yet. It depends on X's page layout, which changes without notice, and on Brave, which Anthropic supports but tests less than Chrome and Edge. Expect to tune it after the first runs.

**Run recon from the Claude Code CLI in a terminal, not the VS Code chat panel.** `/chrome` is a CLI command, and the browser tools only load into a session that starts after the integration is on.

1. **In Brave:** install the Claude extension from the Chrome Web Store (version 1.0.36 or later) and sign it in to the same claude.ai account as Claude Code.
2. **In a terminal**, in this folder, start the CLI and turn the integration on:

   ```powershell
   cd brief-kit
   claude
   ```

   At the Claude prompt type `/chrome` (in Claude Code, not in Brave) and pick **Enabled by default**. If Chrome also has the extension, use **Select browser…** and pick Brave.
3. **Restart Brave** completely (quit and reopen). It reads the connection settings only at startup.
4. **Start a fresh CLI session** (exit, then `claude`, or `claude --chrome`) and say *"recon"*.

If it doesn't connect:

- **Sign-in method.** Claude Code must be signed in with `/login`. An API key or a `claude setup-token` token keeps the browser tools off.
- **Account.** The extension and Claude Code must use the same claude.ai account and organization; otherwise the tools report "Browser extension is not connected".
- **Registration.** If Brave still isn't detected, check that the registry key `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\` exists. If it's missing, Claude Code hasn't registered itself with Brave yet: run `/chrome` again and restart Brave.
- **Update.** Old Claude Code builds didn't detect Brave; run `claude --version` and update if you're behind.

When it runs, Claude only reads. It never likes, posts, follows or replies, and it stops and asks you whenever X shows a login page or a CAPTCHA. Settings are in `config.yaml` `recon:`, the procedure is in `.claude/skills/recon/SKILL.md`, and each run's report is saved in `recon/<date>.md`.

### config.yaml at a glance

| Section | What it switches | Now |
|---|---|---|
| `voice:` | Text-to-speech. `true`: Claude voices each approved script (`npm run voice`). `false`: you bring `voiceover.mp3`. | on (Qwen3-TTS cloning `collin_ro`, on Replicate: `qwen-cloud`) |
| `shorts:` | Shorts made with every episode (`count` 1–3, `maxSeconds`). | off (ask for Shorts per episode) |
| `music_gen:` | Composed music beds with Stable Audio 3 (`model`, `steps`, `lufs`). A fresh random seed every run. | on (medium) |
| `licensing:` | `press_images`: official manufacturer press images (newsroom / press kit) of a product being discussed, credited `PRESS`. An opt-in risk: they're editorial-use material, not CC. Never the thumbnail. `stock_media`: Pixabay, Pexels and Coverr (own free licenses, not CC) for **music videos only**, searched first with `npm run stock` and credited `STOCK`. Risk: YouTube Content ID claims by contributors. | press on; stock: music-video |
| `youtube:` | YouTube as a research source and clip source (`npm run youtube`, no API key). `search_youtube`: Claude searches YouTube and reads transcripts during the fact-check and asset steps (off: no YouTube unless you ask). `use_video_as_citation`: a video can be a cited source (off: videos are leads only, and a fact from one needs a non-YouTube source that confirms it). | both on |
| `x_posts:` | Posts on X as sources (`npm run xpost`): official or well-known accounts only, archived with a screenshot, optionally shown on screen (credited `X POST`). Off: posts are leads only. | off |
| `recon:` | Video ideas from X (the recon skill): the `lists` and `trending` pages Claude reads in your browser, how far back (`hours_back`), and how many ideas to report. | your two lists, 48 h, 8 ideas |
| `image_gen:` | Where AI stills come from: `local_render`, `cloud_render` or `mixed` (local, with FLUX 3 for `--detail high`). Local steps, CFG, size and negative prompt live under `local:`. | mixed |

### Using Stable Audio 3 legally

Stable Audio 3 is open-weight, not open-source. The model weights are under the [Stability AI Community License](https://stability.ai/community-license-agreement), and the text encoder bundled inside them (T5Gemma) under Google's [Gemma Terms of Use](https://ai.google.dev/gemma/terms). For a monetized channel:

1. **Accept the terms on Hugging Face.** The model repos are gated (approval is automatic): [stable-audio-3-medium](https://huggingface.co/stabilityai/stable-audio-3-medium) and [stable-audio-3-small-music](https://huggingface.co/stabilityai/stable-audio-3-small-music). Then log in once (`.venv-music\Scripts\hf.exe auth login`, or `HF_TOKEN=...` in `.env`).
2. **Register for commercial use.** It's free, and required for commercial use, which a monetized channel is: [stability.ai/community-license](https://stability.ai/community-license). (Done, 2026-10-20.)
3. **Stay under US$1M a year in revenue** (you and your affiliates together). Above that the license ends and you need Stability's Enterprise license.
4. **Credit "Powered by Stability AI".** `npm run credits` adds it to `DESCRIPTION.md`, and the credits roll shows it for every composed bed. Keep that line when you paste or edit the description.
5. **Follow the Acceptable Use Policies** (Stability's and Gemma's): nothing illegal, deceptive or infringing. The kit's own rule goes further: never prompt "in the style of" a named artist, band or song.
6. **Don't train other AI models on the outputs.** The license forbids using them to build or improve another foundation model.
7. **Keep the provenance.** You own the outputs to the extent the law allows. `credits.json` records the model, prompt, seed and steps of every bed, which is your evidence if a Content ID claim ever lands on one.
8. **Don't redistribute the weights.** The kit only downloads them to your Hugging Face cache. Sharing the model files themselves would bring extra notice requirements.

Disclosure: YouTube's "altered or synthetic content" label is for realistic content that could mislead. A background bed usually isn't that, but the description's credit line says it's AI-generated either way. This is a summary, not legal advice; the license text decides.

The other generators are simpler: Z-Image Turbo (local stills) and its Qwen3-4B encoder are Apache-2.0 (no registration, commercial use allowed), FLUX 3 runs under Replicate's and Black Forest Labs' API terms, and the TTS engines' licenses are in the voice table below.

Python packages are pinned in `requirements.txt`: faster-whisper and numpy for `align`, and ddgs for the find-media skill's DuckDuckGo lead finder. The TTS packages are pinned separately in `requirements-tts.txt` (Chatterbox, Kokoro) and `requirements-qwen.txt` (Qwen3-TTS), because Kokoro needs Python 3.12, PyTorch brings its own numpy, and Qwen pins a different `transformers` than Chatterbox. To install them by hand, run `.venv\Scripts\python.exe -m pip install -r requirements.txt`. `npm run shot` and `npm run infographic` drive the headless Chrome that Remotion already downloads (through `playwright-core`), so they need no extra browser.

The rest of this README is reference: the commands and files Claude uses at each step. You only need it to see how things work, or to run a step yourself without Claude.

## Make a new episode

Slugs are lowercase with dashes. Start them with the date so they sort: `2026-10-24-threat-brief`.

### 1. Scaffold

```powershell
npm run new -- 2026-10-24-threat-brief                       # countdown, 10 segments, theme threat-brief
npm run new -- 2026-10-24-tech-five --format list --count 5 --theme clean-light
npm run new -- 2026-10-24-locust-short --format short          # a standalone YouTube Short (see 7. Shorts)
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

### 3. Voice and align

**Local TTS** (`voice.enabled: true` in `config.yaml`):

```powershell
npm run voice -- <slug>                                # voiceover.txt -> public/episodes/<slug>/voiceover.mp3, then align
npm run voice -- <slug> --force                        # a new take (the old one is kept as voiceover.prev.mp3)
npm run voice-check -- <slug>                          # scan the voiceover for harsh stops (words cut off at pauses)
npm run voice -- <slug> --engine kokoro --voice bm_george --force
npm run voice -- --sample "A line to try."             # out/voice-samples/, to audition a voice or setting
npm run voice -- --voices                              # your cloned voices (* = default), your ElevenLabs voices and Kokoro's presets
npm run voice -- <slug> --engine elevenlabs --force    # a take in your ElevenLabs voice (voice.elevenlabs; needs ELEVENLABS_API_KEY)
npm run voice -- --record collin_calm                  # record a new voice from your mic into voices/ (see voices/README.md)
npm run voice -- <slug> --out <file>.mp3               # voice the script into another file; the episode is untouched
npm run voice -- <slug> --ignore-off                   # one episode while voice.enabled is false (never overwrites without --force)
```

**Cloud option:** `engine: qwen-cloud` runs the same Qwen3-TTS voice clone on Replicate (the official `qwen/qwen3-tts` model, Apache-2.0), sending every sentence at once: about a minute per episode instead of ~7 locally, at roughly 2.6 s of Replicate GPU time per sentence (cents per episode). It needs `REPLICATE_API_TOKEN`, uploads your reference clip to Replicate, and has no seed, so each run is a fresh take. `--engine qwen` voices locally as before.

**ElevenLabs option:** `engine: elevenlabs` (or `--engine elevenlabs` for one run) voices the script through the ElevenLabs API in a voice on your account, set by name in `voice.elevenlabs.voice` (`hacker_01` now) and resolved to its ID, or by ID in `voice.elevenlabs.voice_id`. It goes through the same sentence-by-sentence pipeline as the other engines (same `pause`, trims, tails and fades, then align), with each sentence sent alongside its neighbours as context (`stitch: text`; `ids` chains requests by ID instead, one at a time), 3 at a time by default (`concurrency`, up to your plan's limit), retrying when ElevenLabs is busy. It needs `ELEVENLABS_API_KEY` in `.env` (this folder or a parent) and is billed per character of script; each run prints the characters billed, and the quota left when the key may read it. A key limited to Text to Speech works if you put the voice's ID in `voice_id`; give it **Voices: Read** to look voices up by name and list them in `--voices`, and **User: Read** to see the quota. Model, stability, similarity, style, speed and output format are in `config.yaml` with their options. Commercial use of the output needs a paid ElevenLabs plan, and the voice must be one you made, own or have the rights to. Details: `.claude/skills/elevenlabs/SKILL.md`.

It reads the script sentence by sentence, trims each one with a 250 ms tail and a short fade (so word endings never click off), joins the sentences with short pauses (longer at paragraph breaks), writes the settings it used to `episodes/<slug>/voice.json`, and runs `align`. With a fixed `seed`, the same text gives the same take; change the seed for a different read. A word it says wrong shows up in align's mismatch report and in `heard.txt`: respell it in `voiceover.txt` the way it should sound and voice it again.

| Engine | License | Voice | Speed on an RTX 4070 Laptop (8 GB) | VRAM |
|---|---|---|---|---|
| `chatterbox` + `turbo` | MIT | clones `voice.reference` (your voice) | ~3× realtime at best (a 2:50 script in under a minute) | ~3.2 GB |
| `chatterbox` + `standard` | MIT | built-in voice, or a clone; `exaggeration` / `cfg_weight` controls | ~1× realtime | ~3.1 GB |
| `kokoro` | Apache-2.0 | 28 English presets (`am_michael`, `bm_george`, `af_heart`…) | ~5× realtime | ~0.7 GB |
| `qwen` (1.7B or 0.6B) | Apache-2.0 | clones `voice.reference` + its transcript `voices/<name>.txt` | ~0.1–0.6× realtime, depending on the laptop's power state (see the note below) | ~4.6 GB (1.7B), ~2.8 GB (0.6B) |
| `qwen-cloud`, **the current default** | Apache-2.0 | the same clone as `qwen`, on Replicate | about a minute per episode | none (cloud) |
| `elevenlabs` | ElevenLabs terms (paid plan for commercial use) | a voice on your ElevenLabs account (`voice.elevenlabs.voice`) | several times realtime (3 at a time) | none (cloud) |

Models download on first use (Chatterbox ~2 GB, Kokoro ~330 MB, Qwen 1.7B ~4.5 GB) into the Hugging Face cache. Chatterbox output carries Resemble's inaudible Perth watermark, which marks the audio as AI-generated. How to record a reference clip and what you may clone: `voices/README.md`.

> **Note: Qwen3-TTS and foreign names (added 2026-10-19).** Chatterbox and Kokoro are English-only, so they guess at Russian and Ukrainian names ("Zaporizhzhia", "Syrskyi", "Novorossiysk") from English spelling rules. ElevenLabs, which is multilingual, says them better. Chatterbox `standard` does slightly better than `turbo`. **Qwen3-TTS** (`engine: qwen`, Apache-2.0, Alibaba's Qwen team) is a multilingual model that includes Russian (not Ukrainian), so it is the local engine most likely to get these names right. It runs in its own `.venv-qwen` (`npm run setup:voice -- --qwen`), because it pins a different `transformers` than Chatterbox.
>
> - **Transcript:** it clones from the reference clip *and* a transcript of it, `voices/<name>.txt`. The first run makes that file with Whisper; correct it by hand if a word is wrong, since a wrong transcript hurts the clone.
> - **Speed:** on the RTX 4070 Laptop it fits easily (4.6 GB for 1.7B, 2.8 GB for 0.6B), but it is slower than Chatterbox: between 0.1× and 0.6× realtime in our runs (a 2:46 episode took 5 minutes at 0.5×; the slowest runs would take half an hour), at both sizes and with either attention setting. The bottleneck is not the GPU: during generation the GPU sits at 35–40% in a low power state while the Python process holds one CPU core at ~93%, feeding the model one step at a time. That makes it very sensitive to single-core CPU speed. Measured with Windows power mode on **Balanced**; switching to **Best performance** (Settings → System → Power) and the laptop vendor's performance profile (MSI Center: *Extreme Performance*), on AC power with other GPU apps closed, should speed it up noticeably, and helps Chatterbox too (it dropped from 2.7× to about 1× realtime on the same evening). Untested beyond that; flash-attention isn't available on Windows.
> - **Use it** for name-heavy scripts or single lines: `npm run voice -- --sample "…" --engine qwen`, or `npm run voice -- <slug> --engine qwen --out <file>.mp3` to try a whole episode without touching its voiceover.

Older takes voiced before that fix (hard cuts at sentence ends) can be softened in place without re-voicing: `.venv\Scripts\python.exe scripts\soften_cuts.py public\episodes\<slug>oiceover.mp3 --keep out\<slug>` fades the 50 ms before every pause, keeps the length (timing stays valid) and saves the original as `voiceover.before-fade.mp3`.

**config.yaml** turns it on or off and sets the defaults; any setting can be overridden per run (`--engine`, `--model`, `--size`, `--reference`, `--voice`, `--speed`, `--seed`, `--pause`). As set now: TTS on, Qwen3-TTS on Replicate cloning `collin_ro`, a 20 s excerpt of your ElevenLabs voice, with ElevenLabs itself one `--engine elevenlabs` away:

```yaml
voice:
  enabled: true            # true: Claude voices each approved script itself; false: you bring voiceover.mp3 (ElevenLabs, a mic)
  engine: qwen-cloud       # qwen-cloud | qwen | chatterbox | kokoro | elevenlabs
  reference: voices/collin_ro.wav  # the voice chatterbox and qwen clone
  chatterbox: { model: turbo, exaggeration: 0.5, cfg_weight: 0.5 }   # model: turbo (default) | standard
  qwen: { size: 1.7B, language: English }
  kokoro: { voice: am_michael, speed: 1.0 }
  elevenlabs: { voice: hacker_01, model: eleven_multilingual_v2, stability: 0.5, similarity_boost: 0.75, speed: 1.0, stitch: text, concurrency: 3 }
  pause: 0.35
  seed: 7
```

**Your own recording** (`voice.enabled: false`, or any time):

1. Record or generate the voiceover (e.g. ElevenLabs) and save it as `public/episodes/<slug>/voiceover.mp3`.
2. Run:

   ```powershell
   npm run align -- <slug>       # ~3 min on CPU for 2:15 of audio
   ```

   It prints how many script words matched the audio, plus the time of every segment marker. Under 90% means the recording differs from the script (for example, you edited lines in ElevenLabs). Whisper's transcript is saved to `episodes/<slug>/heard.txt`. Edit `voiceover.txt` to match what was actually said and align again. Captions use the script's own words, so they must match the audio, and each caption chunk appears the moment it starts being spoken.

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

Every field is documented in `src/kit/schema.ts`. Editors that read JSON Schema (VS Code does) show hover docs and autocomplete, because each `episode.json` points at `episodes/episode.schema.json`. At the top level, every episode also gets:

- `"summary"`: 1–2 sentences for the top of the YouTube description (facts from the article and fact-check only). `npm run credits` writes it into `DESCRIPTION.md`, and `check` warns while it's missing.

Optional extras:

- `"emphasis": "top"`: alarm treatment and a "TOP THREAT" badge (usually on #1).
- `"note": "FILE FOOTAGE · LVIV, 2022"` on a visual: an on-screen tag for footage that isn't of the event described.
- `"grade": false` on a visual: show it as it is, without the theme's filter and tint (for explainers and infographics already drawn in the theme). The gradients behind the text still apply.
- `"side": "right"` on a segment (overlay layouts): the number, region, headline and stat block sits on the right instead of the left. It tucks into the top-right corner, the side gradient is mirrored and the map card moves to the left.
- `"exitAt": "<cue>"` on a segment (overlay layouts and Shorts): at that spoken phrase the number, headline and stat block slides off screen and stays off, for when a full-frame explainer or infographic comes up. On a Short it fades the text panel instead.
- **Every episode ends with a sources scene and a credits scene.** After the voiceover, a "SOURCES" card lists `sources` (title + site) for 7s (more than 8 sources are split evenly over several cards, 7s each). Then a "CREDITS" roll built from `credits.json` (footage, images, AI illustrations, music, sound, map data) runs for 8s, listing only what the episode actually uses, the same as `DESCRIPTION.md`. Change the lengths with `"outro": { "sourcesCard": { "seconds": 7 }, "creditsCard": { "seconds": 8 } }`, or turn one off with `false`. `check` fails an episode with no `sources` while its sources card is on.
- `"outro": { "endScreen": { "seconds": 12 } }`: a branded hold frame after the voiceover (and after the sources card, if any), with empty slots for YouTube's end-screen elements.
- `"thumbnail": { "big": "10", "title": "FLASH\nPOINTS", "visual": "gulf_navy" }`: the theme's classic thumbnail.
- `"thumbnail": { "layout": "punch", "variants": [{ "big": "14", "title": "KOREAN\nWEAPONS", "visual": "k2_firing", "frame": 6.3, "position": "78% 55%", "zoom": 1.1 }, …] }`: up to 3 thumbnails for YouTube's **Test & Compare**, each overriding the fields around it. `punch` is built to read at phone size and stand out in dark mode: a bright photo with the subject framed (`position`, `zoom`; `frame` picks the clip moment in seconds) to fill the right half, and 2–4 huge dark words on a solid accent slab, with no brand or date line.
- `"audio": { "music": { "file": "bed", "level": 0.22, "duck": true }, "sfxPreset": "intense" | "calm" | "tech" | "none" }` (`tech` is made for the `frontier` theme)

### 5. Media and licenses

- B-roll clips go in `public/episodes/<slug>/clips/<name>.mp4`: 1920×1080 H.264, no audio, ≤ 8s, no watermarks or burned-in text. Stills go in `images/<name>.jpg`. `name` is what `episode.json` refers to.
- **Every file needs an entry in `public/episodes/<slug>/credits.json`**, and only PD, CC0, CC BY and CC BY-SA licenses are allowed:

  ```json
  { "file": "clips/drone.mp4", "title": "MQ-9 Reaper aerial video", "author": "Senior Airman Haley Stevens",
    "license": "PD", "sourceUrl": "https://commons.wikimedia.org/wiki/File:..." }
  ```

  Optional fields: `licenseVersion` ("4.0"), `originalUrl`, `notes`.
- **Where files go.** Raw downloads (original clips, stills, logos, sounds) go in `episodes/<slug>/raw/<name>/`, one new folder each. Working files (contact sheets, test stills, sync clips, explainer drafts, storyboard review pages, logs) go in `episodes/<slug>/work/`. Finished media stays in `public/episodes/<slug>/`. `raw/` and `work/` are local-only (git-ignored).
- **YouTube research and clips.** `npm run youtube` uses yt-dlp from the kit's `.venv` (installed by `npm run setup:align`), so it needs no API key. Whether Claude uses it, and whether a video can be cited, is set by `youtube:` in `config.yaml` (see above). Raw material lands in `episodes/<slug>/raw/youtube/`.

  ```powershell
  npm run youtube -- <slug> search "drone footage" --limit 10 --cc        # a table of hits; --cc keeps only Creative Commons videos
  npm run youtube -- <slug> transcript <id|url> --words 300              # info.json + transcript.txt ([mm:ss] per paragraph); prints the first 300 words
  npm run youtube -- <slug> clip <id|url> <name> --from 1:23 --to 1:31   # clips/<name>.mp4, credited, assets.json refreshed
  npm run youtube -- --update                                            # upgrade yt-dlp when extraction breaks
  ```

  As research, a transcript is a lead like any other source: facts from it are judged by the channel, logged in `notes.md`, and figures from auto captions are confirmed a second way before they are scripted. As a clip source it is strict. The video must carry YouTube's Creative Commons (CC BY) license, which is checked before anything downloads, or come from a verified US federal agency's own channel (public domain, passed as `--license PD --basis "NASA, US federal work"`). Clips are at most 15 s, 1920×1080, 30 fps, no audio. The kit draws a small `VIDEO · <Channel> / YouTube` tag on the clip automatically, from the credit, so never burn one in. A YouTube clip can't be the thumbnail. `--ignore-off` runs a one-off while `search_youtube` is false. Rules and procedure: `.claude/skills/youtube/SKILL.md`.
- **No good image anywhere, or only a poor stand-in?** Generate a still, locally with Z-Image Turbo or with FLUX 3 via Replicate (`config.yaml` `image_gen.mode`: `local_render`, `cloud_render`, or `mixed`, which renders locally and sends `--detail high` work such as thumbnail backgrounds to FLUX):

  ```powershell
  npm run generate -- <slug> tanker_dusk --prompt "Oil tanker at anchor at dusk, subject on the right third, empty space on the left, muted colors, documentary photography. No text, no logos, no flags, no identifiable people."
  ```

  Local renders use stable-diffusion.cpp and Z-Image Turbo (Tongyi-MAI, Apache-2.0) as a Q4_K GGUF in `models/image/`: free, about 35–55 s each on an 8 GB laptop GPU, a fresh random seed every run (`--seed` remakes one). Set it up once with `npm run setup:image` (`--from <folder>` hard-links files you already have). Steps, CFG, size and the default negative prompt are in `config.yaml` `image_gen.local`; `--sample "prompt"` tries a prompt into `out/image-samples/`. FLUX renders need `REPLICATE_API_TOKEN` in the environment or in a `.env` file in this folder or a parent folder, and each is a paid API call. Either way it writes `images/<name>.jpg` (1920×1080) and a credits entry with license `AI-GENERATED`, plus the exact prompt and the seed or prediction id. A generated visual must carry `"note": "AI-GENERATED ILLUSTRATION"` (check enforces this). If it looks realistic, tick YouTube's "altered or synthetic content" box when uploading. Prompt rules are in `.claude/skills/generate-image/SKILL.md`.
- **A web page as b-roll** (an encyclopedia infobox, an official notice, a data table): screenshot part of it.

  ```powershell
  npm run shot -- <slug> wiki_shahed --url https://en.wikipedia.org/wiki/HESA_Shahed_136 --selector "table.infobox"
  npm run shot -- <slug> dod_notice --url https://www.defense.gov/News/... --license PD --author "U.S. Department of Defense" --scroll-to "h1" --highlight "one-way attack"
  ```

  It writes `images/<name>.png` (1920×1080) and a credits entry with the page as the source. By default the capture sits centered on a blurred copy of itself; `--fit cover` and `--fit raw` are the alternatives. The page has to meet the same license rules as any media: PD, CC0, CC BY or CC BY-SA. Wikipedia text is filled in as CC BY-SA 4.0 automatically. Every other site needs `--license`, plus `--author` for CC BY and CC BY-SA. Commercial news sites are not allowed. Photos and logos on a page carry their own licenses, so crop them out or check them. Other options: `--clip x,y,w,h`, `--full`, `--hide "<css>"` (cookie banners are hidden by default), `--width`/`--height` (a narrower viewport gives bigger text) and `--dark`. Give the visual a `note` naming the site, e.g. `"SOURCE · EN.WIKIPEDIA.ORG"`.
- **A post on X as a source**, only when `config.yaml` has `x_posts.enabled: true` (off by default: posts are leads). The account must speak officially for the company, agency or military involved, or be someone widely recognized in that field, and the post counts for what they said, attributed in the script.

  ```powershell
  npm run xpost -- <slug> https://x.com/nvidia/status/<id> --basis "NVIDIA's official account" --still nvidia_post
  ```

  No login needed: it reads X's public embed data and screenshots X's own embed of the post. Every run archives the proof in `episodes/<slug>/raw/xpost/<id>/` (`post.json` with the exact text, author, date, badge and basis, plus `post.png`) and prints the line for `sources` and one for `notes.md`. `--still <name>` also writes `images/<name>.png` (1920×1080 card), credited `X POST`; it's never the thumbnail. `--no-media` hides the post's photo or video when it isn't the poster's own, and `--light` uses X's light theme. `check` errors on any X link in `sources` while the option is off, and warns when a cited post has no saved proof.
- **An infographic** (bar comparison, big number, timeline, versus card): write a small HTML page in `episodes/<slug>/infographics/<name>.html`, starting from `.claude/skills/infographic/template.html`, and render it in the episode's theme:

  ```powershell
  npm run infographic -- <slug> range_bars             # clips/range_bars.mp4, 12 s: animates in, then holds
  npm run infographic -- <slug> range_bars --still     # images/range_bars.png
  ```

  The page gets the theme's colors and fonts as CSS variables (`--accent`, `--highlight`, `--font-display`…). The renderer steps CSS animations and an optional `window.bkSeek(ms)` through the clip frame by frame, so motion lands exactly on each frame. The credit is `OWN WORK`, with the data sources from `<meta name="sources">` in its notes. Like everything else on screen, the numbers must come from the script and the fact-check. Rules and layout patterns are in `.claude/skills/infographic/SKILL.md`.
- **An illustrated explainer** (Manga Page, Military HUD…): a canvas animation in a named style with a synthesized sound score, storyboarded first. Styles are a starting point, not a limit, and the length follows the content. Say *creative mode* (or "your call") to let Claude choose the medium, angle, length and placement itself, inventing a look with `--style freeform` and fonts with `--fonts "Anton|Space Grotesk:wght@400;700"`. `npm run explainer -- new <name> --style <id> --episode <slug>` scaffolds `episodes/<slug>/infographics/<name>.html`, and the same `npm run infographic` renders it as silent b-roll. Without `--episode` it is a standalone piece, and `npm run explainer -- render <name>` gives an MP4 with sound in `out/explainers/<name>/`. See `.claude/skills/explainer/SKILL.md`.
- Sound effects and the music bed are shared across episodes in `public/library/` (credited in `public/library/credits.json`). An episode can override one by adding `sfx/<name>.mp3` or `music/<name>.mp3` to its own folder.
- **A new sound effect** can be synthesized instead of sourced: `npm run sfx -- <slug> sonar_ping --recipe` renders `episodes/<slug>/sfx/sonar_ping.js` (a function of the explainer sound kit: `(k) => { k.tone(0, { f: 1400, dur: 1.6, verb: 0.6 }); }`), and `--sound stamp --dur 0.3` renders one ready-made kit sound. `npm run sfx -- list` shows them. The MP3 lands in the episode's `sfx/`, normalized to the library's level and credited `OWN WORK`, ready for `audio.sfxExtra`. `--library` puts it in `public/library/` for all episodes.
- **A music bed generated locally** with Stable Audio 3 Medium (Stability AI), when `config.yaml` has `music_gen.enabled: true`: `npm run compose -- <slug> bed --prompt "TrackType: Music, VocalType: Instrumental, Genre: Electronic. …, 108 BPM"` writes `public/episodes/<slug>/music/bed.mp3`, sized to the whole video (longer than 6:20 is extended with the model's own continuation, never hard-looped), level-matched to the library bed, and credited `AI-GENERATED` with its prompt and seed ("Powered by Stability AI" goes into the credits roll and `DESCRIPTION.md` automatically). Every run takes a fresh random seed; `--force` gives another take, `--seed <n>` remakes one, and `--sample "prompt"` auditions a prompt into `out/music-samples/`. One-time setup: `npm run setup:music`, accept the model terms on [Hugging Face](https://huggingface.co/stabilityai/stable-audio-3-medium) and log in (`.venv-music\Scripts\hf.exe auth login`, or `HF_TOKEN` in `.env`). The weights are under the Stability AI Community License: free commercial use under US$1M a year in revenue, after a free [registration](https://stability.ai/community-license). Prompts and rules: `.claude/skills/compose-music/SKILL.md`.

Then:

```powershell
npm run assets -- <slug>      # ffprobes everything, writes assets.json
```

### 6. Check, preview, render

```powershell
npm run check -- <slug>       # must report 0 errors
npm run preview -- <slug>     # opens the browser on this episode in Remotion Studio; watch it with sound
npm run render -- <slug>      # after you're happy with the preview: check, render, master
npm run thumb -- <slug>       # out/<slug>/thumbnail.png, or thumbnail-1…3.png with variants
npm run credits -- <slug>     # out/<slug>/DESCRIPTION.md for YouTube
npm run upload-text -- <slug> # out/<slug>/upload.json: title + a description YouTube accepts (≤ 5,000 chars); then the youtube-upload skill
```

Rendering a ~2:20 episode takes several minutes on a laptop GPU. Plug in to AC power first. Outputs:

| File | Use |
|---|---|
| `out/<slug>/video.mp4` | Raw mix (around -26 LUFS) |
| `out/<slug>/youtube.mp4` | **Upload this.** Mastered to -14 LUFS ±1, true peak ≤ -1 dBTP |
| `out/<slug>/thumbnail.png` | 1280×720 thumbnail (variant 1 when there are `variants`) |
| `out/<slug>/thumbnail-1…3.png` | The `thumbnail.variants`, to upload together to YouTube Studio's Test & Compare |
| `out/<slug>/DESCRIPTION.md` | The `summary` from `episode.json` (1–2 sentences), chapters, sources and credits. Regenerated by `npm run credits`, so edit the summary in `episode.json`, not here |
| `out/<slug>/REFERENCES.md` | Just the numbered source list with links, to paste into the description |

For a quick partial render, pass Remotion flags after a second `--`: `npm run render -- <slug> -- --frames=0-299`.

### 7. Shorts (optional)

YouTube Shorts are vertical videos (9:16, 1080×1920), 60 seconds or less here. In the kit, each Short is a **small episode of its own** (`format: "short"`, `aspect: "9:16"`) with its own script, voiceover and `episode.json`, so every command above works on it. A Short has a hook stamp, a title, 1–3 scenes (b-roll full height, each opening on its map if it has one, with the headline and stats stacked in the clear zone) and an outro with the CTA. Everything sits clear of the Shorts player's own overlays: the icons at the top, the title and channel at the bottom, and the buttons on the right.

- **From an episode:** `npm run short -- <slug> [--count 1-3]` makes `<slug>-short1`, `-short2`, … with the parent's theme, brand, music, sources and article, and its media hard-linked in (no extra disk space) with the credits. Write each Short's script (≤ 60 s, from the parent's facts) and `episode.json`, voice or record it, align, check, preview, and render. `npm run render -- <slug>-short1` also copies the result to `out/<slug>/short1.mp4`, next to the main video.
- **Standalone:** `npm run new -- <slug> --format short [--count 1-3]` (count = scenes) makes a Short with its own article and fact-check, carrying the channel's brand and theme.
- **config.yaml** turns the per-episode Shorts on (`shorts.enabled`), sets how many (`shorts.count`, 1–3) and the target length (`shorts.maxSeconds`; check warns above it and errors past YouTube's 3-minute limit). When it's on, Claude writes the Short scripts at the script-approval step, so you record everything in one session, and renders the Shorts after the main video.
- Shorts have no on-screen sources and credits rolls; `npm run credits -- <short>` puts the sources, credits, a link line for the full video and `#Shorts` in its `DESCRIPTION.md`. There's no thumbnail step: YouTube picks a frame.

### 8. Music videos

A music video turns one of your songs into a video: licensed archive footage and illustrated explainers cut to the lyrics, with optional subtitles, a title card and a credits roll. The song is the only audio. Ask Claude for a music video and hand over the song (and the lyric sheet if you have one); the `music-video` skill runs it.

```powershell
npm run setup:lyrics                     # one-time: Demucs and librosa into .venv-music (needs setup:music and setup:align)
npm run new -- 2026-10-21-empires --format music-video --song "temp_input/PTRA - Empires (Plata o Plomo Power Mix).wav"
# paste the lyric sheet into episodes/2026-10-21-empires/lyrics.txt (one line per subtitle, [Section] tags allowed)
npm run lyrics -- 2026-10-21-empires     # vocal stem, Whisper + forced alignment, beats -> timing.json, lyrics-diff.txt
```

`npm run lyrics` prints a song map (sections, and instrumentals with their beat numbers) and lists every place the singing differs from the sheet. `episode.json` is a list of shots, each cutting on a sung phrase (`cue`) or, in instrumentals, a beat number (`beat`):

```jsonc
"shots": [
  { "visual": "jekyll_island_club" },
  { "visual": "ww1_trenches", "cue": "First European" },
  { "visual": "irs_form", "cue": "Income", "in": 2.5 },
  { "visual": "factory", "beat": 412, "transition": "glitch" }
],
"subtitles": true,
"credits": { "seconds": 8 }
```

Then `assets`, `check`, `preview`, `render`, `thumb` and `credits` as for any episode. The description includes the full lyrics. Footage gets no "FILE FOOTAGE" tags in a music video; AI stills still carry theirs.

---

## Commands

| Command | Does |
|---|---|
| `npm run new -- <slug> [--format list\|short] [--count N] [--theme id]` | Scaffold an episode (or a standalone Short) with placeholder content |
| `npm run new -- <slug> --format music-video --song <path> [--title "…"] [--subtitle "…"] [--artist "…"]` | Scaffold a music video from a song (copied in as `song.<ext>`, credited OWN WORK) |
| `npm run lyrics -- <slug> [--force] [--model medium] [--aligner mms\|whisper]` | Music videos: align `lyrics.txt` to the song (vocal stem, Whisper, forced alignment) and find the beats |
| `npm run setup:lyrics` | One-time: add Demucs and librosa to `.venv-music` (for `npm run lyrics`) |
| `npm run short -- <slug> [--count 1-3] [--only N]` | Scaffold YouTube Shorts from an episode: `<slug>-short1…`, media hard-linked from the parent |
| `npm run sync` | Regenerate `src/episodes.generated.ts` (run by `new`, `dev`, `render`, `align`) |
| `npm run voice -- <slug> [--engine qwen\|chatterbox\|kokoro] [--reference voices/x.wav] [--seed N] [--force] [--out file.mp3] [--ignore-off]` | Local TTS: voice `voiceover.txt` to `voiceover.mp3`, then align (settings in `config.yaml`) |
| `npm run voice -- --sample "text"` / `--voices` / `--record <name>` | Audition a voice or setting / list your voices and Kokoro's / record a new voice from the mic |
| `npm run voice-check -- <slug> [--file <mp3>] [--min-pause 0.12] [--no-clips]` | Scan a laid-out voiceover for harsh stops (a word cut off while still sounding at a pause): report, snippets and waveforms in `episodes/<slug>/work/voice-check/`. Run after every voicing, every project |
| `npm run setup:align` | One-time: create `.venv` and install `requirements.txt` (Whisper alignment) |
| `npm run setup:voice [--qwen] [--cpu]` | One-time: create `.venv-tts` (or `.venv-qwen`) and install the TTS packages |
| `npm run align -- <slug> [--estimate]` | Write `timing.json` from the voiceover (or from text only) |
| `npm run assets -- <slug>` | Write `assets.json` |
| `npm run setup:image [--from <folder>]` | One-time: stable-diffusion.cpp + Z-Image Turbo GGUF into `models/image/` |
| `npm run generate -- <slug> <name> --prompt "..." [--detail high] [--engine local\|cloud] [--seed N] [--force]` | Last-resort AI still (local Z-Image Turbo or FLUX 3, per `image_gen.mode`), with credit and provenance |
| `npm run stock -- <slug> search "<q>" \| get <site>:<id> <name> \| import <file> <name> --site … --page <url> --author "…"` | Music videos only: Pixabay/Pexels search and download, or import a Coverr/Pexels browser download; STOCK credit (stock-media skill) |
| `npm run shot -- <slug> <name> --url <url> [--selector "<css>"] [--license PD] [--highlight "..."]` | Screenshot part of a web page as a still, with credit |
| `npm run xpost -- <slug> <post url> --basis "<why>" [--still <name>] [--no-media] [--light]` | A post on X as a source: archive it, optionally an on-screen still credited X POST (`x_posts.enabled` only) |
| `npm run infographic -- <slug> <name> [--seconds 12] [--still]` | Render `episodes/<slug>/infographics/<name>.html` as a themed clip or still, with credit |
| `npm run explainer -- <styles\|new\|storyboard\|frames\|render> <name> [--episode <slug>]` | Illustrated explainers: scaffold in a style, storyboard, check frames, render with sound |
| `npm run youtube -- <slug> search\|transcript\|clip …` / `-- --update` | Search YouTube, read a transcript, or cut a CC BY / federal-PD clip (config.yaml `youtube:`); `--update` upgrades yt-dlp |
| `npm run sfx -- <slug> <name> --sound <kit sound> \| --recipe [file.js]` | Synthesize a sound effect into the episode's `sfx/` (or `--library`), credited OWN WORK |
| `npm run setup:music [--cpu]` | One-time: create `.venv-music` and install Stable Audio 3 (CUDA PyTorch 2.7.1, Flash Attention 2) |
| `npm run compose -- <slug> <name> --prompt "..." [--seconds N] [--seed N] [--force]` | Generate a music bed into the episode's `music/` (config.yaml `music_gen:`), new random seed each run |
| `npm run check -- <slug>` | Validate schema, cues, visuals, licenses, text lengths, maps and generated files |
| `npm run preview -- <slug> [--port N] [--no-open]` | Check, start Remotion Studio and open the browser on this episode (stop with Ctrl+C). Also starts the props server: edits made in Studio's props panel are saved to `episode.json` with the green **Save to episode.json** button on the canvas or **Ctrl+S** (Studio's own Save button can't save this kit's props and shows "Can't save default props") |
| `npm run props-server [-- --port 3011]` | The props server on its own (when Studio was started with `npm run dev`) |
| `npm run dev` | Remotion Studio, all episodes |
| `npm run render -- <slug>` | Check, render, master |
| `npm run master -- <slug>` | Re-master an existing render |
| `npm run thumb -- <slug>` | Thumbnail still |
| `npm run credits -- <slug>` | YouTube description |
| `npm run upload-text -- <slug> [--url <link>]` | Title and a ≤ 5,000-character description for the upload (`upload.json`); `--url` records the uploaded link, which the Shorts' descriptions use |
| `npm run kill` | Stop leftover render processes from this repo |
| `npm run typecheck` | `tsc --noEmit` |

## What `check` catches

Errors block rendering:

- Schema problems in `episode.json` (wrong field, wrong type, bad theme id).
- A marker, stat, visual, beat, outro or CTA cue that isn't spoken where it should be: missing, out of order, or outside its segment. Nothing falls back silently. In Studio, unresolved cues also show as a red panel over the video.
- A visual named in `episode.json` that isn't in `clips/` or `images/`.
- A media file with no credits entry, or a license other than PD, CC0, CC BY or CC BY-SA. `AI-GENERATED` is accepted only for `npm run generate` stills (with their provenance record and an on-screen note) and `npm run compose` music beds.
- A YouTube clip that isn't CC BY or PD, is PD without its basis in `notes`, has no channel as author, isn't in `clips/`, has a missing or stale channel tag in `assets.json` (run `npm run assets`), or is the thumbnail. (A warning if the episode has YouTube clips while `youtube.search_youtube` is false.)
- Estimated timing, a voiceover/timing duration mismatch, or a `voiceover.txt` edited since alignment.
- A stale `assets.json`, a missing sound from the sfx preset, or a missing music file.
- Text over its length limit (headline over 6 words, long stamps, stat values or outro lines).
- An empty `article.md`.
- Shorts: a format/aspect mismatch (`short` must be `9:16`, and only Shorts are), a `parent` that doesn't exist, or more than 3 minutes of voiceover.

Warnings: unknown map country names (with a suggestion), pins outside the map box, visuals reused in adjacent segments, segments without stats, visuals or a map, missing sources, a missing `summary`, and a Short longer than `shorts.maxSeconds`.

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
- `blackout`: dark tech dystopia, crimson alarm red and phosphor-green data on near-black, footage played ungraded (no filter or tint, only the gradients behind text), scanlines and glitch, with Big Shoulders, IBM Plex Mono and Saira.
- `military`: tactical briefing, sand text on olive-black with a signal-amber accent and phosphor-green readouts, with Big Shoulders Stencil, Share Tech Mono and Barlow Condensed.
- `military-comparisons`: weapons-system spec briefing in the **split layout**. Footage plays in a bracketed frame on the left; the number, headline and stats sit on the right, and the stats build into a spec sheet that stays up (5 rows a panel, then panel 2, 3). The map card shows briefly over the footage and slides off to the left. Cool white on gunmetal, HUD-cyan readouts, signal-orange accent, with Teko, IBM Plex Mono and Saira Condensed.
- `erotic`: a boudoir-editorial comparison sheet in the same **split layout** as `military-comparisons`. Blush cream on wine-black, lipstick-crimson accent, champagne-gold readouts, a warm low-key b-roll grade and soft grain with no scanlines. Fonts are Playfair Display, Josefin Sans and Jost. Default labels: AFTER HOURS ticker, TOP PICK, PROFILE panels. The mood comes from color and type only. The theme has no imagery of its own, and b-roll still has to pass YouTube's rules and the license gate.

- `frontier`: bleeding-edge technology, and the one theme with scenes of its own (a **skin**, below). Ink-black field with a living dot lattice and drifting aurora; the b-roll floats in a turned glass window with an iridescent edge, cold-open stamps included (the stamp sits beside the window, never over the footage); number, region chip and a sentence-case headline on the left; stats as a row of glass **metric tiles** that count up under the window (3 visible, sliding on); text sections mirror the layout. Text decodes from cycling glyphs, cuts are a light sweep instead of a glitch, the countdown number boots inside a charging ring and flies into its badge, the map is dot-matrix and its card collapses to a line, captions are karaoke (the spoken word lit in a lime pill), the ticker is a slim signal rail, and the `#1` item gets a rotating iridescent frame. Shorts and the thumbnail have their own Frontier versions. Fonts are Sora, Geist and Geist Mono. It comes with its own sound preset, `tech` (`audio.sfxPreset`; `npm run new --theme frontier` picks it), synthesized from the explainer sound kit (recipes in `src/kit/skins/frontier/sounds/`).

A theme controls colors, fonts, b-roll treatment, glows, grain and default wording (ticker label, CTA, emphasis badge), and picks a segment layout (`overlay`, `split` or `spatial`, set in `THEME_LAYOUT` in `src/kit/themes/ids.ts`). To add one, copy `src/kit/themes/threat-brief.ts`, then register it in `src/kit/themes/index.ts` and `src/kit/themes/ids.ts`. Keep the b-roll treatment light: use fades, grayscale washes, dark tints and heavy gradients sparingly, because the footage has to stay readable under the text (blackout's first pass crushed its footage nearly to black). A `grade: false` visual skips the filter and tint altogether, for explainers and infographics already drawn in the theme.

**Skins.** A theme can also bring its own scenes and chrome instead of restyling the shared ones: register a `Skin` for it in `src/kit/skins/index.ts` (see `src/kit/skins/types.ts`). Every piece is optional (cold open, segment, text section, outro, end card, finish, top bar, ticker, captions, thumbnail, and the Shorts versions), and anything left out falls back to the shared component. A skin keeps the shared timing (scene cuts, the 0–22 frame number window, stat and visual cues, the map exit, the CTA click), because the sound presets fire on those times. `src/kit/skins/frontier/` is the example.

**Text sections.** Any entry in `segments` can be `"kind": "text"` instead of a numbered item: a `marker`, optional `label`, a `heading`, an optional short `body` and 1–4 cue-cut `visuals` full-screen behind one block of text. Use them for an intro, a recap or a closing "what it means" section. They work in every theme, don't take a number, and are skipped by the top-bar counter and the ticker. In overlay layouts, `textAt` keeps the label and heading off screen until a spoken cue (so an explainer can have the whole frame first), and `tuckAt` shrinks them into the top-left corner at a cue, the way a numbered segment's text tucks away.

Formats: `countdown` (10 → 1, with a number slam per segment) and `list` (1 … N, with "3 OF 5" counters and no slams). Both reuse the same scenes. `short` is the vertical format for YouTube Shorts (`aspect: "9:16"`): the same timeline with its own vertical scenes in `src/kit/formats/Short.tsx`.

## Layout

```
episodes/<slug>/                 episode source data (episode.json, voiceover.txt, article.md, notes.md, heard.txt)
episodes/episode.schema.json     generated JSON Schema for editor autocomplete
episodes/<slug>/raw/               raw downloads, one folder each (raw/youtube/ for npm run youtube); local-only
episodes/<slug>/work/              working files: contact sheets, test stills, drafts, logs; local-only
public/episodes/<slug>/          episode media + generated timing.json / assets.json + credits.json
public/library/                  shared sfx/ and music/ + credits.json
src/kit/schema.ts                episode.json schema (zod): the single source of truth
src/kit/lib/                     cue resolution, captions, sfx presets, music ducking (pure TS, shared with scripts)
src/kit/components/              WorldMap, Backdrop, Headline, cards, titles, chrome, audio
src/kit/scenes/                  ColdOpen, Segment, SplitSegment, TextSection, Outro, EndCard
src/kit/formats/                 Countdown, List, Short (vertical 9:16)
src/kit/themes/                  threat-brief, clean-light, after-dark, military, military-comparisons, erotic, frontier, blackout
src/kit/skins/                   themes with scenes of their own (frontier)
scripts/                         the npm commands (TypeScript, run with tsx) + align.py and voice.py
scripts/lib/config.ts            reads and validates config.yaml (voice:, shorts:, music_gen:, image_gen:, youtube:)
scripts/lib/browser.ts           headless Chrome for shot and infographic (Remotion's chrome-headless-shell via playwright-core)
episodes/<slug>/infographics/    HTML sources for npm run infographic (and episode explainers)
episodes/<slug>-short<N>/        a Short made from an episode (npm run short); its own small episode
explainers/<name>/               standalone illustrated explainers (git-ignored); renders in out/explainers/<name>/
requirements.txt                 Python packages for .venv (align, find-media lead finder)
requirements-tts.txt             Python packages for .venv-tts (npm run voice: PyTorch, Chatterbox, Kokoro)
requirements-qwen.txt            Python packages for .venv-qwen (npm run voice with engine: qwen)
requirements-music.txt           Python packages for .venv-music (npm run compose: Stable Audio 3, Flash Attention)
models/image/                    sd-cli + Z-Image Turbo GGUF, encoder and VAE for local stills (git-ignored; npm run setup:image)
config.yaml                      kit settings: voice, shorts, music_gen (composed beds), image_gen (local / cloud / mixed stills), youtube and recon
recon/                           recon reports, one per run (git-ignored)
voices/                          reference clips for voice cloning (git-ignored except README.md)
.claude/skills/                  new-episode, find-media, generate-image, infographic, explainer, compose-music, youtube, recon
```
