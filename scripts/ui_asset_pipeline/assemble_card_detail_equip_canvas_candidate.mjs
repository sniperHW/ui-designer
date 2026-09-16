/** 为绿色详情的“装备”保留 button 交互节点并加挂无字皮肤，仅用于画布验收。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, skinArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !skinArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_equip_canvas_candidate.mjs <升级候选.uiw> <装备皮肤.png> <输出.uiw>')
  const base = resolve(baseArg)
  const skin = resolve(skinArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(skin)) fail('升级候选或装备皮肤不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const node = popup?.nodes.find((item) => item.id === 'detail-green-equip' && item.type === 'button')
  if (!node) fail('未找到绿色装备 button 节点')
  node.props.assetSrc = dataUri(skin)
  doc.meta.name = '卡面细节展示（绿色）v8 装备按钮画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成装备按钮画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
