Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'output/card-page-ui-assets'
$generated = 'C:\Users\Administrator\.codex\generated_images\01a06142-659e-78f3-8d30-dff691c1f7d5'
$sourceDir = Join-Path $output 'sources-v2'
New-Item -ItemType Directory -Force -Path $sourceDir | Out-Null

# One generated source is assigned to one UI component only.  The final pass only
# normalizes the canvas to the pixel dimensions in the existing UIW contract.
$items = @(
  @{ Source='exec-79a0491e-bc90-4eb0-b238-c5cdc5c34e23.png'; Name='page_background_750x1600.png'; W=750; H=1600 },
  @{ Source='exec-2c626c73-805a-4798-acb0-0632787a1306.png'; Name='common_resource_bar_bg_160x44.png'; W=160; H=44 },
  @{ Source='exec-409ff89b-0918-4270-982a-97a1ff2e4af4.png'; Name='common_resource_gem_32x32.png'; W=32; H=32 },
  @{ Source='exec-57ff788e-6318-4386-a4d2-75155ecd551f.png'; Name='common_resource_wood_32x32.png'; W=32; H=32 },
  @{ Source='exec-2e758d24-cd96-456b-9af9-bc54174b3f43.png'; Name='common_resource_orb_32x32.png'; W=32; H=32 },
  @{ Source='exec-4dad5a6c-0bff-47f6-82c2-50db36326ded.png'; Name='common_resource_coin_32x32.png'; W=32; H=32 },
  @{ Source='exec-7d91b3e2-6ad7-477c-9573-18dddb37cefd.png'; Name='common_location_button_46x46.png'; W=46; H=46 },
  @{ Source='exec-5a1e83c8-e5c7-45ee-a980-1fb4020a4b5b.png'; Name='common_more_button_80x48.png'; W=80; H=48 },
  @{ Source='exec-8e617465-c347-4730-a95e-addc7bce7bc4.png'; Name='common_record_button_56x56.png'; W=56; H=56 },
  @{ Source='exec-13eea680-3e8d-487d-bcf1-38dfb5f9eb7a.png'; Name='page_filter_tab_default_110x64.png'; W=110; H=64 },
  @{ Source='exec-624c0bf2-110a-4847-8163-77bbe05d6028.png'; Name='page_filter_tab_selected_150x64.png'; W=150; H=64 },
  @{ Source='exec-ef2f5991-d0fc-4c50-8756-bbf98037e793.png'; Name='page_power_bar_bg_700x70.png'; W=700; H=70 },
  @{ Source='exec-4beebc39-bdd7-474b-8fa4-86ae538f9bb9.png'; Name='page_sub_tab_default_175x64.png'; W=175; H=64 },
  @{ Source='exec-581c4f3d-1b11-4fd8-aa53-3251ffeed955.png'; Name='page_sub_tab_selected_175x64.png'; W=175; H=64 },
  @{ Source='exec-fcd658b6-9870-49ee-b015-a7d30ca7f567.png'; Name='page_main_nav_default_150x110.png'; W=150; H=110 },
  @{ Source='exec-3ef9d4ca-69ef-4e56-a264-4570bfd0b992.png'; Name='page_main_nav_selected_150x110.png'; W=150; H=110 },
  @{ Source='exec-3770b47b-9101-413e-afa6-510d789d7d8d.png'; Name='card_frame_160x220.png'; W=160; H=220 },
  @{ Source='exec-cd7762c1-ec9f-4111-84d2-92968cff3af0.png'; Name='card_role_badge_34x34.png'; W=34; H=34 },
  @{ Source='exec-1e2c7264-b1be-458c-ad05-34c7495d20e7.png'; Name='card_art_window_112x96.png'; W=112; H=96 },
  @{ Source='exec-3a8357cd-c3e8-4705-bd87-f4f51c4372ef.png'; Name='card_progress_track_136x26.png'; W=136; H=26 },
  @{ Source='exec-f3f3e8c8-ab5e-44e1-842f-ad148090cc79.png'; Name='card_progress_fill_136x26.png'; W=136; H=26 },
  @{ Source='exec-cc3b348e-8e58-44b6-9d44-d65610e88c65.png'; Name='card_upgrade_badge_38x26.png'; W=38; H=26 }
)

foreach ($item in $items) {
  $src = Join-Path $generated $item.Source
  $archive = Join-Path $sourceDir $item.Source
  Copy-Item -LiteralPath $src -Destination $archive -Force
  $input = [System.Drawing.Image]::FromFile($src)
  $bitmap = New-Object System.Drawing.Bitmap($item.W, $item.H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.DrawImage($input, (New-Object System.Drawing.Rectangle(0, 0, $item.W, $item.H)))
  $bitmap.Save((Join-Path $output $item.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose(); $input.Dispose()
}
