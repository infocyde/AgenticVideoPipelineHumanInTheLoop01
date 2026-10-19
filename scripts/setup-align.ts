// One-time setup for `npm run align`: creates .venv and installs requirements.txt (faster-whisper, numpy, ddgs).
// Usage: npm run setup:align
import { existsSync } from "node:fs";
import { fail, info, ok, run, venvPython } from "./lib/util.ts";

const py = venvPython();
if (!existsSync(py)) {
  info("creating .venv");
  const sys = process.platform === "win32" ? "python" : "python3";
  if (run(sys, ["-m", "venv", ".venv"]) !== 0) fail(`Could not create .venv with "${sys} -m venv". Is Python 3.10+ on PATH?`);
}
info("installing requirements.txt into .venv (a few minutes the first time)");
if (run(py, ["-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", "requirements.txt"]) !== 0) fail("pip install failed (see output above).");
ok("alignment ready. The Whisper model (medium.en, ~1.5 GB) downloads on the first `npm run align`.");
