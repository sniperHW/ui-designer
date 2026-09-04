#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'

function usage() {
  console.error('Usage: node audit-assets.mjs --layout <ui-layout.json> --manifest <manifest.json> --sprites-dir <dir> [--report <report.json>] [--prune] [--allow-unused <id,id>]')
  process.exit(2)
}

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const layoutFile = option('--layout')
const manifestFile = option('--manifest')
const spritesDirArg = option('--sprites-dir')
const reportFile = option('--report')
const prune = args.includes('--prune')
const allowlistedUnusedAssetIds = (option('--allow-unused') || '').split(',').map((id) => id.trim()).filter(Boolean)
if (!layoutFile || !manifestFile || !spritesDirArg) usage()

function parseJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (error) {
    console.error(`Cannot parse ${file}: ${error.message}`)
    process.exit(2)
  }
}
function findBindings(value, output = [], path = '$') {
  if (Array.isArray(value)) value.forEach((item, index) => findBindings(item, output, `${path}[${index}]`))
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.assetBindings)) {
      value.assetBindings.forEach((binding, index) => {
        if (binding && typeof binding.assetId === 'string' && binding.assetId) output.push({ assetId: binding.assetId, path: `${path}.assetBindings[${index}]` })
      })
    }
    Object.entries(value).forEach(([key, child]) => { if (key !== 'assetBindings') findBindings(child, output, `${path}.${key}`) })
  }
  return output
}
function filesRecursively(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    const stat = statSync(file)
    if (stat.isDirectory()) filesRecursively(file, acc)
    else if (extname(file).toLowerCase() === '.png') acc.push(resolve(file))
  }
  return acc
}
function manifestEntries(value) {
  if (Array.isArray(value)) return { entries: value, key: null }
  if (Array.isArray(value.assets)) return { entries: value.assets, key: 'assets' }
  if (Array.isArray(value.items)) return { entries: value.items, key: 'items' }
  if (Array.isArray(value.sprites)) return { entries: value.sprites, key: 'sprites' }
  console.error('Manifest must be an array or contain an assets/items/sprites array.')
  process.exit(2)
}

const layout = parseJson(layoutFile)
const originalManifest = parseJson(manifestFile)
const { entries, key } = manifestEntries(originalManifest)
const spritesDir = resolve(spritesDirArg)
const manifestDir = dirname(resolve(manifestFile))
const bindings = findBindings(layout)
const referencedIds = new Set(bindings.map(({ assetId }) => assetId))
const byId = new Map()
const duplicateAssetIds = []
const malformedManifestEntries = []
const unsafeManifestFiles = []

for (const entry of entries) {
  if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.file !== 'string' || !entry.file) {
    malformedManifestEntries.push(entry ?? null)
    continue
  }
  if (byId.has(entry.id)) duplicateAssetIds.push(entry.id)
  else byId.set(entry.id, entry)
}
const managedFiles = new Set()
for (const entry of byId.values()) {
  const candidate = resolve(manifestDir, entry.file)
  const pathFromSpriteRoot = relative(spritesDir, candidate)
  const insideSpritesDir = pathFromSpriteRoot && !pathFromSpriteRoot.startsWith('..') && !isAbsolute(pathFromSpriteRoot)
  if (!insideSpritesDir) unsafeManifestFiles.push({ id: entry.id, file: entry.file })
  else managedFiles.add(candidate)
}
const missingManifestAssets = [...referencedIds].filter((id) => !byId.has(id))
const missingSpriteFiles = [...byId.values()].filter((entry) => !existsSync(resolve(manifestDir, entry.file))).map((entry) => ({ id: entry.id, file: entry.file }))
const unusedManifestAssets = [...byId.keys()].filter((id) => !referencedIds.has(id) && !allowlistedUnusedAssetIds.includes(id))
const allSprites = filesRecursively(spritesDir)
const unmanagedSpriteFiles = allSprites.filter((file) => !managedFiles.has(file)).map((file) => relative(spritesDir, file))
const bindingCounts = Object.fromEntries([...referencedIds].sort().map((id) => [id, bindings.filter((binding) => binding.assetId === id).length]))
const report = {
  layout: resolve(layoutFile), manifest: resolve(manifestFile), spritesDir,
  referencedAssetCount: referencedIds.size, manifestAssetCount: byId.size, bindingCounts,
  duplicateAssetIds: [...new Set(duplicateAssetIds)].sort(), malformedManifestEntries,
  missingManifestAssets: missingManifestAssets.sort(), missingSpriteFiles,
  unsafeManifestFiles, unusedManifestAssets: unusedManifestAssets.sort(),
  allowlistedUnusedAssetIds: allowlistedUnusedAssetIds.sort(), unmanagedSpriteFiles: unmanagedSpriteFiles.sort(),
  pruned: []
}
if (prune) {
  if (report.duplicateAssetIds.length || report.malformedManifestEntries.length || report.missingManifestAssets.length || report.missingSpriteFiles.length || report.unsafeManifestFiles.length) {
    console.error('Refusing to prune because the asset graph is invalid. Inspect the report and repair it first.')
    process.exit(1)
  }
  const unusedSet = new Set(report.unusedManifestAssets)
  for (const id of unusedSet) {
    const entry = byId.get(id)
    const file = resolve(manifestDir, entry.file)
    if (managedFiles.has(file) && existsSync(file)) { rmSync(file); report.pruned.push(relative(spritesDir, file)) }
  }
  const retained = entries.filter((entry) => !entry?.id || !unusedSet.has(entry.id))
  const replacement = key === null ? retained : { ...originalManifest, [key]: retained }
  writeFileSync(manifestFile, `${JSON.stringify(replacement, null, 2)}\n`)
  report.manifestAssetCount = retained.length
  report.unusedManifestAssets = []
}
if (reportFile) writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
const failures = report.duplicateAssetIds.length || report.malformedManifestEntries.length || report.missingManifestAssets.length || report.missingSpriteFiles.length || report.unsafeManifestFiles.length || report.unmanagedSpriteFiles.length || report.unusedManifestAssets.length
process.exit(failures ? 1 : 0)
