---
name: youtube-upload
description: Upload a rendered Brief Kit episode and its Shorts to the user's YouTube channel through YouTube Studio in the user's own signed-in Chrome (Claude in Chrome), as Unlisted by default, main video first so each Short's description links to it. Use when the user asks to post, upload or publish videos to YouTube, or after render when they say to put them up.
---

# YouTube upload

The last step of an episode (new-episode step 7b), only when the user asks. You drive YouTube Studio in the user's own
Chrome, signed in to their channel. The user drags each video file into Studio's upload dialog; you do everything else.

**Why the user drags the file:** the Claude in Chrome `file_upload` tool sends files over the browser bridge and is
capped at 10 MB per call, and rendered videos are far bigger. Don't look for a way around that cap. The YouTube Data
API isn't the answer either: uploads from an unaudited API project are locked to Private, so they can't be made
Unlisted or Public afterwards (checked with the user on 2026-10-29; they chose this browser flow).

## Before you start

1. The renders are approved and done: `out/<slug>/youtube.mp4`, and `out/<parent>/short<N>.mp4` (the same file as
   `out/<short>/youtube.mp4`) for each Short.
2. `npm run credits -- <slug>` for the episode and each Short (it regenerates DESCRIPTION.md).
3. `npm run upload-text -- <slug>`: writes `out/<slug>/upload.json` with the title and a description YouTube accepts
   (≤ 5,000 characters, no angle brackets). Episodes keep summary, chapters and sources, and compact the credits to
   "author, license" when the full list doesn't fit (the full list is in the video's credits roll). Shorts drop the
   credits (the user's choice) and get the parent's link once it's recorded.
4. Settings, unless the user says otherwise: **Unlisted**; **No, it's not made for kids**; **AI use: Yes** when the
   video has a cloned or synthetic voice, AI stills or AI music (the kit's TTS voices are clones, so nearly always);
   no thumbnail (the user makes their own from `THUMBNAIL-PROMPT.md`); no playlist.

## Procedure (Claude in Chrome)

Load the chrome-browser skill and the tools in one ToolSearch (tabs_context, tabs_create/close, navigate, computer,
find, javascript_tool). Start from `tabs_context_mcp`, work in the group's own tab.

1. **Main video first.** Open `https://studio.youtube.com`, click the upload icon (top right), and ask the user to
   drag `out/<slug>/youtube.mp4` into the "Upload videos" dialog. Wait for them to say it started.
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
   **"Yes, AI was used"** under *AI use* when it applies.
5. **Next** three times to *Visibility*, choose **Unlisted**.
6. **Copyright checks.** If the footer still says "Checking …", don't save: Studio warns that publishing before checks
   finish can bring a strike. Close the dialog (it keeps everything as a draft) and carry on with the next upload.
   When the footer says **"Checks complete. No issues found."**, click **Save**, then close the "Video published"
   dialog. If checks find an issue (a Content ID claim, a restriction), stop and show the user before saving.
7. **Each Short**: `npm run upload-text -- <short>` again (now it fills the parent's link), open a new upload dialog,
   ask the user to drag `out/<parent>/short<N>.mp4`, confirm it's the right one by the preview length (`find`: "video
   preview duration text") against the render, then steps 2–6. A Short's link is `youtube.com/shorts/<id>`.
8. **Drafts**: Content → Videos (or Shorts) → **Edit draft** on the row reopens the dialog with its details. Check the
   title, description and audience are intact (read them back with `javascript_tool`), go to *Visibility* (stepper
   tab), Unlisted, Save once checks are complete.
9. **Verify** in Content → Videos and Shorts that every upload shows **Unlisted** with the right title. Close the tab.

## After

- Log in the episode's `notes.md` under "YouTube": the links, the settings used, anything that waited for checks.
- Tell the user the links, that they're Unlisted, and that the AI-use box was ticked (and why).
- Publishing (Public, scheduling, end screens, cards, thumbnails) stays the user's call unless they ask.

## Limits

- Never upload anything the user didn't ask for, and never change other videos on the channel.
- Never click "Publish anyway" past the checks warning without the user's say-so.
- A YouTube description holds 5,000 characters and rejects `<` and `>`; `upload-text` handles both and warns if it
  can't fit. A title holds 100 characters.
- If the extension or Studio stops responding after two or three tries, stop and tell the user what's done.
