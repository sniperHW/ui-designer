/** 为绿色详情候选的六个属性格绑定同一无字九宫格底座，仅用于画布验收。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, tileArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !tileArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_property_tiles_canvas_candidate.mjs <卡面候选.uiw> <属性格候选.png> <输出.uiw>')
  const base = resolve(baseArg)
  const tile = resolve(tileArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(tile)) fail('卡面候选或属性格候选不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const nodes = popup?.nodes.filter((item) => /^detail-green-prop-[1-6]-bg$/.test(item.id) && item.type === 'nine') ?? []
  if (nodes.length !== 6) fail(`绿色属性格底座数量异常：${nodes.length}/6`)
  const src = dataUri(tile)
  for (const node of nodes) {
    node.props.assetSrc = src
    node.props.nineSourceSize = [277, 72]
    node.props.nineInsets = [16, 12, 16, 12]
  }
  doc.meta.name = '卡面细节展示（绿色）v5 属性格画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成属性格画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
