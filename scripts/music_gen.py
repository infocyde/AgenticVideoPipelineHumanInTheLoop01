"""Generate a music bed with Stable Audio 3 (run by scripts/compose.ts inside .venv-music).

One pass up to the model's limit (medium 380 s, small-music 120 s). Longer beds are extended with the model's own
continuation: the last CONTEXT seconds are fed back as fixed audio and the rest is generated after them, then the new
part is joined on with a short equal-power crossfade. Writes a 44.1 kHz stereo float WAV and prints one JSON line
(the summary) last on stdout.
"""

import argparse
import json
import math
import sys
import time

import numpy as np

MAX_SECONDS = {"medium": 380.0, "small-music": 120.0}
CONTEXT = 60.0  # seconds of the bed fed back as context for each continuation
XFADE = 0.5  # seconds of crossfade at each join


HOLE_DB = 30.0  # a stretch this far under the bed's median level is a hole, not a musical rest
HOLE_MIN = 0.75  # seconds; shorter dips are rests
FADE_DB = 8.0  # a repair takes in the fade around a hole, down to this far under the median level
REPAIR_CONTEXT = 30.0  # seconds of music kept on each side of a hole while it is regenerated


def holes(audio: np.ndarray, sr: int) -> list:
    """(start, end) seconds of stretches at least HOLE_MIN long and HOLE_DB under the median level (the last 4 s, where
    the bed runs past the video and fades anyway, are ignored)."""
    w = int(0.25 * sr)
    mono = audio.mean(0)
    n = len(mono) // w
    if n < 8:
        return []
    db = 20 * np.log10(np.sqrt((mono[: n * w].reshape(n, w) ** 2).mean(1)) + 1e-9)
    thr = float(np.median(db)) - HOLE_DB
    total, spans, i = n * 0.25, [], 0
    while i < n:
        if db[i] < thr:
            j = i
            while j < n and db[j] < thr:
                j += 1
            s, e = i * 0.25, j * 0.25
            if e - s >= HOLE_MIN and s < total - 4:
                spans.append((s, e))
            i = j
        else:
            i += 1
    return spans


def widen(audio: np.ndarray, sr: int, s: float, e: float) -> tuple:
    """Grow a hole to take in the fade around it (where the level is FADE_DB under the median), plus 1 s each side:
    otherwise the context ends in a fade-out and the model carries on fading."""
    w = int(0.25 * sr)
    mono = audio.mean(0)
    n = len(mono) // w
    db = 20 * np.log10(np.sqrt((mono[: n * w].reshape(n, w) ** 2).mean(1)) + 1e-9)
    thr = float(np.median(db)) - FADE_DB
    i, j = int(s / 0.25), min(n, int(e / 0.25))
    while i > 0 and db[i - 1] < thr:
        i -= 1
    while j < n and db[j] < thr:
        j += 1
    return max(0.0, i * 0.25 - 1.0), min(n * 0.25, j * 0.25 + 1.0)


def repair(model, to_np, torch, audio, sr, s, e, prompt, steps, seed, limit):
    """Regenerate [s, e] (grown to take in its fades) in place by inpainting; splice it back with equal-power crossfades."""
    s, e = widen(audio, sr, s, e)
    total = audio.shape[1] / sr
    a0 = max(0.0, s - REPAIR_CONTEXT)
    a1 = min(total, e + REPAIR_CONTEXT, a0 + limit)
    seg = np.ascontiguousarray(audio[:, int(a0 * sr) : int(a1 * sr)])
    ms, me = max(0.0, s - 0.25 - a0), min(a1 - a0, e + 0.25 - a0)
    out = to_np(
        model.generate(
            prompt=prompt,
            duration=a1 - a0,
            steps=steps,
            seed=seed,
            inpaint_audio=(sr, torch.from_numpy(seg)),
            inpaint_mask_start_seconds=ms,
            inpaint_mask_end_seconds=me,
        )
    )
    if out.shape[1] < seg.shape[1]:
        out = np.pad(out, ((0, 0), (0, seg.shape[1] - out.shape[1])))
    n = int(XFADE * sr)
    lo, hi = max(0, int(ms * sr) - n), min(seg.shape[1], int(me * sr) + n)
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    up, down = np.sin(ramp * math.pi / 2), np.cos(ramp * math.pi / 2)
    mix = out[:, lo:hi].copy()
    k = min(n, mix.shape[1] // 2)
    mix[:, :k] = seg[:, lo : lo + k] * down[:k] + out[:, lo : lo + k] * up[:k]
    mix[:, -k:] = out[:, hi - k : hi] * down[:k] + seg[:, hi - k : hi] * up[:k]
    base = int(a0 * sr)
    audio = audio.copy()
    audio[:, base + lo : base + hi] = mix
    return audio


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="medium", choices=list(MAX_SECONDS))
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--seconds", type=float, required=True)
    ap.add_argument("--seed", type=int, required=True)
    ap.add_argument("--steps", type=int, default=8)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    import soundfile as sf
    import torch

    if a.model == "medium":
        if not torch.cuda.is_available():
            print("ERROR: the medium model needs a CUDA GPU. Use --model small-music (or music_gen.model: small-music).", file=sys.stderr)
            return 2
        try:
            import flash_attn  # noqa: F401
        except Exception as e:  # pragma: no cover - environment problem
            print(f"ERROR: Flash Attention 2 does not import ({e}); the medium model needs it. Re-run npm run setup:music, or use small-music.", file=sys.stderr)
            return 2

    from stable_audio_3 import StableAudioModel

    t0 = time.time()
    try:
        model = StableAudioModel.from_pretrained(a.model)
    except Exception as e:
        name = type(e).__name__
        if name in ("GatedRepoError", "RepositoryNotFoundError") or "gated" in str(e).lower() or "401" in str(e):
            print(json.dumps({"error": "gated", "detail": str(e).splitlines()[0][:300]}))
            return 3
        raise
    sr = int(model.model.sample_rate)
    load_s = time.time() - t0
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()  # report generation's peak, not the load spike (weights convert to fp16)

    def to_np(t: "torch.Tensor") -> np.ndarray:
        x = t[0] if t.dim() == 3 else t  # [channels, samples]
        return x.detach().float().cpu().numpy()

    limit = MAX_SECONDS[a.model]
    passes = []
    t1 = time.time()
    first = min(a.seconds, limit)
    audio = to_np(model.generate(prompt=a.prompt, duration=first, steps=a.steps, seed=a.seed))
    passes.append({"seed": a.seed, "seconds": round(first, 2)})

    k = 1
    while audio.shape[1] / sr < a.seconds - 0.05:
        have = audio.shape[1] / sr
        ctx = min(CONTEXT, have)
        ext = min(a.seconds - have + XFADE, limit - ctx)
        seed = a.seed + k
        context = torch.from_numpy(np.ascontiguousarray(audio[:, -int(ctx * sr):]))
        out = to_np(
            model.generate(
                prompt=a.prompt,
                duration=ctx + ext,
                steps=a.steps,
                seed=seed,
                inpaint_audio=(sr, context),
                inpaint_mask_start_seconds=ctx,
                inpaint_mask_end_seconds=ctx + ext,
            )
        )
        # The new part starts at `ctx`; overlap XFADE seconds of it with the bed's tail (equal-power).
        n = int(XFADE * sr)
        start = int(ctx * sr) - n
        new = out[:, start:]
        if new.shape[1] <= n:
            break
        ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
        fade_in, fade_out = np.sin(ramp * math.pi / 2), np.cos(ramp * math.pi / 2)
        audio[:, -n:] = audio[:, -n:] * fade_out + new[:, :n] * fade_in
        audio = np.concatenate([audio, new[:, n:]], axis=1)
        passes.append({"seed": seed, "seconds": round(ext, 2), "context": round(ctx, 2)})
        k += 1

    audio = audio[:, : int(a.seconds * sr)]

    # Holes: a long pass can "finish the song" early and leave seconds of silence before it starts again. Find
    # stretches far under the bed's level and regenerate them in place (inpainting, with the music around them as
    # context and a new seed per try).
    repairs = []
    for attempt in range(3):
        spans = holes(audio, sr)
        if not spans:
            break
        for i, (s, e) in enumerate(spans):
            seed = a.seed + 100 + attempt * 10 + i
            audio = repair(model, to_np, torch, audio, sr, s, e, a.prompt, a.steps, seed, limit)
            repairs.append({"from": round(s, 2), "to": round(e, 2), "seed": seed})
    left = holes(audio, sr)

    peak = float(np.max(np.abs(audio))) or 1.0
    if peak > 0.99:
        audio = audio * (0.99 / peak)
    sf.write(a.out, audio.T, sr, subtype="FLOAT")
    print(
        json.dumps(
            {
                "seconds": round(audio.shape[1] / sr, 2),
                "sampleRate": sr,
                "passes": passes,
                "repairs": repairs,
                "holesLeft": [[round(s, 2), round(e, 2)] for s, e in left],
                "loadSeconds": round(load_s, 1),
                "generateSeconds": round(time.time() - t1, 1),
                "device": "cuda" if torch.cuda.is_available() else "cpu",
                "peakVramGB": round(torch.cuda.max_memory_allocated() / 2**30, 2) if torch.cuda.is_available() else None,
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
