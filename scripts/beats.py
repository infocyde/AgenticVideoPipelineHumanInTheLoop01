"""Beat times of a song for music-video cuts in instrumental passages (npm run lyrics). Runs in .venv-music (librosa).

Usage: .venv-music/Scripts/python -I scripts/beats.py <song> <out.json>   ->  {"tempo": 128.0, "beats": [0.42, 0.89, ...]}
"""
import json
import sys

import librosa
import numpy as np


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    out = {"tempo": round(float(np.atleast_1d(tempo)[0]), 2), "beats": [round(float(t), 3) for t in beats]}
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(f"{len(out['beats'])} beats, tempo {out['tempo']} BPM", flush=True)


if __name__ == "__main__":
    main()
