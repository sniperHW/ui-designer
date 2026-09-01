# 控件类型参考（默认值来自 `src/renderer/src/widgets/registry.ts`）

> 频率常量：Tab 页签栏默认高 `40`（可用 `props.barHeight` 调整，页签字号 `props.fontSize` 默认 22），弹窗标题栏高 `48`（内容区在标题栏下方）。
> 文本一律垂直居中；字号默认区间 20–30；坐标建议对齐 10px 网格。

## 形状

| type | 名称 | 默认尺寸 | props |
|---|---|---|---|
| `rect` | 矩形 / 圆角矩形 | 160×90 / 160×72 | `radius`（圆角，胶囊=高度一半，如 44 高配 22） |
| `ellipse` | 椭圆 / 圆 | 120×80 | — |
| `line` | 线段 | 240×2 | —（水平线，绘制在节点垂直中线） |
| `placeholder` | 占位图 | 160×120 | —（矩形 + 对角线，用于图片占位） |
| `nine` | 九宫格 | 160×120 | —（带三分线的可拉伸图占位） |

## 文本

| type | 名称 | 默认尺寸 | props |
|---|---|---|---|
| `text` | 文本 | 160×32 | `text`（支持 `\n` 多行）、`fontSize`（默认 26）、`bold`、`align`（`left`/`center`/`right`） |

标题常用：`fontSize 32–40, bold true`；正文 24–26；辅助说明 20–22（灰色视觉，格式仍是黑描边线框）。

## 交互

| type | 名称 | 默认尺寸 | props | 说明 |
|---|---|---|---|---|
| `button` | 按钮 | 200×80 | `text`、`fontSize`(26)、`bold` | 文字自动水平居中，圆角 12 |
| `checkbox` | 复选框 | 200×40 | `text`、`checked`、`fontSize`(24) | 左侧 18px 方框 + 标签 |
| `progress` | 进度条 | 300×24 | `progress`（0–100） | |
| `input` | 输入框 | 320×64 | `placeholder`、`fontSize`(24) | 灰色占位文本 |
| `filter` | 筛选器 | 480×56 | `options`: string[]、`selected`: number | 一行标签单选（选中黑底白字）；通过 `binding` 过滤同页 list/grid |

筛选器联动示例：

```jsonc
// 筛选器
{ "type": "filter", "props": { "options": ["全部", "英雄", "部队"], "selected": 0 },
  "binding": { "target": "<list或grid的节点id>", "tagKey": "类别" } }
// 被筛选的列表
{ "type": "list", "props": { "direction": "v", "count": 5 }, "itemTags": ["英雄", "部队", "英雄", "建筑", "部队"] }
```

点击交互：`button` 天生可点击；其它控件加 `"clickable": true` 开启（**定制控件实例 `custom` 除外**——实例整体的可点击不生效，点击标记统一配在**定义树内的控件**上，所有实例同步响应）。点击效果 `clickAction` 三选一——切换页面 / 返回上一页 / 弹出弹窗（弹窗在独立的**弹窗页** `popups` 中设计，不能放在普通页面上；详见 schema.md）：

```jsonc
// 按钮 → 跳转到某页面
{ "type": "button", "props": { "text": "开始战斗" },
  "clickAction": { "type": "goto", "target": "<目标页面id>" } }
// 返回按钮 → 返回跳转来之前的页面（无来路时点击无效果，常用于二级页的「返回」）
{ "type": "button", "props": { "text": "返回" }, "clickAction": { "type": "back" } }
// 定制控件（如卡牌）整体可点 → 在其 customWidgets 定义树里给铺满的底层控件配 clickable
{ "id": "w_card", "tree": [
  { "id": "n_card_bg", "type": "rect", "clickable": true,
    "clickAction": { "type": "popup", "target": "<弹窗页id>" }, /* …铺满整张卡… */ }
] }
```

## 容器

| type | 名称 | 默认尺寸 | 子控件挂载 | 内容区 |
|---|---|---|---|---|
| `panel` | 面板 | 320×240 | `children` | 整个矩形 |
| `dialog` | 弹窗 | 480×320 | `children` | 标题栏（高 48）**下方**区域；props: `title`（弹窗页本体与页名保持一致，编辑器双向同步）；**仅弹窗页（popups）内可用**，页面 / 公共层 / 定制控件内不放 |
| `scroll` | 滚动区 | 320×240 | `children` | 整个矩形（超出裁剪 + 滚动条示意；预览中滚轮可滚动，滑块随内容移动） |
| `tab` | Tab 页签 | 480×320 | `pages`（每页签一个数组） | 页签栏之外的区域；`barPosition`: `top`/`bottom`，`barHeight`: 页签栏高（默认 40，上限为控件高一半），`fontSize`: 页签字号（默认 22） |
| `list` | 列表 | 300×320 | ❌ 不可挂子控件 | `direction`: `v`/`h`、`count`；项为生成的占位格 |
| `grid` | 网格 | 400×320 | ❌ 不可挂子控件 | `cols`、`count`；项为生成的占位格 |
| `custom` | 定制控件实例 | — | `slots` | 见 schema.md |

### tab 示例（页签栏在底部，两页签）

```jsonc
{
  "id": "n_tab_main", "type": "tab", "name": "主 Tab", "activeTab": 0,
  "x": 0, "y": 1320, "w": 750, "h": 280, "visible": true, "locked": false,
  "props": { "tabs": ["卡牌", "商店"], "barPosition": "bottom" },
  "pages": [
    [ /* 页签 0 的子控件，页面绝对坐标 */ ],
    [ /* 页签 1 的子控件 */ ]
  ]
}
```

### 需要滚动/自定义格子时的惯例

- 长内容 → `scroll` 容器 + 手摆子控件（内容高度可超出容器，被裁剪即示意"可滚动"）。
- 可筛选的重复列表 → `list`/`grid` + `itemTags` + `filter` 联动。
- 每个格子要放自定义内容 → `grid` 不行（占位格），改用 `scroll` 内手摆行/格。

## 定制控件（custom）

| 字段 | 说明 |
|---|---|
| `customId` | 引用 `customWidgets[].id` |
| `overrides` | `{ "暴露属性名": 值 }`，未提供的属性用定义的 `default` |
| `slots` | 向定义内开放的容器/页签塞内容，键规则见 schema.md |

实例的 `w`/`h` 可以与定义默认尺寸不同：内部结构按比例缩放（字号按两轴均值缩放）。
