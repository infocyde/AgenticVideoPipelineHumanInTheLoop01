# Image-model thumbnail prompt

`npm run thumb -- <slug>` renders a crisp, text-accurate thumbnail from the theme. Use this prompt only when the user wants a painted or photographic thumbnail from an image model. Fill it in from `episode.json` and the theme (`src/kit/themes/<theme>.ts`):

```
YouTube thumbnail, 16:9, 1280x720. <mood, e.g. "Dark, urgent"> <topic, e.g. "geopolitics"> news-briefing style.
Background: <map or scene, e.g. "dark world map">, subtle grid and scanlines. Glowing <accent color name> alert pins
over <top 3–4 locations from the segments>, thin <accent> lines connecting them.
Right side: dramatic silhouette of <the #1 story's key subject>, backlit with
<accent glow>; <secondary subject from #2> above. Smoke and haze, cinematic rim lighting,
high contrast.
Left side, huge bold condensed sans-serif text in stacked lines: "<thumbnail.big or coldOpen.title.big>" in <accent> with a soft glow, then "<title word, e.g. FLASHPOINTS>" in off-white. Below it a
<accent> horizontal bar, then smaller white monospace text: "<brand.dateLabel>".
Small "<brand.name>" label with a <accent> dot in the top-left corner.
Color palette: <theme colors with hex, e.g. background #06080b, accent #ff2b3a, highlight #ffb21e, text #f2efe9>. Film grain, vignette, slight glitch/RGB-split
on edges. Bold, readable at small sizes, uncluttered, no extra text.
```

Negative prompt:

```
blurry text, misspelled words, extra words, watermark, logos, flags, real people's faces, cartoon style, bright daylight, cluttered layout
```

Image models often garble dates and small text. Tell the user so. The better route: generate the background **without any text** using the kit's FLUX 3 command (see the generate-image skill), then let the `Thumbnail` composition draw the text:

```
npm run generate -- <slug> thumb_bg --prompt "<the prompt above with the text lines removed>. Subject on the right half, dark empty space on the left. No text, no logos, no flags."
```

Set `"thumbnail": { "visual": "thumb_bg" }` in `episode.json` and run `npm run thumb -- <slug>`. The credit entry and provenance are written automatically.
