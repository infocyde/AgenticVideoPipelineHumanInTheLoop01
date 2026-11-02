# Idle slideshow: full-screen images from a folder, like a screensaver, that never gets in the way of automation.
# Runs in the background from logon (Task Scheduler "BriefKit slideshow"; install: scripts/slideshow/install-slideshow-task.ps1).
#   - After -IdleMinutes with no keyboard or mouse input, covers every screen with an image from -Folder, scaled to
#     fit on black. Every -IntervalMinutes the next image crossfades in over -FadeSeconds (the first fades in from black).
#   - Order is random: the folder is shuffled, so nothing repeats until every image has shown; then it reshuffles
#     (and picks up new files).
#   - Esc, any key, a click or a real mouse move closes it. It shows again after the next idle stretch.
#   - Paused while automation runs: any other "BriefKit*" scheduled task in the Running state (the auto run,
#     vidanalysis, ...), a live run lock (recon/runs/.lock, analytics/vidanalysis/runs/.lock), or the pause file
#     out/slideshow/pause (empty = paused while it exists; or holding a PID = paused while that process lives).
#     If the slideshow was up when automation started, it comes back when automation ends (unless you're active).
# How the fade works: two borderless topmost windows per screen. The back one holds the current image; the front one
# gets the next image at opacity 0 and fades to 1 (composited by Windows, so it's cheap), then the back one takes
# the image and the front one hides.
# Formats: jpg, jpeg, png, bmp, gif, tif (System.Drawing can't read webp or heic; those are skipped).
# Night dimming: from -DimFromHour until -DimUntilHour (local time; default midnight to 6:00 AM) each image is drawn
# at -DimBrightness (default 0.3 = 30%) by a black overlay. Decided per image, so the change shows within one interval.
# -DimBrightness 1 turns it off.
# Log: out/slideshow/slideshow.log. One instance per user session (named mutex). Test now: add -Now.
param(
  [string]$Folder = "C:\backgrounds",
  [double]$IdleMinutes = 5,
  [double]$IntervalMinutes = 1,
  [double]$FadeSeconds = 1.5,
  [int]$DimFromHour = 0,
  [int]$DimUntilHour = 6,
  [double]$DimBrightness = 0.3,
  [switch]$Now
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class SlideIdle {
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
  public static double Seconds() {
    var i = new LASTINPUTINFO(); i.cbSize = (uint)Marshal.SizeOf(i);
    if (!GetLastInputInfo(ref i)) return 0;
    return unchecked((uint)Environment.TickCount - i.dwTime) / 1000.0;
  }
}
"@

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outDir = Join-Path $repo "out\slideshow"
New-Item -ItemType Directory -Force $outDir | Out-Null
$log = Join-Path $outDir "slideshow.log"
$pauseFile = Join-Path $outDir "pause"
$locks = @((Join-Path $repo "recon\runs\.lock"), (Join-Path $repo "analytics\vidanalysis\runs\.lock"))
$exts = @(".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff")
function Note($m) { try { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) } catch {} }

$created = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\BriefKitSlideshow", [ref]$created)
if (-not $created) { exit 0 }
Note "started (folder $Folder, idle $IdleMinutes min, every $IntervalMinutes min, fade $FadeSeconds s, dim to $DimBrightness from ${DimFromHour}:00 to ${DimUntilHour}:00, pid $PID)"

# --- state
$script:pairs = @()          # per screen: Back, BackBox, Front, FrontBox, W, H
$script:queue = New-Object System.Collections.Queue
$script:shownAt = [datetime]::MinValue
$script:startPos = $null
$script:cursorHidden = $false
$script:auto = $false
$script:autoChecked = [datetime]::MinValue
$script:resumeAfterAuto = $false
$script:forceShow = [bool]$Now
$fadeStep = [math]::Min(1.0, 0.03 / [math]::Max(0.05, $FadeSeconds))   # opacity per 30 ms frame

function Test-Automation {
  try {
    $running = Get-ScheduledTask -ErrorAction Stop | Where-Object {
      $_.TaskName -like "BriefKit*" -and $_.TaskName -ne "BriefKit slideshow" -and $_.State -eq "Running" }
    if ($running) { return $true }
  } catch {}
  foreach ($l in $locks) {
    if (Test-Path $l) {
      $p = Get-Content $l -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($p -match '^\d+$' -and (Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue)) { return $true }
    }
  }
  if (Test-Path $pauseFile) {
    $p = (Get-Content $pauseFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $p) { return $true }
    if ($p -match '^\d+$' -and (Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue)) { return $true }
  }
  return $false
}

function Fill-Queue {
  $files = @(Get-ChildItem -LiteralPath $Folder -File -ErrorAction SilentlyContinue | Where-Object { $exts -contains $_.Extension.ToLower() })
  if ($files.Count -gt 0) { $files | Get-Random -Count $files.Count | ForEach-Object { $script:queue.Enqueue($_.FullName) } }
}

# Decode the next readable image (EXIF orientation applied). Returns a System.Drawing.Image or $null.
function Read-Next {
  for ($try = 0; $try -lt 20; $try++) {
    if ($script:queue.Count -eq 0) { Fill-Queue }
    if ($script:queue.Count -eq 0) { return $null }
    $path = $script:queue.Dequeue()
    try {
      $ms = New-Object System.IO.MemoryStream(, [System.IO.File]::ReadAllBytes($path))
      $im = [System.Drawing.Image]::FromStream($ms)
      if ($im.PropertyIdList -contains 0x0112) {
        switch ([int]$im.GetPropertyItem(0x0112).Value[0]) {
          3 { $im.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
          6 { $im.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
          8 { $im.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
        }
      }
      Note "image $(Split-Path -Leaf $path)"
      return @{ Image = $im; Stream = $ms }
    } catch { Note "skipped $path : $($_.Exception.Message)" }
  }
  return $null
}

# True inside the night window [DimFromHour, DimUntilHour); handles a window that wraps past midnight (e.g. 22 to 6).
function Test-DimHours {
  if ($DimBrightness -ge 1 -or $DimFromHour -eq $DimUntilHour) { return $false }
  $h = (Get-Date).Hour
  if ($DimFromHour -lt $DimUntilHour) { return ($h -ge $DimFromHour -and $h -lt $DimUntilHour) }
  return ($h -ge $DimFromHour -or $h -lt $DimUntilHour)
}

# Scale an image to fit a w x h black canvas (letterboxed), so each window just blits a screen-sized bitmap.
# In the night window, darken it with a black overlay down to DimBrightness.
function Fit-Bitmap($im, [int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Black)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $s = [math]::Min($w / $im.Width, $h / $im.Height)
  $dw = [int]($im.Width * $s); $dh = [int]($im.Height * $s)
  $g.DrawImage($im, [int](($w - $dw) / 2), [int](($h - $dh) / 2), $dw, $dh)
  if (Test-DimHours) {
    $a = [int][math]::Round(255 * (1 - [math]::Max(0.0, [math]::Min(1.0, $DimBrightness))))
    $br = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($a, 0, 0, 0))
    $g.FillRectangle($br, 0, 0, $w, $h); $br.Dispose()
  }
  $g.Dispose()
  return $bmp
}

function New-SlideForm($screen) {
  $f = New-Object System.Windows.Forms.Form
  $f.FormBorderStyle = "None"; $f.StartPosition = "Manual"; $f.Bounds = $screen.Bounds
  $f.TopMost = $true; $f.ShowInTaskbar = $false; $f.BackColor = [System.Drawing.Color]::Black; $f.KeyPreview = $true
  $pb = New-Object System.Windows.Forms.PictureBox
  $pb.Dock = "Fill"; $pb.SizeMode = "Normal"; $pb.BackColor = [System.Drawing.Color]::Black
  $f.Controls.Add($pb)
  $f.Add_KeyDown({ Hide-Slides "key $($_.KeyCode)" })
  $pb.Add_MouseDown({ Hide-Slides "click" })
  $pb.Add_MouseMove({
    $p = [System.Windows.Forms.Cursor]::Position
    if ($script:startPos -and ([math]::Abs($p.X - $script:startPos.X) + [math]::Abs($p.Y - $script:startPos.Y)) -gt 12) { Hide-Slides "mouse" }
  })
  return @($f, $pb)
}

# Put the next image on every front window at opacity 0 and start the fade.
function Start-Next {
  $r = Read-Next
  if (-not $r) { return $false }
  foreach ($p in $script:pairs) {
    if ($p.FrontBox.Image) { $p.FrontBox.Image.Dispose() }
    $p.FrontBox.Image = Fit-Bitmap $r.Image $p.W $p.H
    $p.Front.Opacity = 0
    if (-not $p.Front.Visible) { $p.Front.Show() }
    $p.Front.BringToFront()
  }
  $r.Image.Dispose(); $r.Stream.Dispose()
  $script:shownAt = Get-Date
  $fadeTimer.Start()
  return $true
}

function Hide-Slides([string]$why) {
  if ($script:pairs.Count -eq 0) { return }
  $fadeTimer.Stop()
  foreach ($p in $script:pairs) {
    foreach ($b in @($p.BackBox, $p.FrontBox)) { if ($b.Image) { $i = $b.Image; $b.Image = $null; $i.Dispose() } }
    foreach ($f in @($p.Front, $p.Back)) { try { $f.Close() } catch {} }   # Close disposes a modeless form; safe in its own event
  }
  $script:pairs = @()
  if ($script:cursorHidden) { [System.Windows.Forms.Cursor]::Show(); $script:cursorHidden = $false }
  Note "hidden ($why)"
}

function Show-Slides {
  if ($script:pairs.Count -gt 0) { return }
  $script:startPos = [System.Windows.Forms.Cursor]::Position
  foreach ($s in [System.Windows.Forms.Screen]::AllScreens) {
    $back = New-SlideForm $s; $front = New-SlideForm $s
    $script:pairs += @{ Back = $back[0]; BackBox = $back[1]; Front = $front[0]; FrontBox = $front[1]; W = $s.Bounds.Width; H = $s.Bounds.Height }
  }
  foreach ($p in $script:pairs) { $p.Back.Show() }        # black backdrop; the first image fades in over it
  if (-not (Start-Next)) { Note "no readable images in $Folder"; Hide-Slides "no images"; return }
  if (-not $script:cursorHidden) { [System.Windows.Forms.Cursor]::Hide(); $script:cursorHidden = $true }
  Note "shown"
}

# --- fade: 30 ms frames; at full opacity the back window takes the image and the front one hides
$fadeTimer = New-Object System.Windows.Forms.Timer
$fadeTimer.Interval = 30
$fadeTimer.Add_Tick({
  try {
    if ($script:pairs.Count -eq 0) { $fadeTimer.Stop(); return }
    $done = $false
    foreach ($p in $script:pairs) {
      $o = [math]::Min(1.0, $p.Front.Opacity + $fadeStep)
      $p.Front.Opacity = $o
      if ($o -ge 1.0) { $done = $true }
    }
    if ($done) {
      $fadeTimer.Stop()
      foreach ($p in $script:pairs) {
        $old = $p.BackBox.Image
        $p.BackBox.Image = $p.FrontBox.Image
        $p.FrontBox.Image = $null
        $p.Back.Refresh()
        $p.Front.Hide()
        if ($old) { $old.Dispose() }
      }
      $script:pairs[0].Back.Activate()   # keep the keyboard on the slideshow so Esc works
    }
  } catch { Note "fade error: $($_.Exception.Message)" }
})

# --- main loop: every 2 s, check automation and idle time, and move to the next image when it's due
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({
  try {
    $now = Get-Date
    $showing = $script:pairs.Count -gt 0
    if (($now - $script:autoChecked).TotalSeconds -ge ($(if ($showing) { 2 } else { 6 }))) {
      $was = $script:auto
      $script:auto = Test-Automation
      $script:autoChecked = $now
      if ($script:auto -and -not $was) {
        Note "automation started: paused"
        if ($showing) { $script:resumeAfterAuto = $true; Hide-Slides "automation started" }
      }
      if ($was -and -not $script:auto) {
        Note ("automation finished: resumed (you were idle {0:N0} s; it comes back if 30 s or more)" -f [SlideIdle]::Seconds())
        if ($script:resumeAfterAuto -and [SlideIdle]::Seconds() -ge 30) { $script:forceShow = $true }
        $script:resumeAfterAuto = $false
      }
    }
    if ($script:auto) { return }
    $showing = $script:pairs.Count -gt 0
    if (-not $showing) {
      if ($script:forceShow -or [SlideIdle]::Seconds() -ge $IdleMinutes * 60) { $script:forceShow = $false; Show-Slides }
    } elseif (-not $fadeTimer.Enabled -and ($now - $script:shownAt).TotalMinutes -ge $IntervalMinutes) {
      [void](Start-Next)
    }
  } catch { Note "tick error: $($_.Exception.Message)" }
})
$timer.Start()
$ctx = New-Object System.Windows.Forms.ApplicationContext
try { [System.Windows.Forms.Application]::Run($ctx) }
finally { Hide-Slides "exit"; Note "stopped"; $mutex.ReleaseMutex() }
