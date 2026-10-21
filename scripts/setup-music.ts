// One-time setup for `npm run compose` (local music beds with Stable Audio 3): creates .venv-music (Python 3.12) and
// installs requirements-music.txt (CUDA PyTorch 2.7.1, stable-audio-3, Flash Attention 2). Kept apart from the voice
// environments because stable-audio-3 pins its own torch and transformers. Uses uv to fetch Python 3.12 if needed.
// The model weights download on first use from Hugging Face. They are gated (auto-approved): accept the terms on
// https://huggingface.co/stabilityai/stable-audio-3-medium (and -small-music), then log in once (`hf auth login`,
// or HF_TOKEN in .env).
// Usage: npm run setup:music [--cpu]   (--cpu: CPU-only PyTorch, no Flash Attention: only the small-music model works)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, info, ok, parseArgs, ROOT, run, warn } from "./lib/util.ts";

const { flags } = parseArgs();
const name = ".venv-music";
const venv = join(ROOT, name);
const py = process.platform === "win32" ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");
if (run("uv", ["--version"], { stdio: "ignore" }) !== 0) fail("uv is needed to set up the music environment. Install it (https://docs.astral.sh/uv/getting-started/installation/), then run npm run setup:music again.");

if (!existsSync(py)) {
  info(`creating ${name} (Python 3.12)`);
  if (run("uv", ["venv", "--python", "3.12", venv]) !== 0) fail(`uv could not create ${name}.`);
}
let reqs = join(ROOT, "requirements-music.txt");
let text = readFileSync(reqs, "utf8");
if (flags.cpu) text = text.replace(/\/whl\/cu\d+/g, "/whl/cpu").replace(/\+cu\d+/g, "+cpu").replace(/^flash_attn @ .*$/m, "");
else if (process.platform !== "win32") text = text.replace(/win_amd64\.whl/, "linux_x86_64.whl");
if (text !== readFileSync(reqs, "utf8")) {
  mkdirSync(join(ROOT, "out"), { recursive: true });
  reqs = join(ROOT, "out", "requirements-music-local.txt");
  writeFileSync(reqs, text);
}
info(`installing requirements-music.txt into ${name} (several GB the first time)`);
if (run("uv", ["pip", "install", "--python", py, "--index-strategy", "unsafe-best-match", "-r", reqs]) !== 0) fail("install failed (see output above).");

const cuda = run(py, ["-c", "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 3)"]) === 0;
const fa = !flags.cpu && run(py, ["-c", "import flash_attn"], { stdio: "ignore" }) === 0;
if (!cuda) warn("no CUDA GPU visible: only the small-music model will run (on the CPU). Set music_gen.model: small-music in config.yaml.");
else if (!fa) warn("Flash Attention did not import, so the medium model won't run. Use music_gen.model: small-music, or install a flash-attn wheel that matches torch 2.7 / your CUDA / Python 3.12.");
ok(`music environment ready${cuda ? " (CUDA GPU found" + (fa ? ", Flash Attention OK)" : ")") : " (CPU only)"}.`);
console.log(`
Before the first bed: the models are gated on Hugging Face (approval is automatic).
  1. Accept the terms: https://huggingface.co/stabilityai/stable-audio-3-medium  (and stable-audio-3-small-music)
  2. Log in once:      ${join(venv, process.platform === "win32" ? "Scripts" : "bin", "hf").replace(ROOT, ".")} auth login   (or put HF_TOKEN=... in .env)
  3. Commercial use (a monetized channel) needs the free registration at https://stability.ai/community-license
Try it: npm run compose -- --sample "dark ambient synth pulse, 90 BPM" --seconds 20`);
