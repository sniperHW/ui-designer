/** 将绿色详情的经验条装配为黑底 + 湖蓝裁切填充，保留原进度数值。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const fail = (message) => { throw new Error(message) }
const dataUri = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`

function main() {
  const [baseArg, assetDirArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !assetDirArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_green_xp_lake_candidate.mjs <绿色基线.uiw> <素材目录> <输出.uiw>')
  const base = resolve(baseArg), assetDir = resolve(assetDirArg), output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(assetDir)) fail('绿色基线或素材目录不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const track = resolve(assetDir, 'detail-green-xp-track-black-592x21.png')
  const fill = resolve(assetDir, 'detail-green-xp-fill-lake-blue-592x21.png')
  if (!existsSync(track) || !existsSync(fill)) fail('经验条黑底或湖蓝填充素材缺失')
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups?.find((item) => item.id === 'ppmtv84xe0zm19')
  const xp = popup?.nodes.find((item) => item.id === 'detail-green-xp-bar' && item.type === 'progress')
  if (!xp) fail('未找到绿色经验进度条')
  if (xp.props.assetSrc || xp.props.assetFillSrc) fail('绿色经验进度条已存在素材绑定，拒绝覆盖')
  xp.props.assetSrc = dataUri(track)
  xp.props.assetFillSrc = dataUri(fill)
  xp.props.progress = 35
  doc.meta.name = '卡面细节展示（绿色）v31 黑底湖蓝经验条画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成黑底湖蓝经验条候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
