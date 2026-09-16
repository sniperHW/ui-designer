/** Bind six exact-size transparent property icons to the green detail candidate for canvas acceptance. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, iconDirArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !iconDirArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_property_icons_canvas_candidate.mjs <身份候选.uiw> <图标目录> <输出.uiw>')
  const base = resolve(baseArg)
  const iconDir = resolve(iconDirArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(iconDir)) fail('身份候选或属性图标目录不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const files = [
    'property-building-health-46.png', 'property-production-time-46.png', 'property-attack-46.png',
    'property-unit-health-46.png', 'property-speed-46.png', 'property-range-46.png'
  ].map((name) => resolve(iconDir, name))
  if (files.some((path) => !existsSync(path))) fail('六张属性图标不完整')
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const nodes = popup?.nodes.filter((item) => /^detail-green-prop-[1-6]-icon$/.test(item.id) && item.type === 'image') ?? []
  if (nodes.length !== 6) fail(`属性图标节点数量异常：${nodes.length}/6`)
  for (let index = 0; index < nodes.length; index++) nodes[index].props.src = dataUri(files[index])
  doc.meta.name = '卡面细节展示（绿色）v15 简化属性图标画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成属性图标画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
