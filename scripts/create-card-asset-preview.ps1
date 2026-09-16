Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'output/card-page-ui-assets'
$outPng = Join-Path $dir 'card-page-assets-preview.png'
$outUiw = Join-Path $dir '卡牌-素材装配预览.uiw'

function Img($name) { return [System.Drawing.Image]::FromFile((Join-Path $dir $name)) }
function Draw($g, $name, $x, $y, $w, $h) { $i = Img $name; $g.DrawImage($i, $x, $y, $w, $h); $i.Dispose() }
function Txt($g, $s, $x, $y, $w, $size, $bold=$false, $color=$null) {
  if ($null -eq $color) { $color = [System.Drawing.Color]::FromArgb(255,24,38,76) }
  $style = if($bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
  $f=[System.Drawing.Font]::new('Microsoft YaHei UI',$size,$style,[System.Drawing.GraphicsUnit]::Pixel)
  $fmt=[System.Drawing.StringFormat]::new(); $fmt.Alignment=[System.Drawing.StringAlignment]::Center; $fmt.LineAlignment=[System.Drawing.StringAlignment]::Center
  $b=[System.Drawing.SolidBrush]::new($color); $g.DrawString($s,$f,$b,[System.Drawing.RectangleF]::new($x,$y,$w,$size*1.45),$fmt); $b.Dispose(); $fmt.Dispose(); $f.Dispose()
}
function Card($g, $x, $y, $role, $level, $progress, $parts, $upgrade=$false) {
  Draw $g 'card_frame_160x220.png' $x $y 160 220
  Draw $g 'card_role_badge_34x34.png' ($x+8) ($y+8) 34 34
  Txt $g $role ($x+8) ($y+13) 34 17 $true
  Draw $g 'card_art_window_112x96.png' ($x+14) ($y+46) 112 96
  Txt $g $level $x ($y+145) 160 19 $false ([System.Drawing.Color]::White)
  Draw $g 'card_progress_track_136x26.png' ($x+12) ($y+176) 136 26
  if ($progress -gt 0) { Draw $g 'card_progress_fill_136x26.png' ($x+12) ($y+176) ([Math]::Round(136*$progress/100)) 26 }
  Txt $g $parts ($x+12) ($y+180) 136 16 $false ([System.Drawing.Color]::White)
  if ($upgrade) { Draw $g 'card_upgrade_badge_38x26.png' ($x+116) ($y+6) 38 26 }
}

$b=[System.Drawing.Bitmap]::new(750,1600)
$g=[System.Drawing.Graphics]::FromImage($b); $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $g.Clear([System.Drawing.Color]::White)

# 公共层
$icons=@('common_resource_gem_32x32.png','common_resource_wood_32x32.png','common_resource_orb_32x32.png','common_resource_coin_32x32.png')
$vals=@('6','400','139','280')
for($i=0;$i -lt 4;$i++){ $x=14+$i*176; Draw $g 'common_resource_bar_bg_160x44.png' $x 60 160 44; Draw $g $icons[$i] ($x+13) 66 32 32; Txt $g $vals[$i] ($x+48) 69 70 20 $true ([System.Drawing.Color]::White); Txt $g '+' ($x+133) 72 20 16 $true ([System.Drawing.Color]::FromArgb(255,24,38,76)) }
Draw $g 'common_location_button_46x46.png' 500 14 46 46; Draw $g 'common_more_button_80x48.png' 556 12 80 48; Draw $g 'common_record_button_56x56.png' 648 12 56 56

# 牌组筛选与八张已装备卡
$labels=@('牌组','1','2','3','4','5'); $xs=@(25,145,265,385,505,615)
for($i=0;$i -lt 6;$i++){ if($i -eq 1){Draw $g 'page_filter_tab_selected_150x64.png' $xs[$i] 130 110 64; Txt $g $labels[$i] $xs[$i] 146 110 22 $true ([System.Drawing.Color]::White)}else{Draw $g 'page_filter_tab_default_110x64.png' $xs[$i] 130 110 64; Txt $g $labels[$i] $xs[$i] 146 110 22 $false} }
$positions=@(@(30,210),@(206,210),@(382,210),@(558,210),@(30,445),@(206,445),@(382,445),@(558,445))
$levels=@('等级 1','等级 1','等级 2','等级 1','等级 1','等级 1','等级 1','等级 1'); $parts=@('0/4','3/4','8/9','8/6','3/6','0/8','0/10','0/6'); $prog=@(0,75,89,100,50,0,0,0)
for($i=0;$i -lt 8;$i++){ Card $g $positions[$i][0] $positions[$i][1] '⚔' $levels[$i] $prog[$i] $parts[$i] ($i -eq 3) }

Draw $g 'page_power_bar_bg_700x70.png' 25 685 700 70; Txt $g '战力 9888' 42 700 245 28 $true ([System.Drawing.Color]::White); Txt $g '☠ 1  🐺 2  🛡 3  ⚙ 1  ⚔ 4' 300 706 390 19 $false ([System.Drawing.Color]::White)

# 图鉴区：首行与子 Tab，视觉预览显示可滚动区首屏
for($i=0;$i -lt 4;$i++){Card $g (31+$i*176) 795 '⚔' ($(if($i -eq 0){'等级 1'}else{'未解锁'})) ($(if($i -eq 0){100}else{0})) ($(if($i -eq 0){'8/6'}else{'—'})) ($i -eq 0)}
for($i=0;$i -lt 4;$i++){Card $g (31+$i*176) 1035 '⚔' '等级 1' (38+$i*12) '3/8'}
for($i=0;$i -lt 4;$i++){ if($i -eq 0){Draw $g 'page_sub_tab_selected_175x64.png' (25+$i*175) 1411 175 64; Txt $g '所有卡牌' (25+$i*175) 1431 175 20 $true ([System.Drawing.Color]::White)}else{Draw $g 'page_sub_tab_default_175x64.png' (25+$i*175) 1411 175 64; Txt $g @('神器','宝箱','表情')[$i-1] (25+$i*175) 1431 175 20 $false} }
for($i=0;$i -lt 5;$i++){if($i -eq 1){Draw $g 'page_main_nav_selected_150x110.png' ($i*150) 1490 150 110; Txt $g @('商店','卡牌','战斗','城堡','成就')[$i] ($i*150) 1528 150 22 $true ([System.Drawing.Color]::White)}else{Draw $g 'page_main_nav_default_150x110.png' ($i*150) 1490 150 110; Txt $g @('商店','卡牌','战斗','城堡','成就')[$i] ($i*150) 1528 150 22 $false}}
$g.Dispose(); $b.Save($outPng,[System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()

# Electron 开发服务器不能让 SVG <image> 读取 file:// 文件；把预览图内嵌为 data URI，
# 这样画布、原型预览和导出在任何加载方式下都可见。
$uri = 'data:image/png;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($outPng))
$doc = [ordered]@{
  version = 1
  meta = [ordered]@{ name='卡牌素材装配预览'; designWidth=750; designHeight=1600; orientation='portrait' }
  commonLayer = [ordered]@{ id='common-preview'; name='公共层'; nodes=@() }
  customWidgets = @()
  popups = @()
  pages = @([ordered]@{ id='card-assets-preview-page'; name='卡牌素材装配'; nodes=@([ordered]@{ id='assembled-card-assets'; type='image'; name='卡牌页素材装配效果'; x=0; y=0; w=750; h=1600; visible=$true; locked=$false; props=[ordered]@{ src=$uri } }) })
}
$doc | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outUiw -Encoding UTF8
