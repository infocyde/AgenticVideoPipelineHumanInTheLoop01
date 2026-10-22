"""Refine lyric word times with forced alignment (torchaudio MMS_FA) on the vocal stem (npm run lyrics; music videos).

Whisper's word times on singing drift; a forced aligner given the known words places each one on the audio directly.
The song is cut into chunks of whole lyric lines (≤ 30 s by their coarse times, padded 1 s each side) so the
model's attention fits in GPU memory; each chunk is aligned on its own. Lines Whisper didn't hear have only guessed
coarse times, so a chunk's audio window also reaches back to the last heard word before it and on to the first heard
word after it (up to MAX_WINDOW s): the aligner then finds the unheard lines wherever they were sung in that gap.
A chunk that fails keeps its coarse times.
Runs in .venv-music (torch + torchaudio 2.7.1).

Usage: .venv-music/Scripts/python -I scripts/lyrics_fa.py <vocals.wav> <in.json> <out.json> [device]
  in.json:  {"words": [{"word", "start", "end", "line", "heard"}]}   (coarse times from npm run lyrics; heard = Whisper matched it)
  out.json: {"words": [{"start", "end"}], "chunks": [{"from", "to", "ok", "reason"?}]}
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import soundfile as sf
import torch
import torchaudio

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I leaves the script's folder off sys.path
SR = 16000
MAX_CHUNK = 30.0
MAX_WINDOW = 75.0
PAD = 1.0

ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
        "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]


def say(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + (ONES[n % 10] if n % 10 else "")
    if n < 1000:
        return ONES[n // 100] + "hundred" + (say(n % 100) if n % 100 else "")
    return ""


def romanize(word: str) -> str:
    """The aligner's alphabet is a-z and the apostrophe; digits are spelled out ('2' -> 'two')."""
    w = unicodedata.normalize("NFD", word.lower())
    w = "".join(c for c in w if not unicodedata.combining(c)).replace("’", "'")
    w = re.sub(r"\d+", lambda m: say(int(m.group())) if len(m.group()) <= 3 else "", w)
    return re.sub(r"[^a-z']", "", w).strip("'")


def chunks(words: list[dict]) -> list[tuple[int, int]]:
    """[from, to) word ranges of whole lines whose padded coarse span is ≤ MAX_CHUNK seconds."""
    lines: list[tuple[int, int]] = []
    for i, w in enumerate(words):
        if lines and words[lines[-1][0]]["line"] == w["line"]:
            lines[-1] = (lines[-1][0], i + 1)
        else:
            lines.append((i, i + 1))
    out: list[tuple[int, int]] = []
    for f, t in lines:
        if out and words[t - 1]["end"] + PAD - (words[out[-1][0]]["start"] - PAD) <= MAX_CHUNK:
            out[-1] = (out[-1][0], t)
        else:
            out.append((f, t))
    return out


def main() -> None:
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    vocals, inp, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    device = sys.argv[4] if len(sys.argv) > 4 else ("cuda" if torch.cuda.is_available() else "cpu")
    words = json.loads(inp.read_text(encoding="utf-8"))["words"]

    data, sr = sf.read(str(vocals), dtype="float32", always_2d=True)
    wave = torchaudio.functional.resample(torch.from_numpy(data.mean(axis=1)), sr, SR)
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model(with_star=False).to(device).eval()
    tokenizer, aligner = bundle.get_tokenizer(), bundle.get_aligner()

    times = [[w["start"], w["end"]] for w in words]
    report = []
    prev_end = 0.0  # chunks don't reach back over words the previous chunk already placed
    for f, t in chunks(words):
        lo = max(0.0, words[f]["start"] - PAD)
        hi = min(wave.numel() / SR, words[t - 1]["end"] + PAD)
        if not all(w.get("heard") for w in words[f:t]):
            before = [w["end"] for w in words[:f] if w.get("heard")]
            after = [w["start"] for w in words[t:] if w.get("heard")]
            wide = (min(lo, before[-1]) if before else 0.0, max(hi, after[0]) if after else wave.numel() / SR)
            if wide[1] - wide[0] <= MAX_WINDOW:
                lo, hi = wide
        if hi - max(lo, prev_end) >= 1.0:
            lo = max(lo, prev_end)
        idx = [k for k in range(f, t) if romanize(words[k]["word"])]
        try:
            if not idx:
                raise ValueError("no alignable words")
            seg = wave[int(lo * SR):int(hi * SR)].unsqueeze(0).to(device)
            with torch.inference_mode():
                emission, _ = model(seg)
            spans = aligner(emission[0], tokenizer([romanize(words[k]["word"]) for k in idx]))
            sec = seg.size(1) / emission.size(1) / SR
            for k, sp in zip(idx, spans):
                times[k] = [round(lo + sp[0].start * sec, 3), round(lo + sp[-1].end * sec, 3)]
            report.append({"from": f, "to": t, "ok": True})
            prev_end = max(times[k][1] for k in idx)
        except Exception as e:  # noqa: BLE001 — any failure keeps this chunk's coarse times
            if device == "cuda":
                torch.cuda.empty_cache()
            report.append({"from": f, "to": t, "ok": False, "reason": f"{type(e).__name__}: {e}"[:200]})

    out.write_text(json.dumps({"words": [{"start": s, "end": e} for s, e in times], "chunks": report}), encoding="utf-8")
    bad = [c for c in report if not c["ok"]]
    print(f"forced alignment: {len(report) - len(bad)}/{len(report)} chunks aligned on {device}", flush=True)


if __name__ == "__main__":
    main()
