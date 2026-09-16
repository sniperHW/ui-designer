/** 只为真实画布验收绑定未入库的外壳候选；不写资产目录，也不覆盖任何 UIW。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, assetArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !assetArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_shell_canvas_candidate.mjs <结构候选.uiw> <外壳候选.png> <输出.uiw>')
  const base = resolve(baseArg); const asset = resolve(assetArg); const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(asset)) fail('结构候选或外壳候选不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const shell = popup?.nodes.find((node) => node.id === 'detail-green-shell' && node.type === 'nine')
  if (!shell) fail('未找到绿色详情外壳九宫格节点')
  shell.props.assetSrc = dataUri(asset)
  shell.props.nineSourceSize = [688, 862]
  shell.props.nineInsets = [52, 52, 52, 52]
  doc.meta.name = '卡面细节展示（绿色）v3 外壳画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成外壳画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
