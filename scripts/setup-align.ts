// One-time setup for `npm run align`: creates .venv and installs faster-whisper.
// Usage: npm run setup:align
import { existsSync } from "node:fs";
import { fail, info, ok, run, venvPython } from "./lib/util.ts";

const py = venvPython();
if (!existsSync(py)) {
  info("creating .venv");
  const sys = process.platform === "win32" ? "python" : "python3";
  if (run(sys, ["-m", "venv", ".venv"]) !== 0) fail(`Could not create .venv with "${sys} -m venv". Is Python 3.10+ on PATH?`);
}
info("installing faster-whisper and numpy into .venv (a few minutes the first time)");
if (run(py, ["-m", "pip", "install", "--disable-pip-version-check", "-q", "faster-whisper", "numpy"]) !== 0) fail("pip install failed (see output above).");
ok("alignment ready. The Whisper model (medium.en, ~1.5 GB) downloads on the first `npm run align`.");
