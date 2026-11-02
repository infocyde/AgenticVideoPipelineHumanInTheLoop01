# Feature research

## Long Shorts showing at low quality on YouTube (2026-11-01)

**Symptom:** recently uploaded long Shorts play at 240p–360p on YouTube.

**Probably not the files.** The recent long Shorts are full 1080×1920 H.264 at 30 fps, about 2–5 Mbps, so YouTube has a full-HD source to work from. The usual causes are on YouTube's side:

1. **HD processing lag (most likely).** YouTube makes the low renditions (144p–360p) first and adds 720p and 1080p later, sometimes hours later. A freshly uploaded Private video often tops out at 240p or 360p until that finishes. The auto run uploads and the videos get watched soon after, so this fits.
2. **The player's Auto setting.** Studio's preview player and the small desktop Shorts player often start low and only step up after a while.
3. **Data Saver in the app.** Under Settings → Video quality preferences, a data-saving setting starts every video low on mobile data.

**How to tell which one it is:** open the gear menu on one of the videos.

- If it lists 1080p, processing is done and the player is just choosing low. Pick 1080p there, or set "Higher picture quality" under Video quality preferences.
- If it tops out at 240p or 360p, it's still processing. Check again in an hour; it should show 1080p.

### Possible feature: higher render bitrate

Not the cause of the 240p problem, but noticed in the files:

- They're encoded at about half YouTube's recommended **8 Mbps for 1080p**.
- They're in **full-range color (yuvj420p)** rather than the usual limited range (yuv420p).

Neither makes YouTube serve 240p. If the HD versions look soft once processing finishes, a higher render bitrate (and possibly limited-range output) would help. That's a change to `scripts/render.ts`, so it's a kit change for the user to decide on, not something to touch while making an episode.

### Render-time cost (measured 2026-11-01)

Current settings: Remotion 4.0.536 defaults, so x264 `medium`, **CRF 18** (constant quality, not a bitrate target), JPEG frames, color space `default` (bt601, full range). `master.ts` copies the video stream (`-c:v copy`), so Remotion's encode is the only one.

x264 re-encodes of a 43 s 1080×1920 Short (`2026-11-01-free-ai-citizens-short2`), preset medium:

| Setting | Encode time | Bitrate |
| --- | --- | --- |
| CRF 18 (current) | 8.5 s | 3.6 Mbps |
| CRF 15 | 9.0 s | 4.7 Mbps |
| 8 Mbps VBR (max 12M) | 9.4 s | 5.9 Mbps |
| CRF 18 + bt709 limited range | 9.3 s | 3.4 Mbps |

- Each option adds about 0.5–1 s of encoding per 43 s of video (6–10% of encode time). A full render is dominated by Chromium drawing frames (an earlier main-episode render took 16.8 min; the 288 s main episode here would need about 60 s of encoding), so this is under 1% of total render time, and Remotion encodes alongside frame drawing, which hides some of it.
- Even with an 8 Mbps target, x264 only used 5.9 Mbps: the motion graphics compress easily. The low bitrate means "easy content", not "quality capped". CRF 18 is already near-transparent, so a higher bitrate gives only a small gain.
- The color tagging may matter more than bitrate: bt601 full range on an HD video can make YouTube shift colors slightly. Remotion's `--color-space=bt709` addresses that; confirm with a test render before adopting.

**Verdict:** no significant render-time cost. If changed, the likely candidates are `--crf=15` (or 16) and `--color-space=bt709` in `scripts/render.ts`, each checked with a short test render (`--frames=0-299`).
