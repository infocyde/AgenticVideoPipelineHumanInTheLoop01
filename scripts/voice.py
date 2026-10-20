"""Local TTS for Brief Kit (run by scripts/voice.ts inside .venv-tts).

voice.py <args.json>   args: engine, model, reference, exaggeration, cfg_weight, voice, speed, pause, seed, text, out
voice.py --voices      list Kokoro voices

The script is spoken sentence by sentence (paragraph breaks get a longer pause), one fixed seed per sentence, so a
re-run with the same settings and text gives the same take, and a long script never hits a model's length limit.
"""
import json
import re
import sys
import time

import numpy as np
import soundfile as sf

KOKORO_VOICES = {
    "American English (a)": ["af_heart", "af_bella", "af_nicole", "af_aoede", "af_kore", "af_sarah", "af_nova", "af_sky", "af_alloy", "af_jessica", "af_river",
                             "am_michael", "am_fenrir", "am_puck", "am_echo", "am_eric", "am_liam", "am_onyx", "am_santa", "am_adam"],
    "British English (b)": ["bf_emma", "bf_isabella", "bf_alice", "bf_lily", "bm_george", "bm_fable", "bm_lewis", "bm_daniel"],
}


def sentences(text):
    """[(sentence, pause_after_multiplier)]: split on blank lines (paragraphs), then sentence ends."""
    out = []
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    for pi, para in enumerate(paras):
        para = re.sub(r"\s+", " ", para)
        parts = [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[\"'(\[A-Z0-9])", para) if s.strip()]
        for si, s in enumerate(parts):
            # very long sentences: split at a comma/semicolon near the middle (models drift past ~40 s)
            while len(s) > 300:
                cut = max((m.start() for m in re.finditer(r"[,;:]\s", s[:300])), default=-1)
                if cut < 80:
                    break
                out.append((s[: cut + 1], 0.5))
                s = s[cut + 2 :]
            last = si == len(parts) - 1
            out.append((s, 2.0 if last and pi < len(paras) - 1 else 1.0))
    return out


def trim(wav, sr, thresh=0.01):
    """Trim leading/trailing near-silence, keeping 40 ms of room."""
    idx = np.where(np.abs(wav) > thresh)[0]
    if not len(idx):
        return wav
    pad = int(0.04 * sr)
    return wav[max(0, idx[0] - pad) : min(len(wav), idx[-1] + pad)]


def main():
    if sys.argv[1:] == ["--voices"]:
        for group, names in KOKORO_VOICES.items():
            print(f"{group}: {', '.join(names)}")
        print("Prefix: a/b = American/British, f/m = female/male. af_heart and af_bella are the strongest; am_michael and bm_george are good male narrators.")
        return

    a = json.load(open(sys.argv[1], encoding="utf-8"))
    text = open(a["text"], encoding="utf-8").read()
    chunks = sentences(text)
    if not chunks:
        sys.exit("voiceover.txt is empty")

    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("! no CUDA GPU visible to PyTorch: running on the CPU (slow)", flush=True)
    t0 = time.time()
    box = {}  # engines that only learn their sample rate at generation time put it here

    if a["engine"] == "kokoro":
        from kokoro import KPipeline

        voice = a["voice"]
        pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M", device=device)
        sr = 24000

        def say(s, seed):
            torch.manual_seed(seed)
            parts = [r.audio.cpu().numpy() if hasattr(r.audio, "cpu") else np.asarray(r.audio) for r in pipe(s, voice=voice, speed=a["speed"])]
            return np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)

    elif a["engine"] == "qwen":
        # Qwen3-TTS (runs in .venv-qwen): clones from the reference clip plus its transcript (voices/<name>.txt).
        from qwen_tts import Qwen3TTSModel

        model = Qwen3TTSModel.from_pretrained(
            f"Qwen/Qwen3-TTS-12Hz-{a['qwen_size']}-Base",
            device_map="cuda:0" if device == "cuda" else "cpu",
            dtype=torch.bfloat16 if device == "cuda" else torch.float32,
        )
        prompt = model.create_voice_clone_prompt(ref_audio=a["reference"], ref_text=a["ref_text"])
        sr = None  # reported by the model with the first sentence

        def say(s, seed):
            torch.manual_seed(seed)
            if device == "cuda":
                torch.cuda.manual_seed_all(seed)
            wavs, rate = model.generate_voice_clone(text=s, language=a["language"], voice_clone_prompt=prompt)
            box["sr"] = rate
            w = wavs[0]
            return w.detach().float().cpu().numpy() if hasattr(w, "detach") else np.asarray(w, dtype=np.float32)

    else:
        ref = a["reference"] or None
        if a["model"] == "turbo":
            from chatterbox.tts_turbo import ChatterboxTurboTTS

            model = ChatterboxTurboTTS.from_pretrained(device=device)
            gen = lambda s: model.generate(s, audio_prompt_path=ref)
        else:
            from chatterbox.tts import ChatterboxTTS

            model = ChatterboxTTS.from_pretrained(device=device)
            kw = dict(exaggeration=a["exaggeration"], cfg_weight=a["cfg_weight"])
            gen = lambda s: model.generate(s, audio_prompt_path=ref, **kw)
        sr = model.sr

        def say(s, seed):
            torch.manual_seed(seed)
            if device == "cuda":
                torch.cuda.manual_seed_all(seed)
            w = gen(s)
            return w.squeeze(0).detach().cpu().numpy()

    print(f"  model loaded in {time.time() - t0:.0f}s on {device}; {len(chunks)} sentences", flush=True)
    pieces, spoken = [], 0.0
    t1 = time.time()
    for i, (s, pause_mult) in enumerate(chunks):
        raw = say(s, a["seed"] + i)
        sr = box.get("sr", sr)
        w = trim(np.asarray(raw).reshape(-1), sr).astype(np.float32)
        spoken += len(w) / sr
        pieces += [w, np.zeros(int(sr * a["pause"] * pause_mult), dtype=np.float32)]
        print(f"\r  sentence {i + 1}/{len(chunks)}", end="", flush=True)
    print(flush=True)
    audio = np.concatenate(pieces[:-1])
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = audio / peak * 0.89  # -1 dBFS; the render's master stage sets the final loudness
    sf.write(a["out"], audio, sr, subtype="PCM_16")
    took = time.time() - t1
    print(f"  {len(audio) / sr:.1f}s of audio in {took:.0f}s ({spoken / max(took, 1e-6):.1f}x realtime)", flush=True)
    if device == "cuda":
        print(f"  peak GPU memory {torch.cuda.max_memory_allocated() / 2**30:.1f} GB", flush=True)


if __name__ == "__main__":
    main()
