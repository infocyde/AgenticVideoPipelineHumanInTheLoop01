// One-time setup for `npm run lyrics` (music videos): adds Demucs and librosa to .venv-music (made by setup:music,
// which brings torch 2.7.1 + CUDA), and checks .venv has faster-whisper (setup:align).
// Usage: npm run setup:lyrics
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fail, info, musicPython, ok, ROOT, run, venvPython } from "./lib/util.ts";

const py = musicPython();
if (!existsSync(py)) fail("No .venv-music yet: run npm run setup:music first (npm run lyrics reuses its PyTorch).");
if (!existsSync(venvPython())) fail("No .venv yet: run npm run setup:align first (npm run lyrics transcribes with its faster-whisper).");
if (run("uv", ["--version"], { stdio: "ignore" }) !== 0) fail("uv is needed (https://docs.astral.sh/uv/getting-started/installation/).");
info("installing requirements-lyrics.txt into .venv-music");
const reqs = join(ROOT, "requirements-lyrics.txt");
if (run("uv", ["pip", "install", "--python", py, "--index-strategy", "unsafe-best-match", "-r", reqs]) !== 0) fail("install failed (see output above).");
if (run(py, ["-c", "import torch, demucs, librosa; assert torch.__version__ == '2.7.1+cu126', torch.__version__; print('torch', torch.__version__, 'cuda', torch.cuda.is_available())"]) !== 0) {
  fail("the music environment's torch changed or an import failed (see above). Re-run npm run setup:music, then this.");
}
ok("lyrics ready. Demucs (htdemucs, ~80 MB) and the Whisper model download on the first `npm run lyrics`.");
