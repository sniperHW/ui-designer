$ErrorActionPreference = 'Stop'

$source = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597\exec-358788b7-05d5-4fc9-8256-c997420c81fb.png'
$destination = Join-Path $PSScriptRoot '..\output\card-page-style-anchor\卡牌页-视觉锚点图-石板蓝加厚金属版.png'

Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Image]::FromFile($source)
try {
    $targetWidth = 750
    $targetHeight = 1600
    $canvas = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
    try {
        $canvas.SetResolution($sourceImage.HorizontalResolution, $sourceImage.VerticalResolution)
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage($sourceImage, 0, 0, $targetWidth, $targetHeight)
        }
        finally {
            $graphics.Dispose()
        }

        $canvas.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $canvas.Dispose()
    }
}
finally {
    $sourceImage.Dispose()
}

Write-Output $destination
