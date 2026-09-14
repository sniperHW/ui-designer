/** 校验页面装配合同及其对当前 UIW 的只读定位，不修改设计工具或 UIW。 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function fail(message) {
  throw new Error(message)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`无法读取 JSON：${path}（${error.message}）`)
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) fail(`${label} 必须为非空字符串`)
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

function readProperty(object, property) {
  const tokens = property.replace(/\[(\d+)\]/g, '.$1').split('.')
  let value = object
  for (const token of tokens) {
    if (!Object.hasOwn(value ?? {}, token)) return { found: false }
    value = value[token]
  }
  return { found: true, value }
}

function targetScope(target) {
  if (target.scope === 'commonLayer') return 'commonLayer'
  if (target.scope === 'page') {
    requireString(target.pageId, 'target.pageId')
    return `page:${target.pageId}`
  }
  if (target.scope === 'customWidget') {
    requireString(target.customWidgetId, 'target.customWidgetId')
    return `customWidget:${target.customWidgetId}`
  }
  fail(`target.scope 非法：${target.scope}`)
}

function main() {
  const [catalogArg, contractArg] = process.argv.slice(2)
  if (!catalogArg || !contractArg) fail('用法：node scripts/ui_asset_pipeline/validate_page_asset_contract.mjs <asset-catalog.json> <page-contract.json>')
  const catalog = readJson(resolve(catalogArg))
  const contractPath = resolve(contractArg)
  const contract = readJson(contractPath)
  if (contract.version !== 1) fail('contract.version 必须为 1')
  for (const key of ['pageId', 'baseUiw', 'outputUiw', 'qualityProfile']) requireString(contract[key], `contract.${key}`)
  if (contract.baseUiw === contract.outputUiw) fail('baseUiw 与 outputUiw 必须不同，避免覆盖验收版本')
  if (!catalog.qualityProfiles?.includes(contract.qualityProfile)) fail(`合同引用了未登记质量配置：${contract.qualityProfile}`)
  if (!Array.isArray(contract.bindings) || !contract.bindings.length) fail('bindings 至少包含一个素材绑定')
  if (!existsSync(resolve(contract.baseUiw))) fail(`baseUiw 不存在：${contract.baseUiw}`)

  const assets = new Map((catalog.assets ?? []).map((asset) => [asset.assetId, asset]))
  const doc = readJson(resolve(contract.baseUiw))
  const nodes = nodeIndex(doc)
  const seenTargets = new Set()
  for (const [index, binding] of contract.bindings.entries()) {
    const prefix = `bindings[${index}]`
    const asset = assets.get(binding.assetId)
    if (!asset) fail(`${prefix}.assetId 未登记：${binding.assetId}`)
    if (!asset.variants?.some((variant) => variant.id === binding.variant)) fail(`${prefix}.variant 未登记：${binding.assetId}.${binding.variant}`)
    if (!Array.isArray(binding.additionalGates) || !binding.additionalGates.every((gate) => typeof gate === 'string' && gate)) {
      fail(`${prefix}.additionalGates 必须为非空字符串数组，可为空数组`)
    }
    if (!binding.target || typeof binding.target !== 'object') fail(`${prefix}.target 必须为对象`)
    const scope = targetScope(binding.target)
    requireString(binding.target.nodeId, `${prefix}.target.nodeId`)
    requireString(binding.target.property, `${prefix}.target.property`)
    if (!binding.target.property.startsWith('props.')) fail(`${prefix}.target.property 只能定位图片 props 字段`)
    const key = `${scope}:${binding.target.nodeId}:${binding.target.property}`
    if (seenTargets.has(key)) fail(`同一 UIW 属性被重复绑定：${key}`)
    seenTargets.add(key)
    const node = nodes.get(`${scope}:${binding.target.nodeId}`)
    if (!node) fail(`${prefix} 未在 baseUiw 找到节点：${scope}:${binding.target.nodeId}`)
    if (!readProperty(node, binding.target.property).found) fail(`${prefix} 未在目标节点找到属性：${binding.target.property}`)
  }
  console.log(`✓ ${contractArg} 通过校验：${contract.bindings.length} 个绑定，当前 UIW 定位全部有效`)
}

try {
  main()
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
}
