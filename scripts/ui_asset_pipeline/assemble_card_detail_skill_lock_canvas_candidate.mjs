/** Add independent lock-state icons to the two locked green-card skill slots. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, lockArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !lockArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_skill_lock_canvas_candidate.mjs <基础候选.uiw> <锁图标.png> <输出.uiw>')
  const base = resolve(baseArg)
  const lock = resolve(lockArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(lock)) fail('基础候选或锁图标不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  if (!popup || popup.nodes.some((item) => /^detail-green-skill-[45]-lock$/.test(item.id))) fail('锁定状态节点异常')
  const src = dataUri(lock)
  popup.nodes.push(
    { id: 'detail-green-skill-4-lock', type: 'image', name: '技能槽 4 锁定图标', x: 476, y: 1149, w: 31, h: 31, visible: true, locked: false, props: { src } },
    { id: 'detail-green-skill-5-lock', type: 'image', name: '技能槽 5 锁定图标', x: 589, y: 1149, w: 31, h: 31, visible: true, locked: false, props: { src } }
  )
  doc.meta.name = '卡面细节展示（绿色）v18 高亮技能锁定状态画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成技能锁定状态画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
