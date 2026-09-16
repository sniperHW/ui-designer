Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$source = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597\exec-b95044a4-2bf4-4f9b-8240-cb171981214f.png'
$output = Join-Path $root 'output/card-page-ui-assets'
$archive = Join-Path $output 'sources-v3'
New-Item -ItemType Directory -Force -Path $archive | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $archive 'page_main_nav_default_source_v2.png') -Force

$input = [System.Drawing.Image]::FromFile($source)
$bitmap = New-Object System.Drawing.Bitmap(150, 110, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.DrawImage($input, (New-Object System.Drawing.Rectangle(0, 0, 150, 110)))
$bitmap.Save((Join-Path $output 'page_main_nav_default_150x110.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose(); $input.Dispose()
