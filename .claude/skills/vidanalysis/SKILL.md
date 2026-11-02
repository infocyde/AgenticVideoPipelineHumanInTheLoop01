---
name: vidanalysis
description: Use when the user says "vidanalysis", "run vidanalysis" or "check the analytics", or asks how the recent uploads did, and on its schedule (Monday and Thursday 12:01 PM). Reads YouTube Studio analytics in the user's signed-in browser, read-only, saves a dated snapshot and compares it with the last report only (per-video view growth, the ~1,000-view Shorts ceiling, near-zero Shorts, a monetization-denial risk rating, and the last log's open questions).
---

# Vidanalysis

A read-only look at the channel's YouTube Studio numbers. Each run saves a **snapshot** and compares it with **the last report only**: the newest earlier snapshot in `analytics/vidanalysis/`, however many days back it is. Never compare with older reports: no trends across three or more logs. If there is no earlier snapshot, save this one, say there's nothing to compare it with, and stop there.

**Schedule:** Task Scheduler "BriefKit vidanalysis", Monday and Thursday at 12:01 PM (`scripts/auto/vidanalysis-run.ps1`; install or remove with `scripts/auto/install-vidanalysis-task.ps1 [-Remove]`). The user can also run it by hand at any time. A scheduled run has nobody watching: never ask a question; on a blocking problem write it in the log and stop.

Started 2026-11-01 (baseline log). The question that started it: is ~9+ uploads a day helping or hurting, and why do some Shorts get ~1,000 views while others get 2–5?

## Files

All logs live in `analytics/vidanalysis/` (gitignored, local only):

- `YYYY-MM-DD.json`: the raw snapshot (schema below), written by the gathering step.
- `YYYY-MM-DD.md`: the analysis, written by the analysis step. Its **Open questions for next run** section is the list the next run must answer.

Files are named by local date (PST): `<date>` = today, e.g. `2026-11-05`. If a file for today already exists (a second run the same day), name the new pair `<date>-HHmm`. **The last report** = the earlier `.json` with the latest `captured_at`.

**End every log** with a last line `Status: done` (or `Status: stopped: <reason>`): the scheduled run closes its window when it sees it.

## Models

Two steps, per the user's instruction (2026-11-01):

1. **Gathering: Sonnet**, high effort. Start one agent with `model: "sonnet"`, `effort: "high"` and the brief in "Gathering brief" below. It only reads Studio and writes the JSON.
2. **Analysis: Opus**, high effort. If the main session already runs on Opus, do it yourself; otherwise start an agent with `model: "opus"`, `effort: "high"`.

If the Sonnet agent can't reach the browser tools (no Claude in Chrome in a subagent), gather in the main session with the same procedure, and record `"gathered_by": "main session (agent had no browser)"` in the JSON.

## Gathering brief (give this to the Sonnet agent)

Read-only. Never click anything that changes a video, a setting, or visibility; never reply to comments. Use Claude in Chrome (load its tools in one ToolSearch call; `tabs_context_mcp` first, then work in a new tab of your own; close it at the end). Channel id: `UCFbS2ZbgTjonUZvYY1R1vIg`. Studio pages render late: wait about 3 s after each navigation before reading.

Collect, in this order, and write `analytics/vidanalysis/<date>.json`:

1. **Capture time**: `captured_at` (local time, from the system clock).
2. **Dashboard** `https://studio.youtube.com/channel/UCFbS2ZbgTjonUZvYY1R1vIg`: current subscribers.
3. **Overview** `…/analytics/tab-overview/period-default`: the period label (e.g. "Oct 4 – 31, 2026"), views, watch hours, subscriber change, Realtime "Views · Last 48 hours". Scroll the "top content" table: each row's title, date, average view duration (and %), views.
4. **Content tab, Shorts** `…/analytics/tab-content/period-default` (the "Shorts" filter): views, engaged views, likes, subscribers, "How viewers find your Shorts" (every source with its %), "How viewers engaged" (stayed vs swiped %), Top Shorts. `get_page_text` reads this tab well.
5. **Content tab, Videos** (the "Videos" filter): views, thumbnail impressions, thumbnail CTR, average view duration, traffic sources with %, Top videos, and the "Still watching at 0:30" list.
6. **Shorts list** `…/videos/short` (sorted newest first): every row back to at least the oldest Short in the last report's list, so every Short in the last report is in this one. Rows per page default to 30: raise it to 50 at the bottom of the table, or go to page 2. For each row: video id, full title, visibility, date, views, comments. This extraction works (run it with `javascript_tool`):

   ```js
   const rows=[...document.querySelectorAll('ytcp-video-row')];
   const t=(r,s)=>r.querySelector(s)?.innerText.trim().replace(/\s+/g,' ')||'';
   JSON.stringify(rows.map(r=>({
     id:(r.querySelector('a[href*="/video/"]')?.getAttribute('href')||'').match(/video\/([\w-]{11})/)?.[1],
     title:t(r,'#video-title'), visibility:t(r,'.tablecell-visibility').split(' ')[0],
     date:t(r,'.tablecell-date'), views:t(r,'.tablecell-views'), comments:t(r,'.tablecell-comments'),
     restrictions:t(r,'.tablecell-restrictions')})))
   ```

   The tool truncates long results: if it does, return the rows in slices (`.slice(0,15)`, `.slice(15,30)`, …). Don't scan every element on the page (`querySelectorAll('*')`): the tool blocks that result as cookie data.
7. **Videos list** `…/videos/upload`: the same fields for every long-form video (the same script works).
8. **Deep dives**: for every public Short with **under 20 views that was published before the last report** (so it has had at least a day), open `https://studio.youtube.com/video/<id>/analytics/tab-overview/period-default` and record: views, the "typical performance" note (e.g. "28 less than usual"), duration (thumbnail label), top traffic source and %, and whether retention data exists. At most 10 deep dives.

9. **Monetization progress** `…/monetization` (the Earn page): the Partner Program progress shown, e.g. subscribers toward 1,000, public watch hours toward 4,000, Shorts views toward 10M, and any notice about eligibility, review or policy.

Return to the main session: the JSON path, and anything you couldn't read.

### JSON schema

```json
{
  "date": "YYYY-MM-DD",
  "captured_at": "YYYY-MM-DD HH:MM PST",
  "gathered_by": "sonnet agent",
  "channel": { "subscribers": 0, "period": "", "views_28d": 0, "watch_hours_28d": 0, "subs_change_28d": 0, "realtime_views_48h": 0 },
  "top_content": [ { "title": "", "date": "", "avd": "", "avd_pct": 0, "views": 0 } ],
  "shorts_summary": { "views_28d": 0, "engaged_views_28d": 0, "likes_28d": 0, "subs_28d": 0, "stayed_pct": 0, "swiped_pct": 0, "traffic_pct": {}, "top": [ { "title": "", "views": "" } ] },
  "videos_summary": { "views_28d": 0, "impressions_28d": 0, "ctr_pct": 0, "avd": "", "traffic_pct": {}, "top": [ { "title": "", "views": "" } ], "still_watching_30s": [ { "title": "", "pct": 0 } ] },
  "shorts": [ { "id": "", "title": "", "visibility": "", "date": "", "views": 0, "comments": 0, "restrictions": "" } ],
  "videos": [ { "id": "", "title": "", "visibility": "", "date": "", "views": 0, "comments": 0 } ],
  "deep_dives": [ { "id": "", "title": "", "views": 0, "typical": "", "duration": "", "top_traffic": "", "retention_data": false } ],
  "monetization": { "subscribers": "", "watch_hours": "", "shorts_views_90d": "", "notices": [] },
  "gaps": [ "anything that couldn't be read" ]
}
```

Numbers as numbers (`1,097` becomes `1097`; `1.2K` stays a string, since it's rounded).

## Analysis (Opus)

Read this run's JSON, **the last report's JSON and `.md` only**. Write `analytics/vidanalysis/<date>.md`:

1. **Header**: the two reports compared, both capture times, and the gap in days and hours. Runs are usually 3–4 days apart (Monday and Thursday), so give every growth figure both as a total over the gap and **per 24 h**.
2. **Channel**: subscribers, 48 h realtime views, and the 28-day totals, this report vs the last, as a small table. The 28-day window slides, so its change is a rough signal, not growth.
3. **Per-video growth**: for each video id in both snapshots, views now minus views then (and per 24 h). Group the Shorts into: **new since the last report** (no comparison yet; give their views and age), **near-zero** (under 20 views total), **ceiling** (about 800–1,300), **past the ceiling** (above 1,300), and anything else. Did ceiling Shorts keep growing or stall? Did any near-zero Short wake up?
4. **Open questions from the last report**: answer each one from its "Open questions for next run", with the numbers: confirmed, ruled out, or still unclear (and why).
5. **Upload volume vs result**: for each full day since the last report, how many Shorts and videos went public, and what share of them reached the ceiling vs stayed near zero. Compare the overall share with the same figure in the last report only.
6. **Monetization denial risk**: score this report with the rubric below, show the factor table next to the last report's scores, and give the rating (and whether it went up, down or held). Then eligibility progress (from the Earn page), this report vs the last. Any policy notice, restriction or "limited" mark on a video goes at the very top of the log, not here.
7. **What to change**: at most 3 concrete suggestions (cadence, same-story spacing, topic, length, retention), each tied to a number above. Say how sure you are. Never suggest anything that breaks CLAUDE.md (facts, licenses, handoffs).
8. **Open questions for next run**: specific, checkable, with the video ids to look at.
9. **Status line**: the last line, `Status: done` (or `Status: stopped: <reason>`).

### Monetization denial risk rubric

YouTube doesn't publish how it reviews channels, so this is a fixed, judgment-based score of how closely the channel matches what its **inauthentic content** policy (mass-produced, templated or repetitive content, often with synthetic voices) and Partner Program reviews look for. It's the risk of being **denied at review** once eligible, not a forecast. Keep the rubric unchanged so reports compare; if it needs changing, say so in the log and re-score the last report too.

Score each factor from **the uploads made public in the full days since the last report** (from its capture day through yesterday). Volume and same-story repeats are per day, so a 4-day gap scores the same way as a 1-day gap:

| Factor | 0 | 1 | 2 |
|---|---|---|---|
| Volume: average uploads made public per day (all formats) | ≤ 6 | 7–10 | > 10 |
| Templating: share of those titles on a repeated formula ("5 Things to Know", "… Update:", "X's Worst Day", same skeleton) | < 20% | 20–40% | > 40% |
| Same-story repeats: the most extra uploads on one story in a single day | 0 | 1 | 2+ |
| Viewer engagement: Shorts "stayed to watch" % | ≥ 55% | 45–55% | < 45% |
| Depth: long-form share | a long video made public in the last 2 days with AVD ≥ 1:30 | a long video in the last 2 days, weaker AVD, or none but one in the last 7 days | no long video in 7 days |
| Synthetic voice with no human presence (on camera, own voice, own commentary) | some human presence | all AI-voiced (current baseline) | — |
| YouTube's own signals: restrictions, "limited", policy or reused-content notices, claims | none | one claim or restriction | any policy / inauthentic / reused-content notice |

Total out of 13. **Low 0–3 · Medium 4–6 · High 7–9 · Very high 10–13.** Name the 1–2 factors driving it and the cheapest one to lower.

Then tell the user the 3–5 findings that matter in plain words, and the path of the log.

Analytics are private: never paste the numbers into anything outside this repo, and never publish the log.
