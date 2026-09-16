# 卡牌页无字 UI 美术素材清单

来源：`examples/卡牌.uiw`，并以 `out/prtsc/卡牌页.png` 的线框布局核对。本轮的 21 个既有部件 PNG 均由独立生图请求生成并按既有节点像素规格输出；没有图集、没有跨部件复用。另补充 1 张仅供装配预览使用的页面背景。所有图片均无文字、无数字；运行时文字和数值继续使用 `.uiw` 内的文本节点。

## 工具内装配预览

`card-page-assets-preview.png` 与 `卡牌-素材装配预览.uiw` 是早期静态预览。重新生图后的验收请优先使用下面的交互预览；原始 `examples/卡牌.uiw` 未被修改。

`卡牌-素材交互装配预览.uiw` 是基于原 `卡牌.uiw` 的交互版：资源、卡框、进度条、筛选／Tab 底板以素材皮肤装配，保留原有的页签切换与滚动区交互。应优先打开这一份。

| 文件 | 像素 | 对应 .uiw 节点／定制控件 | 使用说明 |
|---|---:|---|---|
| `page_background_750x1600.png` | 750×1600 | 交互预览的 `页面背景素材` | 仅作为预览工程最底层背景，消除默认纯白画布；不修改原始工程。 |
| `common_resource_bar_bg_160x44.png` | 160×44 | `nmtfpehuyuv6v`、`nmtfpelgdfx5t`、`nmtfpep27rvqd`、`nmtfpesol58ij` | 资源条底板；加号文字独立运行时绘制。 |
| `common_resource_gem_32x32.png` | 32×32 | `nmtfpeio4jacg` 图标区 | 钻石资源图标。 |
| `common_resource_wood_32x32.png` | 32×32 | `nmtfpema09tst` 图标区 | 木材资源图标。 |
| `common_resource_orb_32x32.png` | 32×32 | `nmtfpepvqg0y8` 图标区 | 魔法球资源图标。 |
| `common_resource_coin_32x32.png` | 32×32 | `nmtfpethzijdp` 图标区 | 金币资源图标。 |
| `common_location_button_46x46.png` | 46×46 | `nmtfpefjik20h` | 定位按钮。 |
| `common_more_button_80x48.png` | 80×48 | `nmtfpeg8oppmt` | 更多按钮底；不含文本省略号。 |
| `common_record_button_56x56.png` | 56×56 | `nmtfpeh682mie` | 录制按钮。 |
| `page_filter_tab_default_110x64.png` | 110×64 | `nmtfpexgs7rvb` | 筛选标签的普通单元。 |
| `page_filter_tab_selected_150x64.png` | 150×64 | `nmtfpexgs7rvb` | 筛选标签的选中单元。 |
| `page_power_bar_bg_700x70.png` | 700×70 | `nmtfpfe5qqumv` | 战力条底板。 |
| `page_sub_tab_default_175x64.png` | 175×64 | `nmtfpfgz5mrw9` | 子 Tab 的普通单元，四格拼接。 |
| `page_sub_tab_selected_175x64.png` | 175×64 | `nmtfpfgz5mrw9` | 子 Tab 的选中单元。 |
| `page_main_nav_default_150x110.png` | 150×110 | `nmtfpewglapzq` | 主导航普通单元，五格拼接。 |
| `page_main_nav_selected_150x110.png` | 150×110 | `nmtfpewglapzq` | 主导航选中单元。 |
| `card_frame_160x220.png` | 160×220 | `游戏卡牌` / `nmtfpf5mxr8wc` | 卡框底图。 |
| `card_role_badge_34x34.png` | 34×34 | `游戏卡牌` / `nmtfpf5mxyl0p` | 配型角标底；配型图标是 `nmtfpf5mxyvsr` 的运行时文本。 |
| `card_art_window_112x96.png` | 112×96 | `游戏卡牌` / `nmtfpf5mxp1mw` | 卡面窗；可替换为具体卡面。 |
| `card_progress_track_136x26.png` | 136×26 | `游戏卡牌` / `nmtfpf5mydhsa` | 进度条底。 |
| `card_progress_fill_136x26.png` | 136×26 | `游戏卡牌` / `nmtfpf5mydhsa` | 进度填充层，按 `进度` 裁剪。 |
| `card_upgrade_badge_38x26.png` | 38×26 | `游戏卡牌` / `nmtfpf5my5d5c` | 无字升级箭头标；显示状态由 `可升级` 控制。 |

未输出为图片的运行时文本节点：4 个资源值、4 个资源加号、`战力值`、`兵种统计`、筛选／Tab 标签，以及游戏卡牌中的 `配型图标`、`等级文字`、`碎片文字`。
