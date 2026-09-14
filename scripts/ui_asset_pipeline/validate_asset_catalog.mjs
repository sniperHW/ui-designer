/** 校验工具外的全局 UI 素材注册表，不依赖 Electron 或 UIW 渲染代码。 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const assetIdPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const roles = new Set(['icon', 'container', 'frame', 'button-skin', 'portrait', 'progress', 'background'])

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

function main() {
  const [catalogArg, ...rest] = process.argv.slice(2)
  if (!catalogArg) fail('用法：node scripts/ui_asset_pipeline/validate_asset_catalog.mjs <asset-catalog.json> [--profiles <目录>] [--verify-files]')
  const optionIndex = rest.indexOf('--profiles')
  const verifyFiles = rest.includes('--verify-files')
  const profilesDir = optionIndex >= 0 && rest[optionIndex + 1]
    ? resolve(rest[optionIndex + 1])
    : resolve('assets/ui-pipeline/quality-profiles')
  const catalogPath = resolve(catalogArg)
  const catalog = readJson(catalogPath)

  if (catalog.version !== 1) fail('catalog.version 必须为 1')
  if (!Array.isArray(catalog.qualityProfiles) || !catalog.qualityProfiles.length) fail('qualityProfiles 不能为空')
  if (!Array.isArray(catalog.assets)) fail('assets 必须为数组')

  const profiles = new Map()
  for (const profileId of catalog.qualityProfiles) {
    requireString(profileId, 'qualityProfiles 条目')
    const profilePath = join(profilesDir, `${profileId}.json`)
    if (!existsSync(profilePath)) fail(`找不到质量配置：${profilePath}`)
    const profile = readJson(profilePath)
    if (profile.id !== profileId) fail(`质量配置文件与引用 ID 不一致：${profilePath}`)
    profiles.set(profileId, profile)
  }

  const seenAssets = new Set()
  for (const [index, asset] of catalog.assets.entries()) {
    const prefix = `assets[${index}]`
    const assetId = asset.assetId
    if (typeof assetId !== 'string' || !assetIdPattern.test(assetId)) fail(`${prefix}.assetId 必须是稳定的小写语义 ID`)
    if (seenAssets.has(assetId)) fail(`assetId 重复：${assetId}`)
    seenAssets.add(assetId)

    if (!roles.has(asset.role)) fail(`${assetId}.role 非法：${asset.role}`)
    if (!profiles.has(asset.qualityProfile)) fail(`${assetId}.qualityProfile 必须引用已登记质量配置`)
    requireString(asset.master, `${assetId}.master`)
    if (verifyFiles && !existsSync(resolve(asset.master))) fail(`${assetId}.master 指向的文件不存在：${asset.master}`)

    const profile = profiles.get(asset.qualityProfile)
    const required = new Set([...(profile.requiredGates ?? []), ...(profile.roleGates?.[asset.role] ?? [])])
    const gates = new Set(asset.requiredGates ?? [])
    const missing = [...required].filter((gate) => !gates.has(gate)).sort()
    if (missing.length) fail(`${assetId} 缺少必经质量门禁：${missing.join(', ')}`)

    if (!Array.isArray(asset.variants) || !asset.variants.length) fail(`${assetId}.variants 至少包含一个派生版本`)
    const variantIds = new Set()
    for (const variant of asset.variants) {
      requireString(variant.id, `${assetId}.variant.id`)
      if (variantIds.has(variant.id)) fail(`${assetId} 的 variant.id 必须唯一：${variant.id}`)
      if (!Array.isArray(variant.size) || variant.size.length !== 2 || !variant.size.every((size) => Number.isInteger(size) && size > 0)) {
        fail(`${assetId}.${variant.id}.size 必须为两个正整数`)
      }
      requireString(variant.file, `${assetId}.${variant.id}.file`)
      if (verifyFiles && !existsSync(resolve(variant.file))) fail(`${assetId}.${variant.id}.file 指向的文件不存在：${variant.file}`)
      variantIds.add(variant.id)
    }

    if (asset.consumers !== undefined && !Array.isArray(asset.consumers)) fail(`${assetId}.consumers 必须为数组`)
    for (const consumer of asset.consumers ?? []) {
      for (const key of ['project', 'contract', 'usage']) requireString(consumer[key], `${assetId}.consumers.${key}`)
    }
  }

  console.log(`✓ ${catalogArg} 通过校验：${seenAssets.size} 个素材，${profiles.size} 个质量配置`)
}

try {
  main()
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
}
