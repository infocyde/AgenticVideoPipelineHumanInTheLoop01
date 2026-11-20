"""Local TTS for Brief Kit (run by scripts/voice.ts inside .venv-tts).

voice.py <args.json>   args: engine, model, reference, exaggeration, cfg_weight, voice, speed, pause, seed, text, out
                       (engine qwen-cloud: Qwen3-TTS on Replicate, every sentence at once; needs REPLICATE_API_TOKEN)
                       (engine elevenlabs: ElevenLabs API, a few sentences at a time with stitching; needs ELEVENLABS_API_KEY)
voice.py --voices      list Kokoro voices

The script is spoken sentence by sentence (paragraph breaks get a longer pause), one fixed seed per sentence, so a
re-run with the same settings and text gives the same take, and a long script never hits a model's length limit.

Sentence cache (args cache_dir, every engine but elevenlabs): each sentence's raw take is kept under a key made of its
exact text and the voice settings (engine, model, reference clip contents, seed, speed…), not its position. A re-run
reuses every sentence whose key is cached and voices only new or edited ones (the model isn't even loaded when nothing
is missing). args redo: ["fragment", …] voices a new take of the sentences containing a fragment (fresh seed; the old
take is kept as <key>.prev.npz). args fresh: ignore the cache and voice everything.
"""
import hashlib
import json
import os
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


def trim(wav, sr, thresh=0.003):
    """Trim leading/trailing near-silence. Keeps 40 ms before the first sound and 250 ms after the last (word endings
    such as a soft "s" or "th" decay well below the threshold), with a 10 ms fade-in and a 90 ms fade-out so no cut is audible."""
    idx = np.where(np.abs(wav) > thresh)[0]
    if not len(idx):
        return wav
    # Some engines (qwen-cloud) return audio that stops right at the last sound, leaving no tail for the fade-out, which
    # then lands on the final syllable. Pad with silence (after a 5 ms micro-fade so the edge doesn't click).
    short = idx[-1] + int(0.25 * sr) - len(wav)
    if short > 0:
        wav = wav.astype(np.float32).copy()
        mf = min(len(wav), int(0.005 * sr))
        wav[len(wav) - mf :] *= np.linspace(1.0, 0.0, mf, dtype=np.float32)
        wav = np.concatenate([wav, np.zeros(short, dtype=np.float32)])
    out = wav[max(0, idx[0] - int(0.04 * sr)) : min(len(wav), idx[-1] + int(0.25 * sr))].astype(np.float32).copy()
    fi, fo = min(len(out), int(0.01 * sr)), min(len(out), int(0.09 * sr))
    out[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)
    out[len(out) - fo :] *= np.cos(np.linspace(0.0, np.pi / 2, fo, dtype=np.float32))
    return out


CLOUD_MODEL = "qwen/qwen3-tts"  # official Replicate model (Alibaba Qwen, Apache-2.0); voice_clone mode

# Bump when the way a sentence is generated changes, so old cached takes stop matching
# (2: local qwen gets the trailing " ..." ending fix, 2026-11-19).
CACHE_VERSION = 2
REDO_SEED_STEP = 100003  # a redone sentence's seed moves this far per redo, so local engines give a different take


def _file_sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


class SentenceCache:
    """Raw per-sentence takes on disk, keyed by text + voice settings (see the module docstring)."""

    SETTINGS = ("engine", "model", "qwen_size", "language", "voice", "speed", "exaggeration", "cfg_weight", "ref_text", "seed")

    def __init__(self, a):
        self.dir = a.get("cache_dir")
        if self.dir:
            os.makedirs(self.dir, exist_ok=True)
        ident = {k: a.get(k) for k in self.SETTINGS}
        ref = a.get("reference")
        ident["reference"] = _file_sha1(ref) if ref and os.path.exists(ref) else ref
        ident["v"] = CACHE_VERSION
        self.ident = ident

    def key(self, s):
        return hashlib.sha1(json.dumps({**self.ident, "text": s}, sort_keys=True).encode("utf-8")).hexdigest()[:24]

    def _path(self, k, prev=False):
        return os.path.join(self.dir, f"{k}{'.prev' if prev else ''}.npz")

    def load(self, k):
        """(raw, sr, takes) or None."""
        if not self.dir or not os.path.exists(self._path(k)):
            return None
        with np.load(self._path(k)) as z:
            return z["raw"].astype(np.float32), int(z["sr"]), int(z["takes"])

    def save(self, k, raw, sr, takes, keep_prev=False):
        if not self.dir:
            return
        if keep_prev and os.path.exists(self._path(k)):
            os.replace(self._path(k), self._path(k, prev=True))
        np.savez(self._path(k), raw=np.asarray(raw, dtype=np.float32).reshape(-1), sr=np.int64(sr), takes=np.int64(takes))


def plan(a, chunks, cache):
    """Which sentences come from the cache and which must be voiced: (cached {i: (raw, sr)}, todo [i], takes {i: n})."""
    redo = [r.strip().lower() for r in (a.get("redo") or []) if r.strip()]
    hit_redo = set()
    cached, todo, takes = {}, [], {}
    for i, (s, _) in enumerate(chunks):
        k = cache.key(s)
        got = cache.load(k)
        is_redo = [r for r in redo if r in s.lower()]
        hit_redo.update(is_redo)
        if got and not a.get("fresh") and not is_redo:
            cached[i] = (got[0], got[1])
        else:
            todo.append(i)
            # a redo always moves to the next take, cached or not (with nothing cached, take 0 would repeat the old take)
            takes[i] = ((got[2] if got else 0) + 1) if is_redo else 0
    for r in redo:
        if r not in hit_redo:
            print(f"! --redo \"{r}\" matched no sentence", flush=True)
    return cached, todo, takes


def cloud_takes(a, chunks):
    """Qwen3-TTS on Replicate: upload the reference clip once, then voice every sentence in parallel.
    Returns ([float32 mono arrays], sample rate, stats). No seed input: a re-run gives a different take."""
    import os
    import subprocess
    from concurrent.futures import ThreadPoolExecutor

    import requests

    token = os.environ.get("REPLICATE_API_TOKEN")
    if not token:
        sys.exit("REPLICATE_API_TOKEN is not set (put it in .env); qwen-cloud runs on Replicate.")
    api = "https://api.replicate.com/v1"
    auth = {"Authorization": f"Bearer {token}"}
    sr = 24000

    with open(a["reference"], "rb") as f:
        up = requests.post(f"{api}/files", headers=auth, files={"content": (os.path.basename(a["reference"]), f, "audio/wav")}, timeout=120)
    if up.status_code >= 300:
        sys.exit(f"Replicate refused the reference upload ({up.status_code}): {up.text[:300]}")
    ref_url = up.json()["urls"]["get"]

    def decode(blob):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(sr), "pipe:1"],
                             input=blob, capture_output=True, check=True).stdout
        return np.frombuffer(raw, dtype=np.float32).copy()

    def one(i, s):
        # A trailing ellipsis lets the model finish the last word into silence; without it, about half the takes stop
        # mid-decay (tested 2026-10-25: 6/6 clean endings with " ...", 3/6 with plain text).
        body = {"input": {"mode": "voice_clone", "text": s + " ...", "language": a["language"], "reference_audio": ref_url, "reference_text": a["ref_text"]}}
        last = ""
        for attempt in range(4):
            try:
                r = requests.post(f"{api}/models/{CLOUD_MODEL}/predictions", headers={**auth, "Prefer": "wait=60"}, json=body, timeout=120)
                if r.status_code == 429:
                    time.sleep(2 + attempt * 3)
                    continue
                r.raise_for_status()
                pred = r.json()
                t_end = time.time() + 300
                while pred["status"] not in ("succeeded", "failed", "canceled"):
                    if time.time() > t_end:
                        raise RuntimeError("timed out")
                    time.sleep(1)
                    pred = requests.get(pred["urls"]["get"], headers=auth, timeout=60).json()
                if pred["status"] != "succeeded":
                    raise RuntimeError(pred.get("error") or pred["status"])
                url = pred["output"] if isinstance(pred["output"], str) else pred["output"][0]
                audio = decode(requests.get(url, timeout=120).content)
                return audio, float((pred.get("metrics") or {}).get("predict_time") or 0)
            except Exception as e:  # retry transient failures
                last = str(e)
                time.sleep(1 + attempt * 2)
        sys.exit(f"sentence {i + 1} failed on Replicate after retries: {last}")

    done = [0]

    def run(item):
        i, (s, _) = item
        out = one(i, s)
        done[0] += 1
        print(f"\r  sentence {done[0]}/{len(chunks)} (cloud)", end="", flush=True)
        return out

    with ThreadPoolExecutor(max_workers=max(1, int(a.get("cloud_concurrency") or 8))) as ex:
        results = list(ex.map(run, enumerate(chunks)))
    print(flush=True)
    return [r[0] for r in results], sr, {"gpu_seconds": round(sum(r[1] for r in results), 1)}


ELEVEN_API = "https://api.elevenlabs.io/v1"


def eleven_takes(a, chunks):
    """ElevenLabs text-to-speech, one request per sentence. Continuity across sentences ("request stitching"):
    stitch "text" sends the neighbouring sentences as previous_text / next_text, so sentences can run concurrently;
    "ids" runs them one at a time and sends the last three request ids as previous_request_ids (the docs' preferred
    method, not available for eleven_v3); "off" sends each sentence alone.
    Returns ([float32 mono arrays], sample rate, stats)."""
    import os
    import subprocess
    from concurrent.futures import ThreadPoolExecutor

    import requests

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY is not set (put it in .env, here or in a parent folder).")
    e = a["elevenlabs"]
    fmt = e["output_format"]
    m = re.match(r"(mp3|opus|pcm|wav)_(\d+)", fmt)
    if not m:
        sys.exit(f"voice.elevenlabs.output_format {fmt!r} isn't supported here: use an mp3_*, opus_*, pcm_* or wav_* format.")
    sr = int(m.group(2))
    texts = [s for s, _ in chunks]
    stitch = e["stitch"]
    if stitch == "ids" and e["model"] == "eleven_v3":
        print("  ! eleven_v3 has no request-id stitching: using previous_text / next_text instead", flush=True)
        stitch = "text"

    def decode(blob):
        if fmt.startswith("pcm"):
            return np.frombuffer(blob, dtype="<i2").astype(np.float32) / 32768.0
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(sr), "pipe:1"],
                             input=blob, capture_output=True, check=True).stdout
        return np.frombuffer(raw, dtype=np.float32).copy()

    def problem(r):
        """(status, message) from an ElevenLabs error body."""
        try:
            d = r.json().get("detail")
        except Exception:
            return "", r.text[:300]
        if isinstance(d, dict):
            return d.get("status") or d.get("code") or "", d.get("message") or str(d)
        if isinstance(d, list):  # 422 validation errors
            return "invalid_request", "; ".join(f"{'.'.join(str(x) for x in i.get('loc', []))}: {i.get('msg')}" for i in d)
        return "", str(d or r.text[:300])

    def one(i, prev_ids=()):
        body = {
            "text": texts[i],
            "model_id": e["model"],
            "voice_settings": {"stability": e["stability"], "similarity_boost": e["similarity_boost"], "style": e["style"],
                               "use_speaker_boost": e["speaker_boost"], "speed": e["speed"]},
            "seed": (int(a["seed"]) + i) % 4294967296,  # best-effort deterministic per sentence, as with the local engines
        }
        if stitch != "off":
            if prev_ids:
                body["previous_request_ids"] = list(prev_ids)[-3:]
            elif i > 0:
                body["previous_text"] = " ".join(texts[max(0, i - 2) : i])
            if i + 1 < len(texts):
                body["next_text"] = texts[i + 1]
        url = f"{ELEVEN_API}/text-to-speech/{e['voice_id']}"
        last = ""
        for attempt in range(8):
            try:
                r = requests.post(url, params={"output_format": fmt}, headers={"xi-api-key": key, "accept": "audio/*"}, json=body, timeout=180)
            except requests.RequestException as ex:  # network hiccup: retry
                last = str(ex)
                time.sleep(min(30, 2 ** attempt))
                continue
            if r.status_code == 200:
                cost = r.headers.get("character-cost")
                return decode(r.content), r.headers.get("request-id"), int(cost) if cost and cost.isdigit() else len(texts[i])
            status, msg = problem(r)
            if r.status_code == 429 or r.status_code >= 500 or status in ("too_many_concurrent_requests", "system_busy"):
                last = f"{r.status_code} {status}: {msg}"
                wait = float(r.headers.get("retry-after") or 0) or min(30, 1.5 * 2 ** attempt)
                time.sleep(wait)
                continue
            if status == "quota_exceeded" or "quota" in msg.lower():
                sys.exit(f"\nElevenLabs quota exceeded (sentence {i + 1}): {msg}\nTop up or wait for the monthly reset (elevenlabs.io/app/subscription).")
            if r.status_code in (401, 403):
                sys.exit(f"\nElevenLabs refused the key ({r.status_code} {status}): {msg}\nThe key needs the Text to Speech permission (elevenlabs.io/app/settings/api-keys).")
            if status in ("voice_not_found",) or r.status_code == 404:
                sys.exit(f"\nElevenLabs has no voice {e['voice_id']} for this key ({status}): {msg}")
            sys.exit(f"\nElevenLabs refused sentence {i + 1} ({r.status_code} {status}): {msg}")
        sys.exit(f"\nsentence {i + 1} failed on ElevenLabs after retries: {last}")

    done = [0]

    def tick():
        done[0] += 1
        print(f"\r  sentence {done[0]}/{len(chunks)} (ElevenLabs)", end="", flush=True)

    results = []
    if stitch == "ids":
        ids = []
        for i in range(len(texts)):
            res = one(i, tuple(ids))
            if res[1]:
                ids.append(res[1])
            results.append(res)
            tick()
    else:
        def run(i):
            res = one(i)
            tick()
            return res

        with ThreadPoolExecutor(max_workers=max(1, int(e.get("concurrency") or 3))) as ex:
            results = list(ex.map(run, range(len(texts))))
    print(flush=True)
    return [r[0] for r in results], sr, {"characters": sum(r[2] for r in results), "stitch": stitch}


def assemble(raws, chunks, sr, pause):
    """Trim each sentence (with its tail and fades), join with pauses, normalize to -1 dBFS."""
    pieces, spoken = [], 0.0
    for raw, (_, pause_mult) in zip(raws, chunks):
        w = trim(np.asarray(raw).reshape(-1), sr).astype(np.float32)
        spoken += len(w) / sr
        pieces += [w, np.zeros(int(sr * pause * pause_mult), dtype=np.float32)]
    audio = np.concatenate(pieces[:-1])
    peak = float(np.max(np.abs(audio))) or 1.0
    return audio / peak * 0.89, spoken


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

    cache = SentenceCache(a) if a["engine"] != "elevenlabs" else SentenceCache({})  # elevenlabs stitches neighbours: no cache
    cached, todo, takes = plan(a, chunks, cache) if cache.dir else ({}, list(range(len(chunks))), {i: 0 for i in range(len(chunks))})
    if cache.dir:
        print(f"  sentence cache: {len(cached)} of {len(chunks)} reused, {len(todo)} to voice", flush=True)

    def store(i, raw, sr):
        cache.save(cache.key(chunks[i][0]), raw, sr, takes[i], keep_prev=takes[i] > 0)

    if a["engine"] == "qwen-cloud":
        t1 = time.time()
        raws = [None] * len(chunks)
        sr = next((v[1] for v in cached.values()), None)
        stats = {"gpu_seconds": 0}
        for i, (raw, _) in cached.items():
            raws[i] = raw
        if todo:
            print(f"  {len(todo)} sentences to Replicate ({CLOUD_MODEL}, voice_clone), {a.get('cloud_concurrency') or 8} at a time", flush=True)
            new, sr, stats = cloud_takes(a, [chunks[i] for i in todo])
            for i, raw in zip(todo, new):
                raws[i] = raw
                store(i, raw, sr)
        audio, spoken = assemble(raws, chunks, sr, a["pause"])
        sf.write(a["out"], audio, sr, subtype="PCM_16")
        took = time.time() - t1
        print(f"  {len(audio) / sr:.1f}s of audio in {took:.0f}s ({spoken / max(took, 1e-6):.1f}x realtime); "
              f"Replicate GPU time {stats['gpu_seconds']}s", flush=True)
        return

    if a["engine"] == "elevenlabs":
        e = a["elevenlabs"]
        t1 = time.time()
        conc = 1 if e["stitch"] == "ids" else e["concurrency"]
        print(f"  {len(chunks)} sentences to ElevenLabs ({e['model']}, voice {e['voice_name']}, stitch {e['stitch']}), {conc} at a time", flush=True)
        raws, sr, stats = eleven_takes(a, chunks)
        audio, spoken = assemble(raws, chunks, sr, a["pause"])
        sf.write(a["out"], audio, sr, subtype="PCM_16")
        took = time.time() - t1
        print(f"  {len(audio) / sr:.1f}s of audio in {took:.0f}s ({spoken / max(took, 1e-6):.1f}x realtime); "
              f"ElevenLabs billed {stats['characters']} characters", flush=True)
        return

    if not todo:  # every sentence is cached: no model to load
        t1 = time.time()
        sr = next(iter(cached.values()))[1]
        audio, spoken = assemble([cached[i][0] for i in range(len(chunks))], chunks, sr, a["pause"])
        sf.write(a["out"], audio, sr, subtype="PCM_16")
        print(f"  {len(audio) / sr:.1f}s of audio, all from the sentence cache ({time.time() - t1:.0f}s)", flush=True)
        return

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
            # Trailing ellipsis, as for qwen-cloud: lets the model finish the last word into silence instead of stopping
            # mid-decay (2026-11-19: a local take had 24 harsh stops without it).
            wavs, rate = model.generate_voice_clone(text=s + " ...", language=a["language"], voice_clone_prompt=prompt)
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

    print(f"  model loaded in {time.time() - t0:.0f}s on {device}; {len(todo)} of {len(chunks)} sentences to voice", flush=True)
    raws = [None] * len(chunks)
    for i, (raw, _) in cached.items():
        raws[i] = raw
    t1 = time.time()
    for n, i in enumerate(todo):
        # The seed stays tied to the sentence's position (as before the cache), so a first cached run reproduces earlier
        # takes; a redo moves it by REDO_SEED_STEP per redo for a different take.
        raw = say(chunks[i][0], a["seed"] + i + REDO_SEED_STEP * takes[i])
        sr = box.get("sr", sr)
        raws[i] = np.asarray(raw, dtype=np.float32).reshape(-1)
        store(i, raws[i], sr)
        print(f"\r  sentence {n + 1}/{len(todo)}", end="", flush=True)
    print(flush=True)
    audio, spoken = assemble(raws, chunks, sr, a["pause"])  # -1 dBFS; the render's master stage sets the final loudness
    sf.write(a["out"], audio, sr, subtype="PCM_16")
    took = time.time() - t1
    print(f"  {len(audio) / sr:.1f}s of audio in {took:.0f}s ({spoken / max(took, 1e-6):.1f}x realtime)", flush=True)
    if device == "cuda":
        print(f"  peak GPU memory {torch.cuda.max_memory_allocated() / 2**30:.1f} GB", flush=True)


if __name__ == "__main__":
    main()
