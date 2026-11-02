# Registers (or with -Remove, deletes) the Windows scheduled task that runs scripts/auto/daily-run.ps1 at 05:00 and
# 17:00 every day. It runs as you, only while you're signed in (the browser and the file picker need your desktop),
# wakes the PC for it, catches up a missed start, and stops after 10 hours.
param([switch]$Remove)
$name = "BriefKit auto long Shorts"
if ($Remove) { Unregister-ScheduledTask -TaskName $name -Confirm:$false; "removed: $name"; return }

$script = Join-Path $PSScriptRoot "daily-run.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$script`"" `
  -WorkingDirectory (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$triggers = @((New-ScheduledTaskTrigger -Daily -At 5:00AM), (New-ScheduledTaskTrigger -Daily -At 5:00PM))
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers -Settings $settings -Principal $principal `
  -Description "Brief Kit: recon, then 3 long Shorts end to end, uploaded Private (scripts/auto/daily-run.ps1)" -Force |
  Select-Object TaskName, State
(Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo).NextRunTime
