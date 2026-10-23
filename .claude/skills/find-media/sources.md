# Media sources: endpoints, license fields, gotchas

Every keyless endpoint below was live-tested on 2026-10-18 with military queries ("laser weapon", "drone", "bomber", "fighter jet"), and the field names shown appeared in the responses. Keyed endpoints are marked; the ones not live-tested were only checked to respond with an auth error, and their parameters come from the official docs.

Common to all:

```bash
UA="BriefKit/1.0 (media sourcing)"          # descriptive, no personal email
curl -sS --retry 3 --retry-all-errors --retry-delay 3 -A "$UA" "<url>" -o out.json
```

There's no `jq` on this machine. Parse with `python -I -X utf8 -c "..."` (`-I` ignores `PYTHONIOENCODING`, so `-X utf8` is what prevents cp1252 crashes on Windows). Use relative paths, since Windows Python can't open `/c/...` paths. URL-encode queries (`%20`, or `curl -G --data-urlencode`).

---

## 1. Wikimedia Commons (keyless) — video, stills, some audio

Best general source: lots of US military, DVIDS, NARA, NOAA and USGS uploads, plus CC BY / BY-SA work.

**Search plus metadata in one call** (generator):

```text
https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2
  &generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=<terms> filetype:video
  &prop=imageinfo&iiprop=url|extmetadata|size|mime|mediatype&iiurlwidth=1920
  &iiextmetadatafilter=LicenseShortName|License|LicenseUrl|Artist|Credit|UsageTerms|Restrictions|ImageDescription|Copyrighted
```

- Search keywords: `filetype:video`, `filetype:bitmap` (photos), `filetype:audio`. Narrow the source with `insource:dvidshub.net`, `insource:archives.gov`, `insource:noaa.gov` or `insource:usgs.gov`, and the license with `hastemplate:PD-USGov` (includes all PD-USGov-Military-* sub-templates) or `hastemplate:PD-USGov-Military-Navy`. All of these were tested and work.
- Plain search only (titles): `action=query&list=search&srnamespace=6&srsearch=<terms>`.
- Response: `query.pages[].imageinfo[0]` has `url` (original), `thumburl` (1920 px rendition when `iiurlwidth=1920`), `descriptionurl` (the landing page, used as `sourceUrl`), `width`, `height`, `duration` (seconds, for video), `mime`, and `extmetadata.{LicenseShortName, License, LicenseUrl, Artist, Credit, Restrictions}.value`.
- Mapping: `License` = `pd` → `PD`, `cc0` → `CC0`, `cc-by-3.0` → `CC BY` 3.0, `cc-by-sa-4.0` → `CC BY-SA` 4.0. Anything else (`gfdl`, `attribution`, `copyrighted free use`, `cc-by-nc…`) is a reject, unless the page also offers an allowed license (dual-licensed). `Artist` is HTML: strip the tags.
- Gotchas: `url` and `thumburl` end in `?utm_source=…`, which you must strip before recording `originalUrl`. Video originals are WebM/Ogg; ffmpeg reads both. `Restrictions` can hold `insignia`, `trademarked` or `personality`; that's not a copyright reject, but note it. A `PD-USGov` tag can be wrong (one test hit was a TV documentary), so check that `Artist`/`Credit` really names a federal body. A DVIDS-sourced file has the DVIDS ID in its title, e.g. `(952994)`.

## 2. Openverse (keyless) — images and audio aggregator

Indexes Flickr, Commons, Europeana, Smithsonian, NASA, Freesound, Jamendo and more. Anonymous: `page_size` ≤ 20, at most 240 results (`result_count` caps at 240), throttled, so space your requests.

```text
https://api.openverse.org/v1/images/?q=<terms>&license=cc0,by,by-sa,pdm&page_size=20
    [&source=wikimedia,nasa,smithsonian_air_and_space_museum] [&excluded_source=rawpixel,stocksnap,spacex,nappy,justtakeitfree,wordpress]
    [&size=large] [&aspect_ratio=wide]
https://api.openverse.org/v1/audio/?q=<terms>&license=cc0,by,pdm&length=shortest&page_size=20   # sfx
https://api.openverse.org/v1/audio/?q=<terms>&license=cc0,by&category=music&page_size=20          # music
```

- Result fields: `title`, `creator`, `license` (`cc0`/`by`/`by-sa`/`pdm`), `license_version`, `url` (direct file), `foreign_landing_url` (used as `sourceUrl`), `source`, `provider`, `width`/`height` (images), `duration` (audio, **milliseconds**), `category`.
- Mapping: `cc0` → `CC0`, `pdm` → `PD`, `by` → `CC BY` + `license_version`, `by-sa` → `CC BY-SA` + `license_version`.
- `length` values: `shortest` (< 30 s), `short` (30 s–2 min), `medium`, `long`.
- **Gotchas:** `category=sound_effect` returns 0 Freesound hits (Freesound items have `category: null`). Leave `category` off for sfx and use `length=shortest`. The license is a cached copy, so confirm it on `foreign_landing_url`; Freesound pages show e.g. "Attribution 4.0" with a `creativecommons.org/licenses/by/4.0/` link. Exclude stock re-hosts (rawpixel, stocksnap and the like) and SpaceX, whose license changed. Freesound previews (`cdn.freesound.org/previews/…-hq.mp3`) download without a key. Jamendo `url`s (`prod-1.storage.jamendo.com/?trackid=…&format=mp32`) download MP3s, but those tracks risk Content ID claims (see SKILL.md).
- `GET https://api.openverse.org/v1/audio/stats/` (and `/images/stats/`) lists the source names you can use with `source=`.

## 3. NASA Image and Video Library (keyless) — space, aerospace, NACA-era aircraft

```text
https://images-api.nasa.gov/search?q=<terms>&media_type=video&page_size=20      # or media_type=image / audio
https://images-api.nasa.gov/asset/<nasa_id>          # list of all renditions
https://images-assets.nasa.gov/video/<nasa_id>/metadata.json     # (image/<nasa_id>/... for stills)
```

- Search: `collection.items[].data[0]` has `nasa_id`, `title`, `description`, `center`, `photographer`, `secondary_creator`, `date_created`, `keywords`, `location`. `collection.metadata.total_hits`; paging via `collection.links[rel=next]`.
- Asset: `collection.items[].href` ends in `~orig.mp4`, `~large.mp4`, `~medium.mp4`, `~small.mp4`… (videos) or `~orig.jpg`, `~large.jpg`, `~medium.jpg` (stills). The hrefs are `http://`; switch them to `https://`, which works.
- metadata.json (EXIF/XMP): `XMP:Credit`, `XMP:Creator`, `XMP:Rights` ("For copyright and restrictions, refer to http://www.nasa.gov/multimedia/guidelines/index.html"), `XMP:UsageTerms`, `Composite:ImageSize`, `QuickTime:Duration`.
- License: NASA-produced media is `PD`; use `author` = `"NASA/<photographer>"`. **Reject** items credited to third parties (ESA, JAXA, SpaceX, Boeing, Roscosmos, Getty, AP, a university) unless that party's own license qualifies. Don't use the NASA logo to imply endorsement, and avoid shots where the logo dominates the frame.

## 4. Internet Archive (keyless) — newsreels, historic film, DoD mirrors, netlabel music

```text
https://archive.org/advancedsearch.php?q=<lucene query>&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=creator&fl[]=year&rows=50&output=json
https://archive.org/metadata/<identifier>
https://archive.org/download/<identifier>/<file name>          # 302 → mirror; use curl -L
```

- Useful queries: `bomber AND collection:universal_newsreels`, `<terms> AND mediatype:movies AND licenseurl:*publicdomain*`, `<terms> AND mediatype:audio AND licenseurl:"http://creativecommons.org/licenses/by/3.0/"`, and `licenseurl:*creativecommons*`, filtering client-side to `/by/`, `/by-sa/`, `/zero/` and `/publicdomain/` (this also returns NC/ND, so filter).
- Search: `response.numFound`, `response.docs[]` with the requested `fl[]` fields. Metadata: `metadata.{title, creator, date, licenseurl, rights, description, collection, publisher}` and `files[]` with `name`, `format` (`MPEG4`, `h.264`, `MPEG2`, `512Kb MPEG4`…), `width`, `height`, `length`, `source` (`original`/`derivative`). Prefer the `original` file.
- `licenseurl` is **set by the uploader**. Test hits included a Kojak TV rip marked CC BY 4.0 and Nintendo Power covers marked with the PD Mark. Accept only when the underlying work's status is independently clear: `universal_newsreels` (Universal Newsreel, released to the public domain, `publisher: Universal Studios`; silent or "missing soundtrack" is common, and we strip audio anyway); `DOD_<hash>` items mirroring DVIDS (US military, PD; credit the branch from the description); pre-1931 films; and netlabel releases where the label states the CC license. Check `rights`: Prelinger items sometimes say "Copyright … Rights Reserved". Never record the `uploader` field; it's an email address.
- Gotchas: archive.org returns 502 "kinda busy" and `[BACKEND_ERROR]` often, so use `--retry 3 --retry-all-errors`. Complex wildcard ORs such as `licenseurl:(*a* OR *b*)` with slashes triggered backend errors; use one wildcard or exact quoted URLs. Old newsreel resolution is 640×480, so it needs the `increase,crop` scale and looks soft.

## 5. Library of Congress (keyless) — historic photos and some film

```text
https://www.loc.gov/photos/?q=<terms>&fo=json&c=25&at=results,pagination      # also /pictures/, /film-and-videos/, /audio/
https://www.loc.gov/item/<id>/?fo=json
```

- Use `curl --compressed`; without it, responses were truncated ("end of response with … bytes missing").
- Search results (`results[]`: `id`, `title`, `date`, `image_url[]`, `online_format`) **don't include rights**. Fetch the item: `item.rights_advisory`, `item.rights_information`, `item.rights`, `item.created_published`, `item.contributor_names`, `item.notes`. Files are in `resources[0].files[][]` (`mimetype`, `width`, `url`); the largest JPEG is usually `…v.jpg` (1024 px) and the master is `…u.tif` (convert with ffmpeg).
- "No known restrictions on publication" is **not** PD on its own. Accept as `PD` only with a basis: a US government creator in `contributor_names` or `notes` (e.g. "U.S. Air Service, Photographic Section, American E.F."), or publication before 1931 (`created_published`). Record the basis in `notes`. Reject an item with an empty `rights_advisory` and a company creator (test hit: a 1932 Glenn L. Martin Co. photo).
- `sourceUrl` = `https://www.loc.gov/item/<id>/`.

## 6. US National Archives catalog (KEY REQUIRED) — NARA_API_KEY

- `GET https://catalog.archives.gov/api/v2/records/search?q=<terms>&availableOnline=true&typeOfMaterials=Moving%20Images` with header `x-api-key: $NARA_API_KEY`. Swagger: `https://catalog.archives.gov/api/v2/api-docs`. Key: email `Catalog_API@nara.gov` (see https://www.archives.gov/research/catalog/help/api). v1 was retired in 2023.
- **Not live-tested.** Without a key, every API path (including `/proxy/…`) returns the catalog web app's HTML (HTTP 200 `text/html`), not JSON or a 401.
- Keyless fallback (tested): Commons `<terms> insource:archives.gov filetype:video` (hits: Liberators over Ploiești, Tirpitz, Ju 87) and Internet Archive `universal_newsreels`. Federal records are PD, but NARA also holds donated copyrighted material, so check the record's "Use Restrictions".

## 7. DVIDS (KEY for API) — DVIDS_API_KEY — current US military video and photos

- Key: create an API account at https://api.dvidshub.net (Sign up → create application); it looks like `key-xxxxxxxx`. **Not live-tested** (no key). Tested: no key gives `403 {"errors":["Bad Request - No API key was provided"]}`, a malformed key gives `"API key is not in a valid format"`.
- Search: `https://api.dvidshub.net/search?api_key=$DVIDS_API_KEY&q=<terms>&type[]=video&hd=1&aspect_ratio=landscape&max_results=50&sort=score`. Other params: `branch` (Army, Navy, Air Force, Marines, Coast Guard, Joint, Civilian, Space Force), `category[]` (e.g. `B-Roll`), `from_date`/`to_date`, `page` (page × max_results ≤ 1000). Result fields: `id` (`video:421202`), `title`, `type`, `credit`, `unit_name`, `branch`, `country`, `date`, `url` (the landing page), `thumbnail`.
- Asset: `https://api.dvidshub.net/asset?id=video:<n>&api_key=…` gives `description`, `credit[]` (`name`, `rank`), `unit_name`, `branch`, `virin`, `duration`, and `files[]` (`src` mp4, `width`, `height`, `bitrate`, `size`; the un-suffixed `DOD_<n>.mp4` is the highest bitrate). **`hls_url`, `srt` and `webvtt` contain your api_key**, so never record them.
- The API has **no license field**. The rule (https://api.dvidshub.net/docs/copyright) is "public domain unless other copyright status is indicated", so read `description` and the landing page for "courtesy", "©" or "restrictions" and reject on any of them. Credit as `author` = `"<rank> <name>, <unit_name>"`, `license` = `PD`, `sourceUrl` = the `url` field, plus the VIRIN in `notes`.
- **Keyless fallbacks:** (a) Commons `<terms> insource:dvidshub.net filetype:video` (152 hits for "drone"; best option). (b) Internet Archive `DOD_` items. (c) The website is behind an AWS WAF JS challenge (`curl` gets `202`, empty body, `x-amzn-waf-action: challenge`), but a real browser tool such as Playwright passes it. Search page `https://www.dvidshub.net/search/?q=<terms>&filter[type]=video`; on the video page, check the "PUBLIC DOMAIN" label; the `<video><source>` holds a direct `https://d34w7g4gy10iej.cloudfront.net/video/…-1024x576-…k.mp4` that `curl` can fetch. That's 1024×576 only; originals need a logged-in, validated account. Playwright writes `.playwright-mcp/` into the current directory, so move it out of the repo afterwards.

## 8. Smithsonian Open Access (KEY: api.data.gov) — DATA_GOV_API_KEY — aircraft, artifacts, NASM

- Key: https://api.data.gov/signup/ (one key works for many US government APIs). `DEMO_KEY` works for testing (tested: `X-Ratelimit-Limit: 10`).
- **Live-tested with DEMO_KEY.** `https://api.si.edu/openaccess/api/v1.0/search?q=<terms> AND media_usage:CC0 AND online_media_type:Images&rows=20&api_key=$DATA_GOV_API_KEY` (URL-encode the query).
- Fields: `response.rowCount`, `response.rows[].title`, `.content.descriptiveNonRepeating.{unit_code, data_source, record_link, guid, metadata_usage.access, online_media.media[]}`. Each media item has `usage.access` (must be `CC0`) and `resources[]` (`label` "High-resolution JPEG"/"TIFF", `dimensions`, `url` such as `https://ids.si.edu/ids/download?id=….jpg`). The credit line is in `content.freetext.creditLine`.
- Gotcha: `metadata_usage.access: CC0` covers the **metadata** only. Check each `media[].usage.access`. CC0 → `license: "CC0"`, `author` = the museum (`data_source`). Keyless partial fallback: Openverse `source=smithsonian_air_and_space_museum` (and the other `smithsonian_*` sources).

## 9. Europeana (KEY) — EUROPEANA_API_KEY — European museums, archives, photos and film

- Key: free Europeana account, then request a key in the account section (see https://pro.europeana.eu/get-api; since May 2025 requests go through the account page at https://www.europeana.eu/apis). The public demo key `api2demo` worked for testing; use your own key for real work.
- **Live-tested with api2demo**, both as a header and as `wskey=` (deprecated but still works): `curl -H "X-Api-Key: $EUROPEANA_API_KEY" "https://api.europeana.eu/record/v2/search.json?query=<terms>&reusability=open&media=true&qf=TYPE:IMAGE&rows=20&profile=rich"` (or `qf=TYPE:VIDEO`).
- Fields: `totalResults`, `items[].{title, dcCreator, dataProvider, rights[], edmIsShownBy[] (direct media), edmIsShownAt[] / guid (landing page), edmPreview, type}`.
- `reusability=open` returned only PDM, CC0, CC BY and CC BY-SA in testing, but **check each `rights[0]` URL** anyway: `publicdomain/mark` → `PD`, `publicdomain/zero` → `CC0`, `licenses/by/4.0` → `CC BY` 4.0, `licenses/by-sa/4.0` → `CC BY-SA` 4.0. Reject `rightsstatements.org/…` (InC, NoC-NC, NoC-OKLR…) and anything NC/ND. Strip `?utm_source=api…` from `guid`.

## 10. Flickr (KEY) — FLICKR_API_KEY

- Key: https://www.flickr.com/services/apps/create/. **Not live-tested.** Tested: an invalid key gives `{"stat":"fail","code":100,"message":"Invalid API Key (Key has invalid format)"}` (HTTP 200).
- `https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=$FLICKR_API_KEY&text=<terms>&license=4,5,8,9,10,11,12&extras=license,owner_name,url_o,url_k,url_h,o_dims&sort=relevance&per_page=50&format=json&nojsoncallback=1`
- Allowed license ids (from `flickr.photos.licenses.getInfo`): 4 CC BY 2.0, 5 CC BY-SA 2.0, 8 United States Government Work, 9 CC0, 10 Public Domain Mark, 11 CC BY 4.0, 12 CC BY-SA 4.0. **Never 7** ("No known copyright restrictions", Flickr Commons) unless an independent PD basis is shown, and never 0–3, 6 or 13–16.
- Landing page: `https://www.flickr.com/photos/<owner>/<id>`. Check that the uploader is the creator. US agency accounts (USAF, US Army, NASA HQ) commonly use license 8 → `PD`.
- Keyless fallback: Openverse `source=flickr` (Flickr is Openverse's largest source).

## 11. Freesound (KEY) — FREESOUND_API_KEY — sound effects

- Key: https://freesound.org/apiv2/apply/ (needs a free account). **Not live-tested.** Tested: no token gives `401 {"detail":"Authentication credentials were not provided."}`, a bad token gives `401 {"detail":"Invalid token"}`.
- Search: `https://freesound.org/apiv2/search/?query=<terms>&filter=license:("Creative Commons 0" OR "Attribution") duration:[0 TO 5]&fields=id,name,username,license,duration,previews,url&page_size=50&token=$FREESOUND_API_KEY` (URL-encode). License values are `"Creative Commons 0"`, `"Attribution"`, `"Attribution NonCommercial"` (reject) and legacy Sampling+ (reject).
- **The honest situation:** a token (API key) is enough for search and for `previews` (`preview-hq-mp3` ≈ 128 kbps, `preview-hq-ogg` ≈ 192 kbps). Downloading **originals** (`/apiv2/sounds/<id>/download/`) needs **OAuth2**, a per-user browser authorization flow that this kit doesn't implement. HQ previews are fine for sfx after loudnorm, and they're what `public/library/` already uses.
- Keyless fallback (tested): Openverse audio with `source=freesound` returns the same sounds with license and `foreign_landing_url`, and the preview MP3s on `cdn.freesound.org` download without a key. Verify the license on the Freesound page: "Attribution 4.0" → `CC BY` 4.0, "Creative Commons 0" → `CC0`. Credit `author` = the Freesound username.

## 12. ccMixter (keyless) — music beds

```text
https://ccmixter.org/api/query?f=json&tags=instrumental&lic=by&limit=20       # lic=by | sa | zero
```

- Response is a JSON array (served as `text/plain`) of objects with `upload_name`, `user_name`, `user_real_name`, `license_name` ("Attribution (3.0)", "Attribution Share-Alike (3.0)", "CC0 (CC Zero)"), `license_url`, `file_page_url` (used as `sourceUrl`), `files[].download_url` (mp3/flac), `upload_tags` and `upload_extra.usertags`.
- `lic=by`, `lic=sa` and `lic=zero` returned only the matching licenses (`lic=pd` also returned CC0). Add `tags=instrumental` (plus mood tags like `dark`, `ambient`, `cinematic`) to avoid vocals, and still listen for speech.
- Mapping: "Attribution (3.0)" → `CC BY` 3.0, "Attribution Share-Alike" → `CC BY-SA` 3.0, "CC0" → `CC0`. Remixes inherit their samples' licenses (ccMixter enforces this), so `license_name` is the effective license.

## 13. DuckDuckGo (lead finder, images only) — keyless, via `ddgs` in `.venv`

A way to **find** federal-site photos and odd one-offs that the archives above miss. It is **never a license source**: DDG's results and license filter come from Bing, which guesses the license from page metadata. In testing, Bing's "public domain" filter for "Tu-160 bomber" returned 32 of 35 hits from wallpaperflare, whose pages say "for personal desktop wallpaper use only". Installed into `.venv` by `npm run setup:align` from `requirements.txt` (pinned to 9.16.0); by hand: `.venv/Scripts/python.exe -m pip install -r requirements.txt`.

```bash
H=".venv/Scripts/python.exe -I -X utf8 .claude/skills/find-media/ddg_images.py"
$H "MQ-9 Reaper" --federal              # af.mil, army.mil, navy.mil, marines.mil, defense.gov/war.gov, dvidshub.net, nasa.gov, noaa.gov, usgs.gov, loc.gov, archives.gov
$H "laser weapon" --site navy.mil --site army.mil
$H "Tu-160 bomber" --license public     # public | share-commercially | modify-commercially | any
```

- Flags: `--max 30`, `--min-width 1280` (both defaults), `--show-rejected`, `--engine auto|ddg|bing`. `--license` defaults to `public`, but to `any` with `--site`/`--federal`: Bing doesn't tag federal pages as public domain, so combining the two dropped 27 of 35 federal hits and padded the list with junk.
- Output: one JSON line per hit (`title`, `image`, `page`, `domain`, `width`, `height`, `verdict_hint`), and a summary with counts per hint on stderr.
- `verdict_hint` (from the source page's domain, not from any license):
  - `federal-domain`: any `*.mil` or a listed federal domain. Usually PD; open the page and check the credit line ("U.S. Air Force photo by …", "IMAGE IS PUBLIC DOMAIN") and reject on "courtesy", ©, a contractor or a foreign military. af.mil, army.mil and defense.gov return 403 to curl, so open them with Playwright; navy.mil subsites work with curl.
  - `known-cc-host`: Commons, Wikipedia, Flickr, Openverse. Open the file's own page (not the Wikipedia article) and apply sections 1, 2 and 10. A Flickr "Public domain" mark by someone who isn't the creator is a reject.
  - `unknown`: open the page and find an explicit license that passes the gate, or drop it. Most are blogs and aggregators.
  - `reject-domain`: stock, agency, wallpaper, social and news hosts. Hidden unless `--show-rejected`.
- **Verify, then download from the origin.** Trace the hit to the page that actually publishes the photo (for DoD sites the `igphoto/<id>` page, with its VIRIN), confirm the license there, and record that page as `sourceUrl` and the origin file (e.g. `media.defense.gov/…`) as `originalUrl`. Never record a DDG or Bing URL.
- **Rate limits:** one search request per call (DDG's also fetches a token first). DDG often answers `202 {"response_type":"botnet_challenge"}` (4 of 6 test calls); with `--engine auto` the helper then makes one request to Bing, which is the same index and license filter. If both refuse, it exits 2. Wait several minutes; never loop it.
- **No video.** DDG video results are YouTube, and downloading from YouTube breaks its terms even for CC BY uploads.
- Known failure modes: relevance collapses on rare subjects (`"Tu-160 bomber" --federal` returned B-52s and B-1Bs; with `--license public` DDG matched "tu" to a valley and clip art); article pages reuse old file photos, so check the VIRIN date against the event; `crop_16_9` and `/2000/2000/` URLs are resized renditions, so take the full-size download from the photo page; a placeholder VIRIN such as `A-N1234` with "Credit: Army photo" has a PD basis but no named photographer.
- ddgs 9.16 with primp 2.x fails with "malformed headers" on DDG images (it sends `Connection: keep-alive` over HTTP/2); the helper strips that header.

## 14. YouTube (keyless, via yt-dlp) — Creative Commons videos and federal channels

Do not call yt-dlp or download from YouTube by hand. Use `npm run youtube -- <slug> search "<query>" --cc`, then `clip` (see `.claude/skills/youtube/SKILL.md`). Only YouTube's Creative Commons Attribution license counts (`license: "CC BY"`, `licenseVersion: "3.0"`, channel as `author`, watch URL as `sourceUrl`), or a verified US federal agency channel's own footage as `PD` with the basis in `notes`. The kit draws the channel tag. Reject burned-in creator logos and text. A video Commons has mirrored and reviewed is a Commons file (section 1), not a YouTube one.

## 15. Other sources checked

- **Free Music Archive:** the old API `freemusicarchive.org/api/get/…` is gone (404). The website still has a license filter; use it only by hand in a browser, and confirm CC BY or CC0 on each track page (most FMA tracks are NC).
- **NOAA / USGS:** no usable public media API (photolib.noaa.gov redirects; usgs.gov/media returned 504). Their PD media is on Commons: `<terms> insource:noaa.gov` (118k hits for "hurricane") and `<terms> insource:usgs.gov filetype:video`. Credit the agency, `license: "PD"`.
