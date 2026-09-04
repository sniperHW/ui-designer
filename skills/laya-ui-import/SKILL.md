# Skill: laya-ui-import
---
name: laya-ui-import
description: 把 ui-layout.json（uiw-portable 契约）与美术切图导入 LayaAir 工程，生成 ui2 场景/预制体/数据层/交互脚本的完整工作流。当用户提到 ui-layout.json、uiw、界面契约、界面导入、切图导入、生成 Laya 界面、把原型/H5 设计稿转成 LayaAir 工程，或要求在 Laya 项目里重建一套界面时，都应使用此技能。与 layaAir 技能配套：本技能负责「契约 → 工程」的导入管线，layaAir 技能负责引擎 API 与资源文件操作规范。
---

# ui-layout.json → LayaAir 工程导入技能

## 输入与输出

**输入**（通常在原型目录，如 `arena-h5-prototype/`）：

| 输入 | 作用 |
|---|---|
| `ui-layout.json` | uiw-portable 契约，含全部结构/数据/交互信息 |
| `assets/<category>/` | 美术切图（panels/icons/buttons 等） |

`ui-layout.json` 的关键字段（导入前先通读确认）：

- `assets.sprites[]` — 切图清单：`id`（assetId，如 `ui.panel.card`）、`category`、`file`（源相对路径）
- `uiwDocument` — 控件树：`meta`（设计尺寸）、`commonLayer`（HUD 公共层）、`customWidgets[]`（可复用部件）、`pages[]`、`popups[]`、`tips[]`；节点树含 id/name/位置/尺寸/文本样式
- `runtime.data` — **初始数据集**：resources/offers/cards/ranks/activityLabels/texts；图标用 assetId 引用（如 `ui.icon.crystal`），导入时须换算为资源路径
- `runtime.interactionIndex` / `userSpecifiedInteractions` / `semantics` — 交互语义：tab / clickAction(popup) / tooltip / filter / scroll / repeater / customWidget
- `presentation.components` — 部件级展示语义（card.collectible、offer.bundle、leaderboard.row、repeater 等）

**输出**（LayaAir ui2 工程内的产物，`<模块>` 按项目语义命名）：

```
assets/
  resources/<模块>/        切图（运行时按路径加载）+ IDE 生成的 .meta
  <模块>-ui/<Widget>.lh    每个 customWidget 一个预制体
  Scene.ls                 uiwDocument 展开的场景（列表容器只放 1 个模板实例）
src/
  data/                    数据层四角色：模型 / 数据集 / 状态容器 / 动作
  ui/<Xxx>Binder.ts        数据→控件绑定层（含动态列表槽位生成）
  Main.ts                  场景脚本：交互编排 + fitStage 适配
```

## 导入流程（按序执行）

### 第 0 步：前置检查

1. 读 `settings/PlayerSettings.json` 确认 `addons["laya.ui"]` 为 `"ui2"`（新版 GBox/GImage/GTextField 组件）。不是 ui2 则停止并告知用户，不得混用经典 UI 组件。
2. 加载 layaAir 技能；场景/预制体的 JSON 格式细节见其 `references/scene-data-format.md`。
3. 判断本会话是否有 LayaAir IDE 的 MCP 工具（`Laya_EditAsset` / `AssetManagement` 等）：
   - **有** → 资产导入、场景编辑一律走 MCP；
   - **没有** → 切图复制和 JSON 生成可直接文件操作，但**改已有 .ls/.lh 前必须备份**（复制到 /tmp），只做自包含子树的增删改名，改完校验 JSON 合法性与 `_$ref` 引用完整性。

### 第 1 步：资产导入

1. 切图按契约 `category` 分目录复制到 `assets/resources/<模块>/`（如 `arena/`），保持语义化文件名（`icon_crystal.png`、`panel_card.png`）。
2. 让 IDE 刷新生成 `.meta`（UUID）。没有 IDE 时可先跳过，IDE 打开后会自动补。
3. 建立**assetId → 目标资源路径**映射表（如 `ui.icon.crystal` → `arena/icon_crystal.png`），后续数据层 icon 字段和节点 `src` 都用它换算。代码中禁止出现 `res://uuid`，UUID 只允许存在于 .ls/.lh 序列化数据和 .meta 里。

### 第 2 步：预制体生成（customWidgets → .lh）

每个 customWidget 生成 `assets/<模块>-ui/<名称>.lh`（目录与第 1 步模块名一致）：

- 根节点 `_$type` 取 ui2 类型（容器 GBox / 图片 GImage / 文本 GTextField / 按钮 GButton / 滚动 GPanel），保留**源 widget 名称**。
- 子节点写进 `_$child`，逐节点带 `_$id`（可读短 id）、`name`、`x/y/width/height`；GImage 记 `src`（res://uuid，由第 1 步映射查得）与 `autoSize:false`；GTextField 记 `text/fontSize/color/align/valign/bold/stroke/strokeColor`。
- JSON 格式：2 空格缩进、原生 UTF-8（不转义中文）、文件尾换行。

### 第 3 步：场景生成（uiwDocument → Scene.ls）

- 按契约层级生成 `commonLayer → 主界面(pages) → popups → tips`；页面容器命名 `PageTab_<名>`，页签按钮 `导航_<名>` / `子页签_<名>`，二级页签容器 `页签栏_*`。
- **坐标一律写父容器相对值**：原型/契约里的节点坐标是绝对舞台坐标，写入子节点时必须减去父容器坐标（尤其 tips 的框内文字，见 pitfalls #6）。
- **页签栏位置必须避开底部导航栏区域**（导航栏占 root y≈1435-1600 且渲染在上层，页签栏落进去等于不可见不可点，见 pitfalls #7）。
- customWidget 实例化：节点写 `_$prefab: "<预制体uuid>"` + `_$child` 内放 `_$override`（预制体内部 `_$id`）覆盖项，只写差异字段（text/src/坐标）。
- **列表型部件（卡片网格/榜单/礼包横幅等）每个容器只放 1 个实例作模板**，编号命名（`所有卡牌 1`、`榜单条目 1`、`礼包横幅 1`）；其余项运行时由数据层生成（见第 4 步）。这是本管线的核心约定：**场景管结构模板，数据管数量与内容**。
- 场景根挂 Main 脚本组件（`_$comp` 里填脚本 UUID 与 `scriptPath: "../src/Main.ts"`）。

### 第 4 步：数据层生成（runtime.data → src/data）

目标是**职责分层**而非固定类名：若目标工程已有数据层，沿用其架构与命名；没有则按以下四个角色生成（文件/类名按项目语义取名，如 `<Xxx>Models.ts` / `<Xxx>Store.ts`）：

- **模型层** — 按领域切片定义状态接口（玩家/资源/各业务列表…），图标字段存 resources 相对路径（不存 assetId、不存 UUID）。
- **数据集** — 从 `runtime.data` 转录初始值：assetId 经第 1 步映射表换成资源路径；数值/文案原样保留，不做业务加工。
- **状态容器** — 可订阅容器：`get/setSlice/patch/subscribe`，切片变更通知订阅者；**不依赖引擎**（可脱离 UI 单测）。
- **动作层** — 业务动作的唯一写入口；交互只调 action，不直接改数据/控件。

绑定层 `src/ui/<Xxx>Binder.ts` 的必备能力（能力固定，命名随项目）：

- `bindAll()` 首渲染 + 按切片订阅增量刷新；节点查找按页面容器限定作用域（防同名节点串写）。
- `iconUrl()`：数据图标路径 → 运行时 URL 的唯一换算点（`resources/` 前缀规则、`res://` 透传都集中此一处，实测不识别只改这里）。
- `syncSlots(key, container, prefix, count, hint)`：列表槽位与数据条数对齐——预摆模板复用 + 按模板克隆补齐 + 多余隐藏。布局参数**优先从预摆槽位的坐标差值推导**；单模板、首行不完整等无法推导的场景由调用方 `hint`（cols/colStep/rowStep）给定，间距推导优先、hint 兜底。
- 槽位点击经回调（如 `onSlotClick`）交给场景脚本决定行为（开弹窗等），动态生成的项同样可交互。

### 第 5 步：交互接线（runtime.semantics → Main.ts）

按契约 semantics 逐条落实（Tab 滑动实现要点见 pitfalls #20）：

- tab：`PageTab_*` 切换 + 按钮选中态 + 滑动过渡；主页面支持左右滑动手势。
- clickAction(popup)：固定部件直接绑；数据驱动列表项经 binder 的 `onSlotClick` 委托。点击表面名→弹窗名建映射表（表面名须用实例内部真实存在的子节点名，预制体 root 名会被实例名覆盖）。
- tooltip / filter / scroll / repeater：按 `presentation.components` 对应实现；GPanel 需脚本动态挂 Scroller 并按内容边界撑开 sourceWidth/Height，同时配置 `barDisplay`（Hidden/OnScroll）+ `barFloating=true`——默认滚动条常驻且挤占内容宽度（见 pitfalls #18）。
- 事件绑定谓词必须限定作用域（父节点名/页面容器），按通用子名（如「图标」）全量绑定会误绑同名节点（见 pitfalls #17）。
- 适配：按契约 `meta` 的设计尺寸 fitStage（竖屏 cover / 宽屏 contain）+ `useRetinalCanvas`（见 pitfalls #28）。
- 演示数据流至少接一条端到端链路（如某按钮：点击 → action 改状态 → 相应控件文案/多切片自动刷新）。

### 第 6 步：验证

1. `tsc -p tsconfig.json --noEmit` 零错误。
2. 校验生成的 .ls/.lh JSON 合法、`_$ref` 目标存在、预制体 UUID 与 .meta 一致。
3. 若无 IDE 可跑：用「mock Laya + 契约实例化节点树」冒烟 onStart（场景 JSON 递归实例化 + Widget mock，断言列表数量/文案/图标/交互数据流；套路见 pitfalls #22）。有 IDE 则直接运行，重点核对：卡图/图标是否显示（路径 URL 前缀如不识别改 `iconUrl()` 一处）、滚动、弹窗。
4. 常见踩坑先读 `references/pitfalls.md` 再动手。

## 关键规则（why）

- **代码禁止 UUID**：`res://` 是序列化格式，构建/迁移会失效；数据层存 resources 相对路径，换算集中在 `iconUrl()`。
- **列表单模板**：预摆数量写死会让「改数据」退化为「改场景」；保留 1 个模板即保留视觉基准，数量回归数据。
- **容器型列表的槽位收集必须递归查找**：ui2 容器（GPanel）可能把子节点包进内部容器，按直接子节点收集会得到空列表。
- **节点查找限定作用域**：不同页面存在大量同名节点（两个「联盟名」、两个「文本 1」），从根查找会串写。
- **改已有场景文件前备份**：无 IDE MCP 时直接改 .ls/.lh 是受控例外（自包含子树操作），备份是唯一的后悔药。
