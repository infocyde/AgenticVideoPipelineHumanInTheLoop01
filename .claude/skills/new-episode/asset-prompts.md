# Asset-sourcing subagent prompts

Fill in the `<…>` parts and send each prompt to its own subagent. Paths are relative to the kit root. Raw downloads go in `episodes/<slug>/raw/` and working files (contact sheets, test frames) in `episodes/<slug>/work/`, never in a temp or scratchpad folder, so they stay with the episode.

These prompts sourced all 15 shots for the first episode in about 50 minutes and 100 tool calls. That agent correctly rejected clips with burned-in "UNCLASSIFIED" text, an unclear "Courtesy of Natochannel" credit and a TV logo. It cropped a photographer's signature off a CC BY-SA image, and it flagged its substitutions: a Tomahawk launch standing in for a North Korean missile, and a 2022 Lviv fuel-depot fire standing in for Baltic sabotage. Those flags became `note` tags.

---

## A. Clips and images

> You are sourcing b-roll VIDEO clips (and a few backup images) for a ~<duration> YouTube video: <one-line description of the episode, e.g. "a weekly top-10 geopolitics countdown, dark red news-briefing look">. The clips will be shown darkened, tinted, with heavy text overlays, 3–8 seconds each.
>
> LICENSING IS STRICT: only public domain (incl. US federal government works: US Navy, DoD/DVIDS, NASA, NOAA, USGS), CC0, or CC BY / CC BY-SA. No NC, no ND, no "editorial only", no unknown license. Record attribution for every file.
> PRESS-IMAGE OPT-IN (only if config.yaml has licensing.press_images: true; the main session tells you): for a product the segment discusses, when no PD/CC media of it exists, an official image or b-roll clip from the manufacturer's own newsroom or press kit is allowed. Record it as license "PRESS", author = the company, sourceUrl = the press page, originalUrl = the file. Never retailer listing photos, photographers' or outlets' photos, or embargoed / "do not use" material.
> STOCK SITES (music videos only, and only if config.yaml has licensing.stock_media: music-video; the main session tells you): search Pixabay, Pexels and Coverr FIRST, only with `npm run stock -- <slug> search|get|import` and the rules in `.claude/skills/stock-media/SKILL.md`. It writes the STOCK credit itself; never hand-download from these sites or credit them as CC/PD. List Coverr (and Pexels, while it has no API key) page URLs for the user to download in their browser instead of scripting the sites.
>
> Read `.claude/skills/find-media/SKILL.md` (license gate, workflow, which source fits which shot) and `.claude/skills/find-media/sources.md` (every source's tested endpoints, license fields and gotchas) before you search.
>
> Sources: Wikimedia Commons, Openverse, NASA, Internet Archive (e.g. Universal Newsreels), Library of Congress, plus DVIDS, Smithsonian, Europeana, Flickr and the National Archives when their keys are set (or through their keyless fallbacks in sources.md). The three you'll use most (no API key needed): Wikimedia Commons API (`https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=<terms> filetype:video&format=json`, then `prop=imageinfo&iiprop=url|extmetadata|size|mime` for URL, LicenseShortName and Artist; send a descriptive User-Agent with no personal email); Openverse images API (`https://api.openverse.org/v1/images/?q=<terms>&license=cc0,by,by-sa,pdm`) for stills; NASA image & video library API (`https://images-api.nasa.gov/search?q=<terms>&media_type=video`, public domain). Skip Pexels/Pixabay (they need keys).
>
> YOUTUBE (only if the main session says config.yaml has youtube.search_youtube: true): read `.claude/skills/youtube/SKILL.md`. A Creative Commons (CC BY) YouTube video, or a verified US federal agency channel's own footage (PD, with `--basis`), may supply a clip, but only through `npm run youtube -- <slug> clip <id|url> <name> --from <t> --to <t>` (at most 15 s; it checks the license, credits the clip and refreshes assets). Never download from YouTube any other way, never use one as the thumbnail, and reject clips with the creator's burned-in logo or text. The kit draws the channel tag itself.
>
> Needed shots (one clip each, filename in brackets; ★ = priority; if no video exists, fetch a strong still as `images/<name>.jpg` instead):
> <one line per visual in episode.json, e.g.
> ★ [gulf_navy] warship underway at sea, dramatic
> ★ [drone] military drone in flight
> [sheep] flock of sheep grazing (generic farm stand-in is fine)>
>
> Processing: download raw files into `episodes/<slug>/raw/<name>/`, one new folder per shot (never run downloaded files). Put contact sheets and check frames in `episodes/<slug>/work/sheets/`. Pick the most dynamic ~8s segment, skipping intros, titles and black frames. Extract frames with `ffmpeg -ss T -frames:v 1` and LOOK at them to confirm the content and that there is no burned-in text, logos or watermarks. Output `public/episodes/<slug>/clips/<name>.mp4`: libx264, yuv420p, crf 23, `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080`, 30fps, `-an`, ≤8s, `-movflags +faststart`. Images: `public/episodes/<slug>/images/<name>.jpg`, ≤1920px wide, JPEG quality 85. Verify each output with ffprobe and one viewed frame.
>
> Write `public/episodes/<slug>/credits.json` (a JSON array; merge with existing entries, don't overwrite them). One entry per file, in exactly this shape:
> `{ "file": "clips/<name>.mp4", "title": "<source file title>", "author": "<creator as credited>", "license": "PD" | "CC0" | "CC BY" | "CC BY-SA", "licenseVersion": "4.0" (omit for PD/CC0), "sourceUrl": "<Commons/landing page>", "originalUrl": "<direct media URL>", "notes": "<segment used, what it shows, any crop>" }`
> US federal works are `"PD"`. Don't use any other license spelling.
>
> Report a table (file, what it shows, duration, source resolution, license) plus anything missing or substituted, e.g. footage of a different event, place or year. Aim for ~<N> good assets; don't sink time into any single one.

---

## B. Sound effects and music bed (only when the library lacks something)

> Read `.claude/skills/find-media/SKILL.md` and `.claude/skills/find-media/sources.md` first: they cover the license gate and the other audio sources (Freesound with `FREESOUND_API_KEY`, ccMixter and Internet Archive netlabels for music beds).
>
> Source sound effects from the Openverse audio API (`https://api.openverse.org/v1/audio/?q=<terms>`; anonymous is fine but space out requests). Use `license=cc0,by,pdm` (ONLY CC0, PDM or CC BY), and `category=music` for the bed only. For sfx, leave `category` off: Freesound items have no category, so `category=sound_effect` drops them all. Use `length=shortest` (under 30 s); `short` means 30 s–2 min. Each result has `url`, `license`, `license_version`, `creator`, `title`, `foreign_landing_url`, `duration`.
>
> Save as `public/library/sfx/<name>.mp3` (or `public/library/music/<name>.mp3` for a bed), 44.1kHz stereo 192k, leading silence removed (`silenceremove=start_periods=1:start_threshold=-50dB`; use a lower threshold for slow risers), trimmed to the max length with a short fade-out, `loudnorm=I=-16:TP=-1.5:LRA=11` (bed: two-pass linear to I=-20, full length, ideally longer than the video). Needed: <e.g. whoosh ≤1.5s, impact ≤3s, riser 2–5s, glitch ≤1.5s, tick ≤0.5s, typing 2–4s, alarm ≤2s, bed ≥ video length; dark, tense, no vocals>. Verify each with ffprobe and `volumedetect` (mean > -45dB). Skip anything with speech.
>
> Add one entry per file to `public/library/credits.json` (merge, don't overwrite), with `file` relative to `public/library/` (e.g. `"sfx/impact.mp3"`), in this shape: `{ "file", "title", "author", "license": "PD" | "CC0" | "CC BY", "licenseVersion"?, "sourceUrl", "originalUrl"?, "notes"? }`. Openverse `cc0` → `"CC0"`, `by` → `"CC BY"` with `licenseVersion`, `pdm` → `"PD"`. Report a table.

Library sounds the presets use: `alarm glitch impact riser tick typing whoosh whoosh2` (sfx), `bed` (music). To change a sound for one episode only, put the file in `public/episodes/<slug>/sfx/` (or `music/`) and credit it in that episode's `credits.json`.
