---
name: slideshow
description: Use when the user asks about the idle slideshow or screensaver (start, stop, install, remove, change the folder, idle time, interval or fade, or why it did or didn't show), or before doing desktop automation by hand that a full-screen slideshow could cover. A background PowerShell process (Task Scheduler "BriefKit slideshow", at logon) shows full-screen images from C:\backgrounds after 5 idle minutes, a random image every minute with a crossfade, closes on Esc, any key, a click or a mouse move, and pauses while BriefKit automation runs.
---

# Idle slideshow

A screensaver-style slideshow that never covers the screen while automation is working. Built 2026-11-01.

## What it does

- **Shows** after 5 minutes with no keyboard or mouse input: every screen goes black, the first image fades in, and a new **random** image crossfades in (1.5 s) **every minute**. The folder is shuffled, so nothing repeats until all of it has shown; then it reshuffles and picks up new files.
- **Images:** `C:\backgrounds` (about 1,765 usable: jpg, jpeg, png, bmp, gif, tif), scaled to fit on black, camera orientation honoured. `.webp` and `.heic` are skipped (System.Drawing can't read them).
- **Dims at night:** from midnight until 6:00 AM (local time) each image is drawn at 30% brightness. It's decided per image, so the switch shows within a minute of 00:00 and 06:00.
- **Closes** on Esc, any key, a click, or moving the mouse. It shows again after the next idle stretch.
- **Pauses while automation runs**, so the auto run's browser, file dialogs and screenshots are never covered. It's paused when:
  - another scheduled task named `BriefKit*` is Running (`BriefKit auto long Shorts`, `BriefKit vidanalysis`, and any future one named that way);
  - a run lock holds a live PID (`recon/runs/.lock`, `analytics/vidanalysis/runs/.lock`);
  - the pause file `out/slideshow/pause` exists: empty means paused while it exists; a PID inside means paused while that process lives.
- **Comes back** when automation ends, if it was showing when automation started and the user has been idle at least 30 s.

## Files

- `scripts/slideshow/slideshow.ps1`: the slideshow. Options: `-Folder`, `-IdleMinutes` (5), `-IntervalMinutes` (1), `-FadeSeconds` (1.5), `-DimFromHour` (0), `-DimUntilHour` (6), `-DimBrightness` (0.3; 1 turns dimming off), `-Now` (show at once, for testing).
- `scripts/slideshow/install-slideshow-task.ps1 [-Remove]`: registers the logon task "BriefKit slideshow" (hidden, runs while signed in) and starts it now. Options pass through, e.g. `-IdleMinutes 10`. Re-run it to change settings.
- `out/slideshow/slideshow.log`: started, shown, each image, hidden (and why), paused, resumed, skipped files, errors.

## Installing or changing it

Registering a logon task is persistence, so Claude Code's auto mode blocks Claude from doing it: the user runs it (in this session, type `!` first):

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\slideshow\install-slideshow-task.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\slideshow\install-slideshow-task.ps1 -IdleMinutes 10
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\slideshow\install-slideshow-task.ps1 -Remove
```

A one-off preview (shows now; Esc closes it; stop the process afterwards, or it keeps running until logoff):

```
powershell -NoProfile -ExecutionPolicy Bypass -STA -File scripts\slideshow\slideshow.ps1 -Now
```

## Before desktop automation by hand

Claude in Chrome drives the browser without keyboard or mouse input, so Windows counts the user as idle, and after 5 minutes the slideshow would cover the browser and any Open dialog (`npm run pick-file`). Scheduled runs are covered by the task-name rule. When Claude runs an upload or other screen-driven work in an interactive session, it pauses the slideshow first and removes the pause afterwards:

```
New-Item -ItemType File out\slideshow\pause -Force    # before (or write a PID into it to tie it to a process)
Remove-Item out\slideshow\pause                       # after
```

If the pause file is left behind, the slideshow never shows: check for it first when the user says the slideshow stopped working.
