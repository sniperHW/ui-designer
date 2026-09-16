import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const assetDir = resolve(root, 'output/card-page-ui-assets-2.0')
const sourceFile = resolve(root, 'output/card-page-structure-spec-2.0/卡牌页-结构规范2.0.uiw')
const outFile = resolve(assetDir, '卡牌-素材交互装配预览-2.0.uiw')

const doc = JSON.parse(readFileSync(sourceFile, 'utf8'))
const dataUri = (name) => {
  const file = resolve(assetDir, name)
  if (!existsSync(file)) throw new Error(`Missing asset: ${name}`)
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`
}
const asset = (name) => dataUri(name)

const artNames = [
  'green_guardian', 'blue_miner', 'purple_commander', 'gold_ranger',
  'green_golem', 'blue_knight', 'purple_dragon', 'gold_lancer',
  'green_archer', 'blue_sentinel', 'purple_oracle', 'gold_citadel',
  'green_shaman', 'blue_spearguard', 'purple_warlock', 'gold_guardian'
]
const artUri = Object.fromEntries(artNames.map((name) => [name, asset(`card_art_${name}_136x112.png`)]))

function visit(nodes, fn) {
  for (const node of nodes ?? []) {
    fn(node)
    for (const page of node.pages ?? []) visit(page, fn)
    visit(node.children, fn)
  }
}

function setNodeAssets(node) {
  node.props ??= {}
  if (node.name === '页面背景素材') node.props.src = asset('page_background_750x1600.png')
  if (node.name.startsWith('资源条')) node.props.assetSrc = asset('common_resource_bar_bg_160x44.png')
  if (node.name === '牌组标题底板') node.props.assetSrc = asset('deck_title_plate_140x64.png')
  if (node.name === '牌组编号切换') {
    node.props.assetDefaultSrc = asset('page_filter_tab_default_110x64.png')
    node.props.assetActiveSrc = asset('page_filter_tab_active_110x64.png')
  }
  if (node.name === '战力条') node.props.assetSrc = asset('page_power_bar_bg_700x70.png')
  if (node.name === '卡库筛选') {
    node.props.assetDefaultSrcs = [
      asset('library_filter_all_default_120x64.png'),
      asset('library_filter_skull_default_72x64.png'),
      asset('library_filter_wolf_default_72x64.png'),
      asset('library_filter_helmet_default_72x64.png'),
      asset('library_filter_gear_default_72x64.png')
    ]
    node.props.assetActiveSrcs = [
      asset('library_filter_all_active_120x64.png'),
      asset('library_filter_skull_active_72x64.png'),
      asset('library_filter_wolf_active_72x64.png'),
      asset('library_filter_helmet_active_72x64.png'),
      asset('library_filter_gear_active_72x64.png')
    ]
  }
  if (node.name === '卡牌分类') {
    node.props.assetDefaultSrc = asset('page_sub_tab_default_175x64.png')
    node.props.assetActiveSrc = asset('page_sub_tab_selected_175x64.png')
  }
  if (node.name === '主导航') {
    node.props.assetDefaultSrc = asset('page_main_nav_default_150x110.png')
    node.props.assetActiveSrc = asset('page_main_nav_selected_150x110.png')
  }
}

// Background and all ordinary skin bindings.
visit(doc.commonLayer.nodes, setNodeAssets)
for (const page of doc.pages) visit(page.nodes, setNodeAssets)

// Add a genuine instance-overridable art property to each rarity definition.  This is
// what prevents a generated art image from becoming a static mockup: every card node
// owns a `卡面` override while using the same reusable 游戏卡牌 widget and its interactions.
const frameByWidget = ['card_frame_green_160x220.png', 'card_frame_blue_160x220.png', 'card_frame_purple_160x220.png', 'card_frame_gold_160x220.png']
for (let wi = 0; wi < doc.customWidgets.length; wi += 1) {
  const widget = doc.customWidgets[wi]
  const face = widget.tree.find((node) => node.name === '卡面图片')
  const frame = widget.tree.find((node) => node.name === '卡框')
  const progress = widget.tree.find((node) => node.name === '碎片进度条')
  if (!face || !frame || !progress) throw new Error(`Invalid widget tree: ${widget.name}`)
  face.props.assetSrc = artUri[artNames[wi]]
  frame.props.assetSrc = asset(frameByWidget[wi])
  progress.props.assetSrc = asset('card_progress_track_136x24.png')
  progress.props.assetFillSrc = asset('card_progress_fill_136x24.png')
  const cardProp = widget.props.find((prop) => prop.name === '卡面')
  const bind = { nodeId: face.id, key: 'assetSrc' }
  if (cardProp) {
    cardProp.default = face.props.assetSrc
    cardProp.binds = [bind]
  } else {
    widget.props.push({ name: '卡面', type: 'string', default: face.props.assetSrc, binds: [bind] })
  }
}

// Assign varied art to every existing top and library card instance without altering
// coordinates, scroll behavior, category tabs, or filter page topology.
let cardIndex = 0
const applyCardArt = (node) => {
  if (node.type !== 'custom') return
  const key = artNames[cardIndex % artNames.length]
  cardIndex += 1
  node.overrides ??= {}
  node.overrides['卡面'] = artUri[key]
}
for (const page of doc.pages) visit(page.nodes, applyCardArt)

doc.meta.name = '卡牌-素材交互装配预览 2.0（巨像文明）'
mkdirSync(assetDir, { recursive: true })
writeFileSync(outFile, JSON.stringify(doc, null, 2), 'utf8')

const mapping = `# 卡牌页素材 ↔ 2.0 UIW 节点\n\n本目录的所有 PNG 都是运行时尺寸；UIW 内嵌同一份 PNG 数据以确保在设计工具中直接打开即可预览。\n\n| 素材 | 设计尺寸 | 绑定节点 / 定制控件 |\n|---|---:|---|\n| page_background_750x1600.png | 750×1600 | 公共层 / 页面背景素材 |\n| common_resource_bar_bg_160x44.png | 160×44 | 公共层 / 4 个资源条 |\n| deck_title_plate_140x64.png | 140×64 | 页面 / 牌组标题底板 |\n| page_filter_tab_default_110x64.png, page_filter_tab_active_110x64.png | 110×64 | 页面 / 牌组编号切换（5 个真实筛选项） |\n| card_frame_{green,blue,purple,gold}_160x220.png | 160×220 | 定制控件 / 游戏卡牌（4 个稀有度）/ 卡框 |\n| card_art_*_136x112.png（16 张） | 136×112 | 定制控件 / 游戏卡牌 / 卡面图片；由每张卡实例的“卡面”属性覆盖 |\n| card_progress_track_136x24.png, card_progress_fill_136x24.png | 136×24 | 定制控件 / 游戏卡牌 / 碎片进度条 |\n| page_power_bar_bg_700x70.png | 700×70 | 页面 / 战力条 |\n| library_filter_* | 120×64 / 72×64 | 页面 / 卡库筛选（5 个真实切换项） |\n| page_sub_tab_*_175x64.png | 175×64 | 卡库筛选各页 / 卡牌分类（卡牌、神器、宝箱、表情） |\n| page_main_nav_*_150x110.png | 150×110 | 页面 / 主导航（5 个真实切换项） |\n\n运行时文本（资源数、牌组号、等级、碎片、战力、筛选和导航文字）仍是 UIW 文本节点，未写入 PNG。顶端定位、更多、录制按钮保持隐藏，符合已确认范围。\n\n## 生成说明\n\n- build-card-page-assets-2.0.ps1：将 ImageGen 原始卡面裁切并缩放到节点实际尺寸，同时生成可控的框体皮肤。\n- assemble-card-preview-2.0.mjs：将 PNG 绑定到结构规范 2.0，并为每个卡牌实例写入独立“卡面”覆盖值；不改动任何交互容器的层级或坐标。\n`
writeFileSync(resolve(assetDir, 'README.md'), mapping, 'utf8')
console.log(outFile)
