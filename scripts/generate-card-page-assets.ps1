Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'output/card-page-ui-assets'
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$Navy = [System.Drawing.Color]::FromArgb(255, 24, 38, 76)
$Ink = [System.Drawing.Color]::FromArgb(255, 18, 31, 61)
$Gold = [System.Drawing.Color]::FromArgb(255, 235, 183, 63)
$GoldHi = [System.Drawing.Color]::FromArgb(255, 255, 226, 123)
$Blue = [System.Drawing.Color]::FromArgb(255, 43, 112, 196)
$White = [System.Drawing.Color]::White

function Save-Asset([string]$Name, [int]$W, [int]$H, [scriptblock]$Paint) {
  $b = [System.Drawing.Bitmap]::new($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($White)
  & $Paint $g $W $H
  $g.Dispose()
  $b.Save((Join-Path $Out $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
}
function RoundRect($x,$y,$w,$h,$r) {
  $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); $d=$r*2
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure(); return $p
}
function FillRound($g,$color,$x,$y,$w,$h,$r) { $p=RoundRect $x $y $w $h $r; $b=[System.Drawing.SolidBrush]::new($color); $g.FillPath($b,$p); $b.Dispose(); $p.Dispose() }
function StrokeRound($g,$color,$width,$x,$y,$w,$h,$r) { $p=RoundRect $x $y $w $h $r; $p2=[System.Drawing.Pen]::new($color,$width); $g.DrawPath($p2,$p); $p2.Dispose(); $p.Dispose() }
function Diamond($g,$color,$points) { $b=[System.Drawing.SolidBrush]::new($color); $g.FillPolygon($b,$points); $b.Dispose() }

# 1. 公共层
Save-Asset 'common_resource_bar_bg_160x44.png' 160 44 {
  param($g,$w,$h)
  FillRound $g $Navy 1 2 158 40 20; StrokeRound $g $Gold 2 1 2 158 40 20
  FillRound $g ([System.Drawing.Color]::FromArgb(255,52,75,126)) 5 6 150 13 7
  FillRound $g $Gold 132 11 20 20 7; StrokeRound $g $GoldHi 1 132 11 20 20 7
}
Save-Asset 'common_resource_gem_32x32.png' 32 32 {
  param($g,$w,$h)
  Diamond $g $Blue @([System.Drawing.Point]::new(16,2),[System.Drawing.Point]::new(28,11),[System.Drawing.Point]::new(16,30),[System.Drawing.Point]::new(4,11))
  Diamond $g ([System.Drawing.Color]::FromArgb(255,117,225,255)) @([System.Drawing.Point]::new(16,2),[System.Drawing.Point]::new(16,30),[System.Drawing.Point]::new(8,11))
  Diamond $g ([System.Drawing.Color]::FromArgb(255,230,255,255)) @([System.Drawing.Point]::new(16,3),[System.Drawing.Point]::new(22,11),[System.Drawing.Point]::new(16,15),[System.Drawing.Point]::new(10,11))
}
Save-Asset 'common_resource_wood_32x32.png' 32 32 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,126,72,38)); $g.FillRectangle($b,8,5,16,24); $b.Dispose()
  $p=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255,83,43,27),2); $g.DrawEllipse($p,8,2,16,7); $g.DrawLine($p,8,13,24,13); $p.Dispose()
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,211,135,68)); $g.FillEllipse($b,12,4,8,3); $b.Dispose()
}
Save-Asset 'common_resource_orb_32x32.png' 32 32 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,101,68,177)); $g.FillEllipse($b,3,3,26,26); $b.Dispose()
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,245,200,255)); $g.FillEllipse($b,8,7,7,7); $b.Dispose()
  $p=[System.Drawing.Pen]::new($GoldHi,2); $g.DrawArc($p,6,6,20,20,110,130); $p.Dispose()
}
Save-Asset 'common_resource_coin_32x32.png' 32 32 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new($Gold); $g.FillEllipse($b,2,2,28,28); $b.Dispose(); $p=[System.Drawing.Pen]::new($GoldHi,2); $g.DrawEllipse($p,6,6,20,20); $p.Dispose()
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,197,134,37)); $g.FillRectangle($b,11,11,10,10); $b.Dispose()
}
Save-Asset 'common_location_button_46x46.png' 46 46 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new($Navy); $g.FillEllipse($b,2,2,42,42); $b.Dispose(); $p=[System.Drawing.Pen]::new($Gold,2); $g.DrawEllipse($p,2,2,42,42); $g.DrawEllipse($p,16,16,14,14); $g.DrawLine($p,23,8,23,14); $g.DrawLine($p,23,32,23,38); $g.DrawLine($p,8,23,14,23); $g.DrawLine($p,32,23,38,23); $p.Dispose()
}
Save-Asset 'common_more_button_80x48.png' 80 48 {
  param($g,$w,$h)
  FillRound $g $Navy 1 3 78 42 18; StrokeRound $g $Gold 2 1 3 78 42 18
  $b=[System.Drawing.SolidBrush]::new($GoldHi); foreach($x in 29,40,51){$g.FillEllipse($b,$x,21,6,6)}; $b.Dispose()
}
Save-Asset 'common_record_button_56x56.png' 56 56 {
  param($g,$w,$h)
  $b=[System.Drawing.SolidBrush]::new($Navy); $g.FillEllipse($b,2,2,52,52); $b.Dispose(); $p=[System.Drawing.Pen]::new($Gold,3); $g.DrawEllipse($p,2,2,52,52); $p.Dispose(); $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,222,65,75)); $g.FillEllipse($b,17,17,22,22); $b.Dispose()
}

# 2. 页面
Save-Asset 'page_filter_tab_default_110x64.png' 110 64 { param($g,$w,$h) FillRound $g ([System.Drawing.Color]::FromArgb(255,236,241,250)) 1 2 108 60 14; StrokeRound $g $Navy 2 1 2 108 60 14 }
Save-Asset 'page_filter_tab_selected_150x64.png' 150 64 { param($g,$w,$h) FillRound $g $Blue 1 2 148 60 14; StrokeRound $g $Gold 2 1 2 148 60 14; FillRound $g ([System.Drawing.Color]::FromArgb(255,87,154,228)) 7 7 136 11 6 }
Save-Asset 'page_power_bar_bg_700x70.png' 700 70 { param($g,$w,$h) FillRound $g $Navy 1 2 698 66 14; StrokeRound $g $Gold 2 1 2 698 66 14; FillRound $g ([System.Drawing.Color]::FromArgb(255,47,76,132)) 9 9 682 15 8 }
Save-Asset 'page_sub_tab_default_175x64.png' 175 64 { param($g,$w,$h) $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,229,236,248)); $g.FillRectangle($b,0,0,175,64); $b.Dispose(); $p=[System.Drawing.Pen]::new($Navy,2); $g.DrawLine($p,0,2,175,2); $g.DrawLine($p,174,2,174,64); $p.Dispose() }
Save-Asset 'page_sub_tab_selected_175x64.png' 175 64 { param($g,$w,$h) $b=[System.Drawing.SolidBrush]::new($Navy); $g.FillRectangle($b,0,0,175,64); $b.Dispose(); $b=[System.Drawing.SolidBrush]::new($Gold); $g.FillRectangle($b,6,2,163,5); $b.Dispose() }
Save-Asset 'page_main_nav_default_150x110.png' 150 110 { param($g,$w,$h) $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,235,241,250)); $g.FillRectangle($b,0,0,150,110); $b.Dispose(); $p=[System.Drawing.Pen]::new($Navy,2); $g.DrawLine($p,0,1,150,1); $g.DrawLine($p,149,10,149,100); $p.Dispose() }
Save-Asset 'page_main_nav_selected_150x110.png' 150 110 { param($g,$w,$h) $b=[System.Drawing.SolidBrush]::new($Navy); $g.FillRectangle($b,0,0,150,110); $b.Dispose(); $b=[System.Drawing.SolidBrush]::new($Gold); $g.FillRectangle($b,5,1,140,6); $b.Dispose() }

# 3. 游戏卡牌定制控件
Save-Asset 'card_frame_160x220.png' 160 220 { param($g,$w,$h) FillRound $g $Navy 1 1 158 218 16; StrokeRound $g $Gold 2 1 1 158 218 16; FillRound $g ([System.Drawing.Color]::FromArgb(255,49,76,125)) 7 7 146 36 11; FillRound $g ([System.Drawing.Color]::FromArgb(255,36,56,96)) 9 164 142 44 10 }
Save-Asset 'card_role_badge_34x34.png' 34 34 { param($g,$w,$h) $b=[System.Drawing.SolidBrush]::new($Gold); $g.FillEllipse($b,1,1,32,32); $b.Dispose(); $p=[System.Drawing.Pen]::new($GoldHi,2); $g.DrawEllipse($p,5,5,24,24); $p.Dispose() }
Save-Asset 'card_art_window_112x96.png' 112 96 { param($g,$w,$h) FillRound $g ([System.Drawing.Color]::FromArgb(255,21,35,71)) 1 1 110 94 9; StrokeRound $g $Gold 2 1 1 110 94 9; $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,42,88,151)); $g.FillEllipse($b,8,41,96,47); $b.Dispose(); $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,91,162,214)); $g.FillEllipse($b,29,13,45,45); $b.Dispose() }
Save-Asset 'card_progress_track_136x26.png' 136 26 { param($g,$w,$h) FillRound $g ([System.Drawing.Color]::FromArgb(255,19,29,56)) 1 3 134 20 9; StrokeRound $g $Gold 2 1 3 134 20 9; FillRound $g ([System.Drawing.Color]::FromArgb(255,68,89,133)) 5 7 126 12 5 }
Save-Asset 'card_progress_fill_136x26.png' 136 26 { param($g,$w,$h) FillRound $g ([System.Drawing.Color]::FromArgb(255,67,205,145)) 1 3 134 20 9; FillRound $g ([System.Drawing.Color]::FromArgb(255,161,255,195)) 5 6 124 6 3 }
Save-Asset 'card_upgrade_badge_38x26.png' 38 26 { param($g,$w,$h) FillRound $g ([System.Drawing.Color]::FromArgb(255,224,80,71)) 1 1 36 24 8; StrokeRound $g $GoldHi 1 1 1 36 24 8; $b=[System.Drawing.SolidBrush]::new($White); $g.FillPolygon($b,@([System.Drawing.Point]::new(19,5),[System.Drawing.Point]::new(30,15),[System.Drawing.Point]::new(24,15),[System.Drawing.Point]::new(24,21),[System.Drawing.Point]::new(14,21),[System.Drawing.Point]::new(14,15),[System.Drawing.Point]::new(8,15))); $b.Dispose() }
