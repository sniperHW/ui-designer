/** 为绿色详情页增加独立、可回退的稀有度色层候选。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const fail = (message) => { throw new Error(message) }
const dataUri = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`
const makeNode = (id, name, x, y, w, h, src) => ({ id, type: 'image', name, x, y, w, h, visible: true, locked: false, props: { src: dataUri(src) } })

function main() {
  const [baseArg, assetDirArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !assetDirArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_green_rarity_accents_candidate.mjs <绿色基线.uiw> <素材目录> <输出.uiw>')
  const base = resolve(baseArg), assetDir = resolve(assetDirArg), output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(assetDir)) fail('绿色基线或素材目录不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const paths = {
    frame: resolve(assetDir, 'detail-green-rarity-card-frame-448x296.png'),
    title: resolve(assetDir, 'detail-green-rarity-title-accent-260x8.png'),
    xp: resolve(assetDir, 'detail-green-rarity-xp-frame-592x21.png')
  }
  for (const [key, path] of Object.entries(paths)) if (!existsSync(path)) fail(`缺少${key}素材：${path}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups?.find((item) => item.id === 'ppmtv84xe0zm19')
  if (!popup) fail('未找到绿色详情弹窗')
  if (popup.nodes.some((item) => item.id.startsWith('detail-green-rarity-'))) fail('绿色稀有度装饰节点已存在，拒绝重复装配')
  const portraitIndex = popup.nodes.findIndex((item) => item.id === 'detail-green-portrait')
  if (portraitIndex < 0) fail('未找到绿色大卡面')
  popup.nodes.splice(portraitIndex + 1, 0, makeNode('detail-green-rarity-card-frame', '绿色稀有度卡框', 151, 212, 448, 296, paths.frame))
  const powerIndex = popup.nodes.findIndex((item) => item.id === 'detail-green-power-bar')
  popup.nodes.splice(powerIndex, 0, makeNode('detail-green-rarity-title-accent', '绿色稀有度标题短铭牌', 245, 596, 260, 8, paths.title))
  const xpIndex = popup.nodes.findIndex((item) => item.id === 'detail-green-xp-bar')
  popup.nodes.splice(xpIndex, 0, makeNode('detail-green-rarity-xp-frame', '绿色稀有度经验槽外沿', 79, 746, 592, 21, paths.xp))
  doc.meta.name = '卡面细节展示（绿色）v30 稀有度色层画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成绿色稀有度色层候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
