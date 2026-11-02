# Registers (or with -Remove, deletes) the Windows scheduled task that runs scripts/auto/vidanalysis-run.ps1 every
# Monday and Thursday at 12:01 PM. It runs as you, only while you're signed in (the browser needs your desktop), wakes
# the PC for it, catches up a missed start, and stops after 2 hours.
param([switch]$Remove)
$name = "BriefKit vidanalysis"
if ($Remove) { Unregister-ScheduledTask -TaskName $name -Confirm:$false; "removed: $name"; return }

$script = Join-Path $PSScriptRoot "vidanalysis-run.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$script`"" `
  -WorkingDirectory (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Thursday -At 12:01PM
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description "Brief Kit: YouTube analytics snapshot vs the last report (vidanalysis skill; scripts/auto/vidanalysis-run.ps1)" -Force |
  Select-Object TaskName, State
(Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo).NextRunTime
