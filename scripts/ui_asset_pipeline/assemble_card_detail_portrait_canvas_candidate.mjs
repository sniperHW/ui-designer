/** 为已验收的外壳画布候选加挂一张未入库卡面，仅作真实画布验收。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, portraitArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !portraitArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_portrait_canvas_candidate.mjs <外壳候选.uiw> <卡面候选.png> <输出.uiw>')
  const base = resolve(baseArg)
  const portrait = resolve(portraitArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(portrait)) fail('外壳候选或卡面候选不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const node = popup?.nodes.find((item) => item.id === 'detail-green-portrait' && item.type === 'image')
  if (!node) fail('未找到绿色大卡面节点')
  node.props.src = dataUri(portrait)
  doc.meta.name = '卡面细节展示（绿色）v4 外壳与卡面画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成外壳与卡面画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
