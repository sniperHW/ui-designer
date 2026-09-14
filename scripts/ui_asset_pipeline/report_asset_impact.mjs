/** 输出素材变更的只读影响范围，不修改 PNG、UIW 或设计工具源码。 */
import { readFileSync } from 'node:fs'

function usage() {
  console.error('用法：node scripts/ui_asset_pipeline/report_asset_impact.mjs <asset-catalog.json> <assetId>')
}

function main() {
  const [catalogPath, assetId] = process.argv.slice(2)
  if (!catalogPath || !assetId) {
    usage()
    process.exitCode = 1
    return
  }
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  const asset = catalog.assets?.find((item) => item.assetId === assetId)
  if (!asset) {
    console.error(`✗ 未登记素材：${assetId}`)
    process.exitCode = 1
    return
  }

  console.log(`素材：${asset.displayName ?? asset.assetId}（${asset.assetId}）`)
  console.log(`职责：${asset.role} · 质量配置：${asset.qualityProfile}`)
  console.log(`母版：${asset.master}`)
  console.log('派生版本：')
  for (const variant of asset.variants ?? []) console.log(`  - ${variant.id}：${variant.size.join('×')} · ${variant.file}`)
  console.log(`必经门禁：${(asset.requiredGates ?? []).join('、')}`)
  console.log(`影响范围：${(asset.consumers ?? []).length} 个已登记消费者`)
  for (const consumer of asset.consumers ?? []) {
    console.log(`  - [${consumer.project}] ${consumer.usage}`)
    console.log(`    合同：${consumer.contract}`)
  }
  console.log('结论：此命令只读；素材迭代前应逐项复验上述消费者。')
}

main()
