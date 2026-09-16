/** 为绿色详情候选的技能托盘绑定无字九宫格底座，仅用于画布验收。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, trayArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !trayArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_skills_tray_canvas_candidate.mjs <属性格候选.uiw> <技能托盘候选.png> <输出.uiw>')
  const base = resolve(baseArg)
  const tray = resolve(trayArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(tray)) fail('属性格候选或技能托盘候选不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const node = popup?.nodes.find((item) => item.id === 'detail-green-skills-tray' && item.type === 'nine')
  if (!node) fail('未找到绿色技能托盘节点')
  node.props.assetSrc = dataUri(tray)
  node.props.nineSourceSize = [620, 127]
  node.props.nineInsets = [24, 24, 24, 24]
  doc.meta.name = '卡面细节展示（绿色）v6 技能托盘画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成技能托盘画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
