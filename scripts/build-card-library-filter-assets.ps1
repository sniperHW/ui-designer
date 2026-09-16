$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$base = Join-Path $root 'output\card-page-ui-assets-slate-collection'
$out = Join-Path $root 'output\card-page-ui-assets-slate-library-filter'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# 只复制已裁切到运行时尺寸的 PNG，不带入生图原图或预览工程。
Get-ChildItem -LiteralPath $base -File -Filter '*.png' | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $out $_.Name) -Force
}

$slate = [System.Drawing.Color]::FromArgb(255, 18, 41, 69)
$slateLite = [System.Drawing.Color]::FromArgb(255, 39, 72, 107)
$ink = [System.Drawing.Color]::FromArgb(255, 8, 23, 40)
$gold = [System.Drawing.Color]::FromArgb(255, 211, 169, 78)
$goldHot = [System.Drawing.Color]::FromArgb(255, 255, 214, 108)
$blue = [System.Drawing.Color]::FromArgb(255, 78, 165, 242)

function RoundPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new(); $d = $r * 2
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure(); return $p
}
function FillRound($g,$color,$x,$y,$w,$h,$r) {
  $path = RoundPath $x $y $w $h $r; $brush = [System.Drawing.SolidBrush]::new($color)
  $g.FillPath($brush,$path); $brush.Dispose(); $path.Dispose()
}
function StrokeRound($g,$color,$width,$x,$y,$w,$h,$r) {
  $path = RoundPath $x $y $w $h $r; $pen = [System.Drawing.Pen]::new($color,$width)
  $g.DrawPath($pen,$path); $pen.Dispose(); $path.Dispose()
}
function Save([string]$name,[int]$w,[int]$h,[scriptblock]$paint) {
  $bitmap = [System.Drawing.Bitmap]::new($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    & $paint $g $w $h
    $bitmap.Save((Join-Path $out $name),[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $g.Dispose(); $bitmap.Dispose() }
}
function PaintFilter([string]$name,[int]$w,[bool]$active,[scriptblock]$drawIcon) {
  Save $name $w 64 {
    param($g,$cw,$ch)
    $fill = if ($active) { [System.Drawing.Color]::FromArgb(255, 111, 83, 36) } else { $slate }
    $rim = if ($active) { $goldHot } else { [System.Drawing.Color]::FromArgb(255, 102, 132, 162) }
    $strokeWidth = if ($active) { 2.2 } else { 1.4 }
    FillRound $g $fill 2 4 ($cw-4) 56 13
    StrokeRound $g $rim $strokeWidth 2 4 ($cw-4) 56 13
    if ($active) { StrokeRound $g $gold 1 6 8 ($cw-12) 48 10 }
    & $drawIcon $g $cw $ch $active
  }
}
function Pen($color,[float]$width) {
  $p = [System.Drawing.Pen]::new($color,$width); $p.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round; return $p
}

# “全部”保留给运行时 Tab 文本；其余四项仅为无文字的图标皮肤。
PaintFilter 'library_filter_all_default_120x64.png' 120 $false { param($g,$w,$h,$a) }
PaintFilter 'library_filter_all_active_120x64.png' 120 $true { param($g,$w,$h,$a) }

$icons = @{
  skull = {
    param($g,$w,$h,$active); $tone = if ($active) { $goldHot } else { $gold }; $p = Pen $tone 3
    $g.DrawEllipse($p,26,15,20,19); $g.DrawRectangle($p,31,33,10,8); $g.DrawLine($p,31,25,34,25); $g.DrawLine($p,38,25,41,25); $p.Dispose()
  }
  wolf = {
    param($g,$w,$h,$active); $tone = if ($active) { $goldHot } else { $gold }; $p = Pen $tone 3
    [System.Drawing.Point[]]$points = @([System.Drawing.Point]::new(26,22),[System.Drawing.Point]::new(32,14),[System.Drawing.Point]::new(37,20),[System.Drawing.Point]::new(44,19),[System.Drawing.Point]::new(48,26),[System.Drawing.Point]::new(45,39),[System.Drawing.Point]::new(36,44),[System.Drawing.Point]::new(27,38)); $g.DrawPolygon($p,$points); $p.Dispose()
  }
  helmet = {
    param($g,$w,$h,$active); $tone = if ($active) { $goldHot } else { $gold }; $p = Pen $tone 3
    $g.DrawArc($p,25,15,22,23,180,180); $g.DrawLine($p,25,27,47,27); $g.DrawLine($p,29,27,29,40); $g.DrawLine($p,43,27,43,40); $p.Dispose()
  }
  gear = {
    param($g,$w,$h,$active); $tone = if ($active) { $goldHot } else { $gold }; $p = Pen $tone 3
    $g.DrawEllipse($p,27,18,19,19); $g.DrawEllipse($p,33,24,7,7); 31,41 | ForEach-Object { $g.DrawLine($p,$_,13,$_,19); $g.DrawLine($p,$_,37,$_,44) }; $g.DrawLine($p,20,27,27,27); $g.DrawLine($p,46,27,53,27); $p.Dispose()
  }
}
foreach ($kind in $icons.Keys) {
  PaintFilter "library_filter_${kind}_default_72x64.png" 72 $false $icons[$kind]
  PaintFilter "library_filter_${kind}_active_72x64.png" 72 $true $icons[$kind]
}

Write-Output "Generated final-resolution library-filter assets in $out"
