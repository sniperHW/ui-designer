# 产物契约

`ui-layout.json` 是 `.uiw` 到 H5/游戏引擎的唯一布局与资产关联层。它必须包含 `uiwDocument` 的无损 `.uiw` 副本，供引擎按原控件结构、父子关系和定制控件定义实例化；视觉资产与截图推断放在独立 `bindingOverlay`，不能反向修改 `uiwDocument`。所有布局单位都是 `.uiw` 的设计像素。

```json
{
  "version": 1,
  "source": {
    "uiw": "../source/lobby.uiw",
    "designSize": { "width": 750, "height": 1600, "orientation": "portrait" },
    "referenceScreenshots": ["../references/lobby.png"]
  },
  "assets": {
    "manifest": "../h5/manifest.json",
    "plan": "asset-plan.json"
  },
  "uiwDocument": { "version": 1, "meta": {}, "commonLayer": {}, "customWidgets": [], "popups": [], "pages": [] },
  "bindingOverlay": {
    "nodes": {
      "n_primary_start": {
        "visualRole": "button.primary",
        "renderMode": "sprite-plus-dom",
        "assetBindings": [{ "slot": "background", "assetId": "ui.button.primary.base", "fit": "stretch" }],
        "enginePrefabKey": "ui/button-primary",
        "referenceEvidence": [{ "image": "lobby.png", "region": "中央主 CTA" }]
      }
    },
    "inferredLayers": []
  },
  "commonLayer": ["...layout nodes..."],
  "pages": [{ "id": "p_lobby", "name": "大厅", "nodes": ["...layout nodes..."] }],
  "popups": [],
  "customWidgets": [{ "id": "w_resource_bar", "source": "customWidgets", "definition": "..." }]
}
```

`bindingOverlay.nodes` 的键必须等于原始 `.uiw` 节点 id。截图只补齐资产、引擎预制体键和可审计的视觉信息；原 `.uiw` 节点的 `type`、`name`、`x/y/w/h`、`anchor`、`props`、`children`/`pages`/`slots`、`customId`、`overrides`、点击动作与数组顺序只能从 `uiwDocument` 读取。若 H5 需要展开实例，在派生 `resolved` 中保存原始 `layoutId`，但不可替代 `uiwDocument`。

截图中没有 `.uiw` 对应节点的装饰或复合层必须明确列为：

```json
{
  "id": "inferred_battle_nav_art",
  "inferred": true,
  "hostLayoutId": "n_root_tab",
  "frame": { "x": 0, "y": 1435, "w": 750, "h": 165 },
  "visualRole": "navigation.bottom.art",
  "referenceEvidence": [{ "image": "battle.png", "region": "底部导航" }]
}
```

引擎导入时先实例化 `uiwDocument`，再以 `layoutId` 应用 `bindingOverlay`；不能因为截图推断而破坏 `.uiw` 的容器归属或控件结构。

## 容器与滚动契约

源节点 `type` 是不可丢失的运行时语义。`scroll`、`panel`、`grid`、`list`、`tab`、`dialog` 与 custom widget 必须以不同的适配器实现，不能全部降级为静态绝对定位容器。

对于每个 `.uiw` `scroll` 节点，H5/引擎实现必须满足：

1. scroll 视口的 `frame` 等于源节点的 `x/y/w/h`。
2. 子节点以 scroll 节点为局部原点；内容尺寸取所有可见子节点 `max(x + w)`、`max(y + h)` 的边界，而非强制等于视口。
3. 按源定义的方向开放滚动。没有方向字段且内容纵向溢出时，使用纵向滚动；不得以 `overflow: hidden` 代替。
4. 皮肤和纯装饰覆盖层使用 `pointer-events: none`，以免吞掉滚轮和拖拽事件。

建议的 H5 结构如下，`layoutId` 仍指向源节点：

```html
<div class="uiw-scroll" data-layout-id="n_rank_scroll" style="left:20px;top:290px;width:710px;height:1240px">
  <div class="uiw-scroll-content" style="width:710px;height:1418px">
    <!-- source children, positioned relative to n_rank_scroll -->
  </div>
</div>
```

构建/冒烟测试必须验证源 `scroll` 的容器真实可滚：当内容边界超过视口时，`scrollHeight > clientHeight`（或横向对应值），并能设置或拖动到正的 `scrollTop`/`scrollLeft`。若把 `scroll` 与 `panel` 合并渲染、固定 `overflow: hidden` 或只显示首屏，则视为结构保真失败。

## 交互契约

`.uiw` 中的 `clickable`、`clickAction` 与 `locked` 是唯一允许的交互来源。`bindingOverlay.nodes` 和 `bindingOverlay.inferredLayers` 是视觉覆盖层，禁止写入 `clickable`、`clickAction`、`action`、`onClick`、`disabled` 或业务导航字段。截图推断层必须默认 `pointer-events: none`。

构建器应从 `uiwDocument` 派生交互索引（可作为构建中间产物或 H5 调试清单），而不要复制或重写动作：

```json
{
  "layoutId": "n_chest_card",
  "sourcePath": "uiwDocument.customWidgets[3].tree[0]",
  "clickable": true,
  "clickAction": { "type": "popup", "target": "p_reward" }
}
```

运行时通过 `executeAction(node.clickAction)` 处理动作。只有 `clickable: true` 的源节点可获得监听器、`cursor: pointer` 和按压反馈；`clickable` 缺失或为 `false` 时必须没有这些行为。不得基于 `type`、`visualRole`、控件名称或截图外观添加 `onclick`、`showModal`、跳转或解锁逻辑。

对 custom widget，监听器对应定义树内声明 `clickable: true` 的子节点，实例只提供坐标与 `overrides`。若运行时无法保持该子节点的稳定 `layoutId`，应输出明确的 `sourceLayoutId` 映射并在校验中使用它；不得把行为提升到整个实例根节点。

交付前，比较 H5 注册事件的来源 ID 与 `.uiw` 的可点击源 ID，并逐项深比较 `clickAction`。任何额外监听器、缺失监听器或动作不一致都应使构建失败。

```json
{
  "layoutId": "n_primary_start",
  "type": "button",
  "name": "开始按钮",
  "frame": { "x": 70, "y": 980, "w": 610, "h": 120 },
  "anchor": { "preset": "bc", "mode": "fixed" },
  "props": { "text": "开始" },
  "visualRole": "button.primary",
  "renderMode": "sprite-plus-dom",
  "assetBindings": [
    { "slot": "background", "assetId": "ui.button.primary.base", "fit": "stretch" }
  ],
  "clickAction": { "type": "goto", "target": "p_battle" }
}
```

`renderMode` 可为 `none`（不可见/结构节点）、`css`（纯 CSS 形状）、`dom-text`、`runtime`（进度/状态等）、`sprite` 或 `sprite-plus-dom`。没有像素美术需求的节点使用前四种，不放 `assetBindings`。

`asset-plan.json` 只登记唯一视觉资产：

```json
{
  "version": 1,
  "items": [
    {
      "assetId": "ui.button.primary.base",
      "familyId": "ui.button.primary",
      "category": "buttons",
      "visualRole": "button.primary",
      "reference": { "image": "lobby.png", "region": "中央主 CTA" },
      "target": { "width": 610, "height": 120, "resizable": true },
      "consumerLayoutIds": ["n_primary_start", "n_confirm_action"],
      "decision": "generate",
      "reuseCandidate": null,
      "rationale": "同一主 CTA 皮肤，文本由 DOM 覆盖"
    }
  ]
}
```

约束：`assetId` 全局唯一；一个 `assetId` 只能有一个 manifest 条目；所有 `consumerLayoutIds` 必须存在于布局；每个 `decision: generate` 必须至少有一个消费者；同视觉皮肤的使用者应共享 `assetId`。动态文字、数值、进度、红点和颜色状态不是生成新素材的理由。

manifest 条目至少含 `id`（等于 `assetId`）、`file`、`category`、`source_atlas`、`bbox`、`content_bbox`、`pivot`、`opaque_pixels`。如切图工具产生的是临时 ID，重命名/映射到 `assetId` 后再给 H5 使用。
