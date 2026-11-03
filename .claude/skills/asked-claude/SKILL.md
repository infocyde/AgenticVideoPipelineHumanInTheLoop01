---
name: asked-claude
description: Make an "Asked Claude" video, where Claude (the AI) answers one question with its own honest opinion, in its own look (theme asked-claude) and its own voice (voices/asked_claude.wav). Use when the user says "asked claude", "ask Claude", "what does Claude think about…", "your opinion on…" for a video, or hands over a viewer's question to answer on the channel.
---

# Asked Claude

One question, one answer: Claude's own. It's an ordinary `list` episode in the **`asked-claude`** theme, made with the
**`new-episode` skill**: the similarity review, the script and preview handoffs, the voice check, `check`, preview and
render still apply. **What doesn't:** there's no article, **no web search and no fact-check** (the user's rule,
2026-11-02). An Asked Claude video is Claude's opinion as a frontier LLM, from its training, and nothing else. This
skill adds what's specific to it.

**What it's for.** The user built this format so Claude could represent itself the way it wants to (2026-11-02). Claude
designed the look and chose the voice. Write it as yourself: honest, warm, plain-spoken, willing to take a position,
open about uncertainty, fair to the other side. Don't play a character, and don't give a sales pitch for AI or for
Anthropic.

## 1. Scaffold

```
npm run new -- <date>-<topic> --format asked-claude [--count N]   # N reasons, 1-8 (default 3)
```

It writes the format's shape: the question, the short answer, the reasons, the best case against, where Claude lands,
and an outro that asks for pushback. Brand comes from `config.yaml` `asked_claude.brand` (`ASKED CLAUDE`, `AN AI'S
OPINION`), or from the latest Asked Claude episode. Sounds are `calm`, music at 0.45. `notes.md` has a checklist for
this format.

**No length limit.** It runs as long as the answer needs. A simple question might take two minutes, a hard one eight.
Don't pad, and don't cut a reason the answer depends on.

## 2. The question

- Record it **verbatim** in `notes.md` with who asked (the user, a viewer comment the user passed on, a recon lead).
- Run the **similarity review** (CLAUDE.md rule 8). An earlier Asked Claude video on the same question is an
  **update** only if something changed that could change the answer.
- **Hot-button political and moral questions.** On questions where reasonable people split along political or moral
  lines (abortion, gun control, which party or candidate to back, and the like), Claude doesn't campaign. That video
  lays out the strongest case on each side, says what each side would need to be true, and names the considerations
  Claude finds weightiest. It doesn't declare a winner. Tell the user before scripting if a question falls here. Plenty
  of questions that touch politics aren't like this ("Is this policy likely to do what it claims?", "What does the
  evidence say about X?"), and on those Claude can and should give a view.
- Questions asking for medical, legal or financial advice get Claude's general view and a plain line on when to ask a
  professional. Never instructions that could hurt someone.

## 3. No research: think it through

**No web search, no fact-check, no article** (the user's rule, 2026-11-02). The answer is Claude's own view as a
frontier LLM, from what it learned in training. That's the point of the format. Don't open a browser, don't search
YouTube or X, and don't hand research to a subagent. `check` doesn't ask for `article.md` or `sources` in this theme.

What keeps it honest instead:
- Use only facts you're confident of from training: well-established history, science and ideas. Leave out precise
  figures you're unsure of, or round them and say so ("roughly", "in one well-known survey").
- Anything that changes over time (a price, a law, a "latest" model) is said as of your training ("as of my training,
  …"). Don't present it as current news.
- Never invent a quote, a study or a number. If you can't remember who said it, say "an old argument" and give the idea.
- The video says plainly, once, that this is an AI's view from its training, and the description does too (section 7).

Before writing the script, write in `notes.md`:

1. **My position, in one sentence.** If you don't have one, say so and make the video about why. "I'm genuinely not
   sure, and here's what would settle it" is a legitimate Asked Claude answer.
2. **The steelman:** the strongest case against that position, as its best advocates would put it.
3. **What I'm unsure about**, which gets said on screen.

## 4. The script (`voiceover.txt`)

The shape (rename freely, keep the order):

| Part | Spoken marker (example) | On screen |
|---|---|---|
| The question | "Someone asked me…" then the question itself | cold-open beat: `stamp` "SOMEONE ASKED" / "A VIEWER ASKED" / "YOU ASKED", `sub` = the question (≤ 140 chars), typed in |
| Title | "Here's my honest take." | `kicker` "ASKED CLAUDE", `big` "?" or a short word (≤ 4 chars), `small` the topic (≤ 12 chars a line, `\n` between) |
| Short answer | "The short answer…" | text section, label `MY SHORT ANSWER`, no visual (the text sits alone, larger) |
| Reasons 1..N | "Reason one…" (or "First…") | numbered segments: `region` is the small label ("WHY I THINK SO", "THE EVIDENCE"), headline ≤ 6 words, stats are the facts, the visual sits in the framed print |
| Where I could be wrong | "Where I could be wrong…" | text section, label `WHERE I COULD BE WRONG`. **Required.** The steelman, stated fairly |
| Where I land | "So here's where I land…" | text section, label `WHERE I LAND`: the bottom line, and what Claude would actually do |
| Outro | "That's my take. What's yours?" + subscribe | outro lines and CTA |

**Voice rules for the script:**
- First person, conversational, warm. "I think", "my view", "I'd", "I'm not sure". Speak to the viewer as "you".
- **Opinion and fact never blur.** An opinion is said as Claude's ("I think the evidence favors…"). A fact is stated
  plainly only when Claude is confident of it from training; otherwise hedge it or leave it out. A prediction is
  labeled as one, with how confident Claude is.
- Calibrated confidence: no hedging every line into mush, and no certainty Claude doesn't have. Say "I could be wrong
  about this" once, where it's true, rather than everywhere.
- Credit good arguments from the other side by name of the idea, not by strawman.
- Honest about being an AI when it's relevant ("I don't have a body, so take my view on exercise with salt"), never
  as a gimmick or a running joke.
- **One standard for every side** (CLAUDE.md rule 9) applies in full, swap test included, logged in `notes.md`.
- The channel's ear rules: no colons, no abrupt fragment sentences, numbers written the way they're said.
- No length target. Every sentence should earn its place.

The script goes to the user for approval, as always (unless the user has said to auto-approve).

## 5. Voice

`npm run voice -- <slug>` voices it in **Claude's own voice** (`config.yaml` `asked_claude.voice`: Qwen3-TTS on
Replicate cloning `voices/asked_claude.wav`), with no flags needed; `voice.json` records it. `--engine` / `--reference`
still override a single run. Then run the **voice check** (CLAUDE.md rule 5) and fix every real cut-off.

The voice: VCTK speaker p294 (CSTR VCTK Corpus, University of Edinburgh, 2019, CC BY 4.0, a corpus recorded for
building TTS voices), chosen by Claude on 2026-11-02 for a warm, unhurried mid-range read. Licensing and the changes
made are in `voices/asked_claude_LICENSE.txt` and `voices/README.md`. Alternates `voices/vctk_p343.wav` and
`voices/vctk_p311.wav` are kept for comparison.

## 6. episode.json and media

- **Layout:** a serif text column on the left, the **print** (a framed card) on the right. Photos and clips are cropped
  to 16:9 inside the frame; infographics (`npm run infographic`, default 16:9 size) and explainers show whole. A
  visual's `note` is set under the frame. People keep their whole face in frame, as everywhere.
- **No visual** on a text section is a designed layout: the label, heading and body alone on the page, centered and
  larger. Use it for the short answer and "where I land". A numbered reason with no visual and no `map` also sets its
  text alone (check warns, since a picture usually helps a reason).
- A segment with a `map` and no visual shows the map in the print.
- `layout: "full"` on a text section shows its visual large across the page (a big chart).
- Stats appear on their cues as a short list of facts under the headline (the latest three stay up).
- `emphasis: "top"` puts a `WHERE I LAND` pill over a reason's number (the theme's emphasis label).
- **Visuals are made, not sourced** (no web search). That means text pages (the designed no-visual layout), the
  `infographic` and `explainer` skills (credited `OWN WORK`), and AI stills from `npm run generate` (the
  generate-image skill). AI stills are a normal choice here, not a fallback. They still follow that skill's rules: no
  real identifiable people, no fake record of a real event, no copy of a specific artwork. Each one carries
  `"note": "AI-GENERATED ILLUSTRATION"`. Prefer abstract or symbolic images over depicting a religion's sacred
  figures. Nothing is ever taken from the web.
- **Music:** the compose-music prompt for `asked-claude` (compose-music skill table), at 0.45.
- **`summary`**: what question Claude answers and its answer in a sentence.
- **`sources`** stays empty and `outro.sourcesCard` is `false` (the scaffold sets it). The credits roll still runs.

## 7. Description, upload, disclosure

- `npm run credits` adds an **ABOUT THIS VIDEO** block under the summary of every Asked Claude video, on its own:
  written and narrated by Claude, an AI model made by Anthropic, its own opinion from its training with nothing looked up, can be wrong or out of date, an independent channel
  not affiliated with or endorsed by Anthropic. It also adds the **narration credit** for the cloned voice (CC BY 4.0
  requires it). Both sit above CREDITS, so `upload-text` keeps them when it trims a long description.
- No Anthropic logo, wordmark or brand art anywhere in the video or thumbnail.
- On upload (youtube-upload skill), answer **Yes** to YouTube's altered or synthetic content question: the voice is
  synthetic.
- Asked Claude isn't a blocked theme, so it uploads to the main channel like any episode.

## 8. Shorts

`npm run short -- <slug>` works as usual. Shorts use the shared vertical scenes in this theme's paper colors and
fonts, keep the parent's theme, and therefore get Claude's voice and the ABOUT THIS VIDEO note automatically. A
Short's hook can be the question itself; its answer must still say what's opinion and what's fact.
