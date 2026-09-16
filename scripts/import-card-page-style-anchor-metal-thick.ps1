Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$source = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597\exec-6c62096b-6d86-4e97-b2f6-edb8ea6ff3a0.png'
$output = Join-Path $root 'output/card-page-style-anchor'
New-Item -ItemType Directory -Force -Path $output | Out-Null

$input = [System.Drawing.Image]::FromFile($source)
$bitmap = New-Object System.Drawing.Bitmap(750, 1600, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.DrawImage($input, (New-Object System.Drawing.Rectangle(0, 0, 750, 1600)))
$bitmap.Save((Join-Path $output '卡牌页-视觉锚点图-亮金属加厚蓝调版.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose(); $input.Dispose()
