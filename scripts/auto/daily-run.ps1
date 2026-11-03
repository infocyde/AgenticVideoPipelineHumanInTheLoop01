# Scheduled auto run (Task Scheduler "BriefKit auto long Shorts", 05:00 and 17:00).
# Opens Claude Code interactively in its own window in this repo (browser extension on, auto permission mode, Opus at
# high effort), with a first message that runs the recon skill and then, when config.yaml auto_long_shorts.enabled is
# true, the auto-long-shorts skill (3 long Shorts, end to end, uploaded as Private); false = recon only. This script stays behind as the supervisor: it keeps the PC awake, waits until the
# run report says "Status: done" (or the window closes, or 10 hours pass), then closes the window.
# Interactive, not `claude -p`: a print-mode session exits when its turn ends and kills the background agents that
# produce the Shorts (seen 2026-11-01 00:39).
# Files: recon/runs/<date>-<HHmm>.md (run report), .log (this supervisor), .prompt.txt. One run at a time (.lock).
# Install or remove the task: scripts/auto/install-task.ps1 [-Remove]. Run by hand: Start-ScheduledTask -TaskName
#   "BriefKit auto long Shorts", or this file with -SkipRecon to make Shorts from the newest recon report.
param([switch]$SkipRecon)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo
$runs = Join-Path $repo "recon\runs"
New-Item -ItemType Directory -Force $runs | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$log = Join-Path $runs "$stamp.log"
$report = Join-Path $runs "$stamp.md"
$promptFile = Join-Path $runs "$stamp.prompt.txt"
$lock = Join-Path $runs ".lock"
function Note($m) { try { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) } catch {} }

# One run at a time: the lock names the previous run's claude process; skip while it is alive (and under 11 hours).
if (Test-Path $lock) {
  $old = Get-Content $lock -ErrorAction SilentlyContinue | Select-Object -First 1
  $alive = $old -and (Get-Process -Id ([int]$old) -ErrorAction SilentlyContinue)
  if ($alive -and ((Get-Date) - (Get-Item $lock).LastWriteTime).TotalHours -lt 11) {
    Note "skipped: the previous run (claude pid $old) is still going"
    exit 0
  }
  if ($alive) { Note "closing a previous run older than 11 hours (pid $old)"; taskkill /PID $old /T /F | Out-Null }
}

try {
  # Keep the PC awake while the run goes (decimal: Windows PowerShell reads 0x80000001 as a negative Int32).
  try {
    Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
    [Win32.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
  } catch { Note "keep-awake unavailable: $_" }

  # The browser extension lives in Brave: start it if it isn't running, and give the extension time to connect.
  if (-not (Get-Process brave -ErrorAction SilentlyContinue)) {
    Note "starting Brave"
    Start-Process "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
    Start-Sleep -Seconds 30
  }

  # config.yaml auto_long_shorts.enabled (default true when missing): false = recon only, no Shorts are built.
  $build = $true
  $inBlock = $false
  foreach ($line in Get-Content (Join-Path $repo "config.yaml")) {
    if ($line -match '^auto_long_shorts:') { $inBlock = $true; continue }
    if ($inBlock -and $line -match '^\S') { break }
    if ($inBlock -and $line -match '^\s+enabled:\s*(true|false)\b') { $build = $Matches[1] -eq 'true'; break }
  }
  if (-not $build -and $SkipRecon) { Note "auto_long_shorts.enabled is false and -SkipRecon was given: nothing to do"; exit 0 }
  Note ("mode: " + $(if ($build) { "recon + long Shorts" } else { "recon only (auto_long_shorts.enabled: false)" }))

  $step1 = if ($SkipRecon) { "1. Skip recon this time: use the newest recon report in recon/ (manual rerun)." } else { "1. Run the recon skill (read-only on X)." }
  if (-not $build) {
  @"
Scheduled recon run $stamp, started by scripts/auto/daily-run.ps1. Nobody is watching this window.

1. Run the recon skill (read-only on X).
2. Do NOT run the auto-long-shorts skill and make no videos: config.yaml auto_long_shorts.enabled is false (recon only).
3. Write the run report recon/runs/$stamp.md: the recon report's path and its top ideas, one line each.

Never ask a question: there is no one to answer. On a blocking problem (browser not connected, an X login or
CAPTCHA page), write it in the run report and stop. The last line of the run report must be "Status: done" (or
"Status: stopped: <reason>"); this window is closed once it is there.
"@ | Set-Content -Path $promptFile -Encoding utf8
  } else {
  @"
Scheduled auto run $stamp, started by scripts/auto/daily-run.ps1. Nobody is watching this window.

$step1
2. Then run the auto-long-shorts skill on that report. Its run report is recon/runs/$stamp.md.

Never ask a question: there is no one to answer. On a blocking problem (browser not connected, an X login or
CAPTCHA page, a full disk), write it in the run report and stop. Keep going until every Short is uploaded or
accounted for: wait for your agents' reports, don't end early. Upload each Short as soon as it is rendered,
before rendering the next; never save the uploads for the end. Keep agents few: at most auto_long_shorts.max_agents
(config.yaml) running at once, nested ones included; queue the rest. The last line of the run report must be
"Status: done" (or "Status: stopped: <reason>"); this window is closed once it is there.
"@ | Set-Content -Path $promptFile -Encoding utf8
  }

  $claude = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
  $first = "Scheduled auto run: read recon/runs/$stamp.prompt.txt and do exactly what it says."
  $p = Start-Process -FilePath $claude -WorkingDirectory $repo -PassThru -ArgumentList @(
    "--chrome", "--permission-mode", "auto", "--model", "opus", "--effort", "high", "`"$first`"")
  Set-Content -Path $lock -Value $p.Id
  Note "claude started in its own window (pid $($p.Id)); run report recon/runs/$stamp.md"

  # Supervise: every minute, look for the end marker in the run report; stop at 10 hours.
  $deadline = (Get-Date).AddHours(10)
  while ($true) {
    Start-Sleep -Seconds 60
    if ($p.HasExited) { Note "the claude window closed (exit $($p.ExitCode))"; break }
    $tail = if (Test-Path $report) { (Get-Content $report -Tail 3 -ErrorAction SilentlyContinue) -join "`n" } else { "" }
    if ($tail -match "Status: (done|stopped)") { Note "run report says: $($Matches[0]); closing the window in 2 minutes"; Start-Sleep -Seconds 120; break }
    if ((Get-Date) -gt $deadline) { Note "10-hour limit reached; closing the window"; break }
  }
  if (-not $p.HasExited) { taskkill /PID $p.Id /T /F | Out-Null }
  Note "finished"
}
catch { Note "runner error: $_" }
finally {
  try { [Win32.Power]::SetThreadExecutionState([uint32]2147483648) | Out-Null } catch {}
  Remove-Item $lock -ErrorAction SilentlyContinue
}
