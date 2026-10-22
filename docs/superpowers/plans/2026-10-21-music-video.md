# Music Video Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `music-video` episode format to Brief Kit: a song plus its lyric sheet become a full-frame, shot-by-shot video. Cuts land on sung words or beats, with optional line-by-line subtitles and a credits roll.

**Architecture:** A music video is a second episode shape (`musicVideoSchema`), selected by `format: "music-video"`. It sits beside the untouched news `episodeSchema`. It has its own pure resolver, its own Remotion format component and context, and its own `check`, description and scaffold branches. The shared parts stay shared: cue matching (`findPhrase`), assets, licensing, credits data, mastering and render. Lyrics are aligned to the song by a new `npm run lyrics`:
1. Demucs separates the vocal stem.
2. faster-whisper hears the stem and difflib matches it to the sheet.
3. Optional MMS forced alignment refines the timings.
4. librosa detects beats.

The words, their line numbers and the beats land in the existing `timing.json`.

**Tech Stack:** TypeScript, Remotion 4.0.536, zod 4, tsx, Node 22 test runner (`tsx --test`); Python 3.12. The existing `.venv` holds faster-whisper. `.venv-music` holds torch/torchaudio 2.7.1 cu126, and gets demucs and librosa.

**Spec:** `docs/superpowers/specs/2026-10-21-music-video-design.md` (read it first; this plan argues from it).

## Global Constraints

- Hard rule: all existing formats keep working. After every task, `npm run typecheck` passes. The final regression task requires every existing episode's `npm run check` output to equal the baseline in `%TEMP%/claude/c---activeDev-brief-kit/35abaec5-33be-4149-912a-65e89d653673/scratchpad/baseline/<slug>.txt` (15 episodes, all 0 errors).
- Video: 1920×1080, 30 fps (`FPS`, `WIDTH`, `HEIGHT` from `src/kit/lib/timing.ts`).
- Audio: the song only, at full level. No sfx preset, no bed, no ducking. Mastering is unchanged (-14 LUFS ±1, true peak ≤ -1 dBTP, `scripts/lib/master.ts`).
- Licenses: PD, CC0, CC BY, CC BY-SA, `OWN WORK`, `AI-GENERATED` (with generator), and `PRESS` when config allows it. Every media file needs a `credits.json` entry. The song is credited `OWN WORK` under the artist name.
- No `FILE FOOTAGE` notes on music-video shots. AI-generated stills still require `"note": "AI-GENERATED ILLUSTRATION"` (`check` error otherwise).
- Cue matching: reuse `findPhrase` from `src/kit/lib/timing.ts` unchanged (case/accent-insensitive, last word may be a prefix).
- Lyric sheet rules:
  - `[...]` lines are tags: never sung or subtitled, and they name the section that follows.
  - One text line = one subtitle line. A blank line = stanza break.
  - Parenthesized words are sung words.
  - Overlapping vocal parts are out of scope.
- Whisper model for lyrics: multilingual (default `medium`, never `medium.en`).
- Thresholds (my calls, from the spec's "builder's call" list):
  - shot shorter than 0.4 s → error; longer than 12 s → warning
  - lyric match rate under 0.8 → warning
  - subtitle line over 80 characters → warning
  - subtitle shown from first word start −0.15 s until the earlier of last word end +0.8 s and next line start −0.05 s
- No on-screen sources card for music videos. Any `sources` go in the YouTube description only (my call: narrowed from the spec's "unless sources is non-empty", since added facts live in explainers, which carry their own `<meta name="sources">`).
- Episode folders (`episodes/*/`, `public/episodes/`) are git-ignored. Commit only kit code, skills and docs.
- No colons or abrupt fragments in any narration text (user preference). This doesn't apply to lyrics, which are the user's.

## Review Focus

1. **Instrumental gaps:** sheet words Whisper didn't hear, sitting next to a 30 s instrumental, must not be spread across the instrumental. They get placed inside their own line, just before the next heard word. The test is in Task 5 (`placeUnmatched`).
2. **Repeated choruses:** "Managed Freedom" as a cue must hit the *next* chorus after the previous shot, never an earlier one, and a cue after a beat-shot must be searched after that beat's time. The test is in Task 3.
3. **A clip in-point beyond the clip's length** (`in` ≥ duration) is an error, not a silent black shot. The test is in Task 3.
4. **Lyrics edited after alignment** (`lyrics.txt` words ≠ `timing.json` words) must be a `check` error telling the producer to re-run `npm run lyrics`. The test is in Task 7 (`lyricsStale`).
5. **Song file names with spaces and parentheses** ("PTRA - Empires (Plata o Plomo Power Mix).wav") must scaffold to a clean `song.<ext>`, and Demucs output must be found regardless of the name. The test is in Task 4 (`songFileName`).

---

### Task 0: Test runner

**Files:**
- Modify: `package.json` (scripts)
- Create: `src/kit/lib/smoke.test.ts`

- [ ] **Step 1:** Add `"test": "tsx --test \"src/**/*.test.ts\" \"scripts/**/*.test.ts\""` to `package.json` scripts.
- [ ] **Step 2:** Write `smoke.test.ts` using `node:test` + `node:assert/strict`, asserting `findPhrase([{word:"Managed",start:1,end:1.4},{word:"Freedom",start:1.4,end:2}], "managed free")?.start === 1`.
- [ ] **Step 3:** Run `npm test`. Expected: 1 passing test.
- [ ] **Step 4:** Commit: `chore: add node test runner`.

### Task 1: Lyric sheet parsing

**Files:**
- Create: `src/kit/lib/lyrics.ts`, `src/kit/lib/lyrics.test.ts`

**Interfaces:**
- Produces:
  - `type LyricLine = { text: string; words: string[]; stanza: number; section: string | null }`
  - `type Lyrics = { lines: LyricLine[]; sections: { name: string; line: number }[] }`
  - `parseLyrics(text: string): Lyrics`
  - `lyricWords(l: Lyrics): { word: string; line: number }[]` (flat, in order)

- [ ] **Step 1: Failing tests** in `lyrics.test.ts`:
  - `strips tags and records sections`: for `"[Verse 1]\nJekyll Island,\nFirst European War\n\n[Chorus]\nManaged Freedom"`:
    - `lines.map(l=>l.text)` deep-equals `["Jekyll Island,","First European War","Managed Freedom"]`
    - `sections` deep-equals `[{name:"Verse 1",line:0},{name:"Chorus",line:2}]`
    - `lines[2].stanza === 1` and `lines[0].stanza === 0`
    - `lines[2].section === "Chorus"`
  - `keeps parenthesized echoes as words`: `parseLyrics("Empires Go (go go go)").lines[0].words` deep-equals `["Empires","Go","(go","go","go)"]`.
  - `production tag with no lines after it`: `parseLyrics("Stay alive\n\n[power ballad]").sections.at(-1)` deep-equals `{name:"power ballad", line:1}` (line = index the next line would have).
  - `trims trailing spaces and ignores CRLF`: `"Jekyll Island, \r\nIncome Taxes"` gives two lines, first text `"Jekyll Island,"`.
  - `lyricWords numbers lines`: `lyricWords(parseLyrics("A b\n\nC")).map(w=>w.line)` deep-equals `[0,0,1]`.
  - `empty sheet`: `parseLyrics("").lines.length === 0`.
- [ ] **Step 2:** `npm test`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `parseLyrics`/`lyricWords`. A tag is a whole line matching `^\[[^\]]*\]$` after trim.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(music-video): lyric sheet parser`.

### Task 2: Schema

**Files:**
- Modify: `src/kit/schema.ts` (add music-video schema, extend timing), `scripts/sync.ts:47-48` (JSON Schema covers both shapes)
- Create: `src/kit/schema.test.ts`

**Interfaces:**
- Produces, in `schema.ts`:
  - `shotSchema`: `{ visual: visualName; cue?: cue; beat?: int ≥ 0; in?: number ≥ 0 (seconds into the clip); transition: "cut"|"flash"|"glitch" (default "cut"); subtitles?: boolean (false hides subtitles during the shot); note?: string }`, refined so `cue` and `beat` are not both set (message `"a shot cuts on a cue or a beat, not both"`).
  - `musicVideoSchema`: `{ $schema?, slug, format: z.literal("music-video"), title, summary?, theme (THEME_IDS, default "threat-brief"), song: { file: string (default "song.wav"), title, subtitle?, artist }, subtitles: boolean (default true), titleCard: {seconds 1–10, default 4} | false (default {seconds:4}), shots: shotSchema[] (min 1), credits: { seconds: 4–20 default 8, cue?: cue, beat?: int } (default {seconds:8}), thumbnail?: { visual?: visualName, frame?: number }, sources (same shape as episodeSchema.sources, default []) }`
  - Types `MusicVideo = z.output<typeof musicVideoSchema>`, `MusicVideoInput`, `Shot`.
  - `isMusicVideo(raw: unknown): boolean`: true when `raw` is an object with `format === "music-video"`.
  - `timingSchema` words gain `line: z.number().int().nonnegative().optional()`. The timing object gains `beats: z.array(z.number()).optional()` and `tempo: z.number().optional()`. These are backward compatible: old timing files still parse.
- `sync.ts` writes `z.toJSONSchema(z.union([episodeSchema, musicVideoSchema]), …)`.

- [ ] **Step 1: Failing tests** in `schema.test.ts`:
  - `parses a minimal music video`: `musicVideoSchema.parse({slug:"x-y",format:"music-video",title:"T",song:{title:"Empires",artist:"PTRA"},shots:[{visual:"a"}]})` has `subtitles === true`, `titleCard` deep-equals `{seconds:4}`, `song.file === "song.wav"`, `credits.seconds === 8`, `shots[0].transition === "cut"`.
  - `rejects cue and beat together`: `safeParse` with `shots:[{visual:"a"},{visual:"b",cue:"x",beat:3}]` fails, and the message includes `"not both"`.
  - `isMusicVideo`: true for `{format:"music-video"}`; false for `{format:"countdown"}`, `null` and `"x"`.
  - `old timing still parses`: `timingSchema.parse({duration:1,words:[{word:"a",start:0,end:1}]}).words[0].line === undefined`.
  - `news episodes reject music-video format`: `episodeSchema.safeParse({format:"music-video"}).success === false`.
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement in `schema.ts` and update `sync.ts`.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run sync`. Expected: tests PASS; typecheck clean; `episodes/episode.schema.json` now has a top-level `anyOf`.
- [ ] **Step 5:** Commit: `feat(music-video): episode schema and timing extensions`.

### Task 3: Resolver

**Files:**
- Create: `src/kit/lib/resolveMusicVideo.ts`, `src/kit/lib/resolveMusicVideo.test.ts`

**Interfaces:**
- Consumes: `MusicVideo`, `Timing`, `AssetManifest` (Task 2); `findPhrase`, `wordIndexAt`, `toFrame`, `FPS`, `LEAD` (`timing.ts`); `resolveVisual`, `Issue`, `Asset` (`resolve.ts`).
- Produces:
  - `type ResolvedShot = { index: number; shot: Shot; at: number /* seconds */; from: number; to: number /* frames */; asset: Asset | null; in: number }`
  - `type SubtitleLine = { line: number; text: string; start: number; end: number /* seconds, display window */ }`
  - `type MusicVideoTimeline = { slug: string; songDuration: number; durationInFrames: number; estimated: boolean; shots: ResolvedShot[]; subtitles: SubtitleLine[]; titleCard: { from: number; to: number } | null; credits: { from: number; to: number; pages: number }; issues: Issue[] }`
  - `resolveMusicVideo(ep: MusicVideo, timing: Timing, assets: AssetManifest, creditPages = 1): MusicVideoTimeline`
  - `subtitleLines(words: Timing["words"]): SubtitleLine[]`. This groups by `line` (words with no `line` are skipped) and applies the display window from Global Constraints.

Algorithm (the order rules the tests pin):
- Keep `prevAt` (seconds) and `wordFrom` (word index).
- Shot 0 is at 0. A `cue`/`beat` on it is a warning: "the first shot always starts at 0".
- For later shots:
  - **Cue:** `findPhrase(words, cue, max(wordFrom, wordIndexAt(words, prevAt + 0.01)))`. On a hit, `at = start`, `from = toFrame(start − LEAD)`, `wordFrom = endIndex`.
  - **Beat:** requires `timing.beats`; `at = beats[beat]`, `from = toFrame(at)`. It's an error if out of range or `at ≤ prevAt`.
  - **Neither:** error `needs a cue or a beat`.
- Unresolved shots get an evenly spaced fallback, as in `resolve.ts`, so the preview still shows something.
- **Credits:**
  - `credits.cue`/`credits.beat` resolved the same way after the last shot → `from`.
  - Otherwise `from = toFrame(songDuration) + FPS/2`.
  - `to = from + pages × toFrame(credits.seconds)`.
- The last shot ends at `credits.from`.
- `durationInFrames = max(toFrame(songDuration + 1), credits.to)`.
- **Errors and warnings:**
  - missing visual → error
  - shot `to − from < toFrame(0.4)` → error
  - shot `> 12 s` → warning
  - clip `in ≥ asset.duration` → error
  - clip `asset.duration − in < slot seconds × 0.5` → warning "slowed to half speed and looped"
  - `timing.estimated` → error, same text pattern as `resolve.ts`, naming `npm run lyrics`
- `titleCard`: `{from: 0, to: toFrame(seconds)}`, or null.

- [ ] **Step 1: Failing tests.** Build a fixture `words` for "Managed Freedom see how … Empires Go" sung twice: a chorus at 10 s and the same chorus at 60 s, with `line` set. Use `beats = [0, 0.5, 1, …]` every 0.5 s to 120 s, `duration 120`, and assets with clips `a,b,c,d` of duration 30.
  - `repeated chorus cue hits the next occurrence`: `shots [a, {b, cue:"Managed Freedom"}, {c, beat: 100 /* 50 s */}, {d, cue:"Managed Freedom"}]` gives `shots[1].at === 10` and `shots[3].at === 60`.
  - `cue after a beat shot searches after the beat`: with `shots[2]` at beat 130 (65 s), `shots[3]`'s cue is not found → an issue with `where === "shots[3].cue"`.
  - `beat out of order is an error`: beat 10 after a cue at 10 s → error on `shots[2].beat`.
  - `beat out of range is an error`: `beat: 9999` → error.
  - `in-point past clip end is an error`: `{visual:"a", in: 31}` → error on `shots[0].in`.
  - `short shot is an error, long shot a warning`: two cues 0.2 s apart → error; a 20 s shot → warning.
  - `credits default after song, cue overlays`: without `credits.cue`, `credits.from === toFrame(120) + 15`. With `credits.cue: "Empires Go"` (second occurrence, after the last shot), `credits.from === toFrame(thatStart − LEAD)` and the last shot's `to === credits.from`.
  - `pages extend credits`: `resolveMusicVideo(ep, timing, assets, 3).credits.to − from === 3 × toFrame(8)`.
  - `subtitle window`: lines at [10, 11.5] and [12, 13]. Line 0 shows 9.85 → 11.95 (capped by next start −0.05); line 1 shows 11.85 → 13.8.
  - `first shot cue warns`: `shots[0].cue` set → warning.
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(music-video): shot and subtitle resolver`.

### Task 4: Scaffold and script plumbing

**Files:**
- Modify:
  - `scripts/lib/util.ts` (`paths`)
  - `scripts/lib/template.ts` (add `templateMusicVideo`)
  - `scripts/new.ts`
  - `scripts/assets.ts`, `scripts/align.ts`, `scripts/voice.ts`, `scripts/short.ts` (guards)
- Create: `scripts/lib/musicVideo.ts`, `scripts/lib/musicVideo.test.ts`

**Interfaces:**
- `paths(slug)` gains:
  - `lyrics: join(src, "lyrics.txt")`
  - `stems: join(src, "stems")` (vocal stem and transcription cache; git-ignored with `episodes/*/`)
  - `lyricsDiff: join(src, "lyrics-diff.txt")`
- `scripts/lib/musicVideo.ts` exports:
  - `isMusicVideoSlug(slug: string): boolean` (reads raw `episode.json`, uses `isMusicVideo`; false if unreadable)
  - `songFileName(sourcePath: string): string`, giving `"song" + lowercased extension`
  - `loadMusicVideoFromDisk(slug): { slug; p; episode: MusicVideo | null; episodeErrors: string[]; timing: Timing | null; assets: AssetManifest | null; timeline: MusicVideoTimeline | null }`, mirroring `scripts/lib/episode.ts`'s `loadFromDisk`
- `templateMusicVideo({ slug, title, subtitle?, artist, songFile, theme }): { episode: MusicVideoInput; lyrics: string }`. It writes one placeholder shot `{ visual: "placeholder" }`, `subtitles: true`, and an empty lyrics placeholder comment telling the producer to paste the sheet.
- `npm run new -- <slug> --format music-video --song <path> [--title "…"] [--subtitle "…"] [--artist "…"] [--theme id]`:
  - Fails without `--song` or if the file is missing.
  - Copies the song to `public/episodes/<slug>/<songFileName>`.
  - Title defaults from the file name: the text after the last `" - "`, with a trailing `(…)` moved into `subtitle`. So "PTRA - Empires (Plata o Plomo Power Mix)" → title "Empires", subtitle "Plata o Plomo Power Mix".
  - The artist comes from `--artist`, else the latest music video's `song.artist`, else `"Paranormal Threat Reduction Agency"`.
  - Writes `credits.json` as `[{file: songFile, title: "<title> (<subtitle>)", author: artist, license: "OWN WORK"}]`, plus `notes.md` and an empty `lyrics.txt`, and no `article.md`/`voiceover.txt`.
  - Writes `timing.json` as `{duration: <ffprobe song>, estimated: true, words: []}`, then `scanAssets(slug, songFile)` and `sync()`.
- `scripts/assets.ts`: for a music video, pass `episode.song.file` to `scanAssets` (the song occupies the manifest's `voiceover` slot; comment this).
- `align.ts`, `voice.ts` and `short.ts` `fail()` on a music video with "music videos use `npm run lyrics -- <slug>`" (for short: "Shorts from music videos aren't supported").

- [ ] **Step 1: Failing tests** in `musicVideo.test.ts`:
  - `songFileName("C:/x/PTRA - Empires (Plata o Plomo Power Mix).WAV") === "song.wav"`
  - `songFileName("a.mp3") === "song.mp3"`
  - `titleFromFile("PTRA - Empires (Plata o Plomo Power Mix).wav")` deep-equals `{title:"Empires", subtitle:"Plata o Plomo Power Mix"}`. Export `titleFromFile` from `musicVideo.ts` too.
  - `titleFromFile("Song.wav")` deep-equals `{title:"Song"}`.
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement everything above.
- [ ] **Step 4:** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Run `npm run new -- zz-mv-scaffold --format music-video --song "temp_input/PTRA - Empires (Plata o Plomo Power Mix).wav"`. Expected:
  - `public/episodes/zz-mv-scaffold/song.wav` exists
  - `episode.json` has title "Empires" and subtitle "Plata o Plomo Power Mix"
  - `credits.json` has the OWN WORK entry
  - `npm run align -- zz-mv-scaffold` fails with the lyrics message
  
  Delete both `zz-mv-scaffold` folders and run `npm run sync`.
- [ ] **Step 6:** Commit: `feat(music-video): scaffold with npm run new --format music-video`.

### Task 5: `npm run lyrics` (separation, transcription, alignment, beats)

**Files:**
- Create:
  - `requirements-lyrics.txt`
  - `scripts/setup-lyrics.ts`
  - `scripts/lyrics.ts`
  - `scripts/lyrics_align.py` (runs in `.venv`)
  - `scripts/beats.py` (runs in `.venv-music`)
  - `src/kit/lib/placeUnmatched.ts`, `src/kit/lib/placeUnmatched.test.ts`
- Modify: `package.json` (`"lyrics": "tsx scripts/lyrics.ts"`, `"setup:lyrics": "tsx scripts/setup-lyrics.ts"`)

**Interfaces:**
- `requirements-lyrics.txt`: `demucs==4.0.1`, `librosa==0.11.0`, installed into `.venv-music` by `npm run setup:lyrics`. It fails with "run npm run setup:music first" if `.venv-music` is missing, and afterwards verifies `torch.__version__ == "2.7.1+cu126"` (pip must not have replaced torch; if it would, install demucs with `--no-deps` plus its listed pure-Python deps).
- **Separation:** `.venv-music` python `-m demucs.separate --two-stems vocals -n htdemucs -o <stems> <song>` → `<stems>/htdemucs/song/vocals.wav`. Skipped when present unless `--force`.
- `python -I scripts/lyrics_align.py <vocals.wav> <words.json> <out.json> <heard.txt> <cache.json> [model=medium] [device=cpu]`:
  - Imports `load_audio`, `transcribe`, `norm` and `expand` from `align.py`. `-I` isolation is fine: insert the script's own dir into `sys.path` explicitly.
  - Transcription is cached in `cache.json` keyed by model and stem mtime.
  - `words.json` is the sheet's words. The script matches them to the heard words with `difflib.SequenceMatcher(autojunk=False)`.
  - Writes `out.json`:
    ```
    {
      duration, matched, total,
      times: [[start,end] | null per sheet word],
      diffs: [{ op: "replace"|"delete"|"insert", sheetFrom, sheetTo, heard: "<heard text>", start, end }]
    }
    ```
    `insert` means sung but not in the sheet; `delete` means in the sheet but not heard. It does **no** interpolation; TS does that.
- `python -I scripts/beats.py <song> <out.json>` (`.venv-music`) writes `{ tempo: number, beats: number[] }` from `librosa.beat.beat_track(units="time")` on the full mix.
- `placeUnmatched(times: ([number, number] | null)[], lines: number[], duration: number): [number, number][]`. Within each run of nulls:
  - If both neighbours are in the same line as the run, interpolate between them evenly (as `align.py` does).
  - Otherwise, place the run's words in a window that ends at the next matched word's start and lasts `0.35 s × count`, packed back-to-back. If there's no next word, start at the previous word's end, with the same width.
  - Never place words before 0 or after `duration`.
- `scripts/lyrics.ts <slug> [--force] [--model medium] [--device cpu] [--aligner whisper|mms]`:
  1. Parse `lyrics.txt` (Task 1). If it's empty, run transcription only, write the heard lines into `lyrics.txt` as a draft, print "draft lyrics written: get the user to correct them, then re-run", and exit 0.
  2. Separate (cached), then transcribe and match (`lyrics_align.py`), then `placeUnmatched`.
  3. Optionally run the MMS refinement (Task 6).
  4. Run beats.
  5. Write `timing.json` = `{ duration, match:{matched,total}, words:[{word,start,end,line}], beats, tempo }`.
  6. Write `lyrics-diff.txt`, one block per diff: time, sheet words, heard words. Print it.
  7. Print the song map: each section name with its start time (the first word of its first line), and each gap of more than 4 s between lines as "instrumental m:ss–m:ss, beats N–M".
  8. Print the match rate; warn under 0.8.
  9. `scanAssets(slug, song.file)` and `sync()`.

- [ ] **Step 1: Failing tests** in `placeUnmatched.test.ts`:
  - `interpolates inside a line`: `times [[1,1.5], null, [2.5,3]]`, `lines [0,0,0]` → middle `[1.5,2.5]`.
  - `does not spread across an instrumental`: `times [[1,1.5], null, null, [40,40.5]]`, `lines [0,1,1,1]` → words 1–2 `[[39.3,39.65],[39.65,40]]`.
  - `trailing unmatched after last word`: `times [[1,1.5], null]`, `lines [0,0]`, duration 10 → `[1.5,1.85]`.
  - `leading unmatched clamps at 0`: `times [null, null, [0.3,0.6]]` → starts ≥ 0, ends ≤ 0.3, in order.
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `placeUnmatched`, the Python scripts, setup and `lyrics.ts`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Run `npm run setup:lyrics`. Expected: demucs and librosa import in `.venv-music`; torch unchanged.
- [ ] **Step 6:** End-to-end on the real song.
  - Scaffold `zz-mv-lyrics` from the WAV (Task 4) and paste the spec appendix sheet into `lyrics.txt`, with the display fixes from spec step 6.2.
  - Run `npm run lyrics -- zz-mv-lyrics`.
  - Expected: `vocals.wav` exists, `timing.json` has ~300 words, all with a `line`, beats are non-empty, and the tempo is plausible (60–200).
  - The diff file and song map print, and the match rate is reported.
  - Record the match rate and the runtime per stage in the task report.
  - Keep this episode for Task 6.
- [ ] **Step 7:** Commit: `feat(music-video): npm run lyrics (vocal stem, alignment, beats)`.

### Task 6: MMS forced-alignment refinement

**Files:**
- Create: `scripts/lyrics_fa.py` (runs in `.venv-music`)
- Modify: `scripts/lyrics.ts` (`--aligner`)

**Interfaces:**
- `python -I scripts/lyrics_fa.py <vocals.wav> <in.json> <out.json> [device=cuda]`.
  - `in.json`: `{ words: [{word, start, end, line}] }`, the coarse times from Task 5.
  - `out.json`: `{ words: [{start, end}], chunks: [{from, to, ok: bool, reason?}] }`.
- Algorithm:
  - Group consecutive lyric lines into chunks whose coarse span (first start −1 s to last end +1 s) is ≤ 30 s, splitting only between lines.
  - For each chunk, run `torchaudio.pipelines.MMS_FA` on that 16 kHz mono slice of the stem.
  - Normalize words to `a–z'`: lowercase, strip accents and other characters, and spell digits as words with `say()` from `align.py`.
  - Map frames back with the chunk offset.
  - Words with no letters keep their coarse times.
  - On any chunk failure (empty transcript, more tokens than frames, CUDA OOM), keep the coarse times for that chunk and mark `ok: false` with the reason.
- `lyrics.ts --aligner mms` (the default when `.venv-music` has torchaudio) runs it after `placeUnmatched` and prints:
  - chunks ok/failed
  - the median and 95th-percentile |Δstart| between MMS and Whisper for words Whisper matched

- [ ] **Step 1:** Implement `lyrics_fa.py` and the `--aligner` switch.
- [ ] **Step 2:** Run `npm run lyrics -- zz-mv-lyrics --aligner mms`. Expected: every chunk ok, or failures listed with reasons; median Δ < 0.3 s; 95th < 1.0 s. If the 95th is ≥ 1.0 s, pull five short WAV snippets around the worst words (ffmpeg) and listen (or compare against the waveform onset) to decide which aligner is right.
- [ ] **Step 3:** Set the default aligner to whichever is more accurate on "Empires". Record the numbers and the choice in a comment at the top of `lyrics.ts`.
- [ ] **Step 4:** Commit: `feat(music-video): MMS forced-alignment refinement`.

### Task 7: `check` for music videos (and shared licensing helper)

**Files:**
- Modify: `scripts/lib/check.ts`
- Create: `scripts/lib/checkMusicVideo.ts`, `scripts/lib/checkMusicVideo.test.ts`

**Interfaces:**
- From `check.ts`, export `loadCredits` and a new `mediaLicenseIssues(p, epCredits, libCredits, usedLibraryFiles: Set<string>): Issue[]`. It's the body of the current licensing section, minus the per-segment AI-note checks:
  - the needs-a-credit loop over clips/images/sfx/music
  - library needs
  - credited-but-missing
  - AI-license misuse
  - press rules
  
  `runCheck` calls it with the same inputs, so its output stays byte-identical.
- `runCheck(slug)` returns `runMusicVideoCheck(slug)` first thing when `isMusicVideoSlug(slug)`.
- `lyricsStale(lyricsText: string, timing: Timing): boolean` compares `lyricWords(parseLyrics(text)).map(w=>w.word)` with `timing.words.map(w=>w.word)`.
- `runMusicVideoCheck(slug): Issue[]` checks:
  - schema errors
  - slug mismatch
  - `timing.json` missing/estimated
  - `lyricsStale` → error "lyrics.txt changed since timing.json was written: re-run npm run lyrics"
  - song missing from assets
  - song duration vs `timing.duration` > 0.5 s → error
  - stale `assets.json` (reuse the same comparison; extract it to a helper)
  - all `timeline.issues`
  - match rate < 0.8 → warning pointing to `lyrics-diff.txt`
  - a subtitle line > 80 chars → warning
  - a song with no credits entry → error
  - `mediaLicenseIssues`
  - an AI-generated shot without a `note` → error (same message as news episodes)
  - AI imagery and press rules for `thumbnail.visual`
  - `summary` missing → warning
  - shots using `beat` while `timing.beats` is missing → error "run npm run lyrics (it writes beats)"
  - no `article.md` and no sources-card checks

- [ ] **Step 1: Failing tests** in `checkMusicVideo.test.ts`:
  - `lyricsStale` is false for an identical sheet.
  - It is true when one word is edited.
  - It is false when only a `[tag]` or blank line is added.
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the extraction and `runMusicVideoCheck`.
- [ ] **Step 4:** Regression: for every slug in the baseline folder, run `npx tsx scripts/check.ts <slug>` and diff the output against `baseline/<slug>.txt`. Expected: no differences for all 15 episodes.
- [ ] **Step 5:** Run `npm run check -- zz-mv-lyrics`. Expected: errors only for the placeholder visual and its missing credit, with no crash.
- [ ] **Step 6:** Commit: `feat(music-video): check`.

### Task 8: Rendering (format, subtitles, title card, credits roll, thumbnail, Root)

**Files:**
- Create:
  - `src/kit/musicVideoContext.tsx`
  - `src/kit/MusicVideoEpisode.tsx`
  - `src/kit/formats/MusicVideo.tsx`
  - `src/kit/MusicVideoThumbnail.tsx`
  - `src/kit/lib/creditPages.test.ts`
- Modify:
  - `src/kit/scenes/CreditsCard.tsx` (split into a pure `CreditsRoll` with paging)
  - `src/kit/lib/credits.ts` (`musicVideoCredits`, `creditRows`, `creditPages`)
  - `src/kit/Episode.tsx`
  - `src/Root.tsx`

**Interfaces:**
- `credits.ts`:
  - `creditRows(credits: UsedCredits): { left: Group[]; right: Group[] }` (today's grouping logic, moved out of `CreditsCard`; `Group = { heading: string; items: { who: string; what: string }[] }`)
  - `creditPages(groups, maxRowsPerColumn = 14): …[]`. It splits groups across pages so no column exceeds 14 rows (heading = 1.6 rows, as today), keeping a group's heading on each page it continues to.
  - `musicVideoCredits(ep: MusicVideo, episodeCredits: Credit[]): UsedCredits`:
    - visuals = non-AI `clips/`/`images/`
    - generated = AI visuals
    - audio = the entry whose `file === ep.song.file`
  
  The news "MAP DATA" row is omitted for music videos (`CreditsRoll` takes a `mapData: boolean` prop).
- `CreditsRoll: React.FC<{ credits: UsedCredits; theme: Theme; page: number; pages: number; mapData: boolean }>`. `CreditsCard` keeps its name and behaviour for news episodes (it calls `CreditsRoll` with `page 0`, `pages 1`, `mapData true`). Snapshot parity is checked visually in Step 7.
- `musicVideoContext.tsx`:
  - `MusicVideoCtx = { episode: MusicVideo; timeline: MusicVideoTimeline; assets: AssetManifest; credits: UsedCredits; theme: Theme; base: string }`
  - `MusicVideoProvider` and `useMusicVideo()`
- `MusicVideoEpisode.tsx`:
  - `mvCompositionSchema = z.object({ episode: musicVideoSchema })`
  - `loadMusicVideo(entry: RegistryEntry, raw?: unknown): { ok: true; ctx: MusicVideoCtx } | { ok: false; slug; errors }`. It computes the pages with `creditPages` and passes the count to `resolveMusicVideo`.
  - `makeMusicVideoComponents(entry): { Video; Thumb }`
- `Root.tsx` branches on `isMusicVideo(entry.episode)`: the schema, `durationFor` and components all come from the music-video module. It's always 16:9 with a thumb still.
- `formats/MusicVideo.tsx` renders:
  - **Shots:** one `<Sequence>` per resolved shot.
    - Clips: `OffthreadVideo` muted, `startFrom = toFrame(in)`, `objectFit: cover`, `playbackRate = max(0.5, min(1, (dur − in) / slotSeconds))`, wrapped in `Loop` when still short. No Ken Burns on clips.
    - Images: the existing Ken Burns push.
    - `transition`: `"glitch"` uses `GlitchCut`; `"flash"` is a 4-frame white-to-clear overlay; `"cut"` has none.
    - An optional `note` sits bottom-right, styled like `Backdrop`'s note.
    - No theme tint or side gradient. Only a bottom gradient, shown while subtitles are on.
  - **Subtitles** (when `episode.subtitles` and the shot's `subtitles !== false`, and before `credits.from`):
    - the active `SubtitleLine`, centred
    - `bottom: 96px`, `max-width: 1500px`, at most 2 rows
    - theme `fonts.body` 700, 52 px, `colors.text`, with `effects.captionShadow` plus a soft dark text stroke
    - 4-frame fade in and out
    - no uppercase transform: lyrics show as written
  - **Title card:** during `titleCard` frames, bottom-left over the shot:
    - `song.title` in `fonts.display` ~120 px
    - `song.subtitle` in `fonts.mono` ~34 px
    - `song.artist` in `fonts.body` ~40 px in `colors.accent`
    - a 12-frame fade/slide in and an 18-frame fade out
    - subtitles still show over it
  - **Credits:** `CreditsRoll` pages over `[credits.from, credits.to)`, full frame on `colors.bg`, each page `credits.seconds` long.
  - **Audio:** one `<Audio src={staticFile(assets.voiceover.file)} />` (the song). Nothing else.
  - **Issues overlay:** a small red list of `timeline.issues` errors in Studio only (`getRemotionEnvironment().isStudio`), as `IssuesOverlay` does.
- `MusicVideoThumbnail`: 1280×720.
  - The background is `thumbnail.visual` (an image, or a clip frame at `thumbnail.frame`, default 1 s).
  - The title (and subtitle) is large at bottom-left, with the artist above it in accent, over a left/bottom gradient.
  - With no visual, it falls back to the first shot's visual.

- [ ] **Step 1: Failing tests** in `creditPages.test.ts`:
  - `creditPages` of one group with 30 items and `max 14` gives 3 pages, each repeating the heading.
  - A group of 5 gives 1 page.
  - `musicVideoCredits` puts `song.wav` in `audio` and an AI image in `generated`, not `visuals`.
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the credits helpers and `CreditsRoll`, then the context, episode loader, format, thumbnail and Root branch.
- [ ] **Step 4:** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Fixture on `zz-mv-lyrics`:
  - Add two PD stills to `images/` (any PD image already in another episode's `images/` with its credit entry copied), one still generated with `npm run infographic -- zz-mv-lyrics probe --still` using the skill template, and a clip copied from another episode's `clips/` with its credit.
  - Set shots: still → clip on cue `"First European"` with `in: 1` → still on a beat inside the first instrumental → still on cue `"Managed Freedom"` with `transition: "glitch"`.
  - Set `credits.seconds: 6`.
  - Run `npm run assets` and `npm run check`. Expected: 0 errors.
- [ ] **Step 6:** Render stills and look at each PNG:
  1. title card + first subtitle, at frame `toFrame(first word start + 0.5)`
  2. the first cue shot, 1 frame after its `from`
  3. mid-chorus with a subtitle
  4. a credits page
  5. `npm run thumb -- zz-mv-lyrics`
  
  For 1–4, use `npx remotion still src/index.ts zz-mv-lyrics <scratchpad>/f<frame>.png --frame=<n>`. Check that subtitles are legible, the title card is correct, credits list the song as "Original work" with no MAP DATA row, and the thumbnail shows the title and artist.
- [ ] **Step 7:** Regression. **Before Step 3**, render a reference frame inside the credits card of `2026-10-21-ai-roundup` with `npx remotion still` into the scratchpad. Now render the same frame again and compare the two PNGs. Expected: identical layout.
- [ ] **Step 8:** Partial render: `npm run render -- zz-mv-lyrics -- --frames=0-899`. Expected: the render completes. Mastering may fail its loudness target on a 30 s excerpt; that's fine here, so report the numbers rather than treating it as a failure. Watch `out/zz-mv-lyrics/video.mp4` frames at the cue time to confirm the cut lands within ~2 frames of the sung word.
- [ ] **Step 9:** Commit: `feat(music-video): MusicVideo format, subtitles, title card, paged credits, thumbnail`.

### Task 9: Description (`npm run credits`)

**Files:**
- Modify: `scripts/credits.ts`
- Create: `scripts/lib/musicVideoDescription.ts`, `scripts/lib/musicVideoDescription.test.ts`

**Interfaces:**
- `musicVideoDescription(ep: MusicVideo, lyrics: Lyrics, used: UsedCredits): string`. It returns the DESCRIPTION.md body, in this order:
  1. the `# <title>: YouTube description` header and paste line, as for news episodes
  2. the title line `<song.title> (<song.subtitle>)`, or just the title
  3. the summary (or the placeholder)
  4. `Music: <song.title> (<song.subtitle>) by <artist>`
  5. `LYRICS`: the lines with stanza breaks as blank lines, and no tags
  6. `SOURCES` (only if `ep.sources` is non-empty)
  7. `CREDITS`: footage and images (same line format as `credits.ts`), AI-generated illustrations, and "Music: … Original work"
  
  It has no chapters and no map-data line.
- `credits.ts`: right after `requireSlug`, when `isMusicVideoSlug(slug)`, load it with `loadMusicVideoFromDisk`, write `out/<slug>/DESCRIPTION.md` from `musicVideoDescription`, and exit 0. No REFERENCES.md unless there are sources.

- [ ] **Step 1: Failing test:** for a fixture with the sheet `"[Chorus]\nManaged Freedom\nSee how free you are\n\n[Outro]\nEmpires Go (go go go)"`:
  - the output contains `"LYRICS\nManaged Freedom\nSee how free you are\n\nEmpires Go (go go go)"`
  - it contains `"Music: Empires (Plata o Plomo Power Mix) by Paranormal Threat Reduction Agency"`
  - it contains neither `"[Chorus]"` nor `"CHAPTERS"` nor `"Map data"`
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test && npm run typecheck`, then `npm run credits -- zz-mv-lyrics` and read the file. Expected: as tested, with real credits lines.
- [ ] **Step 5:** Commit: `feat(music-video): YouTube description with lyrics`.

### Task 10: Producer docs and skill

**Files:**
- Create: `.claude/skills/music-video/SKILL.md`
- Modify: `CLAUDE.md`, `README.md`, `.claude/skills/new-episode/SKILL.md`

- [ ] **Step 1:** Write `music-video/SKILL.md` with frontmatter `name: music-video` and a description that triggers on "music video", "video for my song", or a song file plus lyrics. Its procedure is spec section 6, with the commands from this plan:
  1. intake questions, including subtitles on/off **every time**
  2. the lyrics paste with display fixes logged in `notes.md`
  3. `npm run lyrics`
  4. **STOP**: show the user the `lyrics-diff.txt` differences, then correct the sheet to the audio and re-run
  5. the shot-plan table and pacing guidance from the song map
  6. **STOP**: plan approval
  7. the find-media subagents (point to `.claude/skills/new-episode/asset-prompts.md`, noting that music-video shots need no FILE FOOTAGE notes)
  8. creative-mode explainers (explainer skill), rendered silent with `npm run infographic -- <slug> <name> --seconds <slot+2>`, then storyboard **STOP**s
  9. `episode.json` field guide (shots/cue/beat/in/transition/subtitles/credits.cue)
  10. `npm run assets` → `npm run check` (0 errors)
  11. **STOP**: preview approval
  12. AC power → render → thumb → credits
  
  Also cover the facts rule (on-screen added text must be true and sourced; lyrics are art) and the anti-goals: no AI images of real people, and no fake records of events.
- [ ] **Step 2:** Update `CLAUDE.md`:
  - add `--format music-video --song <path>` to the `new` line, plus `npm run lyrics -- <slug> [--force] [--aligner mms|whisper]` and `npm run setup:lyrics`
  - rule 2: for music videos the lyrics stand in for the article, and added on-screen facts need sources in `notes.md`
  - rule 3: no FILE FOOTAGE notes on music videos, but the AI note still applies
  - rule 6: music-video stops are lyrics confirmation, plan approval and preview approval, with no voice step
  - a pointer to the `music-video` skill near the top
- [ ] **Step 3:** `README.md`: a short "Music videos" section (what it is, the commands, the episode.json example from the spec). `new-episode/SKILL.md`: one line in Intake: "A music video (a song, not an article) uses the `music-video` skill instead."
- [ ] **Step 4:** Commit: `docs(music-video): skill, CLAUDE.md rules, README`.

### Task 11: Final regression and cleanup

- [ ] **Step 1:** Run `npm test && npm run typecheck`. Expected: all pass.
- [ ] **Step 2:** For each of the 15 baseline slugs, diff `npx tsx scripts/check.ts <slug>` against its baseline file. Expected: identical.
- [ ] **Step 3:** Run `npm run render -- 2026-10-21-ai-roundup-short1 -- --frames=0-89` (a news Short, partial). Expected: it renders.
- [ ] **Step 4:** Delete the `zz-mv-lyrics` episode folders (`episodes/` and `public/episodes/`) and run `npm run sync`. The real "Empires" episode is made next via the `music-video` skill, with the user's stops. Copy the timing/aligner numbers from Task 6 into its `notes.md` when it's created.
- [ ] **Step 5:** Commit if anything changed: `chore(music-video): final regression pass`.
