"""Match a song's lyric sheet to what Whisper hears on its vocal stem (npm run lyrics; music videos).

Like align.py, but for singing: the sheet's words get the times of the heard words they match (match_opcodes), and every
stretch where the two disagree is reported, so the producer can show the user where the recording departs from the
sheet. Unmatched sheet words get no time here; scripts/lyrics.ts places them inside their own lyric line.
The transcription is cached (keyed by model and stem mtime), so re-running after editing lyrics.txt is quick.

Usage (normally via `npm run lyrics -- <slug>`):
  .venv/Scripts/python -I scripts/lyrics_align.py <vocals.wav> <words.json> <out.json> <heard.txt> <cache.json> [model] [device] [language]
  words.json: the sheet's words in order (a JSON array of strings); an empty array only transcribes.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I leaves the script's folder off sys.path
from align import expand, load_audio, norm  # noqa: E402

# Word-matching scores: a heard word on its sheet word beats any shift that would lose it.
MATCH, MISMATCH, GAP = 2, -1, -1


def transcribe(audio: Path, model_name: str, device: str, language: str | None, cache: Path) -> dict:
    key = f"v3|{model_name}|{device}|{language}|{os.path.getmtime(audio)}"
    if cache.exists():
        c = json.loads(cache.read_text(encoding="utf-8"))
        if c.get("key") == key:
            print("transcription: cached", flush=True)
            return c
    from faster_whisper import WhisperModel

    print(f"transcribing {audio.name} with {model_name} on {device} (several minutes on CPU)...", flush=True)
    model = WhisperModel(model_name, device=device, compute_type="int8" if device == "cpu" else "float16")
    # No VAD filter: it takes singing for non-speech (it dropped 3/4 of the words on Ride the Biggest Waves, 2026-11-06).
    # The stem is vocals only, so what it would remove is what we want to hear.
    segments, info = model.transcribe(
        load_audio(audio), word_timestamps=True, condition_on_previous_text=False, vad_filter=False, language=language
    )
    heard, lines, wi = [], [], 0
    for seg in segments:
        lines.append(seg.text.strip())
        for w in seg.words:
            parts = expand(w.word)
            step = (w.end - w.start) / max(1, len(parts))
            for k, p in enumerate(parts):
                heard.append({"w": p, "raw": w.word.strip(), "wi": wi, "start": w.start + k * step, "end": w.start + (k + 1) * step})
            wi += 1
    c = {"key": key, "duration": float(info.duration), "language": info.language, "heard": heard, "lines": lines}
    cache.write_text(json.dumps(c), encoding="utf-8")
    return c


def sheet_token(word: str) -> str:
    """One comparable token per sheet word ('2' -> 'two', 'Island,' -> 'island')."""
    parts = expand(word)
    return "".join(parts) if parts else norm(word)


def raw_text(heard: list[dict]) -> str:
    """The heard words as Whisper wrote them (expand() can split one word into parts that share its `wi`)."""
    out, seen = [], set()
    for h in heard:
        if h["wi"] not in seen:
            seen.add(h["wi"])
            out.append(h["raw"])
    return " ".join(out)


def match_opcodes(a: list[str], b: list[str]) -> list[tuple[str, int, int, int, int]]:
    """How sheet tokens `a` pair with heard tokens `b`, as (tag, i1, i2, j1, j2) ranges in order.

    Global alignment (Needleman-Wunsch), not difflib: difflib fixes the longest clean run first, so a well-heard second
    chorus pairs with the sheet's first chorus and leaves the rest of the song with nothing to pair against.
    """
    n, m = len(a), len(b)
    score = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        score[i][0] = i * GAP
    for j in range(1, m + 1):
        score[0][j] = j * GAP
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            pair = MATCH if a[i - 1] == b[j - 1] else MISMATCH
            score[i][j] = max(score[i - 1][j - 1] + pair, score[i - 1][j] + GAP, score[i][j - 1] + GAP)

    # Walk back from the end, then group the steps into ranges.
    steps: list[tuple[bool, int, int]] = []  # (equal, i, j) at the start of each step
    i, j = n, m
    while i or j:
        if i and j and score[i][j] == score[i - 1][j - 1] + (MATCH if a[i - 1] == b[j - 1] else MISMATCH):
            i, j = i - 1, j - 1
            steps.append((a[i] == b[j], i, j))
        elif i and score[i][j] == score[i - 1][j] + GAP:
            i -= 1
            steps.append((False, i, j))
        else:
            j -= 1
            steps.append((False, i, j))
    steps.reverse()

    ops: list[tuple[str, int, int, int, int]] = []
    k = 0
    while k < len(steps):
        equal, i1, j1 = steps[k]
        while k < len(steps) and steps[k][0] == equal:
            k += 1
        i2, j2 = (steps[k][1], steps[k][2]) if k < len(steps) else (n, m)
        tag = "equal" if equal else "replace" if i2 > i1 and j2 > j1 else "delete" if i2 > i1 else "insert"
        ops.append((tag, i1, i2, j1, j2))
    return ops


def main() -> None:
    if len(sys.argv) < 6:
        sys.exit(__doc__)
    vocals, words_file, out, heard_out, cache = map(Path, sys.argv[1:6])
    model_name = sys.argv[6] if len(sys.argv) > 6 else "medium"
    device = sys.argv[7] if len(sys.argv) > 7 else "cpu"
    language = sys.argv[8] if len(sys.argv) > 8 and sys.argv[8] != "auto" else None

    c = transcribe(vocals, model_name, device, language, cache)
    heard = c["heard"]
    heard_out.write_text("\n".join(c["lines"]) + "\n", encoding="utf-8")
    sheet = json.loads(words_file.read_text(encoding="utf-8"))

    a = [sheet_token(w) for w in sheet]
    b = [h["w"] for h in heard]
    times: list = [None] * len(a)
    diffs = []
    for tag, i1, i2, j1, j2 in match_opcodes(a, b):
        if tag == "equal":
            for k in range(i2 - i1):
                h = heard[j1 + k]
                times[i1 + k] = [round(h["start"], 3), round(h["end"], 3)]
            continue
        hs = heard[j1:j2]
        diffs.append({
            "op": tag, "sheetFrom": i1, "sheetTo": i2, "heard": raw_text(hs),
            "start": round(hs[0]["start"], 3) if hs else None, "end": round(hs[-1]["end"], 3) if hs else None,
        })
    matched = sum(t is not None for t in times)
    out.write_text(json.dumps({
        "duration": round(c["duration"], 3), "language": c["language"], "matched": matched, "total": len(a),
        "times": times, "diffs": diffs, "heardLines": c["lines"],
    }), encoding="utf-8")
    print(f"heard {len(heard)} words ({c['language']}); matched {matched}/{len(a)} sheet words", flush=True)


if __name__ == "__main__":
    main()
