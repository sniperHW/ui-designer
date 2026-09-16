/** 由已校验的结构合同增量生成卡牌细节弹窗候选 UIW，不覆盖任何既有版本。 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }

function textNode(layer, text, fontSize, bold = false, align = 'left') {
  const [x, y, w, h] = layer.rect
  return { id: layer.id, type: 'text', name: layer.name, x, y, w, h, visible: true, locked: false, props: { text, fontSize, bold, align } }
}

function nodeFromLayer(layer) {
  const [x, y, w, h] = layer.rect
  if (layer.type === 'image') return { id: layer.id, type: 'image', name: layer.name, x, y, w, h, visible: true, locked: false, props: { src: '' } }
  if (layer.type === 'line') return { id: layer.id, type: 'line', name: layer.name, x, y, w, h, visible: true, locked: false, props: {} }
  if (layer.type === 'button') return { id: layer.id, type: 'button', name: layer.name, x, y, w, h, visible: true, locked: false, props: { text: '升级', fontSize: 28, bold: true } }
  const textById = {
    'detail-green-card-level': ['等级 1', 28, true, 'center'],
    'detail-green-card-progress': ['碎片 0 / 4', 20, true, 'center'],
    'detail-green-title': ['矿工', 38, true, 'center'],
    'detail-green-profession': ['亡灵 · 远程 · 普通', 24, false, 'center'],
    'detail-green-level-label': ['等级', 24, false, 'left'],
    'detail-green-level-value': ['1 / 14', 24, true, 'right'],
    'detail-green-power-label': ['战力', 24, false, 'left'],
    'detail-green-power-value': ['46', 24, true, 'right'],
    'detail-green-skills-heading': ['技能', 28, true, 'left'],
    'detail-green-skill-name': ['采矿', 24, true, 'left'],
    'detail-green-skill-description': ['部署后持续产出金币', 20, false, 'left']
  }
  const spec = textById[layer.id]
  if (!spec) fail(`缺少结构节点的运行时文本：${layer.id}`)
  return textNode(layer, ...spec)
}

function main() {
  const [contractArg] = process.argv.slice(2)
  if (!contractArg) fail('用法：node scripts/ui_asset_pipeline/build_card_detail_structure_candidate.mjs <结构合同.json>')
  const contractPath = resolve(contractArg)
  const validator = resolve('scripts/ui_asset_pipeline/validate_card_detail_structure_contract.mjs')
  execFileSync(process.execPath, [validator, contractPath], { stdio: 'inherit' })
  const contract = readJson(contractPath)
  const outputPath = resolve(contract.outputUiw)
  if (existsSync(outputPath)) fail(`拒绝覆盖已有输出：${contract.outputUiw}`)
  const doc = readJson(resolve(contract.baseUiw))
  const popup = doc.popups.find((item) => item.id === contract.popup.popupId)
  const dialog = popup.nodes.find((item) => item.id === contract.popup.dialogNodeId)
  dialog.children = contract.layers.map(nodeFromLayer)
  doc.meta.name = '卡面细节展示（绿色）v1 结构候选'
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成新的结构候选 UIW：${contract.outputUiw}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
