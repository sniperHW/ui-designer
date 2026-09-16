$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$base = Join-Path $root 'output\card-page-ui-assets-slate-hierarchy'
$out = Join-Path $root 'output\card-page-ui-assets-slate-collection'
New-Item -ItemType Directory -Force -Path $out | Out-Null
Get-ChildItem -LiteralPath $base -File -Filter '*.png' | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $out $_.Name) -Force }

$generated = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597'
$artSources = @{
  green  = Join-Path $generated 'exec-3c331cd9-b171-4835-bb18-7df64ed1d5cb.png'
  blue   = Join-Path $generated 'exec-012bafa8-13f5-4074-b119-6267f88b882e.png'
  purple = Join-Path $generated 'exec-aaa795c8-237a-4f0a-9da4-a80c75a10302.png'
  gold   = Join-Path $generated 'exec-3862bd28-5904-4ec6-b6aa-8a1ee1c0ed72.png'
}

$slate = [System.Drawing.Color]::FromArgb(255, 18, 39, 65)
$slate2 = [System.Drawing.Color]::FromArgb(255, 37, 68, 101)
$ink = [System.Drawing.Color]::FromArgb(255, 9, 24, 41)
$gold = [System.Drawing.Color]::FromArgb(255, 199, 151, 59)
$goldDim = [System.Drawing.Color]::FromArgb(255, 121, 89, 45)
$rarity = @{
  green  = [System.Drawing.Color]::FromArgb(255, 67, 190, 103)
  blue   = [System.Drawing.Color]::FromArgb(255, 69, 151, 232)
  purple = [System.Drawing.Color]::FromArgb(255, 182, 79, 222)
  gold   = [System.Drawing.Color]::FromArgb(255, 232, 176, 53)
}

function RoundPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); $d=$r*2
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure(); return $p
}
function FillRound($g,$color,$x,$y,$w,$h,$r) { $p=RoundPath $x $y $w $h $r; $b=[System.Drawing.SolidBrush]::new($color); $g.FillPath($b,$p); $b.Dispose(); $p.Dispose() }
function StrokeRound($g,$color,$width,$x,$y,$w,$h,$r) { $p=RoundPath $x $y $w $h $r; $pen=[System.Drawing.Pen]::new($color,$width); $g.DrawPath($pen,$p); $pen.Dispose(); $p.Dispose() }
function Save([string]$name,[int]$w,[int]$h,[scriptblock]$paint) {
  $bitmap=[System.Drawing.Bitmap]::new($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[System.Drawing.Graphics]::FromImage($bitmap)
  try { $g.Clear([System.Drawing.Color]::Transparent); $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; & $paint $g $w $h; $bitmap.Save((Join-Path $out $name),[System.Drawing.Imaging.ImageFormat]::Png) }
  finally { $g.Dispose(); $bitmap.Dispose() }
}
function ImportArt([string]$source,[string]$name) {
  $image=[System.Drawing.Image]::FromFile($source)
  try { Save $name 112 96 { param($g,$w,$h) $g.DrawImage($image,0,0,$w,$h) } }
  finally { $image.Dispose() }
}

foreach ($key in $artSources.Keys) {
  ImportArt $artSources[$key] "card_art_${key}_112x96.png"
  Save "card_frame_${key}_160x220.png" 160 220 {
    param($g,$w,$h)
    $rim=$rarity[$key]
    $brush=[System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(1,1,158,218),$slate2,$ink,[System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $path=RoundPath 1 1 158 218 12; $g.FillPath($brush,$path); $brush.Dispose(); $path.Dispose()
    StrokeRound $g $goldDim 1.4 1 1 158 218 12
    StrokeRound $g $rim 1.2 4 4 152 212 9
    FillRound $g $ink 11 42 138 104 7; StrokeRound $g $rim 1 11 42 138 104 7
    FillRound $g ([System.Drawing.Color]::FromArgb(255,16,36,58)) 8 148 144 25 5
    $pen=[System.Drawing.Pen]::new($rim,1); $g.DrawLine($pen,13,173,147,173); $pen.Dispose()
    FillRound $g ([System.Drawing.Color]::FromArgb(255,8,22,38)) 10 175 140 29 6
  }
}

# Default paths are retained for compatibility and point to blue rarity.
Copy-Item -LiteralPath (Join-Path $out 'card_art_blue_112x96.png') -Destination (Join-Path $out 'card_art_window_112x96.png') -Force
Copy-Item -LiteralPath (Join-Path $out 'card_frame_blue_160x220.png') -Destination (Join-Path $out 'card_frame_160x220.png') -Force

# Six compact stat icons replace emoji glyphs in the existing battle-stat line.
function StatIcon([string]$name,[scriptblock]$draw) {
  Save $name 24 24 {
    param($g,$w,$h)
    $pen=[System.Drawing.Pen]::new($gold,1.8); $pen.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round
    & $draw $g $pen
    $pen.Dispose()
  }
}
StatIcon 'stat_icon_skull_24x24.png' { param($g,$p) $g.DrawEllipse($p,5,3,14,14); $g.DrawRectangle($p,8,15,8,5); $g.DrawLine($p,9,9,11,9); $g.DrawLine($p,14,9,16,9) }
StatIcon 'stat_icon_wolf_24x24.png' { param($g,$p) [System.Drawing.Point[]]$points=@([System.Drawing.Point]::new(5,7),[System.Drawing.Point]::new(8,3),[System.Drawing.Point]::new(11,7),[System.Drawing.Point]::new(16,6),[System.Drawing.Point]::new(19,10),[System.Drawing.Point]::new(17,18),[System.Drawing.Point]::new(12,21),[System.Drawing.Point]::new(7,17)); $g.DrawPolygon($p,$points) }
StatIcon 'stat_icon_helmet_24x24.png' { param($g,$p) $g.DrawArc($p,5,4,14,14,180,180); $g.DrawLine($p,5,12,19,12); $g.DrawLine($p,8,12,8,19); $g.DrawLine($p,16,12,16,19) }
StatIcon 'stat_icon_gear_24x24.png' { param($g,$p) $g.DrawEllipse($p,5,5,14,14); $g.DrawEllipse($p,9,9,6,6); 10,14 | ForEach-Object { $g.DrawLine($p,$_,2,$_,5); $g.DrawLine($p,$_,19,$_,22) }; 2,22 | ForEach-Object { $g.DrawLine($p,$_,10,$_-3,10); $g.DrawLine($p,$_,14,$_-3,14) } }
StatIcon 'stat_icon_sword_24x24.png' { param($g,$p) $g.DrawLine($p,6,19,18,5); $g.DrawLine($p,14,4,19,5); $g.DrawLine($p,17,9,19,5); $g.DrawLine($p,5,16,9,20); $g.DrawLine($p,4,21,8,17) }
StatIcon 'stat_icon_bow_24x24.png' { param($g,$p) $g.DrawArc($p,4,3,14,18,-65,130); $g.DrawLine($p,5,20,20,4); $g.DrawLine($p,7,18,9,18); $g.DrawLine($p,17,6,17,8) }

Write-Output "Generated final-resolution collection assets in $out"
