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

## Tuning the read

- **Turbo** (default): understands tags such as `[chuckle]`, `[sigh]` or `[cough]`. Keep them out of episode scripts: `voiceover.txt` is also the caption text, so a tag would show up on screen. They're fine in `--sample` tests.
- **Standard** (`model: standard`): `exaggeration` (0.25 flat to 1.0 dramatic; 0.5 is neutral) and `cfg_weight` (lower is slower and more deliberate; try 0.3 with exaggeration 0.7 for a punchy trailer read). Slower than Turbo, and it has a built-in default voice if you leave `reference` empty.
- **Mispronounced words:** respell them in `voiceover.txt` the way they sound ("Shahed" as "Sha-hed"), since that file is what gets spoken. Captions show the same text, so prefer respellings that still read normally.
