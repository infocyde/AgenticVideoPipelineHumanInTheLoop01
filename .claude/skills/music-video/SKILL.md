---
name: music-video
description: Make a Brief Kit music video from the user's own song: lyrics aligned to the audio, a shot plan cut to sung words and beats, licensed footage and creative-mode explainers, subtitles, check, preview and render. Use when the user asks for a music video, a video for their song or track, or hands over a song file (WAV/MP3), with or without its lyrics.
---

# Music video

A music video is an episode with `"format": "music-video"`. The song replaces the voiceover, the lyric sheet replaces the script, and shots replace the news template. You write **data and media only**, as with any episode (CLAUDE.md rule 1). Keep a running log in `episodes/<slug>/notes.md`.

There are three stops where you wait for the user: **the lyrics differences**, **the shot plan**, and **preview approval / AC power**. Explainer storyboards wait for approval as usual, unless the user waives that.

## 1. Intake

1. Get the song file and the lyric sheet, if they have one. A Suno export is fine; keep only the lyrics and the `[Section]` tags.
2. Ask, **every time**:
   - **subtitles on or off**
   - the theme (fonts and colors for subtitles, title card and credits; default `threat-brief`)
   - the title card wording (song title, mix name, artist)
   
   The artist defaults to the last music video's (the user's band: Paranormal Threat Reduction Agency, credited `OWN WORK`).
3. Pick a slug, `<YYYY-MM-DD>-<song>`, and scaffold:
   ```
   npm run new -- <slug> --format music-video --song "<path>" [--title "…"] [--subtitle "…"] [--artist "…"] [--theme id]
   ```
   This copies the song to `public/episodes/<slug>/song.<ext>`, credits it `OWN WORK`, and takes the title from the file name ("Artist - Title (Mix).wav"). Set `"subtitles"` in `episode.json` to what the user chose.

## 2. Lyrics

1. Paste the sheet into `episodes/<slug>/lyrics.txt`:
   - one line = one subtitle line
   - a blank line between stanzas
   - `[Tags]` on their own lines (never sung or shown)
   - choruses written out each time they're sung
   - echoes in (parentheses)
   
   Fix obvious spelling for display ("hallowed" → "hollowed", "it's bite" → "its bite") and log each fix in `notes.md`. An empty file gets Whisper's transcription as a draft for the user to correct.
2. Run:
   ```
   npm run lyrics -- <slug>
   ```
   (one-time setup: `npm run setup:lyrics`)
   - Demucs splits the vocals.
   - Whisper (multilingual `medium`) transcribes them and is matched to the sheet.
   - MMS forced alignment places every word, including the ones Whisper missed.
   - librosa finds the beats.
   
   It prints the **song map** (sections, plus instrumentals with their beat ranges) and writes `lyrics-diff.txt`.
3. **Stop.** Show the user the places where the singing differs from the sheet. Whisper also mishears sung words, so tell them which differences look like real departures (a repeated line, an ad-lib, a cut line) and which look like mishearings. Captions show what was sung (CLAUDE.md rule 5): correct `lyrics.txt` to the audio as they decide, re-run `npm run lyrics`, and log it.

A low "heard" rate is normal for heavy or operatic vocals; forced alignment places the rest. What matters is that the preview shows each line on its words.

## 3. Shot plan

Read the lyrics and the song map, then write the plan as a table:

| time | lyric line (or "instrumental, beats N–M") | on screen | source idea |

- **Pacing: a new shot every 3–4 seconds, for the whole song** (the user's standing rule; a 6-minute song is about 100 shots):
  - cut on each lyric line's first word
  - split lines longer than ~4 s on a beat
  - cut every instrumental, including the intro and outro, every ~6 beats (about 3.6 s at 100 BPM)
  
  `check` warns on shots over 5 s. Never show the user a preview with long holds, even as a timing check.
- **Archive and news footage** illustrates the lyric: the literal subject ("Jekyll Island", "income taxes"), or a juxtaposition (a politician laughing against a war clip). Historical subjects are mostly public domain:
  - National Archives
  - Library of Congress
  - Prelinger and Internet Archive PD films
  - DVIDS
  - White House and Congressional video
  - NASA
  
  The same clip can come back at a different in-point.
- **Pick 2–4 lines for illustrated explainers in creative mode** (the **explainer** skill): the abstract ones footage can't show, such as a mechanism, a cycle, or a number. You choose which lines and the medium.
- **Stop.** The user approves the plan, then sourcing starts.

## 4. Sourcing

Use the find-media subagents with the prompts in `.claude/skills/new-episode/asset-prompts.md` and the **find-media** skill, driven by the plan, with the usual license gate (CLAUDE.md rule 3) and a `credits.json` entry for every file. Two differences from news episodes:
- **YouTube.** The **youtube** skill can supply facts for an explainer and CC BY clips (`npm run youtube -- <slug> clip`). The channel tag shows on those clips.
- **No FILE FOOTAGE notes.** A music video doesn't claim a clip shows a specific event; the credits roll and the description carry the sourcing.
- **AI stills** (`npm run generate`, last resort) still need `"note": "AI-GENERATED ILLUSTRATION"`. Never make an AI image of a real, identifiable person, and never arrange footage to look like a real record of something that didn't happen. Juxtaposition is fine; putting words in someone's mouth is not.

## 5. Explainers

Use creative mode, per the explainer skill: storyboard, **stop** for approval (unless waived), build, then render silent as b-roll:
```
npm run explainer -- new <name> --style freeform --episode <slug>
npm run infographic -- <slug> <name> --seconds <slot + 2>
```
The song is the only audio, so the explainer's score isn't used.

**Facts on screen.** The lyrics are the artist's words and aren't fact-checked. Anything the video *adds* on screen (an explainer's dates and figures, a caption, a year) must be true and sourced in `notes.md` and `episode.json` `sources`, for example "1913: Sixteenth Amendment ratified". A lyric's own number stays the lyric's: an explainer for "Gold at forty thousand" shows it as the song's projection, never as a price.

## 6. `episode.json`

```jsonc
{
  "format": "music-video",
  "song": { "file": "song.wav", "title": "Empires", "subtitle": "Plata o Plomo Power Mix", "artist": "Paranormal Threat Reduction Agency" },
  "subtitles": true,
  "titleCard": { "seconds": 4 },                 // or false
  "shots": [
    { "visual": "jekyll_island_club" },                       // the first shot starts at 0
    { "visual": "ww1_trenches", "cue": "First European" },    // cuts on a sung phrase
    { "visual": "irs_form", "cue": "Income", "in": 2.5 },     // in: seconds into the clip
    { "visual": "factory", "beat": 412 },                     // instrumental: cuts on beat 412 (song map)
    { "visual": "cycle_explainer", "cue": "The ancient", "subtitles": false, "transition": "glitch" }
  ],
  "credits": { "seconds": 8, "cue": "Empires Go" },   // optional cue/beat: roll over the song's tail instead of after it
  "thumbnail": { "visual": "…", "frame": 3.2 },
  "summary": "1–2 sentences for the description.",
  "sources": []
}
```

- **Cues.** Cues follow the usual rules (case- and accent-insensitive; the last word may be a prefix). They are searched **in order**, after the previous shot's word and time, so a chorus cue finds the next chorus.
- **Beats.** Beats are indexes into the beat list. The song map prints the range for each instrumental.
- **Transitions.** `transition` is `cut` (default), `flash` or `glitch`; use glitch and flash sparingly, on hits.
- **Subtitles.** `"subtitles": false` on a shot hides them over an explainer's own text.
- **Credits roll.** The roll pages itself (14 rows a column). If the song ends in a long instrumental, start it on a cue or beat so the video doesn't end in silence.

Then:
```
npm run assets -- <slug>
npm run check -- <slug>    # 0 errors
```

## 7. Preview, render, hand off

As for episodes (new-episode skill, section 6):
1. Run `npm run preview -- <slug>` in the background. **Stop** for approval: ask the user to watch with sound and to check that the subtitles sit on the words.
2. Stop the preview and ask about AC power.
3. Run `npm run render -- <slug>`, `npm run thumb -- <slug>` and `npm run credits -- <slug>`. `DESCRIPTION.md` carries the summary, the song credit, the full lyrics and the media credits.

Hand off:
- the paths
- loudness and true peak
- the lyric changes the user approved
- every AI-generated still (remind them about YouTube's "altered or synthetic content" box if any look realistic)
- the facts added on screen with their sources
