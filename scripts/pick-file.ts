// Fill a browser's native "Open" file dialog with a file and press Open (Windows only). For the YouTube upload:
// click "Select files" in Studio through Claude in Chrome first, then run this; the browser reads the file from disk,
// so there's no size cap (the extension's file_upload tool stops at 10 MB). Drives the dialog by UI Automation
// (scripts/pick_file.py, pywinauto in .venv), so the mouse doesn't move.
// Usage: npm run pick-file -- <path> [--tab "<tab title start>"] [--stay] [--timeout 20]
// --tab brings that tab to the front (a browser only opens a file chooser for the visible tab), then switches back
// to the tab that was in front once the file is picked, unless --stay. Start it in the background, then click.
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fail, info, parseArgs, ROOT, run, venvPython } from "./lib/util.ts";

if (process.platform !== "win32") fail("pick-file drives the Windows Open dialog; it only runs on Windows");

const { positional, flags } = parseArgs();
const file = positional[0];
if (!file) fail('usage: npm run pick-file -- <path> [--tab "<tab title start>"] [--stay] [--timeout 20]');
const abs = resolve(ROOT, file);
if (!existsSync(abs) || !statSync(abs).isFile()) fail(`no such file: ${abs}`);

const py = venvPython();
if (!existsSync(py)) fail("no .venv: run npm run setup:align first");

info(`waiting for the browser's Open dialog to pick ${abs} (${(statSync(abs).size / 1e6).toFixed(1)} MB)`);
const args = [resolve(ROOT, "scripts", "pick_file.py"), abs];
if (typeof flags.timeout === "string") args.push("--timeout", flags.timeout);
if (typeof flags.tab === "string") args.push("--tab", flags.tab);
if (flags.stay) args.push("--stay");
process.exit(run(py, args));
