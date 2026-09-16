# 从 UI 对象归纳实体与共享数据

用于列表、卡牌、商品、角色等重复对象及其详情页/弹窗。目标是让不同视图成为同一份业务数据的不同展示，而不是维护几份碰巧相同的文案。

## 建模顺序

1. 找到重复项的定义树、实例覆盖值、列表归属与源动作，沿 `clickAction.target` 读取关联页面/弹窗的字段；关联 UI 若继续引用定制控件，也读取其定义与覆盖值。不要先实现列表，再用常量补弹窗。
2. 按业务含义归纳字段。例如卡牌列表显示名称、缩略图、等级和碎片；详情额外显示大图、战力、经验、属性、技能、升级费用。归纳对象需要覆盖两侧字段，并明确哪个字段在两侧共享。
3. 为字段保存来源映射。布局坐标、样式和节点 ID 继续留在 `.uiw` 与绑定层；实体使用语义字段名。公共文案可以保留在模板，随实体变化的业务值必须来自数据对象。
4. 有可靠身份信息时，跨列表/详情使用同一个 `entityId`；公共模板和可变实例状态分开。多个列表可引用同一实体，但不能只因皮肤、名称、弹窗目标相同就合并实例。身份不足时保存独立实体和来源，避免误共享状态。
5. 输出业务数据和声明式视图绑定，再实现渲染器。格式可按项目习惯选 JSON/JS/TS，但业务主源不能退化成布局节点属性字典。

## 示例：两个卡牌实体，共用一个详情布局

以下只是数据与绑定形态，不是要求创建这些示例卡牌、数值或动作。

```js
export const uiData = {
  cardTypes: {
    miner: { name: "矿工", rarity: "common", art: { thumbnail: "card.miner.thumb", portrait: "card.miner.portrait" } }
  },
  cards: {
    "card-a": {
      id: "card-a", typeId: "miner", level: 1,
      fragments: { current: 3, required: 6 },
      experience: { current: 175, required: 490 },
      stats: [{ key: "health", value: 980, upgradeDelta: 117 }],
      upgradeCost: { amount: 1080, currency: "gold" }
    },
    "card-b": {
      id: "card-b", typeId: "miner", level: 2,
      fragments: { current: 4, required: 8 },
      experience: { current: 20, required: 600 },
      stats: [{ key: "health", value: 1097, upgradeDelta: 132 }],
      upgradeCost: { amount: 1600, currency: "gold" }
    }
  },
  collections: { deck: ["card-a"], library: ["card-a", "card-b"] },
  state: { selectedCardId: null }
};
```

共享字段不再在弹窗对象中复制。例如详情等级读取 `cards[selectedCardId].level`，不会另建 `popup.level`。不同概念的进度分开：列表用 `fragments`，详情用 `experience`。

数据绑定与资产视觉覆盖分离：

```json
{
  "instances": {
    "n_card_instance_a": { "entityType": "cards", "entityId": "card-a" },
    "n_card_instance_b": { "entityType": "cards", "entityId": "card-b" }
  },
  "nodes": {
    "n_card_level": { "text": { "scope": "entity", "path": "level", "format": "levelLabel" } },
    "n_card_fragments": { "text": { "scope": "entity", "path": "fragments", "format": "fraction" } },
    "n_detail_level": { "text": { "scope": "entity", "path": "level", "format": "levelLabel" } },
    "n_detail_xp": { "text": { "scope": "entity", "path": "experience", "format": "fraction" } }
  },
  "fieldSources": {
    "cards.card-a.level": [{ "layoutId": "n_card_instance_a", "property": "overrides.等级" }],
    "cards.card-a.experience": [{ "layoutId": "n_detail_xp", "property": "props.text" }]
  }
}
```

`dataBindings` 描述读取关系，不定义新业务动作，不能塞入 `bindingOverlay`。业务实体中的 `assetId` 必须也能被绑定/资产审计解析，运行时替换图片不能绕过 manifest 或遗漏资产消费者。

## 选择上下文与渲染

```js
// 仅对源文件已定义的交互注册；不改写 sourceNode.clickAction。
executeAction(sourceNode.clickAction, { entityType: "cards", entityId: clickedEntityId });

// 原动作决定目标；上下文决定该目标读取哪条数据。
openPopup(action.target, context);
renderPopup(popupLayout, resolveEntity(context), dataBindings);
```

同一详情模板可被不同条目复用。每次打开时重新读取所选实体；关闭与重新打开不能泄漏前一条目的上下文。定制控件的点击监听仍挂在定义树中实际可点击的子节点，实体上下文从实例传入，不提升到整个实例。

直接访问详情 URL、无选择上下文、目标没有相关数据时，应明确处理：可以使用显式配置的预览实体或显示源布局的未绑定状态，不能静默使用“第一条”。空弹窗也不能凭其他实体补造详情。

## 原型数据不完整时

- 同一字段在列表与详情冲突：保留两侧来源并确定优先级。通常采用用户业务数据，其次实例覆盖，再次模板默认；如果详情明显描述另一实体，不要强行归并，标记未解决关系。
- 原型只有一组详情示例：把该示例归入能被证实关联的公共定义或指定预览实体。缺失的其他实体详情保持缺失，不能编造战力、技能或费用。
- 数值含特殊文案：能可靠解析则保留数值、单位与格式器；不能解析则用 `levelText`、`availabilityText` 等语义字段保留原文，并记录暂未结构化的原因。
- 不要通过复制字段解决格式差异：`3/6` 和 50% 应由一份碎片数据派生。原型百分比和分子/分母不一致时记录冲突与采用规则。

## 验证

- 两个实体使用同一布局时，列表与各自详情均展示正确记录；通过实际列表点击验证上下文传递。
- 改变其中一个实体的等级等共享字段，重载或更新后，其列表和详情同时变化，另一实体不变。修改不需要改渲染器或坐标。
- 弹窗专属字段也来自该实体或其明确引用的定义，不能残留第一条记录的常量。
- 数量、进度、格式化显示与状态遵循同一数据源；上下文缺失和字段冲突都有可检查的处理结果。
- 检查业务数据中没有节点坐标、CSS 或未经 manifest 管理的图片路径；原始控件树、源动作和资产复用关系保持完整。
