/**
 * 根据卡面细节参考结构合同，增量输出 UIW 候选。
 * 合同只表达布局、运行时节点和未绑定素材槽；不会生成、登记或绑定美术素材。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }

function materialize(layer) {
  const [x, y, w, h] = layer.rect
  const props = { ...(layer.props ?? {}) }
  if (layer.type === 'image' && props.src === undefined) props.src = ''
  if (layer.type === 'nine') {
    if (props.assetSrc === undefined) props.assetSrc = ''
    if (props.nineInsets === undefined) props.nineInsets = [24, 24, 24, 24]
    if (props.nineSourceSize === undefined) props.nineSourceSize = [160, 120]
  }
  return {
    id: layer.id,
    type: layer.type,
    name: layer.name,
    x, y, w, h,
    visible: true,
    locked: false,
    props,
    ...(layer.clickable ? { clickable: true } : {}),
    ...(layer.clickAction ? { clickAction: layer.clickAction } : {})
  }
}

function main() {
  const [contractArg] = process.argv.slice(2)
  if (!contractArg) fail('用法：node scripts/ui_asset_pipeline/build_card_detail_reference_candidate.mjs <结构合同.json>')
  const contractPath = resolve(contractArg)
  const validator = resolve('scripts/ui_asset_pipeline/validate_card_detail_reference_contract.mjs')
  execFileSync(process.execPath, [validator, contractPath], { stdio: 'inherit' })
  const contract = readJson(contractPath)
  const outputPath = resolve(contract.outputUiw)
  if (existsSync(outputPath)) fail(`拒绝覆盖已有输出：${contract.outputUiw}`)
  const doc = readJson(resolve(contract.baseUiw))
  const popup = doc.popups.find((item) => item.id === contract.popup.popupId)
  const dialog = popup.nodes.find((item) => item.id === contract.popup.dialogNodeId)
  Object.assign(dialog, {
    x: contract.popup.dialogRect[0], y: contract.popup.dialogRect[1],
    w: contract.popup.dialogRect[2], h: contract.popup.dialogRect[3],
    props: { ...dialog.props, ...contract.popup.dialogProps }
  })
  dialog.children = contract.layers.filter((layer) => layer.parent === 'dialog').map(materialize)
  const before = contract.layers.filter((layer) => layer.parent === 'root-before-dialog').map(materialize)
  const after = contract.layers.filter((layer) => layer.parent === 'root-after-dialog').map(materialize)
  popup.nodes = [...before, dialog, ...after]
  doc.meta.name = contract.metaName
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成新的参考结构候选 UIW：${contract.outputUiw}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
