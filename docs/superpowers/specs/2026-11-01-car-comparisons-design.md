# Car comparisons theme and format — design

Date: 2026-11-01 · Status: approved in chat ("looks good … build it"); builder check below

## Intent

The user wants a new kind of Brief Kit video for **a different YouTube channel**: new car models for buyers. One video:

1. introduces a new model (usually a new model year),
2. walks through its **trim levels**,
3. compares it with its **nearest rivals**, about five but anywhere from 3 to 7 (the user: "make the five rival grid soft… right around five ideal"),
4. ends on a **verdict**: is there a rival that is *a strong alternative worth a look* for the same money or a little more?

What counts as "strong" depends on the car's **niche**: a sedan buyer and an overlander care about different numbers. Each video declares its niche, and the niche decides which numbers are shown and judged (the user: "guage which metrics to focus on by car type… what makes what the best in these niches and analyze on that").

These videos **are never uploaded by Claude**. They go to another channel the user runs by hand (the user: "for this template DO NOT UPLOAD… Set that settings up for that").

## Recon (2026-11-01, ~4 min, YouTube search results)

- Edmunds: navy and electric blue with white type, studio cars lit blue. The most "trusted data" look.
- MotorTrend: black and white type, red top bar, yellow "VS".
- Dealer trim walkthroughs: each trim name in its own bright color over a row of cars.
- carwow: daylight, saturated paint, a red "AVOID?" callout.
- Shared conventions: yellow = winner / VS, red = warning. Car paint is the hero color; footage is never graded grey. Lineup grids (every trim or every rival side by side, with a logo or name over each) and one chapter per rival are the standard formats. Value hooks ("Why pay double for…", "The BEST trim to buy?") get the clicks.

## Goals

1. A new theme, **`car-comparisons`**, in the **split layout** (framed b-roll left, spec sheet right), styled as a **showroom spec sheet**: navy, white type, **signal yellow** for the one "worth a look / winner" color, **red** only for cost deltas and cautions, full-color footage.
2. A per-trim **color chip** a trim keeps through the whole video (scenes and infographics).
3. Three **infographic templates** made for this format: a **trim ladder**, a **rival grid** that lays itself out for 3–7 rivals, and a **verdict card**.
4. A **niche profile** reference (sedan, crossover, overlander, family SUV) that says which numbers are shown, which three decide the verdict, and where each number is reliably published. More niches can be added later as text.
5. A **`car-comparisons` skill**: the procedure for one of these videos, layered on the `new-episode` skill (same handoffs, fact-check, licensing, check, preview, render).
6. A **no-upload setting** in `config.yaml` that blocks this theme from every upload path, enforced in code, not only in prose.

## Non-goals

- New React scene types or a new `format`. The video is an ordinary `list` episode in a split-layout theme; trims and rivals are numbered segments, overview/grid/verdict are text sections with infographics.
- Automatic spec scraping or a spec database. Numbers come from the article and fact-check like every episode (CLAUDE.md rule 2).
- Thumbnails at render (the user's standing rule: no `npm run thumb` unless asked). The hook lives in the title; the skill records the thumbnail wording for when the user asks for one.
- Uploading to the other channel, or a second upload flow for it.
- The scheduled auto run making car videos.

## Anti-goals (failure even if it works)

- **The verdict claims superiority.** On screen and in narration a rival is never "better", "beats", or "more capable". It is *"a strong alternative worth a look"*. When the subject holds up, the verdict says so (*"still the one to beat in its class"* is fine; it is about the subject, not a put-down).
- **An unfair comparison.** A rival's top trim against the subject's base trim. Comparisons are trim-to-trim at a stated price point.
- **A price or spec without a model year and source.** Car prices change mid-year; every price carries its model year, whether destination is included, and the source date in `notes.md`.
- **Mixed measuring standards** shown as if comparable (e.g. EPA vs WLTP range, SAE J2807 vs non-J2807 towing, cargo volume measured differently). The skill makes the producer either use one standard across the grid or drop the metric.
- **An AI still or a stand-in photo presented as a specific car.** No AI images of real models; a photo of a different model year or trim gets a `note`.
- **A car-comparisons video reaching YouTube through Claude.** Any path: the upload skill, `pick-file`, the auto run.

## The look (theme `car-comparisons`)

Split layout (`THEME_LAYOUT["car-comparisons"] = "split"`).

| Slot | Value | Why |
|---|---|---|
| `bg` | deep showroom navy, about `#0b1526` | Edmunds' studio feel; makes paint and yellow pop |
| `panel` | navy at ~0.88 | spec panels |
| `text` | near-white `#f4f6fa` | |
| `dim` | text at 0.62 | |
| `accent` | signal yellow, about `#ffc629` | number slams, brackets, bars, the winner. In this kit `accent` is also used as **text** (big numbers, title, outro accent), so it must read on the background: yellow on navy does, yellow on light grey would not |
| `onAccent` | the navy | text on yellow fills (CTA, emphasis badge) |
| `highlight` | electric blue, about `#4da3ff` | stat values, active caption word, region line |
| `map.hostileStroke` (`--hostile`) | warning red, about `#ff4d4f` | cost deltas and cautions in infographics |
| `series` (new, see below) | 6–8 distinct trim colors (blue, red, green, purple, orange, teal, silver, gold) | trim chips |

- **Backdrop grade:** none to speak of. `grayscale(0)`, brightness ≥ 1, tint opacity ≤ 0.08. Car paint is the hero. Gradients light (the user's light-treatment rule).
- **Effects:** no scanlines, fine grain at most 0.04, a soft yellow glow on slams, light vignette.
- **Fonts:** a heavy condensed display face (like the recon thumbnails, e.g. Barlow Condensed 800 or Oswald 700), a clean mono or tabular face for labels and numbers (e.g. IBM Plex Mono or Roboto Mono), a neutral sans for body (e.g. Inter or Barlow). All Google fonts via `@remotion/google-fonts`, as the other themes do.
- **Copy:** `tickerLabel` "LINEUP", `topEmphasisLabel` "WORTH A LOOK", `locatorLabel` "BUILT IN", `endCardNext` "NEXT MATCHUP", `panelLabel` "SPECS", `ctaLabel` "SUBSCRIBE", new `frameLabel` "MODEL" (see kit changes).

**Changed from the chat:** in chat I proposed a *light* background, reading the user's "light theme" memory as light backgrounds. That memory is about a light **footage grade** (no dark washes), which this theme keeps. A light background can't carry yellow text in this kit (accent is used for big text), so the theme is a navy showroom. Flagged to the user at handover; a light variant is a colors-only change if they want it.

## Video structure

An ordinary `"format": "list"` episode, `"theme": "car-comparisons"`, 16:9.

1. **Cold open:** 2–4 stamp beats with the hook (price, a striking number), title card (e.g. kicker "2027 TOYOTA", big "RAV4" — ≤ 4 chars, else a number like "5" with small "RIVALS TO\nKNOW").
2. **Text section "THE LINEUP"**: overview of the model and what's new, then the **trim ladder** infographic.
3. **Trim segments** (numbered 1..T): one per trim that matters (2–5; minor trims can be covered by the ladder alone). `region` "TRIM · <price>" style, `headline` the trim name, `chip` = the trim's series color, `stats` = the niche's metrics for that trim (what changes from the trim below, mainly).
4. **Text section "THE RIVALS"**: the **rival grid** infographic (3–7 cards).
5. **Rival segments** (numbered on from T+1, `region` "RIVAL · <brand>"): one per rival, compared at the stated price point, `stats` = the same niche metrics in the same order as the subject's, so the spec sheets line up.
6. **Text section "THE VERDICT"** with `emphasis`-style wording: the **verdict card** infographic. Either one or two rivals tagged **WORTH A LOOK** (yellow), or the subject tagged **STILL THE ONE** when no rival qualifies.
7. Outro, sources card, credits roll (defaults).

**A "strong alternative"** (the verdict rule, the skill's to apply): priced at or up to ~10% above the subject's compared trim (`stated price point`, MSRP + destination, same model year where possible), and ahead on at least two of the niche's three deciding metrics without being clearly behind on the third. The ~10% is a default the skill states; the producer may say "a little more" only within it.

### Hook (title formulas; honest, follow the verdict)

- A rival qualifies: **"Before You Buy the 2027 [Model], Look at This One"**, or "2027 [Model] Trims Explained, and the Rival Worth a Look".
- The subject holds up: **"We Tried to Find Something Better Than the 2027 [Model]"**.
- Thumbnail wording (recorded in `notes.md`, made only when the user asks): the rival with a yellow **WORTH A LOOK** tag and a price delta (red "+$1,400" or yellow "SAME PRICE"); or the subject with **STILL THE ONE**. A PRESS image is never the thumbnail (existing rule), so a thumbnail needs a PD/CC photo.

## Niches

`.claude/skills/car-comparisons/niches.md`, one section per niche with: the 3 **deciding** metrics (ranked), the **always-shown** metrics, **secondary** metrics (shown when they help, not judged), what to skip, where each number is reliably published, and its traps. Built from a reviewer-criteria research pass (2026-11-01; Edmunds rating categories, Cars.com 3-row testing, IIHS LATCH ratings, Expedition Portal on payload and roof load, fueleconomy.gov, NHTSA); the sources go in the file. Rankings are a synthesis, not any outlet's published formula.

**The user's rule for every SUV and off-road niche (crossover, overlander, family SUV):** always show **suspension** (front/rear type, e.g. "IFS / SOLID", "AIR", with wheel travel when published), **torque** (lb-ft), **approach angle** (the user's "angle of attack") and **ground clearance**, when the maker publishes them, alongside the niche's other metrics. They are shown for the subject's trims and for every rival, in the same rows. Missing for a rival → "N/A" on that row, never a guess.

- **Sedan.** Decide: price, fuel economy or EV range, crash rating. Secondary: rear legroom, trunk space, warranty, standard safety tech, horsepower/torque. 0–60 only from a named instrumented test, labeled as such.
- **Crossover.** Decide: price, fuel economy, crash rating. Always: suspension, torque, approach angle, ground clearance. Secondary: cargo (same body style and method only), AWD standard or extra, rear legroom, towing. Reliability only as an attributed note.
- **Overlander.** Decide: payload, the weakest of approach / breakover / departure, range on a tank (tank × EPA highway, shown as "EST."). Always: suspension (plus travel and whether sway-bar disconnect exists), torque, approach angle, ground clearance. Secondary: low range and locking diffs, fording depth, dynamic roof load (only if published, else N/A). Payload and angles compared at the same trim.
- **Family SUV.** Decide: third-row legroom, cargo behind the third row, crash rating with the IIHS LATCH ease-of-use rating (instead of a raw anchor count). Always: suspension, torque, approach angle, ground clearance. Secondary: seats and captain's chairs, towing, fuel economy, price. Minivans are fair rivals (buyer guides cross-shop them, e.g. KBB Best Family Cars); a minivan gets the same rows, with sliding doors noted.

**Amended 2026-11-02 (the user): every car, every niche, gets cargo room and projected reliability** as the last two rows of every segment. Cargo is the maker's figure behind the rear-most seats (trunk for sedans, bed length for trucks; already a deciding row for family SUVs, so not repeated). Reliability is one outlet for the whole video: Consumer Reports predicted reliability (1–100) when every car's score can be read, else J.D. Power Quality & Reliability (x/100, free per model), attributed, never mixed, never a brand average; a new generation with no rating is N/A. Neither is a deciding number; reliability is stated and weighed as one factor among many, never sinks a car, and can tip a close call. The verdict card shows both after the deciding three (cells shrink to fit 6 rows). This replaces "reliability only as an attributed note" above. Details: `niches.md`, "Every car".

Split-layout spec panels hold 5 rows and read well up to 3 panels (`LIMITS.splitPanels`), so an SUV segment's 4 always-shown rows plus its deciding rows fit in two panels (with the two every-car rows, 9 rows, still two panels).

Traps the skill spells out: price with or without destination; EPA vs WLTP range never mixed; cargo volume methods differ by brand (compare same body style); towing depends on trim, drivetrain and hitch package (J2807 adoption not universal); clearance and angles change by trim and tires; payload falls with options and roof weight; NHTSA and IIHS are different tests and often missing for new models in their first months; 0–60 is test data, not a spec.

The episode records its niche in `notes.md` (not in `episode.json`; the schema stays generic).

## Kit changes

1. **Theme** `src/kit/themes/car-comparisons.ts`; register it in `ids.ts` (`THEME_IDS`, `THEME_LAYOUT: "split"`) and `index.ts`. Update the `--theme` lists in `CLAUDE.md` and `scripts/new.ts` usage text.
2. **Series colors** (trim chips): optional `series?: string[]` on `Theme` (`types.ts`). `scripts/infographic.ts` injects `--series-1` … `--series-8` (themes without `series` fall back to accent/highlight/hostile/ally/text). The infographic skill's variable table gets a row.
3. **Segment chip:** optional `chip: z.number().int().min(1).max(8)` on `segmentSchema`: "Split layout: a square in the theme's series color N before the region, so a trim keeps its color through the video." `SplitSegment` draws it; other layouts ignore it. `check` warns when `chip` is set in a theme without `series`. Regenerate `episodes/episode.schema.json` the way the repo does.
4. **Frame label:** `SplitSegment` hard-codes "FILE" in the frame chip ("■ FILE 01 · 1/3"). Add optional `copy.frameLabel` (default "FILE", so the military and erotic themes don't change); car-comparisons sets "MODEL".
5. **`new.ts` brand carry:** when `--theme` is given, carry brand and audio from the latest same-format episode **with that theme** if one exists (so a car video doesn't inherit "ON MILITARY"); otherwise as today. The skill has the producer ask the user for the other channel's brand name on the first car video.
6. **No-upload setting:**
   ```yaml
   upload:
     # Themes whose videos go to another channel: Claude never uploads them. The upload skill stops, pick-file
     # refuses their files, upload-text still writes the title and description (marked doNotUpload) for you to post
     # by hand, and the auto run never uses them.
     blocked_themes: [car-comparisons]
   ```
   - `scripts/lib/config.ts`: `upload: { blocked_themes: string[] }`, default `[]` (the repo's config.yaml sets it).
   - `scripts/lib/upload.ts` (new): `uploadBlocked(slug) → { blocked: boolean, theme, reason }`, reading `episodes/<slug>/episode.json` (a Short's own theme; if absent, its `parent`'s).
   - `scripts/pick-file.ts`: if the path is inside `out/<slug>/` (or `public/episodes/<slug>/`) and that slug is blocked, fail with the reason. Other paths are untouched.
   - `scripts/upload-text.ts`: for a blocked slug, write `upload.json` with `"doNotUpload": true` and a warning line; refuse `--url` (recording an upload link would mean it was uploaded through the kit).
   - `youtube-upload` skill: a step 0 that runs the check (reads `upload.json` / the theme) and stops with a message naming the other channel rule.
   - `auto-long-shorts` skill: never uses a blocked theme.
   - `CLAUDE.md`: one line under the upload sentence, and the new skill in the skill list.
   - Unit tests for `uploadBlocked` (theme blocked, Short inheriting from parent, not blocked) and the config default.
7. **Infographic templates** in `.claude/skills/car-comparisons/templates/` (copied per episode like the infographic template; theme variables only, no hex, data in a `DATA` block at the top):
   - `trim-ladder.html`: 2–7 trims as rungs, cheapest at the bottom: chip color, name, price, 2–3 "adds" per rung. Rows animate up in sequence.
   - `rival-grid.html`: 3–7 cards. Layout rule: 3 → one row; 4 → 2×2; 5 → 3 + 2 centered; 6 → 3×2; 7 → 4 + 3 centered. Each card: brand/model, compared trim and price, the niche's 2 top numbers. The subject card first, outlined in `--accent`. Optional photo per card (a credited still in the episode's `images/`; else a clean name card).
   - `verdict.html`: subject vs 1–2 alternatives: price delta row (`--hostile` when more, `--accent` when same or less), the 3 deciding metrics side by side with the leader of each in `--accent`, and the tag **WORTH A LOOK** (yellow fill, navy text) or **STILL THE ONE** on the subject.
   - All legible in the split frame at ~0.54× (the infographic skill's rule 4: body ≥ 40px, values ≥ 64px) and in overlay panels. Rendered at the default 1920×1080.
8. **Skill** `.claude/skills/car-comparisons/SKILL.md` + `niches.md`: when to use; similarity review; the article/fact-check sources for car specs (manufacturer spec pages and press releases, fueleconomy.gov and NHTSA (US government, public domain), IIHS); picking the niche and the rivals (same class, same price band, the buyer's real cross-shops); the price point and trim-to-trim rule; the structure above with an `episode.json` sketch; the wording rules and hook formulas; the templates; media (PRESS images are the main source for new models since `licensing.press_images: true`; Wikimedia Commons for older ones; a different year or trim gets a `note`; no AI stills of real models); no upload. Handoffs, voice, voice-check, preview and render are the `new-episode` skill's, unchanged.

## Verification

- `npm test` (or the repo's test command) passes, including the new tests.
- `npx tsc` / the repo's type check passes.
- A **theme test episode** `episodes/zz-car-theme-test/` (local, gitignored media) built from one existing split-layout episode's structure with an estimated timing, rendered as `npx remotion still` frames at: title card, a trim segment with chip and spec panel, a rival segment, a text section with an infographic panel, outro. The three templates rendered with sample data (`npm run infographic … --still`). Looked at by eye for contrast, clipping, the chip, and yellow readability. The test episode is deleted afterwards (it holds made-up sample numbers and must never be rendered as a video).
- `npm run pick-file` on a blocked episode's file fails; `upload-text` writes `doNotUpload: true`.
- `npm run check` on an existing military-comparisons episode still shows the same result as before (no regressions from `frameLabel`/`chip`).

## Calls made after the builder check (mine, for the user to check)

1. **Shorts follow the parent for the upload block.** `uploadBlocked(slug)` blocks a slug when its own theme is blocked **or** its `parent` (recursively) is, because `npm run short` and long Shorts can give a Short its own theme (`dispatch`). Car Shorts aren't part of this build (`shorts.enabled` is false); the theme's colors work in the Short layouts, which ignore `chip` and `frameLabel`, and the templates are 16:9 only. 1200×850 template versions come if the user asks for car Shorts.
2. **Suspension fits the 10-character stat value** with a short code as the value and the detail in the label (≤ 42): value `IFS/SOLID`, label `SUSPENSION · DBL WISHBONE / 4-LINK`. The skill lists the codes (IFS, IRS, SOLID, AIR, IND, MCPH, LEAF). Wheel travel, when published, is its own row. No limit change.
3. **Press photos may appear in the rival grid**: each card shows a product the section discusses, which is what the PRESS rule allows. Each photo keeps its own `PRESS` entry in `credits.json` (the file in `images/`), and the infographic's `OWN WORK` credit lists them in its notes. Never the thumbnail, as before. Without a usable photo, the card is name-only.
4. **Numbering:** trims and rivals are numbered continuously (trims 1..T, rivals T+1..N), so the split layout's "05 OF 09" counter stays correct; the `region` line ("TRIM · $31,900" / "RIVAL · HONDA") says which is which. No explicit `num`.

## Left to the builder

Exact hex values and fonts within the table above, effect strengths, template animation details, the wording of skill prose, file names of tests.
