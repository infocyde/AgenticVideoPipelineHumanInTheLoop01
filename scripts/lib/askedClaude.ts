// Asked Claude (theme asked-claude): the description's opening note. It says an AI wrote and voiced the opinion, and it
// credits the cloned voice. The voice is CC BY 4.0, so attribution is required, and it sits above CREDITS because
// upload-text drops CREDITS when a description runs long.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

/** Attribution for reference clips cloned from openly licensed voices, by file name (see voices/*_LICENSE.txt). */
export const VOICE_CREDITS: Record<string, string> = {
  "asked_claude.wav":
    "Narration: AI-generated voice (Qwen3-TTS) cloned from VCTK speaker p294, CSTR VCTK Corpus (Junichi Yamagishi, Christophe Veaux, Kirsten MacDonald; University of Edinburgh, 2019), CC BY 4.0, https://doi.org/10.7488/ds/2645 . Modified (excerpt, denoised, level-matched).",
  "vctk_p294.wav":
    "Narration: AI-generated voice (Qwen3-TTS) cloned from VCTK speaker p294, CSTR VCTK Corpus (Junichi Yamagishi, Christophe Veaux, Kirsten MacDonald; University of Edinburgh, 2019), CC BY 4.0, https://doi.org/10.7488/ds/2645 . Modified (excerpt, denoised, level-matched).",
  "vctk_p343.wav":
    "Narration: AI-generated voice (Qwen3-TTS) cloned from VCTK speaker p343, CSTR VCTK Corpus (Junichi Yamagishi, Christophe Veaux, Kirsten MacDonald; University of Edinburgh, 2019), CC BY 4.0, https://doi.org/10.7488/ds/2645 . Modified (excerpt, denoised, level-matched).",
  "vctk_p311.wav":
    "Narration: AI-generated voice (Qwen3-TTS) cloned from VCTK speaker p311, CSTR VCTK Corpus (Junichi Yamagishi, Christophe Veaux, Kirsten MacDonald; University of Edinburgh, 2019), CC BY 4.0, https://doi.org/10.7488/ds/2645 . Modified (excerpt, denoised, level-matched).",
};

export const ASKED_CLAUDE_NOTE =
  "Written and narrated by Claude, an AI model made by Anthropic, giving its own opinion because this channel asked. It answers from what it learned in training, without looking anything up, so it can be wrong or out of date. An independent channel, not affiliated with or endorsed by Anthropic.";

/** The reference clip an episode was voiced with (episodes/<slug>/voice.json), or "" if none. */
export const voiceReference = (srcDir: string): string => {
  const f = join(srcDir, "voice.json");
  if (!existsSync(f)) return "";
  try {
    return String((JSON.parse(readFileSync(f, "utf8")) as { reference?: string | null }).reference ?? "");
  } catch {
    return "";
  }
};

/** The block under the summary: the AI note for Asked Claude videos, and the voice credit for any credited clone. */
export const aboutBlock = (theme: string, srcDir: string): string => {
  const ref = voiceReference(srcDir);
  const voice = ref ? VOICE_CREDITS[basename(ref)] : undefined;
  const lines = [...(theme === "asked-claude" ? [ASKED_CLAUDE_NOTE] : []), ...(voice ? [voice] : [])];
  return lines.length ? `ABOUT THIS VIDEO\n${lines.join("\n")}\n\n` : "";
};
