$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'output\card-page-ui-assets-slate-hierarchy'
$sourceOut = Join-Path $out 'sources'
New-Item -ItemType Directory -Force -Path $out, $sourceOut | Out-Null

$generated = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597'
$source = @{
  background = Join-Path $generated 'exec-3cef932c-bced-4638-8f20-e607be3c4bb9.png'
  art        = Join-Path $generated 'exec-9b6d0ea2-7b13-485c-9977-5e2aa76745ca.png'
  role       = Join-Path $generated 'exec-9711f711-169b-4535-a440-75f53021914c.png'
  track      = Join-Path $generated 'exec-1ee75ef3-9a99-4ff2-9ee6-9be2385ac999.png'
  fill       = Join-Path $generated 'exec-8fe4e869-dd66-4e7d-9074-32ccb7d93288.png'
  upgrade    = Join-Path $generated 'exec-9c2434cf-0a49-4499-bf20-99c07e3e5d47.png'
}
$source.GetEnumerator() | ForEach-Object { Copy-Item -LiteralPath $_.Value -Destination (Join-Path $sourceOut (Split-Path $_.Value -Leaf)) -Force }

$slate = [System.Drawing.Color]::FromArgb(255, 25, 47, 76)
$slate2 = [System.Drawing.Color]::FromArgb(255, 39, 70, 104)
$slate3 = [System.Drawing.Color]::FromArgb(255, 12, 28, 48)
$gold = [System.Drawing.Color]::FromArgb(255, 205, 159, 70)
$goldHi = [System.Drawing.Color]::FromArgb(255, 248, 219, 137)
$goldDim = [System.Drawing.Color]::FromArgb(255, 126, 95, 48)
$cyan = [System.Drawing.Color]::FromArgb(255, 62, 204, 228)
$green = [System.Drawing.Color]::FromArgb(255, 86, 220, 130)

function Path-Round([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  if ($r -le 0) {
    $p.AddRectangle([System.Drawing.RectangleF]::new($x, $y, $w, $h))
    return $p
  }
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Fill-Round($g, $color, $x, $y, $w, $h, $r) {
  $p = Path-Round $x $y $w $h $r
  $brush = [System.Drawing.SolidBrush]::new($color)
  $g.FillPath($brush, $p)
  $brush.Dispose(); $p.Dispose()
}

function Stroke-Round($g, $color, $width, $x, $y, $w, $h, $r) {
  $p = Path-Round $x $y $w $h $r
  $pen = [System.Drawing.Pen]::new($color, $width)
  $g.DrawPath($pen, $p)
  $pen.Dispose(); $p.Dispose()
}

function Panel($g, $x, $y, $w, $h, $r, $emphasis = 'quiet') {
  $p = Path-Round $x $y $w $h $r
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new($x, $y, $w, $h), $slate2, $slate3,
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
  $g.FillPath($brush, $p)
  $brush.Dispose(); $p.Dispose()
  if ($emphasis -eq 'active') {
    Stroke-Round $g $goldHi 2.2 $x $y $w $h $r
    Stroke-Round $g $gold 1 ($x + 2) ($y + 2) ($w - 4) ($h - 4) ([Math]::Max(1,$r - 2))
  } elseif ($emphasis -eq 'medium') {
    Stroke-Round $g $gold 1.5 $x $y $w $h $r
  } else {
    Stroke-Round $g $goldDim 1 $x $y $w $h $r
  }
}

function Save-Asset([string]$name, [int]$w, [int]$h, [scriptblock]$paint) {
  $bitmap = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    & $paint $g $w $h
    $bitmap.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally { $g.Dispose(); $bitmap.Dispose() }
}

function Alpha-Bounds([System.Drawing.Bitmap]$image) {
  $left = $image.Width; $top = $image.Height; $right = -1; $bottom = -1
  for ($y = 0; $y -lt $image.Height; $y++) {
    for ($x = 0; $x -lt $image.Width; $x++) {
      if ($image.GetPixel($x,$y).A -gt 8) {
        if ($x -lt $left) { $left = $x }; if ($x -gt $right) { $right = $x }
        if ($y -lt $top) { $top = $y }; if ($y -gt $bottom) { $bottom = $y }
      }
    }
  }
  if ($right -lt $left) { return [System.Drawing.Rectangle]::new(0,0,$image.Width,$image.Height) }
  return [System.Drawing.Rectangle]::FromLTRB($left,$top,$right+1,$bottom+1)
}

function Import-Generated([string]$sourcePath, [string]$name, [int]$w, [int]$h, [bool]$cropAlpha = $true) {
  $image = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    $rect = if ($cropAlpha) { Alpha-Bounds $image } else { [System.Drawing.Rectangle]::new(0,0,$image.Width,$image.Height) }
    Save-Asset $name $w $h {
      param($g,$targetW,$targetH)
      $g.DrawImage($image, [System.Drawing.Rectangle]::new(0,0,$targetW,$targetH), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    }
  }
  finally { $image.Dispose() }
}

# AI-generated image sources: only atmosphere, card illustration and independent status components.
Import-Generated $source.background 'page_background_750x1600.png' 750 1600 $false
Import-Generated $source.art 'card_art_window_112x96.png' 112 96 $false
Import-Generated $source.role 'card_role_badge_34x34.png' 34 34 $true
Import-Generated $source.track 'card_progress_track_136x26.png' 136 26 $true
Import-Generated $source.fill 'card_progress_fill_136x26.png' 136 26 $true
Import-Generated $source.upgrade 'card_upgrade_badge_38x26.png' 38 26 $true

# Card widget frame: exact transparent geometry; card art and runtime labels remain separate nodes.
Save-Asset 'card_frame_160x220.png' 160 220 {
  param($g,$w,$h)
  Panel $g 1 1 158 218 12 'medium'
  Stroke-Round $g $slate3 1 4 4 152 212 9
  # The frame keeps visual weight low; the art node overlays this recess.
  Fill-Round $g $slate3 11 42 138 104 7
  Stroke-Round $g $goldDim 1 11 42 138 104 7
  Fill-Round $g ([System.Drawing.Color]::FromArgb(255, 19, 39, 62)) 8 148 144 25 5
  $pen = [System.Drawing.Pen]::new($goldDim, 1); $g.DrawLine($pen, 13, 173, 147, 173); $pen.Dispose()
  Fill-Round $g ([System.Drawing.Color]::FromArgb(255, 11, 27, 45)) 10 175 140 29 6
}

# Common layer
Save-Asset 'common_resource_bar_bg_160x44.png' 160 44 {
  param($g,$w,$h)
  Panel $g 1 2 158 40 18 'quiet'
  Fill-Round $g ([System.Drawing.Color]::FromArgb(255, 36, 62, 91)) 7 8 118 28 12
  Fill-Round $g ([System.Drawing.Color]::FromArgb(255, 47, 77, 109)) 130 10 23 24 8
  Stroke-Round $g $goldDim 1 130 10 23 24 8
}
Save-Asset 'common_resource_gem_32x32.png' 32 32 {
  param($g,$w,$h)
  [System.Drawing.Point[]]$points = @([System.Drawing.Point]::new(16,2),[System.Drawing.Point]::new(28,11),[System.Drawing.Point]::new(16,30),[System.Drawing.Point]::new(4,11))
  $b=[System.Drawing.SolidBrush]::new($cyan); $g.FillPolygon($b,$points); $b.Dispose()
  $p=[System.Drawing.Pen]::new($goldHi,1.5); $g.DrawPolygon($p,$points); $p.Dispose()
}
Save-Asset 'common_resource_wood_32x32.png' 32 32 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,153,94,50)); $g.FillRectangle($b,7,7,18,19); $b.Dispose()
  $p=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255,94,56,35),2); $g.DrawEllipse($p,7,4,18,8); $g.DrawLine($p,7,15,25,15); $p.Dispose()
}
Save-Asset 'common_resource_orb_32x32.png' 32 32 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,163,81,220)); $g.FillEllipse($b,3,3,26,26); $b.Dispose()
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,240,199,255)); $g.FillEllipse($b,8,7,8,8); $b.Dispose()
}
Save-Asset 'common_resource_coin_32x32.png' 32 32 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new($goldHi); $g.FillEllipse($b,2,2,28,28); $b.Dispose()
  $p=[System.Drawing.Pen]::new($gold,2); $g.DrawEllipse($p,5,5,22,22); $p.Dispose()
  $b=[System.Drawing.SolidBrush]::new($gold); $g.FillEllipse($b,12,12,8,8); $b.Dispose()
}
Save-Asset 'common_location_button_46x46.png' 46 46 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new($slate); $g.FillEllipse($b,2,2,42,42); $b.Dispose(); $p=[System.Drawing.Pen]::new($gold,1.5); $g.DrawEllipse($p,2,2,42,42); $g.DrawEllipse($p,17,17,12,12); $g.DrawLine($p,23,8,23,14); $g.DrawLine($p,23,32,23,38); $g.DrawLine($p,8,23,14,23); $g.DrawLine($p,32,23,38,23); $p.Dispose()
}
Save-Asset 'common_more_button_80x48.png' 80 48 {
  param($g,$w,$h)
  Panel $g 1 4 78 40 17 'medium'; $b=[System.Drawing.SolidBrush]::new($goldHi); 28,38,48 | ForEach-Object { $g.FillEllipse($b,$_ ,21,5,5) }; $b.Dispose()
}
Save-Asset 'common_record_button_56x56.png' 56 56 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new($slate); $g.FillEllipse($b,2,2,52,52); $b.Dispose(); $p=[System.Drawing.Pen]::new($goldHi,2); $g.DrawEllipse($p,2,2,52,52); $p.Dispose(); $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,229,74,80)); $g.FillEllipse($b,18,18,20,20); $b.Dispose()
}

# Page states: selection uses the strong metal edge; inactive states stay quiet.
Save-Asset 'page_filter_tab_default_110x64.png' 110 64 { param($g,$w,$h) Panel $g 1 4 108 56 12 'quiet' }
Save-Asset 'page_filter_tab_selected_150x64.png' 150 64 { param($g,$w,$h) Panel $g 1 3 148 58 12 'active'; Fill-Round $g ([System.Drawing.Color]::FromArgb(255, 55, 90, 132)) 8 9 134 10 5 }
Save-Asset 'page_power_bar_bg_700x70.png' 700 70 { param($g,$w,$h) Panel $g 1 3 698 64 12 'medium'; $p=[System.Drawing.Pen]::new($goldHi,1); $g.DrawLine($p,12,12,688,12); $p.Dispose() }
Save-Asset 'page_sub_tab_default_175x64.png' 175 64 { param($g,$w,$h) Fill-Round $g ([System.Drawing.Color]::FromArgb(235, 17, 38, 64)) 1 5 173 56 8; $p=[System.Drawing.Pen]::new($goldDim,1); $g.DrawLine($p,0,62,174,62); $g.DrawLine($p,174,12,174,56); $p.Dispose() }
Save-Asset 'page_sub_tab_selected_175x64.png' 175 64 { param($g,$w,$h) Fill-Round $g ([System.Drawing.Color]::FromArgb(255, 45, 77, 117)) 1 5 173 56 8; $p=[System.Drawing.Pen]::new($goldHi,2); $g.DrawLine($p,9,61,166,61); $p.Dispose() }
Save-Asset 'page_main_nav_default_150x110.png' 150 110 { param($g,$w,$h) Fill-Round $g ([System.Drawing.Color]::FromArgb(245, 17, 39, 66)) 0 0 150 110 0; $p=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 48,72,99),1); $g.DrawLine($p,149,12,149,101); $p.Dispose() }
Save-Asset 'page_main_nav_selected_150x110.png' 150 110 { param($g,$w,$h) Fill-Round $g ([System.Drawing.Color]::FromArgb(255, 43, 77, 115)) 0 0 150 110 0; $p=[System.Drawing.Pen]::new($goldHi,2); $g.DrawLine($p,10,5,140,5); $g.DrawLine($p,10,105,140,105); $p.Dispose() }

Write-Output "Generated assets in $out"
