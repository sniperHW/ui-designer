/**
 * 根据页面素材装配合同生成下一版 UIW。
 * 默认拒绝覆盖输出文件；--dry-run 只显示变更，绝不写入 UIW。
 * 本脚本不依赖 Electron、React 或 UIW 工具源码。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function fail(message) {
  throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function walk(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node)
    walk(node.children, visit)
    for (const page of node.pages ?? []) walk(page, visit)
    for (const slot of Object.values(node.slots ?? {})) walk(slot, visit)
  }
}

function nodeIndex(doc) {
  const index = new Map()
  const add = (scope, nodes) => walk(nodes, (node) => index.set(`${scope}:${node.id}`, node))
  add('commonLayer', doc.commonLayer?.nodes)
  for (const page of doc.pages ?? []) add(`page:${page.id}`, page.nodes)
  for (const widget of doc.customWidgets ?? []) add(`customWidget:${widget.id}`, widget.tree)
  return index
}

function scopeOf(target) {
  if (target.scope === 'commonLayer') return 'commonLayer'
  if (target.scope === 'page') return `page:${target.pageId}`
  if (target.scope === 'customWidget') return `customWidget:${target.customWidgetId}`
  fail(`target.scope 非法：${target.scope}`)
}

function propertyTokens(property) {
  return property.replace(/\[(\d+)\]/g, '.$1').split('.')
}

function setProperty(object, property, value) {
  const tokens = propertyTokens(property)
  const leaf = tokens.pop()
  let target = object
  for (const token of tokens) {
    if (!Object.hasOwn(target ?? {}, token)) fail(`目标属性不存在：${property}`)
    target = target[token]
  }
  if (!Object.hasOwn(target ?? {}, leaf)) fail(`目标属性不存在：${property}`)
  target[leaf] = value
}

function pngDataUri(path) {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const positional = args.filter((arg) => arg !== '--dry-run')
  const [catalogArg, contractArg] = positional
  if (!catalogArg || !contractArg || positional.length !== 2) {
    fail('用法：node scripts/ui_asset_pipeline/apply_page_asset_contract.mjs <asset-catalog.json> <page-contract.json> [--dry-run]')
  }

  const validator = resolve('scripts/ui_asset_pipeline/validate_page_asset_contract.mjs')
  execFileSync(process.execPath, [validator, catalogArg, contractArg], { stdio: 'inherit' })

  const catalog = readJson(resolve(catalogArg))
  const contract = readJson(resolve(contractArg))
  const outputPath = resolve(contract.outputUiw)
  if (!dryRun && existsSync(outputPath)) fail(`拒绝覆盖已有输出：${contract.outputUiw}`)

  const assets = new Map((catalog.assets ?? []).map((asset) => [asset.assetId, asset]))
  const doc = readJson(resolve(contract.baseUiw))
  const nodes = nodeIndex(doc)
  const changes = []
  for (const binding of contract.bindings) {
    const asset = assets.get(binding.assetId)
    const variant = asset.variants.find((item) => item.id === binding.variant)
    const scope = scopeOf(binding.target)
    const node = nodes.get(`${scope}:${binding.target.nodeId}`)
    const source = resolve(variant.file)
    if (!existsSync(source)) fail(`素材派生版本不存在：${variant.file}`)
    setProperty(node, binding.target.property, pngDataUri(source))
    changes.push({ assetId: binding.assetId, variant: binding.variant, target: `${scope}:${binding.target.nodeId}:${binding.target.property}` })
  }

  console.log(`计划更新 ${changes.length} 个 UIW 图片绑定：`)
  for (const change of changes) console.log(`  - ${change.assetId}.${change.variant} → ${change.target}`)
  if (dryRun) {
    console.log('✓ 干跑完成：未写入任何 UIW。')
    return
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成新的候选 UIW：${contract.outputUiw}`)
}

try {
  main()
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
}
