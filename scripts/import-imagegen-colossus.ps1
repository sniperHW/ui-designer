Add-Type -AssemblyName System.Drawing
$root=Split-Path -Parent $PSScriptRoot
$out=Join-Path $root 'output/card-page-ui-assets'
$generated='C:\Users\Administrator\.codex\generated_images\01a06142-659e-78f3-8d30-dff691c1f7d5'
function CropSave($src,$cropX,$cropY,$cropW,$cropH,$dest,$w,$h){
  $i=[System.Drawing.Image]::FromFile($src); $b=[System.Drawing.Bitmap]::new($w,$h); $g=[System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g.DrawImage($i,[System.Drawing.Rectangle]::new(0,0,$w,$h),[System.Drawing.Rectangle]::new($cropX,$cropY,$cropW,$cropH),[System.Drawing.GraphicsUnit]::Pixel); $g.Dispose(); $b.Save($dest,[System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose(); $i.Dispose()
}
Copy-Item (Join-Path $generated 'exec-3f711761-6583-4ce0-9943-9378723b4fd6.png') (Join-Path $out 'card_frame_colossus_source.png') -Force
Copy-Item (Join-Path $generated 'exec-854b1264-4da7-4b3f-9d95-9822db8105d0.png') (Join-Path $out 'card_art_colossus_source.png') -Force
Copy-Item (Join-Path $generated 'exec-da84d930-c44d-40dc-931b-d72273ff6066.png') (Join-Path $out 'common_resource_bar_colossus_source.png') -Force
CropSave (Join-Path $out 'card_frame_colossus_source.png') 85 80 900 1300 (Join-Path $out 'card_frame_160x220.png') 160 220
CropSave (Join-Path $out 'card_art_colossus_source.png') 130 170 760 1100 (Join-Path $out 'card_art_window_112x96.png') 112 96
CropSave (Join-Path $out 'common_resource_bar_colossus_source.png') 55 330 920 360 (Join-Path $out 'common_resource_bar_bg_160x44.png') 160 44

# 第二批内置 ImageGen 图集：切分为运行时小尺寸皮肤。
Copy-Item (Join-Path $generated 'exec-3196b46c-b0aa-4b4f-a512-93076c05dcd1.png') (Join-Path $out 'nav_colossus_source.png') -Force
Copy-Item (Join-Path $generated 'exec-b1447f25-03ee-4e1d-95db-6572bd329959.png') (Join-Path $out 'widgets_colossus_atlas.png') -Force
Copy-Item (Join-Path $generated 'exec-8d18805a-a32d-44b8-9e81-e76a5c849636.png') (Join-Path $out 'resource_icons_colossus_atlas.png') -Force
CropSave (Join-Path $out 'nav_colossus_source.png') 80 330 860 360 (Join-Path $out 'page_main_nav_selected_150x110.png') 150 110
CropSave (Join-Path $out 'nav_colossus_source.png') 80 330 860 360 (Join-Path $out 'page_main_nav_default_150x110.png') 150 110
CropSave (Join-Path $out 'widgets_colossus_atlas.png') 40 40 460 460 (Join-Path $out 'card_role_badge_34x34.png') 34 34
CropSave (Join-Path $out 'widgets_colossus_atlas.png') 520 40 460 460 (Join-Path $out 'card_progress_track_136x26.png') 136 26
CropSave (Join-Path $out 'widgets_colossus_atlas.png') 40 520 460 460 (Join-Path $out 'card_progress_fill_136x26.png') 136 26
CropSave (Join-Path $out 'widgets_colossus_atlas.png') 520 520 460 460 (Join-Path $out 'card_upgrade_badge_38x26.png') 38 26
CropSave (Join-Path $out 'resource_icons_colossus_atlas.png') 40 40 460 460 (Join-Path $out 'common_resource_gem_32x32.png') 32 32
CropSave (Join-Path $out 'resource_icons_colossus_atlas.png') 520 40 460 460 (Join-Path $out 'common_resource_wood_32x32.png') 32 32
CropSave (Join-Path $out 'resource_icons_colossus_atlas.png') 40 520 460 460 (Join-Path $out 'common_resource_orb_32x32.png') 32 32
CropSave (Join-Path $out 'resource_icons_colossus_atlas.png') 520 520 460 460 (Join-Path $out 'common_resource_coin_32x32.png') 32 32
# 同风格石材面板的延展皮肤（保留原控件交互与文字层）。
CropSave (Join-Path $out 'common_resource_bar_colossus_source.png') 55 330 920 360 (Join-Path $out 'page_power_bar_bg_700x70.png') 700 70
CropSave (Join-Path $out 'common_resource_bar_colossus_source.png') 55 330 920 360 (Join-Path $out 'page_filter_tab_default_110x64.png') 110 64
CropSave (Join-Path $out 'nav_colossus_source.png') 80 330 860 360 (Join-Path $out 'page_filter_tab_selected_150x64.png') 150 64
CropSave (Join-Path $out 'nav_colossus_source.png') 80 330 860 360 (Join-Path $out 'page_sub_tab_default_175x64.png') 175 64
CropSave (Join-Path $out 'nav_colossus_source.png') 80 330 860 360 (Join-Path $out 'page_sub_tab_selected_175x64.png') 175 64
