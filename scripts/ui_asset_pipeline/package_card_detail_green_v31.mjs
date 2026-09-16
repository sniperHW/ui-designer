import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceRelative = path.join(
  'output',
  'card-page-anchor-reconstruction-v1',
  'quality-remaster-v2',
  'stage-10-card-detail',
  'candidates',
  '卡面细节展示-绿色-v31-黑底湖蓝经验条画布验收候选.uiw',
)
const outputRelative = path.join(
  'output',
  'card-page-anchor-reconstruction-v1',
  'quality-remaster-v2',
  'stage-10-card-detail',
  'packages',
  'card-detail-green-v31-xp-lake-material-package-v1',
)
const sourcePath = path.join(root, sourceRelative)
const packagePath = path.join(root, outputRelative)
const assetPath = path.join(packagePath, 'assets')
const deliveredUiwName = path.basename(sourcePath)

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function walk(value, context, found) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${context}[${index}]`, found))
    return
  }
  const node = typeof value.id === 'string' && typeof value.type === 'string'
    ? `node:${value.id}（${value.name ?? value.type}）`
    : null
  for (const [key, item] of Object.entries(value)) {
    const next = node ? `${context}/${node}/${key}` : `${context}/${key}`
    if (typeof item === 'string' && /^(src|assetSrc|assetFillSrc)$/i.test(key) && item.startsWith('data:')) {
      found.push({ key, path: next, dataUri: item })
    } else {
      walk(item, next, found)
    }
  }
}

const sourceBuffer = await readFile(sourcePath)
const document = JSON.parse(sourceBuffer.toString('utf8'))
const refs = []
walk(document, '$', refs)

await rm(packagePath, { recursive: true, force: true })
await mkdir(assetPath, { recursive: true })
await cp(sourcePath, path.join(packagePath, deliveredUiwName))

const files = new Map()
const materialReferences = []
for (const ref of refs) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(ref.dataUri)
  if (!match) throw new Error(`不支持的内嵌素材格式：${ref.path}`)
  const mimeType = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  const hash = sha256(buffer)
  if (!files.has(hash)) {
    const extension = mimeType === 'image/png' ? 'png' : 'bin'
    const filename = `asset-${String(files.size + 1).padStart(2, '0')}-${hash.slice(0, 12)}.${extension}`
    files.set(hash, { filename, mimeType, bytes: buffer.length, hash, buffer })
  }
  const file = files.get(hash)
  materialReferences.push({ property: ref.key, nodePath: ref.path, file: `assets/${file.filename}`, sha256: hash })
}

for (const file of files.values()) {
  await writeFile(path.join(assetPath, file.filename), file.buffer)
}

const manifest = {
  packageVersion: 1,
  name: '卡面细节展示绿色 v31 黑底湖蓝经验条素材包',
  generatedAt: new Date().toISOString(),
  source: {
    uiw: deliveredUiwName,
    originalRelativePath: sourceRelative.replaceAll(path.sep, '/'),
    sha256: sha256(sourceBuffer),
    bytes: sourceBuffer.length,
  },
  content: {
    materialReferenceCount: materialReferences.length,
    uniqueEmbeddedMaterialCount: files.size,
    externalDependencyCount: 0,
    note: '工程内素材均为 data URI 内嵌 PNG；assets 目录是为审查与复用导出的去重副本，原始 .uiw 未改写。',
  },
  assets: [...files.values()].map(({ buffer, ...file }) => ({ file: `assets/${file.filename}`, ...file })),
  materialReferences,
}
await writeFile(path.join(packagePath, '素材清单.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const readme = [
  '# 卡面细节展示绿色 v31 素材包',
  '',
  `- 工程文件：${deliveredUiwName}`,
  '- assets/：从工程内导出的 54 份去重 PNG 素材。',
  '- 素材清单.json：节点属性与素材文件的一一对应关系、来源校验值。',
  '- 工程原样保留了所有内嵌素材，可单独打开；assets/ 用于素材审查与复用。',
].join('\n')
await writeFile(path.join(packagePath, 'README.md'), `${readme}\n`, 'utf8')

const packageBytes = await Promise.all(
  [...files.values()].map(async (file) => (await stat(path.join(assetPath, file.filename))).size),
)
console.log(JSON.stringify({ packagePath: outputRelative.replaceAll(path.sep, '/'), uiw: deliveredUiwName, materialReferences: refs.length, uniqueAssets: files.size, assetBytes: packageBytes.reduce((sum, bytes) => sum + bytes, 0) }, null, 2))
