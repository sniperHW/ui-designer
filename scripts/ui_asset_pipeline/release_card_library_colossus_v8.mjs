/** 巨像文明卡牌页 V23 单一发布门禁：合同、复现、UIW、真实画布、哈希和版本控制全部失败即停。 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const contractFile = 'assets/ui-pipeline/page-contracts/card-library-colossus-v8.json'
const contract = JSON.parse(fs.readFileSync(path.resolve(root, contractFile), 'utf8'))
const node = process.execPath
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase()

function run(command, args, label) {
  console.log(`\n[门禁] ${label}`)
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${label}失败（退出码 ${result.status}）`)
}

function assertTracked(files) {
  for (const file of files) {
    const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'ignore' })
    if (result.status !== 0) throw new Error(`关键封版文件尚未纳入 Git：${file}`)
  }
  const audit = JSON.parse(fs.readFileSync(path.resolve(root, contract.approvedBaseline.assemblyAudit), 'utf8'))
  for (const asset of audit.boundAssets ?? []) {
    const file = path.posix.join('output/card-page-anchor-reconstruction-v1/quality-remaster-v2/stage-16-colossus-v8-assets', asset.file)
    const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'ignore' })
    if (result.status !== 0) throw new Error(`验收素材尚未纳入 Git：${file}`)
  }
}

async function assertRendererAvailable() {
  try {
    const response = await fetch('http://127.0.0.1:9222/json', { signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    throw new Error(`真实设计工具未在 9222 调试端口运行；请先用 UIW_DEBUG_PORT=9222 启动工具（${error.message}）`)
  }
}

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'uiw-card-library-v23-'))
  const reproduced = path.join(temporary, 'reproduced-v23.uiw')
  const audit = path.join(temporary, 'reproduced-audit.json')
  try {
    run(node, ['scripts/ui_asset_pipeline/validate_card_library_colossus_v8_contract.mjs', contractFile], '页面合同与验收哈希')
    run(node, ['scripts/ui_asset_pipeline/validate_asset_catalog.mjs', 'assets/ui-pipeline/asset-catalog.json'], '全局素材注册表')
    run(node, ['scripts/ui_asset_pipeline/assemble_card_library_colossus_v8.mjs', '--output', reproduced, '--audit', audit], '从结构源可复现装配')

    const approved = path.resolve(root, contract.approvedBaseline.uiw)
    if (sha256(reproduced) !== sha256(approved)) throw new Error('可复现装配结果与 V23 验收 UIW 不一致')
    console.log('✓ 可复现装配与 V23 字节哈希一致')

    run(node, ['skills/uiw-designer/scripts/validate.mjs', reproduced], 'UIW 结构与语义')
    await assertRendererAvailable()
    run(node, ['scripts/ui_asset_pipeline/validate_card_library_colossus_v8_canvas.mjs', approved, '', contractFile], '真实设计工具画布')
    assertTracked(contract.versionControl?.requiredTracked ?? [])
    console.log('✓ 关键规范、合同、验收产物、运行时素材与验证脚本均已纳入 Git')
    run(node, ['node_modules/typescript/bin/tsc', '--noEmit'], '项目类型检查')
    console.log('\n✓ 卡牌页 V23 正式封版门禁全部通过')
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`\n✗ V23 发布门禁失败：${error.message}`)
  process.exitCode = 1
})
