"""Align the voiceover script's own words to the recorded audio.

Whisper transcribes the audio with word timestamps; the script words are then matched to that
transcript with difflib, so captions keep the script's exact spelling. Unmatched script words get
times interpolated between matched neighbours.

Lessons carried over from the first episode:
- Never pass the script as `initial_prompt`: Whisper hallucinated ~30s of text. Transcribe plainly
  with condition_on_previous_text=False and vad_filter=True, then align.
- Decode audio with ffmpeg into numpy (PyAV's av.open crashed on this machine).
- CPU int8 by default (CUDA failed with a missing cublas64_12.dll); ~3 min for 2:17 of audio.

Usage (normally via `npm run align -- <slug>`):
  .venv/Scripts/python scripts/align.py <audio> <voiceover.txt> <timing.json out> <heard.txt out> [model] [device]
"""
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
ORD = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth", "nine": "ninth",
       "twelve": "twelfth", "twenty": "twentieth", "thirty": "thirtieth", "forty": "fortieth", "fifty": "fiftieth",
       "sixty": "sixtieth", "seventy": "seventieth", "eighty": "eightieth", "ninety": "ninetieth"}


def say(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + (ONES[n % 10] if n % 10 else "")
    if n < 1000:
        return ONES[n // 100] + "hundred" + (say(n % 100) if n % 100 else "")
    return str(n)


def ordinal(n: int) -> str:
    w = say(n)
    for k, v in ORD.items():
        if w.endswith(k):
            return w[: -len(k)] + v
    return w + "th"


def norm(w: str) -> str:
    w = unicodedata.normalize("NFD", w.lower())
    w = "".join(c for c in w if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", w)


def expand(token: str) -> list[str]:
    """Normalize one Whisper token; digits become words so they match a spelled-out script."""
    t = token.strip().lower()
    pct = t.endswith("%")
    m = re.fullmatch(r"(\d{1,3})(st|nd|rd|th)?%?[.,!?]*", t.replace(",", ""))
    if m:
        n = int(m.group(1))
        out = [ordinal(n) if m.group(2) else say(n)]
        return out + (["percent"] if pct else [])
    w = norm(t)
    return [w] if w else []


def load_audio(path: Path) -> np.ndarray:
    """Decode to 16 kHz mono float32 via ffmpeg."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def transcribe(samples: np.ndarray, model_name: str, device: str):
    model = WhisperModel(model_name, device=device, compute_type="int8" if device == "cpu" else "float16")
    segments, info = model.transcribe(
        samples, word_timestamps=True, condition_on_previous_text=False, vad_filter=True
    )
    heard, lines = [], []
    for seg in segments:
        lines.append(seg.text.strip())
        for w in seg.words:
            parts = expand(w.word)
            if not parts:
                continue
            step = (w.end - w.start) / len(parts)
            for k, p in enumerate(parts):
                heard.append({"w": p, "start": w.start + k * step, "end": w.start + (k + 1) * step})
    return heard, lines, float(info.duration)


def align(script_words: list[str], heard: list[dict], duration: float):
    a = [norm(w) for w in script_words]
    b = [h["w"] for h in heard]
    times: list[tuple[float, float] | None] = [None] * len(a)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            h = heard[blk.b + k]
            times[blk.a + k] = (h["start"], h["end"])
    matched = sum(t is not None for t in times)

    # Interpolate gaps between matched anchors.
    i = 0
    while i < len(times):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(times) and times[j] is None:
            j += 1
        lo = times[i - 1][1] if i > 0 else 0.0
        hi = times[j][0] if j < len(times) else duration
        step = (hi - lo) / (j - i)
        for k in range(i, j):
            times[k] = (lo + step * (k - i), lo + step * (k - i + 1))
        i = j

    words = [{"word": w, "start": round(t[0], 3), "end": round(t[1], 3)} for w, t in zip(script_words, times)]
    return words, matched


def main() -> None:
    if len(sys.argv) < 5:
        sys.exit(__doc__)
    audio, script, out, heard_out = map(Path, sys.argv[1:5])
    model_name = sys.argv[5] if len(sys.argv) > 5 else "medium.en"
    device = sys.argv[6] if len(sys.argv) > 6 else "cpu"

    script_words = script.read_text(encoding="utf-8").split()
    print(f"transcribing {audio.name} with {model_name} on {device} (a few minutes on CPU)...", flush=True)
    heard, lines, duration = transcribe(load_audio(audio), model_name, device)
    words, matched = align(script_words, heard, duration)

    heard_out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    out.write_text(json.dumps({
        "duration": round(duration, 3),
        "match": {"matched": matched, "total": len(script_words)},
        "words": words,
    }, indent=1), encoding="utf-8")
    print(f"matched {matched}/{len(script_words)} script words, duration {duration:.2f}s", flush=True)


if __name__ == "__main__":
    main()
