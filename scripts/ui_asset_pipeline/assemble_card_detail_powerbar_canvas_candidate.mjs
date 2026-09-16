import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
const fail = (message) => { throw new Error(message) }
const dataUri = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`
function main() {
  const [baseArg, assetArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !assetArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_powerbar_canvas_candidate.mjs <基础候选.uiw> <横条.png> <输出.uiw>')
  const base = resolve(baseArg), asset = resolve(assetArg), output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(asset)) fail('基础候选或横条素材不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const bar = popup?.nodes.find((item) => item.id === 'detail-green-power-bar' && item.type === 'nine')
  if (!bar) fail('战力横条节点不存在')
  bar.props.assetSrc = dataUri(asset)
  // 中央板保持旧版起止位置；仅两端卡扣越过安全区，覆盖外壳的竖向金边。
  bar.x = 31
  bar.w = 688
  bar.props.nineSourceSize = [688, 40]
  bar.props.nineInsets = [58, 10, 58, 10]
  const contrastTextIds = ['detail-green-title', 'detail-green-power', 'detail-green-level', 'detail-green-rarity', 'detail-green-xp']
  for (const id of contrastTextIds) {
    const node = popup.nodes.find((item) => item.id === id && item.type === 'text')
    if (!node) fail(`运行时文字节点不存在：${id}`)
    // SVG 文本渲染器读取 textColor；保留该字段才能在实际画布生效。
    delete node.props.color
    node.props.textColor = '#ffffff'
  }
  doc.meta.name = '卡面细节展示（绿色）v26 外框叠压卡扣战力板画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成战力横条画布验收候选：${outputArg}`)
}
try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
