/** 将简化版九宫格框体装入绿色详情的独立画布候选，不覆盖旧版本。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, shellArg, tileArg, trayArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !shellArg || !tileArg || !trayArg || !outputArg) {
    fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_simple_frames_canvas_candidate.mjs <旧候选.uiw> <外壳.png> <属性格.png> <技能托盘.png> <输出.uiw>')
  }
  const paths = [baseArg, shellArg, tileArg, trayArg].map((path) => resolve(path))
  const output = resolve(outputArg)
  if (paths.some((path) => !existsSync(path))) fail('旧候选或简化框体素材不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(paths[0], 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const byId = (id) => popup?.nodes.find((item) => item.id === id && item.type === 'nine')
  const shell = byId('detail-green-shell')
  const tray = byId('detail-green-skills-tray')
  const tiles = popup?.nodes.filter((item) => /^detail-green-prop-[1-6]-bg$/.test(item.id) && item.type === 'nine') ?? []
  if (!shell || !tray || tiles.length !== 6) fail('未找到完整的绿色九宫格节点集合')
  shell.props.assetSrc = dataUri(paths[1]); shell.props.nineSourceSize = [688, 862]; shell.props.nineInsets = [48, 54, 48, 48]
  const tileSrc = dataUri(paths[2])
  for (const tile of tiles) { tile.props.assetSrc = tileSrc; tile.props.nineSourceSize = [277, 72]; tile.props.nineInsets = [16, 12, 16, 12] }
  tray.props.assetSrc = dataUri(paths[3]); tray.props.nineSourceSize = [620, 127]; tray.props.nineInsets = [24, 22, 24, 22]
  doc.meta.name = '卡面细节展示（绿色）v9 简化框体画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成简化框体画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
