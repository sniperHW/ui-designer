# 卡牌页素材 ↔ 2.0 UIW 节点

本目录的所有 PNG 都是运行时尺寸；UIW 内嵌同一份 PNG 数据以确保在设计工具中直接打开即可预览。

| 素材 | 设计尺寸 | 绑定节点 / 定制控件 |
|---|---:|---|
| page_background_750x1600.png | 750×1600 | 公共层 / 页面背景素材 |
| common_resource_bar_bg_160x44.png | 160×44 | 公共层 / 4 个资源条 |
| deck_title_plate_140x64.png | 140×64 | 页面 / 牌组标题底板 |
| page_filter_tab_default_110x64.png, page_filter_tab_active_110x64.png | 110×64 | 页面 / 牌组编号切换（5 个真实筛选项） |
| card_frame_{green,blue,purple,gold}_160x220.png | 160×220 | 定制控件 / 游戏卡牌（4 个稀有度）/ 卡框 |
| card_art_*_136x112.png（16 张） | 136×112 | 定制控件 / 游戏卡牌 / 卡面图片；由每张卡实例的“卡面”属性覆盖 |
| card_progress_track_136x24.png, card_progress_fill_136x24.png | 136×24 | 定制控件 / 游戏卡牌 / 碎片进度条 |
| page_power_bar_bg_700x70.png | 700×70 | 页面 / 战力条 |
| library_filter_* | 120×64 / 72×64 | 页面 / 卡库筛选（5 个真实切换项） |
| page_sub_tab_*_175x64.png | 175×64 | 卡库筛选各页 / 卡牌分类（卡牌、神器、宝箱、表情） |
| page_main_nav_*_150x110.png | 150×110 | 页面 / 主导航（5 个真实切换项） |

运行时文本（资源数、牌组号、等级、碎片、战力、筛选和导航文字）仍是 UIW 文本节点，未写入 PNG。顶端定位、更多、录制按钮保持隐藏，符合已确认范围。

## 生成说明

- build-card-page-assets-2.0.ps1：将 ImageGen 原始卡面裁切并缩放到节点实际尺寸，同时生成可控的框体皮肤。
- assemble-card-preview-2.0.mjs：将 PNG 绑定到结构规范 2.0，并为每个卡牌实例写入独立“卡面”覆盖值；不改动任何交互容器的层级或坐标。
