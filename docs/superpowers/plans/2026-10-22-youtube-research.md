# YouTube research and clips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the producer search YouTube, preview and read transcripts as research, and pull CC BY (or federal PD) clips that the kit tags with the channel name, with no API key.

**Architecture:** `npm run youtube` (scripts/youtube.ts) drives yt-dlp from the kit's `.venv` for search, captions and section downloads; pure parsing lives in `scripts/lib/youtube.ts`. A clip's YouTube credit is the single source of truth: `npm run assets` copies the channel into `assets.json` (`attribution`), `resolveVisual` carries it on the `Asset`, and every place footage plays draws a `SourceTag` overlay from it. `check` enforces the license/author/thumbnail rules and that `assets.json` matches the credits.

**Tech Stack:** TypeScript (tsx, node:test), Remotion 4, zod 4, yt-dlp (pip, `.venv`), ffmpeg.

**Spec:** `docs/superpowers/specs/2026-10-22-youtube-research-design.md`

## Global Constraints

- No YouTube API key, OAuth, or browser cookies. yt-dlp only.
- Config: `youtube.search_youtube` default `true`; `youtube.use_video_as_citation` default `true`.
- Clip licenses: `CC BY` (licenseVersion `"3.0"`, confirmed against what yt-dlp reports) or `PD` with a basis (verified US federal agency channel, the agency's own footage). Nothing else.
- Tag text: `VIDEO · <Channel> / YouTube`. Drawn by the kit, never burned into the file.
- Clip file spec: 1920×1080 cover-crop (`scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080`), 30 fps, libx264 yuv420p crf 23, `-an`, `-movflags +faststart`.
- Credit shape: `{ file: "clips/<name>.mp4", title: <video title>, author: <channel>, license, licenseVersion?, sourceUrl: "https://www.youtube.com/watch?v=<id>", notes: "YouTube <from>–<to>; trimmed and scaled; channel watermark shown in the video" }` (PD: basis appended to notes).
- Raw files: `episodes/<slug>/raw/youtube/<videoId>/` and `episodes/<slug>/raw/youtube/search-<n>.json`; clips: `public/episodes/<slug>/clips/`.
- Commons-mirrored YouTube videos are ordinary Commons files: no YouTube rule, no tag. Existing episodes must still pass `npm run check` unchanged.
- `search_youtube: false`: `npm run youtube` refuses without `--ignore-off`; `check` warns (not errors) on a YouTube credit.
- Comment density and idiom: match the surrounding files (header comment block on scripts, one-line JSDoc on exports).

## Review Focus

1. **Channel names that are long, non-Latin or full of symbols** (e.g. 60+ chars, emoji, `&`, CJK). Expected: the tag shortens with an ellipsis at 40 chars, renders in the theme font without overflow. Test in Task 1.
2. **Videos without English manual captions** (auto only, other languages only, none). Expected: manual English > auto English > clear "no English captions" exit, header says which kind was used. Test in Task 5.
3. **Credits edited after `npm run assets`** (channel renamed, credit removed, clip added by hand). Expected: `check` errors "run npm run assets" instead of rendering a stale or missing tag. Test in Task 4.
4. **Shorts reusing the parent's YouTube clip** (hard-linked file, copied credits.json). Expected: the Short's own `assets.json` carries `attribution`, the tag appears in the 9:16 layout. Verified with a still in Task 3; `scanAssets` test in Task 2 covers the data path.
5. **Bad clip ranges** (`--to` before `--from`, past the video's end, longer than 15 s, `1:2:3` malformed). Expected: a clear error before anything downloads. Test in Task 5 (`parseTimestamp`, `validateRange`).

---

### Task 1: Config section and YouTube helpers

**Files:**
- Modify: `scripts/lib/config.ts` (add `youtube` to `configSchema`, after `licensing`)
- Modify: `config.yaml` (new `youtube:` section, after `licensing:`; copy the commented block from the spec's "Config" section verbatim)
- Create: `src/kit/lib/youtube.ts`
- Test: `src/kit/lib/youtube.test.ts`

**Interfaces:**
- Produces: `isYouTubeUrl(url?: string): boolean`; `youtubeTagText(channel: string, max?: number): string` (default `max = 40`); `TAG_PREFIX = "VIDEO · "`, suffix `" / YouTube"`. `Config["youtube"]` = `{ search_youtube: boolean; use_video_as_citation: boolean }`.

- [ ] **Step 1: Write the failing tests** in `src/kit/lib/youtube.test.ts`:
  - `isYouTubeUrl` true for `https://www.youtube.com/watch?v=abc`, `https://youtube.com/watch?v=abc`, `https://m.youtube.com/watch?v=abc`, `https://youtu.be/abc`; false for `https://commons.wikimedia.org/wiki/File:X.webm`, `https://notyoutube.com/x`, `undefined`, `"not a url"`.
  - `youtubeTagText("NASA")` === `"VIDEO · NASA / YouTube"`.
  - `youtubeTagText("A".repeat(60))` === `"VIDEO · " + "A".repeat(39) + "… / YouTube"`.
  - `youtubeTagText("  Spaced  ")` trims to `"VIDEO · Spaced / YouTube"`.
  - A channel with emoji/CJK is shortened by code points, not UTF-16 units (no broken surrogate at the cut).
- [ ] **Step 2: Run** `npm test` → the new tests fail (module missing).
- [ ] **Step 3: Implement** `src/kit/lib/youtube.ts` (pure, no Node imports, it's used by the render). Host check on `new URL(url).hostname` in a try/catch: `youtube.com`, any `*.youtube.com`, `youtu.be`. Add the `youtube` object to `configSchema` with `.prefault({})`, both booleans `.default(true)`, and the `config.yaml` section.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` → pass.
- [ ] **Step 5: Commit** `feat(youtube): config section and URL/tag helpers`.

### Task 2: Attribution from credits into assets.json and Asset

**Files:**
- Modify: `src/kit/schema.ts:330` (`media` gets `attribution: z.string().optional().describe("Channel shown in the kit's YouTube source tag; written by npm run assets from credits.json")`)
- Modify: `scripts/lib/assets.ts` (`scanAssets` fills `attribution` for clips)
- Modify: `src/kit/lib/resolve.ts:8,65` (`Asset` clip variant gets `attribution?: string`; `resolveVisual` copies it)
- Create: `src/kit/lib/attribution.ts`
- Test: `src/kit/lib/attribution.test.ts`

**Interfaces:**
- Consumes: `isYouTubeUrl` (Task 1).
- Produces: `youtubeAttributions(credits: Credit[]): Record<string, string>` mapping clip file (`"clips/x.mp4"`) → channel, only for YouTube `sourceUrl` credits under `clips/`. `Asset = { kind: "clip"; file: string; duration: number; attribution?: string } | { kind: "image"; file: string }`.

- [ ] **Step 1: Write the failing tests:**
  - `youtubeAttributions` returns `{ "clips/a.mp4": "NASA" }` for a CC BY credit with `sourceUrl: "https://www.youtube.com/watch?v=1"`, and ignores a Commons credit, a YouTube credit for `images/x.jpg`, and a credit with no `sourceUrl`.
  - `resolveVisual({ ...emptyManifest, clips: { a: { file: "episodes/s/clips/a.mp4", duration: 4, attribution: "NASA" } } }, "a")` deep-equals `{ kind: "clip", file: "episodes/s/clips/a.mp4", duration: 4, attribution: "NASA" }`; without `attribution` the key is absent.
- [ ] **Step 2: Run** `npm test` → fail.
- [ ] **Step 3: Implement.** `scanAssets` reads `paths(slug).credits` with `parseCredits` (missing file = no attributions) and, for each clip entry, sets `attribution` when `youtubeAttributions` has `clips/<file name>`. Map key is the credit's `file`; the manifest entry's `file` is `episodes/<slug>/clips/<name>.<ext>`, so match on the part after `episodes/<slug>/`.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, then `npm run assets -- 2026-10-20-gpu-price-surge` and `git diff --stat public/` → no `assets.json` change for an episode without YouTube credits (restore if anything else moved).
- [ ] **Step 5: Commit** `feat(youtube): carry the channel from credits to assets.json and Asset`.

### Task 3: SourceTag overlay in every footage renderer

**Files:**
- Create: `src/kit/components/SourceTag.tsx`
- Modify: `src/kit/components/Backdrop.tsx` (per-visual Sequence, after the tint layer and before `GlitchCut`; new optional props `tagInset?: number`, `tagSize?: number`)
- Modify: `src/kit/skins/frontier/Media.tsx` (`MediaStack`, same place in its Sequence)
- Modify: `src/kit/formats/MusicVideo.tsx` (`ShotLayer`, after `picture`)
- Modify only if the stills show a collision: `src/kit/scenes/SplitSegment.tsx`, `src/kit/formats/Short.tsx`, `src/kit/skins/frontier/Short.tsx` (pass `tagInset`/`tagSize`, as they already pass `noteInset`/`noteSize`)

**Interfaces:**
- Consumes: `Asset.attribution` (Task 2), `youtubeTagText` (Task 1), `useTheme()`.
- Produces: `SourceTag: React.FC<{ channel: string; inset?: number; size?: number }>`, absolutely positioned, `zIndex: 6`.

- [ ] **Step 1: Implement `SourceTag`.** Theme `fonts.mono`, `colors.dim` text on `colors.noteBg`, letterSpacing 2, default size 16, opacity ~0.85, a text-shadow for bright footage. Default corner **top-right** (the `note` tag owns bottom-right; captions and the cold-open/segment text own bottom and left). Never filtered by the theme grade (it's a sibling after the tint, not inside `VisualLayer`).
- [ ] **Step 2: Wire it** into the three renderers: render `<SourceTag channel={v.asset.attribution} … />` when `v.asset.kind === "clip" && v.asset.attribution`. MusicVideo: `s.asset`; it already puts `note` top-right, so the tag goes top-**left** there, or below the note. Pick what the stills show is clear.
- [ ] **Step 3: Build a throwaway test episode** `episodes/zz-tag-test` (`npm run new -- zz-tag-test`), with a clip hard-copied from an existing episode and a credit giving it `sourceUrl: "https://www.youtube.com/watch?v=test"` and author `"A Very Long Channel Name For Testing Overflow Handling"`. Cover a full-frame segment, a cold-open beat and a text section in `threat-brief`, then switch `theme` to `military-comparisons` (split frame + map card), `frontier` and `blackout`. Scaffold `zz-tag-test-short1` with `npm run short`, plus a music-video copy only if one is quick to make. Render stills with `npx remotion still` at frames where the clip is on screen. Save the stills to `episodes/zz-tag-test/work/` and look at each one: the tag is readable, inside the visible frame, not under the map card, note, captions or a text panel, and not cut by the 9:16 crop.
- [ ] **Step 4: Adjust** insets/sizes per layout until every still passes; record the final positions in the `SourceTag` header comment.
- [ ] **Step 5: Run** `npm run typecheck`, `npm test`, then `npm run check` on two existing episodes → unchanged results. Delete `episodes/zz-tag-test*` and `public/episodes/zz-tag-test*`, and remove their entries from the generated episode index (re-run `npm run sync`).
- [ ] **Step 6: Commit** `feat(kit): YouTube source tag over clips credited to a channel`.

### Task 4: `check` rules for YouTube credits

**Files:**
- Modify: `scripts/lib/check.ts` (new `youtubeIssues`, next to `pressIssues`; call it beside `pressIssues` in `runCheck`, ~line 348)
- Modify: `scripts/lib/checkMusicVideo.ts:78` (same call)
- Test: `scripts/lib/checkYoutube.test.ts`

**Interfaces:**
- Consumes: `isYouTubeUrl`, `youtubeAttributions` (Tasks 1–2), `loadConfig().youtube.search_youtube`.
- Produces: `youtubeIssues(entries: Credit[], assets: AssetManifest, thumbnailVisual: string | undefined, searchOn: boolean): Issue[]` (pure; the callers pass `loadConfig().youtube.search_youtube`).

- [ ] **Step 1: Write the failing tests** (one `test()` each):
  - CC BY clip credit, author "NASA", assets attribution "NASA" → `[]`.
  - `license: "CC BY-SA"` YouTube credit → one error naming the file and "CC BY or PD".
  - YouTube credit for `images/x.jpg` → error "clips/ only".
  - `author: "YouTube"` and `author: " "` → error "name the channel".
  - `license: "PD"` with no `notes` → error "basis"; with `notes: "NASA, US federal work"` → `[]`.
  - `thumbnailVisual` equal to the YouTube clip's base name → error on `thumbnail.visual`.
  - assets clip missing `attribution`, or with a different channel → error containing `npm run assets`.
  - `searchOn: false` with a valid YouTube credit → exactly one `warning`.
  - A Commons credit whose `originalUrl` is a YouTube link → `[]` (Commons route untouched).
- [ ] **Step 2: Run** `npm test` → fail.
- [ ] **Step 3: Implement** `youtubeIssues` in the style of `pressIssues` (same `err` helper, same base-name derivation for the thumbnail).
- [ ] **Step 4: Run** `npm test`, then `npm run check` on every existing episode (loop over `episodes/*/`) → error counts identical to before this task.
- [ ] **Step 5: Commit** `feat(check): YouTube clip license, channel, thumbnail and stale-tag rules`.

### Task 5: Transcript, search and range parsing (pure)

**Files:**
- Create: `scripts/lib/youtube.ts`
- Test: `scripts/lib/youtube.test.ts` (inline fixtures; no network)

**Interfaces:**
- Produces:
  - `type TranscriptLine = { start: number; text: string }`
  - `parseJson3(raw: unknown): TranscriptLine[]`: yt-dlp json3 captions (`events[].tStartMs`, `segs[].utf8`). Drops empty or newline-only events, collapses whitespace, strips `[Music]`-style cues, and removes the rolling duplicates auto captions produce (a line that repeats the tail of the previous one).
  - `formatTranscript(lines: TranscriptLine[]): string`: one paragraph per ~20 s window, each starting `[mm:ss] ` (`[h:mm:ss]` past an hour).
  - `firstWords(text: string, n: number): string`: the first `n` words with timestamps removed, plus `…` if truncated.
  - `pickCaptions(info: VideoInfo): { lang: string; kind: "manual" | "auto"; url: string } | null`: json3 track. Order: manual `en`/`en-*`, then auto `en`/`en-orig`/`en-*`. A translated auto track (`*-en` from another language) only as a last resort, marked auto.
  - `classifyLicense(info: VideoInfo): "cc-by" | "standard"`: `cc-by` only when `info.license` matches /creative commons/i.
  - `parseTimestamp(s: string): number` (`"83"`, `"83.5"`, `"1:23"`, `"1:02:03"`; throws on anything else).
  - `validateRange(from: number, to: number, duration: number): string | null` (error text, or `null`). Rules: `to > from`; `to <= duration`; `to - from <= 15`.
  - `type VideoInfo` = the yt-dlp `-J` fields used: `id, title, channel, channel_url, upload_date, duration, description, license, view_count, subtitles, automatic_captions`.
  - `type SearchHit = { id, title, channel, duration, url, uploadDate?, views? }` and `searchHits(raw: unknown): SearchHit[]` from a `--flat-playlist -J` result.

- [ ] **Step 1: Write the failing tests** with small fixtures: a json3 rolling-auto sample (e.g. events "hello world" / "hello world this is" / "this is a test") → three lines become `hello world this is a test` across ≤ 2 lines, no repeated words; `formatTranscript` produces `[00:00] …` and `[1:00:05] …`; `firstWords` on 500 words returns exactly 300 plus `…`; `pickCaptions` picks manual `en-GB` over auto `en`, auto `en-orig` when no manual, `null` when only `fr` manual and no auto; `classifyLicense` on `"Creative Commons Attribution license (reuse allowed)"` → `cc-by`, on `undefined` → `standard`; `parseTimestamp` cases above and `"1:2:3:4"` throws; `validateRange(10, 5, 100)`, `(0, 20, 100)`, `(95, 101, 100)` return errors and `(10, 18, 100)` returns `null`.
- [ ] **Step 2: Run** `npm test` → fail.
- [ ] **Step 3: Implement** `scripts/lib/youtube.ts`.
- [ ] **Step 4: Run** `npm test` → pass.
- [ ] **Step 5: Commit** `feat(youtube): transcript, caption, license and range parsing`.

### Task 6: `npm run youtube` CLI

**Files:**
- Create: `scripts/youtube.ts`
- Modify: `package.json` (`"youtube": "tsx scripts/youtube.ts"`)
- Modify: `requirements.txt` (a `# npm run youtube` block with the pinned current `yt-dlp` version, so `npm run setup:align` installs it)

**Interfaces:**
- Consumes: everything in Task 5; `venvPython`, `paths`, `parseArgs`, `requireSlug`, `fail/info/ok/warn` from `scripts/lib/util.ts`; `scanAssets` (`scripts/lib/assets.ts`); `loadConfig`.
- Produces: the three subcommands in the spec ("The command"), plus `npm run youtube -- --update` (upgrades yt-dlp in `.venv` via pip).

- [ ] **Step 1: Write the script header** in the same style as `scripts/shot.ts` (purpose, usage per subcommand, the licensing paragraph). Gate: `loadConfig().youtube.search_youtube === false` and no `--ignore-off` → `fail` with a message naming the config key.
- [ ] **Step 2: Implement a `ytdlp(args: string[]): { status: number; stdout: string; stderr: string }`** helper: `venvPython() -m yt_dlp`, always with `--js-runtimes node` (if the pinned yt-dlp has that option; confirm with `--help`), `--sleep-requests 1`, `--no-warnings`. Missing `.venv` or module → `fail("Run npm run setup:align (installs yt-dlp into .venv)")`. Detect blocks (stderr matches /confirm you.?re not a bot|HTTP Error 429/i) → `fail` with "YouTube is blocking requests from this machine; try later or `npm run youtube -- --update`", with no retry loop.
- [ ] **Step 3: `search`.** `ytsearch<limit>:<query>` with `--flat-playlist -J`. With `--cc`, use the results URL `https://www.youtube.com/results?search_query=<encoded>&sp=EgIwAQ%253D%253D`. Print a table via `searchHits` and write `raw/youtube/search-<n>.json` (next free n).
- [ ] **Step 4: `transcript`.** `-J --skip-download` → `info.json`. Then `pickCaptions`; fetch the json3 track with `fetch(url)`; save `transcript.txt` (`formatTranscript`); print the header (title, channel, upload date, duration, license as YouTube states it, caption kind and language) and `firstWords(text, --words ?? 300)`. No captions → exit 1 with "no English captions".
- [ ] **Step 5: `clip`.** Validate `<name>` like `shot.ts`, parse `--from/--to`, fetch info, `validateRange`. License gate: `cc-by` → `CC BY`/`3.0`. Otherwise require `--license PD --basis "<…>"`, else fail ("standard YouTube license: not reusable; PD only for a verified US federal channel's own footage, with --basis"). Refuse an existing clip without `--force`. Download `--download-sections "*<from-1>-<to+1>" -f "bv*[height<=1080][ext=mp4]/bv*[height<=1080]/bv*"` into `raw/youtube/<id>/`. Encode with ffmpeg to the Global Constraints spec, trimming to exactly `from`–`to`. Merge the credit into `credits.json` (replace an entry with the same `file`, keep the rest) and call `scanAssets(slug)`. Print the file and the credit.
- [ ] **Step 6: Install and verify live.** Run `npm run setup:align`. Then:
  - `npm run youtube -- <a scratch slug> search "nasa artemis" --limit 5` → a table.
  - `npm run youtube -- <slug> search "drone footage" --cc --limit 5` → only CC videos (spot-check one hit's license with `transcript`).
  - `transcript` on a NASA video → 300-word preview, `transcript.txt` with timestamps.
  - `clip` on a CC BY hit for 6 s → `clips/<name>.mp4`; `ffprobe` shows 1920×1080, 30 fps, no audio, ~6 s; the credit is present and `assets.json` has `attribution`.
  - `clip` on a standard-license video → refused.
  - `npm run check -- <slug>` → no YouTube errors.
  Use a scratch episode (`npm run new -- zz-yt-test`), and delete it afterwards.
- [ ] **Step 7: Commit** `feat(youtube): npm run youtube search, transcript and clip`.

### Task 7: Skill and producer docs

**Files:**
- Create: `.claude/skills/youtube/SKILL.md`
- Modify: `CLAUDE.md` (command list: the three `npm run youtube` lines; rule 2: one sentence on videos as sources under `use_video_as_citation`; rule 3: the YouTube clip sentence from the spec's "Doc updates")
- Modify: `.claude/skills/new-episode/SKILL.md` (step 1b point 2: research subagents may use the youtube skill when `search_youtube` is on; step 5: CC BY YouTube clips through the command)
- Modify: `.claude/skills/new-episode/asset-prompts.md` (prompt A: YouTube CC clips via `npm run youtube -- <slug> clip` only, PD federal path, never as thumbnail)
- Modify: `.claude/skills/find-media/SKILL.md`, `.claude/skills/find-media/sources.md` (YouTube row; creator's burned-in logos still rejected; Commons-mirrored YouTube videos stay Commons files)
- Modify: `.claude/skills/music-video/SKILL.md` (one line: youtube skill for explainer facts and clips; tag shows; no FILE FOOTAGE notes, as before)

- [ ] **Step 1: Write `SKILL.md`.** Frontmatter `name: youtube`, a description that triggers on "YouTube", "transcript", "video source", "find a clip on YouTube", "CC video". Body:
  - the config gate (both settings, and what each value means, verbatim from the spec's decisions);
  - the procedure (search → `transcript` 300-word preview → decide → Read `transcript.txt` → extract);
  - the six "Facts from transcripts" rules, with the `sources` entry format and the `notes.md` log format (claim | video | channel | URL | [mm:ss] | manual/auto);
  - clip rules (CC BY; PD only for a verified federal channel's own footage with `--basis`; check frames for burned-in logos/text; the tag is automatic; never the thumbnail);
  - being polite (a handful of transcripts, stop on blocks, `--update` first when extraction breaks).
  Match the length and voice of `find-media/SKILL.md`, and keep it under ~90 lines.
- [ ] **Step 2: Make the other doc edits** listed above. Keep each to the one or two sentences the spec calls for; follow the user's memory rule: no colons or abrupt fragments in narration examples.
- [ ] **Step 3: Verify** that `grep -n "youtube" CLAUDE.md .claude/skills/*/SKILL.md` shows each touch point, and that the skill's commands match `scripts/youtube.ts --help` exactly.
- [ ] **Step 4: Commit** `docs(youtube): skill, CLAUDE.md rules, producer procedure`.

### Task 8: README catch-up

**Files:**
- Modify: `README.md`

- [ ] **Step 1: List what's missing.** Run `git log --oneline 9a93a5f^..HEAD` and compare against README. The gaps known now: segment `exitAt` (slides the block off at a cue) and Shorts `exitAt` (fades the text panel); segment `side: "right"`; blackout plays footage ungraded; the captions fix (next chunk shows as soon as it starts); raw downloads in `episodes/<slug>/raw/`, working files in `episodes/<slug>/work/`. Add anything else the log shows.
- [ ] **Step 2: Add a "YouTube research and clips" subsection** under "5. Media and licenses": what it does, no key, the two config settings, the three commands, CC BY / federal PD only, the automatic channel tag, never the thumbnail. Add the commands to "## Commands", the new rules to "## What `check` catches", the `youtube:` row to "config.yaml at a glance", and the `episodes/<slug>/raw/youtube/` path to "## Layout".
- [ ] **Step 3: Work the other recent changes in** where a reader would look for them (episode.json fields in section 4, themes in "Themes and formats", folders in "Layout"), matching the README's existing voice.
- [ ] **Step 4: Commit** `docs(readme): YouTube research and recent kit changes`.
