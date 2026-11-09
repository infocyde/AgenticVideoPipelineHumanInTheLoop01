---
name: grok-imagine-image
description: Make AI stills for a Brief Kit episode, Short or music video with Grok Imagine's Image mode on grok.com, driven in the user's own signed-in browser (their Grok subscription, no API cost), as first, middle or last frames and props for Grok video clips, as on-screen b-roll, or as standalone images; also edits of an existing still that keep its subject (the same scene at night, from closer). Use when the user asks for a Grok image, a Grok still, frames or props for a Grok clip, or an edited version of a still.
---

# Grok Imagine stills

The image side of the **grok-imagine** skill (video clips), chosen for the same reason: the user's Grok subscription
costs nothing per image. One prompt gives four 16:9 stills in about 10 seconds. Look at every result, and don't
generate in bulk without the user's say-so.

The kit's side is `npm run grok -- <slug> still` (import and credit a still) and, for edits,
`npm run pick-file --save` (fill the browser's Save dialog). The browser steps below were tested on 2026-11-07 in
Brave.

## What it's for

- **Keyframes and props for Grok clips.** Make the first frame and, with an edit, a matching last frame (the same
  lighthouse by day, then by night), then attach both in the grok-imagine skill. Make props at the clip's aspect.
- **On-screen stills**, as a fallback when licensed footage is missing or a poor stand-in, on the same terms as
  `npm run generate` (the **generate-image** skill: real licensed footage first).
- **Standalone images** when the user asks for one.

Grok's stills are 1280×720 (edits 1792×1008), filled to 1920×1080 on import. For a hero still that holds full-screen,
or a thumbnail background, `npm run generate -- … --detail high` (FLUX 3) is sharper. Grok is fine for b-roll under the
theme's tint and for keyframes, since the clip comes out at 480p or 720p anyway.

## Rules

- **Every on-screen use carries `"note": "AI-GENERATED ILLUSTRATION"`.** `check` errors without it, and warns about
  YouTube's "altered or synthetic content" box. The still is credited `AI-GENERATED` with its post link and prompt.
- **Same content rules as the generate-image skill:** no real, identifiable people; no fake record of a specific
  event; never recreate a specific photo. Its prompt rules apply too: name the subject's shape, put it on the right
  third when text covers the left, match the theme's light, and end with `No text, no logos, no people.` unless
  people are meant to be there.
- **Attached images (edits)** follow the grok-imagine prop rule: only the channel's own AI stills, earlier Grok frames,
  `OWN WORK`, PD or CC0. Never Grok's built-in characters in the `@` menu.

## Settings

- **Speed, never Quality 2.0** (the user's rule). The switch is the radio group "Image generation speed" next to the
  mode switch.
- **Count ×4** (`Image Count`: Auto, ×2, ×4, ×8, ×12): one generation, four takes to choose from.
- **Aspect** (`Aspect Ratio`): 16:9 for episodes and music videos, 9:16 for Shorts. Pass the same value to `--aspect`.
  Grok remembers count and aspect between visits; check them anyway.
- **Edits are different.** With an image attached, the speed switch and the count disappear (an edit gives one
  image), and the aspect resets to Auto. Set it to 16:9 or 9:16 again (the menu also has 2:3, 3:2, 4:3, 1:1, 21:9
  and 5:2).

## Procedure

0. **Before.** Create `out/slideshow/pause` (remove it at the end). Load the chrome-browser skill and its tools in one
   ToolSearch (tabs_context, tabs_create, navigate, computer, find, javascript_tool, file_upload, browser_batch).
   Start from `tabs_context_mcp` and open a new tab.
1. **Open** `https://grok.com/imagine` and wait about 5 s (it renders blank first). Pick **Image** in the mode switch
   if it isn't selected.
2. **For an edit only, attach the image(s)** with `file_upload`: `find` "the file input inside the prompt form, not
   the template cards". **Never upload to another file input:** the gallery's template cards ("Precise Edit" and the
   like) have their own, and they make posts in the user's library. Then set the aspect again (above).
3. **Read the settings** in one go:
   ```js
   const lab = (l) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === l);
   JSON.stringify({ speed: [...document.querySelectorAll('[role=radio]')].filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.innerText),
     count: lab('Image Count')?.innerText, ar: lab('Aspect Ratio')?.innerText })
   ```
   To change count or aspect, click the button (it opens a menu) and then the item; take a screenshot for its position.
4. **Prompt.** Click the prompt box (`find` "prompt textbox in the prompt form") and type the prompt. For an edit,
   describe what changes and what stays ("The same lighthouse and headland from the same viewpoint, now at night…");
   refer to an attached image as `@Image 1` if there are several.
5. **Submit**: `lab('Submit').click()`. A plain prompt shows its four results in a row on the same page in about
   10 s. An edit opens its post (`grok.com/imagine/post/<id>`) with the one result in about 15 s.
6. **Pick one and open it.** Screenshot the row, choose the best take (rules above), and click it. It opens as
   `grok.com/imagine/post/<id>?scope=asset`. Record the link without the query. `Next post` steps through the others.
7. **Import it into the episode.**
   - **A plain generation** has a public copy, fetched by the command itself:
     ```
     npm run grok -- <slug> still <name> --post <post link> --prompt "<exactly what was typed>" --aspect 16:9
     ```
   - **An edit** has no public copy, and the in-page fetch used for clips answers 403 for images. Use the page's own
     Download button with a Save dialog. Start, in the background:
     ```
     npm run pick-file -- episodes/<slug>/raw/grok/<name>/original.jpg --save --timeout 40
     ```
     then click **Download** in the bottom action bar (`find` "Download button in the bottom action bar next to More
     options"; the side panel's segment list has many other Download buttons). Wait for the `saved …` line, then:
     ```
     npm run grok -- <slug> still <name> --post <post link> --prompt "<exactly what was typed>" --aspect 16:9 --props <attached file>
     ```
     A plain generation saved this way works too: `still` uses `raw/grok/<name>/original.jpg` whenever it's there.

   `still` writes `public/episodes/<slug>/images/<name>.jpg` (16:9 filled to 1920×1080, 9:16 to 1080×1920, other
   shapes kept as they are), keeps Grok's original in `raw/grok/<name>/`, credits it and refreshes `assets.json`.
8. **Look at it** (open the `.jpg`), as in the generate-image skill: real-looking faces, garbled text or symbols,
   logos, a watermark, wrong or anachronistic details, broken symmetry (count wings, fins, wheels), parts that float or
   sink into the ground. Up to three prompts per subject (each gives four takes); if none is right, fall back and tell
   the user. Delete a rejected import's file and credit entry.
9. **Use it.**
   - On screen: `{ "name": "lighthouse_dusk", "cue": "…", "note": "AI-GENERATED ILLUSTRATION" }` (music videos:
     `"visual"`), then `npm run check`.
   - As a clip's keyframe or prop: attach `public/episodes/<slug>/images/<name>.jpg` in step 2 of the grok-imagine
     skill, and list it in that clip's `--props` with its role.
10. **After.** Close your tab, remove `out/slideshow/pause`, log each still (name, post link, prompt, edit source) in
    `notes.md`, and list the AI stills in the handoff with the YouTube "altered or synthetic content" reminder.

Every generation also stays in the user's Grok library (Imagine, then Library). Leave it there.

## When something goes wrong

- **`no public copy (HTTP 404)`:** it was an edit, or Grok didn't publish it. Save it through the Download button
  (step 7).
- **The Save dialog doesn't appear:** a browser only opens dialogs for the tab in front. Click Download again once
  pick-file is waiting; if it still doesn't open, re-run pick-file with a longer `--timeout`.
- **Clicked the wrong thing or the page changed:** re-read the page (`find`, or the button `aria-label`s) before the
  next click; the layout shifts as images attach and the user may scroll.
- **Bot check, captcha, sign-in or a usage limit:** stop and tell the user; never try to get round it.
- Two failed attempts at the same step: stop and ask (chrome-browser skill).
