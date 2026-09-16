import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const fail = (message) => { throw new Error(message) }
const dataUri = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`

function main() {
  const [baseArg, assetArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !assetArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_share_canvas_candidate.mjs <基础候选.uiw> <分享图标.png> <输出.uiw>')
  const base = resolve(baseArg), asset = resolve(assetArg), output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(asset)) fail('基础候选或分享图标素材不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const share = popup?.nodes.find((item) => item.id === 'detail-green-share' && item.type === 'image')
  if (!share) fail('分享图标节点不存在')
  share.props.src = dataUri(asset)
  doc.meta.name = '卡面细节展示（绿色）v28 分享图标画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成分享图标画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
