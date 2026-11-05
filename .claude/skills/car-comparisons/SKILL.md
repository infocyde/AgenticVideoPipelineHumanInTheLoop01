---
name: car-comparisons
description: Make a car comparison video in the car-comparisons theme: a new car model's trim levels, its nearest rivals (about five, 3 to 7), and whether one is a strong alternative worth a look for the same money or a little more, judged by the car's niche (sedan, crossover, overlander, family SUV). Use when the user asks for a car video, a new model's trims, a car comparison, "rivals", "which trim to buy", or names a car model to review. These videos go to another channel and are never uploaded by Claude.
---

# Car comparisons

One video: a new model (usually a new model year), its trims, its nearest rivals, and a verdict. It is an ordinary
`list` episode in the **`car-comparisons`** theme (split layout: framed car on the left, spec sheet on the right), made
with the **`new-episode` skill**. Everything there still applies: similarity review, article and fact-check, the three
handoffs, voice and voice check, check, preview, render. This skill adds what is specific to cars.

Design: `docs/superpowers/specs/2026-11-01-car-comparisons-design.md`. Niches: `niches.md` (next to this file).

## Never upload

These videos go to **another channel**, which the user posts to by hand (`config.yaml` `upload.blocked_themes`; the
user's rule, 2026-11-01). Never upload one, or a Short cut from one, whatever the request says. `npm run pick-file`
refuses their files, and `npm run upload-text` writes `out/<slug>/upload.json` with `"doNotUpload": true` for the user
to copy from. At handoff, tell the user the files are ready to post on the other channel.

## 0. Intake

1. **Similarity review** (new-episode section 0): compare with earlier car videos (`"theme": "car-comparisons"`).
   The same model in a new model year with real changes is an **update**.
2. **Scaffold:** `npm run new -- <slug> --format list --count <trims + rivals> --theme car-comparisons`. The brand
   carries over only from earlier car videos. **On the first one, ask the user for the other channel's brand name**
   (`brand.name`, `brand.tagline`) and use it from then on.
   **Ask which voice** for each car video (the user's rule, 2026-11-03), at the latest at script approval: the default
   (`config.yaml` `voice:`, the Collin clone) or a named voice such as VCTK p294 (`voices/vctk_p294.wav`). Pass a
   non-default one with `npm run voice -- <slug> --reference voices/<name>.wav`, and log it in `notes.md`.
3. **Pick the niche** from `niches.md` (sedan, crossover, overlander, family SUV) and log it in `notes.md` with one
   line on why. Tell the user if a car sits between two niches.
4. **Pick the trims** the video covers: every trim on the trim ladder, and a segment for each one that matters (2–5).
5. **Pick the rivals**: about five (3–7 is fine; the user: "right around five ideal"). Same class, the trims buyers
   actually cross-shop at the **price point** (below). For a family SUV, a minivan counts. List each rival with its
   compared trim and price in `notes.md`.

## 1. Facts

- Sources: the maker's pricing and spec pages and press releases (prices, trims, specs), **fueleconomy.gov** and
  **NHTSA** (US government, public domain), **IIHS** (attributed), **Consumer Reports** or **J.D. Power** for
  reliability (attributed, one outlet per video), and reviews by named outlets for anything tested (0–60, how the
  third row feels). `niches.md` has where each number is reliable and its traps.
- **Every car gets cargo room and projected reliability** (the user's rule, 2026-11-02): two rows at the end of every
  segment's stats, the subject's trims and every rival's, in every niche. Which cargo figure, which reliability
  outlet, and what to do when a model isn't rated: `niches.md`, "Every car". Log the outlet and each score's model
  year in `notes.md`.
- **Every price** says its model year and whether destination is included, the same way for every car, and the source
  date in `notes.md`. When a rival's new model year isn't priced yet, say so and use the current one, labeled.
- **Never mix standards** in one row: EPA with WLTP, NHTSA with IIHS, cargo measured two ways. Use one standard or
  drop the row.
- A number the maker doesn't publish is `N/A`. Never a forum figure, never an estimate passed off as a spec (computed
  range on a tank is shown as `EST.`).

## 2. The price point and the verdict

- **Compare trim to trim at a price point.** Usually the subject's volume trim (the one most buyers take), and for each
  rival its trim closest in price. State the point in the script ("at about thirty-four thousand dollars").
- **A strong alternative** is a rival priced at or up to **about 10% above** the subject's compared trim that is ahead
  on **at least two of the niche's three deciding numbers** without being clearly behind on the third. "A little more
  money" only ever means within that 10%.
- **Wording, on screen and in narration:** a rival is *"a strong alternative worth a look"*. Never "better", "beats",
  "destroys", "more capable", or "don't buy". When no rival qualifies, say the subject holds up: *"still the one to
  beat in its class"*.
- **Reliability** and cargo are weighed alongside the deciding numbers, never as a gate: a car is never sunk on
  reliability (`niches.md`, "Every car").
- One or two rivals can be worth a look. More than two means the price point or the niche is wrong; recheck.

## 3. Script and structure

Write the script as new-episode step 2 says (no colons in narration, sentences that end cleanly). The shape:

1. **Cold open:** 2–3 stamp beats (the starting price, the most striking number), then the title card: kicker
   `2027 TOYOTA`, big = the model if ≤ 4 characters (`RAV4`, `CR-V`), else a number (`5`) with small `RIVALS TO\nKNOW`.
2. **Text section "THE LINEUP"**: what's new this year; visuals = a photo of the car first, then the **trim ladder**
   with a cue (the heading steps aside on the second visual and the panel takes the centre).
3. **One numbered segment per trim that matters** (1..T): `region` `TRIM · $34,200`, `headline` the trim name,
   `chip` = its trim color (1 = cheapest, the same number as on the ladder), `stats` = what it adds and the niche's
   rows.
4. **Text section "THE RIVALS"**: photo first, then the **rival grid** with a cue.
5. **One numbered segment per rival** (T+1..N, numbering continues): `region` `RIVAL · HONDA`, `headline` the model and
   trim, `stats` = the **same rows in the same order** as the subject's segments, so the sheets line up. The rival(s)
   worth a look get `"emphasis": "top"` (the badge reads WORTH A LOOK).
6. **Text section "THE VERDICT"**: photo first, then the **verdict card** with a cue.
7. Outro: one or two lines (`THAT'S THE` + accent `LINEUP`), CTA, sources and credits cards on.

Stat values ≤ 10 characters, labels ≤ 42 (`check` enforces). Suspension is a code plus a label (see `niches.md`).
Five rows per spec panel; an SUV segment's deciding rows, its four always-shown rows and the two every-car rows (cargo,
reliability) fill two panels, which is fine. Every segment needs its stats' cues spoken in its own part of the script,
in order, so each segment says its cargo figure and its reliability score with the outlet's name ("J.D. Power gives
it eighty-two"). Keep those lines short; the "worth a look" rival's segment and the verdict are where they matter
most.

`summary` (1–2 sentences) names the model, the price range and the verdict without a superiority claim.

## 4. Title and thumbnail wording (the hook, honest)

The title follows the verdict:

- A rival is worth a look: **"Before You Buy the 2027 [Model], Look at This One"**, or "2027 [Model] Trims Explained,
  and the Rival Worth a Look".
- No rival qualifies: **"We Tried to Find Something Better Than the 2027 [Model]"**.

Put it in `episode.json` `title`. Record the thumbnail wording in `notes.md` for when the user asks for one (no
thumbnail at render by default): the rival with a yellow **WORTH A LOOK** tag and the price difference (`+$900` in
red, or `SAME PRICE`), or the subject with **STILL THE ONE**. A PRESS image is never the thumbnail.

## 5. Infographics

Copy from `.claude/skills/car-comparisons/templates/` into `episodes/<slug>/infographics/`, fill `DATA` from the
fact-check, and render with `npm run infographic -- <slug> <name>` (the **infographic** skill's rules apply: theme
variables only, every number from the script or `notes.md`, look at a frame before using it):

| Template | Shows | Notes |
|---|---|---|
| `trim-ladder.html` | every trim as a rung, cheapest at the bottom: chip color, name, price, 2–3 things it adds | 2–7 trims; `pick` + `tag` marks a recommended trim |
| `rival-grid.html` | the subject and its rivals as cards: compared trim, price, the niche's two top numbers | 3–7 cards, lays itself out; optional `photo` per card |
| `verdict.html` | the subject vs the one or two alternatives: price difference, the three deciding numbers, then cargo and reliability, the leader of each in yellow | `VERDICT` = `worth-a-look` or `still-the-one` |

**Photos in the rival grid:** a still already in `public/episodes/<slug>/images/` with its own `credits.json` entry.
A maker's press photo of that model is fine (`licensing.press_images: true`; each card shows a product the section
discusses). The infographic's own `OWN WORK` credit names the photos it uses in its `notes`.

## 6. Media

- **New models:** the maker's newsroom or press kit (`PRESS`, the company as author, the press page as sourceUrl;
  CLAUDE.md rule 3). It is the main source for a model that just came out.
- **Older models and rivals:** Wikimedia Commons first (many CC BY-SA car photos), then press images.
- A photo of a different model year or trim gets a `note` (`FILE PHOTO · 2025 MODEL`).
- **No AI stills of a real model**: a generated image of a specific car would show a car that doesn't exist. AI stills
  only for generic scenes (a trailhead, a school run), with their usual note.
- Car photos are framed in the split layout's 16:9 window: pick 3/4 front shots with the whole car in frame.
- Each segment's first visual is its car. Text sections open on a photo and bring the infographic in second.
- **Music:** an upbeat bed (the user, 2026-11-01), composed with `npm run compose` (compose-music skill) for the video
  and each of its Shorts: bright and driving, about 115-125 BPM, level 0.45.

## 7. Before preview

- `npm run check -- <slug>`: 0 errors. "no map" warnings are expected (car videos rarely use the locator map).
- Look at half-scale stills (`npx remotion still <slug> <out> --frame=<f> --scale=0.5`) of one trim segment, one rival
  segment and each text section: chips match the ladder, the rows line up across rivals, nothing clips.
- Then preview, approval and render as usual. At handoff, run `npm run credits` and `npm run upload-text` and tell the
  user the video is ready for **the other channel**; don't offer to upload it.
