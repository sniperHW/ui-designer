/** 校验卡牌细节弹窗的结构合同及其对基线 UIW 的只读定位。 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function fail(message) { throw new Error(message) }

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch (error) { fail(`无法读取 JSON：${path}（${error.message}）`) }
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) fail(`${label} 必须为非空字符串`)
}

function validRect(rect) {
  return Array.isArray(rect) && rect.length === 4 && rect.every(Number.isFinite) && rect[2] > 0 && rect[3] > 0
}

function main() {
  const [contractArg] = process.argv.slice(2)
  if (!contractArg) fail('用法：node scripts/ui_asset_pipeline/validate_card_detail_structure_contract.mjs <结构合同.json>')
  const contract = readJson(resolve(contractArg))
  if (contract.version !== 1 || contract.kind !== 'popup-structure') fail('结构合同必须为 version 1 的 popup-structure')
  for (const key of ['pageId', 'baseUiw', 'outputUiw']) requireString(contract[key], `contract.${key}`)
  if (contract.baseUiw === contract.outputUiw) fail('baseUiw 与 outputUiw 必须不同')
  if (!existsSync(resolve(contract.baseUiw))) fail(`baseUiw 不存在：${contract.baseUiw}`)
  if (!contract.popup || typeof contract.popup !== 'object') fail('contract.popup 必须为对象')
  for (const key of ['popupId', 'dialogNodeId', 'closeInteraction']) requireString(contract.popup[key], `popup.${key}`)
  if (!validRect(contract.popup.dialogRect) || !validRect(contract.popup.contentRect)) fail('popup 的 dialogRect 与 contentRect 必须为有效矩形')
  if (!Array.isArray(contract.layers) || !contract.layers.length) fail('layers 至少包含一个节点')
  const doc = readJson(resolve(contract.baseUiw))
  const popup = (doc.popups ?? []).find((item) => item.id === contract.popup.popupId)
  if (!popup) fail(`未找到弹窗：${contract.popup.popupId}`)
  const dialog = popup.nodes?.find((item) => item.id === contract.popup.dialogNodeId && item.type === 'dialog')
  if (!dialog) fail(`未找到弹窗本体：${contract.popup.dialogNodeId}`)
  const ids = new Set()
  for (const [index, layer] of contract.layers.entries()) {
    const prefix = `layers[${index}]`
    for (const key of ['id', 'type', 'name', 'visualRole']) requireString(layer[key], `${prefix}.${key}`)
    if (ids.has(layer.id)) fail(`${prefix}.id 重复：${layer.id}`)
    ids.add(layer.id)
    if (!validRect(layer.rect)) fail(`${prefix}.rect 必须为有效矩形`)
    if (layer.type === 'image') requireString(layer.assetSlot, `${prefix}.assetSlot`)
  }
  for (const id of ['detail-green-inset-surface', 'detail-green-card-art', 'detail-green-card-frame', 'detail-green-race-badge-base', 'detail-green-race-icon', 'detail-green-card-level', 'detail-green-upgrade-button']) {
    if (!ids.has(id)) fail(`结构合同缺少必需节点：${id}`)
  }
  console.log(`✓ ${contractArg} 通过校验：${contract.layers.length} 个结构节点，弹窗定位有效`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
