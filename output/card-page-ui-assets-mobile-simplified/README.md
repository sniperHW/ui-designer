# 卡牌页无字 UI 美术素材：移动端精简版

本目录是现有卡牌素材的并行版本，未覆盖 `output/card-page-ui-assets`。保留深海军蓝、炭黑石材、低饱和青铜的古代巨像风格，但每个部件限制为清晰的大轮廓、单层边框和更大的运行时文字留白，减少手机小屏上的视觉噪声。

`卡牌-素材交互装配预览.uiw` 已使用本目录素材，保留原有页签、筛选与滚动交互；原始 `examples/卡牌.uiw` 未改动。

| 文件 | 像素 | 对应节点／控件 |
|---|---:|---|
| `page_background_750x1600.png` | 750×1600 | 预览专用最底层 `页面背景素材` |
| `common_resource_bar_bg_160x44.png` | 160×44 | 4 个 `资源条` |
| `common_resource_gem_32x32.png`、`common_resource_wood_32x32.png`、`common_resource_orb_32x32.png`、`common_resource_coin_32x32.png` | 32×32 | 4 个资源图标区 |
| `common_location_button_46x46.png`、`common_more_button_80x48.png`、`common_record_button_56x56.png` | 各自规格 | `定位按钮`、`更多按钮`、`录制按钮` |
| `page_filter_tab_default_110x64.png`、`page_filter_tab_selected_150x64.png` | 各自规格 | `牌组选择` |
| `page_power_bar_bg_700x70.png` | 700×70 | `战力条` |
| `page_sub_tab_default_175x64.png`、`page_sub_tab_selected_175x64.png` | 各自规格 | `卡牌分类` |
| `page_main_nav_default_150x110.png`、`page_main_nav_selected_150x110.png` | 各自规格 | `底部导航` |
| `card_frame_160x220.png` | 160×220 | `游戏卡牌 / 卡框` |
| `card_role_badge_34x34.png` | 34×34 | `游戏卡牌 / 配型底` |
| `card_art_window_112x96.png` | 112×96 | `游戏卡牌 / 卡面图片` |
| `card_progress_track_136x26.png`、`card_progress_fill_136x26.png` | 各自规格 | `游戏卡牌 / 碎片进度条` |
| `card_upgrade_badge_38x26.png` | 38×26 | `游戏卡牌 / 可升级标识` |

等级、碎片、战力、资源数值与 Tab 名称仍由 `.uiw` 运行时文字节点绘制，不在图片内。
