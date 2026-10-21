"""Soften hard sentence cut-offs in an existing voiceover without re-voicing it (npm run voice now fades its own cuts).

Finds the pauses voice.py inserted between sentences (runs of near-digital silence) and fades the audio out over the
50 ms before each one, so a word that was trimmed mid-decay ends smoothly instead of clicking off. The length and
timing are unchanged, so timing.json stays valid. The original is kept next to it as <name>.before-fade.mp3.

Usage: python scripts/soften_cuts.py <voiceover.mp3> [--fade-ms 50] [--keep <backup dir>]
"""

import argparse
import json
import os
import shutil
import subprocess

import numpy as np


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate,channels,bit_rate",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    s = json.loads(out)["streams"][0]
    return int(s["sample_rate"]), int(s["channels"]), int(s.get("bit_rate") or 192000)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mp3")
    ap.add_argument("--fade-ms", type=float, default=50)
    ap.add_argument("--keep", default=None, help="folder for the untouched original (default: next to it)")
    a = ap.parse_args()

    sr, ch, br = probe(a.mp3)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.mp3, "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()
    mono = np.abs(x).max(axis=1)

    # Pauses: at least 0.2 s under -54 dBFS (the inserted silence; MP3 leaves faint codec noise in it).
    quiet = mono < 0.002
    min_run, fade = int(0.2 * sr), int(a.fade_ms / 1000 * sr)
    edges = np.flatnonzero(np.diff(np.concatenate([[0], quiet.astype(np.int8), [0]])))
    starts, ends = edges[::2], edges[1::2]
    ramp = np.cos(np.linspace(0, np.pi / 2, fade, dtype=np.float32))[:, None]
    n = 0
    for s0, e0 in zip(starts, ends):
        if e0 - s0 < min_run or s0 < fade:
            continue
        x[s0 - fade : s0] *= ramp
        n += 1

    backup_dir = a.keep or os.path.dirname(os.path.abspath(a.mp3))
    os.makedirs(backup_dir, exist_ok=True)
    backup = os.path.join(backup_dir, os.path.basename(a.mp3).replace(".mp3", ".before-fade.mp3"))
    if not os.path.exists(backup):
        shutil.copyfile(a.mp3, backup)
    tmp = a.mp3 + ".tmp.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", str(ch), "-i", "-", "-c:a", "libmp3lame",
                    "-b:a", f"{max(128, round(br / 1000))}k", tmp], input=x.tobytes(), check=True)
    os.replace(tmp, a.mp3)
    print(json.dumps({"file": a.mp3, "faded_cuts": n, "fade_ms": a.fade_ms, "seconds": round(len(x) / sr, 3), "backup": backup}))


if __name__ == "__main__":
    main()
