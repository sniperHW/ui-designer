/** Bind the approved-size state frames to the five green-card skill slots. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) { throw new Error(message) }
function dataUri(path) { return `data:image/png;base64,${readFileSync(path).toString('base64')}` }

function main() {
  const [baseArg, frameDirArg, outputArg] = process.argv.slice(2)
  if (!baseArg || !frameDirArg || !outputArg) fail('用法：node scripts/ui_asset_pipeline/assemble_card_detail_skill_slot_frames_canvas_candidate.mjs <基础候选.uiw> <槽框目录> <输出.uiw>')
  const base = resolve(baseArg)
  const frameDir = resolve(frameDirArg)
  const output = resolve(outputArg)
  if (!existsSync(base) || !existsSync(frameDir)) fail('基础候选或槽框目录不存在')
  if (existsSync(output)) fail(`拒绝覆盖已有输出：${outputArg}`)
  const equipped = resolve(frameDir, 'skill-slot-equipped-70.png')
  const muted = resolve(frameDir, 'skill-slot-muted-70.png')
  if (!existsSync(equipped) || !existsSync(muted)) fail('技能槽框素材不完整')
  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const popup = doc.popups.find((item) => item.id === 'ppmtv84xe0zm19')
  const slots = [1, 2, 3, 4, 5].map((index) => popup?.nodes.find((item) => item.id === `detail-green-skill-${index}` && item.type === 'nine'))
  if (slots.some((slot) => !slot)) fail('五个技能槽节点不完整')
  slots.forEach((slot, index) => { slot.props.assetSrc = dataUri(index < 2 ? equipped : muted) })
  doc.meta.name = '卡面细节展示（绿色）v16 技能槽框画布验收候选'
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成技能槽框画布验收候选：${outputArg}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
