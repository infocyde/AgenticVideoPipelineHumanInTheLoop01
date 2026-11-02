# Car Comparisons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `car-comparisons` theme (split layout, navy showroom), trim chips, three infographic templates, a `car-comparisons` skill with niche profiles, and a no-upload block for the theme.

**Architecture:** Theme + two small optional kit fields (`Theme.series`, `copy.frameLabel`, segment `chip`); everything else is skill prose and HTML templates rendered by the existing `npm run infographic`. The upload block is one library function (`scripts/lib/upload.ts`) called by `pick-file` and `upload-text`, plus skill/CLAUDE.md lines.

**Tech Stack:** TypeScript, Remotion 4, zod, `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-01-car-comparisons-design.md`

## Global Constraints

- Theme id `car-comparisons`; layout `split`.
- Colors: bg ≈ `#0b1526`, text `#f4f6fa`, accent yellow ≈ `#ffc629`, onAccent = bg navy, highlight ≈ `#4da3ff`, map.hostileStroke ≈ `#ff4d4f`; backdrop grayscale 0, tint ≤ 0.08; no scanlines; grain ≤ 0.04.
- Copy: tickerLabel "LINEUP", topEmphasisLabel "WORTH A LOOK", locatorLabel "BUILT IN", endCardNext "NEXT MATCHUP", panelLabel "SPECS", ctaLabel "SUBSCRIBE", ctaDoneLabel "SUBSCRIBED ✓", frameLabel "MODEL".
- Existing themes render unchanged (`frameLabel` default "FILE"; `chip` ignored when absent).
- Verdict wording: "a strong alternative worth a look"; never "better", "beats", "more capable".
- `config.yaml` `upload.blocked_themes: [car-comparisons]`; default `[]` in `config.ts`.
- Infographic templates: theme CSS variables only, no hex; legible at ~0.54× (body ≥ 40px, values ≥ 64px).

## Review Focus

- A Short with `"theme": "dispatch"` whose `parent` is a car episode → blocked (test in Task 3).
- `pick-file` on a path outside `out/` and `public/episodes/` → behaves exactly as before (test in Task 3).
- A missing `episode.json` for the slug in an `out/<slug>/` path → not blocked, no crash (test in Task 3).
- `chip` greater than the theme's `series` length → falls back cleanly (check warning, Task 2).
- Rival grid with 3, 5 and 7 cards → no overflow beyond the safe area (Task 4 still renders).

---

### Task 1: Theme, series colors, frame label

**Files:** Create `src/kit/themes/car-comparisons.ts`; Modify `src/kit/themes/types.ts`, `ids.ts`, `index.ts`, `src/kit/scenes/SplitSegment.tsx` (frame chip), `scripts/infographic.ts` (vars), `scripts/new.ts` (usage text), `.claude/skills/infographic/SKILL.md` (variable table).

**Interfaces — Produces:** `Theme.series?: string[]`; `Theme.copy.frameLabel?: string`; CSS vars `--series-1`…`--series-8` (fallbacks for themes without `series`: accent, highlight, hostile, ally, text, dim, accent-deep, line).

- [ ] Add types; theme file per Global Constraints (fonts: Barlow Condensed 800 display, Roboto Mono 500/700, Barlow 600/800 body); register in ids (`"split"`) and index.
- [ ] `SplitSegment`: `{copy.frameLabel ?? "FILE"}`.
- [ ] `infographic.ts`: inject series vars.
- [ ] Run `npm run typecheck` → no errors; `npm test` → pass.
- [ ] Commit.

### Task 2: Segment `chip`

**Files:** Modify `src/kit/schema.ts` (segmentSchema), `src/kit/scenes/SplitSegment.tsx` (chip square before region), `scripts/lib/check.ts` (warn), `src/kit/schema.test.ts`.

**Interfaces — Produces:** `segment.chip?: number` (int 1–8).

- [ ] Test `chip parses 1..8 and rejects 0 and 9` in `schema.test.ts`.
- [ ] Run → FAIL.
- [ ] Add field; SplitSegment draws an 18px square in `series[chip-1]` (fallback accent) before region text.
- [ ] check: warn `chip set but theme has no series colors` / `chip N > series length`.
- [ ] `npm test` → PASS; `npx tsx scripts/sync.ts` regenerates schema JSON; typecheck.
- [ ] Commit.

### Task 3: No-upload block

**Files:** Create `scripts/lib/upload.ts`, `scripts/lib/upload.test.ts`; Modify `scripts/lib/config.ts`, `config.yaml`, `scripts/pick-file.ts`, `scripts/upload-text.ts`, `.claude/skills/youtube-upload/SKILL.md`, `.claude/skills/auto-long-shorts/SKILL.md`, `CLAUDE.md`.

**Interfaces — Produces:**
- `uploadBlocked(slug: string, blocked: string[], readEpisode?: (slug) => {theme?: string; parent?: string} | null): { blocked: boolean; theme?: string; via?: string }` — follows `parent` recursively (depth ≤ 5).
- `slugFromPath(absPath: string, root: string): string | null` — slug for `out/<slug>/…` or `public/episodes/<slug>/…`.

- [ ] Tests: blocked theme → blocked; Short with dispatch theme and blocked parent → blocked, `via` = parent; unrelated theme → not; missing episode → not; `slugFromPath` for out/, public/episodes/, and other paths (null); config default `[]`.
- [ ] Run → FAIL; implement; run → PASS.
- [ ] `pick-file`: if `slugFromPath` and blocked → `fail("… goes to another channel (config.yaml upload.blocked_themes); Claude never uploads it")`.
- [ ] `upload-text`: blocked → write `doNotUpload: true` + warn; `--url` → fail.
- [ ] Skill/CLAUDE.md lines; config.yaml block with comment.
- [ ] typecheck + test; commit.

### Task 4: Templates, skill, niches

**Files:** Create `.claude/skills/car-comparisons/SKILL.md`, `niches.md`, `templates/trim-ladder.html`, `templates/rival-grid.html`, `templates/verdict.html`.

- [ ] Write the three templates from `.claude/skills/infographic/template.html` conventions (`DATA` block on top, `bkSeek`, safe area). Rival grid layout rule: 3 → 1 row; 4 → 2×2; 5 → 3+2; 6 → 3×2; 7 → 4+3.
- [ ] Write niches.md (spec "Niches" section + research sources) and SKILL.md (spec Goal 8 contents).
- [ ] Verification episode `episodes/zz-car-theme-test/` with estimated timing; render the 3 templates (`--still`, rival grid at 3/5/7) and Remotion stills (title, trim segment with chip, rival segment, text section panel). Inspect; fix; delete the test episode.
- [ ] Regression: `npm run check` on `2026-10-28-poland-military` before/after shows the same counts.
- [ ] Commit.
