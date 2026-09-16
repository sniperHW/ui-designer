import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceFile = resolve(root, 'output/card-page-ui-assets-slate-library-filter/卡牌-素材交互装配预览-卡库筛选版.uiw')
const outDir = resolve(root, 'output/card-page-structure-spec-2.0')
const outFile = resolve(outDir, '卡牌页-结构规范2.0.uiw')
const doc = JSON.parse(readFileSync(sourceFile, 'utf8'))

doc.meta.name = '卡牌页结构规范 2.0（巨像文明）'
const mainTab = doc.pages[0].nodes.find((node) => node.type === 'tab')
const pageNodes = mainTab.pages[1]

// 原“牌组、1、2、3、4、5”合并筛选器拆为独立标题牌 + 五个编号按钮，匹配参考图层级。
const deckIndex = pageNodes.findIndex((node) => node.name === '牌组选择')
if (deckIndex < 0) throw new Error('未找到牌组选择节点')
const deck = pageNodes[deckIndex]
deck.id = 'spec2-deck-selector'
deck.name = '牌组编号切换'
deck.x = 175
deck.y = 130
deck.w = 550
deck.h = 64
deck.visible = true
deck.locked = false
deck.props = {
  ...deck.props,
  options: ['1', '2', '3', '4', '5'],
  selected: 3,
  fontSize: 26,
  bold: true,
  fontWeight: 800,
  textColor: '#F4F8FF',
  textStroke: '#08111F',
  textStrokeWidth: 1.2
}
const titlePlate = {
  id: 'spec2-deck-title-plate', type: 'rect', name: '牌组标题底板',
  x: 25, y: 130, w: 140, h: 64, visible: true, locked: false,
  props: { radius: 14, assetSrc: deck.props.assetActiveSrc ?? deck.props.assetDefaultSrc }
}
const titleText = {
  id: 'spec2-deck-title-text', type: 'text', name: '牌组标题文字',
  x: 35, y: 144, w: 120, h: 36, visible: true, locked: false,
  props: { text: '牌组', fontSize: 30, bold: true, fontWeight: 800, align: 'center', textColor: '#FFF2B8', textStroke: '#08111F', textStrokeWidth: 1.4 }
}
pageNodes.splice(deckIndex, 1, titlePlate, titleText, deck)

// 2.0：提高卡面在 160×220 定制卡牌中的占比；等级与进度仍为运行时文字/进度。
for (const widget of doc.customWidgets) {
  for (const node of widget.tree) {
    if (node.name === '卡面图片') Object.assign(node, { x: 12, y: 38, w: 136, h: 112 })
    if (node.name === '等级文字') Object.assign(node, { x: 0, y: 150, w: 160, h: 26 })
    if (node.name === '碎片进度条') Object.assign(node, { x: 12, y: 180, w: 136, h: 24 })
    if (node.name === '碎片文字') Object.assign(node, { x: 12, y: 181, w: 136, h: 22 })
  }
}

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, JSON.stringify(doc, null, 2), 'utf8')
console.log(outFile)
