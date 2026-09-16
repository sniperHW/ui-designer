/** 校验卡面细节参考结构合同以及其对基线弹窗的只读定位。 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TYPES = new Set(['rect', 'image', 'nine', 'text', 'button', 'progress'])
const PARENTS = new Set(['root-before-dialog', 'root-after-dialog', 'dialog'])
function fail(message) { throw new Error(message) }
function readJson(path) { try { return JSON.parse(readFileSync(path, 'utf8')) } catch (error) { fail(`无法读取 JSON：${path}（${error.message}）`) } }
function required(value, name) { if (typeof value !== 'string' || !value) fail(`${name} 必须为非空字符串`) }
function rect(value) { return Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[2] > 0 && value[3] > 0 }

function main() {
  const [arg] = process.argv.slice(2)
  if (!arg) fail('用法：node scripts/ui_asset_pipeline/validate_card_detail_reference_contract.mjs <结构合同.json>')
  const contract = readJson(resolve(arg))
  if (contract.version !== 2 || contract.kind !== 'card-detail-reference-structure') fail('合同必须是 version 2 的 card-detail-reference-structure')
  for (const key of ['pageId', 'baseUiw', 'outputUiw', 'metaName']) required(contract[key], `contract.${key}`)
  if (contract.baseUiw === contract.outputUiw) fail('baseUiw 与 outputUiw 必须不同')
  if (!existsSync(resolve(contract.baseUiw))) fail(`baseUiw 不存在：${contract.baseUiw}`)
  if (!contract.popup || !rect(contract.popup.dialogRect)) fail('popup.dialogRect 必须为有效矩形')
  for (const key of ['popupId', 'dialogNodeId']) required(contract.popup?.[key], `popup.${key}`)
  if (!contract.popup.dialogProps || typeof contract.popup.dialogProps !== 'object') fail('popup.dialogProps 必须为对象')
  if (!Array.isArray(contract.layers) || !contract.layers.length) fail('layers 至少包含一个节点')
  const doc = readJson(resolve(contract.baseUiw))
  const popup = (doc.popups ?? []).find((item) => item.id === contract.popup.popupId)
  const dialog = popup?.nodes?.find((item) => item.id === contract.popup.dialogNodeId && item.type === 'dialog')
  if (!dialog) fail(`未找到弹窗本体：${contract.popup.dialogNodeId}`)
  const ids = new Set([contract.popup.dialogNodeId])
  const assetSlots = new Set()
  for (const [index, layer] of contract.layers.entries()) {
    const prefix = `layers[${index}]`
    for (const key of ['id', 'name', 'type', 'parent', 'visualRole']) required(layer[key], `${prefix}.${key}`)
    if (!TYPES.has(layer.type)) fail(`${prefix}.type 不支持：${layer.type}`)
    if (!PARENTS.has(layer.parent)) fail(`${prefix}.parent 不支持：${layer.parent}`)
    if (!rect(layer.rect)) fail(`${prefix}.rect 必须为有效矩形`)
    if (ids.has(layer.id)) fail(`${prefix}.id 重复：${layer.id}`)
    ids.add(layer.id)
    if (layer.assetSlot !== undefined) {
      required(layer.assetSlot, `${prefix}.assetSlot`)
      if (assetSlots.has(layer.assetSlot)) fail(`${prefix}.assetSlot 重复：${layer.assetSlot}`)
      assetSlots.add(layer.assetSlot)
      if (!['image', 'nine'].includes(layer.type)) fail(`${prefix}.assetSlot 只允许图片或九宫格节点使用`)
    }
    if (layer.runtime === true && !['text', 'button', 'progress'].includes(layer.type)) fail(`${prefix}.runtime 只能由文字、按钮或进度条承担`)
  }
  for (const id of ['detail-green-shell', 'detail-green-portrait', 'detail-green-close', 'detail-green-power-bar', 'detail-green-xp-bar', 'detail-green-skills-tray', 'detail-green-upgrade']) {
    if (!ids.has(id)) fail(`合同缺少必需节点：${id}`)
  }
  console.log(`✓ ${arg} 通过校验：${contract.layers.length} 个节点、${assetSlots.size} 个待绑定素材槽，弹窗定位有效`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
