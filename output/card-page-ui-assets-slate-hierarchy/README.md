# 卡牌页无字 UI 美术素材：石板蓝分级框体版

本目录以已确认的 `卡牌页-视觉锚点图-石板蓝分级框体版.png` 为唯一视觉基准，服务于 `examples/卡牌.uiw` 的既有布局与交互。素材未从锚点图裁切；背景、卡面、角标和状态素材由内置图像生成工作流生成，其余小尺寸容器按节点的精确像素契约导出为透明 PNG。

`卡牌-素材交互装配预览.uiw` 已绑定本目录所有素材，并保留原页面的底部导航、牌组筛选、卡牌分类 Tab 和滚动区交互。`examples/卡牌.uiw` 未被修改。

| 文件 | 像素 | 对应 `.uiw` 节点／控件 | 层级规则 |
|---|---:|---|---|
| `page_background_750x1600.png` | 750×1600 | 预览新增最底层 `页面背景素材` | 仅承担氛围，不含容器或控件。 |
| `common_resource_bar_bg_160x44.png` | 160×44 | 4 个资源条：`nmtfpehuyuv6v`、`nmtfpelgdfx5t`、`nmtfpep27rvqd`、`nmtfpesol58ij` | 低对比细边。 |
| `common_resource_gem_32x32.png`、`common_resource_wood_32x32.png`、`common_resource_orb_32x32.png`、`common_resource_coin_32x32.png` | 32×32 | 预览新增 `资源图标1–4` | 资源识别色。 |
| `common_location_button_46x46.png`、`common_more_button_80x48.png`、`common_record_button_56x56.png` | 各自规格 | `定位按钮`、`更多按钮`、`录制按钮` | 中等强调。 |
| `page_filter_tab_default_110x64.png`、`page_filter_tab_selected_150x64.png` | 各自规格 | `牌组选择` / `nmtfpexgs7rvb` | 仅选中项使用亮金属强调。 |
| `page_power_bar_bg_700x70.png` | 700×70 | `战力条` / `nmtfpfe5qqumv` | 一级信息容器，中等边框。 |
| `page_sub_tab_default_175x64.png`、`page_sub_tab_selected_175x64.png` | 各自规格 | `卡牌分类` / `nmtfpfgz5mrw9` | 普通项为细线，选中项提升亮度。 |
| `page_main_nav_default_150x110.png`、`page_main_nav_selected_150x110.png` | 各自规格 | `底部导航` / `nmtfpewglapzq` | 五格共享暗底与弱分隔；选中项强强调。 |
| `card_frame_160x220.png` | 160×220 | `游戏卡牌 / 卡框` / `nmtfpf5mxr8wc` | 卡牌级轻薄边缘，卡面优先。 |
| `card_role_badge_34x34.png` | 34×34 | `游戏卡牌 / 配型底` / `nmtfpf5mxyl0p` | 独立角标，供运行时配型字覆盖。 |
| `card_art_window_112x96.png` | 112×96 | `游戏卡牌 / 卡面图片` / `nmtfpf5mxp1mw` | 预览用卡面，可按具体卡牌替换。 |
| `card_progress_track_136x26.png`、`card_progress_fill_136x26.png` | 各自规格 | `游戏卡牌 / 碎片进度条` / `nmtfpf5mydhsa` | 最低层级状态控件，填充按进度裁剪。 |
| `card_upgrade_badge_38x26.png` | 38×26 | `游戏卡牌 / 可升级标识` / `nmtfpf5my5d5c` | 独立升级提示，不含文字。 |

以下内容继续由运行时节点绘制，未写入任何 PNG：资源数值、资源加号、战力/兵种统计、牌组与分类/底部导航标签，以及 `游戏卡牌` 的配型、等级、碎片文字和可升级状态文字。

`sources/` 保存了本轮实际采用的图像生成源图，便于后续基于同一锚点重新导出或替换。
