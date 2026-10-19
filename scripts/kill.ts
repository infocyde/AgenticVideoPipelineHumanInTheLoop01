// Stop render processes left behind by an interrupted render, touching only processes that run from this repo
// (Remotion's chrome-headless-shell, its bundled ffmpeg/ffprobe/remotion.exe, and node processes running its CLI).
// Usage: npm run kill
import { spawnSync } from "node:child_process";
import { info, ok, ROOT } from "./lib/util.ts";

if (process.platform === "win32") {
  const root = ROOT.replace(/'/g, "''");
  const ps = `
$root = '${root}'
$me = ${process.pid}
$procs = Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $me -and $_.ProcessId -ne ${process.ppid} -and (
    ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) -or
    ($_.Name -eq 'node.exe' -and $_.CommandLine -like "*$root*remotion*" -and $_.CommandLine -notlike '*kill.ts*')
  )
}
foreach ($p in $procs) { Write-Output "$($p.ProcessId) $($p.Name)"; Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
`;
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8" });
  const killed = r.stdout.trim().split(/\r?\n/).filter(Boolean);
  killed.forEach((k) => info(`stopped ${k}`));
  ok(killed.length ? `stopped ${killed.length} process(es) from ${ROOT}` : "no leftover render processes from this repo");
} else {
  const r = spawnSync("pkill", ["-f", `${ROOT}/node_modules`], { encoding: "utf8" });
  ok(r.status === 0 ? "stopped leftover render processes" : "no leftover render processes from this repo");
}
