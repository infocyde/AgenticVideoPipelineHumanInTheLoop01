---
name: stock-media
description: Source shots for a Brief Kit MUSIC VIDEO from free stock sites (Pixabay by API, Pexels and Coverr by API or the user's browser downloads) with npm run stock, credited STOCK. Use at the music-video sourcing step, before archive footage and AI stills, when config.yaml has licensing.stock_media music-video, or when the user asks for Pixabay, Pexels or Coverr footage. Never for news episodes or Shorts.
---

# Stock media (music videos only)

Pixabay, Pexels and Coverr publish clips under their own free licenses, not Creative Commons. CLAUDE.md rule 3 allows them only in **music videos** and only when `config.yaml` has `licensing.stock_media: music-video`. `npm run stock` refuses any other episode, and `check` errors on a `STOCK` credit in a news episode, a Short, the shared library or the thumbnail.

## When

- **Music videos.** Search these sites **first** for each shot in the approved plan (music-video skill, section 4). Then use archive and PD footage (find-media), then explainers, and AI stills (generate-image) last. Historical subjects ("Jekyll Island", "1913") still come from the archives. Stock is for the generic and the atmospheric: storms, crowds, cities at night, money, machines, nature, abstract motion.
- **News episodes:** never, while the setting is `music-video`.

## Sites

| Site | How | License (read 2026-10-23) | Notes |
|---|---|---|---|
| Pixabay | API: `PIXABAY_API_KEY` in `.env` (free; log in at pixabay.com/api/docs) | Pixabay Content License: commercial use, no attribution required | 100 requests a minute. AI uploads must be labelled on the site, but the API has no AI field, so `npm run stock` flags AI tags. Open the page before you use a clip. Images come at 1280 px unless the account has full API access. |
| Pexels | API: `PEXELS_API_KEY`. New keys were paused on 2026-10-23, so otherwise `import` the user's browser download | Pexels License: commercial use, no attribution required | Its terms ban AI uploads, but it doesn't guarantee every upload is human-made. Bots and scrapers are banned, so never script the website. |
| Coverr | `import` only (its API is paid for production use and gives no author) | Coverr License: commercial use including monetized YouTube, no attribution required | It mixes filmed and AI clips and labels the AI ones on the page: pass `--ai` for those. Its terms ban scrapers. |

**Excluded:**
- **Vecteezy:** its free license requires attribution, caps the production budget at $1,000 and mixes in editorial-only items.
- **Imagine.Art:** community clips have no clear commercial grant.
- **Any other "free stock" site** until it's been checked and added here.

## Commands

```
npm run stock -- <slug> search "<query>" [--site pixabay|pexels] [--type video|image] [--limit 12]
npm run stock -- <slug> get <site>:<id> <name> [--type image] [--from <s>] [--to <s>] [--ai] [--force]
npm run stock -- <slug> import <file> <name> --site pexels|coverr|pixabay --page <url> --author "<name>" [--author-url <url>] [--id <id>] [--title "…"] [--from <s> --to <s>] [--ai]
```

- **`search`** prints each hit as `<site>:<id>` with its duration, size, author, page URL and an `AI?` flag. The results are saved to `episodes/<slug>/raw/stock/search-<n>.json`; the API asks that results be cached for no more than 24 hours.
- **`get`** downloads one hit into `raw/stock/<site>-<id>/` (the original plus `record.json`). It cuts `--from`..`--to`, by default the first 8 s and at most 15 s, to `clips/<name>.mp4` (1920×1080, 30 fps, no audio), or saves `images/<name>.jpg`. It writes the `STOCK` credit and refreshes `assets.json`.
- **`import`** does the same for a file the user downloaded in their browser. Pass the clip's own page on that site, and the uploader as the page names them.

## Procedure

1. For each shot in the approved plan, `search` two or three phrasings: the literal subject, a mood, a texture.
2. Pick candidates. Open the page with WebFetch (one page per chosen clip, never a crawl):
   - Confirm the license is the site's standard one.
   - Confirm it isn't marked AI. A clip that is marked AI can still be used: pass `--ai`, and the shot then needs `"note": "AI-GENERATED FOOTAGE"`.
   - Confirm there's no editorial, premium or "do not use" marker.
3. `get` it with an in-point that fits the beat (shots are 3–4 s). LOOK at frames of the output: reject watermarks, burned-in text, visible logos or brands, and recognisable people placed so the lyric would cast them in a bad light. Every site forbids that use.
4. **Coverr, or Pexels without a key:** give the user the page URLs and ask them to download the files. Then `import` each one. Never automate those websites.
5. Log each stock shot in `notes.md`: the site, id, page, why it was chosen, and AI yes/no.

## Rules

- **Credits are written for you:** `license: "STOCK"` plus a `stock` record (site, id, license, licenseUrl, ai, checked). Don't write them by hand, and don't relabel a stock file as CC or PD. The credits roll shows "<uploader> · <site> License".
- **Never the thumbnail, never `public/library/`.** `check` enforces both.
- **Content ID:** a contributor can register a clip with YouTube Content ID even though the license allows use, so a claim is possible. That's a claim, not a strike. Keep `raw/stock/<site>-<id>/` (the record and the original file) as proof, and tell the user which shots are stock so they can dispute a claim in YouTube Studio.
- **AI clips:** any clip the site or its tags mark as AI needs the on-screen note, and the user should tick YouTube's "altered or synthetic content" box if it looks realistic.
- **No fake records.** As with all music-video footage, never arrange stock to look like a real record of a specific event.
