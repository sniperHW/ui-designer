# 页面素材装配合同

每个页面或页面族一份合同。合同引用全局 `assetId` 的已验收派生版本，并声明准确的 UIW 节点定位方式、目标属性和本页附加门禁。

合同不能包含素材像素处理逻辑，也不能移除全局质量配置中的必经门禁。页面改版时以该页面当前验收 UIW 为只读输入，输出新版本 UIW；不得覆盖旧版本。

使用 `page-asset-contract.template.json` 创建新合同。节点定位优先使用稳定的 `nodeId`；仅在旧工程无法提供稳定 id 时，才使用受作用域限制的节点名作为过渡方案。`target.scope` 可为 `commonLayer`、`page`、`popup` 或 `customWidget`；弹窗素材使用 `popup` + `popupId`，以便直接定位 `doc.popups` 的节点树。

校验合同及其对当前 UIW 的定位：

```bash
node scripts/ui_asset_pipeline/validate_page_asset_contract.mjs assets/ui-pipeline/asset-catalog.json <页面合同.json>
```

增量装配先使用干跑确认影响范围；该命令不写任何文件：

```bash
node scripts/ui_asset_pipeline/apply_page_asset_contract.mjs assets/ui-pipeline/asset-catalog.json <页面合同.json> --dry-run
```

去掉 `--dry-run` 才会生成 `outputUiw`。装配器拒绝覆盖已有输出，因此每次迭代必须生成新候选版本。
