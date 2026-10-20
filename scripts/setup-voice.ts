// One-time setup for `npm run voice`: creates .venv-tts (Python 3.12, which Kokoro needs) and installs
// requirements-tts.txt (CUDA PyTorch, Chatterbox, Kokoro). Kept apart from .venv (align) because PyTorch is large and
// pins its own numpy. Uses uv (https://docs.astral.sh/uv/) to fetch Python 3.12 if it isn't installed.
// With --qwen it sets up .venv-qwen from requirements-qwen.txt instead (Qwen3-TTS pins a different transformers than
// Chatterbox, so it gets its own environment; uv reuses the PyTorch it already downloaded).
// Usage: npm run setup:voice [--qwen] [--cpu]   (--cpu: CPU-only PyTorch, for machines without an NVIDIA GPU; slow)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, info, ok, parseArgs, ROOT, run } from "./lib/util.ts";

const { flags } = parseArgs();
const qwen = !!flags.qwen;
const name = qwen ? ".venv-qwen" : ".venv-tts";
const venv = join(ROOT, name);
const py = process.platform === "win32" ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");
const hasUv = run("uv", ["--version"], { stdio: "ignore" }) === 0;
if (!hasUv) fail("uv is needed to set up the TTS environment. Install it (https://docs.astral.sh/uv/getting-started/installation/), then run npm run setup:voice again.");

if (!existsSync(py)) {
  info(`creating ${name} (Python 3.12)`);
  if (run("uv", ["venv", "--python", "3.12", venv]) !== 0) fail(`uv could not create ${name}.`);
}
const file = qwen ? "requirements-qwen.txt" : "requirements-tts.txt";
let reqs = join(ROOT, file);
if (flags.cpu) {
  // same pins, CPU wheels
  const cpu = readFileSync(reqs, "utf8").replace(/\/whl\/cu\d+/g, "/whl/cpu").replace(/\+cu\d+/g, "+cpu");
  mkdirSync(join(ROOT, "out"), { recursive: true });
  reqs = join(ROOT, "out", file.replace(".txt", "-cpu.txt"));
  writeFileSync(reqs, cpu);
}
info(`installing ${file} into ${name} (several GB the first time)`);
const code = run("uv", ["pip", "install", "--python", py, "--index-strategy", "unsafe-best-match", "-r", reqs]);
if (code !== 0) fail("install failed (see output above).");
const cuda = run(py, ["-c", "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 3)"]);
const gpu = cuda === 0 ? " (CUDA GPU found)" : " (no CUDA GPU: it will run on the CPU, slowly)";
if (qwen) {
  ok(`Qwen3-TTS ready${gpu}. The model downloads on first use (1.7B ~4.5 GB, 0.6B ~2.5 GB).`);
  console.log('Try it: npm run voice -- --sample "A line to try." --engine qwen');
} else {
  ok(`voice ready${gpu}. Models download on first use (Chatterbox ~2 GB, Kokoro ~330 MB).`);
  console.log('Try it: npm run voice -- --sample "A line to try." --engine kokoro');
}
