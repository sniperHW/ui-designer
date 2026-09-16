/** 为蓝色运行时详情候选增加稀有度框与两处低面积辅助色。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const fail = (message) => { throw new Error(message) }
const dataUri = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`

function node(id, name, type, x, y, w, h, src) {
  return { id, type, name, x, y, w, h, visible: true, locked: false, props: { src: dataUri(src) } }
}

function main() {
  const [baseArg, assetDirArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !assetDirArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_blue_rarity_accents_candidate.mjs <蓝色结构候选.uiw> <素材目录> <输出.uiw>')
  const base = resolve(baseArg)
  const assetDir = resolve(assetDirArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(assetDir)) fail('蓝色结构候选或素材目录不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const paths = {
    frame: resolve(assetDir, 'detail-blue-rarity-card-frame-448x296.png'),
    title: resolve(assetDir, 'detail-blue-rarity-title-accent-260x8.png'),
    xp: resolve(assetDir, 'detail-blue-rarity-xp-frame-592x21.png')
  }
  for (const [key, path] of Object.entries(paths)) if (!existsSync(path)) fail(`缺少${key}素材：${path}`)

  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups?.find((item) => item.id === 'ppmtwmxwlmjjf1')
  if (!popup) fail('未找到蓝色详情弹窗')
  if (popup.nodes.some((item) => item.id.startsWith('detail-blue-rarity-'))) fail('蓝色稀有度装饰节点已存在，拒绝重复装配')
  const portraitIndex = popup.nodes.findIndex((item) => item.id === 'detail-blue-portrait')
  const powerIndex = popup.nodes.findIndex((item) => item.id === 'detail-blue-power-bar')
  const xpIndex = popup.nodes.findIndex((item) => item.id === 'detail-blue-xp-bar')
  if (portraitIndex < 0 || powerIndex < 0 || xpIndex < 0) fail('未找到蓝色大卡面、战力板或经验条节点')

  // 稀有度框压在动态立绘之上、通用弹窗外壳之下；两条辅色不改变任何内容区布局。
  popup.nodes.splice(portraitIndex + 1, 0, node('detail-blue-rarity-card-frame', '蓝色稀有度卡框', 'image', 151, 212, 448, 296, paths.frame))
  const refreshedPowerIndex = popup.nodes.findIndex((item) => item.id === 'detail-blue-power-bar')
  popup.nodes.splice(refreshedPowerIndex, 0, node('detail-blue-rarity-title-accent', '蓝色稀有度标题短铭牌', 'image', 245, 596, 260, 8, paths.title))
  const refreshedXpIndex = popup.nodes.findIndex((item) => item.id === 'detail-blue-xp-bar')
  popup.nodes.splice(refreshedXpIndex, 0, node('detail-blue-rarity-xp-frame', '蓝色稀有度经验槽外沿', 'image', 79, 746, 592, 21, paths.xp))
  doc.meta.name = '卡面细节展示（蓝色）v2 稀有度色层画布验收候选'
  doc.meta.runtimeBindingContract = 'card-detail-blue-runtime-binding-contract-v1.json'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成蓝色稀有度色层候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
