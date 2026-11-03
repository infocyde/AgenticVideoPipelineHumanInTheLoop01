# Voices for `npm run voice`

Reference clips for Chatterbox voice cloning go in this folder. Everything here except this README is ignored by git: a clip of your voice is personal data.

## Whose voice you may clone

Only clone **your own voice**, or the voice of someone who has agreed in writing to it being used for this channel. Don't clone a celebrity, a public figure, a voice from a video or podcast, or an ElevenLabs library voice: its terms cover the audio ElevenLabs generates, not copying the voice into another model. Every Chatterbox output also carries Resemble's inaudible Perth watermark, which marks the audio as AI-generated.

If you'd rather not use a real voice, use a Kokoro preset (`engine: kokoro`), or clone a Kokoro voice (step 4 below).

## The quick way

```
npm run voice -- --record              # asks for a name (suggests narrator, narrator2…), records voices/<name>.wav
npm run voice -- --record calm         # named up front: voices/calm.wav
npm run voice -- --voices              # your voices, plus the Kokoro presets
npm run voice -- --record calm --engine qwen   # same, but the sample you hear is cloned by Qwen3-TTS
npm run voice -- --record --force      # redo a take
```

It shows a passage to read, counts down, and records for 25 s (`--seconds`). Then it trims the silence and reports your level, background noise and clipping. Finally it makes and plays a sample of the clone (`out/voice-samples/clone-narrator.mp3`). Pick a mic with `--device "<name>"`; `ffmpeg -list_devices true -f dshow -i dummy` lists them.

## Recording a good reference clip (10-20 seconds)

The clone copies everything in the clip, including room echo, hiss and mic tone, so the clip matters more than any setting.

1. **Room:** a small, soft room (a closet full of clothes is ideal). No fans, no music, no other voices.
2. **Mic:** any decent USB mic or a phone, 15-20 cm from your mouth, slightly off to the side so your breath doesn't pop it. No noise suppression or "voice enhance" filters.
3. **Read** about 15 seconds in the voice you want for the channel: same pace, energy and tone as the videos. Read a news-style paragraph, not a list of words. For example:
   > Overnight, air defense units reported a new pattern of attacks along the southern front. Analysts say the shift matters less for what it destroyed than for what it reveals about supply. Here is what we know, and what we don't, as of this morning.
4. **Save it** as `voices/narrator.wav` (WAV or FLAC, mono or stereo, 24 kHz or higher). Trim silence off both ends. Then check `config.yaml`:
   ```yaml
   voice:
     enabled: true
     engine: chatterbox        # or qwen (multilingual, better with Russian names)
     reference: voices/narrator.wav
     chatterbox:
       model: turbo
   ```
5. **Try it** before voicing a whole episode:
   ```
   npm run voice -- --sample "Tonight's brief: three systems, one question."
   ```
   That writes `out/voice-samples/chatterbox-turbo-narrator.mp3`. If it sounds off, record a cleaner or more natural take. A different `--seed` gives a different read of the same line.

Keep several voices side by side (`voices/narrator.wav`, `voices/calm.wav`) and pick one per run with `--reference voices/calm.wav`, or in `config.yaml` (`voice.reference`). For `engine: qwen`, each clip also needs a transcript next to it (`voices/calm.txt`); the first Qwen run makes it with Whisper, and you can correct it by hand.

## Cloning a Kokoro voice (no real person)

To get Chatterbox's quality from a synthetic voice, make a Kokoro clip and use it as the reference:
```
npm run voice -- --sample "Overnight, air defense units reported a new pattern of attacks along the southern front. Analysts say the shift matters less for what it destroyed than for what it reveals." --engine kokoro --voice am_michael
ffmpeg -i out/voice-samples/kokoro-am_michael.mp3 voices/michael.wav
npm run voice -- --sample "A line to try." --reference voices/michael.wav
```

## Female voices from CMU ARCTIC "slt" (added 2026-11-01)

Two female voice options, made the same way as the Kokoro clone above, from a voice recorded for speech synthesis:

| Voice | Made with | Clip | Use |
|---|---|---|---|
| `voices/slt_qwen.wav` | Qwen3-TTS 1.7B | 12.8 s, 24 kHz mono | `--reference voices/slt_qwen.wav` |
| `voices/slt_chatterbox.wav` | Chatterbox Turbo | 13.8 s, 24 kHz mono | `--reference voices/slt_chatterbox.wav` |

Each has a Whisper transcript next to it (`.txt`, checked word for word against the script it read) for Qwen. Both work with either engine. The clips are local only, like everything in this folder; if they're lost, remake them from `voices/slt_LICENSE.txt`'s description.

**Licensing chain**

1. **Source voice:** CMU ARCTIC speech synthesis databases, speaker "slt" (US English, female), by John Kominek and Alan W Black, Language Technologies Institute, Carnegie Mellon University (2003), [festvox.org/cmu_arctic](http://www.festvox.org/cmu_arctic/). Recorded for building synthetic voices, so cloning it is the use it was made for (unlike the voices this file says never to clone). License: CMU's permissive license, "free for use for any purpose (commercial or otherwise)" on three conditions: keep the copyright notice, clearly mark modifications, and don't delete the original authors' names. `voices/slt_LICENSE.txt` keeps the notice unmodified, names the authors, and marks these clips as a modified work.
2. **Models:** Qwen3-TTS is Apache-2.0 and Chatterbox is MIT; neither restricts the audio you generate. Chatterbox output carries Resemble's inaudible Perth watermark marking it as AI-generated. Whisper (MIT) made the transcripts.
3. **The clips themselves:** synthetic speech of a sentence that isn't in the corpus. The six original recordings they were cloned from (`arctic_a0001`–`a0006`) are in `out/voice-experiment/raw/cmu_slt/` with the license.

**When a video uses one:** the narration is AI-generated in a voice derived from a real speaker, the same situation as the Collin clone. Credit it in the description, e.g. "Narration: synthetic voice based on the CMU ARCTIC slt voice (Kominek & Black, Carnegie Mellon University)", and set YouTube's altered or synthetic content disclosure the same way you do for the Collin voice.

## Tuning the read

- **Turbo** (default): understands tags such as `[chuckle]`, `[sigh]` or `[cough]`. Keep them out of episode scripts: `voiceover.txt` is also the caption text, so a tag would show up on screen. They're fine in `--sample` tests.
- **Standard** (`model: standard`): `exaggeration` (0.25 flat to 1.0 dramatic; 0.5 is neutral) and `cfg_weight` (lower is slower and more deliberate; try 0.3 with exaggeration 0.7 for a punchy trailer read). Slower than Turbo, and it has a built-in default voice if you leave `reference` empty.
- **Mispronounced words:** respell them in `voiceover.txt` the way they sound ("Shahed" as "Sha-hed"), since that file is what gets spoken. Captions show the same text, so prefer respellings that still read normally.

## Claude's voice for "Asked Claude" (added 2026-11-02)

`voices/asked_claude.wav` (17.0 s, 48 kHz mono, transcript `asked_claude.txt`) is the voice of the Asked Claude format,
chosen by Claude. `config.yaml` `asked_claude.voice` makes `npm run voice` use it, through Qwen3-TTS on Replicate, for
every episode in theme `asked-claude`. It's the same clip as `vctk_p294.wav`. Two alternates from the same audition sit
beside it: `vctk_p343.wav` (a lower female voice, which came out flatter when cloned) and `vctk_p311.wav` (male; the
clone added question lifts mid-sentence).

**Why this voice:** Claude wanted a warm, unhurried, mid-range voice, neither an announcer nor a deep "AI" voice. p294's
clone kept a 184 Hz median pitch with the widest natural movement of the three, and Whisper heard every word.

**Licensing chain**

1. **Source voice:** CSTR VCTK Corpus (version 0.92), Junichi Yamagishi, Christophe Veaux, Kirsten MacDonald, University of
   Edinburgh, Centre for Speech Technology Research, 2019, https://doi.org/10.7488/ds/2645 . **CC BY 4.0** (the corpus's
   `license_text.txt`, saved in `out/voice-experiment/raw/vctk/`). It was recorded for building text-to-speech voices,
   so cloning it is the use it was made for (unlike the voices this file says never to clone). Speaker p294: female,
   33, American English (San Francisco), microphone 1. The FLACs came from the Hugging Face parquet repack
   `sanchit-gandhi/vctk` (same data) and are in `out/voice-experiment/raw/vctk/p294/`.
2. **Changes** (CC BY asks you to say so): utterances 006, 007 and 010 (the rainbow passage) joined with 0.35 s gaps,
   high-passed at 70 Hz, lightly denoised, loudness-normalized to -20 LUFS. No upsampling needed (the source is 48 kHz).
3. **Model:** Qwen3-TTS (Apache-2.0); no restriction on the audio it generates.
4. **Credit in every video that uses it:** `npm run credits` writes it into the description automatically (above the
   credits list, so it survives trimming): "Narration: AI-generated voice (Qwen3-TTS) cloned from VCTK speaker p294,
   CSTR VCTK Corpus (… University of Edinburgh, 2019), CC BY 4.0, https://doi.org/10.7488/ds/2645 . Modified." The
   credits are in `scripts/lib/askedClaude.ts`. Set YouTube's altered or synthetic content disclosure.

The clips are local only, like everything in this folder. If they're lost, remake them from
`voices/asked_claude_LICENSE.txt` (the same three utterances, the same filters).
