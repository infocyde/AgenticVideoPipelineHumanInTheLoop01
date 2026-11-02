# Scheduled analytics run (Task Scheduler "BriefKit vidanalysis", Monday and Thursday 12:01 PM).
# Opens Claude Code interactively in its own window in this repo (browser extension on, auto permission mode, Opus at
# high effort) with a first message that runs the vidanalysis skill: a Sonnet agent reads YouTube Studio read-only,
# Opus compares the snapshot with the last report and writes analytics/vidanalysis/<date>.md. This script supervises:
# it keeps the PC awake, waits until that log ends with "Status: done" (or the window closes, or 2 hours pass), then
# closes the window. Interactive, not `claude -p`, so the gathering agent isn't killed when the turn ends.
# Files: analytics/vidanalysis/runs/<date>-<HHmm>.log (this supervisor) and .prompt.txt. One run at a time (.lock).
# Install or remove the task: scripts/auto/install-vidanalysis-task.ps1 [-Remove]. Run by hand:
#   Start-ScheduledTask -TaskName "BriefKit vidanalysis"
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo
$dir = Join-Path $repo "analytics\vidanalysis"
$runs = Join-Path $dir "runs"
New-Item -ItemType Directory -Force $runs | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$log = Join-Path $runs "$stamp.log"
$promptFile = Join-Path $runs "$stamp.prompt.txt"
$lock = Join-Path $runs ".lock"
function Note($m) { try { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) } catch {} }

if (Test-Path $lock) {
  $old = Get-Content $lock -ErrorAction SilentlyContinue | Select-Object -First 1
  $alive = $old -and (Get-Process -Id ([int]$old) -ErrorAction SilentlyContinue)
  if ($alive -and ((Get-Date) - (Get-Item $lock).LastWriteTime).TotalHours -lt 3) {
    Note "skipped: the previous run (claude pid $old) is still going"
    exit 0
  }
  if ($alive) { Note "closing a previous run older than 3 hours (pid $old)"; taskkill /PID $old /T /F | Out-Null }
}

try {
  try {
    Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
    [Win32.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
  } catch { Note "keep-awake unavailable: $_" }

  if (-not (Get-Process brave -ErrorAction SilentlyContinue)) {
    Note "starting Brave"
    Start-Process "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
    Start-Sleep -Seconds 30
  }

  # Snapshot files that exist before the run; the new log is the .md that appears after this point.
  $before = @(Get-ChildItem $dir -Filter *.md -File -ErrorAction SilentlyContinue | ForEach-Object Name)
  @"
Scheduled analytics run $stamp, started by scripts/auto/vidanalysis-run.ps1. Nobody is watching this window.

Run the vidanalysis skill: gather with a Sonnet agent, analyse yourself (Opus), compare with the last report.
Read-only in YouTube Studio: never change a video, a setting or visibility.

Never ask a question: there is no one to answer. On a blocking problem (browser not connected, a sign-in page),
write what happened in the log and stop. The last line of the log must be "Status: done" (or
"Status: stopped: <reason>"); this window is closed once it is there.
"@ | Set-Content -Path $promptFile -Encoding utf8

  $claude = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
  $first = "Scheduled analytics run: read analytics/vidanalysis/runs/$stamp.prompt.txt and do exactly what it says."
  $p = Start-Process -FilePath $claude -WorkingDirectory $repo -PassThru -ArgumentList @(
    "--chrome", "--permission-mode", "auto", "--model", "opus", "--effort", "high", "`"$first`"")
  Set-Content -Path $lock -Value $p.Id
  Note "claude started in its own window (pid $($p.Id))"

  $deadline = (Get-Date).AddHours(2)
  while ($true) {
    Start-Sleep -Seconds 60
    if ($p.HasExited) { Note "the claude window closed (exit $($p.ExitCode))"; break }
    $new = Get-ChildItem $dir -Filter *.md -File -ErrorAction SilentlyContinue |
      Where-Object { $before -notcontains $_.Name -or $_.LastWriteTime -gt (Get-Item $promptFile).LastWriteTime } |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $tail = if ($new) { (Get-Content $new.FullName -Tail 3 -ErrorAction SilentlyContinue) -join "`n" } else { "" }
    if ($tail -match "Status: (done|stopped)") { Note "$($new.Name) says: $($Matches[0]); closing the window in 2 minutes"; Start-Sleep -Seconds 120; break }
    if ((Get-Date) -gt $deadline) { Note "2-hour limit reached; closing the window"; break }
  }
  if (-not $p.HasExited) { taskkill /PID $p.Id /T /F | Out-Null }
  Note "finished"
}
catch { Note "runner error: $_" }
finally {
  try { [Win32.Power]::SetThreadExecutionState([uint32]2147483648) | Out-Null } catch {}
  Remove-Item $lock -ErrorAction SilentlyContinue
}
