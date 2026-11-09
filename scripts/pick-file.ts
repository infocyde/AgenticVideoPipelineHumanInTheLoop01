// Fill a browser's native "Open" file dialog with a file and press Open (Windows only). For the YouTube upload:
// click "Select files" in Studio through Claude in Chrome first, then run this; the browser reads the file from disk,
// so there's no size cap (the extension's file_upload tool stops at 10 MB). Drives the dialog by UI Automation
// (scripts/pick_file.py, pywinauto in .venv), so the mouse doesn't move.
// Usage: npm run pick-file -- <path> [--tab "<tab title start>"] [--stay] [--timeout 20] [--save]
// --tab brings that tab to the front (a browser only opens a file chooser for the visible tab), then switches back
// to the tab that was in front once the file is picked, unless --stay. Start it in the background, then click.
// --save fills the browser's Save dialog instead, so a page's download lands at <path> (the grok-imagine skill).
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { blockMessage, checkUpload, slugFromPath } from "./lib/upload.ts";
import { fail, info, parseArgs, ROOT, run, venvPython } from "./lib/util.ts";

if (process.platform !== "win32") fail("pick-file drives the Windows Open dialog; it only runs on Windows");

const { positional, flags } = parseArgs();
const file = positional[0];
if (!file) fail('usage: npm run pick-file -- <path> [--tab "<tab title start>"] [--stay] [--timeout 20] [--save]');
const abs = resolve(ROOT, file);

const py = venvPython();
if (!existsSync(py)) fail("no .venv: run npm run setup:align first");
const args = [resolve(ROOT, "scripts", "pick_file.py"), abs];
if (typeof flags.timeout === "string") args.push("--timeout", flags.timeout);
if (typeof flags.tab === "string") args.push("--tab", flags.tab);
if (flags.stay) args.push("--stay");

// --save: fill the browser's Save dialog, so a page's download lands at this path. Nothing leaves the machine, so the
// upload rule below doesn't apply. It never overwrites: Windows would stop on a confirmation box.
if (flags.save) {
  if (existsSync(abs)) fail(`${abs} already exists; move it or pick another path.`);
  mkdirSync(dirname(abs), { recursive: true });
  info(`waiting for the browser's Save dialog to save ${abs}`);
  process.exit(run(py, [...args, "--save"]));
}

if (!existsSync(abs) || !statSync(abs).isFile()) fail(`no such file: ${abs}`);
// Videos for another channel (config.yaml upload.blocked_themes) never go into an upload dialog.
const fileSlug = slugFromPath(abs, ROOT);
if (fileSlug) {
  const block = checkUpload(fileSlug);
  if (block.blocked) fail(`not picking ${abs}: ${blockMessage(fileSlug, block)}. Upload it to that channel yourself.`);
}

info(`waiting for the browser's Open dialog to pick ${abs} (${(statSync(abs).size / 1e6).toFixed(1)} MB)`);
process.exit(run(py, args));
