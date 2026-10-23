# YouTube research and CC BY clips — design

Date: 2026-10-22 · Status: draft for approval (builder-checked; the user's watermark and PD answers folded in)

## Intent

Brief Kit episodes get their facts from an article, corrected by a web fact-check (new-episode step 1b), and their b-roll from public archives (find-media). A lot of useful material is only on YouTube: experts explaining a system, official channels showing a product, field footage from people who filmed it. The channel owner wants the producer to be able to:

1. **Search YouTube and read transcripts** as a research source. To keep context small, the producer first reads only the opening ~300 words of a transcript to judge relevance, and reads the full transcript only when the video looks useful, then pulls the useful facts out of it.
2. **Pull short clips** from videos whose creator permits reuse (or whose footage is public domain), with the **channel name shown on the clip as a watermark** for attribution.

No YouTube API key. Everything runs through tools that need no key.

## Goals

1. A new `youtube` skill (`.claude/skills/youtube/SKILL.md`) with the procedure: search → 300-word preview → full read → extract facts (with timestamps) → optionally clip.
2. A new command, `npm run youtube -- <slug> <search|transcript|clip> ...`, that does the network and media work so the producer never handles raw YouTube pages.
3. Two new `config.yaml` settings (defaults below), validated in `scripts/lib/config.ts`:
   - `search_youtube` (default `true`): whether the producer uses YouTube at all.
   - `use_video_as_citation` (default `true`): whether a YouTube video may be listed as a source.
4. The skill is wired into the existing procedures: new-episode step 1b (fact-check) and step 5 (assets), the find-media license gate, the asset-sourcing prompts, and the music-video skill (for explainer facts and clips).
5. `npm run check` enforces the YouTube clip rules (below), so an unlicensed clip can't reach a render.
6. The kit draws the channel watermark itself over every YouTube-sourced clip, placed to fit each layout.

## Non-goals

- A YouTube Data API integration, OAuth, or any key.
- Downloading whole videos for use, music, or audio. Clips are video only (the kit already plays every clip `muted`).
- Using the user's browser cookies or YouTube account to get past blocks. If YouTube blocks a request, the command reports it and the producer moves on.
- Batch scraping: dozens of transcripts per episode. A typical run is a handful of searches and a few transcripts.
- Comments, live streams, Shorts as sources.

## Anti-goals (failure even if it works)

- **A clip from a video that isn't CC BY or public domain.** Standard-license videos are never clipped, whatever the description says ("free to use" is not a license), unless the footage is a US federal work (below). Fair use is not relied on.
- **A CC BY clip the uploader didn't own.** YouTube's CC BY flag is uploader-asserted. A re-upload of TV news, a film, a game trailer or another channel's footage marked CC BY is rejected, the same "the landing page decides, PD needs a basis you can name" rule find-media applies to Internet Archive.
- **A misheard number in the script.** Auto-generated captions garble names and figures ("fifteen" / "fifty"). A figure taken from auto captions doesn't go into a script on that alone (see "Facts from transcripts").
- **YouTube becoming a back door around rule 2.** Anything new a video adds goes through the same path as fact-check findings: logged in `notes.md`, shown to the user, and only then scripted.
- **The watermark missing or illegible in the final video**, cropped away, or hidden under a map card or text panel.

## Decisions made with the user

- **No API.** Keyless tools only.
- **300-word preview first**, full transcript only if the preview looks applicable.
- **`search_youtube: true`** by default.
- **`use_video_as_citation: true`** by default. Meaning (confirmed by the user):
  - `true`: a YouTube video can be a source like any article. It's listed in `episode.json` `sources` (so it appears on the sources card and in the description).
  - `false`: YouTube is **leads only**. A fact found in a video is used only when a non-YouTube source confirms it, and that source is what gets cited. The video never appears in `sources`; it's logged in `notes.md` as a lead.
- **Clips: CC BY, or PD with a nameable basis.** YouTube's "Creative Commons Attribution" setting is the only creator permission that counts; no written-permission path. The one other route: a **verified US federal agency channel** (NASA, DoD and the services, U.S. Mint, NOAA, USGS...) whose upload is the agency's own footage is `PD` (federal work), even though YouTube shows the standard license. That's the same basis find-media accepts for DVIDS. A federal upload that notes contractor, news-agency, "courtesy of" or other third-party material is rejected.
- **Watermark: drawn by the kit, not burned in.** The user chose a kit overlay over burning the tag into the file. The render draws `VIDEO · <Channel> / YouTube` over any clip whose credit comes from YouTube, positioned per layout, so it is never cropped (Shorts' 9:16 crop), shrunk (the split layouts' 1040×585 frame) or hidden (the split layout's map card, the `note` tag). The clip file itself carries no tag.
- **Credits:** each clip also gets a normal `credits.json` entry (CC BY, channel as author, the watch URL as source), so it is on the credits roll and in `DESCRIPTION.md` like any other file.
- **Citation setting doesn't affect clips.** `use_video_as_citation` is about facts; whether a clip can be used depends only on its license.

## Config

New top-level section in `config.yaml`, commented in the file's existing style (*my call: a `youtube:` section rather than two loose top-level keys, matching how every other setting is grouped*):

```yaml
youtube:
  # YouTube as a research source and, for Creative Commons videos, a clip source (the youtube skill;
  # npm run youtube). No API key: search, transcripts and clips go through yt-dlp.
  #   search_youtube true:  the producer searches YouTube during the fact-check and asset steps, previews each
  #                         transcript's first ~300 words, and reads the full transcript of the useful ones.
  #   search_youtube false: no YouTube (no search, transcripts or clips) unless you ask for it.
  search_youtube: true
  #   use_video_as_citation true:  a video can be a cited source (listed in sources, on the sources card).
  #   use_video_as_citation false: videos are leads only; a fact from one is used only when a non-YouTube source
  #                                confirms it, and that source is cited instead.
  use_video_as_citation: true
```

`search_youtube: false` turns the whole feature off, clips included (*my call*). The command refuses with a message (overridable with `--ignore-off`, as `npm run voice` does) so a run is never accidental.

## The command: `npm run youtube`

One script, `scripts/youtube.ts`, three subcommands. All files go under the episode (CLAUDE.md "Where things are"): raw material in `episodes/<slug>/raw/youtube/<videoId>/`, finished clips in `public/episodes/<slug>/clips/`.

### `search`

`npm run youtube -- <slug> search "<query>" [--limit 10] [--cc]`

- Prints a compact table per result: video id, title, channel, upload date, duration, view count, URL, and whether captions exist (manual / auto / none) where cheaply available.
- `--cc` restricts to Creative Commons videos (YouTube's own CC search filter), for clip hunting.
- Writes the results to `episodes/<slug>/raw/youtube/search-<n>.json` for later reference.

### `transcript`

`npm run youtube -- <slug> transcript <id|url> [--words 300]`

- Downloads the video's metadata and captions (no video), preferring manual captions over auto-generated, English first.
- Saves to `episodes/<slug>/raw/youtube/<videoId>/`: `info.json` (title, channel, channel URL, upload date, duration, description, **license as YouTube states it**), and `transcript.txt`: the full transcript as plain text with a `[mm:ss]` timestamp at the start of each line or paragraph, de-duplicated (auto captions repeat rolling lines) and with caption markup stripped.
- Prints a header (title, channel, date, license, caption kind: manual or auto) and **only the first N words** (default 300). The producer reads `transcript.txt` with the Read tool when the preview passes; the command never dumps the full transcript into the conversation.
- No captions: says so and exits non-zero. (*Builder's option*: a fallback that pulls the audio and transcribes it with the kit's existing local Whisper. Not required for v1.)

### `clip`

`npm run youtube -- <slug> clip <id|url> <name> --from <t> --to <t> [--force]`

1. **License gate first**, before downloading video: reads the video's license from YouTube. Anything but Creative Commons Attribution fails with a clear message.
2. Downloads only the needed section where possible (plus a small margin), into `episodes/<slug>/raw/youtube/<videoId>/`.
3. Encodes to the kit's standard clip spec (the one in `.claude/skills/new-episode/asset-prompts.md`: 1920×1080 cover-crop, 30 fps, libx264 yuv420p crf 23, `-an`, `+faststart`), to `public/episodes/<slug>/clips/<name>.mp4`. No tag in the file; the kit draws it.
4. Merges a credit into `public/episodes/<slug>/credits.json` (never overwrites other entries):
   `{ "file": "clips/<name>.mp4", "title": "<video title>", "author": "<channel name>", "license": "CC BY", "licenseVersion": "3.0", "sourceUrl": "https://www.youtube.com/watch?v=<id>", "notes": "YouTube <from>–<to>; trimmed and scaled; channel watermark shown in the video" }`
   (YouTube's CC option is CC BY 3.0 Unported; the builder confirms that against what yt-dlp reports.)
5. Refreshes `assets.json` the way `npm run shot` does.

**PD path:** when the license isn't CC BY, the command fails unless it gets `--license PD --basis "<e.g. NASA, US federal work>"`. The skill says when that's allowed: a verified federal channel and the agency's own footage. The credit is then `"license": "PD"`, `"author": "<channel>"`, with the basis in `notes`.

Timestamps for `--from/--to` come from `transcript.txt`, so the producer can find the moment by what's said and then check frames, as the asset prompts already require (extract a few frames, look at them, reject burned-in text, logos and third-party watermarks).

### Watermark (kit overlay)

- **Trigger:** any visual whose file has a credit with a `youtube.com` / `youtu.be` `sourceUrl`. Episode credits already reach the render (`scripts/sync.ts` → `src/kit/context.tsx`). No `episode.json` field is needed, so the producer can't forget it (*my call: derived from the credit, not a per-visual flag*).
- **Text:** `VIDEO · <Channel> / YouTube`, from the credit's `author` (*my wording guess; very long channel names may be shortened with an ellipsis*).
- **Look:** small, semi-transparent, readable over bright and dark footage, in the kit's fonts. It sits **above** the theme's grade and tint, so it stays legible on the darkest theme.
- **Placement, per layout:** inside the visible media frame and clear of the kit's own overlays: the `note` tag (bottom-right in `Backdrop.tsx`), captions, headline panels, stat blocks, the split layout's map card. It applies everywhere footage plays: full-frame backdrops, split frames, Shorts, the frontier skin's media and music videos. The builder verifies each layout with stills, not by assumption.
- **Thumbnails:** a YouTube clip is never the thumbnail (*my call, matching the press-image rule*), and `check` errors on it.

## Facts from transcripts

The skill's rules for using what a video says:

1. **Judge the channel like any source** (step 1b already rates the article's sources): official channels (a ministry, a manufacturer, a space agency), established news organizations, and named experts with a record count. Anonymous compilation channels, AI-voiced explainer channels and reaction channels are leads at most, whatever the setting.
2. **Log every fact** taken from a video in `notes.md` under the fact-check heading: the claim, the video title, channel, URL and timestamp (`[mm:ss]`), and whether the captions were manual or auto.
3. **Auto-caption figures need a second check.** A number, name or date from auto-generated captions is confirmed either by another source or by the video itself (on-screen text, the description, manual captions) before it's scripted (*my call*).
4. **With `use_video_as_citation: true`**, a video the script relies on goes in `episode.json` `sources` as `{ "title": "<video title> · <channel> (YouTube)", "url": "<watch URL with &t= if one moment>" }`.
5. **With `use_video_as_citation: false`**, only the confirming non-YouTube source goes in `sources`. A fact that only a video supports is cut.
6. New context a video adds beyond the article goes to the user for approval with the fact-check table (CLAUDE.md rule 2), same as any other addition.

## `check` enforcement

In `scripts/lib/check.ts`, alongside the existing PRESS / AI-GENERATED rules:

- A credit whose `sourceUrl` is on `youtube.com` or `youtu.be` must have license `CC BY` or `PD` and a file under `clips/`: no images, music or sfx from YouTube (*my call: stills from a video aren't needed now; the builder may allow `images/` frame grabs if trivial*).
- Such a credit must name the channel as `author` (non-empty, not "YouTube"). A `PD` one must state its basis in `notes`.
- A YouTube clip can't be the thumbnail visual.
- `search_youtube: false` plus a YouTube credit: warning, not error (the user may have asked for that one clip).

Because the kit draws the watermark from the credit, these rules are what guarantee it: every YouTube clip has a credit naming the channel, so the render shows the tag.

**YouTube footage that arrived another way** (*my call*): a YouTube video that Wikimedia Commons mirrored and license-reviewed is a Commons file. It's credited to Commons as today, with no YouTube rule and no tag. Existing episodes already use such clips and keep passing. The docs say this explicitly: the command and the tag are for clips pulled from YouTube directly.

## Doc updates

- `CLAUDE.md`: the new command in the command list; rule 2 mentions videos as fact-check sources under the citation setting; rule 3 adds "YouTube clips: CC BY, or PD from a verified federal channel, only through `npm run youtube clip`; the kit shows the channel watermark; never the thumbnail". The kit change itself is kit work, not episode work, so hard rule 1 doesn't apply to building it.
- `.claude/skills/new-episode/SKILL.md`: step 1b (research subagents may use the youtube skill when `search_youtube` is on, with the citation rule), step 5 (CC BY YouTube clips as a source).
- `.claude/skills/new-episode/asset-prompts.md`: YouTube CC clips as an option, through the command only.
- `.claude/skills/find-media/SKILL.md` and `sources.md`: YouTube as a source through the command. A creator's own burned-in logo or watermark is still rejected unless it can be cropped, as for any footage. Commons-mirrored YouTube videos stay ordinary Commons files.
- `.claude/skills/music-video/SKILL.md`: one line pointing to the youtube skill for explainer facts and clips (watermark applies; no FILE FOOTAGE notes there, as before).
- `README.md`: a short section. `config.yaml`: the new section.

## Tooling and setup

- **yt-dlp**, installed into the kit's existing `.venv` (it's a pip package), called from `scripts/youtube.ts`. It does search (`ytsearchN:`, or a results URL with YouTube's CC filter), metadata including license, captions, and section downloads. ffmpeg is already on the machine (`C:\ffmpeg\bin`).
- yt-dlp now needs a JavaScript runtime for full YouTube support; Node is present and yt-dlp can be pointed at it. The builder confirms what the current yt-dlp version needs.
- A setup step following the existing pattern (`npm run setup:youtube`, or folded into an existing setup script; builder's call) that installs or updates yt-dlp. YouTube changes often, so the skill tells the producer to update yt-dlp first when extraction fails.
- **Being polite to YouTube:** sleep between requests, stop after a couple of consecutive blocks ("Sign in to confirm you're not a bot", HTTP 429), and report instead of retrying in a loop.

## Left to the builder

- Exact output formats of the search table and transcript header.
- Caption parsing and de-duplication details (json3 vs vtt).
- Whether search reports caption availability (only if cheap).
- The Whisper fallback for videos with no captions (optional).
- Tests: follow the existing `*.test.ts` pattern for the pure parts (transcript cleanup, license detection, check rules, the "is this a YouTube credit" helper).
- After the build, the README also gets a catch-up on other recent changes that it doesn't describe yet (the user asked for that alongside this).
