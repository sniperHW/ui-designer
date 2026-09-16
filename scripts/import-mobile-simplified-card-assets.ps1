Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'output/card-page-ui-assets-mobile-simplified'
$generated = 'C:\Users\Administrator\.codex\generated_images\01a06226-dd28-7bd2-bded-ab87ca129597'
$sourceDir = Join-Path $output 'sources'
New-Item -ItemType Directory -Force -Path $sourceDir | Out-Null

# Every source was generated for exactly one mapped component.  We trim only
# generator canvas padding, then normalize to the existing UIW pixel contract.
$items = @(
  @{ Source='exec-bbc3e864-4348-4f47-a027-6286e0f2ade4.png'; Name='page_background_750x1600.png'; W=750; H=1600 },
  @{ Source='exec-afa20c5a-e96b-4992-98ab-ad2b50a758ff.png'; Name='common_resource_bar_bg_160x44.png'; W=160; H=44 },
  @{ Source='exec-48f235db-2f12-4ce7-ba46-41b326420190.png'; Name='common_resource_gem_32x32.png'; W=32; H=32 },
  @{ Source='exec-cf94bc45-03d9-462e-8c07-0bfa085aa0b8.png'; Name='common_resource_wood_32x32.png'; W=32; H=32 },
  @{ Source='exec-e08a480f-df74-4e26-9261-9901d866362c.png'; Name='common_resource_orb_32x32.png'; W=32; H=32 },
  @{ Source='exec-fc6ffea6-1a15-4104-87d2-007a0db0568c.png'; Name='common_resource_coin_32x32.png'; W=32; H=32 },
  @{ Source='exec-632f8836-0101-4ac0-955a-54d54c99ee85.png'; Name='common_location_button_46x46.png'; W=46; H=46 },
  @{ Source='exec-52df6a32-356a-4339-a1f9-37f0cd8db209.png'; Name='common_more_button_80x48.png'; W=80; H=48 },
  @{ Source='exec-cd1dee9b-5b70-4a95-8ee1-7a5ad146753b.png'; Name='common_record_button_56x56.png'; W=56; H=56 },
  @{ Source='exec-19e5eede-3fa1-46dd-8b0d-24c339aa4e5b.png'; Name='page_filter_tab_default_110x64.png'; W=110; H=64 },
  @{ Source='exec-8adfa8d2-427f-43b4-a56d-96ebf258f0fb.png'; Name='page_filter_tab_selected_150x64.png'; W=150; H=64 },
  @{ Source='exec-ddb5c6f7-c865-45b2-8372-85b0da232c2a.png'; Name='page_power_bar_bg_700x70.png'; W=700; H=70 },
  @{ Source='exec-78383081-ba4a-4410-9b46-8b6a0dd0d246.png'; Name='page_sub_tab_default_175x64.png'; W=175; H=64 },
  @{ Source='exec-676ef37a-8dde-4b5f-8bbd-e7a289cedbd4.png'; Name='page_sub_tab_selected_175x64.png'; W=175; H=64 },
  @{ Source='exec-42c062b6-b9b3-40e6-99fd-39e114a76739.png'; Name='page_main_nav_default_150x110.png'; W=150; H=110 },
  @{ Source='exec-d44b4db6-fcfd-432c-a767-e4e05291eae6.png'; Name='page_main_nav_selected_150x110.png'; W=150; H=110 },
  @{ Source='exec-8d48a981-b7e8-4ef0-9c0f-9fdc69861327.png'; Name='card_frame_160x220.png'; W=160; H=220 },
  @{ Source='exec-bbc353a2-62f9-46b4-a519-02c706ef0215.png'; Name='card_role_badge_34x34.png'; W=34; H=34 },
  @{ Source='exec-c3eb5ef7-8872-4d26-921e-e03c3146a9fb.png'; Name='card_art_window_112x96.png'; W=112; H=96 },
  @{ Source='exec-f49b25dc-f5b3-44ce-bec8-f9a9f434e418.png'; Name='card_progress_track_136x26.png'; W=136; H=26 },
  @{ Source='exec-e54cea40-dbea-4da5-8cca-6be0abdaba3f.png'; Name='card_progress_fill_136x26.png'; W=136; H=26 },
  @{ Source='exec-59cd2bb7-3365-4de0-9d57-b0b72283cb26.png'; Name='card_upgrade_badge_38x26.png'; W=38; H=26 }
)

foreach ($item in $items) {
  $src = Join-Path $generated $item.Source
  Copy-Item -LiteralPath $src -Destination (Join-Path $sourceDir $item.Source) -Force
  $input = [System.Drawing.Bitmap]::FromFile($src)
  $minX = $input.Width; $minY = $input.Height; $maxX = -1; $maxY = -1
  # Sampling is sufficient to remove the large generator padding and keeps this
  # batch fast enough for interactive use.
  for ($y = 0; $y -lt $input.Height; $y += 8) {
    for ($x = 0; $x -lt $input.Width; $x += 8) {
      $p = $input.GetPixel($x, $y)
      if ($p.A -gt 12 -and ($p.R + $p.G + $p.B) -gt 38) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $minX = [Math]::Max(0, $minX - 8); $minY = [Math]::Max(0, $minY - 8)
  $maxX = [Math]::Min($input.Width - 1, $maxX + 8); $maxY = [Math]::Min($input.Height - 1, $maxY + 8)
  $crop = if ($maxX -ge $minX -and $maxY -ge $minY) { New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1)) } else { New-Object System.Drawing.Rectangle(0, 0, $input.Width, $input.Height) }
  $bitmap = New-Object System.Drawing.Bitmap($item.W, $item.H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.DrawImage($input, (New-Object System.Drawing.Rectangle(0, 0, $item.W, $item.H)), $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $bitmap.Save((Join-Path $output $item.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose(); $input.Dispose()
}
