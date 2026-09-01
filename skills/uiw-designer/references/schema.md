# `.uiw` 工程格式规范（ProjectDoc Schema）

`.uiw` 文件是一个 UTF-8 JSON 文档（建议 2 空格缩进），对应源码类型 `src/renderer/src/types.ts`。
坐标单位一律为**设计像素**，原点在页面左上角。

## 顶层结构 ProjectDoc

```jsonc
{
  "version": 1,                    // 固定为 1
  "meta": { ... },                 // ProjectMeta，见下
  "commonLayer": { ... },          // PageData，公共层：内容显示在所有页面之下
  "customWidgets": [ ... ],        // CustomWidgetDef[]，定制控件定义库（可为空数组）
  "popups": [ ... ],               // PageData[]，弹窗页：独立设计的弹窗，由点击效果（popup）弹出
  "pages": [ ... ]                 // PageData[]，至少 1 页
}
```

### 弹窗页（popups）

弹窗在**独立的弹窗页**中设计（普通页面 / 公共层 / 定制控件定义内均不允许放 `dialog` 控件），页面结构同 PageData：

```jsonc
{ "id": "pp_confirm", "name": "确认弹窗", "nodes": [ { "type": "dialog", ... } ] }
```

- 典型内容：一个居中的 `dialog`（+ 其 children 内容控件），按设计坐标摆放，触发弹出时原位浮层显示；
- **弹窗页 `name` 应与其本体 dialog 的 `title`（标题栏文字）保持一致**——编辑器中两者双向同步（重命名弹窗页即改标题栏，反之亦然）；
- 页面上的按钮 / 控件通过 `clickAction: { "type": "popup", "target": "<弹窗页 id>" }` 绑定弹窗。

## meta（ProjectMeta）

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 工程名 |
| `designWidth` | number | 设计宽度（px），横屏常用 1334 / 1280 / 1920，竖屏常用 750 / 1170 |
| `designHeight` | number | 设计高度（px），横屏常用 750 / 720 / 1080，竖屏常用 1600 / 2532 |
| `orientation` | `"landscape" \| "portrait"` | 横屏 / 竖屏 |

## 页面（PageData）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 全文档唯一（应用生成 `p…` 前缀，任意唯一字符串均可） |
| `name` | string | 页面名，如 `主城`、`卡牌收集` |
| `nodes` | WidgetNode[] | 页面根级控件，按数组顺序绘制（**后渲染的在上层**） |

公共层 `commonLayer` 与页面同构（id 固定为 `"common"` 即可）。状态栏、主界面常驻按钮等所有页面共享的内容放公共层。

## 节点（WidgetNode）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全文档唯一 |
| `type` | WidgetType | ✅ | 见下表 |
| `name` | string | ✅ | 图层名（中文，如 `开始按钮`） |
| `x` `y` `w` `h` | number | ✅ | 页面绝对坐标与尺寸；`w`/`h` 必须 > 0；建议对齐 10px 网格 |
| `visible` | boolean | ✅ | 固定 `true`（生成内容不要隐藏） |
| `locked` | boolean | ✅ | 固定 `false` |
| `props` | object | ✅ | 控件属性，每类控件的键见 widgets.md；无属性时为 `{}` |
| `activeTab` | number | — | 仅 tab：当前激活页签下标（0 起） |
| `pages` | WidgetNode[][] | — | 仅 tab：**每个页签一个子树数组**，子控件为页面绝对坐标 |
| `children` | WidgetNode[] | — | 仅 panel / dialog / scroll：内容区子控件，页面绝对坐标 |
| `customId` | string | — | 仅 custom：引用 `customWidgets[].id` |
| `overrides` | object | — | 仅 custom：暴露属性覆盖值，键 = 暴露属性名 |
| `slots` | object | — | 仅 custom：插槽内容，键见下；值为页面绝对坐标的子控件数组 |
| `anchor` | Anchor | — | 多分辨率锚点，见下；缺省 = 左上锚定 + 随父拉伸 |
| `binding` | object | — | 仅 filter：`{ "target": "<list/grid 节点 id>", "tagKey": "标记名" }` |
| `itemTags` | string[] | — | 仅 list / grid：每项的标记值，与 `count` 对齐，供筛选器过滤 |
| `clickable` | boolean | — | 设为 `true` 让非按钮控件**可点击**（`button` 天生可点击，无需此字段；**定制控件实例 `custom` 不支持**——点击标记统一配在定义树内控件上） |
| `clickAction` | ClickAction | — | 点击效果：`{ "type": "goto", "target": "<目标页面 id>" }` 切换页面、`{ "type": "back" }` 返回上一页（无来路时无效）、或 `{ "type": "popup", "target": "<弹窗页 id>" }` 弹出弹窗 |

### 点击交互（clickable / clickAction）

- `goto` 的 `target` 必须是本工程某个**页面 id**；`popup` 的 `target` 必须是 `popups` 中某个**弹窗页 id**（弹窗页内不允许放到普通页面上）；`back` 无需 target。
- 可点击标记加在**单个控件**上；**弹窗页内的控件**（如弹窗里的「确定」按钮）与**定制控件定义树内的控件**同样可配——后者为定义级，所有实例同步：预览 / 演示中弹窗浮层内可直接触发，点击实例上对应区域即触发改定义级效果。定制控件实例整体的可点击**不再支持**（实例自身 `clickable` 不生效，也不在编辑器实例属性中显示）；要让整张实例可点，在定义树里给铺满的底层控件配 `clickable` + `clickAction`。
- 编辑器中右键可点击控件 →「点击」即可触发效果演示（弹窗以遮罩 + 置顶浮层显示，✕ / 遮罩 / Esc 关闭）；生成工程时给关键操作按钮 / 卡牌 / 导航项配置点击效果，可让原型具备可演示的页面流。

### 结构性约束（违反 = 非法文档）

- `pages` **只能**出现在 `tab` 上；`children` **只能**出现在 `panel` / `dialog` / `scroll` 上；`slots` / `customId` **只能**出现在 `custom` 上。
- `dialog` **只能**出现在弹窗页（`popups`）中——页面 / 公共层 / 定制控件定义树内不放弹窗（校验器对越位弹窗给 ⚠ 警告）。
- `list` / `grid` 的项是自动生成的占位格，**不能**挂子控件（需要自定义格子内容时改用 `grid` 容器手摆，或用 `scroll` + 手摆内容）。
- 容器子控件会被**裁剪**到内容区矩形内，超出部分不显示。
- 定制控件实例的插槽子控件同样是**页面绝对坐标**（不是相对实例的坐标）。

## WidgetType 一览

`rect` `ellipse` `line` `placeholder` `nine` `text` `button` `checkbox` `progress` `input` `filter` `panel` `dialog` `scroll` `list` `grid` `tab` `custom`

各类控件默认尺寸、props 与语义见 [widgets.md](widgets.md)。

## 锚点（Anchor，多分辨率适配 §6）

```jsonc
"anchor": { "preset": "tc", "mode": "stretch" }
```

- `preset`（九宫格）：`tl` `tc` `tr` `ml` `mc` `mr` `bl` `bc` `br`（t/m/b = 上/中/下，l/m/r = 左/中/右）
- `mode`：`fixed`（固定尺寸，位置随锚点）｜ `stretch`（随父拉伸）｜ `aspect`（等比缩放）
- 典型用法：顶部状态栏 `{"preset":"tc","mode":"stretch"}`；四角悬浮按钮 `tl` / `tr` + `fixed`；缺省 = 左上锚定 + 随父拉伸。

## 定制控件（CustomWidgetDef）

```jsonc
{
  "id": "w_resource_bar",          // w… 前缀惯例，定义库内唯一
  "name": "资源条",
  "group": "通用",                  // 控件库分组名
  "w": 160, "h": 44,               // 默认尺寸（建议 = tree 包围盒）
  "props": [                        // 暴露属性
    {
      "name": "value",              // 实例覆盖时用的键
      "type": "string",             // string | number | boolean | tab-index
      "default": "999",
      "binds": [ { "nodeId": "n_bar_text", "key": "text" } ]   // 绑定到定义树内节点的属性
    }
  ],
  "tree": [ ... ],                  // 内部结构：归一化到 (0,0) 原点的根节点（子控件相对 (0,0) 布局）
  "slotNodeIds": []                 // 开放为插槽的容器节点 id（Tab 容器默认每页签一槽，无需列出）
}
```

- 定义树 `tree` 内子控件坐标**相对于定义原点 (0,0)**（与页面节点的绝对坐标不同！）；实例化时按 `实例尺寸/def.w、def.h` 整体缩放平移到实例矩形。
- 实例的 `slots` 键规则：定义树中 Tab 容器每页签一槽 → `"<容器节点id>:<页签下标>"`；`slotNodeIds` 开放的容器 → `"<容器节点id>"`。
- 定义之间可互相引用（实例嵌套），但**不允许循环引用**（A 的定义链引用回 A 自身）。
- `binds[].key` 可绑定：`text` `fontSize` `radius` `progress` `checked` `placeholder` `title` `activeTab` `barHeight`（tab 页签栏高）等（须与目标节点类型匹配）。

## 预览分辨率（只读行为，生成时无需处理）

编辑器按锚点规则把设计尺寸布局重排到 16:9 / 18:9 / 19.5:9 / 4:3 预览。生成布局时对顶栏 / 底栏 / 四角元素设置合理 `anchor`，即可保证多分辨率不错位。
