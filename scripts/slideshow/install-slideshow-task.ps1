# Registers (or with -Remove, deletes) the scheduled task that runs scripts/slideshow/slideshow.ps1 at logon, hidden,
# for as long as you're signed in, and starts it now. Options pass through to the slideshow, e.g.
#   scripts/slideshow/install-slideshow-task.ps1 -IdleMinutes 10 -IntervalMinutes 1 -FadeSeconds 1.5 -Folder C:\backgrounds -DimFromHour 0 -DimUntilHour 6 -DimBrightness 0.3
param([switch]$Remove, [string]$Folder = "C:\backgrounds", [double]$IdleMinutes = 5, [double]$IntervalMinutes = 1, [double]$FadeSeconds = 1.5, [int]$DimFromHour = 0, [int]$DimUntilHour = 6, [double]$DimBrightness = 0.3)
$name = "BriefKit slideshow"
function Stop-Slideshow {
  Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'slideshow\\slideshow\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
if ($Remove) { Stop-Slideshow; Unregister-ScheduledTask -TaskName $name -Confirm:$false; "removed: $name"; return }

$script = Join-Path $PSScriptRoot "slideshow.ps1"
$argLine = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$script`" -Folder `"$Folder`" -IdleMinutes $IdleMinutes -IntervalMinutes $IntervalMinutes -FadeSeconds $FadeSeconds -DimFromHour $DimFromHour -DimUntilHour $DimUntilHour -DimBrightness $DimBrightness"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argLine -WorkingDirectory (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description "Idle slideshow from $Folder, paused while other BriefKit tasks run (scripts/slideshow/slideshow.ps1)" -Force |
  Select-Object TaskName, State
Stop-Slideshow
Start-ScheduledTask -TaskName $name
Start-Sleep -Seconds 3
(Get-ScheduledTask -TaskName $name).State
