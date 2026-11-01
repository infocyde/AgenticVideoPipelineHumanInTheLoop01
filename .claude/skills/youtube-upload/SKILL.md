---
name: youtube-upload
description: Upload a rendered Brief Kit episode and its Shorts to the user's YouTube channel through YouTube Studio in the user's own signed-in Chrome (Claude in Chrome), as Private by default, main video first so each Short's description links to it. Use when the user asks to post, upload or publish videos to YouTube, or after render when they say to put them up.
---

# YouTube upload

The last step of an episode (new-episode step 7b), only when the user asks. You drive YouTube Studio in the user's own
Chrome, signed in to their channel. You do the whole upload, picking each video file too, with `npm run pick-file`.

**How the file gets in:** the Claude in Chrome `file_upload` tool sends files over the browser bridge and is capped at
10 MB per call, and rendered videos are far bigger, so don't use it for videos. Instead, `npm run pick-file` (Windows,
`scripts/pick_file.py`, pywinauto in `.venv`) brings the Studio tab to the front, waits for the browser's own Open
dialog, types the file's full path into it and presses Open by UI Automation (the mouse doesn't move), so the browser
reads the file straight from disk at any size. Two things learned testing it (2026-10-31, in Brave): the browser only
opens a file chooser for the tab in front, which is why `--tab` brings it forward first; and switching back to the
user's tab the moment the dialog closes loses the file, so the script waits 2 s before switching back. If it fails
twice, fall back to asking the user to drag the file in. The YouTube Data API was the other option discussed and
declined on 2026-10-29.

## Before you start

1. The renders are approved and done: `out/<slug>/youtube.mp4`, and `out/<parent>/short<N>.mp4` (the same file as
   `out/<short>/youtube.mp4`) for each Short.
2. `npm run credits -- <slug>` for the episode and each Short (it regenerates DESCRIPTION.md).
3. `npm run upload-text -- <slug>`: writes `out/<slug>/upload.json` with the title and a description YouTube accepts
   (≤ 5,000 characters, no angle brackets). Episodes keep summary, chapters, sources and credits when they fit.
   **When the text is too long, the credits go first** (the user's rule, 2026-10-31, project-wide): they're replaced by
   one line pointing to the video's credits roll, which has the full list. If it is still too long, the sources shrink
   to "Outlet (date): link" while they fit, with the rest named on one "Also:" line (the video's sources card has every
   title). **Shorts** (episodic, standalone and long; the user's rule, 2026-10-31) keep summary, sources and credits
   when they fit; when they don't, **the credits are dropped whole**, with no pointer line (a Short has no credits
   roll), and only then do the sources shrink the same way. Episodic Shorts also get the parent's link once it's
   recorded; standalone Shorts have no "Full video" line. If you paste a description by hand, follow the same order:
   cut the credits before anything else. A line you add by hand (e.g. a disclosure) goes in `upload.json` after
   `upload-text`, which rewrites the description each time.
4. Settings, unless the user says otherwise: **Private** (the user's default since 2026-10-31; it was Unlisted before); **No, it's not made for kids**; **AI use: Yes** when the
   video has a cloned or synthetic voice, AI stills or AI music (the kit's TTS voices are clones, so nearly always);
   **Paid promotion: No** on every upload (the user's standing rule, 2026-10-31); no thumbnail (the user makes and
   adds their own); no playlist.

## Procedure (Claude in Chrome)

Load the chrome-browser skill and the tools in one ToolSearch (tabs_context, tabs_create/close, navigate, computer,
find, javascript_tool). Start from `tabs_context_mcp`, work in the group's own tab.

1. **Main video first.** Open `https://studio.youtube.com` and click the upload icon (top right). Then pick the file:
   - Start `npm run pick-file -- out/<slug>/youtube.mp4 --tab "<start of the Studio tab's title>"` **in the
     background** (e.g. `--tab "Channel content - YouTube Studio"`, or whatever the tab is titled; the tab strip shows
     the page's `<title>`). Wait for its line `… tab is in front; click the page's file button now`.
   - Click **Select files** in the "Upload videos" dialog with `computer` (take a screenshot for its position; page
     coordinates from JavaScript don't match the screenshot's). The script fills the Open dialog and switches back to
     the user's tab after 2 s; the upload keeps going in the background tab.
   - Confirm it started: the dialog moves on to *Details* with the filename as title (`find` or a screenshot). If the
     script ends with "no browser Open dialog appeared", the click missed or the tab wasn't in front; retry once.
2. Read the **video link** in the dialog (`find`: "video link URL"). Record it: `npm run upload-text -- <slug> --url <link>`.
3. Fill **title and description** with one `javascript_tool` call (typing 5,000 characters key by key is slow):
   ```js
   const boxes = [...document.querySelectorAll('ytcp-uploads-dialog #textbox')];
   const g = (p) => boxes.find((b) => (b.getAttribute('aria-label') || '').startsWith(p));
   const set = (b, v) => { b.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, v); };
   set(g('Add a title'), TITLE); set(g('Tell viewers'), DESCRIPTION);
   ({ title: g('Add a title').innerText, descLen: g('Tell viewers').innerText.length })
   ```
   Paste TITLE and DESCRIPTION from `upload.json` as JSON string literals. Check the returned lengths.
4. Click **"No, it's not made for kids"**, then **Show advanced settings** (labelled "Show more"), then
   **"Yes, AI was used"** under *AI use* when it applies (the radio's text is just "Yes"; match its aria-label), and
   **"No, my video doesn't include paid promotion"** under *Paid promotion*, every time. Both radios only render after
   "Show more", so on a reopened draft check them on `/video/<id>/edit` instead of in the dialog.
5. **Next** three times to *Visibility*, choose **Private**.
6. **Copyright checks.** If the footer still says "Checking …", don't save: Studio warns that publishing before checks
   finish can bring a strike. Close the dialog (it keeps everything as a draft) and carry on with the next upload.
   When the footer says **"Checks complete. No issues found."**, click **Save**, then close the "Video published"
   dialog. If checks find an issue (a Content ID claim, a restriction), stop and show the user before saving.
7. **Each Short**: `npm run upload-text -- <short>` again (now it fills the parent's link), open a new upload dialog,
   pick `out/<parent>/short<N>.mp4` the same way (`npm run pick-file` in the background, then Select files), confirm it's the right one by the preview length (`find`: "video
   preview duration text") against the render, then steps 2–6. A Short's link is `youtube.com/shorts/<id>`.
8. **Drafts**: Content → Videos (or Shorts) → **Edit draft** on the row reopens the dialog with its details. Check the
   title, description and audience are intact (read them back with `javascript_tool`), go to *Visibility* (stepper
   tab), Private, Save once checks are complete.
9. **Verify** in Content → Videos and Shorts that every upload shows **Private** with the right title. Close the tab.

## After

- Log in the episode's `notes.md` under "YouTube": the links, the settings used, anything that waited for checks.
- Tell the user the links, that they're Private (the Shorts' links to the main video work for viewers only once it's Unlisted or Public), and that the AI-use box was ticked (and why).
- Publishing (Unlisted or Public, scheduling, end screens, cards, thumbnails) stays the user's call unless they ask.

## Limits

- Never upload anything the user didn't ask for, and never change other videos on the channel.
- Never click "Publish anyway" past the checks warning without the user's say-so.
- A YouTube description holds 5,000 characters and rejects `<` and `>`; `upload-text` handles both (credits
  dropped first, then sources shortened) and warns if it still can't fit. A title holds 100 characters.
- If the extension or Studio stops responding after two or three tries, stop and tell the user what's done.
