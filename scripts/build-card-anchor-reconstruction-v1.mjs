import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'output/card-page-structure-spec-2.0/卡牌页-结构规范2.0.uiw')
const outDir = resolve(root, 'output/card-page-anchor-reconstruction-v1')
const out = resolve(outDir, '卡牌页-锚点重建结构规范-v1.uiw')
const doc = JSON.parse(readFileSync(source, 'utf8'))

doc.meta.name = '卡牌页-锚点重建结构规范 v1（巨像文明）'

// The reference is 859px wide.  These values are its 750px-canvas equivalents,
// not arbitrary rescaling: they keep the resource and deck bands aligned to the
// reference while retaining all established page and interaction containers.
// Four resource bars are one compact group, right-aligned to the 750px design canvas.
// 4 × 160 fills 640px and begins at x110; there is no artificial gap.
const resourcePositions = [110, 270, 430, 590]
for (const node of doc.commonLayer.nodes) {
  const index = ['💎', '🪵', '🔮', '🪙'].findIndex((token) => node.name.includes(token))
  if (index < 0) continue
  if (node.name.startsWith('资源条')) Object.assign(node, { x: resourcePositions[index], y: 28, w: 160, h: 44 })
  if (node.name.startsWith('资源值')) Object.assign(node, { x: resourcePositions[index], y: 34, w: 128, h: 32 })
  if (node.name.startsWith('资源加号字')) Object.assign(node, { x: resourcePositions[index] + 134, y: 39, w: 20, h: 18 })
  if (node.name.startsWith('资源加号')) Object.assign(node, { x: resourcePositions[index] + 134, y: 38, w: 20, h: 20 })
}
for (const node of doc.commonLayer.nodes) {
  const match = /^资源图标(\d+)$/.exec(node.name)
  if (match) Object.assign(node, { x: resourcePositions[Number(match[1]) - 1] + 13, y: 34, w: 32, h: 32 })
}

const mainTab = doc.pages[0].nodes.find((node) => node.type === 'tab')
const page = mainTab.pages[1]
const titlePlate = page.find((node) => node.name === '牌组标题底板')
const titleText = page.find((node) => node.name === '牌组标题文字')
const deckTabs = page.find((node) => node.name === '牌组编号切换')
Object.assign(titlePlate, { x: 25, y: 120, w: 200, h: 64 })
Object.assign(titleText, { x: 45, y: 134, w: 160, h: 36 })
Object.assign(deckTabs, { x: 235, y: 120, w: 490, h: 64 })

mkdirSync(outDir, { recursive: true })
writeFileSync(out, JSON.stringify(doc, null, 2), 'utf8')
console.log(out)
