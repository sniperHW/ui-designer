---
name: ui-designer-game-ui-h5
description: 从 ui-designer 的 .uiw 工程和参考截图生成去重的游戏 UI 美术资产、布局与资产绑定 JSON，并装配为可运行的 H5 原型。适用于“ui-designer 工程转 H5”“按 UI 原型和截图生图”“UI 控件结构/布局映射素材”“清理未引用游戏 UI 素材”等任务；不用于单独创建 .uiw 工程或只生成孤立 UI 图集。
---

# UI Designer → Game UI H5

将 `.uiw` 作为界面结构与交互的事实来源，将参考截图作为视觉语言来源。交付的是一条可追溯链路：`.uiw` → `ui-layout.json` → 唯一资产计划与 manifest → 数据驱动 H5。不要修改 `game-ui-asset-pipeline`；需要资产生成、透明化、切图和 H5 资产装配时直接遵循并复用该技能。

`ui-layout.json` 必须能作为游戏引擎导入 `.uiw` 控件/预制体的中间格式：它保留原始 `.uiw` 的完整控件树，并以独立覆盖层记录截图推断出的表现信息。它不是把 `.uiw` 扁平化后再重新设计一遍页面。

## 先读输入与已有约束

1. 确认 `.uiw`、参考截图和目标输出目录。没有参考截图且用户未允许查找公开截图时，先索要截图。
2. 对 `.uiw`，先读 `~/ui-designer/skills/uiw-designer/references/schema.md` 与 `references/widgets.md`，并运行其 `scripts/validate.mjs`。若源工程不合格，报告具体错误；不要臆测节点或布局。
3. 开始资产工作前，完整读取 `game-ui-asset-pipeline/SKILL.md` 并严格保留它对参考边界、image_gen、白底图集、透明化、切图、manifest、H5 验证的约束。
4. 若目标目录已有 `manifest.json`、`ui-layout.json` 或 `h5/`，先盘点可复用资产。除非视觉语义或尺寸约束不兼容，优先复用并补充绑定，禁止重新生成同类素材。

## 生成 `ui-layout.json`

不要把 `.uiw` 原样复制为布局绑定文件。先解析其公共层、页面、弹窗、节点层级、`tab.pages`、容器 children、custom widget 定义/实例、锚点与点击动作；再输出统一的运行时布局契约。具体字段、例子与判定规则见 [artifact-contract.md](references/artifact-contract.md)。

- 坐标、尺寸、层级和交互目标应忠实来自 `.uiw`；`commonLayer` 必须体现在所有对应页面中，定制控件实例要保留 `customId` 和覆盖值的来源。
- 设计画布的横纵比来自 `meta.designWidth / meta.designHeight`。H5 按该比值缩放；不要把截图尺寸或浏览器尺寸倒灌进 `.uiw` 布局。
- 节点 `layoutId` 使用 `.uiw` 中稳定的节点 id；节点树保留容器、重复项和 tab 语义。文本、数值、进度、状态和列表数据留为运行时值，不能烘焙到图片。
- 每个可视觉化节点至少给出 `visualRole`、`renderMode` 和 `assetBindings`。纯 DOM/CSS/运行时绘制的节点必须明确标成 `none`/`css`/`runtime`，不能为了“每个控件有图”虚造资产。
- `assetBindings` 的 `assetId` 是唯一的跨页面引用键，H5 只能通过它查 manifest。一个皮肤在多处出现时必须复用相同 `assetId`，而不是为每个节点生成一张图片。

## 控件语义保真：容器类型决定运行时行为

`.uiw` 的节点 `type` 不只是视觉分类，也是运行时控件契约。H5 与引擎适配器必须逐类保留其语义；不得为省事把不同容器统一渲染为普通 `div`、静态裁切层或图片。

- `scroll` 必须映射为真实的可滚动容器。按 `.uiw` 的滚动方向/属性实现轴向滚动；未声明方向时，对纵向溢出的内容使用 `overflow-y: auto` 与 `overflow-x: hidden`，而不是 `overflow: hidden`。
- 为 `scroll` 创建视口和内容层：视口大小严格等于源节点 `x/y/w/h`，子节点坐标相对该 scroll 节点；内容层的可滚动范围由源子节点最大边界（含尺寸）计算，不能只等于视口高度。
- `panel` 可以裁切内容，但不是 `scroll` 的替代品；`grid`/`list` 应保留其重复项、数据绑定及对应布局策略；`tab`、`dialog`、custom widget 也必须分别保留其页面、模态与实例语义。
- 覆盖层、美术皮肤和 DOM 文本不得拦截 scroll 的拖拽/滚轮事件，除非 `.uiw` 中该子节点明确定义了相应交互。

H5 验收时，对每一个源 `scroll` 节点检查：运行时存在对应滚动容器、视口框与 `.uiw` 尺寸一致、内容超出时 `scrollHeight > clientHeight`（或横向对应值），并可将位置从 0 滚动至正值。把 `scroll` 当作 `panel`、设置固定 `overflow: hidden` 或只渲染首屏内容均为构建失败。

## 交互保真：禁止由截图或渲染器臆测行为

`.uiw` 是交互的唯一事实来源。`clickable`、`clickAction`、`locked` 及其缺失状态都具有语义：缺失或 `false` 表示该节点不可交互。参考截图仅可补齐视觉信息，绝不能新增、删除或改变控件交互。

- 将原始交互字段无损保留在 `uiwDocument`，并从它派生 H5/引擎的交互绑定；`bindingOverlay` 与 `inferredLayers` 只允许视觉字段，禁止出现 `clickable`、`clickAction`、`action`、`onClick`、`disabled` 或业务跳转字段。
- H5 仅在源节点明确 `clickable: true` 时注册事件，并只执行该节点的 `clickAction`。没有动作的节点不得注册空回调、展示手型光标、按压反馈或演示弹窗。
- 渲染器不得按 `visualRole`、`type`、名称或截图区域硬编码 `onclick`、`showModal`、跳转或解锁逻辑。统一通过 `executeAction(sourceNode.clickAction)` 分发；不支持的动作应在构建/开发期明确报错，不能以任意演示行为替代。
- 定制控件实例必须展开或映射到其 `.uiw` 定义树中的实际可点击子节点；不能因为整个卡片/图片看起来像按钮，就把监听器挂到实例根节点。实例的 `overrides` 只能影响绑定值，不能修改定义中的交互语义。
- 截图中独有的推断层默认 `pointer-events: none`。若用户另外提供明确的交互需求，必须作为可审计的、显式标记为 `userSpecifiedInteraction` 的外部需求处理，不能伪装成 `.uiw` 或截图推断。

构建 H5 前必须生成或检查一份由 `uiwDocument` 派生的交互索引，至少记录每个 `layoutId` 的 `clickable`、`clickAction` 和来源路径。验证以下不变量，任一失败即不可交付：

1. H5 绑定事件的节点集合等于源 `.uiw` 中 `clickable: true` 的节点集合（若引擎以子节点承接定制控件实例，集合按展开后的稳定 `layoutId` 比较）。
2. 每个已绑定节点的动作与源 `clickAction` 深度相等；没有源动作时不绑定。
3. 不可点击节点和 `inferredLayers` 没有监听器、手型光标或按压样式。

具体输出字段与校验示例见 [artifact-contract.md](references/artifact-contract.md) 的“交互契约”。

## 保留引擎可导入的控件结构

`ui-layout.json` 顶层必须含有原始 `.uiw` 的无损副本 `uiwDocument`：保留 `version`、`meta`、`commonLayer`、`customWidgets`、`popups`、`pages`，以及每个节点的原始字段、数组顺序、容器归属、`customId`、`overrides`、`slots`、锚点和点击动作。不要仅保留一个自行归纳的扁平节点列表。

截图推断只写入 `bindingOverlay`，按稳定 `layoutId`（即 `.uiw` 节点 id）索引。每个覆盖项可声明 `visualRole`、`renderMode`、`assetBindings`、`enginePrefabKey`、`referenceEvidence` 和经过确认的 `referenceFrame`；不得删除、改名、移动或重挂原始节点。截图中存在而 `.uiw` 尚无节点的细节放在 `bindingOverlay.inferredLayers`，显式标记 `inferred: true`、`hostLayoutId` 和截图来源，不能暗中插入原始节点树。

游戏引擎的导入顺序是：先用 `uiwDocument` 实例化引擎控件和预制体，保持父子关系与 `.uiw` 坐标；再按 `bindingOverlay.nodes[layoutId]` 替换皮肤、挂接表现预制体或施加经证实的视觉修正。H5 也应遵循该顺序，而不是根据页面名称另建一套坐标。

## 先做资产账本，再生图

先建立 `asset-plan.json`，再调用 image_gen。资产计划是避免重复的准入门槛：每个条目都要说明 `assetId`、视觉角色、截图来源区域、目标尺寸范围、使用该素材的 `consumerLayoutIds`、已有资产复用候选和生成结论（`reuse` / `generate` / `css` / `runtime`）。

判定一张素材是否唯一，应以“可见皮肤/图标/表现资产是否相同”为准，而不是节点数量为准：

- 同皮肤、仅文案/数值/数量/价格/进度不同：一张无文字底图 + DOM 或运行时表现。
- 同组件仅尺寸不同：优先九宫格、CSS 拉伸或同一可缩放散图；只有边框细节会失真时才补尺寸变体，并在计划中说明。
- 正常/按下/禁用/选中状态：优先 CSS 状态；仅当截图清楚显示不同的艺术皮肤时才创建状态素材，并写入同一个 `familyId`。
- 重复列表、网格、资源条、tab、卡牌和弹窗框：生成可复用的一个或少量皮肤，实例由布局数据和 DOM 驱动。图标按语义去重，不能因为出现在不同页面而多生成。
- 已有 manifest 中同 `visualRole`、参考来源、比例和视觉描述匹配的资产，必须直接复用；有疑义时打开实际图片核验，而非依文件名判断。

每项 `generate` 都必须能对应截图中的视觉来源以及至少一个 `consumerLayoutId`。若没有消费者，不生成。将所有 `generate` 条目按图集职责归类，再按 `game-ui-asset-pipeline` 生成无文字纯白、间距充分的图集；同一 asset family 只能出现在一张职责正确的图集中。生成完成后，按实际切图结果填写 manifest 的 `assetId`，不得按文件顺序猜测。

## 从绑定 JSON 装配 H5

使用 `ui-layout.json` 作为页面树、坐标、层级、锚点和交互的输入，使用 `manifest.json` 作为资产解析表。H5 可将 JSON 转为 DOM 元素，但不能重新硬编码第二套页面坐标或资产文件路径。

- 保持 `game-ui-asset-pipeline` 的单页 H5、数据与表现分离、DOM 文本叠加、真实状态变化、按压反馈和 HTTP 验证要求。
- `ui-data.js` 放可变业务值；`ui.js` 读取布局树、渲染器映射和交互；样式只描述布局、缩放与皮肤组合。`ui-layout.json` 中没有的结构不得作为无记录的常量页面拼进去。源 `scroll`、`panel`、`grid`、`list`、`tab`、`dialog` 和 custom widget 必须有不同且可验证的语义映射。
- 以 `.uiw` 的 `clickAction` 建立 goto/back/popup 行为；渲染分支不得硬编码 `onclick` 或演示弹窗。没有明确动作的节点不要擅自增加业务流，并保持非交互状态。
- 控件以 `assetId` 解析 sprite。缺资产、无 manifest 条目或有多个候选时，应在构建阶段报错，不要静默使用任意相近图。

## 资产审计与收尾清理（必须执行）

在生成前和 H5 装配后都运行 [audit-assets.mjs](scripts/audit-assets.mjs)。它将 `ui-layout.json` 中声明的 `assetBindings` 与 manifest 条目及 sprites 目录交叉检查，输出重复 assetId、缺失绑定、未使用 manifest 条目、缺失/未被 manifest 管理的 sprite 文件。

```bash
node <本技能目录>/scripts/audit-assets.mjs \
  --layout outputs/ui-layout.json \
  --manifest h5/manifest.json \
  --sprites-dir h5/sprites \
  --report outputs/asset-audit.json
```

- 审计有 `duplicateAssetIds`、`missingManifestAssets`、`missingSpriteFiles` 或 `unmanagedSpriteFiles` 时不可交付，先修复资产计划、绑定或 manifest。
- 对 `unusedManifestAssets`，先确认它们不是下一页面、懒加载或用户指定的预留素材；若不是，更新 manifest 并用 `--prune` 清除这些 manifest 明确列出的生成 sprites。`--prune` 只接受位于 `--sprites-dir` 内的路径，绝不触碰 `.uiw`、参考截图、原始图集或项目外文件。
- 清理后重跑审计，交付报告必须显示 `unusedManifestAssets: []`；若用户明确要求保留预留素材，应在报告 `allowlistedUnusedAssetIds` 中逐项说明理由。

## 验收

交付前逐项确认：`.uiw` 校验通过；布局契约保持节点结构、设计比例与容器类型；每个 `scroll` 经过实际滚动验证；交互索引与 H5 监听器逐项一致；每个生成素材有截图来源和消费者；manifest 的 assetId 唯一；没有重复美术资产；无未引用生成散图；H5 可通过 HTTP 服务加载，关键页面、tab、弹窗和跳转可演示；只有 `.uiw` 明确可点击的控件才具有反馈并触发变化。

最终说明应列出输入 `.uiw`、截图、`ui-layout.json`、`asset-plan.json`、manifest、审计报告和 H5 入口的位置；简述复用了哪些资产、只新生成了哪些唯一资产，以及清理了哪些未引用输出。
