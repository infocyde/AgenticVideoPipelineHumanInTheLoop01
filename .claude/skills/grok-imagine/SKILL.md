---
name: grok-imagine
description: Make AI video clips for a Brief Kit episode, Short or music video with Grok Imagine on grok.com, driven in the user's own signed-in browser (their Grok subscription, no API cost), from up to four images as props (first frame, middle frame, last frame, loop or reference), then save the clip into the episode, credit it, and grab its first and last frames to start or continue the next clip. Use when the user asks for Grok, Grok Imagine, an AI video clip, an animated still, image-to-video, or a shot chained from the last one.
---

# Grok Imagine video clips

The user chose this over a paid API for cost (2026-11-07): it drives grok.com/imagine in their own browser with
their Grok account. It is clunky by design. Work one clip at a time, look at every result, and never generate in
bulk without the user's say-so.

The kit's side is two commands: `npm run grok` (import a saved clip, grab its frames) and `npm run pick-file --save`
(fill the browser's Save dialog). The rest is the browser procedure below, tested on 2026-11-07 in Brave.

## Rules

- **AI footage is labelled.** Every shot that uses a Grok clip carries `"note": "AI-GENERATED FOOTAGE"`; `check` errors
  without it, and warns about YouTube's "altered or synthetic content" box. The clip is credited `AI-GENERATED` with
  its post link and prompt (`npm run grok -- … import`).
- **Same content rules as AI stills** (the generate-image skill): no real, identifiable people; no staged "record" of a
  specific real event; never feed in or recreate a specific photo you don't have rights to. Juxtaposition is fine.
- **Props are images the channel may build on:** the episode's own AI stills (`npm run generate`, or Grok stills made
  for the purpose with the **grok-imagine-image** skill, including an edit as a matching last frame), frames from earlier
  Grok clips (`raw/grok/<name>/first.png`, `last.png`), `OWN WORK`, PD or CC0. Not CC BY / CC BY-SA, stock, press, X
  posts or YouTube stills: Grok's output would be a derivative we can't credit or license properly.
- **Never use Grok's built-in characters** (the `@` menu lists names such as Gustav, Fox, Lena, Michael under the
  attached images). Only `Image 1`… `Image 4`.

## Settings (every clip)

- **Speed, never Quality** (the user's rule, 2026-11-07). The Speed/Quality switch shows in Image mode; Video mode had
  none on 2026-11-07. If one appears there, pick Speed.
- **Resolution: ask the user, 480p or 720p.** In full auto (no one to ask), use **480p**. (480p at 16:9 comes out
  752×416; 720p 1280×720. 1080p is offered only with no images or keyframes only; don't use it.)
- **Length** 6, 10 or 15 s; pick the shortest that covers the shot.
- **Aspect** 16:9 for episodes and music videos, 9:16 for Shorts. With a first frame alone the clip takes the image's
  shape, so make props at the video's aspect.
- **Sound off** (`Video audio`). It resets to on with every new page; the import strips audio anyway. The exception
  is a lyric clip in a music video (below): sound on.
- **Enhance prompt** (the wand) stays off, so the recorded prompt is what Grok got.

Resolution and length persist between visits; sound doesn't. Read all of them before submitting (step 4).

## What the props do (tested 2026-11-07)

Each attached image has a role, set from its thumbnail's menu: **First frame**, **Intermediate frame**, **Last frame**,
**Loop** (starts and ends the video) or **Reference** (guides it). Images attached together all start as Reference.

- **Keyframes are pinned.** A first or last frame comes out as the image itself, so the last frame of one clip used as
  the first frame of the next gives a seamless cut. This is how to chain shots.
- **References only guide.** Two references gave a redrawn version of Image 1 at the start and an ending unlike
  Image 2. Use references for the look of a subject or scene, never for an exact frame.
- Keyframes and references can be mixed: up to four images in total, at most one first and one last frame.

## Music videos: lyric blurbs (the user's idea, 2026-11-07; not yet tested on Grok)

Grok takes no audio upload, so it can't lip-sync to the song. To get clips that roughly move with the music
anyway, **sometimes** put a lyric blurb in the prompt: a character sings the line, and in the edit the clip is placed
so the mouthing lands on that line in the song.

- **When.** On a few strong lines (the hook, a chorus's first line, a line the shot plan gives a performer), about one
  Grok clip in four or five. The rest stay b-roll that illustrates the lyric. Mark these shots in the shot plan.
- **Who sings.** A made-up character from a Grok still or the channel's own AI still (first frame), never a real,
  identifiable person, the user's band included, unless the user hands over their own photos as `OWN WORK` and asks
  for it. Frame the face fully, front or three-quarter, close enough to read the mouth (the faces rule in CLAUDE.md).
- **The prompt.** One line, 10 words or fewer, quoted exactly as sung, with how it's sung:
  `She sings "Ride the biggest waves" with passion, close-up, mouth clearly forming the words, gentle push-in. No text.`
  Ask for 6 s (a line is about 3–4 s). The song's words are the user's own, so quoting them is fine.
- **Sound on** for these clips (`Video audio` pressed), so Grok voices the line and, most likely, moves the mouth to
  it. The import still strips the audio from the episode's copy; `raw/grok/<name>/original.mp4` keeps it.
- **Line it up.** Find where Grok starts singing in the raw file:
  ```
  ffmpeg -i episodes/<slug>/raw/grok/<name>/original.mp4 -af silencedetect=noise=-35dB:d=0.3 -f null - 2>&1 | grep silence_end
  ```
  The first `silence_end` is the onset. Use it as the shot's `in` (seconds into the clip) and cue the shot on the
  line's first sung word, so both start together:
  `{ "visual": "singer_waves", "cue": "Ride the biggest", "in": 0.8, "note": "AI-GENERATED FOOTAGE" }`.
  Check it in the preview with sound. If the mouth runs ahead or behind, nudge `in` by 0.1–0.2 s. Grok won't match
  the song's tempo exactly, so keep these shots to the one line and cut away on the next.
- **First time:** try one lyric clip and tell the user how well the mouth follows the line before using the approach
  across a video. Note the result here.

## Procedure

0. **Before.** Create `out/slideshow/pause` (remove it at the end). Load the chrome-browser skill and its tools in one
   ToolSearch (tabs_context, tabs_create, navigate, computer, find, javascript_tool, file_upload). Start from
   `tabs_context_mcp` and open a new tab.
1. **Open** `https://grok.com/imagine`, wait ~5 s (it renders blank first), and pick **Video** in the mode switch
   (`[role=radio]` "Video").
2. **Attach the props** with `file_upload` (no file dialog; under 10 MB per call): `find` "the file input inside the
   prompt form (the form with the 'Ask Grok anything' textbox), not the template cards", then upload up to four paths
   in one call. **Never upload to another file input:** the others belong to the gallery's template cards ("Precise
   Edit" and the like) and open the image editor, which saves an image post in the user's library.
3. **Set roles.** Click each thumbnail (screenshot for its position, or `javascript_tool` for the `form img`
   positions), then pick the role in its menu (`find` "'Last frame' option in the open image role menu" and click by
   ref). A keyframe moves into the strip `first > middle > last`; its tag (`Image 1`) is put into the prompt.
   A single attached image becomes the first frame by itself.
4. **Settings.** Read them in one go:
   ```js
   const lab = (l) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === l);
   JSON.stringify({ audio: lab('Video audio')?.getAttribute('aria-pressed'), res: lab('Video resolution')?.innerText,
     dur: lab('Video duration')?.innerText, ar: lab('Aspect Ratio')?.innerText })
   ```
   `audio: "true"` means sound is on: `lab('Video audio').click()`. Change resolution, length or aspect by clicking the
   button (it opens a menu) and then the item; take a screenshot for the item's position. Re-read after changing.
5. **Prompt.** Put the caret at the end of the prompt (the role tags are already there), then type:
   ```js
   const t = document.querySelector('form [contenteditable=true]'); t.focus();
   const r = document.createRange(); r.selectNodeContents(t); r.collapse(false);
   getSelection().removeAllRanges(); getSelection().addRange(r);
   ```
   Describe the motion and camera, not the picture (the images carry it). End with `No text.` and, unless people are
   meant to be there, `No people.` (Grok added a figure to an empty wave once). Refer to references as `@Image 2`
   (type `@`, pick from the menu).
6. **Submit**: `lab('Submit').click()` (the arrow button). The page moves to `grok.com/imagine/post/<id>`. Record that
   link. It takes about 30 s at 480p with keyframes, 60–90 s with references. Poll with
   `document.body.innerText.match(/Generating\s*\d+%/)`; it's done when that's gone and the post's `<video>` has a size.
7. **Save it into the episode.** Start, in the background:
   ```
   npm run pick-file -- episodes/<slug>/raw/grok/<name>/original.mp4 --save --timeout 40
   ```
   then download the post's video through the page (the user's browser asks where to save every file, so a Save dialog
   opens and pick-file fills it; the file never touches Downloads; the direct link answers 403 without the login):
   ```js
   const id = location.pathname.split('/').pop();
   const v = [...document.querySelectorAll('video')].find((x) => (x.currentSrc || x.src).includes(id));
   const r = await fetch(v.currentSrc || v.src, { credentials: 'include' }); const b = await r.blob();
   const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `grok-${id}.mp4`;
   document.body.appendChild(a); a.click(); a.remove(); JSON.stringify({ status: r.status, size: b.size })
   ```
   Wait for pick-file's `saved …` line. (The page's own Download button opens the same Save dialog, so it works too.)
8. **Import and look.**
   ```
   npm run grok -- <slug> import <name> --post <post link> --prompt "<exactly what was typed>" --resolution 480p --props first:<file>,ref:<file>,last:<file>
   npm run grok -- <slug> frames <name>
   ```
   `import` copies the picture as it is (no re-encode, no upscale; the upscaler is a later step) without audio to
   `public/episodes/<slug>/clips/<name>.mp4`, credits it and refreshes `assets.json`. `frames` writes
   `raw/grok/<name>/first.png` and `last.png`. **Look** at a few frames (a contact sheet in `work/`): extra people or
   figures, warped hands or faces, garbled text or logos, a watermark, physics that breaks. If it's wrong, regenerate
   (the post's **Regenerate**, or a better prompt) and save it under a new name; delete the failed clip and its credit.
9. **Chain the next shot** from `raw/grok/<name>/last.png` as the next clip's **First frame**, so the cut is seamless.
   Its new props can add a last frame or references.
10. **Use it** with the note:
    ```json
    { "visual": "wave_rise", "cue": "I jump", "note": "AI-GENERATED FOOTAGE" }
    ```
    (news episodes: `{ "name": "wave_rise", "cue": "…", "note": "AI-GENERATED FOOTAGE" }`). Then `npm run check`.
11. **After.** Close your tab, remove `out/slideshow/pause`, log each clip (name, post link, props, resolution) in
    `notes.md`, and list the AI clips in the handoff with the YouTube "altered or synthetic content" reminder.

## When something goes wrong

- **No Open dialog, or a click does nothing:** a browser only opens a file chooser for the tab in front. Prefer
  `file_upload` plus roles (no dialog). If you need a frame slot's own button ("Add last frame"), run
  `npm run pick-file -- <image> --tab "Grok Imagine"` in the background first, so the tab comes to the front.
- **Clicked the wrong thing / page changed:** re-read the page (`javascript_tool` for the `form` buttons and their
  `aria-label`s) before the next click; the layout shifts as images are attached and the user may scroll.
- **Bot check, captcha, sign-in or a usage limit:** stop and tell the user; never try to get round it.
- Two failed attempts at the same step: stop and ask (chrome-browser skill).
