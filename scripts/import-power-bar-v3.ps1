Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$source = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597\exec-14b04ae3-0a33-4770-b538-8978def7e9b7.png'
$output = Join-Path $root 'output/card-page-ui-assets'
$archive = Join-Path $output 'sources-v3'
New-Item -ItemType Directory -Force -Path $archive | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $archive 'page_power_bar_source_v3.png') -Force

$input = [System.Drawing.Bitmap]::FromFile($source)
$minX = $input.Width; $minY = $input.Height; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $input.Height; $y++) {
  for ($x = 0; $x -lt $input.Width; $x++) {
    $pixel = $input.GetPixel($x, $y)
    # Generated padding is near-black; retain the actual navy/bronze bar content.
    if (($pixel.R + $pixel.G + $pixel.B) -gt 42) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
if ($maxX -lt $minX -or $maxY -lt $minY) { throw '未检测到战力条有效像素。' }

$crop = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
$bitmap = New-Object System.Drawing.Bitmap(700, 70, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.DrawImage($input, (New-Object System.Drawing.Rectangle(0, 0, 700, 70)), $crop, [System.Drawing.GraphicsUnit]::Pixel)
$bitmap.Save((Join-Path $output 'page_power_bar_bg_700x70.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose(); $input.Dispose()
