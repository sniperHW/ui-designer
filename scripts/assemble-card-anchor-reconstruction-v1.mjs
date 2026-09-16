import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const assetDir = resolve(root, 'output/card-page-anchor-reconstruction-v1-assets')
const source = resolve(root, 'output/card-page-anchor-reconstruction-v1/卡牌页-锚点重建结构规范-v1.uiw')
const out = resolve(assetDir, '卡牌-锚点重建装配预览-v1.uiw')
const doc = JSON.parse(readFileSync(source, 'utf8'))
const uri = (name) => {
  const file = resolve(assetDir, name)
  if (!existsSync(file)) throw new Error(`Missing asset: ${name}`)
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`
}
const artNames = [
  'green_guardian', 'blue_miner', 'purple_commander', 'gold_ranger',
  'green_golem', 'blue_knight', 'purple_dragon', 'gold_lancer',
  'green_archer', 'blue_sentinel', 'purple_oracle', 'gold_citadel',
  'green_shaman', 'blue_spearguard', 'purple_warlock', 'gold_guardian'
]
const arts = Object.fromEntries(artNames.map((name) => [name, uri(`card_art_${name}_136x112.png`)]))

function visit(nodes, fn) {
  for (const node of nodes ?? []) {
    fn(node)
    for (const page of node.pages ?? []) visit(page, fn)
    visit(node.children, fn)
  }
}

// The background is the only newly generated environment bitmap.  It is independent
// of every UI component, so the real UIW nodes remain selectable and interactive.
for (const node of doc.commonLayer.nodes) {
  if (node.name === '页面背景素材') node.props.src = uri('page_background_750x1600.png')
}

for (let index = 0; index < doc.customWidgets.length; index += 1) {
  const widget = doc.customWidgets[index]
  const face = widget.tree.find((node) => node.name === '卡面图片')
  if (!face) throw new Error(`No card face node in ${widget.name}`)
  const binding = { nodeId: face.id, key: 'assetSrc' }
  const prop = widget.props.find((item) => item.name === '卡面')
  const defaultArt = arts[artNames[index]]
  face.props.assetSrc = defaultArt
  if (prop) { prop.default = defaultArt; prop.binds = [binding] }
  else widget.props.push({ name: '卡面', type: 'string', default: defaultArt, binds: [binding] })
}

let cardIndex = 0
for (const page of doc.pages) visit(page.nodes, (node) => {
  if (node.type !== 'custom') return
  node.overrides ??= {}
  node.overrides['卡面'] = arts[artNames[cardIndex % artNames.length]]
  cardIndex += 1
})

doc.meta.name = '卡牌-锚点重建装配预览 v1（角色立绘复用）'
writeFileSync(out, JSON.stringify(doc, null, 2), 'utf8')
console.log(out)
