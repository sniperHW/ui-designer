/**
 * 从用户确认的 V16 装配合同出发，绑定巨像文明 V8 全量素材。
 * 只处理视觉皮肤与用户明确确认的视觉覆盖，不以任何失败候选作为结构母版。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const contractPath = path.join(root, 'assets/ui-pipeline/page-contracts/card-library-colossus-v8.json')
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
const source = path.resolve(root, contract.structuralOriginUiw)
const stage = path.join(
  root,
  'output/card-page-anchor-reconstruction-v1/quality-remaster-v2/stage-16-colossus-v8-assets'
)
const assetDir = path.join(stage, 'assets')
const args = process.argv.slice(2)
const optionValue = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const output = path.resolve(optionValue('--output') ?? path.resolve(root, contract.approvedBaseline.uiw))
const auditOutput = path.resolve(optionValue('--audit') ?? path.join(stage, '装配审计-v23.json'))
if (output === source) throw new Error('装配输出不得覆盖结构源 UIW')
if (fs.existsSync(output)) throw new Error(`装配输出已存在，拒绝覆盖验收版本：${output}`)
if (fs.existsSync(auditOutput)) throw new Error(`装配审计已存在，拒绝覆盖验收记录：${auditOutput}`)

const portraitGate = contract.assemblyGates?.find((gate) => gate.id === 'card.portrait-slot-safe-inset')
if (!portraitGate || !Array.isArray(portraitGate.expectedRect) || portraitGate.expectedRect.length !== 4) {
  throw new Error('页面合同缺少 card.portrait-slot-safe-inset.expectedRect')
}
const [portraitX, portraitY, portraitW, portraitH] = portraitGate.expectedRect

const bytes = (file) => fs.readFileSync(file)
const sha256 = (file) => crypto.createHash('sha256').update(bytes(file)).digest('hex').toUpperCase()
const dataUri = (name) => `data:image/png;base64,${bytes(path.join(assetDir, name)).toString('base64')}`
const pngNames = fs.readdirSync(assetDir).filter((name) => name.endsWith('.png'))
const asset = Object.fromEntries(pngNames.map((name) => [name, dataUri(name)]))
const doc = JSON.parse(fs.readFileSync(source, 'utf8'))

function walk(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node)
    walk(node.children, visit)
    for (const page of node.pages ?? []) walk(page, visit)
    for (const slot of Object.values(node.slots ?? {})) walk(slot, visit)
  }
}

function allDocumentRoots(document) {
  return [
    document.commonLayer?.nodes,
    ...(document.pages ?? []).map((page) => page.nodes),
    ...(document.popups ?? []).map((page) => page.nodes),
    ...(document.tips ?? []).map((page) => page.nodes),
    ...(document.customWidgets ?? []).map((widget) => widget.tree),
  ]
}

function findNode(id) {
  let hit
  for (const nodes of allDocumentRoots(doc)) {
    walk(nodes, (node) => {
      if (node.id === id) hit = node
    })
    if (hit) return hit
  }
  throw new Error(`缺少装配合同节点：${id}`)
}

function findNodeByName(nodes, name) {
  let hit
  walk(nodes, (node) => {
    if (node.name === name) hit = node
  })
  return hit
}

function setRectSkin(node, src) {
  node.props ??= {}
  node.props.assetSrc = src
  node.props.radius = 0
}

function setImage(node, src) {
  node.props ??= {}
  node.props.src = src
}

function setStateSkins(node, defaultSrc, activeSrc) {
  node.props ??= {}
  node.props.assetDefaultSrc = defaultSrc
  node.props.assetActiveSrc = activeSrc
}

// 页面背景：8×8 纯色填充垫片，仅解决当前 UIW image 节点没有运行时 fill 属性的问题；不是整页背景图或拉伸纹理。
setImage(findNode('asset-card-page-background'), asset['background-solid-deep-navy-8x8.png'])

// 顶栏资源组：四框严格复用同一皮肤，图标与右侧能量按钮保持独立透明图层。
const resourceFrameIds = ['nmtfpehuyuv6v', 'nmtfpelgdfx5t', 'nmtfpep27rvqd', 'nmtfpesol58ij']
const resourceActionIds = ['nmtfpejokzj2k', 'nmtfpen9x9pve', 'nmtfpeqvojqd9', 'nmtfpeuibte3u']
const resourceActionTextIds = ['nmtfpekhtss5q', 'nmtfpeo3757f3', 'nmtfperp7d0zc', 'nmtfpevc06p22']
const resourceIconIds = ['asset-resource-icon-0', 'asset-resource-icon-1', 'asset-resource-icon-2', 'asset-resource-icon-3']
const resourceIconFiles = [
  'resource-icon-crystal-32x32.png',
  'resource-icon-bars-32x32.png',
  'resource-icon-orb-32x32.png',
  'resource-icon-coin-32x32.png',
]
for (let index = 0; index < resourceFrameIds.length; index += 1) {
  const frame = findNode(resourceFrameIds[index])
  setRectSkin(frame, asset['resource-frame-153x58.png'])

  const action = findNode(resourceActionIds[index])
  setRectSkin(action, asset['resource-action-energy-32x32.png'])
  action.visible = true
  action.x = frame.x + frame.w - 36
  action.y = frame.y + 13
  action.w = 32
  action.h = 32

  // 旧版“+”字符不属于 V8 的能量核心按钮；保留节点身份，清空过时字形。
  const obsoleteActionText = findNode(resourceActionTextIds[index])
  obsoleteActionText.visible = true
  obsoleteActionText.props.text = ''
  setImage(findNode(resourceIconIds[index]), asset[resourceIconFiles[index]])
}

// 底部主导航：同一按钮 family 的同轮廓状态 + 五张独立双色图标。
const navigation = findNode('nmtfpewglapzq')
setStateSkins(navigation, asset['nav-default-146x110.png'], asset['nav-active-146x110.png'])
navigation.props.assetIconSrcs = [
  'nav-icon-chest-96x72.png',
  'nav-icon-cards-96x72.png',
  'nav-icon-crossed-swords-96x72.png',
  'nav-icon-castle-96x72.png',
  'nav-icon-shield-handshake-96x72.png',
].map((name) => asset[name])
navigation.props.assetIconWidth = 96
navigation.props.assetIconHeight = 72
navigation.props.hideTabLabels = true

// 牌组标题与 1–5 号切换。
setRectSkin(findNode('spec2-deck-title-plate'), asset['deck-title-211x80.png'])
const deckSelector = findNode('spec2-deck-selector')
deckSelector.props.options = ['1', '2', '3', '4', '5']
setStateSkins(deckSelector, asset['deck-tab-default-98x80.png'], asset['deck-tab-active-98x80.png'])
delete deckSelector.props.assetDefaultSrcs
delete deckSelector.props.assetActiveSrcs
delete deckSelector.props.assetActiveOverlaySrc
delete deckSelector.props.activeOverlayWidth
delete deckSelector.props.activeOverlayHeight
delete deckSelector.props.activeOverlayOffsetX
delete deckSelector.props.activeOverlayOffsetY
delete deckSelector.props.assetIconSrc
delete deckSelector.props.assetIconSrcs
delete deckSelector.props.assetIconWidth
delete deckSelector.props.assetIconHeight

// 战力条继续使用原节点与动态内容；皮肤由牌组标题母版九宫格派生，不另造近似 family。
setRectSkin(findNode('nmtfpfe5qqumv'), asset['power-strip-derived-700x80.png'])
const statisticFiles = [
  'race-icon-orc-white-72x72.png',
  'race-icon-undead-white-72x72.png',
  'race-icon-human-white-72x72.png',
  'race-icon-machine-white-72x72.png',
  'battle-icon-sword-white-72x72.png',
  'battle-icon-bow-white-72x72.png',
]
for (let index = 0; index < statisticFiles.length; index += 1) {
  const icon = findNode(`asset-stat-icon-${index}`)
  setImage(icon, asset[statisticFiles[index]])
  icon.x = 245 + index * 78
  icon.y = 692
  icon.w = 66
  icon.h = 66
}

// 种族筛选：保留 V16 的不等宽合同（“全部”120，其余 72），皮肤均由牌组按钮母版九宫格派生。
const raceFilter = findNode('asset-library-filter-tab')
raceFilter.props.assetDefaultSrcs = [
  asset['race-filter-default-120x64.png'],
  ...Array.from({ length: 4 }, () => asset['race-filter-default-72x64.png']),
]
raceFilter.props.assetActiveSrcs = [
  asset['race-filter-active-120x64.png'],
  ...Array.from({ length: 4 }, () => asset['race-filter-active-72x64.png']),
]
delete raceFilter.props.assetDefaultSrc
delete raceFilter.props.assetActiveSrc
raceFilter.props.assetIconSrcs = [
  '',
  asset['race-icon-undead-gold-72x72.png'],
  asset['race-icon-orc-gold-72x72.png'],
  asset['race-icon-human-gold-72x72.png'],
  asset['race-icon-machine-gold-72x72.png'],
]
raceFilter.props.assetIconWidth = 40
raceFilter.props.assetIconHeight = 40

// 卡库继续使用真实滚动容器，透明表面叠加在全页纯色背景上，不添加固定底框。
for (let index = 0; index < 5; index += 1) {
  const scroll = findNode(`asset-library-scroll-${index}`)
  delete scroll.props.assetSrc
  scroll.props.transparentSurface = true
  scroll.props.scrollThumbColor = '#2FE5FF'
}

// 卡库切页栏：四个完整独立按钮，同一母版派生；图标保持独立透明图层。
const pager = findNode('library-category-pager')
setStateSkins(pager, asset['pager-default-169x84.png'], asset['pager-active-169x84.png'])
delete pager.props.assetDefaultSrcs
delete pager.props.assetActiveSrcs
pager.props.assetIconSrcs = [
  'pager-icon-grid-gold-48x48.png',
  'pager-icon-layers-gold-48x48.png',
  'pager-icon-storage-chest-gold-48x48.png',
  'pager-icon-smiley-gold-48x48.png',
].map((name) => asset[name])
pager.props.assetIconWidth = 48
pager.props.assetIconHeight = 48
pager.props.hideTabLabels = true

// 卡牌 family：四种卡完全复用同一卡框、同一徽章底座和同一进度轨道；种族图标单独叠加。
const widgetRaceFiles = new Map([
  ['游戏卡牌（绿色）', 'race-icon-orc-gold-72x72.png'],
  ['游戏卡牌（蓝色）', 'race-icon-undead-gold-72x72.png'],
  ['游戏卡牌（紫色）', 'race-icon-machine-gold-72x72.png'],
  ['游戏卡牌（金色）', 'race-icon-human-gold-72x72.png'],
])
for (const widget of doc.customWidgets ?? []) {
  const frame = findNodeByName(widget.tree, '卡框')
  const portrait = findNodeByName(widget.tree, '卡面图片')
  const badge = findNodeByName(widget.tree, '配型底')
  const raceIcon = findNodeByName(widget.tree, '配型图标')
  const progress = findNodeByName(widget.tree, '碎片进度条')
  if (!frame || !portrait || !badge || !raceIcon || !progress) continue

  setRectSkin(frame, asset['card-frame-common-160x220.png'])
  // 立绘窗口以页面合同为单一事实源，禁止在装配脚本中维护第二份尺寸。
  portrait.x = portraitX
  portrait.y = portraitY
  portrait.w = portraitW
  portrait.h = portraitH
  setRectSkin(badge, asset['card-race-badge-base-36x36-v2.png'])
  raceIcon.props ??= {}
  raceIcon.props.assetSrc = asset[widgetRaceFiles.get(widget.name) ?? 'race-icon-orc-gold-72x72.png']
  raceIcon.x = 12
  raceIcon.y = 12
  raceIcon.w = 26
  raceIcon.h = 26

  progress.props ??= {}
  progress.props.assetSrc = asset['card-progress-track-128x16.png']
  progress.props.assetFillSrc = asset['card-progress-fill-cyan-128x16.png']
}

// 用户已明确废弃的蓝色菱形挂件不进入新版本；其它结构节点均保留。
function removeNodeById(nodes, id) {
  for (let index = (nodes ?? []).length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node.id === id) {
      nodes.splice(index, 1)
      continue
    }
    removeNodeById(node.children, id)
    for (const page of node.pages ?? []) removeNodeById(page, id)
    for (const slot of Object.values(node.slots ?? {})) removeNodeById(slot, id)
  }
}
for (const page of doc.pages ?? []) removeNodeById(page.nodes, 'anchor-stage01-title_gem')

doc.meta ??= {}
doc.meta.name = '卡库区 V23：巨像文明 V8 立绘安全边装配预览'
doc.meta.description = '以 V16 为装配合同母版；在 V22 全量装配基础上统一将四种卡牌立绘横向收进卡框安全边，纵向窗口与其它结构不变。'

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`)

const audit = {
  status: 'assembled-awaiting-real-render-qa',
  source: path.relative(root, source),
  output: path.relative(root, output),
  sourceSha256: sha256(source),
  outputSha256: sha256(output),
  authority: 'V16 only',
  preserved: [
    '750×1600 竖屏画布',
    '页面、Tab、滚动容器、定制控件与卡库内容层级',
    '资源值、标题、等级、碎片数、战力值与六个统计值的运行时文字节点',
    '卡牌立绘独立层与滚动区行为',
    '五个底部导航入口、五个牌组按钮、五个种族筛选入口、四个卡库切页按钮',
  ],
  explicitUserOverrides: [
    '牌组标签由罗马数字改为阿拉伯数字 1–5',
    '移除蓝色菱形选中挂件',
    '六个战力图标统一为 66×66 且数字保持在各图标右侧',
    '四个资源能量按钮改用独立 32×32 透明素材并回到各自资源框内',
    `四种卡牌定义的立绘窗口统一执行合同矩形 [${portraitGate.expectedRect.join(',')}]`,
  ],
  runtimeRules: [
    '背景使用 8×8 纯色填充垫片，不使用整页背景图或拉伸纹理',
    '卡库保持真实 scroll，无遮盖底部的固定背景框',
    '进度填充由完整 fill 皮肤按 runtime progress 动态裁剪',
  ],
  reusedFamilies: {
    resourceFrame: resourceFrameIds,
    deckTab: ['spec2-deck-selector'],
    cardFrame: (doc.customWidgets ?? []).map((widget) => widget.id),
    raceOutline: ['card badge', 'race filter', 'power statistics'],
    navigation: ['nmtfpewglapzq'],
  },
  boundAssets: pngNames.sort().map((name) => ({
    file: `assets/${name}`,
    sha256: sha256(path.join(assetDir, name)),
  })),
}
fs.mkdirSync(path.dirname(auditOutput), { recursive: true })
fs.writeFileSync(auditOutput, `${JSON.stringify(audit, null, 2)}\n`)

console.log(output)
