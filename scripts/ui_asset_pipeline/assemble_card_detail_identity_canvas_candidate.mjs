/** 为绿色详情候选绑定职业、种族和升级货币的既有透明图标，仅用于画布验收。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, badgeArg, swordArg, raceArg, coinArg, outputArg] = process.argv.slice(2)
  if (![baseArg, badgeArg, swordArg, raceArg, coinArg, outputArg].every(Boolean)) {
    fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_identity_canvas_candidate.mjs <框体候选.uiw> <徽章底.png> <近战图标.png> <种族图标.png> <货币图标.png> <输出.uiw>')
  }
  const paths = [baseArg, badgeArg, swordArg, raceArg, coinArg].map((path) => resolve(path))
  const output = resolve(outputArg)
  if (paths.some((path) => !existsSync(path))) fail('候选或既有透明图标不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(paths[0], 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const byId = (id) => popup?.nodes.find((item) => item.id === id)
  const typeBadge = byId('detail-green-type-badge')
  const raceBadge = byId('detail-green-race-badge')
  const typeIcon = byId('detail-green-type-icon')
  const raceIcon = byId('detail-green-race-icon')
  const costIcon = byId('detail-green-upgrade-cost-icon')
  if (!typeBadge || !raceBadge || !typeIcon || !raceIcon || !costIcon) fail('绿色身份或升级货币节点不完整')
  const badge = dataUri(paths[1])
  for (const node of [typeBadge, raceBadge]) {
    node.props.assetSrc = badge
    node.props.nineSourceSize = [277, 72]
    node.props.nineInsets = [16, 12, 16, 12]
  }
  typeIcon.props.src = dataUri(paths[2])
  raceIcon.props.src = dataUri(paths[3])
  costIcon.props.src = dataUri(paths[4])
  doc.meta.name = '卡面细节展示（绿色）v12 身份与货币画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成身份与货币画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
