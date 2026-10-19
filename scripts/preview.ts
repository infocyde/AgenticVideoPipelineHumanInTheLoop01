// Open Remotion Studio in the browser on one episode, so the user can watch it before rendering.
// Runs check first (problems are listed here and shown as a red panel over the video; they don't block preview).
// Usage: npm run preview -- <slug> [--port 3000] [--no-open]
// Keeps running until stopped (Ctrl+C, or `npm run kill`).
import { spawn } from "node:child_process";
import { join } from "node:path";
import { printIssues } from "./check.ts";
import { runCheck } from "./lib/check.ts";
import { fail, info, ok, parseArgs, requireSlug, ROOT } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run preview -- <slug> [--port N] [--no-open]");
const { flags } = parseArgs();
sync();
printIssues(slug, runCheck(slug));

const openBrowser = (url: string) => {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
};

const args = [join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js"), "studio", "src/index.ts", "--no-open"];
if (typeof flags.port === "string") args.push(`--port=${flags.port}`);

info("starting Remotion Studio…");
const studio = spawn(process.execPath, args, { cwd: ROOT, stdio: ["inherit", "pipe", "inherit"] });
let opened = false;
studio.stdout.on("data", (chunk: Buffer) => {
  process.stdout.write(chunk);
  if (opened) return;
  // eslint-disable-next-line no-control-regex
  const text = chunk.toString().replace(/\x1b\[[0-9;]*m/g, "");
  const m = text.match(/Local:\s*(http:\/\/[^\s,]+)/);
  if (!m) return;
  opened = true;
  const url = `${m[1].replace(/\/$/, "")}/${slug}`;
  ok(`preview ready: ${url}`);
  if (!flags["no-open"]) openBrowser(url);
});
studio.on("exit", (code) => {
  if (!opened) fail(`Remotion Studio exited before it was ready (code ${code})`);
  process.exit(code ?? 0);
});
process.on("SIGINT", () => studio.kill());
