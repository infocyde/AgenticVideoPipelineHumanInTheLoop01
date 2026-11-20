# Feature research

## Long Shorts showing at low quality on YouTube (2026-11-01)

**Symptom:** recently uploaded long Shorts play at 240p–360p on YouTube.

**Probably not the files.** The recent long Shorts are full 1080×1920 H.264 at 30 fps, about 2–5 Mbps, so YouTube has a full-HD source to work from. The usual causes are on YouTube's side:

1. **HD processing lag (most likely).** YouTube makes the low renditions (144p–360p) first and adds 720p and 1080p later, sometimes hours later. A freshly uploaded Private video often tops out at 240p or 360p until that finishes. The auto run uploads and the videos get watched soon after, so this fits.
2. **The player's Auto setting.** Studio's preview player and the small desktop Shorts player often start low and only step up after a while.
3. **Data Saver in the app.** Under Settings → Video quality preferences, a data-saving setting starts every video low on mobile data.

**How to tell which one it is:** open the gear menu on one of the videos.

- If it lists 1080p, processing is done and the player is just choosing low. Pick 1080p there, or set "Higher picture quality" under Video quality preferences.
- If it tops out at 240p or 360p, it's still processing. Check again in an hour; it should show 1080p.

### Possible feature: higher render bitrate

Not the cause of the 240p problem, but noticed in the files:

- They're encoded at about half YouTube's recommended **8 Mbps for 1080p**.
- They're in **full-range color (yuvj420p)** rather than the usual limited range (yuv420p).

Neither makes YouTube serve 240p. If the HD versions look soft once processing finishes, a higher render bitrate (and possibly limited-range output) would help. That's a change to `scripts/render.ts`, so it's a kit change for the user to decide on, not something to touch while making an episode.

### Render-time cost (measured 2026-11-01)

Current settings: Remotion 4.0.536 defaults, so x264 `medium`, **CRF 18** (constant quality, not a bitrate target), JPEG frames, color space `default` (bt601, full range). `master.ts` copies the video stream (`-c:v copy`), so Remotion's encode is the only one.

x264 re-encodes of a 43 s 1080×1920 Short (`2026-11-01-free-ai-citizens-short2`), preset medium:

| Setting | Encode time | Bitrate |
| --- | --- | --- |
| CRF 18 (current) | 8.5 s | 3.6 Mbps |
| CRF 15 | 9.0 s | 4.7 Mbps |
| 8 Mbps VBR (max 12M) | 9.4 s | 5.9 Mbps |
| CRF 18 + bt709 limited range | 9.3 s | 3.4 Mbps |

- Each option adds about 0.5–1 s of encoding per 43 s of video (6–10% of encode time). A full render is dominated by Chromium drawing frames (an earlier main-episode render took 16.8 min; the 288 s main episode here would need about 60 s of encoding), so this is under 1% of total render time, and Remotion encodes alongside frame drawing, which hides some of it.
- Even with an 8 Mbps target, x264 only used 5.9 Mbps: the motion graphics compress easily. The low bitrate means "easy content", not "quality capped". CRF 18 is already near-transparent, so a higher bitrate gives only a small gain.
- The color tagging may matter more than bitrate: bt601 full range on an HD video can make YouTube shift colors slightly. Remotion's `--color-space=bt709` addresses that; confirm with a test render before adopting.

**Verdict:** no significant render-time cost. If changed, the likely candidates are `--crf=15` (or 16) and `--color-space=bt709` in `scripts/render.ts`, each checked with a short test render (`--frames=0-299`).

## Voice audio upscaling (2026-11-01)

**Status: parked.** The user wants this added later, not now.

**Why it came up:** the new female voices (`voices/slt_qwen.wav`, `voices/slt_chatterbox.wav`, cloned from CMU ARCTIC "slt"; see `voices/README.md`) sound muffled. The CMU source recordings are 16 kHz, and a clone copies the reference's mic and bandwidth along with the voice.

### What the voices output now (measured 2026-11-01)

- **Qwen3-TTS (local `qwen` and Replicate `qwen-cloud`) generates at 24 kHz**, so it holds nothing above about 12 kHz. `scripts/voice.ts` then encodes a 44.1 kHz MP3, which changes the container, not the content.
- Share of the energy above 8 kHz (treble), first 20 s of each file:

| File | > 8 kHz | > 11.5 kHz | > 16 kHz |
| --- | --- | --- | --- |
| Qwen episode voiceovers from `collin_ro` (`ai-roundup`, `ai-disruption`) | −26 to −27 dB | −53 to −54 dB | −97 to −99 dB |
| ElevenLabs voiceover (`quantum-computing`) | −19 dB | −23 dB | −81 dB |
| `collin_ro.wav` reference | −20 dB | −23 dB | −74 dB |
| slt reference (CMU, 16 kHz source) | −56 dB | −75 dB | −79 dB |
| slt clone by Qwen | −50 dB | −71 dB | −104 dB |
| slt clone by Chatterbox | −73 dB | −100 dB | −103 dB |

- The Qwen voiceovers are full up to 12 kHz, then drop off sharply (the 24 kHz ceiling). They're not dull, just missing the top octave (breath, crisp "s").
- The slt clones have about 24 dB less treble than the Collin Qwen voiceovers: audibly muffled.
- `slt_qwen.wav` / `slt_chatterbox.wav` are clones of a clone (the 15 s clips were generated from the slt reference, then used as references), so each loses a little more.

### Tools

| Tool | Best for | Local (8 GB GPU) | Replicate |
| --- | --- | --- | --- |
| **Resemble Enhance** (Resemble AI) | Speech: noise removal plus bandwidth extension, 44.1 kHz output | pip package, should fit | `resemble-ai/resemble-enhance` (T4) |
| **AudioSR** (University of Surrey) | Any audio (speech, music, sfx), upscaled to 48 kHz | Fits (about 6 GB VRAM recommended), MIT; slower, since it's a diffusion model | Not found |

To check before adopting: Resemble Enhance's license (likely MIT, unconfirmed), and that output length is identical to input (captions are timed to the audio).

### Plan when it's picked up

1. **Upscale the slt reference (do first: cheap, one-time, biggest effect).**
   - Run Resemble Enhance on the original `out/voice-experiment/slt.wav` (not the clone-of-a-clone clips).
   - Re-clone `slt_qwen` and `slt_chatterbox` from the upscaled reference, or use it directly as the reference.
   - Re-measure with the table above, and update `voices/README.md` and `voices/slt_LICENSE.txt` to record the enhancement step: the CMU license requires modifications to be marked.
   - The Collin references are already full-bandwidth and don't need this.
2. **Upscale finished voiceovers (test before building).** Even with a perfect reference, Qwen stops at 12 kHz.
   - **Expected gain:** modest. Audible on headphones, small on phone speakers (most Shorts viewers), and partly masked by the music bed and YouTube's compression.
   - **Risks:** invented lispy or metallic sibilance; an extra step on every episode and auto-run Short; timing must stay identical or captions drift.
   - **Test:** upscale one existing Qwen episode voiceover and blind A/B it on a phone and on headphones. If the user can't reliably pick the upscaled one on the phone, drop it.
   - **If kept:** an opt-in setting in `config.yaml` (e.g. `voice.enhance: false` by default), applied in `scripts/voice.ts` after voicing and before align. Then run `voice-check` as usual, and add an alignment re-check (same duration, same word times) to `check`.
3. **The combination:** step 1 regardless; step 2 only if the A/B passes.

## Excalidraw diagrams as b-roll (2026-11-17)

**Idea:** a skill that makes hand-drawn, whiteboard-style diagrams (flows, org charts, "how the attack worked", cause and effect, simple maps) with the official Excalidraw CLI, as stills or draw-on clips. Analysis only; nothing installed or changed.

### The tool

- **`@excalidraw/cli` 1.0.0**, Excalidraw's own CLI ([excalidraw/cli](https://github.com/excalidraw/cli), docs at [plus.excalidraw.com/docs/cli](https://plus.excalidraw.com/docs/cli)), MIT, published on npm 2026-11-17. No GitHub release notes yet, about 14 commits. Several unofficial packages have similar names; only `excalidraw/cli` is official.
- **Runtime:** Node 22 or newer (this PC: 22.17.0), one dependency, `playwright-core` 1.63. It downloads no browser: it drives the installed Chrome or Edge (the same ones `scripts/lib/browser.ts` uses), or Firefox (about 5 s a render instead of under 1 s). Override with `--browser-path`.
- **Offline, no account:** `render` and `mermaid` run locally and upload nothing. Network use: a daily update check (off with `EXCALIDRAW_NO_UPDATE_NOTIFIER=1`) and a one-time download of a CJK font when a drawing has Chinese, Japanese or Korean text (`--fonts-url` for a local copy). The workspace commands (`scenes`, `collections`, `login`…) need an Excalidraw+ API key and aren't needed.
- **Commands that matter:**
  - `excalidraw render <file|-> --out x.png|x.svg`, with `--scale` (up to 16), `--theme light|dark`, `--transparent`, `--frame-id <id>`, `--all-frames` (one image per frame, in order), `--padding`. Prints JSON with the path and size; `--out -` writes the image to stdout.
  - `excalidraw mermaid flow.mmd --out flow.excalidraw|flow.svg`: Mermaid to an editable drawing (flowchart, sequence, class, ER, state, Gantt, quadrant, timeline).
- **Limits:** PNG or SVG only, no PDF, no animation or video. No command for editing a local drawing: the `.excalidraw` JSON is written by us. Images must be embedded, not linked.

### How it would fit

A third kind of drawn b-roll beside `infographic` (themed charts) and `explainer` (styled canvas animation). What it adds:

- A whiteboard look that suits asked-claude, AI and tech, and cyber stories. It may clash with the military and threat-brief themes.
- A source file the user can open and adjust by hand in excalidraw.com or the desktop app before the render, which neither existing skill offers.
- Fast feedback: under a second a render, so render → look at the PNG → fix works well.

### Pipeline

1. **Writing the drawing (the hard part).** Raw Excalidraw JSON is verbose (seeds, versions, arrow bindings, stored text sizes). Two ways in: Mermaid → `excalidraw mermaid` for flows, timelines and sequences (cheapest), or a small helper in the skill folder that expands a short layout spec (boxes, arrows, labels, colors) into full elements.
2. **Size:** put a 1920×1080 frame (1200×850 for long Shorts) in the drawing and render with `--frame-id`, so the output is exactly the slot size.
3. **Theme:** copy the episode theme's colors (accent, highlight, hostile, ally) into stroke and fill colors. For dark themes, a `--transparent` render on a theme-colored panel probably beats `--theme dark` (which inverts colors).
4. **Still output:** PNG to `public/episodes/<slug>/images/`, credited `OWN WORK`, then `npm run assets`; the kit's Ken Burns drift gives it movement.
5. **Draw-on animation (optional):** render SVG, embed it in an infographic HTML page, draw the strokes on with `window.bkSeek` (stroke-dashoffset), and render with `npm run infographic`, which also writes the credit. Needs a test: the sketchy strokes are SVG paths, so drawing them on should work, but text and filled shapes would fade in instead.

### Rules that would apply

- Building the skill (and a `scripts/excalidraw.ts` wrapper) is kit development, like the infographic skill: it needs the user's go-ahead, not part of making an episode (CLAUDE.md rule 1). A minimal version needs no new script: `npx`, a manual `credits.json` entry and `npm run assets`.
- Rules 2 and 3: every label and number from the script or fact-check; drawings credited `OWN WORK`. Shapes from Excalidraw's community libraries carry their own licenses: leave them out or check each one.
- Pin `@excalidraw/cli@1.0.0` as a dev dependency rather than a global install (a `package.json` change, the user's call).

### Effort

| Version | What it includes | Rough time |
| --- | --- | --- |
| Minimal | Skill doc, Mermaid route, `npx` render, manual credit | ~1–2 h |
| Standard | Plus a wrapper script (frame sizing, theme colors, credits and assets), the layout helper, 3–4 reference drawings | ~half a day |
| With animation | Plus SVG draw-on through the infographic renderer, tested on a long Short | ~+2–4 h |

### Risks

- A day-old 1.0: flags may change. Pin the version.
- **Bound text:** it's not documented whether `render` re-measures text inside shapes. If not, generated JSON must size text correctly or labels overflow their boxes. Test this first.
- The hand-drawn style can clash with the harder themes; use it where the subject fits.

### Plan when it's picked up

Build the standard version, prove it on one diagram in a real episode, then decide whether the draw-on animation is worth adding.
