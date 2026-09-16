param(
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\output\card-page-ui-assets-2.0'),
  [string]$GeneratedImageDir = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$referenceAssets = Join-Path $root 'output\card-page-ui-assets-slate-library-filter'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Copy-Item (Join-Path $referenceAssets '*.png') $OutputDir -Force

function New-Canvas([int]$Width, [int]$Height, [bool]$Transparent = $true) {
  $bmp = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  if ($Transparent) { $g.Clear([System.Drawing.Color]::Transparent) }
  return @($bmp, $g)
}

function New-RoundedPath([float]$X, [float]$Y, [float]$W, [float]$H, [float]$Radius) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $Radius * 2
  $p.AddArc($X, $Y, $d, $d, 180, 90)
  $p.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $p.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $p.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Draw-Chrome($g, [int]$W, [int]$H, [bool]$Active = $false, [string]$Accent = '#D7AA43', [int]$Radius = 10) {
  $outer = New-RoundedPath 1 1 ($W - 2) ($H - 2) $Radius
  $inner = New-RoundedPath 5 5 ($W - 10) ($H - 10) ([Math]::Max(4, $Radius - 4))
  $fill = if ($Active) { '#314563' } else { '#182C43' }
  $g.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($fill)), $outer)
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#081526'), 2), $outer)
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Accent), 1.5), $inner)
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#617189'), 1), (New-RoundedPath 7 7 ($W - 14) ($H - 14) ([Math]::Max(3, $Radius - 6))))
  $outer.Dispose(); $inner.Dispose()
}

function Save-Png($bmp, $g, [string]$Name) {
  $g.Dispose(); $bmp.Save((Join-Path $OutputDir $Name), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

function Make-ChromeAsset([string]$Name, [int]$W, [int]$H, [bool]$Active = $false, [string]$Accent = '#D7AA43', [int]$Radius = 10) {
  $c = New-Canvas $W $H
  Draw-Chrome $c[1] $W $H $Active $Accent $Radius
  Save-Png $c[0] $c[1] $Name
}

function Make-FilterIconAsset([string]$Name, [string]$Kind, [bool]$Active) {
  $c = New-Canvas 72 64
  $g = $c[1]
  $accent = if ($Active) { '#E4BD61' } else { '#6A7F99' }
  Draw-Chrome $g 72 64 $Active $accent 12
  $ink = [System.Drawing.ColorTranslator]::FromHtml($(if ($Active) { '#F6D878' } else { '#C5D1DE' }))
  $cut = [System.Drawing.ColorTranslator]::FromHtml('#132840')
  $pen = [System.Drawing.Pen]::new($ink, 2)
  $brush = [System.Drawing.SolidBrush]::new($ink)
  $cutBrush = [System.Drawing.SolidBrush]::new($cut)
  switch ($Kind) {
    'skull' {
      $g.FillEllipse($brush, 25, 17, 22, 22)
      $g.FillRectangle($brush, 29, 36, 14, 8)
      $g.FillEllipse($cutBrush, 29, 24, 5, 6); $g.FillEllipse($cutBrush, 38, 24, 5, 6)
      $g.FillRectangle($cutBrush, 32, 36, 2, 5); $g.FillRectangle($cutBrush, 38, 36, 2, 5)
    }
    'wolf' {
      $g.FillPolygon($brush, [System.Drawing.Point[]]@((New-Object Drawing.Point 25,42),(New-Object Drawing.Point 22,22),(New-Object Drawing.Point 31,27),(New-Object Drawing.Point 36,17),(New-Object Drawing.Point 41,27),(New-Object Drawing.Point 50,22),(New-Object Drawing.Point 47,42),(New-Object Drawing.Point 36,48)))
      $g.FillEllipse($cutBrush, 29, 32, 4, 4); $g.FillEllipse($cutBrush, 39, 32, 4, 4)
      $g.FillPolygon($cutBrush, [System.Drawing.Point[]]@((New-Object Drawing.Point 34,39),(New-Object Drawing.Point 38,39),(New-Object Drawing.Point 36,43)))
    }
    'helmet' {
      $g.FillPie($brush, 23, 16, 26, 26, 180, 180)
      $g.FillRectangle($brush, 23, 29, 26, 11)
      $g.FillRectangle($cutBrush, 28, 29, 16, 6)
      $g.DrawLine($pen, 26, 42, 46, 42); $g.DrawLine($pen, 29, 42, 31, 47); $g.DrawLine($pen, 43, 42, 41, 47)
    }
    'gear' {
      for ($i = 0; $i -lt 8; $i++) {
        $g.TranslateTransform(36, 32); $g.RotateTransform($i * 45); $g.FillRectangle($brush, -3, -17, 6, 8); $g.ResetTransform()
      }
      $g.FillEllipse($brush, 23, 19, 26, 26); $g.FillEllipse($cutBrush, 30, 26, 12, 12)
    }
  }
  $pen.Dispose(); $brush.Dispose(); $cutBrush.Dispose(); Save-Png $c[0] $g $Name
}

# Shared navigation / container skins.  They deliberately have a hierarchy of line weights:
# page bars are the heaviest, card frames medium, filters and nav tabs lightest.
Make-ChromeAsset 'common_resource_bar_bg_160x44.png' 160 44 $false '#D7AA43' 12
Make-ChromeAsset 'deck_title_plate_140x64.png' 140 64 $true '#E4BD61' 14
Make-ChromeAsset 'page_filter_tab_default_110x64.png' 110 64 $false '#A97D31' 13
Make-ChromeAsset 'page_filter_tab_active_110x64.png' 110 64 $true '#E4BD61' 13
Make-ChromeAsset 'page_power_bar_bg_700x70.png' 700 70 $false '#B99443' 14
Make-ChromeAsset 'page_sub_tab_default_175x64.png' 175 64 $false '#6A7F99' 11
Make-ChromeAsset 'page_sub_tab_selected_175x64.png' 175 64 $true '#E4BD61' 11
Make-ChromeAsset 'page_main_nav_default_150x110.png' 150 110 $false '#485E79' 4
Make-ChromeAsset 'page_main_nav_selected_150x110.png' 150 110 $true '#E4BD61' 4
Make-ChromeAsset 'library_filter_all_default_120x64.png' 120 64 $false '#6A7F99' 12
Make-ChromeAsset 'library_filter_all_active_120x64.png' 120 64 $true '#E4BD61' 12
foreach ($kind in @('skull','wolf','helmet','gear')) {
  Make-FilterIconAsset "library_filter_${kind}_default_72x64.png" $kind $false
  Make-FilterIconAsset "library_filter_${kind}_active_72x64.png" $kind $true
}

# Correct node size: previous version used a 26px progress image inside a 24px node.
foreach ($pair in @(@('card_progress_track_136x24.png', $false), @('card_progress_fill_136x24.png', $true))) {
  $c = New-Canvas 136 24
  $g = $c[1]
  $path = New-RoundedPath 1 3 134 18 7
  $g.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($(if ($pair[1]) { '#19B8D5' } else { '#09172A' }))), $path)
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#D4A63E'), 1.5), $path)
  if ($pair[1]) { $g.DrawLine([System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(130, 232, 255, 255), 1), 8, 7, 125, 7) }
  $path.Dispose(); Save-Png $c[0] $g $pair[0]
}

function Make-CardFrame([string]$Name, [string]$Accent) {
  $c = New-Canvas 160 220
  $g = $c[1]
  $outer = New-RoundedPath 2 2 156 216 14
  $g.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#102239')), $outer)
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#06111F'), 4), $outer)
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Accent), 3), (New-RoundedPath 5 5 150 210 12))
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#7990A8'), 1), (New-RoundedPath 9 9 142 202 10))
  # The art window uses its own interior outline; this leaves a clear runtime text zone.
  $g.DrawRectangle([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Accent), 1.5), 11, 37, 137, 113)
  $g.DrawLine([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Accent), 2), 13, 176, 147, 176)
  $outer.Dispose(); Save-Png $c[0] $g $Name
}
Make-CardFrame 'card_frame_green_160x220.png' '#69AF54'
Make-CardFrame 'card_frame_blue_160x220.png' '#3AA7D8'
Make-CardFrame 'card_frame_purple_160x220.png' '#A46ADE'
Make-CardFrame 'card_frame_gold_160x220.png' '#D7A334'
Copy-Item (Join-Path $OutputDir 'card_frame_blue_160x220.png') (Join-Path $OutputDir 'card_frame_160x220.png') -Force

# Preserve an exact-size project copy of the generated empty background.
$backgroundSource = Join-Path $GeneratedImageDir 'exec-6e599083-3ef5-4ce9-a07f-25e8a30f74da.png'
$bgImage = [System.Drawing.Image]::FromFile($backgroundSource)
$bgCanvas = [System.Drawing.Bitmap]::new(750, 1600, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgGraphics = [System.Drawing.Graphics]::FromImage($bgCanvas)
$bgGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$bgGraphics.DrawImage($bgImage, [System.Drawing.Rectangle]::new(0, 0, 750, 1600))
$bgGraphics.Dispose(); $bgImage.Dispose(); $bgCanvas.Save((Join-Path $OutputDir 'page_background_750x1600.png'), [System.Drawing.Imaging.ImageFormat]::Png); $bgCanvas.Dispose()

# Crop each generated quadrant directly to the live card-art window: 136×112 (not a high-res runtime dependency).
$sheets = @(
  @{ File = 'exec-283a137e-0915-49eb-ba16-14522d0bbd7b.png'; Names = @('green_guardian','blue_miner','purple_commander','gold_ranger') },
  @{ File = 'exec-66a28f1f-3890-4984-976c-4e88eb4ef2da.png'; Names = @('green_golem','blue_knight','purple_dragon','gold_lancer') },
  @{ File = 'exec-2f188e43-0312-4ad9-a92a-44bc6617c390.png'; Names = @('green_archer','blue_sentinel','purple_oracle','gold_citadel') },
  @{ File = 'exec-ee99fb21-e60a-4d34-8e50-ff050d5f7487.png'; Names = @('green_shaman','blue_spearguard','purple_warlock','gold_guardian') }
)
foreach ($sheet in $sheets) {
  $source = [System.Drawing.Image]::FromFile((Join-Path $GeneratedImageDir $sheet.File))
  $quadW = [Math]::Floor($source.Width / 2); $quadH = [Math]::Floor($source.Height / 2)
  for ($index = 0; $index -lt 4; $index++) {
    $col = $index % 2; $row = [Math]::Floor($index / 2)
    # 640×527 provides the same 1.214:1 ratio as the 136×112 card art node.
    $srcRect = [System.Drawing.Rectangle]::new(($col * $quadW) + 42, ($row * $quadH) + 8, 640, 527)
    $target = [System.Drawing.Bitmap]::new(136, 112, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, 136, 112), $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose(); $target.Save((Join-Path $OutputDir ("card_art_{0}_136x112.png" -f $sheet.Names[$index])), [System.Drawing.Imaging.ImageFormat]::Png); $target.Dispose()
  }
  $source.Dispose()
}

Write-Host "Generated 2.0 assets in $OutputDir"
