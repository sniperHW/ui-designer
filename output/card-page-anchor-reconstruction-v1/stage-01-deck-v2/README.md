# 阶段 01：牌组区锚点还原（v2）

本阶段只验收牌组标题底板、5 个编号筛选按钮及其选中态下挂菱形；资源条和背景仅作局部预览上下文，不纳入本阶段视觉评分。

**验收状态：已通过并冻结。** 后续阶段必须复用本目录的尺寸、素材映射与交互规则；只有锚点被明确修订时才允许回改。

## 真实结构与交互

- [牌组按钮-锚点验收预览-v2.uiw](牌组按钮-锚点验收预览-v2.uiw) 使用真实 `filter` 控件，标签 `I / II / III / IV / V` 保持运行时渲染。
- `assetActiveOverlaySrc` 是筛选器的通用选中态覆盖层：菱形随点击后的 `selected` 项移动，不再是首项静态图片。
- 素材不含数字或文字。标题底板保持无字。

## 素材 ↔ 节点

| 素材 | 设计像素 | `.uiw` 节点 |
|---|---:|---|
| `assets/deck_title_211x80.png` | 211×80 | 牌组标题底板 |
| `assets/deck_title_gem_28x26.png` | 28×26 | 牌组标题菱形装饰 |
| `assets/deck_tab_default_98x80.png` | 98×80 | 牌组编号切换 / 未选中项 |
| `assets/deck_tab_active_98x80.png` | 98×80 | 牌组编号切换 / 选中项 |
| `assets/deck_active_gem_26x25.png` | 26×25 | 牌组编号切换 / 选中态覆盖层 |

## 构建与核验

`stage.json` 是可复用参数清单。`build_chrome_family.py` 以锚点区域、轮廓和运行时文字清除规则构建同类皮肤；`assemble_uiw_preview.py` 负责绑定而不改交互容器；`compare_anchor.py` 输出局部参考、预览、叠图与不透明差异图。

确认截图：`compare/reference.png`、`compare/preview.png`、`compare/overlay.png`、`compare/difference.png`。

当前局部 RGB 平均绝对差为 `10.89 / 255`（包含未纳入验收的背景差异）；差异图为不透明 RGB 图，用于定位剩余偏差。
